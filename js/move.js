// Moving things around: a box, a brain dump item, a parking lot item or a priority can go onto the day
// (at a 10-minute mark), into the brain dump or into the parking lot. Boxes move as they are: same length,
// tag and flexibility, also on their way back from the brain dump or parking lot.
import { NEW_LEN, boxToItem, fits, itemLen, itemToBox, nearestStart, overlaps, putBox, roomAt } from "./boxes.js";
import { render } from "./render.js";
import { S, getDay, getPark, mutateDay, mutatePark } from "./state.js";
import { toast } from "./ui.js";
import { clone, fmtDur, lenOfKey, minOfKey, rid, timeLabel } from "./util.js";

const FINISHED = "This day is finished. Reopen it to make changes.";

function srcText(src) {
  const d = getDay(S.date);
  if (src.from === "prio") return d.prio[src.i].text;
  if (src.from === "dump") return (d.dump.find(x => x.id === src.id) || {}).text;
  if (src.from === "park") return (getPark().items.find(x => x.id === src.id) || {}).text;
  if (src.from === "box") return (d.boxes[src.h] || {}).text;
}
// how long the thing would be on the day; `fresh` = it has no length of its own yet (NEW_LEN, may shrink to fit)
function srcLen(src) {
  const d = getDay(S.date);
  if (src.from === "box") return { len: lenOfKey(d, src.h), fresh: false };
  const it = src.from === "dump" ? d.dump.find(x => x.id === src.id) : src.from === "park" ? getPark().items.find(x => x.id === src.id) : null;
  const n = it ? itemLen(it) : 0;
  return { len: n || NEW_LEN, fresh: !n };
}

// Put src onto the day at minute `want`. copy: keep the original (Option/Shift-drag, Duplicate…).
function moveToDay(src, want, copy) {
  const k = S.date, d0 = getDay(k);
  if (d0.finished) { toast(FINISHED); return; }
  copy = !!(copy || src.copy) && src.from === "box";
  let box;
  if (src.from === "prio") { const t = d0.prio[src.i].text.trim(); if (!t) return; box = { text: t, pi: src.i, status: "planned" }; }
  else if (src.from === "dump") { const it = d0.dump.find(x => x.id === src.id); if (!it) return; box = itemToBox(it); }
  else if (src.from === "park") { const it = getPark().items.find(x => x.id === src.id); if (!it) return; box = itemToBox(it); }
  else if (src.from === "box") { if (!d0.boxes[src.h]) return; box = clone(d0.boxes[src.h]); if (copy) { box.status = "planned"; delete box.cal; } }
  const skip = src.from === "box" && !copy ? src.h : null;
  let { len, fresh } = srcLen(src);
  let start = Math.max(0, Math.min(1440 - len, want));
  if (skip && start === minOfKey(skip)) { S.placing = null; render(); return; } // dropped where it already is
  let note = "", aside = [];
  if (!fits(d0, start, len, skip)) {
    const blockers = overlaps(d0, start, len, skip);
    const room = roomAt(d0, start, skip);
    if (blockers.length && blockers.every(x => d0.boxes[x].flex) && start + len <= 1440) aside = blockers; // flexible boxes step aside
    else if (fresh && room >= 10) { len = room; note = `Fitted into ${fmtDur(len)}.`; }
    else {
      const c = nearestStart(d0, start, len, skip);
      if (c == null) { toast(`There’s no free ${fmtDur(len)} near ${timeLabel(start)}.`); return; }
      note = `${timeLabel(start)} was taken, so it went to ${timeLabel(c)}.`; start = c;
    }
  }
  const moved = [];
  mutateDay(k, d => {
    if (src.from === "dump") d.dump = d.dump.filter(x => x.id !== src.id);
    if (skip) delete d.boxes[skip];
    const lifted = aside.map(x => { const b = d.boxes[x]; delete d.boxes[x]; return [x, b]; });
    putBox(d, start, Object.assign(box, { len }));
    for (const [x, b] of lifted) {
      const c = nearestStart(d, minOfKey(x), b.len || 60);
      if (c != null) { putBox(d, c, b); moved.push(`“${b.text}” moved to ${timeLabel(c)}.`); }
      else { d.dump.push(boxToItem(b, rid())); moved.push(`“${b.text}” went to the brain dump.`); }
    }
  }, { silent: true });
  if (src.from === "park") mutatePark(p => { p.items = p.items.filter(x => x.id !== src.id); }, { silent: true });
  S.placing = null; render();
  const msg = [copy ? `Copied to ${timeLabel(start)}.` : note ? "" : `Moved to ${timeLabel(start)}.`, note, ...moved].filter(Boolean).join(" ");
  toast(msg, { label: "Undo", act: "undo" });
}

// Put src into the brain dump ("dump") or the parking lot ("park"), as it is.
function moveToList(src, to) {
  const k = S.date, d0 = getDay(k);
  if (src.from === to || src.from === "prio") return;
  if ((to === "dump" || src.from === "dump" || src.from === "box") && d0.finished) { toast(FINISHED); return; }
  let item;
  if (src.from === "box") { const b = d0.boxes[src.h]; if (!b) return; item = boxToItem(b, rid(), to === "park"); mutateDay(k, d => { delete d.boxes[src.h]; }, { silent: true }); }
  else if (src.from === "dump") { item = d0.dump.find(x => x.id === src.id); if (!item) return; mutateDay(k, d => { d.dump = d.dump.filter(x => x.id !== src.id); }, { silent: true }); }
  else if (src.from === "park") { item = getPark().items.find(x => x.id === src.id); if (!item) return; mutatePark(p => { p.items = p.items.filter(x => x.id !== src.id); }, { silent: true }); }
  if (!item) return;
  if (to === "park" && item.box) { item = clone(item); delete item.box.pi; }
  if (to === "dump") mutateDay(k, d => { d.dump.push(item); }, { silent: true });
  else mutatePark(p => { p.items.push(item); }, { silent: true });
  S.placing = null; render();
  toast(to === "dump" ? "Moved to this day’s brain dump." : "Moved to the parking lot.", { label: "Undo", act: "undo" });
}

export { srcText, srcLen, moveToDay, moveToList };
