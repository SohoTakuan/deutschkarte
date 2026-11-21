(function () {
  try {
    var saved = localStorage.getItem("deutschkarte_theme");
    var prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme =
      saved === "dark" || saved === "light"
        ? saved
        : prefersDark
          ? "dark"
          : "light";
    document.documentElement.dataset.theme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", theme === "dark" ? "#1B2738" : "#1E4DB7");
    }
  } catch (err) {
    // Ignore storage errors before app boot
  }
})();
