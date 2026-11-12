/** Segmented controls: slide the white pill under the chosen option. */
export const placeIndicators = () => {
  for (const group of document.querySelectorAll<HTMLElement>("[data-indicator-group]")) {
    const indicator = group.querySelector<HTMLElement>("[data-indicator]")!;
    const active = group.querySelector<HTMLElement>('[aria-selected="true"], [aria-pressed="true"]');
    if (!active) continue;
    const first = !group.hasAttribute("data-ready");
    // The first placement jumps into position instead of sliding from the corner
    if (first) indicator.style.transition = "none";
    indicator.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
    indicator.style.width = `${active.offsetWidth}px`;
    indicator.style.height = `${active.offsetHeight}px`;
    indicator.style.borderRadius = getComputedStyle(active).borderRadius;
    if (first) {
      indicator.getBoundingClientRect();
      indicator.style.transition = "";
      group.setAttribute("data-ready", "");
    }
  }
};

placeIndicators();
document.fonts.ready.then(placeIndicators);
window.addEventListener("resize", placeIndicators);
