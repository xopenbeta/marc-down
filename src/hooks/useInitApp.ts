import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { appReadyAtom } from "@/atoms";
import { useFile } from "./useFile";

export function useInitApp() {
  const setAppReady = useSetAtom(appReadyAtom);
  const { openFile } = useFile();

  useEffect(() => {
    invoke<string | null>("win_linux_get_open_app_with_file").then((path) => {
      if (path) {
        openFile(path).finally(() => setAppReady(true));
      } else {
        setAppReady(true);
      }
    });

    const unlisten = listen<string>("mac_open_app_with_file", (event) => {
      openFile(event.payload).finally(() => setAppReady(true));
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

}
