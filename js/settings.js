import { Notify } from "./notify.js";
import { S, getDay, getRoutine } from "./state.js";
import { FB, Store } from "./store.js";
import { toast } from "./ui.js";
import { $, ICON, TAGS, esc, fmtDur, parseKey, timeLabel } from "./util.js";
/* global STYLE_FONTS, loadStyleFonts */


const LENS = [15, 30, 45, 60, 90, 120, 180];
const DAYN = ["M", "T", "W", "T", "F", "S", "S"], DAYFULL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function routineWarnings(items) {
  const w = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j]; if (!a.text.trim() || !b.text.trim()) continue;
    const days = (a.days || [0,1,2,3,4,5,6]).filter(x => (b.days || [0,1,2,3,4,5,6]).includes(x));
    if (days.length && a.start < b.start + b.len && b.start < a.start + a.len) w.push(`“${a.text}” and “${b.text}” overlap. The later one won’t be added on those days.`);
  }
  return w;
}
function renderRoutine() {
  const items = getRoutine().items.slice().sort((a, b) => a.start - b.start);
  const timeOpts = v => Array.from({ length: 96 }, (_, i) => i * 15).map(m => `<option value="${m}" ${m === v ? "selected" : ""}>${timeLabel(m)}</option>`).join("");
  const lenOpts = v => LENS.map(m => `<option value="${m}" ${m === v ? "selected" : ""}>${fmtDur(m)}</option>`).join("");
  const tagOpts = v => TAGS.map(([t, n]) => `<option value="${t}" ${t === (v || "") ? "selected" : ""}>${t ? n : "No tag"}</option>`).join("");
  const rows = items.map(it => `<div class="rt-row">
      <select id="rt-${it.id}-start" data-rt="start" data-id="${it.id}" aria-label="Start time">${timeOpts(it.start)}</select>
      <select id="rt-${it.id}-len" data-rt="len" data-id="${it.id}" aria-label="Length">${lenOpts(it.len)}</select>
      <input type="text" id="rt-${it.id}-text" data-rt="text" data-id="${it.id}" value="${esc(it.text)}" placeholder="What happens" maxlength="80" aria-label="Activity">
      <select id="rt-${it.id}-tag" data-rt="tag" data-id="${it.id}" aria-label="Tag">${tagOpts(it.tag)}</select>
      <label class="flexchk" for="rt-${it.id}-flex"><input type="checkbox" class="check" id="rt-${it.id}-flex" data-rt="flex" data-id="${it.id}" ${it.flex ? "checked" : ""}> Flexible</label>
      <div class="rt-days" role="group" aria-label="Days">${DAYN.map((n, i) => `<button type="button" class="dchip" id="rt-${it.id}-d${i}" data-act="rt-day" data-id="${it.id}" data-d="${i}" aria-pressed="${(it.days || [0,1,2,3,4,5,6]).includes(i)}" title="${DAYFULL[i]}">${n}</button>`).join("")}</div>
      <button type="button" class="mini" id="rt-${it.id}-del" data-act="rt-del" data-id="${it.id}" title="Remove from routine" aria-label="Remove from routine">${ICON.x}</button>
    </div>`).join("");
  const warn = routineWarnings(items);
  return `<section class="pane setup routine">
    <div class="pane-head"><h2>Daily routine</h2><button class="btn primary" type="button" data-act="setup-back" id="rt-back">Back to planner</button></div>
    <p>Every new day starts with these boxes. <b>Flexible</b> ones (dashed outline) move to the nearest free time when you drop something on them. Changes apply to days you haven’t touched yet. For a day that already exists, use <i>Add routine</i> on that day.</p>
    <div class="rt-list">${rows || `<p class="empty-note">No routine yet.</p>`}</div>
    ${warn.length ? `<p class="hint err">${warn.map(esc).join("<br>")}</p>` : ""}
    <div class="setup-actions"><button class="btn" type="button" data-act="rt-add" id="rt-add">+ Add routine item</button></div>
  </section>`;
}
const AUTH_ERR = {
  "auth/unauthorized-domain": "This website isn’t allowed to sign in yet. In Firebase, add segaldev.github.io under Authentication → Settings → Authorized domains.",
  "auth/operation-not-allowed": "Google sign-in isn’t turned on yet. In Firebase, enable Google under Authentication → Sign-in method.",
  "auth/network-request-failed": "Can’t reach Google. Check your connection and try again.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/user-disabled": "This account has been disabled.",
};
const GOOGLE_G = '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
function renderAuth() {
  const action = S.fbError
    ? `<p class="welcome-err">${esc(S.fbError)}</p>`
    : `<button class="btn google" type="button" data-act="google" id="au-google">${GOOGLE_G}<span>Continue with Google</span></button>
       <p class="hint err" id="au-msg" role="status"></p>`;
  return `<section class="welcome">
    <div class="welcome-brand"><span class="brand-mark big" aria-hidden="true"></span><h1>Hourbox</h1></div>
    <p class="welcome-lead">Plan your day in boxes of time.</p>
    <p class="welcome-text">Pick your top 3 priorities, empty your head into a brain dump, then give each task its own hour, or half or quarter hour. Boxes never overlap, so your plan fits the day you actually have. At night, finish the day with a short review.</p>
    <div class="welcome-demo" aria-hidden="true">
      <div><span>6:00</span><i>Get ready</i></div>
      <div><span>7:00</span><i>Kids to school</i></div>
      <div class="flex"><span>8:00</span><i>Walk</i></div>
      <div class="done"><span>9:00</span><i>Deep work: Q4 plan</i></div>
    </div>
    <div class="welcome-actions">${action}</div>
    <p class="welcome-foot">Your plans are private to your account and sync between your devices.<br>
      <button class="linkbtn" type="button" data-act="use-local" id="su-local">Use without an account</button> to keep them on this device only.</p>
  </section>`;
}
function getAppearance() { try { const t = localStorage.getItem("hourbox-appearance"); return t === "light" || t === "dark" ? t : "auto"; } catch (e) { return "auto"; } }
function setAppearance(t) {
  try { t === "auto" ? localStorage.removeItem("hourbox-appearance") : localStorage.setItem("hourbox-appearance", t); } catch (e) {}
  if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t);
  const m = { light: "#EEECE6", dark: "#151513" };
  document.querySelectorAll('meta[name="theme-color"]').forEach(el => { if (t === "auto") el.setAttribute("content", /dark/.test(el.media) ? m.dark : m.light); else el.setAttribute("content", m[t]); });
}
const STYLES = [
  { v: "washi", name: "Washi", mood: "Japanese notebook: dot-grid paper, ink and a vermilion seal.", sw: ["#EEECE6", "#FAF9F5", "#1E1D1B", "#2D4868", "#B4432E"], font: "'Shippori Mincho', serif" },
  { v: "sage", name: "Sage Garden", mood: "Soft sage and stone, a faint leaf, calm and gentle.", sw: ["#EDF1EB", "#FAFBF8", "#1F2A24", "#4D7A61", "#C58A3E"], font: "'Newsreader', serif" },
  { v: "deep", name: "Deep Water", mood: "Night-ocean blues, sea-glass teal, the current hour glows.", sw: ["#0C1A23", "#11232E", "#DCE8EE", "#6CC6C2", "#F2C46D"], font: "'Manrope', sans-serif" },
  { v: "mist", name: "Morning Mist", mood: "Airy periwinkle haze, frosted panels, italic headings.", sw: ["#F0F1F7", "#D8D9F4", "#222436", "#5862B6", "#E0896A"], font: "'Instrument Serif', serif", italic: true },
];
function getStyle() { try { const v = localStorage.getItem("hourbox-style"); return STYLES.some(x => x.v === v) ? v : "washi"; } catch (e) { return "washi"; } }
function setStyle(v) {
  try { v === "washi" ? localStorage.removeItem("hourbox-style") : localStorage.setItem("hourbox-style", v); } catch (e) {}
  if (v === "washi") document.documentElement.removeAttribute("data-style"); else { document.documentElement.setAttribute("data-style", v); loadStyleFonts(v); }
  syncThemeColor();
}
function syncThemeColor() { // phone status bar follows the page background
  const desk = getComputedStyle(document.documentElement).getPropertyValue("--desk").trim();
  if (desk) document.querySelectorAll('meta[name="theme-color"]').forEach(el => el.setAttribute("content", desk));
}
try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncThemeColor); } catch (e) {}
function renderLook() {
  const cur = getAppearance(), st = getStyle();
  Object.keys(STYLE_FONTS).forEach(loadStyleFonts); // so each card shows its own typeface
  const opt = (v, label) => `<button type="button" class="chip" id="ap-${v}" data-act="appearance" data-v="${v}" aria-pressed="${cur === v}">${label}</button>`;
  return `<section class="pane setup look">
    <div class="pane-head"><h2>Look</h2><button class="btn primary" type="button" data-act="setup-back" id="look-back">Back to planner</button></div>
    <p class="sect-title">Theme</p>
    <div class="chips">${opt("light", "Light")}${opt("dark", "Dark")}${opt("auto", "System")}</div>
    <p class="sect-title" style="margin-top:18px">Style</p>
    <div class="style-grid">${STYLES.map(x => `<button type="button" class="style-card" id="style-${x.v}" data-act="style" data-v="${x.v}" aria-pressed="${st === x.v}">
      <span class="style-sw">${x.sw.map(c => `<i style="background:${c}"></i>`).join("")}</span>
      <span class="style-name" style="font-family:${x.font};${x.italic ? "font-style:italic;font-weight:400;" : ""}">${x.name}</span>
      <span class="style-mood">${x.mood}</span>
      ${st === x.v ? `<span class="style-on">In use</span>` : ""}</button>`).join("")}</div>
    <p class="hint">Theme and style are saved on this device, so your phone and Mac can look different.</p>
  </section>`;
}
function renderSetup() {
  if (S.mode === "setup") return renderAuth();
  const account = S.mode === "fb" ? `<section class="pane setup">
    <div class="pane-head"><h2>Account</h2></div>
    <p>Logged in as <b>${esc(FB.user && FB.user.email || "")}</b>. Your plans sync between your devices.</p>
    <div class="setup-actions"><button class="btn ghost" type="button" data-act="logout" id="su-logout">Log out</button></div>
  </section>` : `<section class="pane setup">
    <div class="pane-head"><h2>Account</h2></div>
    <p>You’re using Hourbox without an account, so plans stay on this device.</p>
    <div class="setup-actions"><button class="btn primary" type="button" data-act="to-login" id="su-login">Log in or create an account</button></div>
  </section>`;
  return renderRoutine() + renderCalendarSettings() + renderNotify() + account;
}
async function googleSignIn() {
  const msg = $("#au-msg"), btn = $("#au-google");
  const provider = new FB.m.GoogleAuthProvider(); provider.setCustomParameters({ prompt: "select_account" });
  btn.disabled = true; msg.textContent = "";
  try { await FB.m.signInWithPopup(FB.auth, provider); toast("Logged in."); }
  catch (e) {
    btn.disabled = false;
    if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
      try { await FB.m.signInWithRedirect(FB.auth, provider); return; } catch (e2) { msg.textContent = AUTH_ERR[e2.code] || "Couldn’t open Google sign-in. Try again in Safari."; return; }
    }
    if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") return;
    msg.textContent = AUTH_ERR[e.code] || "Couldn’t log in with Google. Try again.";
  }
}
async function logout() {
  Store.flushNow();
  try { await FB.m.signOut(FB.auth); } catch (e) {}
  // remove this device's offline copy of your plans
  try { await FB.m.terminate(FB.db); await FB.m.clearIndexedDbPersistence(FB.db); } catch (e) {}
  location.reload();
}

function renderCalendarSettings() {
  if (S.mode !== "fb") return "";
  const k = S.date, d = getDay(k), label = parseKey(k).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  return `<section class="pane setup"><div class="pane-head"><h2>Google Calendar</h2></div>
    <p>Bring a day’s events from your Google calendars into its boxes. Hourbox only reads your calendar and never changes it.</p>
    <div class="setup-actions"><button class="btn primary" type="button" data-act="cal-sync" id="cal-sync" data-label="Sync ${esc(label)}" ${d.finished ? "disabled" : ""}><span class="btnicon">${ICON.cal}</span><span>Sync ${esc(label)}</span></button></div>
    <p class="hint">${d.finished ? "This day is finished. Reopen it to sync its calendar." : "Syncs the day you’re looking at. To sync another day, open that day first."}</p></section>`;
}
function renderNotify() {
  let body;
  if (!Notify.supported) body = `<p class="hint">This browser can’t show notifications.</p>`;
  else if (Notification.permission === "denied") body = `<p>Notifications are blocked for Hourbox in this browser. Allow them in the browser’s site settings for ${esc(location.host)}, then come back here.</p>`;
  else if (Notify.on) body = `<p>On for this device. You’ll get a notification when a box ends and the next one starts.</p>
    <div class="setup-actions"><button class="btn" type="button" data-act="notify-test" id="nt-test">Send a test</button><button class="btn ghost" type="button" data-act="notify-off" id="nt-off">Turn off</button></div>`;
  else body = `<p>Get a notification when a box ends and the next one starts. It works while Hourbox is open on this device, even in the background.</p>
    <div class="setup-actions"><button class="btn primary" type="button" data-act="notify-on" id="nt-on">Turn on notifications</button></div>`;
  return `<section class="pane setup"><div class="pane-head"><h2>Notifications</h2></div>${body}</section>`;
}


export { LENS, DAYN, DAYFULL, routineWarnings, renderRoutine, AUTH_ERR, GOOGLE_G, renderAuth, getAppearance, setAppearance, STYLES, getStyle, setStyle, syncThemeColor, renderLook, renderSetup, googleSignIn, logout, renderCalendarSettings, renderNotify };
