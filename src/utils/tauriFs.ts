import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  readTextFile,
  writeTextFile,
  remove,
  rename,
  mkdir,
} from "@tauri-apps/plugin-fs";
import type { FileNode, SearchResult } from "@/types";

export interface OpenPathResult {
  path: string;
  is_directory: boolean;
}

export async function openPathDialog(): Promise<OpenPathResult | null> {
  const result = await invoke<OpenPathResult | null>("open_path_dialog");
  if (result) return result;

  // On non-macOS, Rust open_path_dialog currently returns null.
  // Fallback to dialog plugin so the shared "Open" button still works.
  const folder = await open({ directory: true, multiple: false });
  if (typeof folder === "string") {
    return { path: folder, is_directory: true };
  }

  const file = await open({
    directory: false,
    multiple: false,
    filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
  });
  if (typeof file === "string") {
    return { path: file, is_directory: false };
  }

  return null;
}

export async function openWorkspaceDialog(): Promise<string | null> {
  const selected = await open({ directory: true, multiple: false });
  return selected as string | null;
}

export async function openFileDialog(): Promise<string | null> {
  const selected = await open({
    directory: false,
    multiple: false,
    filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
  });
  return selected as string | null;
}

export async function readDirectoryTree(path: string): Promise<FileNode> {
  return await invoke<FileNode>("read_directory_tree", { path });
}

export async function readDirectoryChildren(path: string): Promise<FileNode[]> {
  return await invoke<FileNode[]>("read_directory_children", { path });
}

export async function readFile(path: string): Promise<string> {
  return await readTextFile(path);
}

export async function writeFile(path: string, content: string): Promise<void> {
  await writeTextFile(path, content);
}

export async function createFile(path: string): Promise<void> {
  await writeTextFile(path, "");
}

export async function createFolder(path: string): Promise<void> {
  await mkdir(path);
}

export async function deleteEntry(path: string): Promise<void> {
  await remove(path, { recursive: true });
}

export async function renameEntry(
  oldPath: string,
  newPath: string
): Promise<void> {
  await rename(oldPath, newPath);
}

export async function searchInFiles(
  workspacePath: string,
  query: string
): Promise<SearchResult[]> {
  return await invoke<SearchResult[]>("search_in_files", {
    workspacePath,
    query,
  });
}
