import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/**
 * Десктопная сборка: программа работает на рабочем месте дежурного,
 * где интернета может не быть вовсе. Поэтому из index.html вырезаются
 * все внешние скрипты (аналитика, телеметрия, инспектор) — иначе
 * запуск упирается в таймауты сети.
 */
const stripOnlineScripts = {
  name: "strip-online-scripts",
  transformIndexHtml(html: string) {
    return html
      .replace(/<script[^>]*src="https?:\/\/[^"]*"[^>]*><\/script>/g, "")
      .replace(/<!-- Yandex\.Metrika counter -->[\s\S]*?<!-- \/Yandex\.Metrika counter -->/g, "")
      .replace(/<link rel="manifest"[^>]*>/g, "")
      .replace(/<script[^>]*>[\s\S]*?serviceWorker[\s\S]*?<\/script>/g, "");
  },
};

export default defineConfig({
  plugins: [react(), stripOnlineScripts],
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    __DESKTOP__: JSON.stringify(true),
  },
  build: {
    outDir: "dist-desktop",
    emptyOutDir: true,
    sourcemap: false,
    target: "es2020",
    chunkSizeWarningLimit: 2000,
  },
});
