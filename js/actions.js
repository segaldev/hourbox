import { closeZen, openZen, zenOpen } from "./zen.js";
import { setQuotesOn } from "./quotes.js";
import { calSync } from "./calendar.js";
import { PX, STEP, fits, snap, snapDown } from "./boxes.js";
import { moveToDay, moveToList, srcLen, srcText } from "./move.js";
import { askJournal, closeModal, modalOpen, openBoxEditor, openClearDay, openFinish, openJournal } from "./modals.js";
import { Notify } from "./notify.js";
import { render } from "./render.js";
import { googleSignIn, logout, setAppearance, setStyle, syncThemeColor } from "./settings.js";
import { S, applyRoutine, dayId, getDay, getMonth, getPark, getRoutine, mutate, mutateDay, mutatePark } from "./state.js";
import { CFG_KEY, Store, lsGet, lsSet } from "./store.js";
import { toast } from "./ui.js";
import { $, addDays, keyAt, keyId, keyOf, lenOfKey, minOfKey, parseKey, rid, timeLabel, todayKey } from "./util.js";

// ---------- actions ----------
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
    case "item-done": {
      const done = t.checked, id = t.dataset.id;
      if (t.dataset.from === "dump") mutateDay(k, d => { const it = d.dump.find(x => x.id === id); if (it) it.done = done; });
      else mutatePark(p => { const it = p.items.find(x => x.id === id); if (it) it.done = done; });
      break; }
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
    case "box-new": { // a free cell (a free hour, or the free part of one): the box starts at its start
      if (ro) break;
      const start = +t.dataset.start;
      if (S.placing) { moveToDay(S.placing, start); break; }
      openBoxEditor(null, start); break; }
    case "box": {
      const h = t.dataset.h;
      if (Date.now() - resizedAt < 400) break; // the click that ends a resize
      if (S.placing) { toast("That time is taken. Tap a free spot."); break; }
      if (ro) { if (getDay(k).boxes[h]) toast("This day is finished. Reopen it to make changes."); break; }
      openBoxEditor(h); break; }
    case "del-item": {
      if (t.dataset.from === "dump") mutateDay(k, d => { d.dump = d.dump.filter(x => x.id !== t.dataset.id); });
      else mutatePark(p => { p.items = p.items.filter(x => x.id !== t.dataset.id); });
      if (S.placing && S.placing.id === t.dataset.id) S.placing = null; break; }
    case "to-park": moveToList({ from: "dump", id: t.dataset.id }, "park"); break;
    case "to-dump": moveToList({ from: "park", id: t.dataset.id }, "dump"); break;
    case "ext": {
      const d0 = getDay(k), ks = Object.keys(d0.boxes);
      const s = Math.min(d0.start, ...ks.map(x => Math.floor(minOfKey(x) / 60))), en = Math.max(d0.end, ...ks.map(x => Math.ceil((minOfKey(x) + lenOfKey(d0, x)) / 60)));
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
    case "cal-sync": if (t.closest("#daymenu")) { S.dayMenu = false; render(); } calSync(); break;
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
  if ((e.key === "Enter" || e.key === " ") && e.target.matches(".box[data-act], .free[data-act]")) { e.preventDefault(); e.target.click(); }
  if ((e.key === "ArrowUp" || e.key === "ArrowDown") && e.target.matches(".box.filled[data-h]") && !modalOpen()) { // move by 10 minutes; Shift: change length
    e.preventDefault();
    const key = e.target.dataset.h, d = getDay(S.date); if (d.finished || !d.boxes[key]) return;
    const dir = e.key === "ArrowUp" ? -STEP : STEP, s0 = minOfKey(key), len = lenOfKey(d, key);
    const ns = e.shiftKey ? s0 : s0 + dir, nl = e.shiftKey ? len + dir : len;
    if (!fits(d, ns, nl, key)) return;
    mutateDay(S.date, dd => { const b = dd.boxes[key]; delete dd.boxes[key]; dd.boxes[keyAt(ns)] = Object.assign(b, { len: nl }); dd.start = Math.min(dd.start, Math.floor(ns / 60)); dd.end = Math.max(dd.end, Math.ceil((ns + nl) / 60)); });
    document.getElementById("box-" + keyId(keyAt(ns)))?.focus();
  }
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

// drag & drop (desktop): anything can go onto the day, into the brain dump or into the parking lot
let drag = null; // { src, grab: minutes between the box top and the pointer, len }
let resizedAt = 0;
const clearDrop = () => { $("#ghost")?.remove(); document.querySelectorAll(".dropping").forEach(x => x.classList.remove("dropping")); };
document.addEventListener("dragstart", e => {
  if (e.target.closest && e.target.closest("[data-rsz]")) { e.preventDefault(); return; }
  const el = e.target.closest("[data-drag]"); if (!el) return;
  const src = JSON.parse(el.dataset.drag);
  const grab = src.from === "box" ? snapDown((e.clientY - el.getBoundingClientRect().top) / PX) : 0;
  drag = { src, grab, len: srcLen(src).len };
  e.dataTransfer.effectAllowed = "copyMove";
  try { e.dataTransfer.setData("text/plain", srcText(src) || ""); } catch (err) {}
});
document.addEventListener("dragend", () => { drag = null; clearDrop(); });
const dropStart = (tr, e) => Math.max(0, snap(+tr.dataset.t0 + (e.clientY - tr.getBoundingClientRect().top) / PX - drag.grab));
document.addEventListener("dragover", e => {
  if (!drag) return;
  const tr = e.target.closest("#track"), zone = e.target.closest("[data-dropzone]");
  if (!tr && !zone) { clearDrop(); return; }
  e.preventDefault();
  const copy = (e.altKey || e.shiftKey) && drag.src.from === "box"; // hold Option or Shift to copy a box instead of moving it
  e.dataTransfer.dropEffect = copy ? "copy" : "move";
  if (zone) { $("#ghost")?.remove(); if (!zone.classList.contains("dropping")) { clearDrop(); zone.classList.add("dropping"); } return; }
  document.querySelectorAll(".dropping").forEach(x => x.classList.remove("dropping"));
  const start = dropStart(tr, e), t0 = +tr.dataset.t0;
  let g = $("#ghost"); if (!g) { g = document.createElement("div"); g.id = "ghost"; g.className = "dropghost"; tr.appendChild(g); }
  g.style.top = ((start - t0) * PX) + "px"; g.style.height = (drag.len * PX - 2) + "px";
  g.textContent = `${copy ? "Copy to " : ""}${timeLabel(start)} – ${timeLabel(start + drag.len)}`;
});
document.addEventListener("drop", e => {
  if (!drag) return;
  const tr = e.target.closest("#track"), zone = e.target.closest("[data-dropzone]");
  if (!tr && !zone) return;
  e.preventDefault();
  const { src } = drag, copy = e.altKey || e.shiftKey || e.dataTransfer.dropEffect === "copy";
  const start = tr ? dropStart(tr, e) : 0;
  drag = null; clearDrop();
  const to = zone && zone.dataset.dropzone;
  setTimeout(() => { if (tr) moveToDay(src, start, copy); else moveToList(src, to); }, 0); // after the browser has finished the drag
});

// resize: drag a box's bottom edge, in 10-minute steps, up to the next box
document.addEventListener("pointerdown", e => {
  const h = e.target.closest("[data-rsz]"); if (!h) return;
  e.preventDefault(); e.stopPropagation();
  const key = h.dataset.rsz, el = h.closest(".box"), d = getDay(S.date); if (!d.boxes[key] || d.finished) return;
  const s0 = minOfKey(key), len0 = lenOfKey(d, key), y0 = e.clientY;
  let max = len0; while (fits(d, s0, max + STEP, key)) max += STEP;
  let len = len0;
  const tip = document.createElement("div"); tip.className = "rsz-tip"; el.appendChild(tip); el.classList.add("resizing");
  const show = () => { el.style.height = (len * PX - 2) + "px"; tip.textContent = `${timeLabel(s0)} – ${timeLabel(s0 + len)} · ${len < 60 ? len + " min" : (len % 60 ? `${Math.floor(len / 60)}h ${len % 60}m` : len / 60 + "h")}`; };
  show();
  try { h.setPointerCapture(e.pointerId); } catch (err) {}
  const move = ev => { len = Math.max(STEP, Math.min(max, snap(len0 + (ev.clientY - y0) / PX))); show(); };
  const up = () => {
    h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up);
    resizedAt = Date.now();
    if (len !== len0) mutateDay(S.date, dd => { if (dd.boxes[key]) { dd.boxes[key].len = len; dd.end = Math.max(dd.end, Math.ceil((s0 + len) / 60)); } });
    else { tip.remove(); el.classList.remove("resizing"); }
  };
  h.addEventListener("pointermove", move); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
});


export { cycleStatus, fitGoal };
