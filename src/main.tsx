import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SessionProvider } from "./state/SessionContext.tsx";
import { App } from "./ui/App.tsx";
import "./ui/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
);
