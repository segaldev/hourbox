// Gratitude box: one simple thing you're grateful for, written into the day. It sits with the quote of the day,
// is saved with that day (field `grat`), and is turned on or off in Settings (saved in your account).
import { S, mutate } from "./state.js";
import { esc } from "./util.js";

const gratOn = () => !!(S.docs.settings && S.docs.settings.grat);
const setGratOn = on => mutate("settings", Object.assign({ kind: "settings" }, S.docs.settings || {}), st => { st.grat = on; });

function renderGratitude(d, ro) {
  if (!gratOn()) return "";
  const v = d.grat || "";
  if (ro && !v) return "";
  return `<section class="grat${v ? " filled" : ""}" aria-labelledby="grat-h">
    <h2 id="grat-h"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>Gratitude box</h2>
    <textarea id="grat-in" data-input="grat" rows="1" maxlength="200" placeholder="One simple thing you’re grateful for today" ${ro ? "readonly" : ""}>${esc(v)}</textarea>
  </section>`;
}
function renderGratitudeSettings() {
  const on = gratOn();
  return `<section class="pane setup"><div class="pane-head"><h2>Gratitude box</h2></div>
    <p>${on ? "On. A small box beside the planner asks for one thing you’re grateful for, saved with each day." : "Show a small box beside the planner where you write one simple thing you’re grateful for, saved with each day."}</p>
    <div class="setup-actions">${on ? `<button class="btn ghost" type="button" data-act="grat-off" id="gr-off">Turn off</button>` : `<button class="btn primary" type="button" data-act="grat-on" id="gr-on">Show the gratitude box</button>`}</div>
  </section>`;
}

export { gratOn, setGratOn, renderGratitude, renderGratitudeSettings };
