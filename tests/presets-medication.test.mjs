import { test } from "node:test";
import assert from "node:assert/strict";
import { VowLedgerMock } from "../packages/core/memwal-mock.mjs";
import { Companion } from "../packages/core/companion.mjs";
import {
  createMedicationPlan,
  reduceMedication,
  escalationIntent,
  recordEscalationAttempt,
  dueSnapshot,
  localClock,
  toCheckinInput,
  PRESET_ID,
} from "../src/presets/medication.mjs";

const NOW = Date.parse("2026-10-02T06:30:00.000Z"); // 09:30 Europe/Minsk

function plan(extra = {}) {
  return createMedicationPlan({
    plan_id: "plan-am",
    vow_id: "vow:meds",
    label: "morning tablet",
    timezone: "Europe/Minsk",
    times: ["09:00"],
    quiet_hours: { start: "22:00", end: "07:00" },
    escalation_consent: false,
    ...extra,
  });
}

async function confirmed() {
  const created = plan();
  const out = reduceMedication(created, { type: "confirm", user_confirmed: true, schedule_ack: true, timezone: "Europe/Minsk" }, NOW);
  return out.state;
}

test("medication plan stays unconfirmed until the user confirms schedule and timezone", () => {
  const created = plan();
  assert.equal(created.status, "unconfirmed");
  assert.throws(() => reduceMedication(created, { type: "confirm", user_confirmed: false, schedule_ack: true }, NOW), /user_confirmed/);
  const ok = reduceMedication(created, { type: "confirm", user_confirmed: true, schedule_ack: true }, NOW);
  assert.equal(ok.state.status, "active");
  assert.equal(ok.state.medical_advice, false);
  assert.equal(ok.state.live_delivery, false);
});

test("due not reported, taken, skipped, snoozed, corrected, paused, and stopped", () => {
  let state = plan();
  state = reduceMedication(state, { type: "confirm", user_confirmed: true, schedule_ack: true }, NOW).state;
  const due = reduceMedication(state, { type: "evaluate_due" }, NOW);
  assert.equal(due.checkin, null);
  assert.equal(due.opened.length, 1);
  assert.equal(due.state.occurrences[due.opened[0]].phase, "due_not_reported");
  assert.equal(due.state.occurrences[due.opened[0]].checkin_id, null);
  const id = due.opened[0];

  assert.throws(() => reduceMedication(due.state, { type: "taken", occurrence_id: id }, NOW + 1000), /dedupe_id/);
  const taken = reduceMedication(due.state, { type: "taken", occurrence_id: id, dedupe_id: "occ-taken" }, NOW + 1000);
  assert.equal(taken.checkin.status, "done");
  assert.equal(taken.checkin.not_clinical_confirmation, true);

  const skippedPlan = reduceMedication(due.state, { type: "skipped", occurrence_id: id, dedupe_id: "occ-skip" }, NOW + 1000);
  assert.equal(skippedPlan.checkin.status, "skipped");

  const snoozed = reduceMedication(due.state, { type: "snoozed", occurrence_id: id, minutes: 30, dedupe_id: "occ-snooze-1" }, NOW + 1000);
  assert.equal(snoozed.state.occurrences[id].phase, "snoozed");
  assert.equal(snoozed.checkin.status, "skipped");
  const again = reduceMedication(snoozed.state, { type: "snoozed", occurrence_id: id, minutes: 30, dedupe_id: "occ-snooze-2" }, NOW + 2000);
  assert.equal(again.state.occurrences[id].snooze_count, 2);
  assert.throws(() => reduceMedication(again.state, { type: "snoozed", occurrence_id: id, minutes: 30, dedupe_id: "occ-snooze-3" }, NOW), /bounded/);

  const corrected = reduceMedication(taken.state, { type: "correct", occurrence_id: id, report: "skipped", dedupe_id: "occ-correct" }, NOW + 2000);
  assert.equal(corrected.checkin.supersedes, taken.checkin.checkin_id);
  assert.equal(corrected.state.events[0].type, "confirmed");
  assert.equal(corrected.state.events.at(-1).type, "correct");

  const paused = reduceMedication(due.state, { type: "pause" }, NOW);
  assert.equal(paused.state.status, "paused");
  assert.throws(() => reduceMedication(paused.state, { type: "taken", occurrence_id: id, dedupe_id: "while-paused" }, NOW), /paused/);
  const stopped = reduceMedication(paused.state, { type: "resume" }, NOW);
  const end = reduceMedication(stopped.state, { type: "stop" }, NOW);
  assert.equal(end.state.status, "stopped");
  assert.throws(() => reduceMedication(end.state, { type: "evaluate_due" }, NOW), /stopped/);
});

test("acknowledgements are idempotent and do not append a second check-in", () => {
  let state = plan();
  state = reduceMedication(state, { type: "confirm", user_confirmed: true, schedule_ack: true, ack_id: "ack-1" }, NOW).state;
  const again = reduceMedication(state, { type: "confirm", user_confirmed: true, schedule_ack: true, ack_id: "ack-1" }, NOW + 5);
  assert.equal(again.duplicate, true);
  assert.equal(again.checkin, null);
  assert.equal(again.state.events.length, state.events.length);
});

test("retry escalation needs explicit consent, stays quiet, and never marks a send", () => {
  let state = plan({ escalation_consent: true, max_retries: 2 });
  state = reduceMedication(state, { type: "confirm", user_confirmed: true, schedule_ack: true }, NOW).state;
  const due = reduceMedication(state, { type: "evaluate_due" }, NOW);
  const id = due.opened[0];
  const quietNow = Date.parse("2026-10-02T20:30:00.000Z"); // 23:30 Europe/Minsk
  const quiet = escalationIntent(due.state, id, quietNow);
  assert.equal(quiet.reason, "quiet_hours");
  assert.equal(quiet.send, false);
  assert.equal(quiet.not_sent, true);

  const open = escalationIntent(due.state, id, NOW);
  assert.equal(open.local_intent, true);
  assert.equal(open.transport, "pending_explicit_adapter");
  assert.equal(open.send, false);
  const recorded = recordEscalationAttempt(due.state, id, NOW);
  const second = recordEscalationAttempt(recorded.state, id, NOW);
  const third = recordEscalationAttempt(second.state, id, NOW);
  assert.equal(third.recorded, false);
  assert.equal(third.intent.reason, "retry_bound");

  const noConsent = plan();
  const confirmed = reduceMedication(noConsent, { type: "confirm", user_confirmed: true, schedule_ack: true }, NOW).state;
  const missed = reduceMedication(confirmed, { type: "evaluate_due" }, NOW);
  assert.equal(escalationIntent(missed.state, missed.opened[0], NOW).reason, "consent_required");
});

test("due state uses the IANA zone, including a DST offset change", () => {
  const winter = Date.parse("2026-01-15T13:00:00.000Z");
  const summer = Date.parse("2026-07-15T13:00:00.000Z");
  assert.equal(localClock(winter, "America/New_York").hm, "08:00");
  assert.equal(localClock(summer, "America/New_York").hm, "09:00");
  const created = createMedicationPlan({
    plan_id: "plan-ny",
    vow_id: "vow:meds",
    timezone: "America/New_York",
    times: ["09:00"],
    escalation_consent: false,
  });
  const active = reduceMedication(created, { type: "confirm", user_confirmed: true, schedule_ack: true }, winter).state;
  const before = dueSnapshot(active, winter);
  assert.equal(before.rows[0].due, false);
  assert.equal(before.rows[0].local_hm, "08:00");
  const after = reduceMedication(active, { type: "evaluate_due" }, summer);
  assert.equal(after.opened.length, 1);
  assert.equal(dueSnapshot(after.state, summer).rows[0].phase, "due_not_reported");
  const sameUtcHourWinter = reduceMedication(active, { type: "evaluate_due" }, winter);
  assert.deepEqual(sameUtcHourWinter.opened, []);
  assert.equal(sameUtcHourWinter.checkin, null);
});

test("refuses retry bound without consent and rejects a bad timezone", () => {
  assert.throws(() => plan({ escalation_consent: false, max_retries: 2 }), /consent/);
  assert.throws(() => plan({ timezone: "Not/AZone" }), /IANA/);
});

test("mapped check-ins append through Companion and corrections do not rewrite", async () => {
  const client = new VowLedgerMock();
  const companion = new Companion({ client, owner: "sam", mode: "mock" });
  await companion.makeVow({ vow_id: "vow:meds", title: "Medication self-report", cadence: "daily" });
  let state = await confirmed();
  const due = reduceMedication(state, { type: "evaluate_due" }, NOW);
  const taken = reduceMedication(due.state, { type: "taken", occurrence_id: due.opened[0], ack_id: "take-1", dedupe_id: "cross-1", channel: "telegram" }, NOW + 1000);
  const first = await companion.checkin(toCheckinInput(taken.checkin));
  const dup = reduceMedication(taken.state, { type: "taken", occurrence_id: due.opened[0], ack_id: "take-1", dedupe_id: "cross-1", channel: "discord" }, NOW + 1000);
  assert.equal(dup.duplicate, true);
  assert.equal(dup.checkin, null);
  const corrected = reduceMedication(taken.state, { type: "correct", occurrence_id: due.opened[0], report: "skipped", dedupe_id: "cross-correct" }, NOW + 3000);
  const second = await companion.checkin(toCheckinInput(corrected.checkin));
  assert.equal(second.entry.supersedes, first.entry.checkin_id);
  assert.notEqual(second.entry.hash, first.entry.hash);
  const audit = await companion.audit();
  assert.equal(audit.decision.state, "intact");
  const { entries } = await companion.recallCheckins();
  assert.equal(entries.length, 2);
  assert.equal(entries[0].note, first.entry.note);
  assert.equal(PRESET_ID, "medication-reminders");
});

test("clock evaluation does not invent a missed self-report", () => {
  const at = Date.parse("2026-10-03T08:00:00.000Z"); // 11:00 Europe/Minsk
  let state = plan({ times: ["09:00", "10:00"] });
  state = reduceMedication(state, { type: "confirm", user_confirmed: true, schedule_ack: true }, at).state;
  const due = reduceMedication(state, { type: "evaluate_due", dedupe_id: "due-both" }, at);
  assert.equal(due.checkin, null);
  assert.equal(due.opened.length, 2);
  assert.equal(new Set(due.opened).size, 2);
  assert.equal(due.intents.length, 2);
  for (const intent of due.intents) {
    assert.equal(intent.checkin, null);
    assert.equal(intent.self_report, false);
    assert.equal(intent.send, false);
    assert.equal(intent.delivery, false);
  }
  for (const id of due.opened) {
    const occ = due.state.occurrences[id];
    assert.equal(occ.phase, "due_not_reported");
    assert.equal(occ.checkin_id, null);
  }
  const serialized = JSON.stringify(due);
  assert.equal(serialized.includes('"status":"missed"'), false);
  assert.equal(due.state.events.some((event) => event.type === "taken" || event.type === "skipped"), false);
  const again = reduceMedication(due.state, { type: "evaluate_due", dedupe_id: "due-both" }, at + 1000);
  assert.equal(again.duplicate, true);
  assert.equal(again.checkin, null);
  assert.deepEqual(again.prior.intents.map((intent) => intent.occurrence_id), due.opened);
  assert.equal(again.state.events.length, due.state.events.length);
});

test("two slots stay observable and pause or stop reports no delivery", () => {
  const at = Date.parse("2026-10-03T08:00:00.000Z");
  let state = plan({ times: ["09:00", "10:00"] });
  state = reduceMedication(state, { type: "confirm", user_confirmed: true, schedule_ack: true }, at).state;
  const due = reduceMedication(state, { type: "evaluate_due" }, at);
  assert.deepEqual(due.opened, ["plan-am:2026-10-03:09:00", "plan-am:2026-10-03:10:00"]);
  const snap = dueSnapshot(due.state, at);
  assert.equal(snap.rows.length, 2);
  assert.equal(snap.delivery, false);
  assert.equal(snap.rows.every((row) => row.due === false && row.phase === "due_not_reported"), true);

  const paused = reduceMedication(due.state, { type: "pause" }, at);
  const pausedSnap = dueSnapshot(paused.state, at);
  assert.equal(pausedSnap.paused, true);
  assert.equal(pausedSnap.stopped, false);
  assert.equal(pausedSnap.delivery, false);
  assert.equal(pausedSnap.rows.every((row) => row.due === false), true);
  assert.throws(() => reduceMedication(paused.state, { type: "evaluate_due" }, at), /paused/);

  const stopped = reduceMedication(paused.state, { type: "stop" }, at);
  const stoppedSnap = dueSnapshot(stopped.state, at);
  assert.equal(stoppedSnap.stopped, true);
  assert.equal(stoppedSnap.delivery, false);
  assert.equal(stoppedSnap.rows.every((row) => row.due === false), true);
  assert.throws(() => reduceMedication(stopped.state, { type: "evaluate_due" }, at), /stopped/);
});

test("snooze due_hm matches the shifted local clock and is not a taken report", () => {
  let state = plan();
  state = reduceMedication(state, { type: "confirm", user_confirmed: true, schedule_ack: true }, NOW).state;
  const due = reduceMedication(state, { type: "evaluate_due" }, NOW);
  const id = due.opened[0];
  const snoozed = reduceMedication(due.state, { type: "snoozed", occurrence_id: id, minutes: 30, dedupe_id: "snooze-hm" }, NOW + 1000);
  assert.equal(snoozed.state.occurrences[id].due_hm, "09:30");
  assert.equal(snoozed.due_hm, "09:30");
  assert.equal(dueSnapshot(snoozed.state, NOW).rows[0].due_hm, "09:30");
  assert.equal(snoozed.checkin.status, "skipped");
  assert.equal(snoozed.checkin.self_report, true);
});
