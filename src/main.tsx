import { createRoot } from "react-dom/client";
import { Provider } from "jotai";
import App from "./App";
import "katex/dist/katex.min.css";
import "./components/Editor/core/editor.css";
import "./styles/fonts.css";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <Provider>
    <App />
  </Provider>
);
