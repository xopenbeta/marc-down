import { useState, useCallback, useEffect } from "react";

export interface HistoryItem {
  path: string;
  name: string;
  timestamp: number;
}

const FILE_HISTORY_KEY = "marcdown-file-history";
const FOLDER_HISTORY_KEY = "marcdown-folder-history";
const MAX_HISTORY = 10;

// Custom events for cross-hook sync
const HISTORY_CHANGED = "marcdown-history-changed";

function loadHistory(key: string): HistoryItem[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // corrupted data
  }
  return [];
}

function saveHistory(key: string, items: HistoryItem[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items.slice(0, MAX_HISTORY)));
  } catch {
    // storage full or unavailable
  }
}

function addToHistory(key: string, path: string, name: string) {
  const items = loadHistory(key);
  const filtered = items.filter((item) => item.path !== path);
  const next = [{ path, name, timestamp: Date.now() }, ...filtered];
  saveHistory(key, next);
  window.dispatchEvent(new CustomEvent(HISTORY_CHANGED));
}

function removeFromHistory(key: string, path: string) {
  const items = loadHistory(key);
  const next = items.filter((item) => item.path !== path);
  saveHistory(key, next);
  window.dispatchEvent(new CustomEvent(HISTORY_CHANGED));
}

/** Call when a file is opened — records to localStorage */
export function recordFileOpen(path: string, name: string) {
  addToHistory(FILE_HISTORY_KEY, path, name);
}

/** Call when a folder/workspace is opened — records to localStorage */
export function recordFolderOpen(path: string, name: string) {
  addToHistory(FOLDER_HISTORY_KEY, path, name);
}

/** React hook: reads file & folder history reactively */
export function useFileHistory() {
  const [fileHistory, setFileHistory] = useState<HistoryItem[]>([]);
  const [folderHistory, setFolderHistory] = useState<HistoryItem[]>([]);

  const refresh = useCallback(() => {
    setFileHistory(loadHistory(FILE_HISTORY_KEY));
    setFolderHistory(loadHistory(FOLDER_HISTORY_KEY));
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(HISTORY_CHANGED, refresh);
    return () => window.removeEventListener(HISTORY_CHANGED, refresh);
  }, [refresh]);

  const addFile = useCallback((path: string, name: string) => {
    recordFileOpen(path, name);
  }, []);

  const addFolder = useCallback((path: string, name: string) => {
    recordFolderOpen(path, name);
  }, []);

  const removeFile = useCallback((path: string) => {
    removeFromHistory(FILE_HISTORY_KEY, path);
  }, []);

  const removeFolder = useCallback((path: string) => {
    removeFromHistory(FOLDER_HISTORY_KEY, path);
  }, []);

  return {
    fileHistory,
    folderHistory,
    addFile,
    addFolder,
    removeFile,
    removeFolder,
  };
}
