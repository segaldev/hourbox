import { summarize } from "./day.js";
import { render } from "./render.js";
import { STEP, boxToItem, fits, overlaps, putBox, roomAt } from "./boxes.js";
import { S, blankDay, getDay, mutateDay, mutatePark } from "./state.js";
import { toast } from "./ui.js";
import { $, ICON, TAGS, addDays, clone, esc, fmtDur, lenOfKey, minOfKey, parseKey, rid, sortedKeys, timeLabel, todayKey } from "./util.js";

// ---------- modals ----------
const modalOpen = () => !!$("#modal-root").firstChild;
function closeModal() { $("#modal-root").innerHTML = ""; render(); }
function openModal(html, onClick) {
  const root = $("#modal-root");
  root.innerHTML = `<div class="overlay" id="overlay"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  const ov = $("#overlay");
  ov.addEventListener("click", e => { if (e.target === ov) closeModal(); const b = e.target.closest("[data-m]"); if (b) onClick(b, e); });
  return ov;
}

const LEN_CHIPS = [10, 20, 30, 45, 60, 90, 120];
// Edit a box (h = its key), or make a new one starting at minute `newStart`.
function openBoxEditor(h, newStart) {
  const k = S.date, d = getDay(k), isNew = h == null || !d.boxes[h], skip = isNew ? null : h;
  const b = isNew ? { text: "", tag: "", status: "planned" } : clone(d.boxes[h]);
  let start = isNew ? newStart : minOfKey(h);
  let len = isNew ? Math.max(STEP, Math.min(60, roomAt(d, start))) : lenOfKey(d, h);
  const tagChips = () => TAGS.map(([v, n]) => `<button class="chip tag-chip ${v ? "tg-" + v : ""}" data-m="tag" data-v="${v}" aria-pressed="${(b.tag || "") === v}">${n}</button>`).join("");
  const stChips = () => [["planned", "Planned"], ["done", "Done"], ["partial", "Partly done"], ["skipped", "Skipped"]].map(([v, n]) => `<button class="chip s-${v}" data-m="st" data-v="${v}" aria-pressed="${(b.status || "planned") === v}">${n}</button>`).join("");
  const timeHTML = () => {
    const ok = fits(d, start, len, skip), clash = ok ? null : overlaps(d, start, len, skip)[0];
    let room = 0; while (fits(d, start, room + STEP, skip)) room += STEP;
    const lens = LEN_CHIPS.includes(len) ? LEN_CHIPS : LEN_CHIPS.concat(len).sort((x, y) => x - y);
    return `<div class="field"><span class="lbl">Starts</span><div class="stepper">
        <button class="btn" data-m="s-" id="be-s-" aria-label="10 minutes earlier">−10</button><span class="val" id="be-start">${timeLabel(start)}</span><button class="btn" data-m="s+" id="be-s+" aria-label="10 minutes later">+10</button></div></div>
      <div class="field"><span class="lbl">Length</span><div class="chips" id="be-lens">${lens.map(n => `<button class="chip" data-m="len" data-v="${n}" aria-pressed="${n === len}">${fmtDur(n)}</button>`).join("")}</div>
        <div class="stepper"><button class="btn" data-m="e-" id="be-e-" aria-label="End 10 minutes earlier">−10</button><span class="val small" id="be-end">ends ${timeLabel(start + len)}</span><button class="btn" data-m="e+" id="be-e+" aria-label="End 10 minutes later">+10</button></div>
        <p class="hint ${ok ? "" : "err"}" id="be-room">${ok ? (start + room < 1440 ? `The next box starts at ${timeLabel(start + room)}, so this one can be up to ${fmtDur(room)}.` : "")
          : clash ? `This overlaps “${esc(d.boxes[clash].text)}” (${timeLabel(minOfKey(clash))}). Change the start or length.` : "That’s past midnight."}</p></div>`;
  };
  const head = () => `${timeLabel(start)} – ${timeLabel(start + len)}`;
  const ov = openModal(`
    <header><span class="eyebrow" id="be-range">${head()}</span><h3>${isNew ? "Box this time" : "Edit this box"}</h3></header>
    <div class="body">
      <div class="field"><label for="be-text">What will you do?</label><input type="text" id="be-text" value="${esc(b.text)}" maxlength="140" placeholder="One focused activity"></div>
      <div id="be-time">${timeHTML()}</div>
      <div class="field"><span class="lbl">Tag</span><div class="chips" id="be-tags">${tagChips()}</div></div>
      ${b.cal ? `<p class="hint calnote">${ICON.cal}<span>From Google Calendar${b.cal.time ? ` (${esc(b.cal.time)})` : ""}. Syncing the calendar again updates this box.${b.cal.link ? ` <a href="${esc(b.cal.link)}" target="_blank" rel="noopener">Open in Google Calendar</a>` : ""}</span></p>` : ""}
      <label class="flexchk" for="be-flex"><input type="checkbox" class="check" id="be-flex" ${b.flex ? "checked" : ""}> Flexible: if I drop something here, move this to the nearest free time</label>
      ${isNew ? "" : `<div class="field"><span class="lbl">Status</span><div class="chips" id="be-st">${stChips()}</div></div>`}
    </div>
    <footer>
      ${isNew ? "" : `<div class="left">
        <button class="btn ghost" data-m="move" id="be-move">Move…</button>
        <button class="btn ghost" data-m="dup" id="be-dup" title="Tip: on a Mac, hold Option or Shift while dragging a box to copy it">Duplicate…</button>
        <button class="btn ghost" data-m="unbox" id="be-unbox">${b.rt ? "Remove for today" : "To brain dump"}</button>
        ${b.rt ? "" : `<button class="btn ghost" data-m="park" id="be-park">To parking lot</button>`}
        <button class="btn ghost" data-m="clear" id="be-clear">Delete</button></div>`}
      <button class="btn" data-m="cancel" id="be-cancel">Cancel</button>
      <button class="btn primary" data-m="save" id="be-save">Save</button>
    </footer>`, (btn) => {
      const m = btn.dataset.m;
      b.text = $("#be-text").value; b.flex = $("#be-flex").checked;
      const time = () => { $("#be-time").innerHTML = timeHTML(); $("#be-range").textContent = head(); };
      if (m === "s-" && start - STEP >= 0) { start -= STEP; time(); }
      if (m === "s+" && start + len + STEP <= 1440) { start += STEP; time(); }
      if (m === "e-" && len > STEP) { len -= STEP; time(); }
      if (m === "e+" && start + len + STEP <= 1440) { len += STEP; time(); }
      if (m === "len") { len = +btn.dataset.v; if (start + len > 1440) len = 1440 - start; time(); }
      if (m === "tag") { b.tag = btn.dataset.v; $("#be-tags").innerHTML = tagChips(); }
      if (m === "st") { b.status = btn.dataset.v; $("#be-st").innerHTML = stChips(); }
      if (m === "cancel") closeModal();
      if (m === "save") {
        const text = b.text.trim(); if (!text) { $("#be-text").focus(); toast("Type what you’ll do in this time."); return; }
        if (!fits(d, start, len, skip)) { toast("This time overlaps another box. Change the start or length."); return; }
        mutateDay(k, dd => { if (skip) delete dd.boxes[skip]; putBox(dd, start, Object.assign({}, b, { text, len })); }, { silent: true }); closeModal();
      }
      if (m === "move") { $("#modal-root").innerHTML = ""; S.placing = { from: "box", h, text: d.boxes[h].text }; render(); }
      if (m === "dup") { $("#modal-root").innerHTML = ""; S.placing = { from: "box", h, text: d.boxes[h].text, copy: true }; render(); }
      if (m === "unbox") { mutateDay(k, dd => { const x = dd.boxes[h]; delete dd.boxes[h]; if (x.pi == null && !x.rt) dd.dump.push(boxToItem(x, rid())); }, { silent: true }); closeModal(); }
      if (m === "park") { const x = d.boxes[h]; mutateDay(k, dd => { delete dd.boxes[h]; }, { silent: true }); mutatePark(p => { p.items.push(boxToItem(x, rid(), true)); }, { silent: true }); closeModal(); toast("Moved to the parking lot."); }
      if (m === "clear") { mutateDay(k, dd => { delete dd.boxes[h]; }, { silent: true }); closeModal(); toast("Box deleted.", { label: "Undo", act: "undo" }); }
    });
  const inp = $("#be-text"); inp.focus(); inp.select();
  inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); ov.querySelector("#be-save").click(); } });
}

function askJournal() {
  const k = S.date, d = parseKey(k), name = k === todayKey() ? "today" : d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  openModal(`
    <header><span class="eyebrow">Journal</span><h3>Write for ${esc(name)}?</h3></header>
    <div class="body"><p style="margin:0 0 10px">There’s no journal entry for ${esc(name)} yet.</p></div>
    <footer><button class="btn" data-m="all" id="aj-all">See all entries</button><button class="btn primary" data-m="write" id="aj-write">Write for ${esc(name)}</button></footer>`, btn => {
      if (btn.dataset.m === "write") { closeModal(); openJournal(k); }
      if (btn.dataset.m === "all") { $("#modal-root").innerHTML = ""; S.view = "journal"; render(); window.scrollTo(0, 0); }
    });
  $("#aj-write").focus();
}
function renderJournalList() {
  const entries = Object.keys(S.docs).filter(id => id.startsWith("day-") && (S.docs[id].journal || "").trim())
    .map(id => id.slice(4)).sort().reverse();
  const body = entries.length ? entries.map(k => {
    const d = parseKey(k), text = S.docs["day-" + k].journal.trim();
    return `<article class="jentry">
      <header><h2>${d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined })}</h2>
        <span class="jlinks"><button class="linkbtn" type="button" data-act="journal-edit" data-k="${k}" id="je-${k}">Edit</button><button class="linkbtn" type="button" data-act="journal-open" data-k="${k}" id="jo-${k}">Open day</button></span></header>
      <p>${esc(text)}</p></article>`; }).join("")
    : `<p class="hint jempty">No journal entries yet. To write one, open a day and choose <b>Day options → Journal</b>.</p>`;
  return `<section class="journal-list"><h1>Journal</h1>${body}</section>`;
}
function openJournal(k = S.date) {
  const d = getDay(k);
  let timer = null;
  const save = () => { const v = $("#jr-text") ? $("#jr-text").value : null; if (v == null) return; mutateDay(k, dd => { dd.journal = v; }, { silent: true, noUndo: true }); };
  const ov = openModal(`
    <header><span class="eyebrow">${parseKey(k).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</span><h3>Journal</h3></header>
    <div class="body">
      <textarea id="jr-text" class="journal" rows="14" placeholder="What’s on your mind today?" aria-label="Journal for this day">${esc(d.journal || "")}</textarea>
      <p class="hint" id="jr-state">${(d.journal || "").trim() ? "Saved." : "Saved as you type."}</p>
    </div>
    <footer><button class="btn primary" data-m="done" id="jr-done">Done</button></footer>`, btn => { if (btn.dataset.m === "done") { clearTimeout(timer); save(); closeModal(); } });
  ov.addEventListener("input", e => {
    if (e.target.id !== "jr-text") return;
    $("#jr-state").textContent = "Saving…"; clearTimeout(timer);
    timer = setTimeout(() => { save(); const st = $("#jr-state"); if (st) st.textContent = "Saved."; }, 600);
  });
  const ta = $("#jr-text"); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
}
function openClearDay() {
  const k = S.date, label = parseKey(k).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  openModal(`
    <header><span class="eyebrow">${label}</span><h3>Clear this day?</h3></header>
    <div class="body"><p style="margin:0 0 10px">This deletes everything on this day: boxes, top priorities, brain dump, journal and reflection. Your parking lot, routine and other days aren’t affected.</p></div>
    <footer><button class="btn" data-m="cancel" id="cd-cancel">Cancel</button><button class="btn danger" data-m="clear" id="cd-clear">Clear day</button></footer>`, btn => {
      if (btn.dataset.m === "cancel") { closeModal(); return; }
      if (btn.dataset.m !== "clear") return;
      mutateDay(k, d => { const b = blankDay(k); Object.keys(d).forEach(x => delete d[x]); Object.assign(d, b, { rtApplied: true }); }, { silent: true });
      closeModal();
      toast("Day cleared.", { label: "Undo", act: "undo" });
    });
}
function openFinish(editOnly) { // editOnly: change the reflection of a finished day without touching leftovers
  const k = S.date, d = getDay(k), tomorrow = addDays(k, 1);
  const st = {}; Object.entries(d.boxes).forEach(([h, b]) => st[h] = b.status || "planned");
  const dest = {}; const refl = Object.assign({ well: "", blocked: "", change: "", energy: 0 }, d.reflection || {});
  const hrs = sortedKeys(d);
  const leftovers = () => {
    const L = [];
    d.prio.forEach((p, i) => { if (p.text.trim() && !p.done) L.push({ key: "p" + i, text: p.text.trim(), kind: "Priority", def: "tomorrow" }); });
    hrs.forEach(h => { if ((st[h] === "skipped" || st[h] === "partial") && d.boxes[h].pi == null) L.push({ key: "b" + h, text: d.boxes[h].text, kind: st[h] === "skipped" ? "Skipped hour" : "Partly done", def: "tomorrow" }); });
    d.dump.forEach(it => L.push({ key: "d" + it.id, text: it.text, kind: "Brain dump", def: "drop" }));
    const seen = new Set(); return L.filter(x => { const s = x.text.toLowerCase(); if (seen.has(s)) return false; seen.add(s); return true; });
  };
  const revHTML = () => hrs.length ? hrs.map(h => `<div class="rev-row"><span class="t">${timeLabel(minOfKey(h))}</span><span class="x">${esc(d.boxes[h].text)}</span>
      <div class="chips">${[["done", "Done"], ["partial", "Partly"], ["skipped", "Skipped"]].map(([v, n]) => `<button class="chip s-${v}" data-m="st" data-h="${h}" data-v="${v}" aria-pressed="${st[h] === v}">${n}</button>`).join("")}</div></div>`).join("")
    : `<p class="hint">No hours were boxed today.</p>`;
  const leftHTML = () => { const L = leftovers(); return L.length ? L.map(x => { const v = dest[x.key] || x.def; return `<div class="rev-row"><span class="t">${esc({ "Priority": "Priority", "Skipped hour": "Box", "Partly done": "Box", "Brain dump": "Dump" }[x.kind])}</span><span class="x">${esc(x.text)}</span>
      <div class="chips">${[["tomorrow", "Tomorrow"], ["park", "Parking lot"], ["drop", "Let go"]].map(([dv, n]) => `<button class="chip" data-m="dest" data-k="${esc(x.key)}" data-v="${dv}" aria-pressed="${v === dv}">${n}</button>`).join("")}</div></div>`; }).join("")
    : `<p class="hint">Nothing left over. Nice.</p>`; };
  const energyHTML = () => [1, 2, 3, 4, 5].map(n => `<button class="chip" data-m="energy" data-v="${n}" aria-pressed="${refl.energy === n}">${n}</button>`).join("");
  openModal(`
    <header><span class="eyebrow">${parseKey(k).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}</span><h3>${editOnly ? "Edit your reflection" : d.finishedAt ? "Finish the day again" : "Finish the day"}</h3></header>
    <div class="body">
      <div><p class="sect-title">How did each hour go?</p><div class="rev" id="fd-rev">${revHTML()}</div></div>
      ${editOnly ? "" : `<div><p class="sect-title">Leftovers</p><p class="hint" style="margin:0 0 4px">“Tomorrow” adds unfinished priorities to tomorrow’s priorities and everything else to tomorrow’s brain dump.${d.finishedAt ? " Anything already sent there won’t be added twice." : ""}</p><div class="rev" id="fd-left">${leftHTML()}</div></div>`}
      <div><p class="sect-title">Reflection <span class="hint">(optional)</span></p>
        <div class="body" style="padding:0;gap:10px">
          <div class="field"><label for="fd-well">What went well?</label><textarea id="fd-well" rows="2">${esc(refl.well)}</textarea></div>
          <div class="field"><label for="fd-blocked">What got in the way?</label><textarea id="fd-blocked" rows="2">${esc(refl.blocked)}</textarea></div>
          <div class="field"><label for="fd-change">One thing to change tomorrow</label><textarea id="fd-change" rows="2">${esc(refl.change)}</textarea></div>
          <div class="field"><span class="lbl">Energy</span><div class="chips energy" id="fd-energy">${energyHTML()}</div></div>
        </div></div>
    </div>
    <footer><button class="btn" data-m="cancel" id="fd-cancel">Not yet</button><button class="btn primary" data-m="done" id="fd-done">${editOnly ? "Save" : "Finish day"}</button></footer>`,
    (btn) => {
      const m = btn.dataset.m;
      if (m === "st") { st[btn.dataset.h] = btn.dataset.v; $("#fd-rev").innerHTML = revHTML(); const fl = $("#fd-left"); if (fl) fl.innerHTML = leftHTML(); }
      if (m === "dest") { dest[btn.dataset.k] = btn.dataset.v; const fl = $("#fd-left"); if (fl) fl.innerHTML = leftHTML(); }
      if (m === "energy") { refl.energy = refl.energy === +btn.dataset.v ? 0 : +btn.dataset.v; $("#fd-energy").innerHTML = energyHTML(); }
      if (m === "cancel") closeModal();
      if (m === "done") {
        refl.well = $("#fd-well").value.trim(); refl.blocked = $("#fd-blocked").value.trim(); refl.change = $("#fd-change").value.trim();
        const L = editOnly ? [] : leftovers(); const toTom = { prio: [], dump: [] }, toPark = [];
        L.forEach(x => { const v = dest[x.key] || x.def; if (v === "tomorrow") (x.kind === "Priority" ? toTom.prio : toTom.dump).push(x.text); else if (v === "park") toPark.push(x.text); });
        mutateDay(k, dd => { Object.entries(st).forEach(([h, s]) => { if (dd.boxes[h]) dd.boxes[h].status = s; }); if (!editOnly) { dd.finished = true; dd.finishedAt = new Date().toISOString(); } dd.reflection = refl; dd.summary = summarize(dd); }, { silent: true });
        if (toTom.prio.length || toTom.dump.length) mutateDay(tomorrow, td => {
          const has = text => td.prio.some(p => p.text.trim() === text) || td.dump.some(x => x.text === text);
          toTom.prio.forEach(text => { if (has(text)) return; const slot = td.prio.findIndex(p => !p.text.trim()); if (slot >= 0) td.prio[slot] = { text, done: false }; else td.dump.push({ id: rid(), text }); });
          toTom.dump.forEach(text => { if (!has(text)) td.dump.push({ id: rid(), text }); });
        }, { silent: true });
        if (toPark.length) mutatePark(p => { toPark.forEach(text => { if (!p.items.some(x => x.text === text)) p.items.push({ id: rid(), text }); }); }, { silent: true });
        closeModal(); window.scrollTo(0, 0);
        const moved = toTom.prio.length + toTom.dump.length;
        toast(editOnly ? "Reflection saved." : moved ? `Day finished. ${moved} item${moved > 1 ? "s" : ""} moved to tomorrow.` : "Day finished.");
      }
    });
}


export { modalOpen, closeModal, openModal, openBoxEditor, askJournal, renderJournalList, openJournal, openClearDay, openFinish };
