// Applies the stored theme and backdrop before the first paint, so a dark page never flashes
// white. A classic script because the CSP allows no inline ones; src/lib/appearance.ts owns the
// preference from then on and shares its storage key and shape.
(function () {
  var theme = "system";
  var backdrop = "aurora";
  try {
    var stored = JSON.parse(localStorage.getItem("cuentalibre:appearance") || "{}");
    if (stored.theme === "light" || stored.theme === "dark") theme = stored.theme;
    if (["sunset", "forest", "plain"].indexOf(stored.backdrop) >= 0) backdrop = stored.backdrop;
  } catch (e) {
    // Storage unavailable: keep the defaults
  }
  var dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  if (dark) document.documentElement.classList.add("dark");
  document.documentElement.dataset.backdrop = backdrop;
})();
