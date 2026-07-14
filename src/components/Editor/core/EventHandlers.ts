import { openUrl } from "@tauri-apps/plugin-opener";
import katex from "katex";

let hoverPopup: HTMLDivElement | null = null;

function removeHoverPopup() {
  if (hoverPopup) {
    hoverPopup.remove();
    hoverPopup = null;
  }
}

function positionPopup(popup: HTMLElement, anchor: { x: number; y: number; bottom: number }) {
  const popupRect = popup.getBoundingClientRect();
  const spaceBelow = window.innerHeight - anchor.bottom;
  const spaceAbove = anchor.y;
  if (spaceBelow >= popupRect.height + 4 || spaceBelow >= spaceAbove) {
    popup.style.top = `${anchor.bottom + 4}px`;
  } else {
    popup.style.top = `${anchor.y - popupRect.height - 4}px`;
  }
  let left = anchor.x;
  if (left + popupRect.width > window.innerWidth) {
    left = window.innerWidth - popupRect.width - 8;
  }
  if (left < 4) left = 4;
  popup.style.left = `${left}px`;
}

function showImagePreview(anchor: { x: number; y: number; bottom: number }, url: string) {
  removeHoverPopup();
  hoverPopup = document.createElement("div");
  hoverPopup.className = "cm-image-popup";
  hoverPopup.style.visibility = "hidden";
  const img = document.createElement("img");
  hoverPopup.appendChild(img);
  document.body.appendChild(hoverPopup);

  const popup = hoverPopup;
  img.onload = () => {
    if (hoverPopup === popup) {
      popup.style.visibility = "";
      positionPopup(popup, anchor);
    }
  };
  img.onerror = (e) => {
    console.log("[ImagePreview] failed to load image:", url, e);
    if (hoverPopup === popup) {
      popup.style.visibility = "";
      popup.textContent = url;
      positionPopup(popup, anchor);
    }
  };
  img.src = url;
}

function showMathPreview(anchor: { x: number; y: number; bottom: number }, latex: string) {
  removeHoverPopup();
  hoverPopup = document.createElement("div");
  hoverPopup.className = "cm-math-inline-popup";
  try {
    katex.render(latex, hoverPopup, { displayMode: true, throwOnError: false, output: "html" });
  } catch {
    hoverPopup.textContent = latex;
  }
  document.body.appendChild(hoverPopup);
  positionPopup(hoverPopup, anchor);
}

function showLinkTooltip(anchor: { x: number; y: number; bottom: number }, text: string) {
  removeHoverPopup();
  hoverPopup = document.createElement("div");
  hoverPopup.className = "cm-link-tooltip";
  hoverPopup.textContent = text;
  document.body.appendChild(hoverPopup);
  positionPopup(hoverPopup, anchor);
}

export class EventHandlers {
  private container: HTMLElement;

  onContextMenu: ((x: number, y: number) => void) | null = null;
  onLinkClick: ((url: string) => void) | null = null;
  onTaskToggle: ((paraNum: number) => void) | null = null;
  onFoldToggle: ((startPos: number) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

    container.addEventListener("mousemove", this.handleMouseMove);
    container.addEventListener("mouseleave", this.handleMouseLeave);
    container.addEventListener("contextmenu", this.handleContextMenu);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);
  }

  handleClick = (e: MouseEvent): boolean => {
    const target = e.target as HTMLElement;

    const allFoldable = this.container.querySelectorAll<HTMLElement>(".cm-foldable-first, .cm-fold-collapsed-first");
    for (const el of allFoldable) {
      const rect = el.getBoundingClientRect();
      const dx = e.clientX - rect.left;
      const isCollapsedEl = el.classList.contains("cm-fold-collapsed-first") || el.classList.contains("cm-foldable-collapsed");
      if (e.clientY < rect.top || e.clientY > rect.bottom) continue;
      if (isCollapsedEl || (dx >= -24 && dx < 4)) {
        const startPos = Number(el.dataset.documentPosFrom);
        if (!isNaN(startPos)) {
          e.preventDefault();
          this.onFoldToggle?.(startPos);
          return true;
        }
      }
    }

    const taskMarker = target.closest(".cm-task-checkbox") as HTMLElement | null;
    console.log("[TaskToggle] click target:", target.tagName, target.className, "taskMarker:", taskMarker);
    if (taskMarker) {
      const paraEl = taskMarker.closest("[data-paragraph-index]") as HTMLElement | null;
      console.log("[TaskToggle] paraEl:", paraEl, "paragraphIndex:", paraEl?.dataset.paragraphIndex);
      if (paraEl) {
        const paraNum = Number(paraEl.dataset.paragraphIndex);
        if (!isNaN(paraNum)) {
          e.preventDefault();
          console.log("[TaskToggle] triggering toggle for paraNum:", paraNum);
          this.onTaskToggle?.(paraNum);
          return true;
        }
      }
    }

    const linkTitle = target.closest(".tok-link-title") as HTMLElement | null;
    if (linkTitle) {
      const url = linkTitle.dataset.href;
      if (url) {
        e.preventDefault();
        openUrl(url);
        return true;
      }
    }

    const linkUrl = target.closest(".tok-link-url") as HTMLElement | null;
    if (linkUrl && (e.metaKey || e.ctrlKey)) {
      const url = linkUrl.textContent;
      if (url) {
        e.preventDefault();
        openUrl(url);
        return true;
      }
    }

    return false;
  };

  private handleMouseMove = (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // 悬浮在行内公式源码上时，展示公式渲染结果
    const mathSource = target.closest(".cm-math-inline-source") as HTMLElement | null;
    if (mathSource) {
      if (hoverPopup?.classList.contains("cm-math-inline-popup")) return;
      const latex = mathSource.dataset.latex;
      if (latex) {
        const rect = mathSource.getBoundingClientRect();
        showMathPreview({ x: rect.left, y: rect.top, bottom: rect.bottom }, latex);
      }
      return;
    }

    // 悬浮在行内图片链接源码上时，展示图片预览
    const imageLink = target.closest(".cm-image-link") as HTMLElement | null;
    if (imageLink && !target.closest(".cm-image-inline-preview")) {
      if (hoverPopup?.classList.contains("cm-image-popup")) return;
      const previewImg = imageLink.querySelector(".cm-image-inline-preview img") as HTMLImageElement | null;
      console.log("[ImageDebug] previewImg:", previewImg);
      console.log("[ImageDebug] previewImg.src:", previewImg?.src);
      console.log("[ImageDebug] previewImg.currentSrc:", previewImg?.currentSrc);
      console.log("[ImageDebug] previewImg.complete:", previewImg?.complete);
      console.log("[ImageDebug] previewImg.naturalWidth:", previewImg?.naturalWidth);
      console.log("[ImageDebug] dataset.url:", imageLink.dataset.url);
      const url = (previewImg && previewImg.currentSrc) || imageLink.dataset.url || "";
      console.log("[ImageDebug] final url for hover:", url);
      // 尝试 fetch 来获取详细错误
      fetch(url).then(r => console.log("[ImageDebug] fetch status:", r.status, r.statusText)).catch(e => console.log("[ImageDebug] fetch error:", e));
      if (url) {
        const rect = imageLink.getBoundingClientRect();
        showImagePreview({ x: rect.left, y: rect.top, bottom: rect.bottom }, url);
      }
      return;
    }

    const linkTitleEl = target.closest(".tok-link-title") as HTMLElement | null;
    if (linkTitleEl) {
      if (hoverPopup?.classList.contains("cm-link-tooltip")) return;
      const rect = linkTitleEl.getBoundingClientRect();
      showLinkTooltip({ x: rect.left, y: rect.top, bottom: rect.bottom }, "点击打开链接");
      return;
    }

    const linkUrlEl = target.closest(".tok-link-url") as HTMLElement | null;
    if (linkUrlEl) {
      if (hoverPopup?.classList.contains("cm-link-tooltip")) return;
      const rect = linkUrlEl.getBoundingClientRect();
      showLinkTooltip({ x: rect.left, y: rect.top, bottom: rect.bottom }, "⌘+点击打开链接");
      return;
    }

    removeHoverPopup();
  };

  private handleMouseLeave = () => {
    removeHoverPopup();
  };

  private handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    this.onContextMenu?.(e.clientX, e.clientY);
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) {
      this.container.classList.add("cm-mod-key-held");
    }
  };

  private handleKeyUp = () => {
    this.container.classList.remove("cm-mod-key-held");
  };

  private handleBlur = () => {
    this.container.classList.remove("cm-mod-key-held");
    removeHoverPopup();
  };

  destroy() {
    this.container.removeEventListener("mousemove", this.handleMouseMove);
    this.container.removeEventListener("mouseleave", this.handleMouseLeave);
    this.container.removeEventListener("contextmenu", this.handleContextMenu);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleBlur);
    removeHoverPopup();
  }
}
