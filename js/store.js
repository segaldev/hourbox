import { modalOpen } from "./modals.js";
import { render } from "./render.js";
import { AUTH_ERR } from "./settings.js";
import { S } from "./state.js";
import { setBanner, setSync, toast } from "./ui.js";
import { $, esc } from "./util.js";

// ---------- persistence ----------
const LS_KEY = "hourbox-v1";          // plans for "use without an account" mode (this device only)
const CFG_KEY = "hourbox-github";     // device settings ({mode: "local"} = use without an account)
const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

// ---------- Firebase ----------
// This config only identifies the Firebase project; it is public by design.
// Your data is protected by Firestore security rules: each signed-in user can read and write only users/<their id>/.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB_vYCv1o3l986eD0v6fIQ_g4DxGorVpug",
  authDomain: "segaldev.github.io", // sign-in helper is served from this site (see segaldev/segaldev.github.io), so login works in installed apps
  projectId: "hourbox-63cd5",
  storageBucket: "hourbox-63cd5.firebasestorage.app",
  messagingSenderId: "587097578398",
  appId: "1:587097578398:web:84c0f720ad412a31fc548f",
};
const FB_VER = "10.14.1";
const USE_EMULATOR = new URLSearchParams(location.search).has("emulator");
const FB = { m: null, app: null, auth: null, db: null, user: null };
async function loadFirebase() {
  const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
  const mods = await Promise.all(["firebase-app.js", "firebase-auth.js", "firebase-firestore.js"].map(f => import(base + f)));
  FB.m = Object.assign({}, ...mods);
  const cfg = USE_EMULATOR ? { apiKey: "demo-key", authDomain: "localhost", projectId: "demo-hourbox", appId: "demo" } : FIREBASE_CONFIG;
  if (!cfg) throw new Error("not-configured");
  FB.app = FB.m.initializeApp(cfg);
  FB.auth = FB.m.getAuth(FB.app);
  FB.db = FB.m.initializeFirestore(FB.app, { ignoreUndefinedProperties: true,
    localCache: FB.m.persistentLocalCache({ tabManager: FB.m.persistentMultipleTabManager() }) });
  if (USE_EMULATOR) { FB.m.connectAuthEmulator(FB.auth, "http://127.0.0.1:9099", { disableWarnings: true }); FB.m.connectFirestoreEmulator(FB.db, "127.0.0.1", 8080); }
}
const userDocs = () => FB.m.collection(FB.db, "users", FB.user.uid, "docs");

const Store = {
  dirty: new Set(), timers: {}, unsub: null, slow: null,
  get busy() { return this.dirty.size > 0; },
  async init() {
    const cfg = lsGet(CFG_KEY);
    if (cfg && cfg.token) lsSet(CFG_KEY, cfg.mode === "local" ? { mode: "local" } : null); // forget the old GitHub version's token
    if (cfg && cfg.mode === "local") return this.startLocal();
    setSync("saving", "Connecting…");
    try { await loadFirebase(); }
    catch (e) {
      S.mode = "setup"; S.ready = true; S.fbError = e && e.message === "not-configured" ? "Hourbox isn’t connected to its database yet." : "Can’t load Hourbox’s sign-in. Check your connection and reload.";
      setSync("error", "Offline"); render(); return;
    }
    FB.m.onAuthStateChanged(FB.auth, user => this.onUser(user));
    FB.m.getRedirectResult(FB.auth).catch(e => { S.authErr = AUTH_ERR[e.code] || "Couldn’t log in with Google. Try again."; const m = $("#au-msg"); if (m) m.textContent = S.authErr; });
  },
  startLocal() {
    S.mode = "local"; S.showSetup = false;
    const cache = lsGet(LS_KEY); S.docs = (cache && cache.docs) || {};
    S.ready = true; setSync("local", "This device only");
    setBanner("You’re using Hourbox without an account, so plans are saved on this device only. <a href=\"#\" data-act=\"settings\">Log in</a> to sync.");
    render();
  },
  onUser(user) {
    if (this.unsub) { this.unsub(); this.unsub = null; }
    FB.user = user;
    if (!user) { if (S.mode === "local") return; S.docs = {}; S.mode = "setup"; S.showSetup = false; S.ready = true; setBanner(""); setSync("local", "Logged out"); render(); return; }
    S.mode = "fb"; S.showSetup = false; S.ready = false; S.docs = {}; setBanner(""); render();
    clearTimeout(this.slow);
    this.slow = setTimeout(() => { if (!S.ready) { S.ready = true; render(); } setBanner("Can’t reach the server. You can keep working; changes are saved on this device and sync when you’re back online."); }, 10000);
    this.unsub = FB.m.onSnapshot(userDocs(), { includeMetadataChanges: true }, snap => {
      const next = {}; snap.forEach(d => { next[d.id] = d.data(); });
      for (const id of this.dirty) if (S.docs[id]) next[id] = S.docs[id]; // your newest typing wins until it is written
      S.docs = next; S.ready = true;
      if (!snap.metadata.fromCache) { clearTimeout(this.slow); setBanner(""); }
      if (!this.busy) setSync(snap.metadata.hasPendingWrites ? "saving" : snap.metadata.fromCache ? "offline" : "ok", snap.metadata.hasPendingWrites ? "Saving…" : snap.metadata.fromCache ? "Offline, saved here" : "Synced");
      if (!modalOpen()) render();
    }, err => { clearTimeout(this.slow); S.ready = true; setSync("error", "Sync stopped"); setBanner("Sync stopped (" + esc(err.code || "error") + "). Reload the page to reconnect."); render(); });
  },
  save(id) {
    if (S.mode === "local") { lsSet(LS_KEY, { docs: S.docs }); return; }
    if (S.mode !== "fb") return;
    this.dirty.add(id); setSync("saving", "Saving…");
    clearTimeout(this.timers[id]); this.timers[id] = setTimeout(() => this.flush(id), 400);
  },
  flush(id) {
    if (!this.dirty.has(id) || !FB.user) return;
    this.dirty.delete(id);
    // Firestore keeps the write on this device right away and sends it when it can.
    FB.m.setDoc(FB.m.doc(userDocs(), id), S.docs[id]).catch(e => {
      setSync("error", "Not saved");
      toast(e && e.code === "permission-denied" ? "The server refused that change. Log out and in again." : "Couldn’t save that change. Try again in a moment.");
    });
  },
  flushNow() { [...this.dirty].forEach(id => { clearTimeout(this.timers[id]); this.flush(id); }); }
};
window.addEventListener("pagehide", () => Store.flushNow());
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") Store.flushNow(); });


export { LS_KEY, CFG_KEY, lsGet, lsSet, FIREBASE_CONFIG, FB_VER, USE_EMULATOR, FB, loadFirebase, userDocs, Store };
