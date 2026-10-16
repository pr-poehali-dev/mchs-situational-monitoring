import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

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
  // Офлайн-кэш в десктопной программе только вредит: он перехватывает
  // запросы к погоде и оповещению. Не кладём его в сборку вовсе.
  generateBundle(_opts: unknown, bundle: Record<string, unknown>) {
    for (const name of Object.keys(bundle)) {
      if (name === "sw.js" || name === "manifest.webmanifest") delete bundle[name];
    }
  },
};

const KILL_SWITCH_SW = `self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) await caches.delete(k);
    await self.registration.unregister();
    for (const c of await self.clients.matchAll({ type: "window" })) c.navigate(c.url);
  })());
});
`;

const replaceServiceWorker = {
  name: "replace-service-worker",
  closeBundle() {
    const out = path.resolve(__dirname, "dist-desktop");
    fs.writeFileSync(path.join(out, "sw.js"), KILL_SWITCH_SW);
    const mf = path.join(out, "manifest.webmanifest");
    if (fs.existsSync(mf)) fs.unlinkSync(mf);
  },
};

export default defineConfig({
  plugins: [react(), stripOnlineScripts, replaceServiceWorker],
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