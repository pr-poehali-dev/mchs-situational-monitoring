import * as React from 'react';
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Офлайн-кэш нужен только браузерной версии. В десктопной программе он
// перехватывает запросы и отдаёт устаревшие ответы — погода тогда навсегда
// застревает на «нет связи». Поэтому там кэш не ставим, а ранее
// установленный — снимаем.
declare const __DESKTOP__: boolean | undefined;
const isDesktop = typeof __DESKTOP__ !== "undefined" && __DESKTOP__;

if ("serviceWorker" in navigator) {
  if (isDesktop) {
    navigator.serviceWorker.getRegistrations()
      .then(rs => rs.forEach(r => r.unregister()))
      .catch(() => {});
    if ("caches" in window) {
      caches.keys().then(ks => ks.forEach(k => caches.delete(k))).catch(() => {});
    }
  } else {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);