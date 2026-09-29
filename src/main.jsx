import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import { Toaster } from "react-hot-toast";
import { reloadOnceForChunkError } from "./utils/chunkReload";

// Vite fires this when a lazy chunk (or its CSS) fails to preload — usually
// because a new deploy removed the old hashed files. Reload once to fetch the
// new index.html; if it happens again right away, let the error surface so the
// ErrorBoundary shows a manual "Reload page" button instead of looping.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadOnceForChunkError()) event.preventDefault();
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <CartProvider>
        <App />
        <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: "12px",
            fontFamily: "'Poppins', sans-serif",
            fontSize: "14px",
            fontWeight: "500",
            padding: "14px 18px",
          },
          success: {
            style: {
              background: "#0f172a",
              color: "#4ade80",
              border: "1px solid #166534",
            },
            iconTheme: {
              primary: "#4ade80",
              secondary: "#0f172a",
            },
          },
          error: {
            style: {
              background: "#0f172a",
              color: "#f87171",
              border: "1px solid #991b1b",
            },
            iconTheme: {
              primary: "#f87171",
              secondary: "#0f172a",
            },
          },
        }}
      />
      </CartProvider>
    </ThemeProvider>
  </StrictMode>,
);
