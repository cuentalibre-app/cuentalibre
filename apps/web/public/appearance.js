// Applies the stored theme before the first paint, so a dark page never flashes
// white. A classic script because the CSP allows no inline ones; src/lib/appearance.ts owns the
// preference from then on and shares its storage key and shape.
// A ?tema=oscuro|claro link (the site's demo buttons) stores that theme first, so the app opens in
// the theme the visitor picked on the site, and leaves the address without it.
(function () {
  var theme = "system";
  var linked = { oscuro: "dark", claro: "light" }[new URLSearchParams(location.search).get("tema")];
  try {
    var stored = JSON.parse(localStorage.getItem("cuentalibre:appearance") || "{}");
    if (linked) {
      stored.theme = linked;
      localStorage.setItem("cuentalibre:appearance", JSON.stringify(stored));
    }
    if (stored.theme === "light" || stored.theme === "dark") theme = stored.theme;
  } catch (e) {
    // Storage unavailable: the linked theme still applies to this page
    if (linked) theme = linked;
  }
  if (linked) {
    var url = new URL(location.href);
    url.searchParams.delete("tema");
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  }
  var dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  if (dark) document.documentElement.classList.add("dark");
  // The browser chrome takes the colour of the canvas behind the app (--canvas in semantic.css)
  var themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute("content", dark ? "#0d0e10" : "#f3f3f1");
})();
