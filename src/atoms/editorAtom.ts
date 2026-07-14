import { atom } from "jotai";
import type { OpenFile } from "@/types";

export interface EditorViewState {
  scrollTop: number;
  anchor: number;
  head: number;
}

export const openFilesAtom = atom<OpenFile[]>([]);
export const activeFilePathAtom = atom<string | null>(null);
export const editorViewStateCache = new Map<string, EditorViewState>();

export const activeFileAtom = atom((get) => {
  const files = get(openFilesAtom);
  const path = get(activeFilePathAtom);
  return files.find((f) => f.path === path) ?? null;
});

export interface FileConflict {
  path: string;
  name: string;
  diskContent: string;
}

export const fileConflictAtom = atom<FileConflict | null>(null);

export const showExportDialogAtom = atom(false);

export const appReadyAtom = atom(false);
