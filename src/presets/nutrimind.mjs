// Local NutriMind diary preset for an existing Vow.
// Food, preference, and hydration notes plus user-set goals.
// Not dosing, treatment, allergy-safety, or medical recommendation logic.

export const PRESET_ID = "nutrimind";
export const DISCLAIMER =
  "Local food and hydration diary. User-set goals are reminders to log, not prescriptions, allergy clearance, or treatment advice.";

export const TRANSPORTS = {
  telegram: "pending_explicit_adapter",
  discord: "pending_explicit_adapter",
  slack: "pending_explicit_adapter",
  push: "pending_explicit_adapter",
};

const FORBIDDEN = new Set([
  "dose",
  "dosage",
  "dosing",
  "treatment",
  "diagnosis",
  "allergy_advice",
  "allergy_safe",
  "medical_recommendation",
  "prescribe",
  "prescription",
  "supplement_protocol",
]);

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function rejectMedical(input, path = "") {
  if (!input || typeof input !== "object") return;
  if (Array.isArray(input)) {
    for (const item of input) rejectMedical(item, path);
    return;
  }
  for (const [key, value] of Object.entries(input)) {
    if (FORBIDDEN.has(key)) throw fail("medical_field_rejected", `${key} is outside this diary`);
    if (typeof value === "string" && /\b(prescribe|dosage|treat(ment)?|allergy[- ]safe|clinically recommended)\b/i.test(value)) {
      throw fail("medical_claim_rejected", "diary text cannot carry a treatment or allergy-safety claim");
    }
    if (value && typeof value === "object") rejectMedical(value, `${path}${key}.`);
  }
}

function clone(state) {
  return structuredClone(state);
}

export function createDiary(input = {}) {
  rejectMedical(input);
  if (!input.diary_id || !input.vow_id) throw fail("invalid_diary", "diary_id and vow_id are required");
  if (input.timezone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: input.timezone }).format(0);
    } catch {
      throw fail("invalid_timezone", "timezone must be a valid IANA name");
    }
  }
  return {
    preset_id: PRESET_ID,
    diary_id: String(input.diary_id),
    vow_id: String(input.vow_id),
    timezone: input.timezone || "UTC",
    goals: [],
    preferences: [],
    entries: [],
    events: [],
    acks: {},
    disclaimer: DISCLAIMER,
    transports: TRANSPORTS,
    medical_advice: false,
    allergy_safety: false,
    dosing: false,
    live_delivery: false,
  };
}

function userNumber(value, label, max) {
  if (!Number.isFinite(value) || value < 0 || value > max) throw fail("invalid_goal", `${label} must be a user-set number from 0 to ${max}`);
  return value;
}

export function reduceNutriMind(state, event = {}, now = Date.now()) {
  rejectMedical(event);
  if (event.ack_id && state.acks[event.ack_id]) {
    return { state, checkin: null, duplicate: true };
  }
  const next = clone(state);
  let checkin = null;
  const type = event.type;

  if (type === "set_goal") {
    const goal = {
      goal_id: event.goal_id || `goal-${next.events.length + 1}`,
      kind: event.kind,
      source: "user_set",
      prescribed: false,
      at: now,
    };
    if (event.kind === "hydration_ml") goal.ml = userNumber(event.ml, "hydration_ml", 10000);
    else if (event.kind === "meal_logs_per_day") goal.count = userNumber(event.count, "count", 12);
    else throw fail("invalid_goal", "goal kind must be hydration_ml or meal_logs_per_day");
    next.goals.push(goal);
    next.events.push({ type, at: now, goal_id: goal.goal_id });
    checkin = diaryCheckin(next, "skipped", `user-set ${event.kind} goal; not a prescription`, null, now);
  } else if (type === "set_preference") {
    const pref = {
      preference_id: event.preference_id || `pref-${next.events.length + 1}`,
      likes: asTextList(event.likes),
      dislikes: asTextList(event.dislikes),
      diet_label: event.diet_label ? String(event.diet_label).slice(0, 80) : null,
      at: now,
    };
    rejectMedical(pref);
    next.preferences.push(pref);
    next.events.push({ type, at: now, preference_id: pref.preference_id });
    checkin = diaryCheckin(next, "skipped", "food preference note; not nutrition advice", null, now);
  } else if (type === "log_food" || type === "log_hydration") {
    const entry = {
      entry_id: event.entry_id || `entry-${next.events.length + 1}`,
      kind: type,
      at: now,
      date: event.date,
      superseded_by: null,
    };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date || "")) throw fail("invalid_date", "date must be YYYY-MM-DD");
    if (type === "log_food") {
      if (!event.item || String(event.item).length > 120) throw fail("invalid_entry", "food item is required");
      entry.item = String(event.item);
      entry.amount_text = event.amount_text ? String(event.amount_text).slice(0, 80) : null;
      entry.meal = event.meal ? String(event.meal).slice(0, 40) : null;
    } else {
      entry.ml = userNumber(event.ml, "ml", 5000);
    }
    rejectMedical(entry);
    next.entries.push(entry);
    next.events.push({ type, at: now, entry_id: entry.entry_id });
    const note = type === "log_food"
      ? "nutrimind food diary self-report; not a health outcome"
      : "nutrimind hydration diary self-report; not a health outcome";
    checkin = diaryCheckin(next, "done", note, null, now, event.date);
    entry.checkin_id = checkin.checkin_id;
  } else if (type === "correct") {
    const prior = next.entries.find((e) => e.entry_id === event.entry_id);
    if (!prior || !prior.checkin_id) throw fail("unknown_entry", "no diary entry to correct");
    if (prior.superseded_by) throw fail("already_corrected", "correct the latest diary entry");
    const replacement = {
      entry_id: event.replacement_id || `entry-${next.events.length + 1}`,
      kind: prior.kind,
      at: now,
      date: event.date || prior.date,
      supersedes: prior.entry_id,
      checkin_supersedes: prior.checkin_id,
    };
    if (prior.kind === "log_food") {
      replacement.item = String(event.item || prior.item);
      replacement.amount_text = event.amount_text ? String(event.amount_text).slice(0, 80) : prior.amount_text;
    } else {
      replacement.ml = event.ml === undefined ? prior.ml : userNumber(event.ml, "ml", 5000);
    }
    rejectMedical(replacement);
    prior.superseded_by = replacement.entry_id;
    next.entries.push(replacement);
    next.events.push({ type, at: now, entry_id: replacement.entry_id, supersedes: prior.entry_id });
    checkin = diaryCheckin(next, "done", "nutrimind diary correction; prior entry kept", prior.checkin_id, now, replacement.date);
    replacement.checkin_id = checkin.checkin_id;
  } else {
    throw fail("unknown_event", "unsupported nutrimind event");
  }

  if (event.ack_id) next.acks[event.ack_id] = { ack_id: event.ack_id, checkin_id: checkin?.checkin_id || null };
  return { state: next, checkin, duplicate: false };
}

function asTextList(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) throw fail("invalid_preference", "likes and dislikes must be short lists");
  return value.map((item) => {
    if (typeof item !== "string" || !item.trim() || item.length > 60) throw fail("invalid_preference", "preference items must be short text");
    return item.trim();
  });
}

function diaryCheckin(state, status, note, supersedes, now, date = null) {
  const day = date || new Date(now).toISOString().slice(0, 10);
  return {
    vow_id: state.vow_id,
    checkin_id: `nm-${state.diary_id}-${state.events.length}`,
    date: day,
    status,
    note,
    supersedes,
    ts: now,
    domain: PRESET_ID,
    self_report: true,
    not_a_health_outcome: true,
  };
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

export function goalSnapshot(state) {
  return {
    source: "user_set",
    prescribed: false,
    medical_advice: false,
    goals: state.goals.map((g) => ({ ...g })),
  };
}
