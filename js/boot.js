// Runs before the page draws: apply the saved appearance and style so there's no flash.
var STYLE_FONTS = { sage: "Newsreader:opsz,wght@6..72,500;6..72,600&family=Figtree:wght@400;500;600;700", deep: "Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500", mist: "Instrument+Serif:ital@0;1&family=Albert+Sans:wght@400;500;600" };
function loadStyleFonts(st) { if (!STYLE_FONTS[st] || document.getElementById("fonts-" + st)) return; var l = document.createElement("link"); l.id = "fonts-" + st; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=" + STYLE_FONTS[st] + "&display=swap"; document.head.appendChild(l); }
try {
  var t = localStorage.getItem("hourbox-appearance"); if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  var st = localStorage.getItem("hourbox-style"); if (STYLE_FONTS[st]) { document.documentElement.setAttribute("data-style", st); loadStyleFonts(st); }
} catch (e) {}
