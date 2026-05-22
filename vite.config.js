import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { target: "esnext" },
  server: { mimeTypes: { ".jsx": "text/javascript" } }
});
