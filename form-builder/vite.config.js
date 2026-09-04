import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* Bundel dibuat format IIFE (bukan modul ES) supaya dist/index.html bisa
   dibuka langsung lewat file:// tanpa server. Modul ES diblokir CORS
   pada protokol file://. */
export default defineConfig({
    plugins: [
        react(),
        {
            name: "plain-script",
            apply: "build",          // JANGAN aktif di mode dev — di sana script
            // memang harus type="module" agar JSX diproses
            transformIndexHtml(html) {
                return html
                    .replace(/\stype="module"/g, " defer")
                    .replace(/\scrossorigin/g, "");
            },
        },
    ],
    base: "./",
    server: {
        host: "0.0.0.0",
        port: 5173,
        strictPort: false,
        allowedHosts: true,
        proxy: {
            "/api": {
                target: "http://localhost:5180",
                secure: false,
                changeOrigin: false,
                followRedirects: true,
                xfwd: true
            }
        }
    },
    preview: { host: "0.0.0.0", allowedHosts: true },
    build: {
        outDir: "dist",
        emptyOutDir: true,
        cssCodeSplit: false,
        modulePreload: false,
        rollupOptions: {
            output: {
                format: "iife",
                inlineDynamicImports: true,
                entryFileNames: "assets/app.js",
                assetFileNames: "assets/[name][extname]",
            },
        },
    },
});
