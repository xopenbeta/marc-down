const STORAGE_KEY = "marcdown-font-config";

const HEADING_SCALE: Record<number, { scale: number; weight: number }> = {
  1: { scale: 1.625, weight: 700 },
  2: { scale: 1.375, weight: 700 },
  3: { scale: 1.25, weight: 600 },
  4: { scale: 1.125, weight: 600 },
  5: { scale: 1.0625, weight: 600 },
  6: { scale: 1.0625, weight: 600 },
};

export interface FontConfig {
  fontFamily: string;
  monoFontFamily: string;
  fontSize: number;
  lineHeight: number;
  fontWeight: number;
}

export interface FontStyle {
  font: string;
  lineHeight: number;
  fontSize: number;
  fontWeight: number;
}

export type FontType = "base" | "mono" | "heading";

const FONT_MONO_STACK = '"Source Code Pro", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", monospace';

const DEFAULT_CONFIG: FontConfig = {
  fontFamily: FONT_MONO_STACK,
  monoFontFamily: FONT_MONO_STACK,
  fontSize: 16,
  lineHeight: 27,
  fontWeight: 400,
};

export class EditorFontManager {
  private static instance: EditorFontManager;
  private config: FontConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  static getInstance(): EditorFontManager {
    if (!EditorFontManager.instance) {
      EditorFontManager.instance = new EditorFontManager();
    }
    return EditorFontManager.instance;
  }

  private loadConfig(): FontConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // 迁移旧的 "monospace" 值到新的完整字体栈
        if (parsed.fontFamily === "monospace") {
          delete parsed.fontFamily;
        }
        if (parsed.monoFontFamily === "monospace") {
          delete parsed.monoFontFamily;
        }
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch { /* ignore */ }
    return { ...DEFAULT_CONFIG };
  }

  private saveConfig(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch { /* ignore */ }
  }

  applyCSSVariables(root: HTMLElement): void {
    const s = root.style;
    // 在容器上直接设置 inline font，确保 DOM 渲染和 canvas 测量使用完全相同的字体
    s.font = `${this.config.fontWeight} ${this.config.fontSize}px ${this.config.fontFamily}`;
    s.lineHeight = `${this.config.lineHeight}px`;

    // CSS 变量保留给非编辑器内容区域使用（如搜索面板等 UI）
    s.setProperty("--font-mono", this.config.fontFamily);
    s.setProperty("--editor-font-size", `${this.config.fontSize}px`);
    s.setProperty("--editor-line-height", `${this.config.lineHeight}px`);
    s.setProperty("--editor-font-weight", `${this.config.fontWeight}`);

    for (let level = 1; level <= 6; level++) {
      const cfg = HEADING_SCALE[level];
      if (!cfg) continue;
      const size = Math.round(this.config.fontSize * cfg.scale);
      const lh = Math.round(this.config.lineHeight * (size / this.config.fontSize));
      s.setProperty(`--editor-h${level}-size`, `${size}px`);
      s.setProperty(`--editor-h${level}-weight`, `${cfg.weight}`);
      s.setProperty(`--editor-h${level}-line-height`, `${lh}px`);
    }
  }

  createFontStyle(type: FontType, options?: { level?: number }): FontStyle {
    switch (type) {
      case "base":
        return {
          font: `${this.config.fontWeight} ${this.config.fontSize}px ${this.config.fontFamily}`,
          lineHeight: this.config.lineHeight,
          fontSize: this.config.fontSize,
          fontWeight: this.config.fontWeight,
        };
      case "mono":
        return {
          font: `${this.config.fontSize}px ${this.config.monoFontFamily}`,
          lineHeight: this.config.lineHeight,
          fontSize: this.config.fontSize,
          fontWeight: this.config.fontWeight,
        };
      case "heading": {
        const level = options?.level ?? 1;
        const cfg = HEADING_SCALE[level];
        if (!cfg) return this.createFontStyle("base");
        const size = Math.round(this.config.fontSize * cfg.scale);
        const lh = Math.round(this.config.lineHeight * (size / this.config.fontSize));
        return {
          font: `${cfg.weight} ${size}px ${this.config.fontFamily}`,
          lineHeight: lh,
          fontSize: size,
          fontWeight: cfg.weight,
        };
      }
    }
  }

  get fontFamily(): string { return this.config.fontFamily; }
  set fontFamily(value: string) { this.config.fontFamily = value; }

  get monoFontFamily(): string { return this.config.monoFontFamily; }
  set monoFontFamily(value: string) { this.config.monoFontFamily = value; }

  get fontSize(): number { return this.config.fontSize; }
  set fontSize(value: number) { this.config.fontSize = value; }

  get lineHeight(): number { return this.config.lineHeight; }
  set lineHeight(value: number) { this.config.lineHeight = value; }

  get fontWeight(): number { return this.config.fontWeight; }
  set fontWeight(value: number) { this.config.fontWeight = value; }

  updateConfig(partial: Partial<FontConfig>): void {
    Object.assign(this.config, partial);
    this.saveConfig();
  }

  getConfig(): Readonly<FontConfig> {
    return { ...this.config };
  }
}
