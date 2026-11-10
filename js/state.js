import { render } from "./render.js";
import { Store } from "./store.js";
import { clone, hourHasBox, hourOfKey, minOfKey, parseKey, slotKeys, splitOf, timeLabel, todayKey } from "./util.js";

// ---------- state ----------
const S = { view: "day", date: todayKey(), docs: {}, ready: false, mode: "connecting", placing: null };
const DEF_START = 6, DEF_END = 22;

function blankDay(key) {
  return { kind: "day", date: key, month: key.slice(0, 7), start: DEF_START, end: DEF_END, boxes: {},
    prio: [{ text: "", done: false }, { text: "", done: false }, { text: "", done: false }],
    dump: [], finished: false, reflection: null, summary: null };
}
function normDay(d, key) {
  const b = blankDay(key); const o = Object.assign(b, d || {});
  if (!Array.isArray(o.prio)) o.prio = b.prio;
  while (o.prio.length < 3) o.prio.push({ text: "", done: false });
  o.boxes = o.boxes || {}; o.dump = o.dump || [];
  o.start = Math.min(o.start, DEF_START);
  return o;
}
const dayId = k => "day-" + k;
// Daily routine: a template of boxes that every new day (today or later) starts with.
// Days are Mon=0 … Sun=6. Flexible items move aside to the nearest free slot instead of being bumped.
const DEFAULT_ROUTINE = [
  { id: "r-ready", start: 360, len: 60, text: "Get ready", tag: "personal", flex: false, days: [0, 1, 2, 3, 4, 5, 6] },
  { id: "r-house", start: 420, len: 60, text: "Housework / get kids ready", tag: "personal", flex: false, days: [0, 1, 2, 3, 4, 5, 6] },
  { id: "r-walk", start: 480, len: 30, text: "Walk", tag: "personal", flex: true, days: [0, 1, 2, 3, 4, 5, 6] },
];
const getRoutine = () => Object.assign({ kind: "routine", items: clone(DEFAULT_ROUTINE) }, S.docs.routine || {});
const dowOf = k => (parseKey(k).getDay() + 6) % 7;
const routineFor = k => getRoutine().items.filter(it => it.text.trim() && (!it.days || it.days.includes(dowOf(k)))).sort((a, b) => a.start - b.start);
function resplit(d, h, n) { // change an hour's box length, keeping boxes where they start; returns boxes that no longer fit
  const bumped = [];
  const old = Object.keys(d.boxes).filter(key => hourOfKey(key) === h).sort((a, b) => minOfKey(a) - minOfKey(b)).map(key => [key, d.boxes[key]]);
  old.forEach(([key]) => delete d.boxes[key]);
  d.splits = d.splits || {}; if (n === 1) delete d.splits[h]; else d.splits[h] = n;
  const ks = slotKeys(d, h);
  old.forEach(([key, b]) => {
    let i = Math.floor((minOfKey(key) - h * 60) / (60 / n));
    while (i < ks.length && d.boxes[ks[i]]) i++;
    if (i < ks.length) d.boxes[ks[i]] = b; else bumped.push(b);
  });
  return bumped;
}
function slotsFor(d, start, len) { // keys covering [start, start+len) once hours are split finely enough, or null if any is taken
  const need = start % 60 === 0 && len % 60 === 0 ? 1 : start % 30 === 0 && len % 30 === 0 ? 2 : 4;
  const h0 = Math.floor(start / 60), h1 = Math.floor((start + len - 1) / 60);
  if (start < 0 || h1 > 23) return null;
  // only split hours that are still empty, so nothing you planned ever gets shorter
  for (let h = h0; h <= h1; h++) if (splitOf(d, h) < need && hourHasBox(d, h)) return null;
  const trial = clone(d); for (let h = h0; h <= h1; h++) if (splitOf(trial, h) < need) resplit(trial, h, need);
  const keys = []; for (let h = h0; h <= h1; h++) slotKeys(trial, h).forEach(key => { const m = minOfKey(key); if (m >= start && m < start + len) keys.push(key); });
  return keys.every(key => !trial.boxes[key]) ? { keys, need, h0, h1 } : null;
}
function applyRoutine(d, k) { // fills empty slots with routine items not already on the day; returns {added, moved, skipped}
  const added = [], moved = [], skipped = [];
  for (const it of routineFor(k)) {
    if (Object.values(d.boxes).some(b => b.rt === it.id)) continue;
    let start = it.start, fit = slotsFor(d, start, it.len);
    if (!fit && it.flex) { // flexible: nearest free time, later first, within 6 hours
      for (let off = 15; off <= 360 && !fit; off += 15) for (const c of [it.start + off, it.start - off]) { if (!fit && (fit = slotsFor(d, c, it.len))) start = c; }
    }
    if (!fit) { skipped.push(it.text); continue; }
    for (let h = fit.h0; h <= fit.h1; h++) if (splitOf(d, h) < fit.need) resplit(d, h, fit.need);
    fit.keys.forEach(key => { d.boxes[key] = { text: it.text.trim(), tag: it.tag || "", status: "planned", rt: it.id, flex: !!it.flex }; });
    d.start = Math.min(d.start, fit.h0); d.end = Math.max(d.end, fit.h1 + 1);
    (start === it.start ? added : moved).push(start === it.start ? it.text : `${it.text} (at ${timeLabel(start)})`);
  }
  d.rtApplied = true;
  return { added: added.concat(moved), skipped };
}
const getDay = k => {
  const saved = S.docs[dayId(k)];
  if (saved) return normDay(saved, k);
  const d = normDay(null, k);
  if (k >= todayKey()) applyRoutine(d, k); // a new day starts from your routine (nothing is saved until you change it)
  return d;
};
const hasDay = k => !!S.docs[dayId(k)];
const getPark = () => Object.assign({ kind: "parking", items: [] }, S.docs.parking || {});
const getMonth = m => Object.assign({ kind: "month", month: m, goals: ["", "", "", "", ""] }, S.docs["month-" + m] || {});

function mutate(id, base, fn, opts = {}) {
  const d = clone(base); fn(d); S.docs[id] = d; Store.save(id); if (!opts.silent) render();
}
const mutateDay = (k, fn, opts) => mutate(dayId(k), getDay(k), fn, opts);
const mutatePark = (fn, opts) => mutate("parking", getPark(), fn, opts);


export { S, DEF_START, DEF_END, blankDay, normDay, dayId, DEFAULT_ROUTINE, getRoutine, dowOf, routineFor, resplit, slotsFor, applyRoutine, getDay, hasDay, getPark, getMonth, mutate, mutateDay, mutatePark };
