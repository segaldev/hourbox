import { renderQuote } from "./quotes.js";
import { PX, itemLen } from "./boxes.js";
import { DEF_END, DEF_START, S, getDay, getPark, routineFor } from "./state.js";
import { $, ICON, TAGNAME, esc, fmtDur, hourHasBox, hourLabel, keyAt, keyId, lenOfKey, minOfKey, parseKey, sortedKeys, timeLabel, todayKey } from "./util.js";

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
  // Grid: hours from d.start to d.end, stretched to fit every box
  const keys = sortedKeys(d);
  const start = Math.min(d.start, ...keys.map(x => Math.floor(minOfKey(x) / 60)));
  const end = Math.max(d.end, ...keys.map(x => Math.ceil((minOfKey(x) + lenOfKey(d, x)) / 60)));
  const nd = new Date(), nowMin = k === todayKey() ? nd.getHours() * 60 + nd.getMinutes() : null;
  const hours = timeline(d, keys, start, end, ro, nowMin);
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
    <section class="pane a-dump" data-dropzone="dump"><div class="pane-head"><h2>Brain dump${countBadge(d.dump)}</h2><span class="hint">This day only</span></div>
      ${ro ? "" : `<form class="add" data-form="dump"><input type="text" id="add-dump" placeholder="Add a thought or task, then Enter" maxlength="200" autocomplete="off"><button class="btn" type="submit">Add</button></form>`}
      <ul class="items">${dump}</ul></section>
    <section class="pane a-park" data-dropzone="park"><div class="pane-head"><h2>Parking lot${countBadge(getPark().items)}</h2><span class="hint">Kept across days</span></div>
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
      ${summary}${topExt}${hours}${botExt}
    </section></div>`;
}
const countBadge = items => { const n = items.filter(it => !it.done).length; return n ? ` <span class="count" title="${n} to do">${n}</span>` : ""; };
function itemRow(it, from, ro) {
  const picked = S.placing && S.placing.from === from && S.placing.id === it.id;
  const other = from === "dump" ? `<button class="mini" data-act="to-park" data-id="${it.id}" title="Move to parking lot" aria-label="Move to parking lot">${ICON.park}</button>`
    : `<button class="mini" data-act="to-dump" data-id="${it.id}" title="Move to this day’s brain dump" aria-label="Move to brain dump">${ICON.today}</button>`;
  return `<li class="item ${picked ? "picked" : ""} ${it.done ? "done" : ""}" ${ro ? "" : `draggable="true" data-drag='${esc(JSON.stringify({ from, id: it.id }))}'`}>
    <input type="checkbox" class="check" data-act="item-done" data-from="${from}" data-id="${it.id}" ${it.done ? "checked" : ""} ${ro ? "disabled" : ""} aria-label="Done: ${esc(it.text)}">
    <span class="txt">${esc(it.text)}</span>${itemLen(it) ? `<span class="ilen" title="Keeps its length when you put it back on a day">${fmtDur(itemLen(it))}</span>` : ""}
    ${ro ? "" : `<button class="mini" data-act="pick" data-from="${from}" data-id="${it.id}" title="Schedule into an hour" aria-label="Schedule">${ICON.clock}</button>${other}
    <button class="mini" data-act="del-item" data-from="${from}" data-id="${it.id}" title="Delete" aria-label="Delete">${ICON.x}</button>`}</li>`;
}
// The day as a timeline: free time is drawn as tappable cells (split at each hour), boxes sit on top at their real times.
function timeline(d, keys, startH, endH, ro, nowMin) {
  const t0 = startH * 60, t1 = endH * 60, y = m => ((m - t0) * PX).toFixed(1);
  let labels = "", cells = "", boxes = "";
  for (let h = startH; h < endH; h++) labels += `<div class="hl${nowMin != null && Math.floor(nowMin / 60) === h ? " now" : ""}" style="top:${y(h * 60)}px">${hourLabel(h)}</div>`;
  const free = (a, b) => { for (let s0 = a; s0 < b;) { const e0 = Math.min(b, (Math.floor(s0 / 60) + 1) * 60); if (!ro) cells += freeCell(s0, e0, y); s0 = e0; } };
  let cur = t0;
  for (const key of keys) {
    const s0 = minOfKey(key), len = lenOfKey(d, key);
    if (s0 > cur) free(cur, s0);
    cur = Math.max(cur, s0 + len);
    boxes += boxEl(d, key, s0, len, ro, nowMin, y);
  }
  if (cur < t1) free(cur, t1);
  return `<div class="hours" id="hours"><div class="hlabels" aria-hidden="true">${labels}</div>
    <div class="track" id="track" data-t0="${t0}" style="height:${((t1 - t0) * PX).toFixed(1)}px">${cells}${boxes}</div></div>`;
}
function freeCell(s0, e0, y) {
  const n = e0 - s0, full = n === 60 && s0 % 60 === 0;
  const label = full ? "+ Box this hour" : n >= 20 ? `${n} min free` : "+";
  return `<div class="free${full ? "" : " part"}${n < 20 ? " small" : ""}" role="button" tabindex="0" id="box-${keyId(keyAt(s0))}" data-act="box-new" data-start="${s0}" data-end="${e0}"
    style="top:${y(s0)}px;height:${((e0 - s0) * PX).toFixed(1)}px" aria-label="${timeLabel(s0)} to ${timeLabel(e0)}: free. Box this time">${label}</div>`;
}
function boxEl(d, key, s0, len, ro, nowMin, y) {
  const b = d.boxes[key], id = keyId(key), st = b.status || "planned";
  const now = nowMin != null && nowMin >= s0 && nowMin < s0 + len ? " nowslot" : "";
  const size = len <= 10 ? " tiny" : len <= 25 ? " slim" : "";
  const tall = len >= 40 ? " tall" : "";
  const range = `${timeLabel(s0)} – ${timeLabel(s0 + len)}`;
  return `<div class="box filled st-${st}${now}${b.flex ? " flex" : ""}${size}${tall}" role="button" tabindex="0" id="box-${id}" data-act="box" data-h="${key}"
    style="top:${(+y(s0) + 1).toFixed(1)}px;height:${(len * PX - 2).toFixed(1)}px" aria-label="${esc(b.text)}, ${range}"
    ${ro ? "" : `draggable="true" data-drag='${esc(JSON.stringify({ from: "box", h: key }))}'`}>
    ${size === " tiny" ? "" : `<button class="stbtn ${st}" id="st-${id}" data-act="cycle" data-h="${key}" title="Status: ${st}. Click to change." aria-label="Status ${st}">${st === "done" ? ICON.check : st === "skipped" ? ICON.x : ""}</button>`}
    <span class="btxt">${esc(b.text)}</span>
    ${b.pi != null ? `<span class="prio-flag" title="Top priority">P${b.pi + 1}</span>` : ""}
    ${b.cal ? `<span class="calmark" title="From Google Calendar${b.cal.time ? `: ${esc(b.cal.time)}` : ""}">${ICON.cal}</span>` : ""}
    ${b.flex && !size ? `<span class="flexmark" title="Flexible: if something is dropped here, this moves to the nearest free time">flexible</span>` : ""}
    ${b.tag && !size ? `<span class="tag tg-${b.tag}">${esc(TAGNAME[b.tag] || b.tag)}</span>` : ""}
    <span class="btime">${size ? `${timeLabel(s0)} · ${fmtDur(len)}` : range}</span>
    ${ro ? "" : `<span class="rsz" data-rsz="${key}" draggable="false" title="Drag to change the length"></span>`}
  </div>`;
}
function placeNowLine() {
  if (S.view !== "day" || S.date !== todayKey()) return;
  const tr = $("#track"); if (!tr) return;
  const n = new Date(), m = n.getHours() * 60 + n.getMinutes(), top = (m - +tr.dataset.t0) * PX;
  if (top < 0 || top > tr.offsetHeight) return;
  const line = document.createElement("div"); line.className = "nowline"; line.style.top = top + "px";
  tr.appendChild(line);
}


export { summarize, renderDay, itemRow, placeNowLine };
