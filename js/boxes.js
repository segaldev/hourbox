// Box model helpers: boxes have a start minute (their key) and a length, in 10-minute steps. They never overlap.
import { keyAt, lenOfKey, minOfKey } from "./util.js";

const STEP = 10, DAY_MIN = 1440, PX = 1.2; // PX: pixels per minute on the day grid (an hour is 72px)
const NEW_LEN = 30; // a new box, or an item with no length of its own, starts at 30 minutes
const snap = m => Math.round(m / STEP) * STEP;
const snapDown = m => Math.floor(m / STEP) * STEP;

// keys of boxes that overlap [start, start+len), ignoring `skip`
const overlaps = (d, start, len, skip) => Object.keys(d.boxes).filter(k => k !== skip && minOfKey(k) < start + len && minOfKey(k) + lenOfKey(d, k) > start);
const fits = (d, start, len, skip) => start >= 0 && len >= STEP && start + len <= DAY_MIN && !overlaps(d, start, len, skip).length;
// free minutes from `start` until the next box (or midnight); 0 if `start` is inside a box
function roomAt(d, start, skip) {
  if (start < 0 || start >= DAY_MIN || overlaps(d, start, 1, skip).length) return 0;
  let end = DAY_MIN;
  for (const k of Object.keys(d.boxes)) { if (k === skip) continue; const s = minOfKey(k); if (s >= start && s < end) end = s; }
  return end - start;
}
// the closest start to `want` where a box of `len` fits (later first on ties), within `maxOff` minutes
function nearestStart(d, want, len, skip, maxOff = 360) {
  for (let off = 0; off <= maxOff; off += STEP) for (const c of off ? [want + off, want - off] : [want]) if (fits(d, c, len, skip)) return c;
  return null;
}
// put a box on the day at `start` and make sure its hours are visible; returns its key
function putBox(d, start, box) {
  const k = keyAt(start), len = box.len || 60;
  d.boxes[k] = Object.assign({}, box, { len });
  d.start = Math.min(d.start, Math.floor(start / 60)); d.end = Math.max(d.end, Math.ceil((start + len) / 60));
  return k;
}
// A box taken off the day becomes a brain dump / parking lot item that remembers its length and details,
// so it comes back exactly as it was. Items typed in by hand have no box details: they start as NEW_LEN (30 min).
const BOX_KEEP = ["len", "tag", "flex", "rt", "pi"];
function boxToItem(b, id, toPark) {
  const box = {}; BOX_KEEP.forEach(f => { if (b[f] != null && b[f] !== "" && b[f] !== false) box[f] = b[f]; });
  if (toPark) delete box.pi; // a priority belongs to its own day
  return { id, text: b.text, box };
}
const itemToBox = it => Object.assign({ status: "planned" }, it.box || {}, { text: it.text });
const itemLen = it => (it.box && it.box.len) || 0; // 0: not set yet

// Old days stored hours split into 2 or 4 slots (d.splits). Turn them into boxes with their own length.
function migrateBoxes(o) {
  const needs = o.splits || Object.entries(o.boxes).some(([k, b]) => !b.len || k !== keyAt(minOfKey(k)));
  if (!needs) return o;
  const nb = {};
  for (const [k, b] of Object.entries(o.boxes)) {
    const n = (o.splits && o.splits[parseInt(k, 10)]) || 1;
    nb[keyAt(minOfKey(k))] = Object.assign({}, b, { len: b.len || 60 / n });
  }
  o.boxes = nb; delete o.splits;
  return o;
}

export { STEP, DAY_MIN, PX, NEW_LEN, snap, snapDown, overlaps, fits, roomAt, nearestStart, putBox, boxToItem, itemToBox, itemLen, migrateBoxes };
