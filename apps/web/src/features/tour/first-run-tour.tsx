import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router";
import { ArrowRight, X } from "lucide-react";
import { Button, buttonVariants } from "@cuentalibre/ui/components/button";
import { Dialog, DialogDescription, DialogPanel, DialogPortal, DialogTitle } from "@cuentalibre/ui/components/dialog";
import { cn } from "@cuentalibre/ui/lib/cn";
import { sessionState } from "@/features/auth/session";
import { useUserSettings } from "@/features/settings/user-store";
import { Confetti } from "./confetti";
import { WelcomeMark } from "./welcome-mark";
import { TOUR_STEPS, endTour, goToStep, placeCard, shouldStartTour, startTour, useTour, type Box } from "./tour-model";

/** Room around what a step points at, so the highlight doesn't touch it. */
const HALO = 4;

/** The first of the step's targets that is on screen: the sidebar on desktop, the bottom bar on phones. */
function findTarget(targets: string[]) {
  for (const key of targets) {
    const found = [...document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`)].find(
      (element) => element.getClientRects().length > 0,
    );
    if (found) return found;
  }
  return null;
}

const toBox = ({ top, left, width, height }: DOMRect): Box => ({ top, left, width, height });

interface Layout {
  target: Box | null;
  card: { top: number; left: number } | null;
}

/**
 * A short tour of the app's sections, pointing at each one in the navigation.
 * It starts by itself the first time someone enters the app, and again from
 * the user menu. Esc or "Saltar" skip it; either way it won't start by itself again.
 */
export function FirstRunTour() {
  const { t } = useTranslation();
  const { open, step } = useTour();
  const { tour } = useUserSettings();
  const session = sessionState();
  // The card mounts after the dialog opens, through its portal: placing it waits for it
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const next = useRef<HTMLButtonElement>(null);
  const [layout, setLayout] = useState<Layout>({ target: null, card: null });
  const [burst, setBurst] = useState<{ x: number; y: number; id: number } | null>(null);
  const current = TOUR_STEPS[step]!;
  const last = step === TOUR_STEPS.length - 1;
  const welcome = step === 0;

  // Only when the app opens: finishing it, or a later change, doesn't bring it back
  useEffect(() => {
    if (shouldStartTour(session, tour.status)) startTour();
  }, []);

  const measure = useCallback(() => {
    if (!panel) return;
    const element = findTarget(current.targets);
    const target = element ? toBox(element.getBoundingClientRect()) : null;
    const card = { width: panel.offsetWidth, height: panel.offsetHeight };
    // Without the scrollbar, which the card mustn't cover
    const { clientWidth: width, clientHeight: height } = document.documentElement;
    const screen = { width, height };
    setLayout({ target, card: placeCard(target, card, screen) });
  }, [current, panel]);

  useLayoutEffect(() => {
    if (!open || !panel) return;
    findTarget(current.targets)?.scrollIntoView({ block: "nearest" });
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    // The card grows or shrinks with each step's text
    const resized = new ResizeObserver(measure);
    resized.observe(panel);
    return () => {
      resized.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, panel, current, measure]);

  const finish = (status: "finished" | "skipped") => endTour(status, session);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight" && !last) goToStep(step + 1);
    else if (event.key === "ArrowLeft" && step > 0) goToStep(step - 1);
    else return;
    event.preventDefault();
  };

  const { target, card } = layout;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && finish("skipped")}>
      <DialogPortal>
        {target ? (
          <div
            aria-hidden="true"
            className="pointer-events-none fixed z-50 rounded-xl border-2 border-primary motion-safe:transition-[top,left,width,height] motion-safe:duration-300 motion-safe:ease-out"
            style={{
              top: target.top - HALO,
              left: target.left - HALO,
              width: target.width + HALO * 2,
              height: target.height + HALO * 2,
              // The dimmed page around the target
              boxShadow: "0 0 0 200vmax color-mix(in oklab, var(--color-black) 50%, transparent)",
            }}
          />
        ) : (
          <div aria-hidden="true" className="fixed inset-0 z-50 animate-fade-in bg-black/50" />
        )}
        <DialogPanel
          ref={setPanel}
          onKeyDown={onKeyDown}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            next.current?.focus();
          }}
          // Only its buttons and Esc end it: a stray tap on the page shouldn't
          onPointerDownOutside={(event) => event.preventDefault()}
          className={cn(
            "fixed z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-3 rounded-xl border border-border bg-popover p-5 text-popover-foreground shadow-popover outline-none motion-safe:transition-[top,left] motion-safe:duration-300 motion-safe:ease-out",
            // Hidden until placed, but focusable, so its first button takes the focus
            !card && "opacity-0",
          )}
          style={card ?? { top: 0, left: 0 }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-muted-foreground">
              {t("tour.progress", { step: step + 1, total: TOUR_STEPS.length })}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("tour.close")}
              onClick={() => finish("skipped")}
              className="-my-1.5 -mr-1.5"
            >
              <X strokeWidth={2} aria-hidden="true" />
            </Button>
          </div>
          <div
            key={step}
            className={cn(
              "flex animate-fade-in flex-col gap-1.5",
              welcome && "items-center pb-1 text-center text-balance",
            )}
          >
            {welcome && card && <WelcomeMark onLand={(point) => setBurst({ ...point, id: performance.now() })} />}
            <DialogTitle className={cn("min-h-0 pr-0", welcome && "mt-3 text-xl")}>
              {t(`tour.steps.${current.copy}.title`)}
            </DialogTitle>
            <DialogDescription className="mt-0 text-base leading-relaxed">
              {t(`tour.steps.${current.copy}.body`)}
            </DialogDescription>
            {current.action && (
              <Link
                to={current.action.to}
                onClick={() => finish("finished")}
                className={cn(buttonVariants({ variant: "link" }), "gap-1 self-start")}
              >
                {t("tour.completeBusiness")}
                <ArrowRight className="size-4" strokeWidth={2} aria-hidden="true" />
              </Link>
            )}
          </div>
          <div className="flex gap-1.5 pt-1" aria-hidden="true">
            {TOUR_STEPS.map((_, index) => (
              <span
                key={index}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-300",
                  index <= step ? "bg-primary" : "bg-muted-strong",
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            {step === 0 ? (
              <Button variant="secondary" className="text-muted-foreground" onClick={() => finish("skipped")}>
                {t("tour.skip")}
              </Button>
            ) : (
              <Button variant="secondary" className="-ml-2" onClick={() => goToStep(step - 1)}>
                {t("tour.previous")}
              </Button>
            )}
            <div className="flex-1" />
            <Button ref={next} onClick={() => (last ? finish("finished") : goToStep(step + 1))}>
              {last ? t("tour.finish") : step === 0 ? t("tour.start") : t("tour.next")}
            </Button>
          </div>
        </DialogPanel>
        {burst && <Confetti key={burst.id} origin={burst} onDone={() => setBurst(null)} />}
      </DialogPortal>
    </Dialog>
  );
}
