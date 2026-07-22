import { useAtomValue } from "jotai";
import { appReadyAtom, settingsAtom } from "@/atoms";
import { useOutline } from "./hooks/useOutline";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useSettings } from "./hooks/useSettings";
import { useTheme } from "./hooks/useTheme";
import { useInitApp } from "./hooks/useInitApp";
import { usePanelLayout } from "./hooks/usePanelLayout";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { Editor } from "./components/Editor/Editor";
import { PanelResizer } from "./components/PanelResizer/PanelResizer";
import { ConflictDialog } from "./components/ConflictDialog";
import { ExportDialog } from "./components/ExportDialog";
import { DefaultAppToast } from "./components/DefaultAppToast";
import { BalatroBackground } from "./components/Editor/BalatroBackground";

function App() {
  useOutline();
  useKeyboardShortcuts();
  useSettings();
  useTheme();
  useInitApp();

  const appReady = useAtomValue(appReadyAtom);
  const settings = useAtomValue(settingsAtom);

  const {
    sidebarWidth,
    sidebarCollapsed,
    handleSidebarResize,
  } = usePanelLayout();

  if (!appReady) return null;

  return (
    <>
      <div
        className={settings.editorBackground === "balatro" ? "editor-background-balatro" : undefined}
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          overflow: "hidden",
          background: "var(--bg-primary)",
        }}
      >
        {!sidebarCollapsed && (
          <>
            <div
              style={{
                width: sidebarWidth,
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              <Sidebar />
            </div>
            <PanelResizer onResize={handleSidebarResize} />
          </>
        )}
        <div
          style={{
            flex: 1,
            height: "100%",
            overflow: "hidden",
            minWidth: 0,
            position: "relative",
          }}
        >
          {settings.editorBackground === "balatro" && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                overflow: "hidden",
                pointerEvents: "none",
                zIndex: 0,
              }}
            >
              <BalatroBackground />
            </div>
          )}
          <div style={{ position: "relative", zIndex: 1, height: "100%" }}>
            <Editor />
          </div>
        </div>
      </div>
      <DefaultAppToast />
      <ConflictDialog />
      <ExportDialog />
    </>
  );
}

export default App;
