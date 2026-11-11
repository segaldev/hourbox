
// ---------- utils ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const clone = o => JSON.parse(JSON.stringify(o));
const pad = n => String(n).padStart(2, "0");
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
const todayKey = () => keyOf(new Date());
const hourLabel = h => h === 24 ? "Midnight" : new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric" });
const hourShort = h => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
// Slots: an hour is one 60-minute box (key "9"), or split into 30s ("9:00", "9:30") or 15s ("9:00" … "9:45").
const splitOf = (d, h) => (d.splits && d.splits[h]) || 1;
const slotKeys = (d, h) => { const n = splitOf(d, h); return n === 1 ? [String(h)] : Array.from({ length: n }, (_, i) => `${h}:${pad(i * 60 / n)}`); };
const hourOfKey = k => parseInt(k, 10);
const minOfKey = k => { const [h, m] = String(k).split(":"); return +h * 60 + (+m || 0); };
const lenOfKey = (d, k) => 60 / splitOf(d, hourOfKey(k));
const timeLabel = min => new Date(2000, 0, 1, Math.floor(min / 60) % 24, min % 60).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const slotRange = (d, k) => `${timeLabel(minOfKey(k))} – ${timeLabel(minOfKey(k) + lenOfKey(d, k))}`;
const fmtDur = m => { const h = Math.floor(m / 60), r = m % 60; return h && r ? `${h}h ${r}m` : h ? `${h}h` : `${r}m`; };
const sortedKeys = d => Object.keys(d.boxes).sort((a, b) => minOfKey(a) - minOfKey(b));
const hourHasBox = (d, h) => Object.keys(d.boxes).some(k => hourOfKey(k) === h);
function nextSlot(d, k) { const h = hourOfKey(k), ks = slotKeys(d, h), i = ks.indexOf(String(k)); if (i >= 0 && i < ks.length - 1) return ks[i + 1]; return h >= 23 ? null : slotKeys(d, h + 1)[0]; }
const TAGS = [["", "None"], ["deep", "Deep work"], ["meet", "Meetings"], ["admin", "Admin"], ["personal", "Personal"]];
const TAGNAME = Object.fromEntries(TAGS);
const ICON = {
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  park: '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><path d="M10 16.5v-9h2.8a2.7 2.7 0 0 1 0 5.4H10"/></svg>', // parking sign: send to the parking lot
  today: '<svg viewBox="0 0 24 24"><path d="M12 5.5a3 3 0 0 0-5.3-1.9A3 3 0 0 0 4.3 7.8a3.2 3.2 0 0 0-.6 5.2 3.4 3.4 0 0 0 2.4 5.3A3 3 0 0 0 12 19.5z"/><path d="M12 5.5a3 3 0 0 1 5.3-1.9 3 3 0 0 1 2.4 4.2 3.2 3.2 0 0 1 .6 5.2 3.4 3.4 0 0 1-2.4 5.3A3 3 0 0 1 12 19.5"/><path d="M12 5.5v14M7.5 10.5c1.3 0 2.3.8 2.5 2M16.5 10.5c-1.3 0-2.3.8-2.5 2"/></svg>', // brain: send to the brain dump
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></svg>',
};


export { $, esc, rid, clone, pad, keyOf, parseKey, addDays, todayKey, hourLabel, hourShort, splitOf, slotKeys, hourOfKey, minOfKey, lenOfKey, timeLabel, slotRange, fmtDur, sortedKeys, hourHasBox, nextSlot, TAGS, TAGNAME, ICON };
