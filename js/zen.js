// Zen mode: only the box you're in right now, big, with a slowly filling circle for its time. Always about today.
import { getDay } from "./state.js";
import { esc, lenOfKey, minOfKey, sortedKeys, timeLabel, todayKey, fmtDur } from "./util.js";

const R = 46, C = 2 * Math.PI * R; // ring radius in the 100×100 drawing, and its length
let timer = null, wake = null;

const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes() + n.getSeconds() / 60; };

// The box at minute m, joined with the boxes right before and after it that have the same name (a 2-hour block in 1-hour boxes).
function currentBlock(d, m) {
  const ks = sortedKeys(d), i = ks.findIndex(k => minOfKey(k) <= m && m < minOfKey(k) + lenOfKey(d, k));
  if (i < 0) return null;
  const name = k => (d.boxes[k].text || "").trim().toLowerCase();
  let a = i, b = i;
  while (a > 0 && name(ks[a - 1]) === name(ks[i]) && minOfKey(ks[a - 1]) + lenOfKey(d, ks[a - 1]) === minOfKey(ks[a])) a--;
  while (b < ks.length - 1 && name(ks[b + 1]) === name(ks[i]) && minOfKey(ks[b]) + lenOfKey(d, ks[b]) === minOfKey(ks[b + 1])) b++;
  return { box: d.boxes[ks[i]], start: minOfKey(ks[a]), end: minOfKey(ks[b]) + lenOfKey(d, ks[b]) };
}
const nextBox = (d, m) => { const k = sortedKeys(d).find(x => minOfKey(x) > m); return k ? { box: d.boxes[k], start: minOfKey(k) } : null; };

function left(min) {
  if (min < 1) return "Almost done";
  if (min < 60) return `${Math.ceil(min)} min left`;
  return `${fmtDur(Math.round(min / 5) * 5)} left`;
}

function draw() {
  const root = document.getElementById("zen-root"); if (!root) return;
  const d = getDay(todayKey()), m = nowMin(), cur = currentBlock(d, m);
  let html;
  if (cur) {
    const p = Math.min(1, Math.max(0, (m - cur.start) / (cur.end - cur.start)));
    html = `<p class="zen-time">${timeLabel(cur.start)} – ${timeLabel(cur.end)}</p>
      <h1 class="zen-task" id="zen-task">${esc(cur.box.text || "Untitled box")}</h1>
      <div class="zen-ring" role="img" aria-label="${esc(left(cur.end - m))}">
        <svg viewBox="0 0 100 100"><circle class="zen-track" cx="50" cy="50" r="${R}"/><circle class="zen-fill" cx="50" cy="50" r="${R}" style="stroke-dasharray:${C.toFixed(2)};stroke-dashoffset:${(C * (1 - p)).toFixed(2)}"/></svg>
        <span class="zen-left" id="zen-left">${esc(left(cur.end - m))}</span>
      </div>`;
  } else {
    const nx = nextBox(d, m);
    html = `<p class="zen-time">Now</p>
      <h1 class="zen-task zen-free" id="zen-task">Nothing boxed right now</h1>
      <div class="zen-ring" role="img" aria-label="Free time"><svg viewBox="0 0 100 100"><circle class="zen-track" cx="50" cy="50" r="${R}"/></svg>
        <span class="zen-left" id="zen-left">${nx ? `Next at ${timeLabel(nx.start)}:<br>${esc(nx.box.text)}` : "Free time"}</span></div>`;
  }
  const body = root.querySelector(".zen-body");
  // keep the circle element when only its progress changed, so it fills smoothly instead of jumping
  const fill = body.querySelector(".zen-fill"), task = body.querySelector("#zen-task");
  if (fill && cur && task && task.textContent === (cur.box.text || "Untitled box") && body.dataset.start == cur.start) {
    const p = Math.min(1, Math.max(0, (m - cur.start) / (cur.end - cur.start)));
    fill.style.strokeDashoffset = (C * (1 - p)).toFixed(2);
    body.querySelector("#zen-left").textContent = left(cur.end - m);
  } else { body.innerHTML = html; body.dataset.start = cur ? cur.start : ""; }
}

async function keepAwake() { try { if ("wakeLock" in navigator && document.visibilityState === "visible") wake = await navigator.wakeLock.request("screen"); } catch (e) {} }

function openZen() {
  if (document.getElementById("zen-root")) return;
  document.body.insertAdjacentHTML("beforeend", `<div id="zen-root" class="zen" role="dialog" aria-modal="true" aria-label="Zen mode">
    <button class="zen-x" type="button" data-act="zen-exit" id="zen-exit" aria-label="Leave zen mode" title="Leave zen mode (Esc)">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <div class="zen-body"></div></div>`);
  document.body.classList.add("zen-on");
  draw(); timer = setInterval(draw, 5000); keepAwake();
  document.getElementById("zen-exit").focus();
}
function closeZen() {
  document.getElementById("zen-root")?.remove(); document.body.classList.remove("zen-on");
  clearInterval(timer); timer = null; try { wake && wake.release(); } catch (e) {} wake = null;
  document.getElementById("zen")?.focus();
}
const zenOpen = () => !!document.getElementById("zen-root");
document.addEventListener("visibilitychange", () => { if (zenOpen()) { draw(); keepAwake(); } });

export { openZen, closeZen, zenOpen, currentBlock };
