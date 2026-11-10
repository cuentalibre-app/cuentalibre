import { useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Layers, LayoutGrid, Menu, Percent, ReceiptText, type LucideIcon } from "lucide-react";
import { cn } from "@cuentalibre/ui/lib/cn";
import { CreateMenu } from "./create-menu";
import { MoreSheet } from "./more-sheet";
import { phoneShortcuts, tabPaths } from "./nav";

type Slot =
  | { kind: "link"; label: string; to: string; icon: LucideIcon; tour: string }
  | { kind: "create"; label: string; icon: LucideIcon; tour: string }
  | { kind: "more"; label: string; icon: LucideIcon; tour: string };

/** Left to right, as drawn: the lens slides over these slots. */
const slots: Slot[] = [
  { kind: "link", label: "Inicio", to: "/", icon: LayoutGrid, tour: "/" },
  { kind: "link", label: "Ventas", to: "/ventas", icon: ReceiptText, tour: "/ventas" },
  { kind: "create", label: "Accesos rápidos", icon: Layers, tour: "/compras" },
  { kind: "link", label: "Impuestos", to: "/impuestos", icon: Percent, tour: "/impuestos" },
  { kind: "more", label: "Más", icon: Menu, tour: "/mas" },
];

const MORE = slots.findIndex((s) => s.kind === "more");
/** A finger has to travel this far before a press becomes a drag. */
const DRAG_SLOP = 6;
/** The bar's inner padding (p-1.5): the slots and the lens sit inside it. */
const INSET = 6;

const matches = (path: string, pathname: string) => (path === "/" ? pathname === "/" : pathname.startsWith(path));

/** The slot the current page belongs to; pages without a tab of their own live under "Más". */
function currentSlot(pathname: string) {
  const i = slots.findIndex((s) => s.kind === "link" && matches(s.to, pathname));
  return i === -1 ? MORE : i;
}

interface Drag {
  pointerId: number;
  startX: number;
  active: boolean;
  /** Left edge of the bar's inner track and the width of one slot, measured at press. */
  trackLeft: number;
  slotWidth: number;
  slot: number;
}

/**
 * Floating tab bar for phones: four sections and a menu of everyday lists on a frosted pill. A lens marks the
 * current section; dragging a finger along the bar carries the lens with it and lifting the
 * finger opens whatever is under it.
 */
export function BottomNav({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  /** The slot under the finger while dragging, so its icon lights up before the lens settles. */
  const [hovered, setHovered] = useState<number | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const swallowClick = useRef(false);

  const selected = moreOpen || !tabPaths.some((p) => matches(p, pathname)) ? MORE : currentSlot(pathname);
  const lit = hovered ?? selected;

  function activate(i: number) {
    const slot = slots[i];
    if (!slot) return;
    if (slot.kind === "link") navigate(slot.to);
    else if (slot.kind === "create") setCreateOpen(true);
    else setMoreOpen(true);
  }

  /** Places the lens centred under the finger, kept inside the bar; returns the slot it covers. */
  function follow(d: Drag, clientX: number) {
    const max = (slots.length - 1) * d.slotWidth;
    const x = Math.min(max, Math.max(0, clientX - d.trackLeft - d.slotWidth / 2));
    if (lens.current) lens.current.style.transform = `translateX(${x}px)`;
    return Math.round(x / d.slotWidth);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || !track.current) return;
    const el = track.current;
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      active: false,
      trackLeft: el.getBoundingClientRect().left + el.clientLeft + INSET,
      slotWidth: (el.clientWidth - 2 * INSET) / slots.length,
      slot: selected,
    };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.active) {
      if (Math.abs(e.clientX - d.startX) < DRAG_SLOP) return;
      d.active = true;
      // Keep receiving moves when the finger slides past the bar's ends
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // The pointer is already gone (lifted between events): the drag still ends on pointerup
      }
      setDragging(true);
    }
    const slot = follow(d, e.clientX);
    if (slot !== d.slot) {
      d.slot = slot;
      setHovered(slot);
    }
  }

  function endDrag(e: PointerEvent<HTMLDivElement>, commit: boolean) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    if (!d.active) return;
    // The press already became a drag: the click that follows must not also hit the tab it started on
    swallowClick.current = true;
    window.setTimeout(() => (swallowClick.current = false), 0);
    setDragging(false);
    setHovered(null);
    // Settle on the tab it was dropped on (the route change then keeps it there), or back home if cancelled.
    // Next frame, once the spring transition is back on, so the lens glides instead of jumping.
    const kind = slots[d.slot]?.kind;
    const rest = commit && kind !== "create" ? d.slot : selected;
    requestAnimationFrame(() => {
      if (lens.current) lens.current.style.transform = `translateX(${rest * 100}%)`;
    });
    if (commit && (d.slot !== selected || kind !== "link")) activate(d.slot);
  }

  function onClickCapture(e: MouseEvent) {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <nav
      aria-label="Principal"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center px-4 pb-[max(16px,calc(env(safe-area-inset-bottom)+4px))]",
        className,
      )}
    >
      <div
        ref={track}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e, true)}
        onPointerCancel={(e) => endDrag(e, false)}
        onClickCapture={onClickCapture}
        className="pointer-events-auto relative flex w-full max-w-sm touch-none items-center rounded-full border border-glass-edge bg-glass p-1.5 shadow-floating backdrop-blur-lg backdrop-saturate-[1.8] select-none [-webkit-touch-callout:none]"
      >
        {/* The lens: rests on the current tab, follows the finger while it drags */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-1.5 left-1.5 w-[calc((100%-12px)/5)]">
          <div
            ref={lens}
            className={cn(
              "absolute inset-0 will-change-transform",
              !dragging && "transition-transform duration-300 ease-[cubic-bezier(0.3,1.4,0.5,1)]",
            )}
            // Written by React at rest; the drag moves it directly, frame by frame, without re-rendering
            style={{ transform: `translateX(${selected * 100}%)` }}
          >
            <div
              className={cn(
                "size-full rounded-full transition-[scale,background-color,box-shadow,backdrop-filter] duration-200 ease-out",
                dragging
                  ? "scale-x-[1.18] scale-y-[1.28] bg-glass shadow-lens backdrop-blur-[2px] backdrop-brightness-110 backdrop-saturate-150"
                  : "bg-foreground/8",
              )}
            />
          </div>
        </div>

        {slots.map((slot, i) => {
          const Icon = slot.icon;
          const tabClass = cn(
            "relative grid h-13 flex-1 cursor-pointer place-items-center rounded-full border-0 bg-transparent no-underline transition-[color,scale] duration-200 ease-out active:scale-90",
            i === lit ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          );
          const iconProps = { className: "size-[22px]", strokeWidth: 1.8, "aria-hidden": true } as const;

          if (slot.kind === "link") {
            return (
              <Link
                key={slot.tour}
                to={slot.to}
                aria-label={slot.label}
                aria-current={i === selected && !moreOpen ? "page" : undefined}
                data-tour={slot.tour}
                className={tabClass}
              >
                <Icon {...iconProps} />
              </Link>
            );
          }
          if (slot.kind === "create") {
            return (
              <CreateMenu
                key={slot.tour}
                side="top"
                align="center"
                contentClassName="mb-2"
                open={createOpen}
                onOpenChange={setCreateOpen}
                actions={phoneShortcuts}
              >
                <button
                  type="button"
                  aria-label={slot.label}
                  data-tour={slot.tour}
                  className={cn(tabClass, "[&[data-state=open]]:text-foreground")}
                  // Radix opens the menu on press; a press here may be the start of a drag, so open on tap instead
                  onPointerDown={(e) => e.pointerType !== "mouse" && e.preventDefault()}
                  onClick={(e) => e.detail > 0 && !createOpen && setCreateOpen(true)}
                >
                  <Icon {...iconProps} />
                </button>
              </CreateMenu>
            );
          }
          return (
            <MoreSheet key={slot.tour} open={moreOpen} onOpenChange={setMoreOpen}>
              <button type="button" aria-label={slot.label} data-tour={slot.tour} className={tabClass}>
                <Icon {...iconProps} />
              </button>
            </MoreSheet>
          );
        })}
      </div>
    </nav>
  );
}
