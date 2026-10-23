import { afterEach, describe, expect, it, vi } from "vitest";
import { setBackend, localBackend } from "@/data/backend";
import { userStore } from "@/features/settings/user-store";
import { TOUR_STEPS, endTour, goToStep, placeCard, shouldStartTour, startTour, tourState } from "./tour-model";

const screen = { width: 1280, height: 800 };
const card = { width: 352, height: 200 };

describe("placeCard", () => {
  it("puts the card beside a sidebar entry, centered on it", () => {
    expect(placeCard({ top: 300, left: 14, width: 236, height: 36 }, card, screen)).toEqual({ top: 218, left: 264 });
  });

  it("puts it above the bottom bar on a phone", () => {
    const phone = { width: 390, height: 844 };
    expect(placeCard({ top: 780, left: 90, width: 60, height: 48 }, card, phone)).toEqual({ top: 566, left: 16 });
  });

  it("puts it below a target near the top with no room beside it", () => {
    const phone = { width: 390, height: 844 };
    expect(placeCard({ top: 20, left: 300, width: 40, height: 40 }, card, phone)).toEqual({ top: 74, left: 22 });
  });

  it("keeps it inside the screen, and centers it without a target", () => {
    expect(placeCard({ top: 2, left: 14, width: 236, height: 36 }, card, screen).top).toBe(16);
    expect(placeCard(null, card, screen)).toEqual({ top: 300, left: 464 });
  });
});

describe("the tour", () => {
  afterEach(() => setBackend(localBackend));

  it("starts by itself while the account hasn't finished or skipped it", () => {
    expect(shouldStartTour("connected", "pending")).toBe(true);
    expect(shouldStartTour("connected", "finished")).toBe(false);
    expect(shouldStartTour("connected", "skipped")).toBe(false);
  });

  it("moves between its steps and stays within them", () => {
    startTour();
    expect(tourState()).toEqual({ open: true, step: 0 });
    goToStep(99);
    expect(tourState().step).toBe(TOUR_STEPS.length - 1);
    goToStep(-1);
    expect(tourState().step).toBe(0);
  });

  it("saves how it ended to the account", async () => {
    const send = vi.fn(() => Promise.resolve());
    setBackend({ send });
    startTour();
    endTour("skipped", "connected");
    expect(tourState().open).toBe(false);
    expect(userStore.get().tour.status).toBe("skipped");
    expect(send).toHaveBeenCalledWith([{ type: "saveSettings", section: "userTour", data: { status: "skipped" } }]);
    // Ending it the same way again doesn't send anything
    endTour("skipped", "connected");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("has a handful of steps, each pointing at the navigation but the welcome", () => {
    expect(TOUR_STEPS.length).toBeGreaterThanOrEqual(5);
    expect(TOUR_STEPS.length).toBeLessThanOrEqual(7);
    expect(TOUR_STEPS.slice(1).every((step) => step.targets.length > 0)).toBe(true);
  });
});
