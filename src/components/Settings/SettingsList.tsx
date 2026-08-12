import { useAtom, useAtomValue } from "jotai";
import { settingsAtom, workspacePathAtom } from "@/atoms";
import { saveSettings } from "@/utils/settings";
import type { AppSettings } from "@/utils/settings";

const INTERVAL_OPTIONS = [1, 3, 5, 10];

/**
 * 设置内容大列表，直接渲染在大纲面板卡片内（不再用弹窗）。
 * 每个 section 是一个小号标题，下面跟着设置项。
 */
export function SettingsList() {
  const [settings, setSettings] = useAtom(settingsAtom);
  const workspacePath = useAtomValue(workspacePathAtom);

  const handleChange = async (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await saveSettings(workspacePath, next);
  };

  return (
    <div
      style={{
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <SettingsSection title="General">
        <FieldLabel>Theme</FieldLabel>
        <ToggleGroup>
          <ToggleButton
            active={settings.theme === "light"}
            onClick={() => handleChange({ theme: "light" })}
          >
            Light
          </ToggleButton>
          <ToggleButton
            active={settings.theme === "dark"}
            onClick={() => handleChange({ theme: "dark" })}
          >
            Dark
          </ToggleButton>
          <ToggleButton
            active={settings.theme === "system"}
            onClick={() => handleChange({ theme: "system" })}
          >
            System
          </ToggleButton>
        </ToggleGroup>
      </SettingsSection>

      <SettingsSection title="Editor">
        <FieldLabel>Editor Background</FieldLabel>
        <ToggleGroup>
          <ToggleButton
            active={settings.editorBackground === "none"}
            onClick={() => handleChange({ editorBackground: "none" })}
          >
            None
          </ToggleButton>
          <ToggleButton
            active={settings.editorBackground === "balatro"}
            onClick={() => handleChange({ editorBackground: "balatro" })}
          >
            Balatro
          </ToggleButton>
        </ToggleGroup>

        <FieldLabel style={{ marginTop: 12 }}>Save Mode</FieldLabel>
        <ToggleGroup>
          <ToggleButton
            active={settings.saveMode === "auto"}
            onClick={() => handleChange({ saveMode: "auto" })}
          >
            Auto Save
          </ToggleButton>
          <ToggleButton
            active={settings.saveMode === "manual"}
            onClick={() => handleChange({ saveMode: "manual" })}
          >
            Manual (⌘S)
          </ToggleButton>
        </ToggleGroup>

        {settings.saveMode === "auto" && (
          <>
            <FieldLabel style={{ marginTop: 12 }}>Auto Save Interval</FieldLabel>
            <select
              value={settings.autoSaveInterval}
              onChange={(e) =>
                handleChange({ autoSaveInterval: Number(e.target.value) })
              }
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: 4,
                border: "1px solid var(--border-color)",
                fontSize: 12,
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
          </>
        )}
      </SettingsSection>

      <SettingsSection title="Typography">
        <MutedText>Typography settings coming soon.</MutedText>
      </SettingsSection>

      <SettingsSection title="Debug">
        <SettingRow label="Show spaces as ·">
          <ToggleSwitch
            checked={settings.showSpaceDots}
            onChange={(v) => handleChange({ showSpaceDots: v })}
          />
        </SettingRow>
        <SettingRow label="Block top/height labels">
          <ToggleSwitch
            checked={settings.debugTopLabels}
            onChange={(v) => handleChange({ debugTopLabels: v })}
          />
        </SettingRow>
        <SettingRow label="Height debug panel">
          <ToggleSwitch
            checked={settings.debugHeightPanel}
            onChange={(v) => handleChange({ debugHeightPanel: v })}
          />
        </SettingRow>
        <SettingRow label="Debug background">
          <ToggleSwitch
            checked={settings.debugBackground}
            onChange={(v) => handleChange({ debugBackground: v })}
          />
        </SettingRow>
        <SettingRow label="Debug underline">
          <ToggleSwitch
            checked={settings.debugUnderline}
            onChange={(v) => handleChange({ debugUnderline: v })}
          />
        </SettingRow>
        <SettingRow label="Glyph overlay">
          <ToggleSwitch
            checked={settings.debugGlyphOverlay}
            onChange={(v) => handleChange({ debugGlyphOverlay: v })}
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="About">
        <MutedText>MarcDown — A minimal Markdown editor.</MutedText>
      </SettingsSection>
    </div>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function ToggleGroup({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {children}
    </div>
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
        padding: "4px 8px",
        borderRadius: 4,
        fontSize: 11,
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

function FieldLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <label
      style={{
        display: "block",
        fontSize: 11,
        color: "var(--text-secondary)",
        marginBottom: 6,
        ...style,
      }}
    >
      {children}
    </label>
  );
}

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        marginBottom: 10,
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: "var(--text-secondary)",
          lineHeight: 1.4,
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function MutedText({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
      {children}
    </p>
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
          background: "var(--bg-primary)",
          transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  );
}
