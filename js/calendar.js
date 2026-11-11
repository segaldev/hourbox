import { closeModal, openModal } from "./modals.js";
import { fits, nearestStart, putBox } from "./boxes.js";
import { S, getDay, mutate, mutateDay } from "./state.js";
import { FB, USE_EMULATOR } from "./store.js";
import { toast } from "./ui.js";
import { $, clone, esc, lenOfKey, minOfKey, parseKey, rid, sortedKeys, timeLabel } from "./util.js";

// ---------- Google Calendar import (read-only for now) ----------
// Each imported box keeps its event id in box.cal, so a later version can write changes back.
// Hourbox only reads your calendar. Set CAL_WRITE to true to also send changes back (moves, renames, your own boxes).
const CAL_WRITE = false;
const CAL_SCOPES = [CAL_WRITE ? "https://www.googleapis.com/auth/calendar.events" : "https://www.googleapis.com/auth/calendar.events.readonly",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly"]; // read events, and see which calendars you have
const CAL_SCOPE = CAL_SCOPES.join(" ");
const Cal = {
  token: null, exp: 0,
  cached() {
    if (this.token && Date.now() < this.exp) return this.token;
    try { const t = JSON.parse(sessionStorage.getItem("hourbox-cal") || "null"); if (t && t.scope === CAL_SCOPE && Date.now() < t.exp) { this.token = t.token; this.exp = t.exp; return t.token; } } catch (e) {}
    return null;
  },
  forget() { this.token = null; this.exp = 0; try { sessionStorage.removeItem("hourbox-cal"); } catch (e) {} },
  async authorize() { // Google asks once to allow read-only calendar access; the token lasts about an hour
    if (USE_EMULATOR) return "emulator-token";
    const provider = new FB.m.GoogleAuthProvider(); CAL_SCOPES.forEach(sc => provider.addScope(sc));
    if (FB.user && FB.user.email) provider.setCustomParameters({ login_hint: FB.user.email });
    const res = await FB.m.reauthenticateWithPopup(FB.user, provider);
    const cred = FB.m.GoogleAuthProvider.credentialFromResult(res);
    if (!cred || !cred.accessToken) throw { code: "no-token" };
    this.token = cred.accessToken; this.exp = Date.now() + 50 * 60 * 1000;
    try { sessionStorage.setItem("hourbox-cal", JSON.stringify({ token: this.token, exp: this.exp, scope: CAL_SCOPE })); } catch (e) {}
    return this.token;
  },
  async call(method, path, token, body, query) {
    const q = query ? "?" + new URLSearchParams(query) : "";
    let r; try { r = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events" + path + q, { method, headers: Object.assign({ Authorization: "Bearer " + token }, body ? { "Content-Type": "application/json" } : {}), body: body ? JSON.stringify(body) : undefined }); }
    catch (e) { throw { code: "network" }; }
    if (r.status === 401) { this.forget(); throw { code: "expired" }; }
    if (r.status === 403) { const t = await r.text(); if (/insufficient/i.test(t)) { this.forget(); throw { code: "scope" }; } throw { code: "forbidden" }; }
    if (r.status === 404 || r.status === 410) throw { code: "gone" };
    if (!r.ok) throw { code: "http", status: r.status };
    return r.status === 204 ? null : r.json();
  },
  async get(url, token) {
    let r; try { r = await fetch(url, { headers: { Authorization: "Bearer " + token } }); } catch (e) { throw { code: "network" }; }
    if (r.status === 401) { this.forget(); throw { code: "expired" }; }
    if (r.status === 403) { const t = await r.text(); if (/insufficient/i.test(t)) { this.forget(); throw { code: "scope" }; } throw { code: /disabled|not been used/i.test(t) ? "api-off" : "forbidden" }; }
    if (!r.ok) throw { code: "http", status: r.status };
    return r.json();
  },
  async listCalendars(token) { // your calendars, main one first; the main one is called "primary"
    const j = await this.get("https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader&maxResults=250&showHidden=true", token);
    return (j.items || []).filter(c => !c.deleted).map(c => ({ id: c.primary ? "primary" : c.id, name: c.summaryOverride || c.summary || c.id, color: c.backgroundColor || "#888888", primary: !!c.primary }))
      .sort((a, b) => (b.primary - a.primary) || a.name.localeCompare(b.name));
  },
  async fetchMany(k, token, cals) { // events from the chosen calendars; a meeting that appears in two of them shows once
    const lists = await Promise.all(cals.map(c => this.fetchDay(k, token, c.id).then(items => items.map(ev => Object.assign(ev, { _cal: c.id, _calName: c.name })))));
    const seen = new Set(), out = [];
    for (const ev of lists.flat()) { const key = (ev.iCalUID || ev.id) + "@" + ((ev.start && (ev.start.dateTime || ev.start.date)) || ""); if (seen.has(key)) continue; seen.add(key); out.push(ev); }
    return out.sort((a, b) => String((a.start || {}).dateTime || (a.start || {}).date).localeCompare(String((b.start || {}).dateTime || (b.start || {}).date)));
  },
  async fetchDay(k, token, calId = "primary") {
    const d0 = parseKey(k), d1 = new Date(d0); d1.setDate(d1.getDate() + 1);
    const q = new URLSearchParams({ timeMin: d0.toISOString(), timeMax: d1.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "100" });
    let r; try { r = await fetch("https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(calId) + "/events?" + q, { headers: { Authorization: "Bearer " + token } }); }
    catch (e) { throw { code: "network" }; }
    if (r.status === 401) { this.forget(); throw { code: "expired" }; }
    if (r.status === 403) { const t = await r.text(); if (/insufficient/i.test(t)) { this.forget(); throw { code: "scope" }; } throw { code: /disabled|not been used/i.test(t) ? "api-off" : "forbidden" }; }
    if (!r.ok) throw { code: "http", status: r.status };
    return (await r.json()).items || [];
  }
};
// Put box b back as close to `start` as possible, keeping its length (later first, within 6 hours).
function placeNear(dd, b, start, len) {
  const c = nearestStart(dd, start, len); if (c == null) return null;
  putBox(dd, c, Object.assign(clone(b), { len }));
  return c;
}
// Work out what syncing would do to day k, without changing anything yet.
function planCalendar(d, k, events) {
  const dd = clone(d), dayStart = parseKey(k).getTime(), rows = [], seen = new Set();
  const prev = {}; // calendar boxes from the last sync are rebuilt from the calendar
  for (const [key, b] of Object.entries(dd.boxes)) if (b.cal) { (prev[b.cal.id] = prev[b.cal.id] || []).push({ key, b }); delete dd.boxes[key]; }
  for (const ev of events) {
    if (ev.status === "cancelled") continue;
    const me = (ev.attendees || []).find(a => a.self); if (me && me.responseStatus === "declined") continue;
    const title = (ev.summary || "(No title)").trim().slice(0, 140);
    if (!ev.start || !ev.start.dateTime) { rows.push({ title, kind: "allday" }); continue; }
    const sm = Math.max(0, Math.round((new Date(ev.start.dateTime) - dayStart) / 60000)), em = Math.min(1440, Math.round((new Date(ev.end.dateTime) - dayStart) / 60000));
    if (em <= sm) continue;
    const evId = ev._cal && ev._cal !== "primary" ? ev._cal + "|" + ev.id : ev.id; // ids are only unique within one calendar
    seen.add(evId);
    const start = Math.floor(sm / 10) * 10, end = Math.min(1440, Math.max(start + 10, Math.ceil(em / 10) * 10)); // boxes snap to 10 minutes
    const real = `${timeLabel(sm)} – ${timeLabel(em)}`, range = `${timeLabel(start)} – ${timeLabel(end)}`;
    // anything already planned in that time?
    const blockers = Object.keys(dd.boxes).filter(key => { const s0 = minOfKey(key), e0 = s0 + lenOfKey(dd, key); return s0 < end && e0 > start; });
    const fixed = blockers.filter(key => !dd.boxes[key].flex);
    if (fixed.length) { rows.push({ title, kind: "overlap", range, with: dd.boxes[fixed[0]].text }); continue; }
    const moved = blockers.map(key => { const b = dd.boxes[key], len = lenOfKey(dd, key); delete dd.boxes[key]; return { key, b, len }; });
    if (!fits(dd, start, end - start)) { moved.forEach(({ key, b }) => { dd.boxes[key] = b; }); rows.push({ title, kind: "overlap", range, with: "the boxes in that hour" }); continue; }
    const old = prev[evId] && prev[evId][0].b;
    const fromHourbox = !!(ev.extendedProperties && ev.extendedProperties.private && ev.extendedProperties.private.hourbox);
    const canEdit = fromHourbox || !ev.organizer || !!ev.organizer.self || ev.guestsCanModify === true;
    const guests = (ev.attendees || []).filter(a => !a.self && !a.resource).length;
    const key = putBox(dd, start, Object.assign({ text: title, len: end - start, tag: old ? old.tag || "" : "meet", status: old ? old.status || "planned" : "planned" },
      old && old.flex ? { flex: true } : {}, old && old.pi != null ? { pi: old.pi } : {}, old && old.rt ? { rt: old.rt } : {},
      { cal: { id: evId, calendar: ev._cal || "primary", calName: ev._calName || "", etag: ev.etag || "", updated: ev.updated || "", link: ev.htmlLink || "", time: start === sm && end === em ? "" : real,
        src: fromHourbox ? "hourbox" : "google", canEdit, guests, base: { start, end, summary: title, realStart: sm, realEnd: em } } }));
    moved.forEach(({ key, b, len }) => { if (placeNear(dd, b, minOfKey(key), len) == null) dd.dump.push({ id: rid(), text: b.text }); });
    const changed = old && (old.text !== title || prev[evId].length !== 1 || prev[evId][0].key !== key || (old.len || 60) !== end - start);
    rows.push({ title, kind: !old ? "new" : changed ? "updated" : "same", range: real, movedAside: moved.map(m => m.b.text), calName: ev._calName || "" });
  }
  for (const [id, list] of Object.entries(prev)) if (!seen.has(id)) rows.push({ title: list[0].b.text, kind: "removed" });
  dd.calSyncedAt = new Date().toISOString();
  return { rows, next: dd };
}
// Calendar boxes grouped by event, with where they sit now.
function localGroups(d) {
  const g = {};
  for (const key of sortedKeys(d)) { const b = d.boxes[key]; if (!b.cal) continue;
    const s0 = minOfKey(key), e0 = s0 + lenOfKey(d, key), x = g[b.cal.id] || (g[b.cal.id] = { id: b.cal.id, keys: [], start: s0, end: e0, b });
    x.keys.push(key); x.start = Math.min(x.start, s0); x.end = Math.max(x.end, e0); }
  return g;
}
// My own boxes as calendar blocks: back-to-back boxes with the same name become one event.
function ownRuns(d, withRoutine) {
  const runs = [];
  for (const key of sortedKeys(d)) { const b = d.boxes[key]; if (b.cal || (!withRoutine && b.rt)) continue;
    const s0 = minOfKey(key), e0 = s0 + lenOfKey(d, key), last = runs[runs.length - 1];
    if (last && last.text === b.text && last.end === s0) { last.end = e0; last.keys.push(key); } else runs.push({ text: b.text.trim(), start: s0, end: e0, keys: [key] }); }
  return runs;
}
const calApi = token => ({
  patch: (id, body, notify) => Cal.call("PATCH", "/" + encodeURIComponent(id), token, body, { sendUpdates: notify ? "all" : "none" }),
  insert: body => Cal.call("POST", "", token, body),
  remove: id => Cal.call("DELETE", "/" + encodeURIComponent(id), token, null, { sendUpdates: "none" }),
});
let simN = 0;
const simApi = { // the preview: the same steps without touching Google
  patch: async (id, body) => Object.assign({}, body, { etag: "sim" }),
  insert: async body => Object.assign({ id: "preview-" + (++simN), etag: "sim" }, body),
  remove: async () => null,
};
// One sync for day k: send my changes to Google, then bring Google's day into the boxes.
async function buildSync(d0, k, remote, opts, api) {
  const d = clone(d0), events = remote.map(e => clone(e)), dayStart = parseKey(k).getTime(), push = [], failed = [];
  const iso = m => new Date(dayStart + m * 60000).toISOString(), byId = id => events.find(e => e.id === id);
  const groups = localGroups(d);
  if (CAL_WRITE) for (const g of Object.values(groups)) {
    const c = g.b.cal, base = c.base, ev = byId(g.id); if (!base || !ev) continue;
    const text = g.b.text.trim(), moved = g.start !== base.start || g.end !== base.end, renamed = text !== base.summary;
    if (!moved && !renamed) continue;
    if (c.etag && ev.etag && ev.etag !== c.etag) { push.push({ kind: "conflict", title: text }); continue; }
    if (!c.canEdit) { push.push({ kind: "cant", title: text }); continue; }
    const delta = g.start - base.start, sameLen = g.end - g.start === base.end - base.start;
    const ns = (base.realStart != null ? base.realStart : base.start) + delta, ne = sameLen ? (base.realEnd != null ? base.realEnd : base.end) + delta : g.end;
    const body = {}; if (moved) { body.start = { dateTime: iso(ns) }; body.end = { dateTime: iso(ne) }; } if (renamed) body.summary = text;
    try { const upd = await api.patch(ev.id, body, c.guests > 0); Object.assign(ev, upd || {}, body);
      push.push({ kind: moved ? "move" : "rename", title: text, range: moved ? `${timeLabel(ns)} – ${timeLabel(ne)}` : "", guests: c.guests }); }
    catch (e) { if (e && (e.code === "expired" || e.code === "scope")) throw e; failed.push(text); }
  }
  const out = new Set(d.calOut || []); // events Hourbox created for this day
  if (CAL_WRITE) for (const id of [...out]) {
    if (groups[id]) continue; out.delete(id);
    const ev = byId(id); if (!ev) continue;
    try { await api.remove(id); events.splice(events.indexOf(ev), 1); push.push({ kind: "delete", title: ev.summary || "" }); }
    catch (e) { if (e && (e.code === "expired" || e.code === "scope")) throw e; if (e && e.code === "gone") continue; failed.push(ev.summary || ""); out.add(id); }
  }
  if (CAL_WRITE && opts.own) for (const r of ownRuns(d, opts.routine)) {
    try {
      const ev = await api.insert({ summary: r.text, start: { dateTime: iso(r.start) }, end: { dateTime: iso(r.end) }, description: "Planned in Hourbox", extendedProperties: { private: { hourbox: "1" } } });
      events.push(ev); out.add(ev.id);
      r.keys.forEach(key => { d.boxes[key].cal = { id: ev.id, src: "hourbox", canEdit: true, base: { start: r.start, end: r.end, summary: r.text } }; });
      push.push({ kind: "add", title: r.text, range: `${timeLabel(r.start)} – ${timeLabel(r.end)}` });
    } catch (e) { if (e && (e.code === "expired" || e.code === "scope")) throw e; failed.push(r.text); }
  }
  d.calOut = [...out];
  const { rows, next } = planCalendar(d, k, events);
  return { push, rows: rows.filter(r => !(r.kind === "same" && push.some(p => p.title === r.title))), next, failed };
}
const calChoice = () => { const c = S.docs.settings && S.docs.settings.calendars; return Array.isArray(c) && c.length ? c : ["primary"]; };
const setCalChoice = ids => mutate("settings", Object.assign({ kind: "settings" }, S.docs.settings || {}), st => { st.calendars = ids; }, { silent: true });
// Calendars you removed from the picker (saved in your account)
const calHidden = () => { const h = S.docs.settings && S.docs.settings.hiddenCalendars; return Array.isArray(h) ? h : []; };
const setCalHidden = ids => mutate("settings", Object.assign({ kind: "settings" }, S.docs.settings || {}), st => { st.hiddenCalendars = ids; }, { silent: true });
const calOpts = () => { try { return Object.assign({ own: true, routine: false }, JSON.parse(localStorage.getItem("hourbox-cal-push") || "{}")); } catch (e) { return { own: true, routine: false }; } };
function calError(e) {
  const c = e && e.code;
  if (c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request") return;
  toast(c === "expired" ? "Calendar access expired. Tap Sync calendar again."
    : c === "scope" ? (CAL_WRITE ? "Hourbox needs permission to change your calendar. Tap Sync calendar and allow it." : "Hourbox needs permission to read your calendars. Tap Sync calendar and allow it.")
    : c === "api-off" ? "The Google Calendar API isn’t turned on for your Firebase project yet."
    : c === "auth/user-mismatch" ? "Choose the same Google account you log in to Hourbox with."
    : c === "network" ? "Can’t reach Google Calendar. Check your connection."
    : "Couldn’t sync your calendar. Try again in a moment.");
}
async function calSync() {
  const k = S.date, btn = $("#cal-sync");
  let token = Cal.cached();
  try {
    if (!token) token = await Cal.authorize(); // opens Google's permission popup straight from the tap
    if (btn) { btn.disabled = true; btn.lastElementChild.textContent = "Syncing…"; }
    const all = await Cal.listCalendars(token);
    const chosen = all.filter(c => calChoice().includes(c.id));
    const events = await Cal.fetchMany(k, token, chosen.length ? chosen : all.filter(c => c.primary));
    await openCalPreview(k, events, token, all);
  } catch (e) { calError(e); }
  finally { if (btn && btn.isConnected) { btn.disabled = false; btn.lastElementChild.textContent = btn.dataset.label || "Sync calendar"; } }
}
async function openCalPreview(k, events, token, allCals) {
  const opts = calOpts();
  let hidden = calHidden(), showRemoved = false;
  const visible = () => allCals.filter(c => !hidden.includes(c.id));
  let picked = visible().filter(c => calChoice().includes(c.id)); if (!picked.length) picked = visible().filter(c => c.primary);
  const chipsHTML = () => visible().map(c => `<span class="cal-chipwrap"><button type="button" class="chip cal-chip" data-cal="${esc(c.id)}" aria-pressed="${picked.some(x => x.id === c.id)}" style="--tc:${esc(c.color)}">${esc(c.name)}</button><button type="button" class="cal-x" data-hide="${esc(c.id)}" aria-label="Remove ${esc(c.name)} from this list" title="Remove from this list">×</button></span>`).join("")
    + (hidden.length ? `<button type="button" class="linkbtn cal-showremoved">${showRemoved ? "Hide removed" : `Show removed (${allCals.filter(c => hidden.includes(c.id)).length})`}</button>` : "")
    + (showRemoved ? `<div class="cal-removed">${allCals.filter(c => hidden.includes(c.id)).map(c => `<span class="cal-removed-row"><i style="background:${esc(c.color)}"></i>${esc(c.name)}<button type="button" class="btn ghost cal-restore" data-restore="${esc(c.id)}">Restore</button></span>`).join("")}</div>` : "");
  const calNames = () => picked.map(c => c.name).join(", ") || "your calendar";
  const multi = () => picked.length > 1;
  let sim = await buildSync(getDay(k), k, events, opts, simApi);
  const label = { new: "New", updated: "Updated", same: "Already in Hourbox", overlap: "Doesn’t fit", allday: "All-day", removed: "No longer in your calendar" };
  const plabel = { add: "Add", move: "Move", rename: "Rename", delete: "Delete", cant: "Can’t change", conflict: "Changed in both" };
  const psub = p => p.kind === "add" ? `${esc(p.range)} · new event` : p.kind === "move" ? `to ${esc(p.range)}${p.guests ? ` · ${p.guests} guest${p.guests > 1 ? "s" : ""} will get an update` : ""}`
    : p.kind === "rename" ? "new name" : p.kind === "delete" ? "you removed its box in Hourbox" : p.kind === "cant" ? "someone else organizes it, so its box goes back to Google’s time" : "kept Google’s version";
  const listHTML = () => {
    const push = sim.push.map(p => `<div class="cal-row k-${p.kind === "cant" || p.kind === "conflict" || p.kind === "delete" ? "overlap" : "new"}"><span class="cal-kind">${plabel[p.kind]}</span><span class="cal-title">${esc(p.title)}</span><span class="cal-sub">${psub(p)}</span></div>`).join("");
    const same = sim.rows.filter(r => r.kind === "same");
    const pull = sim.rows.filter(r => r.kind !== "same").map(r => `<div class="cal-row k-${r.kind}"><span class="cal-kind">${label[r.kind]}</span><span class="cal-title">${esc(r.title)}</span>
      <span class="cal-sub">${r.kind === "overlap" ? `${esc(r.range)} · overlaps “${esc(r.with)}”` : r.kind === "allday" ? "Not placed in a box" : r.kind === "removed" ? "Its box will be removed" : esc(r.range || "")}${multi() && r.calName ? ` · ${esc(r.calName)}` : ""}${r.movedAside && r.movedAside.length ? ` · moves “${esc(r.movedAside[0])}” aside` : ""}</span></div>`).join("")
      + (same.length ? `<p class="hint" style="margin:6px 0 0">${same.length} event${same.length > 1 ? "s are" : " is"} already up to date: ${same.map(r => esc(r.title)).join(", ")}.</p>` : "");
    if (!picked.length) return `<p class="hint">Choose at least one calendar above.</p>`;
    if (!CAL_WRITE) return pull || `<p class="hint">No events on ${esc(calNames())} for this day.</p>`;
    return `<p class="sect-title">To Google Calendar</p>${push || `<p class="hint">Nothing to send.</p>`}
      <p class="sect-title" style="margin-top:14px">From Google Calendar</p>${pull || `<p class="hint">No events on ${esc(calNames())} for this day.</p>`}`;
  };
  const skippedN = () => sim.rows.filter(r => r.kind === "overlap").length;
  const anyChange = () => sim.push.some(p => p.kind === "add" || p.kind === "move" || p.kind === "rename" || p.kind === "delete") || sim.rows.some(r => r.kind !== "same" && r.kind !== "allday") || skippedN();
  const ov = openModal(`
    <header><span class="eyebrow">${parseKey(k).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })} · Google Calendar</span><h3>Sync calendar</h3></header>
    <div class="body">
      <div class="chips-col" ${CAL_WRITE ? "" : "hidden"}>
        <label class="flexchk" for="cal-own"><input type="checkbox" class="check" id="cal-own" ${opts.own ? "checked" : ""}> Add my own boxes to Google Calendar</label>
        <label class="flexchk" for="cal-routine"><input type="checkbox" class="check" id="cal-routine" ${opts.routine ? "checked" : ""} ${opts.own ? "" : "disabled"}> Include routine boxes (Get ready, Walk…)</label>
      </div>
      <div class="field"><span class="lbl">Calendars in ${esc((FB.user && FB.user.email) || "your Google account")}</span>
        <div class="chips" id="cal-cals">${chipsHTML()}</div></div>
      <div class="cal-list" id="cal-list">${listHTML()}</div>
      <label class="flexchk" for="cal-dump" id="cal-dump-wrap" ${skippedN() ? "" : "hidden"}><input type="checkbox" class="check" id="cal-dump" checked> Put events that don’t fit in the brain dump</label>
      <p class="hint">${CAL_WRITE ? "Only this day changes. Boxes you planned yourself are never overwritten, and meetings you didn’t create are never deleted." : "Hourbox only reads your calendar and never changes it. Only this day’s boxes change, and boxes you planned yourself are never overwritten."}</p>
    </div>
    <footer><button class="btn" data-m="cancel" id="cal-cancel">Cancel</button><button class="btn primary" data-m="apply" id="cal-apply" ${anyChange() ? "" : "disabled"}>${anyChange() ? (CAL_WRITE ? "Sync" : "Add to this day") : "Nothing to change"}</button></footer>`,
    async btn => {
      if (btn.dataset.m === "cancel") { closeModal(); return; }
      if (btn.dataset.m !== "apply") return;
      btn.disabled = true; btn.textContent = "Syncing…";
      const o = { own: $("#cal-own").checked, routine: $("#cal-routine").checked }, toDumpOn = $("#cal-dump") && $("#cal-dump").checked;
      let res;
      try { res = await buildSync(getDay(k), k, await Cal.fetchMany(k, token, picked), o, calApi(token)); }
      catch (e) { closeModal(); calError(e); return; }
      const toDump = toDumpOn ? res.rows.filter(r => r.kind === "overlap").map(r => r.title) : [];
      let dumped = 0;
      mutateDay(k, d => { Object.keys(d).forEach(x => delete d[x]); Object.assign(d, clone(res.next)); toDump.forEach(text => { if (!d.dump.some(x => x.text === text)) { d.dump.push({ id: rid(), text }); dumped++; } }); }, { silent: true });
      S.showSetup = false; // back to the day to see the result
      closeModal();
      const n = kind => res.push.filter(p => p.kind === kind).length, m = kind => res.rows.filter(r => r.kind === kind).length;
      const parts = [n("add") && `${n("add")} added to Google`, (n("move") + n("rename")) && `${n("move") + n("rename")} changed in Google`, n("delete") && `${n("delete")} deleted from Google`,
        m("new") && `${m("new")} new from Google`, m("updated") && `${m("updated")} updated`, m("removed") && `${m("removed")} removed`, dumped && `${dumped} sent to the brain dump`].filter(Boolean);
      toast((parts.length ? `Calendar synced: ${parts.join(", ")}.` : "Calendar synced.") + (res.failed.length ? ` Couldn’t sync “${res.failed[0]}”${res.failed.length > 1 ? ` and ${res.failed.length - 1} more` : ""}.` : ""));
    });
  const reread = async () => {
    $("#cal-list").innerHTML = `<p class="hint">Reading ${esc(calNames())}…</p>`; $("#cal-apply").disabled = true;
    try { events = picked.length ? await Cal.fetchMany(k, token, picked) : []; } catch (err) { closeModal(); calError(err); return; }
    sim = await buildSync(getDay(k), k, events, { own: $("#cal-own").checked, routine: $("#cal-routine").checked }, simApi);
    $("#cal-list").innerHTML = listHTML(); $("#cal-dump-wrap").hidden = !skippedN(); const ap = $("#cal-apply"); ap.disabled = !anyChange(); ap.textContent = anyChange() ? (CAL_WRITE ? "Sync" : "Add to this day") : "Nothing to change";
  };
  ov.addEventListener("click", async e => {
    const x = e.target.closest(".cal-x"), rs = e.target.closest(".cal-restore"), sr = e.target.closest(".cal-showremoved"), chip = e.target.closest(".cal-chip");
    if (sr) { showRemoved = !showRemoved; $("#cal-cals").innerHTML = chipsHTML(); return; }
    if (rs) { hidden = hidden.filter(id => id !== rs.dataset.restore); setCalHidden(hidden); if (!hidden.length) showRemoved = false; $("#cal-cals").innerHTML = chipsHTML(); return; }
    if (x) {
      const id = x.dataset.hide, wasPicked = picked.some(c => c.id === id);
      hidden = hidden.concat(id); setCalHidden(hidden);
      if (wasPicked) { picked = picked.filter(c => c.id !== id); setCalChoice(picked.map(c => c.id)); }
      $("#cal-cals").innerHTML = chipsHTML();
      if (wasPicked) await reread();
      return;
    }
    if (!chip) return;
    const id = chip.dataset.cal, on = picked.some(c => c.id === id);
    picked = on ? picked.filter(c => c.id !== id) : visible().filter(c => c.id === id || picked.some(x2 => x2.id === c.id));
    chip.setAttribute("aria-pressed", String(!on));
    setCalChoice(picked.map(c => c.id));
    await reread();
  });
  ov.addEventListener("change", async e => {
    if (e.target.id !== "cal-own" && e.target.id !== "cal-routine") return;
    const o = { own: $("#cal-own").checked, routine: $("#cal-routine").checked };
    $("#cal-routine").disabled = !o.own;
    try { localStorage.setItem("hourbox-cal-push", JSON.stringify(o)); } catch (err) {}
    sim = await buildSync(getDay(k), k, events, o, simApi);
    $("#cal-list").innerHTML = listHTML(); $("#cal-dump-wrap").hidden = !skippedN(); $("#cal-apply").disabled = !anyChange();
  });
}


export { CAL_WRITE, CAL_SCOPES, CAL_SCOPE, Cal, placeNear, planCalendar, localGroups, ownRuns, calApi, simN, simApi, buildSync, calChoice, setCalChoice, calHidden, setCalHidden, calOpts, calError, calSync, openCalPreview };
