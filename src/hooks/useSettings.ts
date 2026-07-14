import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { workspacePathAtom, settingsAtom } from "@/atoms";
import { loadSettings } from "@/utils/settings";

export function useSettings() {
  const workspacePath = useAtomValue(workspacePathAtom);
  const setSettings = useSetAtom(settingsAtom);

  useEffect(() => {
    loadSettings(workspacePath).then(setSettings);
  }, [workspacePath, setSettings]);
}
