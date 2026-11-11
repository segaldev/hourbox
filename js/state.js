import { render } from "./render.js";
import { Store } from "./store.js";
import { fits, migrateBoxes, nearestStart, putBox } from "./boxes.js";
import { clone, parseKey, timeLabel, todayKey } from "./util.js";

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
  return migrateBoxes(o);
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
function applyRoutine(d, k) { // adds routine items not already on the day where they fit; returns {added, skipped}
  const added = [], moved = [], skipped = [];
  for (const it of routineFor(k)) {
    if (Object.values(d.boxes).some(b => b.rt === it.id)) continue;
    // flexible items take the nearest free time (within 6 hours) when their usual time is taken
    const start = fits(d, it.start, it.len) ? it.start : it.flex ? nearestStart(d, it.start, it.len) : null;
    if (start == null) { skipped.push(it.text); continue; }
    putBox(d, start, { text: it.text.trim(), tag: it.tag || "", status: "planned", rt: it.id, flex: !!it.flex, len: it.len });
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


export { S, DEF_START, DEF_END, blankDay, normDay, dayId, DEFAULT_ROUTINE, getRoutine, dowOf, routineFor, applyRoutine, getDay, hasDay, getPark, getMonth, mutate, mutateDay, mutatePark };
