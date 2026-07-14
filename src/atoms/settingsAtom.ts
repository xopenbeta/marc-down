import { atom } from "jotai";
import type { AppSettings } from "@/utils/settings";
import { DEFAULT_SETTINGS } from "@/utils/settings";

export const settingsAtom = atom<AppSettings>(DEFAULT_SETTINGS);
