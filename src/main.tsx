import React from "react";
import ReactDOM from "react-dom/client";
import { Buffer } from "buffer";
import App from "./App";
import "./index.css";
import "@solana/wallet-adapter-react-ui/styles.css";

if (!("Buffer" in window)) {
  (window as Window & { Buffer: typeof Buffer }).Buffer = Buffer;
}

if (!("Buffer" in globalThis)) {
  (globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
