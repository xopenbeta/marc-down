import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

export interface AppSettings {
  saveMode: "auto" | "manual";
  autoSaveInterval: number;
  theme: "light" | "dark" | "system";
  editorBackground: "none" | "balatro";
  showSpaceDots: boolean;
  debugTopLabels: boolean;
  debugHeightPanel: boolean;
  debugBackground: boolean;
  debugUnderline: boolean;
  debugGlyphOverlay: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  saveMode: "auto",
  autoSaveInterval: 3,
  theme: "system",
  editorBackground: "none",
  showSpaceDots: false,
  debugTopLabels: false,
  debugHeightPanel: false,
  debugBackground: false,
  debugUnderline: false,
  debugGlyphOverlay: false,
};

const CONFIG_FILENAME = ".marcdown.json";

function getConfigPath(workspacePath: string): string {
  return `${workspacePath}/${CONFIG_FILENAME}`;
}

export async function loadSettings(
  workspacePath: string | null
): Promise<AppSettings> {
  if (!workspacePath) {
    const stored = localStorage.getItem("marcdown-settings");
    if (stored) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  }

  try {
    const content = await readTextFile(getConfigPath(workspacePath));
    return { ...DEFAULT_SETTINGS, ...JSON.parse(content) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(
  workspacePath: string | null,
  settings: AppSettings
): Promise<void> {
  if (!workspacePath) {
    localStorage.setItem("marcdown-settings", JSON.stringify(settings));
    return;
  }

  await writeTextFile(
    getConfigPath(workspacePath),
    JSON.stringify(settings, null, 2)
  );
}
