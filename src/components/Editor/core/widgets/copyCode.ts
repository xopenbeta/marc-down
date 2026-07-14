const COPY_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const CHECK_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

export function createCopyCodeButton(codeText: string): HTMLSpanElement {
  const btn = document.createElement("span");
  btn.className = "cm-copy-code-btn";
  btn.contentEditable = "false";
  btn.title = "Copy code";
  btn.innerHTML = COPY_ICON;

  btn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(codeText).then(() => {
      btn.innerHTML = CHECK_ICON;
      btn.classList.add("cm-copy-code-btn-done");
      setTimeout(() => {
        btn.innerHTML = COPY_ICON;
        btn.classList.remove("cm-copy-code-btn-done");
      }, 1500);
    });
  });

  return btn;
}
