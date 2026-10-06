import * as medication from "./medication.mjs";
import * as nutrimind from "./nutrimind.mjs";

export const PRESETS = {
  [medication.PRESET_ID]: medication,
  [nutrimind.PRESET_ID]: nutrimind,
};

export function listPresets() {
  return [
    {
      preset_id: medication.PRESET_ID,
      kind: "schedule_self_report",
      new_product: false,
      live_delivery: false,
    },
    {
      preset_id: nutrimind.PRESET_ID,
      kind: "diary_self_report",
      new_product: false,
      live_delivery: false,
    },
  ];
}
