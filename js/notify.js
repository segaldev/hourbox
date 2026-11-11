import { render } from "./render.js";
import { S, getDay, mutateDay } from "./state.js";
import { toast } from "./ui.js";
import { keyAt, lenOfKey, minOfKey, slotRange, sortedKeys, timeLabel, todayKey } from "./util.js";

// ---------- box notifications ----------
// While Hourbox is open, tell me when a box ends and the next one starts. Per device.
const NOTIFY_KEY = "hourbox-notify";
const Notify = {
  supported: "Notification" in window,
  get on() { try { return this.supported && Notification.permission === "granted" && localStorage.getItem(NOTIFY_KEY) === "on"; } catch (e) { return false; } },
  reg: null, lastMin: null,
  async ensureWorker() {
    if (this.reg || !("serviceWorker" in navigator)) return this.reg;
    try { this.reg = await navigator.serviceWorker.register("sw.js"); await navigator.serviceWorker.ready; } catch (e) { this.reg = null; }
    return this.reg;
  },
  async enable() {
    if (!this.supported) return;
    let perm = Notification.permission;
    if (perm === "default") { try { perm = await Notification.requestPermission(); } catch (e) {} }
    if (perm === "granted") { try { localStorage.setItem(NOTIFY_KEY, "on"); } catch (e) {} await this.ensureWorker(); this.lastMin = null; toast("Notifications are on for this device."); }
    else toast("Notifications weren’t allowed. You can allow them in this browser’s site settings.");
    if (S.showSetup) render();
  },
  disable() { try { localStorage.removeItem(NOTIFY_KEY); } catch (e) {} toast("Notifications are off for this device."); if (S.showSetup) render(); },
  async show(title, body, opts = {}) {
    const o = Object.assign({ body, icon: "icon-180.png", badge: "icon-180.png", tag: opts.tag, renotify: true, data: opts.data || {} }, opts.actions ? { actions: opts.actions } : {});
    const reg = await this.ensureWorker();
    try { if (reg) return await reg.showNotification(title, o); } catch (e) {}
    try { delete o.actions; new Notification(title, o); } catch (e) {} // desktop fallback
  },
  // What changes at minute m today: the box that ends there and the one that starts there.
  event(d, m) {
    let prev = null, next = null;
    for (const [k, b] of Object.entries(d.boxes)) {
      const s0 = minOfKey(k), e0 = s0 + lenOfKey(d, k);
      if (e0 === m) prev = [k, b];
      if (s0 === m) next = [k, b];
    }
    if (prev && next && prev[1].text === next[1].text) return null; // same activity continues
    return prev || next ? { prev, next } : null;
  },
  nextBoxAfter(d, m) { const ks = sortedKeys(d).filter(k => minOfKey(k) >= m); return ks.length ? ks[0] : null; },
  tick() {
    if (!this.on || !S.ready || S.mode === "setup") { this.lastMin = null; return; }
    const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes(), k = todayKey();
    if (this.lastMin == null || this.lastMin > nowMin) { this.lastMin = nowMin; return; } // start fresh: never announce the past
    const from = this.lastMin; this.lastMin = nowMin;
    const d = getDay(k); if (d.finished) return;
    for (let m = from + 1; m <= nowMin; m++) {
      if (nowMin - m > 3) continue; // came back after a long sleep: skip stale changes
      const ev = this.event(d, m); if (!ev) continue;
      const { prev, next } = ev;
      let title, body;
      if (next) { title = `Now: ${next[1].text}`; body = slotRange(d, next[0]) + (prev ? ` · “${prev[1].text}” has ended` : ""); }
      else { const nk = this.nextBoxAfter(d, m); title = `“${prev[1].text}” has ended`; body = nk ? `Nothing boxed until ${timeLabel(minOfKey(nk))}.` : "Nothing else is boxed today."; }
      const canMark = prev && (prev[1].status || "planned") === "planned";
      if (document.visibilityState === "visible" && document.hasFocus()) { toast(`${title}. ${body}`); continue; }
      this.show(title, body, { tag: `hourbox-${k}-${m}`, data: canMark ? { date: k, key: prev[0] } : {},
        actions: canMark ? [{ action: "done", title: "Mark done" }] : undefined });
    }
  }
};
setInterval(() => Notify.tick(), 15000);
document.addEventListener("visibilitychange", () => Notify.tick());
if (Notify.on) Notify.ensureWorker();
if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", ev => {
  const m = ev.data || {}; if (m.type !== "hourbox-mark-done") return;
  const key = keyAt(minOfKey(m.key)); // older notifications used keys like "9"
  const d = getDay(m.date); if (!d.boxes[key]) return;
  mutateDay(m.date, dd => { if (dd.boxes[key]) dd.boxes[key].status = "done"; });
  toast(`Marked “${d.boxes[key].text}” done.`);
});

export { NOTIFY_KEY, Notify };
