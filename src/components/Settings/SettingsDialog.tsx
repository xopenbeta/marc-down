import { useEffect, useRef, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { settingsAtom, workspacePathAtom } from "@/atoms";
import { saveSettings } from "@/utils/settings";
import type { AppSettings } from "@/utils/settings";

interface SettingsDialogProps {
  onClose: () => void;
}

const INTERVAL_OPTIONS = [1, 3, 5, 10];

type SettingsSection = "general" | "editor" | "typography" | "debug" | "about";

const NAV_ITEMS: { key: SettingsSection; label: string }[] = [
  { key: "general", label: "General" },
  { key: "editor", label: "Editor" },
  { key: "typography", label: "Typography" },
  { key: "debug", label: "Debug" },
  { key: "about", label: "About" },
];

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const [settings, setSettings] = useAtom(settingsAtom);
  const workspacePath = useAtomValue(workspacePathAtom);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleChange = async (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await saveSettings(workspacePath, next);
  };

  return (
    <div
      ref={backdropRef}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.3)",
      }}
    >
      <div
        style={{
          background: "var(--bg-primary)",
          borderRadius: 8,
          width: 560,
          height: 400,
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          border: "1px solid var(--border-color)",
          display: "flex",
          overflow: "hidden",
        }}
      >
        {/* Left Navigation */}
        <div
          style={{
            width: 160,
            borderRight: "1px solid var(--border-color)",
            background: "var(--bg-surface)",
            padding: "16px 0",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <h3
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-secondary)",
              padding: "0 16px",
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Settings
          </h3>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: activeSection === item.key ? 500 : 400,
                color:
                  activeSection === item.key
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
                background:
                  activeSection === item.key
                    ? "var(--bg-primary)"
                    : "transparent",
                border: "none",
                cursor: "pointer",
                borderRadius: 0,
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Right Content */}
        <div
          style={{
            flex: 1,
            padding: "24px 28px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ flex: 1 }}>
            {activeSection === "general" && (
              <GeneralSection settings={settings} onChange={handleChange} />
            )}
            {activeSection === "editor" && (
              <EditorSection settings={settings} onChange={handleChange} />
            )}
            {activeSection === "typography" && (
              <TypographySection settings={settings} onChange={handleChange} />
            )}
            {activeSection === "debug" && (
              <DebugSection settings={settings} onChange={handleChange} />
            )}
            {activeSection === "about" && <AboutSection />}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
            <button
              onClick={onClose}
              style={{
                padding: "6px 16px",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 500,
                background: "var(--text-primary)",
                color: "var(--bg-primary)",
                cursor: "pointer",
                border: "none",
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GeneralSection({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
}) {
  return (
    <>
      <SectionTitle>General</SectionTitle>

      <div style={{ marginBottom: 16 }}>
        <FieldLabel>Theme</FieldLabel>
        <div style={{ display: "flex", gap: 8 }}>
          <ToggleButton
            active={settings.theme === "light"}
            onClick={() => onChange({ theme: "light" })}
          >
            Light
          </ToggleButton>
          <ToggleButton
            active={settings.theme === "dark"}
            onClick={() => onChange({ theme: "dark" })}
          >
            Dark
          </ToggleButton>
          <ToggleButton
            active={settings.theme === "system"}
            onClick={() => onChange({ theme: "system" })}
          >
            System
          </ToggleButton>
        </div>
      </div>

    </>
  );
}

function EditorSection({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
}) {
  return (
    <>
      <SectionTitle>Editor</SectionTitle>

      <div style={{ marginBottom: 16 }}>
        <FieldLabel>Editor Background</FieldLabel>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <ToggleButton
            active={settings.editorBackground === "none"}
            onClick={() => onChange({ editorBackground: "none" })}
          >
            None
          </ToggleButton>
          <ToggleButton
            active={settings.editorBackground === "balatro"}
            onClick={() => onChange({ editorBackground: "balatro" })}
          >
            Balatro
          </ToggleButton>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <FieldLabel>Save Mode</FieldLabel>
        <div style={{ display: "flex", gap: 8 }}>
          <ToggleButton
            active={settings.saveMode === "auto"}
            onClick={() => onChange({ saveMode: "auto" })}
          >
            Auto Save
          </ToggleButton>
          <ToggleButton
            active={settings.saveMode === "manual"}
            onClick={() => onChange({ saveMode: "manual" })}
          >
            Manual (⌘S)
          </ToggleButton>
        </div>
      </div>

      {settings.saveMode === "auto" && (
        <div style={{ marginBottom: 16 }}>
          <FieldLabel>Auto Save Interval</FieldLabel>
          <select
            value={settings.autoSaveInterval}
            onChange={(e) =>
              onChange({ autoSaveInterval: Number(e.target.value) })
            }
            style={{
              width: "100%",
              padding: "6px 10px",
              borderRadius: 4,
              border: "1px solid var(--border-color)",
              fontSize: 13,
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
            }}
          >
            {INTERVAL_OPTIONS.map((sec) => (
              <option key={sec} value={sec}>
                {sec} second{sec > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}

function TypographySection({
  settings: _settings,
  onChange: _onChange,
}: {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
}) {
  return (
    <>
      <SectionTitle>Typography</SectionTitle>
      <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        Typography settings coming soon.
      </p>
    </>
  );
}

function DebugSection({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
}) {
  return (
    <>
      <SectionTitle>Debug</SectionTitle>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <FieldLabel style={{ marginBottom: 0 }}>Show spaces as ·</FieldLabel>
        <ToggleSwitch
          checked={settings.showSpaceDots}
          onChange={(v) => onChange({ showSpaceDots: v })}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <FieldLabel style={{ marginBottom: 0 }}>Block top/height labels</FieldLabel>
        <ToggleSwitch
          checked={settings.debugTopLabels}
          onChange={(v) => onChange({ debugTopLabels: v })}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <FieldLabel style={{ marginBottom: 0 }}>Height debug panel</FieldLabel>
        <ToggleSwitch
          checked={settings.debugHeightPanel}
          onChange={(v) => onChange({ debugHeightPanel: v })}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <FieldLabel style={{ marginBottom: 0 }}>Debug background</FieldLabel>
        <ToggleSwitch
          checked={settings.debugBackground}
          onChange={(v) => onChange({ debugBackground: v })}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <FieldLabel style={{ marginBottom: 0 }}>Debug underline</FieldLabel>
        <ToggleSwitch
          checked={settings.debugUnderline}
          onChange={(v) => onChange({ debugUnderline: v })}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <FieldLabel style={{ marginBottom: 0 }}>Glyph overlay</FieldLabel>
        <ToggleSwitch
          checked={settings.debugGlyphOverlay}
          onChange={(v) => onChange({ debugGlyphOverlay: v })}
        />
      </div>
    </>
  );
}

function AboutSection() {
  return (
    <>
      <SectionTitle>About</SectionTitle>
      <p
        style={{
          fontSize: 13,
          color: "var(--text-secondary)",
        }}
      >
        MarcDown — A minimal Markdown editor.
      </p>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 14,
        fontWeight: 600,
        marginBottom: 20,
        color: "var(--text-primary)",
      }}
    >
      {children}
    </h3>
  );
}

function FieldLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: 12,
        color: "var(--text-secondary)",
        marginBottom: 8,
        ...style,
      }}
    >
      {children}
    </label>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
        border: `1px solid ${active ? "var(--text-primary)" : "var(--border-color)"}`,
        background: active ? "var(--text-primary)" : "var(--bg-surface)",
        color: active ? "var(--bg-primary)" : "var(--text-primary)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        border: "none",
        background: checked ? "var(--text-primary)" : "var(--border-color)",
        position: "relative",
        cursor: "pointer",
        transition: "background 0.2s",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: checked ? "var(--bg-primary)" : "var(--bg-primary)",
          transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  );
}
