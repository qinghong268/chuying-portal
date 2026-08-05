import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@chuying/shared": path.resolve(__dirname, "../shared/src/index.ts"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5179",
        changeOrigin: true,
      },
      // Uploaded images are served by the API server; proxy them in dev.
      "/uploads": {
        target: "http://localhost:5179",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
    minify: "esbuild",
    target: "es2020",
    cssMinify: true,
    sourcemap: false,
  },
});
