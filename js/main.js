import "./actions.js";
import "./notify.js";
import { placeNowLine } from "./day.js";
import { modalOpen } from "./modals.js";
import { render, renderHeader } from "./render.js";
import { getAppearance, setAppearance, syncThemeColor } from "./settings.js";
import { S } from "./state.js";
import { Store } from "./store.js";
import { todayKey } from "./util.js";

// ---------- clock ----------
let lastDay = todayKey();
setInterval(() => {
  if (modalOpen()) return;
  const tk = todayKey();
  if (tk !== lastDay) { if (S.date === lastDay) S.date = tk; lastDay = tk; render(); return; }
  if (S.view === "day" && S.date === tk && S.ready) {
    const a = document.activeElement; if (a && a.matches("input,textarea")) { document.querySelector(".nowline")?.remove(); placeNowLine(); return; }
    render();
  }
}, 60000);

setAppearance(getAppearance());
syncThemeColor();
renderHeader();
Store.init();
// Always load the newest app files after an update (see sw.js)
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

export { lastDay };
