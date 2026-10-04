// Local medication-reminder preset for an existing Vow.
// Self-report schedule only. Not dosing advice, not a medical device, not a live notifier.

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ACK_RE = /^[a-zA-Z0-9:_-]{1,80}$/;

export const PRESET_ID = "medication-reminders";
export const DISCLAIMER =
  "Local self-report schedule. A stored check-in is not proof a dose was taken, and this preset does not recommend a dose, change, or stop.";

export const TRANSPORTS = {
  telegram: "pending_explicit_adapter",
  discord: "pending_explicit_adapter",
  slack: "pending_explicit_adapter",
  push: "pending_explicit_adapter",
};

const TERMINAL = new Set(["taken", "skipped", "corrected"]);

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

export function assertIanaTimeZone(timeZone) {
  if (typeof timeZone !== "string" || !timeZone.trim()) throw fail("invalid_timezone", "timezone is required");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
  } catch {
    throw fail("invalid_timezone", "timezone must be a valid IANA name");
  }
  return timeZone;
}

function assertTime(value, label) {
  if (typeof value !== "string" || !TIME_RE.test(value)) throw fail("invalid_time", `${label} must be HH:MM`);
  return value;
}

function localParts(ms, timeZone) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(ms)).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hm: `${parts.hour}:${parts.minute}` };
}

export function localClock(ms, timeZone) {
  assertIanaTimeZone(timeZone);
  return localParts(ms, timeZone);
}

export function dueSnapshot(state, now = Date.now()) {
  const local = localParts(now, state.timezone);
  const inactive = state.status === "paused" || state.status === "stopped" || state.status === "unconfirmed";
  const rows = state.times.map((time) => {
    const id = occurrenceId(state.plan_id, local.date, time);
    const existing = state.occurrences[id];
    const phase = existing?.phase || "scheduled";
    const dueHm = existing?.due_hm || time;
    const clockDue = !TERMINAL.has(phase) && phase !== "due_not_reported" && local.hm >= dueHm && local.date === (existing?.date || local.date);
    return {
      id,
      date: local.date,
      time,
      due_hm: dueHm,
      phase,
      due: !inactive && clockDue,
      delivery: false,
      plan_status: state.status,
      timezone: state.timezone,
      local_hm: local.hm,
    };
  });
  return {
    timezone: state.timezone,
    local,
    rows,
    delivery: false,
    plan_status: state.status,
    paused: state.status === "paused",
    stopped: state.status === "stopped",
  };
}

export function inQuietHours(hm, quiet) {
  if (!quiet) return false;
  const { start, end } = quiet;
  if (start === end) return false;
  if (start < end) return hm >= start && hm < end;
  return hm >= start || hm < end;
}

function clone(state) {
  return structuredClone(state);
}

function occurrenceId(planId, date, time) {
  return `${planId}:${date}:${time}`;
}

export function createMedicationPlan(input = {}) {
  if (!input.plan_id || !input.vow_id) throw fail("invalid_plan", "plan_id and vow_id are required");
  if (!Array.isArray(input.times) || input.times.length < 1 || input.times.length > 8) {
    throw fail("invalid_schedule", "times must be 1 to 8 HH:MM values");
  }
  const times = [...new Set(input.times.map((t) => assertTime(t, "schedule time")))].sort();
  const timezone = assertIanaTimeZone(input.timezone);
  let quiet_hours = null;
  if (input.quiet_hours) {
    quiet_hours = {
      start: assertTime(input.quiet_hours.start, "quiet start"),
      end: assertTime(input.quiet_hours.end, "quiet end"),
    };
  }
  if (input.escalation_consent !== undefined && typeof input.escalation_consent !== "boolean") {
    throw fail("invalid_consent", "escalation_consent must be an explicit boolean");
  }
  const max = input.max_retries === undefined ? 0 : input.max_retries;
  if (!Number.isInteger(max) || max < 0 || max > 3) throw fail("invalid_retry", "max_retries must be an integer from 0 to 3");
  if (max > 0 && input.escalation_consent !== true) {
    throw fail("consent_required", "bounded retry requires explicit escalation_consent true");
  }
  return {
    preset_id: PRESET_ID,
    plan_id: String(input.plan_id),
    vow_id: String(input.vow_id),
    label: String(input.label || "medication"),
    timezone,
    times,
    quiet_hours,
    max_snoozes: 2,
    escalation: { consent: input.escalation_consent === true, max_retries: input.escalation_consent === true ? max : 0 },
    status: "unconfirmed",
    occurrences: {},
    acks: {},
    dedupes: {},
    events: [],
    disclaimer: DISCLAIMER,
    transports: TRANSPORTS,
    medical_advice: false,
    live_delivery: false,
  };
}

function append(state, event) {
  state.events.push(event);
  return state;
}

function checkinFor(state, occ, status, note, supersedes = null) {
  return {
    vow_id: state.vow_id,
    checkin_id: `rx-${occ.id}-${status}-${state.events.length + 1}`,
    date: occ.date,
    status,
    note,
    supersedes,
    ts: occ.updated_at,
    domain: PRESET_ID,
    self_report: true,
    not_clinical_confirmation: true,
  };
}

function ensureOccurrence(state, date, time, now) {
  const id = occurrenceId(state.plan_id, date, time);
  if (!state.occurrences[id]) {
    state.occurrences[id] = {
      id,
      date,
      time,
      phase: "scheduled",
      snooze_count: 0,
      retry_count: 0,
      due_hm: time,
      checkin_id: null,
      updated_at: now,
    };
  }
  return state.occurrences[id];
}

export function confirmMedicationPlan(state, confirmation = {}, now = Date.now()) {
  const next = clone(state);
  if (next.status !== "unconfirmed") throw fail("invalid_transition", "plan is already confirmed");
  if (confirmation.user_confirmed !== true) throw fail("confirmation_required", "user_confirmed must be true");
  if (confirmation.timezone && confirmation.timezone !== next.timezone) {
    throw fail("timezone_mismatch", "confirmation timezone must match the plan");
  }
  if (confirmation.schedule_ack !== true) throw fail("confirmation_required", "schedule_ack must be true");
  next.status = "active";
  append(next, { type: "confirmed", at: now, ack_id: confirmation.ack_id || null });
  return { state: next, checkin: null, duplicate: false };
}

function requireActive(state) {
  if (state.status === "unconfirmed") throw fail("unconfirmed", "schedule is not user-confirmed");
  if (state.status === "paused") throw fail("paused", "plan is paused");
  if (state.status === "stopped") throw fail("stopped", "plan is stopped");
}

export function reduceMedication(state, event = {}, now = Date.now()) {
  if (event.ack_id) {
    if (!ACK_RE.test(event.ack_id)) throw fail("invalid_ack", "ack_id must be a short token");
    if (state.acks[event.ack_id]) {
      return { state, checkin: null, duplicate: true, prior: state.acks[event.ack_id] };
    }
  }
  if (event.dedupe_id) {
    if (!ACK_RE.test(event.dedupe_id)) throw fail("invalid_dedupe", "dedupe_id must be a short token");
    if (state.dedupes[event.dedupe_id]) {
      return { state, checkin: null, duplicate: true, prior: state.dedupes[event.dedupe_id] };
    }
  }
  const next = clone(state);
  const type = event.type;
  let checkin = null;

  if (type === "confirm") return finish(confirmMedicationPlan(state, event, now), event.ack_id, event.dedupe_id);
  if (type === "pause") {
    if (next.status !== "active") throw fail("invalid_transition", "only an active plan can pause");
    next.status = "paused";
    append(next, { type, at: now });
    return finish({ state: next, checkin: null, duplicate: false }, event.ack_id, event.dedupe_id);
  }
  if (type === "resume") {
    if (next.status !== "paused") throw fail("invalid_transition", "only a paused plan can resume");
    next.status = "active";
    append(next, { type, at: now });
    return finish({ state: next, checkin: null, duplicate: false }, event.ack_id, event.dedupe_id);
  }
  if (type === "stop") {
    if (next.status === "stopped") throw fail("invalid_transition", "plan is already stopped");
    if (next.status === "unconfirmed") throw fail("invalid_transition", "confirm or discard before stop");
    next.status = "stopped";
    append(next, { type, at: now });
    return finish({ state: next, checkin: null, duplicate: false }, event.ack_id, event.dedupe_id);
  }

  if (type === "evaluate_due") {
    requireActive(next);
    const local = localParts(now, next.timezone);
    const opened = [];
    const intents = [];
    for (const time of next.times) {
      const occ = ensureOccurrence(next, local.date, time, now);
      if (TERMINAL.has(occ.phase) || occ.phase === "due_not_reported") continue;
      const dueHm = occ.due_hm || time;
      if (local.hm >= dueHm && local.date === occ.date) {
        occ.phase = "due_not_reported";
        occ.updated_at = now;
        occ.checkin_id = null;
        append(next, { type: "due_not_reported", occurrence_id: occ.id, at: now, due_hm: dueHm });
        const intent = {
          occurrence_id: occ.id,
          date: occ.date,
          time: occ.time,
          due_hm: dueHm,
          phase: occ.phase,
          send: false,
          not_sent: true,
          delivery: false,
          self_report: false,
          checkin: null,
        };
        intents.push(intent);
        opened.push(occ.id);
      }
    }
    return finish({ state: next, checkin: null, duplicate: false, opened, intents }, event.ack_id, event.dedupe_id);
  }

  if (type === "taken" || type === "skipped" || type === "snoozed" || type === "correct") {
    if (!event.dedupe_id) throw fail("dedupe_required", "channel reports require a shared dedupe_id");
  }

  if (type === "taken" || type === "skipped" || type === "snoozed") {
    requireActive(next);
    const occ = next.occurrences[event.occurrence_id];
    if (!occ) throw fail("unknown_occurrence", "occurrence_id is not on this plan");
    if (TERMINAL.has(occ.phase)) throw fail("already_reported", "occurrence already has a terminal self-report; correct it instead");
    if (type === "snoozed") {
      const minutes = event.minutes;
      if (!Number.isInteger(minutes) || minutes < 5 || minutes > 120) throw fail("invalid_snooze", "snooze minutes must be 5 to 120");
      if (occ.snooze_count >= next.max_snoozes) throw fail("snooze_bound", "snooze count is bounded");
      occ.snooze_count += 1;
      occ.phase = "snoozed";
      occ.updated_at = now;
      const [hh, mm] = (occ.due_hm || occ.time).split(":").map(Number);
      const total = hh * 60 + mm + minutes;
      occ.due_hm = `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
      append(next, { type, occurrence_id: occ.id, at: now, minutes, due_hm: occ.due_hm });
      checkin = checkinFor(next, occ, "skipped", `medication snoozed ${minutes} minutes; not a taken report`);
      occ.checkin_id = checkin.checkin_id;
      return finish({ state: next, checkin, duplicate: false, due_hm: occ.due_hm }, event.ack_id, event.dedupe_id);
    }
    occ.phase = type;
    occ.updated_at = now;
    append(next, { type, occurrence_id: occ.id, at: now });
    const status = type === "taken" ? "done" : "skipped";
    const note = type === "taken"
      ? "medication taken self-report; not clinical confirmation"
      : "medication skipped self-report";
    checkin = checkinFor(next, occ, status, note);
    occ.checkin_id = checkin.checkin_id;
    return finish({ state: next, checkin, duplicate: false }, event.ack_id, event.dedupe_id);
  }

  if (type === "correct") {
    if (next.status === "unconfirmed") throw fail("unconfirmed", "nothing to correct");
    const occ = next.occurrences[event.occurrence_id];
    if (!occ || !occ.checkin_id) throw fail("unknown_occurrence", "no prior report to correct");
    if (event.report !== "taken" && event.report !== "skipped") throw fail("invalid_correction", "correction report must be taken or skipped");
    const prior = occ.checkin_id;
    occ.phase = "corrected";
    occ.updated_at = now;
    append(next, { type, occurrence_id: occ.id, at: now, report: event.report, supersedes: prior });
    const status = event.report === "taken" ? "done" : "skipped";
    checkin = checkinFor(next, occ, status, "medication self-report correction; prior entry kept", prior);
    occ.checkin_id = checkin.checkin_id;
    return finish({ state: next, checkin, duplicate: false }, event.ack_id, event.dedupe_id);
  }

  throw fail("unknown_event", "unsupported medication event");
}

function finish(result, ackId, dedupeId) {
  const intents = result.intents || null;
  if (ackId) {
    result.state.acks[ackId] = {
      ack_id: ackId,
      checkin_id: result.checkin?.checkin_id || null,
      dedupe_id: dedupeId || null,
      intents,
    };
  }
  if (dedupeId) {
    result.state.dedupes[dedupeId] = {
      dedupe_id: dedupeId,
      checkin_id: result.checkin?.checkin_id || null,
      ack_id: ackId || null,
      intents,
      opened: result.opened || null,
    };
  }
  return result;
}

export function escalationIntent(state, occurrenceId, now = Date.now()) {
  const occ = state.occurrences[occurrenceId];
  const base = { send: false, not_sent: true, transport: "pending_explicit_adapter", live_delivery: false };
  if (!occ) return { ...base, reason: "unknown_occurrence" };
  if (state.status !== "active") return { ...base, reason: state.status };
  if (occ.phase !== "due_not_reported") return { ...base, reason: "not_due" };
  if (state.escalation.consent !== true) return { ...base, reason: "consent_required" };
  if (occ.retry_count >= state.escalation.max_retries) return { ...base, reason: "retry_bound" };
  const local = localParts(now, state.timezone);
  if (inQuietHours(local.hm, state.quiet_hours)) return { ...base, reason: "quiet_hours" };
  return { ...base, reason: "adapter_pending", local_intent: true, retry_index: occ.retry_count + 1 };
}

export function recordEscalationAttempt(state, occurrenceId, now = Date.now()) {
  const intent = escalationIntent(state, occurrenceId, now);
  if (!intent.local_intent) return { state, intent, recorded: false };
  const next = clone(state);
  next.occurrences[occurrenceId].retry_count += 1;
  next.occurrences[occurrenceId].updated_at = now;
  append(next, { type: "escalation_intent", occurrence_id: occurrenceId, at: now, not_sent: true, retry_count: next.occurrences[occurrenceId].retry_count });
  return { state: next, intent: { ...intent, not_sent: true, send: false }, recorded: true };
}

export function toCheckinInput(checkin) {
  if (!checkin) return null;
  return {
    vow_id: checkin.vow_id,
    checkin_id: checkin.checkin_id,
    date: checkin.date,
    status: checkin.status,
    note: checkin.note,
    supersedes: checkin.supersedes,
    ts: checkin.ts,
  };
}
