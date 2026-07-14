const POPULAR_NAMES = new Set([
  "JavaScript", "TypeScript", "Python", "Java", "Go", "Rust",
  "C", "C++", "C#", "HTML", "CSS", "JSON", "YAML", "SQL",
  "Shell", "Markdown", "JSX", "TSX", "Ruby", "PHP", "Swift",
  "Kotlin", "Dart", "Lua", "R",
]);

interface LangEntry {
  name: string;
  alias: string;
}

const ALL_LANGS: LangEntry[] = (() => {
  const popular: LangEntry[] = [];
  const rest: LangEntry[] = [];
  const langs: { name: string; alias: string }[] = [
    { name: "JavaScript", alias: "javascript" },
    { name: "TypeScript", alias: "typescript" },
    { name: "Python", alias: "python" },
    { name: "Java", alias: "java" },
    { name: "Go", alias: "go" },
    { name: "Rust", alias: "rust" },
    { name: "C", alias: "c" },
    { name: "C++", alias: "cpp" },
    { name: "C#", alias: "csharp" },
    { name: "HTML", alias: "html" },
    { name: "CSS", alias: "css" },
    { name: "JSON", alias: "json" },
    { name: "YAML", alias: "yaml" },
    { name: "SQL", alias: "sql" },
    { name: "Shell", alias: "shell" },
    { name: "Markdown", alias: "markdown" },
    { name: "JSX", alias: "jsx" },
    { name: "TSX", alias: "tsx" },
    { name: "Ruby", alias: "ruby" },
    { name: "PHP", alias: "php" },
    { name: "Swift", alias: "swift" },
    { name: "Kotlin", alias: "kotlin" },
    { name: "Dart", alias: "dart" },
    { name: "Lua", alias: "lua" },
    { name: "R", alias: "r" },
    { name: "Scala", alias: "scala" },
    { name: "Perl", alias: "perl" },
    { name: "Haskell", alias: "haskell" },
    { name: "Elixir", alias: "elixir" },
    { name: "Erlang", alias: "erlang" },
    { name: "Clojure", alias: "clojure" },
    { name: "OCaml", alias: "ocaml" },
    { name: "F#", alias: "fsharp" },
    { name: "Julia", alias: "julia" },
    { name: "Zig", alias: "zig" },
    { name: "Nim", alias: "nim" },
    { name: "TOML", alias: "toml" },
    { name: "XML", alias: "xml" },
    { name: "INI", alias: "ini" },
    { name: "Dockerfile", alias: "dockerfile" },
    { name: "Makefile", alias: "makefile" },
    { name: "Diff", alias: "diff" },
    { name: "GraphQL", alias: "graphql" },
    { name: "Protobuf", alias: "protobuf" },
    { name: "LaTeX", alias: "latex" },
    { name: "Objective-C", alias: "objc" },
    { name: "Assembly", alias: "asm" },
    { name: "WASM", alias: "wasm" },
    { name: "PowerShell", alias: "powershell" },
    { name: "Batch", alias: "bat" },
    { name: "SCSS", alias: "scss" },
    { name: "Less", alias: "less" },
    { name: "Vue", alias: "vue" },
    { name: "Svelte", alias: "svelte" },
    { name: "GLSL", alias: "glsl" },
    { name: "Groovy", alias: "groovy" },
    { name: "Fortran", alias: "fortran" },
    { name: "COBOL", alias: "cobol" },
    { name: "Pascal", alias: "pascal" },
    { name: "Ada", alias: "ada" },
    { name: "Prolog", alias: "prolog" },
    { name: "Scheme", alias: "scheme" },
    { name: "Lisp", alias: "lisp" },
    { name: "Smalltalk", alias: "smalltalk" },
    { name: "Tcl", alias: "tcl" },
    { name: "Verilog", alias: "verilog" },
    { name: "VHDL", alias: "vhdl" },
  ];
  for (const lang of langs) {
    if (POPULAR_NAMES.has(lang.name)) {
      popular.push(lang);
    } else {
      rest.push(lang);
    }
  }
  popular.sort((a, b) => a.name.localeCompare(b.name));
  rest.sort((a, b) => a.name.localeCompare(b.name));
  return [...popular, ...rest];
})();

let activeDropdown: HTMLDivElement | null = null;

function closeActiveDropdown() {
  if (activeDropdown) {
    activeDropdown.remove();
    activeDropdown = null;
  }
}

export function createLangSelectorButton(
  currentLang: string,
  onSelectLang: (alias: string) => void,
  scrollContainer?: HTMLElement,
): HTMLSpanElement {
  const btn = document.createElement("span");
  btn.className = "cm-lang-selector";
  btn.contentEditable = "false";
  btn.title = currentLang || "Select language";

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("width", "14");
  icon.setAttribute("height", "14");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "2");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M6 9l6 6 6-6");
  icon.appendChild(path);
  btn.appendChild(icon);

  btn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (activeDropdown) {
      closeActiveDropdown();
      return;
    }
    showDropdown(btn, currentLang, onSelectLang, scrollContainer);
  });

  return btn;
}

function showDropdown(
  anchor: HTMLElement,
  currentLang: string,
  onSelectLang: (alias: string) => void,
  scrollContainer?: HTMLElement,
) {
  closeActiveDropdown();

  const dropdown = document.createElement("div");
  dropdown.className = "cm-lang-dropdown";
  activeDropdown = dropdown;

  const searchInput = document.createElement("input");
  searchInput.className = "cm-lang-dropdown-search";
  searchInput.placeholder = "Search language...";
  searchInput.type = "text";
  dropdown.appendChild(searchInput);

  const list = document.createElement("div");
  list.className = "cm-lang-dropdown-list";
  dropdown.appendChild(list);

  const renderItems = (filter: string) => {
    list.innerHTML = "";
    const lower = filter.toLowerCase();
    const filtered = lower
      ? ALL_LANGS.filter(
          (l) =>
            l.name.toLowerCase().includes(lower) ||
            l.alias.toLowerCase().includes(lower),
        )
      : ALL_LANGS;

    for (const lang of filtered) {
      const item = document.createElement("div");
      item.className = "cm-lang-dropdown-item";
      if (
        lang.alias === currentLang ||
        lang.name.toLowerCase() === currentLang
      ) {
        item.classList.add("active");
      }
      item.textContent = lang.name;
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelectLang(lang.alias);
        closeActiveDropdown();
      });
      list.appendChild(item);
    }
  };

  renderItems("");

  searchInput.addEventListener("input", () => {
    renderItems(searchInput.value);
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeActiveDropdown();
    }
  });

  document.body.appendChild(dropdown);

  const rect = anchor.getBoundingClientRect();
  const dropdownHeight = 280;
  const spaceBelow = window.innerHeight - rect.bottom;
  if (spaceBelow >= dropdownHeight || spaceBelow >= rect.top) {
    dropdown.style.top = `${rect.bottom + 2}px`;
  } else {
    dropdown.style.top = `${rect.top - dropdownHeight - 2}px`;
  }
  let left = rect.right - 200;
  if (left < 4) left = 4;
  if (left + 200 > window.innerWidth) left = window.innerWidth - 204;
  dropdown.style.left = `${left}px`;

  setTimeout(() => searchInput.focus(), 0);

  const onClickOutside = (e: MouseEvent) => {
    if (!dropdown.contains(e.target as Node)) {
      closeActiveDropdown();
      document.removeEventListener("mousedown", onClickOutside);
    }
  };
  setTimeout(() => document.addEventListener("mousedown", onClickOutside), 0);

  if (scrollContainer) {
    const onScroll = () => {
      closeActiveDropdown();
      document.removeEventListener("mousedown", onClickOutside);
    };
    scrollContainer.addEventListener("scroll", onScroll, { once: true });
  }
}
