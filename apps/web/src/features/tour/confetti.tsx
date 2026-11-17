import { useEffect, useRef } from "react";

/** The confetti colours, read from the theme. */
const COLOR_TOKENS = [1, 2, 3, 4, 5, 6].map((index) => `--confetti-${index}`);

const PIECES = 110;
const GRAVITY = 0.32;
const DRAG = 0.985;
const LIFETIME_MS = 2600;

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  angle: number;
  flutter: number;
  size: number;
  color: string;
  /** Columns and heads, like the logo. */
  round: boolean;
}

const random = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * A one-off burst of confetti from a point on screen, drawn on a canvas over
 * everything and gone once the last piece falls. Skipped when the user asks
 * for less motion.
 */
export function Confetti({ origin, onDone }: { origin: { x: number; y: number }; onDone: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onDone();
      return;
    }
    const ratio = window.devicePixelRatio || 1;
    const resize = () => {
      element.width = window.innerWidth * ratio;
      element.height = window.innerHeight * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const styles = getComputedStyle(document.documentElement);
    const colors = COLOR_TOKENS.map((token) => styles.getPropertyValue(token).trim()).filter(Boolean);
    const pieces: Piece[] = Array.from({ length: PIECES }, () => {
      // Mostly upwards, fanning out to both sides
      const angle = random(-Math.PI * 0.92, -Math.PI * 0.08);
      const speed = random(7, 17);
      return {
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        spin: random(-0.25, 0.25),
        angle: random(0, Math.PI * 2),
        flutter: random(0, Math.PI * 2),
        size: random(6, 11),
        color: colors[Math.floor(Math.random() * colors.length)] ?? "currentColor",
        round: Math.random() < 0.3,
      };
    });

    const start = performance.now();
    let frame = requestAnimationFrame(function draw(now) {
      const elapsed = now - start;
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      // The last stretch fades out, so nothing pops off screen
      context.globalAlpha = Math.min(1, (LIFETIME_MS - elapsed) / 600);
      for (const piece of pieces) {
        piece.vx *= DRAG;
        piece.vy = piece.vy * DRAG + GRAVITY;
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.angle += piece.spin;
        piece.flutter += 0.12;
        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.angle);
        // Turning over as it falls, like paper
        context.scale(1, Math.cos(piece.flutter));
        context.fillStyle = piece.color;
        context.beginPath();
        if (piece.round) context.arc(0, 0, piece.size / 2, 0, Math.PI * 2);
        else context.roundRect(-piece.size / 2, -piece.size * 0.8, piece.size, piece.size * 1.6, piece.size / 4);
        context.fill();
        context.restore();
      }
      if (elapsed < LIFETIME_MS) frame = requestAnimationFrame(draw);
      else onDone();
    });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvas} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] size-full" />;
}
