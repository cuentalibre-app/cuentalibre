import { useTranslation } from "react-i18next";
import { useRef, useState } from "react";

/**
 * The logo, built in front of the user: the three columns spring up one after
 * another and the head drops onto the last one, which is when `onLand` fires
 * with the head's place on screen (where the confetti bursts from). Tapping
 * it plays it again.
 */
export function WelcomeMark({ onLand }: { onLand: (point: { x: number; y: number }) => void }) {
  const { t } = useTranslation();
  const head = useRef<SVGCircleElement>(null);
  const [plays, setPlays] = useState(0);
  const touchdown = useRef(0);

  const land = () => {
    const box = head.current?.getBoundingClientRect();
    if (box) onLand({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
  };

  return (
    <button
      type="button"
      aria-label={t("tour.replay")}
      onClick={() => setPlays((count) => count + 1)}
      className="mx-auto grid size-24 cursor-pointer place-items-center rounded-full bg-muted text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-transform motion-safe:active:scale-95"
    >
      {/* A new key remounts it, so its animations start over */}
      <svg key={plays} viewBox="0 0 192 208" className="size-12 overflow-visible" aria-hidden="true">
        <g className="fill-current">
          {[
            { x: 0, y: 132, height: 76 },
            { x: 70, y: 88, height: 120 },
            { x: 140, y: 68, height: 140 },
          ].map((column, index) => (
            <rect
              key={column.x}
              x={column.x}
              y={column.y}
              width="52"
              height={column.height}
              rx="14"
              className="origin-bottom [transform-box:fill-box] motion-safe:animate-column-up"
              style={{ animationDelay: `${120 + index * 110}ms` }}
            />
          ))}
        </g>
        <circle
          ref={head}
          cx="166"
          cy="26"
          r="26"
          className="origin-bottom fill-chart-income [transform-box:fill-box] motion-safe:animate-head-drop"
          // Without motion it doesn't animate, and there's no confetti either
          onAnimationStart={() => {
            // A replay restarts the drop: only its own touchdown bursts
            window.clearTimeout(touchdown.current);
            touchdown.current = window.setTimeout(land, HEAD_TOUCHDOWN_MS);
          }}
        />
      </svg>
    </button>
  );
}

/** When the head first touches the column: 55% into its 800ms drop. */
const HEAD_TOUCHDOWN_MS = 440;
