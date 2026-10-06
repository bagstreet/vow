import { test } from "node:test";
import assert from "node:assert/strict";
import { VowLedgerMock } from "../packages/core/memwal-mock.mjs";
import { Companion } from "../packages/core/companion.mjs";
import { createDiary, reduceNutriMind, toCheckinInput, goalSnapshot, PRESET_ID } from "../src/presets/nutrimind.mjs";
import { listPresets } from "../src/presets/index.mjs";

const NOW = Date.parse("2026-10-02T12:00:00.000Z");

function diary() {
  return createDiary({ diary_id: "diary-1", vow_id: "vow:meals", timezone: "Europe/Minsk" });
}

test("diary accepts food, hydration, preferences, and user-set goals only", () => {
  let state = diary();
  const goal = reduceNutriMind(state, { type: "set_goal", kind: "hydration_ml", ml: 1800 }, NOW);
  assert.equal(goal.checkin.status, "skipped");
  assert.equal(goalSnapshot(goal.state).prescribed, false);
  const pref = reduceNutriMind(goal.state, { type: "set_preference", likes: ["oats"], dislikes: ["soda"], diet_label: "user label" }, NOW);
  const food = reduceNutriMind(pref.state, { type: "log_food", date: "2026-10-02", item: "oats", amount_text: "one bowl", meal: "morning" }, NOW);
  assert.equal(food.checkin.status, "done");
  assert.equal(food.checkin.not_a_health_outcome, true);
  const water = reduceNutriMind(food.state, { type: "log_hydration", date: "2026-10-02", ml: 300 }, NOW);
  assert.match(water.checkin.note, /hydration diary/);
  assert.equal(water.state.medical_advice, false);
  assert.equal(water.state.allergy_safety, false);
  assert.equal(water.state.dosing, false);
  state = water.state;
  assert.equal(state.entries.length, 2);
});

test("rejects dosing, treatment, and allergy-safety fields", () => {
  const state = diary();
  assert.throws(() => reduceNutriMind(state, { type: "log_food", date: "2026-10-02", item: "x", dosage: "500mg" }, NOW), /dosage/);
  assert.throws(() => reduceNutriMind(state, { type: "set_goal", kind: "hydration_ml", ml: 10, treatment: "start" }, NOW), /treatment/);
  assert.throws(() => createDiary({ diary_id: "d", vow_id: "v", allergy_advice: "safe" }), /allergy_advice/);
  assert.throws(() => reduceNutriMind(state, { type: "log_food", date: "2026-10-02", item: "clinically recommended shake" }, NOW), /treatment or allergy-safety/);
});

test("corrections append and acknowledgements do not duplicate", async () => {
  let state = diary();
  const food = reduceNutriMind(state, { type: "log_food", entry_id: "e1", date: "2026-10-02", item: "soup", ack_id: "food-1" }, NOW);
  const dup = reduceNutriMind(food.state, { type: "log_food", entry_id: "e1", date: "2026-10-02", item: "soup", ack_id: "food-1" }, NOW);
  assert.equal(dup.duplicate, true);
  const corrected = reduceNutriMind(food.state, { type: "correct", entry_id: "e1", item: "lentil soup" }, NOW + 50);
  assert.equal(corrected.checkin.supersedes, food.checkin.checkin_id);
  assert.equal(corrected.state.entries[0].superseded_by, corrected.state.entries[1].entry_id);
  assert.equal(food.state.entries[0].item, "soup");

  const client = new VowLedgerMock();
  const companion = new Companion({ client, owner: "sam", mode: "mock" });
  await companion.makeVow({ vow_id: "vow:meals", title: "Meal diary", cadence: "daily" });
  await companion.checkin(toCheckinInput(food.checkin));
  await companion.checkin(toCheckinInput(corrected.checkin));
  const audit = await companion.audit();
  assert.equal(audit.decision.state, "intact");
  const status = await companion.status("vow:meals");
  assert.equal(status.summary.done, 1);
  assert.equal(PRESET_ID, "nutrimind");
});

test("preset list is two Vow presets, not a seventh product, and transports are pending", () => {
  const listed = listPresets();
  assert.equal(listed.length, 2);
  assert.equal(listed.every((item) => item.new_product === false && item.live_delivery === false), true);
  const state = diary();
  assert.equal(state.transports.telegram, "pending_explicit_adapter");
  assert.equal(state.transports.discord, "pending_explicit_adapter");
  assert.equal(state.transports.slack, "pending_explicit_adapter");
  assert.equal(state.transports.push, "pending_explicit_adapter");
});
