import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Wichtig für GitHub Pages:
 * - base muss auf "/<repo-name>/" gesetzt werden, damit Assets korrekt geladen werden.
 */
export default defineConfig({
  base: "/spriteanvil/",
  plugins: [react()]
});
