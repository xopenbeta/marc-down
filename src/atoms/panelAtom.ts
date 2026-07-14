import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

function getStoredBoolean(key: string, defaultValue: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v !== null) return JSON.parse(v);
  } catch {}
  return defaultValue;
}

export const sidebarWidthAtom = atom(150);
export const outlineWidthAtom = atom(150);
export const isSidebarCollapsedAtom = atomWithStorage("sidebar-collapsed", getStoredBoolean("sidebar-collapsed", false));
export const isOutlineCollapsedAtom = atomWithStorage("outline-collapsed", getStoredBoolean("outline-collapsed", false));
