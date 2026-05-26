import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: "dist",
    rollupOptions: {
      input: {
        devtools: resolve(__dirname, "src/devtools.html"),
        panel: resolve(__dirname, "src/panel.html"),
      },
    },
  },
  publicDir: "public",
});
