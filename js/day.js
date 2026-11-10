import { renderQuote } from "./quotes.js";
import { DEF_END, DEF_START, S, getDay, getPark, mutateDay, resplit, routineFor } from "./state.js";
import { toast } from "./ui.js";
import { $, ICON, TAGNAME, esc, fmtDur, hourHasBox, hourLabel, hourOfKey, lenOfKey, minOfKey, parseKey, rid, slotKeys, splitOf, timeLabel, todayKey } from "./util.js";

function summarize(d) {
  const ks = Object.keys(d.boxes), bs = ks.map(k => d.boxes[k]);
  const mins = f => ks.filter(k => f(d.boxes[k])).reduce((a, k) => a + lenOfKey(d, k), 0);
  const pr = d.prio.filter(p => p.text.trim());
  return { planned: bs.length, done: bs.filter(b => b.status === "done").length, partial: bs.filter(b => b.status === "partial").length,
    skipped: bs.filter(b => b.status === "skipped").length, plannedMin: mins(() => true), doneMin: mins(b => b.status === "done"),
    prTotal: pr.length, prDone: pr.filter(p => p.done).length };
}

function renderDay() {
  const k = S.date, d = getDay(k), ro = d.finished;
  const prioSched = [0, 1, 2].map(i => Object.keys(d.boxes).filter(key => d.boxes[key].pi === i).reduce((a, key) => a + lenOfKey(d, key), 0));
  const picked = S.placing || {};
  // Priorities
  const prio = d.prio.map((p, i) => `
    <li class="prio-row ${p.done ? "done" : ""} ${picked.from === "prio" && picked.i === i ? "picked" : ""}">
      <span class="prio-n" ${p.text.trim() && !ro ? `draggable="true" style="cursor:grab" title="Drag into an hour" data-drag='${esc(JSON.stringify({ from: "prio", i }))}'` : ""}>${i + 1}</span>
      <input type="checkbox" class="check" id="pc-${i}" data-act="prio-done" data-i="${i}" ${p.done ? "checked" : ""} ${ro ? "disabled" : ""} aria-label="Priority ${i + 1} done">
      <input type="text" id="pt-${i}" data-input="prio" data-i="${i}" value="${esc(p.text)}" placeholder="${["Most important thing today", "Second priority", "Third priority"][i]}" maxlength="140" ${ro ? "readonly" : ""}>
      ${p.text.trim() ? `<span class="badge ${prioSched[i] ? "on" : "off"}">${prioSched[i] ? fmtDur(prioSched[i]) : "unboxed"}</span>` : "<span></span>"}
      ${p.text.trim() && !ro ? `<button class="mini" data-act="pick" data-from="prio" data-i="${i}" title="Schedule into an hour" aria-label="Schedule">${ICON.clock}</button>` : "<span></span>"}
    </li>`).join("");
  // Brain dump
  const dump = d.dump.map(it => itemRow(it, "dump", ro)).join("") || `<li class="empty-note">Empty your head here. Each line becomes a card you can drop into an hour.</li>`;
  const park = getPark().items.map(it => itemRow(it, "park", false)).join("") || `<li class="empty-note">Ideas and tasks that aren’t for today. These stay here across days.</li>`;
  // Grid
  const filledH = Object.keys(d.boxes).map(hourOfKey);
  const start = Math.min(d.start, ...filledH), end = Math.max(d.end, ...filledH.map(n => n + 1));
  const nd = new Date(), nowMin = k === todayKey() ? nd.getHours() * 60 + nd.getMinutes() : null;
  let hours = "";
  for (let h = start; h < end; h++) hours += hourRow(d, h, ro, nowMin);
  const sm = summarize(d);
  const topExt = !ro ? `<div class="extend">${start > 0 ? `<button class="btn" id="ext-up" data-act="ext" data-w="up">+ Earlier hour</button>` : ""}${start < DEF_START && !hourHasBox(d, start) ? `<button class="btn ghost" id="ext-up-hide" data-act="ext" data-w="up-hide">Hide ${hourLabel(start)}</button>` : ""}</div>` : "";
  const botExt = !ro ? `<div class="extend">${end < 24 ? `<button class="btn" id="ext-down" data-act="ext" data-w="down">+ Later hour</button>` : ""}${end > DEF_END && !hourHasBox(d, end - 1) ? `<button class="btn ghost" id="ext-down-hide" data-act="ext" data-w="down-hide">Hide ${hourLabel(end - 1)}</button>` : ""}</div>` : "";
  const r = d.reflection || {};
  const hasRefl = !!(r.well || r.blocked || r.change || r.energy);
  const summary = ro || hasRefl ? `<div class="summary">
      <div class="summary-head"><span class="eyebrow">${ro ? "Day finished" : "Your reflection (day reopened)"}</span>
        <button class="btn ghost" type="button" data-act="edit-reflection" id="edit-refl">${hasRefl ? "Edit reflection" : "Add reflection"}</button></div>
      ${ro ? `<div class="stats">
        <div class="stat"><b>${fmtDur(sm.doneMin)}</b><span>done of ${fmtDur(sm.plannedMin)} boxed</span></div>
        ${sm.partial ? `<div class="stat"><b>${sm.partial}</b><span>${sm.partial > 1 ? "boxes" : "box"} partly done</span></div>` : ""}
        ${sm.skipped ? `<div class="stat"><b>${sm.skipped}</b><span>${sm.skipped > 1 ? "boxes" : "box"} skipped</span></div>` : ""}
        ${sm.prTotal ? `<div class="stat"><b>${sm.prDone}/${sm.prTotal}</b><span>priorities hit</span></div>` : ""}
        ${r.energy ? `<div class="stat"><b>${r.energy}/5</b><span>energy</span></div>` : ""}
      </div>` : r.energy ? `<div class="stats"><div class="stat"><b>${r.energy}/5</b><span>energy</span></div></div>` : ""}
      ${(r.well || r.blocked || r.change) ? `<div class="refl">
        ${r.well ? `<div><span class="eyebrow">Went well</span><p>${esc(r.well)}</p></div>` : ""}
        ${r.blocked ? `<div><span class="eyebrow">Got in the way</span><p>${esc(r.blocked)}</p></div>` : ""}
        ${r.change ? `<div><span class="eyebrow">Change tomorrow</span><p>${esc(r.change)}</p></div>` : ""}
      </div>` : ""}
    </div>` : "";
  const dl = parseKey(k).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  const quote = renderQuote(k);
  return `<div class="day${quote ? " has-quote" : ""}">${quote}
    <section class="pane a-prio"><div class="pane-head"><h2>Top 3 priorities</h2><span class="hint">Box them first</span></div><ol class="prio-list">${prio}</ol></section>
    <section class="pane a-dump"><div class="pane-head"><h2>Brain dump${countBadge(d.dump)}</h2><span class="hint">This day only</span></div>
      ${ro ? "" : `<form class="add" data-form="dump"><input type="text" id="add-dump" placeholder="Add a thought or task, then Enter" maxlength="200" autocomplete="off"><button class="btn" type="submit">Add</button></form>`}
      <ul class="items">${dump}</ul></section>
    <section class="pane a-park"><div class="pane-head"><h2>Parking lot${countBadge(getPark().items)}</h2><span class="hint">Kept across days</span></div>
      <form class="add" data-form="park"><input type="text" id="add-park" placeholder="Not today, but don’t lose it" maxlength="200" autocomplete="off"><button class="btn" type="submit">Add</button></form>
      <ul class="items">${park}</ul></section>
    <section class="a-grid ${ro ? "readonly" : ""}">
      <div class="gridhead"><div><h2>${esc(dl)}</h2><div class="meta">${sm.plannedMin ? fmtDur(sm.plannedMin) : "0h"} of ${end - start}h boxed${sm.doneMin ? ` · ${fmtDur(sm.doneMin)} done` : ""}${ro ? " · Finished" : ""}</div></div>
        <div class="headbtns daymenu-wrap">
          <button class="btn" id="daymenu-btn" data-act="day-menu" aria-haspopup="menu" aria-expanded="${!!S.dayMenu}">${ro ? "Day finished" : "Day options"}<span class="chev" aria-hidden="true">▾</span></button>
          ${S.dayMenu ? `<div class="daymenu" role="menu" id="daymenu">
            ${ro ? `<button role="menuitem" class="mi" id="mi-reopen" data-act="reopen">Reopen day</button>
                    <button role="menuitem" class="mi" id="mi-refl" data-act="edit-reflection">${hasRefl ? "Edit reflection" : "Add reflection"}</button>`
                 : `<button role="menuitem" class="mi" id="mi-finish" data-act="finish">Finish day<span>Review hours, leftovers and reflect</span></button>`}
            <button role="menuitem" class="mi" id="mi-journal" data-act="journal">Journal${(d.journal || "").trim() ? `<span>${(d.journal.trim().split(/\s+/).length)} words written</span>` : `<span>Write your thoughts for this day</span>`}</button>
            ${!ro && !d.rtApplied && routineFor(k).some(it => !Object.values(d.boxes).some(b => b.rt === it.id)) ? `<button role="menuitem" class="mi" id="mi-routine" data-act="add-routine">Add routine</button>` : ""}
            <hr>
            <button role="menuitem" class="mi danger" id="mi-clear" data-act="clear-day">Clear day<span>Delete everything on this day</span></button>
          </div>` : ""}
        </div></div>
      ${summary}${topExt}<div class="hours" id="hours">${hours}</div>${botExt}
    </section></div>`;
}
const countBadge = items => { const n = items.filter(it => !it.done).length; return n ? ` <span class="count" title="${n} to do">${n}</span>` : ""; };
function itemRow(it, from, ro) {
  const picked = S.placing && S.placing.from === from && S.placing.id === it.id;
  const other = from === "dump" ? `<button class="mini" data-act="to-park" data-id="${it.id}" title="Move to parking lot" aria-label="Move to parking lot">${ICON.park}</button>`
    : `<button class="mini" data-act="to-dump" data-id="${it.id}" title="Bring into this day’s brain dump" aria-label="Bring into today">${ICON.today}</button>`;
  return `<li class="item ${picked ? "picked" : ""} ${it.done ? "done" : ""}" ${ro ? "" : `draggable="true" data-drag='${esc(JSON.stringify({ from, id: it.id }))}'`}>
    <input type="checkbox" class="check" data-act="item-done" data-from="${from}" data-id="${it.id}" ${it.done ? "checked" : ""} ${ro ? "disabled" : ""} aria-label="Done: ${esc(it.text)}">
    <span class="txt">${esc(it.text)}</span>
    ${ro ? "" : `<button class="mini" data-act="pick" data-from="${from}" data-id="${it.id}" title="Schedule into an hour" aria-label="Schedule">${ICON.clock}</button>${other}
    <button class="mini" data-act="del-item" data-from="${from}" data-id="${it.id}" title="Delete" aria-label="Delete">${ICON.x}</button>`}</li>`;
}
function hourRow(d, h, ro, nowMin) {
  const ks = slotKeys(d, h), n = ks.length;
  const isNowHour = nowMin != null && Math.floor(nowMin / 60) === h;
  const lbl = n === 1 ? "1h" : n === 2 ? "30m" : "15m", nxt = n === 1 ? "30-minute" : n === 2 ? "15-minute" : "one 1-hour";
  return `<div class="hour split-${n} ${isNowHour ? "now" : ""}" data-h="${h}">
    <div class="hlabel"><span>${hourLabel(h)}</span>${ro ? "" : `<button class="splitbtn ${n > 1 ? "on" : ""}" id="split-${h}" data-act="split" data-h="${h}" title="Box length. Click to split into ${nxt} boxes." aria-label="Box length ${lbl}. Change">${lbl}</button>`}</div>
    <div class="cells">${ks.map(key => slotBox(d, key, ro, n, nowMin)).join("")}</div></div>`;
}
function slotBox(d, key, ro, n, nowMin) {
  const b = d.boxes[key], id = key.replace(":", "-"), m0 = minOfKey(key);
  const sub = n > 1 ? `<span class="smin">${timeLabel(m0).replace(/\s?[AP]M$/i, "")}</span>` : "";
  const now = nowMin != null && nowMin >= m0 && nowMin < m0 + 60 / n ? " nowslot" : "";
  let inner;
  if (b) {
    const st = b.status || "planned";
    inner = `<div class="box filled st-${st}${now}${b.flex ? " flex" : ""}" role="button" tabindex="0" id="box-${id}" data-act="box" data-h="${key}" ${ro ? "" : `draggable="true" data-drag='${esc(JSON.stringify({ from: "box", h: key }))}'`}>
      ${sub}<button class="stbtn ${st}" id="st-${id}" data-act="cycle" data-h="${key}" title="Status: ${st}. Click to change." aria-label="Status ${st}">${st === "done" ? ICON.check : st === "skipped" ? ICON.x : ""}</button>
      <span class="btxt">${esc(b.text)}</span>
      ${b.pi != null ? `<span class="prio-flag" title="Top priority">P${b.pi + 1}</span>` : ""}
      ${b.cal ? `<span class="calmark" title="From Google Calendar${b.cal.time ? `: ${esc(b.cal.time)}` : ""}">${ICON.cal}${b.cal.time ? `<span>${esc(b.cal.time)}</span>` : ""}</span>` : ""}
      ${b.flex ? `<span class="flexmark" title="Flexible: drop something here and this moves to the nearest free time">flexible</span>` : ""}
      ${b.tag ? `<span class="tag tg-${b.tag}">${esc(TAGNAME[b.tag] || b.tag)}</span>` : ""}
    </div>`;
  } else {
    inner = `<div class="box empty${now}" role="button" tabindex="0" id="box-${id}" data-act="box" data-h="${key}">${sub}<span class="plus">${ro ? "" : n === 1 ? "+ Box this hour" : "+"}</span></div>`;
  }
  return `<div class="cell" data-drop="${key}">${inner}</div>`;
}
function setSplit(h) {
  const k = S.date, d0 = getDay(k), cur = splitOf(d0, h), n = cur === 1 ? 2 : cur === 2 ? 4 : 1;
  let bumped = [];
  mutateDay(k, d => {
    bumped = resplit(d, h, n).map(b => b.text);
    bumped.forEach(text => { if (!d.dump.some(x => x.text === text)) d.dump.push({ id: rid(), text }); });
  });
  if (bumped.length) toast(`Only one box fits now. “${bumped[0]}”${bumped.length > 1 ? ` and ${bumped.length - 1} more` : ""} went back to the brain dump.`);
}
function nearestFree(d, key) { // closest empty slot to `key` (ties go later), within the visible hours
  const filledH = Object.keys(d.boxes).map(hourOfKey);
  const s0 = Math.min(d.start, ...filledH), e0 = Math.max(d.end, ...filledH.map(n => n + 1)), t = minOfKey(key);
  let best = null, bd = Infinity;
  for (let h = s0; h < e0; h++) for (const k2 of slotKeys(d, h)) {
    if (k2 === String(key) || d.boxes[k2]) continue;
    const m = minOfKey(k2), dist = m >= t ? m - t : t - m + 0.5;
    if (dist < bd) { bd = dist; best = k2; }
  }
  return best;
}
function placeNowLine() {
  if (S.view !== "day" || S.date !== todayKey()) return;
  const n = new Date(); const row = document.querySelector(`.hour[data-h="${n.getHours()}"]`); if (!row) return;
  const line = document.createElement("div"); line.className = "nowline";
  line.style.top = (row.offsetTop + row.offsetHeight * n.getMinutes() / 60) + "px";
  $("#hours").appendChild(line);
}


export { summarize, renderDay, itemRow, hourRow, slotBox, setSplit, nearestFree, placeNowLine };
