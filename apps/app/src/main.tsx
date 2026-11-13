import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyTheme, loadTheme } from "./lib/settings";

// El tema guardado se aplica antes de pintar para evitar un destello.
const theme = loadTheme();
if (theme !== "auto") applyTheme(theme);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
