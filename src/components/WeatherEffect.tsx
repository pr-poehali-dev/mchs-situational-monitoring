import { useEffect, useRef } from "react";
import type { WeatherCondition } from "@/lib/accidentStore";

interface Props {
  condition: WeatherCondition;
  /** Фон карточки: на светлом снег рисуем голубоватым, иначе его не видно */
  theme: "light" | "dark";
}

interface Particle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  phase: number;
  a: number;
}

const COUNT: Record<string, number> = {
  snow: 110,
  rain: 140,
  storm: 220,
  fog: 7,
  ice: 40,
};

/**
 * Живая подложка карточки «Погодные условия» на табло:
 * снег, дождь, шторм с молниями, туман, гололедица.
 * Рисуется на canvas под текстом и не перехватывает клики.
 */
export default function WeatherEffect({ condition, theme }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !condition) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const light = theme === "light";
    let w = 0;
    let h = 0;
    let raf = 0;
    let flash = 0;
    let nextBolt = performance.now() + 2500 + Math.random() * 4000;
    let bolt: { x: number; y: number }[] | null = null;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const spawn = (anywhere: boolean): Particle => {
      const rnd = Math.random;
      switch (condition) {
        case "snow":
          return {
            x: rnd() * w, y: anywhere ? rnd() * h : -10,
            r: 1.5 + rnd() * 3.2, vx: 0, vy: 0.4 + rnd() * 1.1,
            phase: rnd() * Math.PI * 2, a: 0.55 + rnd() * 0.45,
          };
        case "rain":
        case "storm": {
          const heavy = condition === "storm";
          return {
            x: rnd() * (w + 200) - 100, y: anywhere ? rnd() * h : -30,
            r: (heavy ? 16 : 11) + rnd() * 10,
            vx: heavy ? -3.5 - rnd() * 2 : -0.8,
            vy: (heavy ? 13 : 9) + rnd() * 5,
            phase: 0, a: 0.35 + rnd() * 0.4,
          };
        }
        case "fog":
          return {
            x: rnd() * w, y: h * (0.15 + rnd() * 0.8),
            r: Math.max(w, h) * (0.25 + rnd() * 0.25),
            vx: (rnd() < 0.5 ? -1 : 1) * (0.15 + rnd() * 0.25), vy: 0,
            phase: rnd() * Math.PI * 2, a: 0.18 + rnd() * 0.14,
          };
        case "ice":
        default:
          return {
            x: rnd() * w, y: rnd() * h,
            r: 1 + rnd() * 2.2, vx: 0, vy: 0,
            phase: rnd() * Math.PI * 2, a: 0,
          };
      }
    };

    const particles: Particle[] = Array.from({ length: COUNT[condition] ?? 0 }, () => spawn(true));

    const snowColor = light ? "hsla(212, 55%, 62%," : "hsla(0, 0%, 100%,";
    const rainColor = light ? "hsla(212, 60%, 42%," : "hsla(205, 80%, 82%,";
    const fogColor = light ? "215, 25%, 72%" : "210, 20%, 85%";

    const makeBolt = () => {
      const pts = [{ x: w * (0.2 + Math.random() * 0.6), y: 0 }];
      while (pts[pts.length - 1].y < h * 0.85) {
        const p = pts[pts.length - 1];
        pts.push({ x: p.x + (Math.random() - 0.5) * 50, y: p.y + 18 + Math.random() * 26 });
      }
      return pts;
    };

    const drawIceFrame = () => {
      // Иней по краям карточки
      const g = ctx.createLinearGradient(0, h, 0, h * 0.55);
      g.addColorStop(0, light ? "hsla(195, 80%, 70%, 0.35)" : "hsla(195, 90%, 80%, 0.22)");
      g.addColorStop(1, "hsla(195, 80%, 80%, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, h * 0.55, w, h * 0.45);
      const side = (x0: number, x1: number) => {
        const s = ctx.createLinearGradient(x0, 0, x1, 0);
        s.addColorStop(0, light ? "hsla(195, 80%, 72%, 0.28)" : "hsla(195, 90%, 82%, 0.16)");
        s.addColorStop(1, "hsla(195, 80%, 80%, 0)");
        ctx.fillStyle = s;
        ctx.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), h);
      };
      side(0, 50);
      side(w, w - 50);
    };

    const frame = (t: number) => {
      ctx.clearRect(0, 0, w, h);

      if (condition === "ice") drawIceFrame();

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (condition === "snow") {
          p.phase += 0.015;
          p.x += Math.sin(p.phase) * 0.6;
          p.y += p.vy;
          if (p.y > h + 10) particles[i] = spawn(false);
          ctx.beginPath();
          ctx.fillStyle = `${snowColor} ${p.a})`;
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        } else if (condition === "rain" || condition === "storm") {
          p.x += p.vx;
          p.y += p.vy;
          if (p.y > h + 20) particles[i] = spawn(false);
          const k = p.r / p.vy;
          ctx.strokeStyle = `${rainColor} ${p.a})`;
          ctx.lineWidth = condition === "storm" ? 1.4 : 1.1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * k, p.y - p.r);
          ctx.stroke();
        } else if (condition === "fog") {
          p.x += p.vx;
          p.phase += 0.004;
          if (p.x - p.r > w) p.x = -p.r;
          if (p.x + p.r < 0) p.x = w + p.r;
          const a = p.a * (0.75 + Math.sin(p.phase) * 0.25);
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          g.addColorStop(0, `hsla(${fogColor}, ${a})`);
          g.addColorStop(1, `hsla(${fogColor}, 0)`);
          ctx.fillStyle = g;
          ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        } else if (condition === "ice") {
          p.phase += 0.03 + p.r * 0.008;
          const a = Math.max(0, Math.sin(p.phase)) ** 6;
          if (a < 0.02) continue;
          const c = light ? `hsla(200, 85%, 55%, ${a})` : `hsla(195, 100%, 92%, ${a})`;
          const s = p.r * 3.5 * a + p.r;
          ctx.strokeStyle = c;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y);
          ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s);
          ctx.stroke();
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (condition === "storm") {
        if (t > nextBolt) {
          flash = 1;
          bolt = makeBolt();
          nextBolt = t + 3500 + Math.random() * 6000;
        }
        if (flash > 0) {
          ctx.fillStyle = light ? `hsla(220, 40%, 30%, ${flash * 0.18})` : `hsla(0, 0%, 100%, ${flash * 0.28})`;
          ctx.fillRect(0, 0, w, h);
          if (bolt && flash > 0.4) {
            ctx.strokeStyle = light ? `hsla(45, 100%, 45%, ${flash})` : `hsla(50, 100%, 85%, ${flash})`;
            ctx.lineWidth = 2.5;
            ctx.shadowColor = "hsla(50, 100%, 80%, 0.9)";
            ctx.shadowBlur = 14;
            ctx.beginPath();
            bolt.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
          flash -= 0.045;
        }
      }

      if (!reduced) raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [condition, theme]);

  if (!condition) return null;

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0, borderRadius: "inherit" }}
    />
  );
}
