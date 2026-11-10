import { fitGoal } from "./actions.js";
import { placeNowLine, renderDay } from "./day.js";
import { renderJournalList } from "./modals.js";
import { renderMonth } from "./month.js";
import { renderLook, renderSetup } from "./settings.js";
import { S } from "./state.js";
import { $, parseKey, todayKey } from "./util.js";

// ---------- rendering ----------
function render() {
  const a = document.activeElement; const inApp = a && a.id && $("#app").contains(a);
  let fid = inApp ? a.id : null, ss, se; try { ss = a.selectionStart; se = a.selectionEnd; } catch (e) {}
  renderHeader();
  if (!S.ready) { if (!$("#app .loading")) $("#app").innerHTML = `<div class="loading">Loading your planner…</div>`; return; }
  document.body.classList.toggle("signed-out", S.mode === "setup");
  if (S.mode === "setup" || S.showSetup) {
    if (S.showSetup && S.setupView === "look" && S.mode !== "setup") { $("#app").innerHTML = renderLook(); $("#placebar").hidden = true; document.body.classList.remove("signed-out"); return; }
    const keep = {}; [].forEach(id => { const el = document.getElementById(id); if (el) keep[id] = el.value; });
    $("#app").innerHTML = renderSetup(); $("#placebar").hidden = true;
    Object.entries(keep).forEach(([id, v]) => { const el = document.getElementById(id); if (el) el.value = v; });
    if (fid) document.getElementById(fid)?.focus();
    return;
  }
  $("#app").innerHTML = S.view === "journal" ? renderJournalList() : S.view === "day" ? renderDay() : renderMonth();
  placeNowLine();
  document.querySelectorAll("textarea.goal-ta").forEach(fitGoal);
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus(); try { if (ss != null) el.setSelectionRange(ss, se); } catch (e) {} } }
  const pb = $("#placebar"); pb.hidden = !S.placing; if (S.placing) $("#placetext").textContent = S.placing.copy ? `Tap a box to put a copy of “${S.placing.text}”` : `Tap an hour to schedule “${S.placing.text}”`;
  document.body.classList.toggle("placing", !!S.placing);
  document.body.classList.toggle("signed-out", S.mode === "setup");
}
function renderHeader() {
  $("#v-day").setAttribute("aria-pressed", S.view === "day");
  $("#v-month").setAttribute("aria-pressed", S.view === "month");
  $("#journal-view").setAttribute("aria-pressed", S.view === "journal" && !S.showSetup);
  document.querySelector(".datenav").hidden = S.view === "journal" && !S.showSetup; // dates don't apply to the journal list
  const d = parseKey(S.date);
  $("#datelabel").textContent = S.view === "day"
    ? (S.date === todayKey() ? "Today, " : "") + d.toLocaleDateString([], { weekday: S.date === todayKey() ? undefined : "short", month: "short", day: "numeric", year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined })
    : d.toLocaleDateString([], { month: "long", year: "numeric" });
  $("#datejump").value = S.date;
}


export { render, renderHeader };
