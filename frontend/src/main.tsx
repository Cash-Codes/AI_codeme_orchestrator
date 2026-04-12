import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Restore theme from localStorage before first render to avoid flash
const saved = localStorage.getItem("theme") ?? "light";
document.documentElement.setAttribute("data-theme", saved);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
