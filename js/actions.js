import { closeZen, openZen, zenOpen } from "./zen.js";
import { setQuotesOn } from "./quotes.js";
import { calSync } from "./calendar.js";
import { nearestFree, setSplit } from "./day.js";
import { askJournal, closeModal, modalOpen, openBoxEditor, openClearDay, openFinish, openJournal } from "./modals.js";
import { Notify } from "./notify.js";
import { render } from "./render.js";
import { googleSignIn, logout, setAppearance, setStyle, syncThemeColor } from "./settings.js";
import { S, applyRoutine, dayId, getDay, getMonth, getPark, getRoutine, mutate, mutateDay, mutatePark } from "./state.js";
import { CFG_KEY, Store, lsGet, lsSet } from "./store.js";
import { toast } from "./ui.js";
import { $, addDays, clone, hourOfKey, keyOf, minOfKey, parseKey, rid, timeLabel, todayKey } from "./util.js";

// ---------- actions ----------
function srcText(src) {
  const d = getDay(S.date);
  if (src.from === "prio") return d.prio[src.i].text;
  if (src.from === "dump") return (d.dump.find(x => x.id === src.id) || {}).text;
  if (src.from === "park") return (getPark().items.find(x => x.id === src.id) || {}).text;
  if (src.from === "box") return (d.boxes[src.h] || {}).text;
}
function place(src, h, copy) { // copy: keep the original where it was (Option/Shift-drag, or Duplicate…)
  const k = S.date; const d0 = getDay(k); copy = !!(copy || src.copy);
  if (d0.finished) { toast("This day is finished. Reopen it to make changes."); return; }
  if (src.from === "box" && String(src.h) === String(h)) { S.placing = null; render(); return; }
  let parkItem = null; let bumped = null; let movedAside = null;
  if (src.from === "park") { parkItem = getPark().items.find(x => x.id === src.id); if (!parkItem) return; }
  mutateDay(k, d => {
    const existing = d.boxes[h];
    let box;
    if (src.from === "prio") box = { text: d.prio[src.i].text.trim(), pi: src.i, status: "planned" };
    else if (src.from === "dump") { const it = d.dump.find(x => x.id === src.id); if (!it) return; box = { text: it.text, status: "planned" }; if (!copy) d.dump = d.dump.filter(x => x.id !== src.id); }
    else if (src.from === "park") box = { text: parkItem.text, status: "planned" };
    else if (src.from === "box" && copy) { if (!d.boxes[src.h]) return; box = Object.assign(clone(d.boxes[src.h]), { status: "planned" }); }
    else if (src.from === "box") { box = d.boxes[src.h]; delete d.boxes[src.h]; if (existing) d.boxes[src.h] = existing; }
    if (existing && (src.from !== "box" || copy)) {
      const fk = existing.flex ? nearestFree(d, h) : null;
      if (fk) { d.boxes[fk] = existing; movedAside = [existing.text, fk]; }
      else { bumped = existing.text; if (existing.pi == null) d.dump.push({ id: rid(), text: existing.text }); }
    }
    d.boxes[h] = box;
  }, { silent: true });
  if (parkItem && !copy) mutatePark(p => { p.items = p.items.filter(x => x.id !== src.id); }, { silent: true });
  S.placing = null; render();
  const extra = movedAside ? ` “${movedAside[0]}” moved to ${timeLabel(minOfKey(movedAside[1]))}.` : bumped ? ` “${bumped}” went back to the brain dump.` : "";
  if (copy) toast(`Copied to ${timeLabel(minOfKey(h))}.${extra}`);
  else if (src.from === "box" && getDay(k).boxes[src.h]) toast("Swapped the two boxes.");
  else if (movedAside) toast(`“${movedAside[0]}” moved to ${timeLabel(minOfKey(movedAside[1]))}.`);
  else if (bumped) toast(`“${bumped}” went back to the brain dump.`);
}
function cycleStatus(h) {
  const order = ["planned", "done", "partial", "skipped"];
  mutateDay(S.date, d => { const b = d.boxes[h]; b.status = order[(order.indexOf(b.status || "planned") + 1) % order.length]; });
}

document.addEventListener("click", e => {
  const t = e.target.closest("[data-act]"); if (!t) return;
  const act = t.dataset.act, k = S.date;
  const ro = S.view === "day" && getDay(k).finished;
  switch (act) {
    case "journal-view": {
      if (S.mode === "setup") break;
      const onDay = S.view === "day" && !S.showSetup;
      if (onDay && !(getDay(S.date).journal || "").trim()) { S.dayMenu = false; render(); askJournal(); break; } // nothing written for this day yet
      S.view = S.view === "journal" && !S.showSetup ? "day" : "journal"; S.showSetup = false; S.placing = null; S.dayMenu = false; render(); window.scrollTo(0, 0); break; }
    case "journal-edit": openJournal(t.dataset.k); break;
    case "journal-open": S.date = t.dataset.k; S.view = "day"; render(); window.scrollTo(0, 0); break;
    case "view": S.view = t.dataset.v; S.placing = null; if (S.mode !== "setup") S.showSetup = false; render(); break;
    case "nav": S.placing = null;
      if (S.view === "day") S.date = addDays(S.date, +t.dataset.d);
      else { const d = parseKey(S.date); d.setDate(1); d.setMonth(d.getMonth() + +t.dataset.d); S.date = keyOf(d); }
      render(); break;
    case "today": S.date = todayKey(); S.placing = null; render(); break;
    case "open-day": S.date = t.dataset.k; S.view = "day"; render(); window.scrollTo(0, 0); break;
    case "prio-done": mutateDay(k, d => { d.prio[+t.dataset.i].done = t.checked; }); break;
    case "pick": {
      const src = t.dataset.from === "prio" ? { from: "prio", i: +t.dataset.i } : { from: t.dataset.from, id: t.dataset.id };
      const same = S.placing && S.placing.from === src.from && (S.placing.i === src.i && S.placing.id === src.id);
      S.placing = same ? null : Object.assign(src, { text: srcText(src) });
      render();
      if (S.placing && window.matchMedia("(max-width: 820px)").matches) $("#hours")?.scrollIntoView({ behavior: "smooth", block: "start" });
      break; }
    case "cancel-place": S.placing = null; render(); break;
    case "cycle": e.stopPropagation(); if (ro) { toast("This day is finished. Reopen it to make changes."); break; } cycleStatus(t.dataset.h); break;
    case "split": if (ro) { toast("This day is finished. Reopen it to make changes."); break; } setSplit(+t.dataset.h); break;
    case "box": {
      const h = t.dataset.h;
      if (S.placing) { place(S.placing, h); break; }
      if (ro) { if (getDay(k).boxes[h]) toast("This day is finished. Reopen it to make changes."); break; }
      openBoxEditor(h); break; }
    case "del-item": {
      if (t.dataset.from === "dump") mutateDay(k, d => { d.dump = d.dump.filter(x => x.id !== t.dataset.id); });
      else mutatePark(p => { p.items = p.items.filter(x => x.id !== t.dataset.id); });
      if (S.placing && S.placing.id === t.dataset.id) S.placing = null; break; }
    case "to-park": {
      const it = getDay(k).dump.find(x => x.id === t.dataset.id); if (!it) break;
      mutateDay(k, d => { d.dump = d.dump.filter(x => x.id !== it.id); }, { silent: true });
      mutatePark(p => { p.items.push({ id: rid(), text: it.text }); }); toast("Moved to the parking lot."); break; }
    case "to-dump": {
      if (getDay(k).finished) { toast("This day is finished. Reopen it to make changes."); break; }
      const it = getPark().items.find(x => x.id === t.dataset.id); if (!it) break;
      mutatePark(p => { p.items = p.items.filter(x => x.id !== it.id); }, { silent: true });
      mutateDay(k, d => { d.dump.push({ id: rid(), text: it.text }); }); toast("Added to this day’s brain dump."); break; }
    case "ext": {
      const d0 = getDay(k); const filled = Object.keys(d0.boxes).map(hourOfKey);
      const s = Math.min(d0.start, ...filled), en = Math.max(d0.end, ...filled.map(n => n + 1));
      mutateDay(k, d => {
        if (t.dataset.w === "up") d.start = Math.max(0, s - 1);
        if (t.dataset.w === "down") d.end = Math.min(24, en + 1);
        if (t.dataset.w === "up-hide") d.start = s + 1;
        if (t.dataset.w === "down-hide") d.end = en - 1;
      }); break; }
    case "day-menu": e.stopPropagation(); S.dayMenu = !S.dayMenu; render(); if (S.dayMenu) $("#daymenu .mi")?.focus(); break;
    case "finish": S.dayMenu = false; render(); openFinish(); break;
    case "journal": S.dayMenu = false; render(); openJournal(); break;
    case "clear-day": S.dayMenu = false; render(); openClearDay(); break;
    case "undo-clear": if (S.undoClear && S.undoClear.k) { const u = S.undoClear; S.undoClear = null; mutate(dayId(u.k), getDay(u.k), d => { Object.keys(d).forEach(x => delete d[x]); Object.assign(d, u.doc); }); $("#toast").hidden = true; toast("Day restored."); } break;
    case "edit-reflection": S.dayMenu = false; render(); openFinish(true); break;
    case "cal-sync": calSync(); break;
    case "add-routine": { S.dayMenu = false;
      let res; mutateDay(k, d => { res = applyRoutine(d, k); });
      toast(res.added.length ? `Added ${res.added.join(", ")}.${res.skipped.length ? ` Skipped ${res.skipped.join(", ")} (time already taken).` : ""}` : `Nothing added. ${res.skipped.join(", ")} overlap boxes you already have.`);
      break; }
    case "rt-add": mutate("routine", getRoutine(), r => { const last = r.items.reduce((m, it) => Math.max(m, it.start + it.len), 360); r.items.push({ id: "r-" + rid(), start: Math.min(last, 1425), len: 60, text: "", tag: "", flex: false, days: [0, 1, 2, 3, 4, 5, 6] }); }); break;
    case "rt-del": mutate("routine", getRoutine(), r => { r.items = r.items.filter(it => it.id !== t.dataset.id); }); break;
    case "rt-day": mutate("routine", getRoutine(), r => { const it = r.items.find(x => x.id === t.dataset.id); const d0 = +t.dataset.d; const days = new Set(it.days || [0,1,2,3,4,5,6]); days.has(d0) ? days.delete(d0) : days.add(d0); it.days = [...days].sort(); }); break;
    case "look": e.preventDefault(); if (S.mode === "setup") break; S.showSetup = !(S.showSetup && S.setupView === "look"); S.setupView = "look"; S.placing = null; render(); window.scrollTo(0, 0); break;
    case "style": setStyle(t.dataset.v); render(); break;
    case "settings": e.preventDefault(); S.setupView = "settings"; S.showSetup = true; S.placing = null; render(); window.scrollTo(0, 0); break;
    case "setup-back": S.showSetup = false; render(); break;
    case "use-local": lsSet(CFG_KEY, Object.assign({}, lsGet(CFG_KEY), { mode: "local" })); Store.startLocal(); break;
    case "to-login": { const c = lsGet(CFG_KEY) || {}; delete c.mode; lsSet(CFG_KEY, Object.keys(c).length ? c : null); location.reload(); break; }
    case "google": googleSignIn(); break;
    case "logout": logout(); break;
    case "appearance": setAppearance(t.dataset.v); syncThemeColor(); render(); break;
    case "zen": S.dayMenu = false; S.placing = null; render(); openZen(); break;
    case "zen-exit": closeZen(); break;
    case "quote-on": setQuotesOn(true); break;
    case "quote-off": setQuotesOn(false); break;
    case "notify-on": Notify.enable(); break;
    case "notify-off": Notify.disable(); break;
    case "notify-test": { const d = getDay(todayKey()), nk = Notify.nextBoxAfter(d, new Date().getHours() * 60 + new Date().getMinutes());
      Notify.show("Hourbox notifications work", nk ? `Next up: ${d.boxes[nk].text} at ${timeLabel(minOfKey(nk))}.` : "You’ll hear from Hourbox when a box ends.", { tag: "hourbox-test" }); toast("Test sent."); break; }
    case "reopen": S.dayMenu = false; mutateDay(k, d => { d.finished = false; }); toast("Day reopened. Finish it again when you’re done."); break;
  }
});
document.addEventListener("click", e => { if (S.dayMenu && !e.target.closest(".daymenu-wrap")) { S.dayMenu = false; render(); } }, true);
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && S.dayMenu) { S.dayMenu = false; render(); $("#daymenu-btn")?.focus(); return; }
  if ((e.key === "Enter" || e.key === " ") && e.target.matches(".box[data-act]")) { e.preventDefault(); e.target.click(); }
  if (e.key === "Escape") { // close what's on top, then go back to the day
    if (zenOpen()) closeZen();
    else if (modalOpen()) closeModal();
    else if (S.placing) { S.placing = null; render(); }
    else if (S.showSetup && S.mode !== "setup") { S.showSetup = false; render(); }
    else if ((S.view === "month" || S.view === "journal") && S.mode !== "setup") { S.view = "day"; render(); }
  }
});
document.addEventListener("submit", e => {
  const f = e.target.closest("[data-form]"); if (!f) return; e.preventDefault();
  const inp = f.querySelector("input"); const text = inp.value.trim(); if (!text) return;
  if (f.dataset.form === "dump") mutateDay(S.date, d => { d.dump.push({ id: rid(), text }); });
  else mutatePark(p => { p.items.push({ id: rid(), text }); });
  const el = document.getElementById(inp.id); if (el) { el.value = ""; el.focus(); }
});
document.addEventListener("change", e => {
  const t = e.target; if (!t.dataset.rt || t.dataset.rt === "text") return;
  mutate("routine", getRoutine(), r => { const it = r.items.find(x => x.id === t.dataset.id); if (!it) return;
    if (t.dataset.rt === "flex") it.flex = t.checked; else if (t.dataset.rt === "tag") it.tag = t.value; else it[t.dataset.rt] = +t.value; });
});
function fitGoal(ta) { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; }
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.classList && e.target.classList.contains("goal-ta")) { e.preventDefault(); document.getElementById("mg-" + (+e.target.dataset.i + 1))?.focus(); }
});
document.addEventListener("input", e => {
  const t = e.target;
  if (t.classList && t.classList.contains("goal-ta")) fitGoal(t);
  if (t.dataset.rt === "text") { mutate("routine", getRoutine(), r => { const it = r.items.find(x => x.id === t.dataset.id); if (it) it.text = t.value; }, { silent: true }); return; }
  if (t.dataset.input === "prio") {
    mutateDay(S.date, d => { d.prio[+t.dataset.i].text = t.value; Object.values(d.boxes).forEach(b => { if (b.pi === +t.dataset.i) b.text = t.value.trim() || b.text; }); }, { silent: true });
    clearTimeout(t._r); t._r = setTimeout(render, 700);
  } else if (t.dataset.input === "goal") {
    const m = S.date.slice(0, 7); mutate("month-" + m, getMonth(m), mo => { mo.goals[+t.dataset.i] = t.value; }, { silent: true });
  }
});
$("#datejump").addEventListener("change", e => { if (e.target.value) { S.date = e.target.value; S.placing = null; render(); } });

// drag & drop (desktop)
let dragSrc = null;
document.addEventListener("dragstart", e => {
  const el = e.target.closest("[data-drag]"); if (!el) return;
  dragSrc = JSON.parse(el.dataset.drag); e.dataTransfer.effectAllowed = "copyMove";
  try { e.dataTransfer.setData("text/plain", srcText(dragSrc) || ""); } catch (err) {}
});
document.addEventListener("dragend", () => { dragSrc = null; document.querySelectorAll(".drop").forEach(x => x.classList.remove("drop", "copying")); });
document.addEventListener("dragover", e => {
  const c = e.target.closest("[data-drop]"); if (!c || !dragSrc) return; e.preventDefault();
  const copy = e.altKey || e.shiftKey; // hold Option or Shift to copy instead of move
  e.dataTransfer.dropEffect = copy ? "copy" : "move";
  document.querySelectorAll(".drop").forEach(x => x !== c.firstElementChild && x.classList.remove("drop", "copying"));
  c.firstElementChild.classList.add("drop"); c.firstElementChild.classList.toggle("copying", copy);
});
document.addEventListener("drop", e => {
  const c = e.target.closest("[data-drop]"); if (!c || !dragSrc) return; e.preventDefault();
  const src = dragSrc; dragSrc = null; place(src, c.dataset.drop, e.altKey || e.shiftKey || e.dataTransfer.dropEffect === "copy");
});


export { srcText, place, cycleStatus, fitGoal, dragSrc };
