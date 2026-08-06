import { AccessibilitySettings, DEFAULT_SETTINGS } from "../types";

const KEY = "vr-accessibility-settings";

export const settingsService = {
  load(): AccessibilitySettings {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    try {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      console.error("settingsService: corrupted settings JSON, falling back to defaults.");
      return { ...DEFAULT_SETTINGS };
    }
  },

  save(settings: AccessibilitySettings): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch (err) {
      console.error("settingsService: failed to persist settings.", err);
    }
  },
};
