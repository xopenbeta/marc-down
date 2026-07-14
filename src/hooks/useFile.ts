import { useCallback, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  workspacePathAtom,
  fileTreeAtom,
  openFilesAtom,
  activeFilePathAtom,
  isSidebarCollapsedAtom,
  settingsAtom,
} from "@/atoms";
import { editorViewStateCache } from "@/atoms/editorAtom";
import * as tauriFs from "@/utils/tauriFs";
import type { OpenFile } from "@/types";

export function useFile() {
  const [workspacePath, setWorkspacePath] = useAtom(workspacePathAtom);
  const setFileTree = useSetAtom(fileTreeAtom);
  const [openFiles, setOpenFiles] = useAtom(openFilesAtom);
  const setActiveFilePath = useSetAtom(activeFilePathAtom);
  const setSidebarCollapsed = useSetAtom(isSidebarCollapsedAtom);
  const settings = useAtomValue(settingsAtom);

  const openPath = async () => {
    const result = await tauriFs.openPathDialog();
    if (!result) return;
    if (result.is_directory) {
      setWorkspacePath(result.path);
      const tree = await tauriFs.readDirectoryTree(result.path);
      setFileTree(tree);
      setSidebarCollapsed(false);
    } else {
      const name = result.path.substring(result.path.lastIndexOf("/") + 1);
      await openFile(result.path, name);
    }
  };

  const openWorkspace = async () => {
    const path = await tauriFs.openWorkspaceDialog();
    if (path) {
      setWorkspacePath(path);
      const tree = await tauriFs.readDirectoryTree(path);
      setFileTree(tree);
    }
  };

  const refreshTree = async () => {
    if (workspacePath) {
      const tree = await tauriFs.readDirectoryTree(workspacePath);
      setFileTree(tree);
    }
  };

  const openFileDialog = async () => {
    const path = await tauriFs.openFileDialog();
    if (path) {
      const name = path.substring(path.lastIndexOf("/") + 1);
      await openFile(path, name);
    }
  };

  const openFile = async (path: string, name?: string) => {
    const existing = openFiles.find((f) => f.path === path);
    if (existing) {
      setActiveFilePath(path);
      return;
    }

    const fileName = name ?? path.split("/").pop() ?? path;
    const content = await tauriFs.readFile(path);
    const newFile: OpenFile = { path, name: fileName, content, savedContent: content };
    setOpenFiles((prev) => [...prev, newFile]);
    setActiveFilePath(path);
  };

  const closeFile = (path: string) => {
    editorViewStateCache.delete(path);
    setOpenFiles((prev) => prev.filter((f) => f.path !== path));
    setActiveFilePath((current) => {
      if (current === path) {
        const remaining = openFiles.filter((f) => f.path !== path);
        return remaining.length > 0 ? remaining[remaining.length - 1].path : null;
      }
      return current;
    });
  };

  const saveFile = async (path: string) => {
    const file = openFiles.find((f) => f.path === path);
    if (!file) return;
    await tauriFs.writeFile(path, file.content);
    setOpenFiles((prev) =>
      prev.map((f) => (f.path === path ? { ...f, savedContent: f.content } : f))
    );
  };

  const autoSaveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const updateFileContent = useCallback(
    (path: string, content: string) => {
      setOpenFiles((prev) =>
        prev.map((f) =>
          f.path === path ? { ...f, content } : f
        )
      );

      if (settings.saveMode === "manual") return;

      const delay = settings.autoSaveInterval * 1000;
      const timers = autoSaveTimers.current;
      const existing = timers.get(path);
      if (existing) clearTimeout(existing);
      timers.set(
        path,
        setTimeout(async () => {
          timers.delete(path);
          await tauriFs.writeFile(path, content);
          setOpenFiles((prev) =>
            prev.map((f) => (f.path === path ? { ...f, savedContent: content } : f))
          );
        }, delay)
      );
    },
    [setOpenFiles, settings.saveMode, settings.autoSaveInterval]
  );

  const createFile = async (dirPath: string, name: string) => {
    const fullPath = `${dirPath}/${name}`;
    await tauriFs.createFile(fullPath);
    await refreshTree();
  };

  const createFolder = async (dirPath: string, name: string) => {
    const fullPath = `${dirPath}/${name}`;
    await tauriFs.createFolder(fullPath);
    await refreshTree();
  };

  const deleteEntry = async (path: string) => {
    await tauriFs.deleteEntry(path);
    closeFile(path);
    await refreshTree();
  };

  const renameEntry = async (oldPath: string, newName: string) => {
    const dir = oldPath.substring(0, oldPath.lastIndexOf("/"));
    const newPath = `${dir}/${newName}`;
    await tauriFs.renameEntry(oldPath, newPath);
    setOpenFiles((prev) =>
      prev.map((f) =>
        f.path === oldPath ? { ...f, path: newPath, name: newName } : f
      )
    );
    setActiveFilePath((current) => (current === oldPath ? newPath : current));
    await refreshTree();
  };

  return {
    workspacePath,
    openPath,
    openWorkspace,
    openFileDialog,
    refreshTree,
    openFile,
    closeFile,
    saveFile,
    updateFileContent,
    createFile,
    createFolder,
    deleteEntry,
    renameEntry,
  };
}
