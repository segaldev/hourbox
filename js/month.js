import { summarize } from "./day.js";
import { S, getDay, getMonth, hasDay } from "./state.js";
import { esc, fmtDur, keyOf, parseKey, todayKey } from "./util.js";

function renderMonth() {
  const m = S.date.slice(0, 7), mo = getMonth(m), first = parseKey(m + "-01");
  const goals = mo.goals.map((g, i) => `<li><span class="prio-n">${i + 1}</span><textarea id="mg-${i}" class="goal-ta" data-input="goal" data-i="${i}" rows="1" placeholder="${i === 0 ? "A goal for this month" : "Another goal"}" maxlength="200">${esc(g)}</textarea></li>`).join("");
  const offset = (first.getDay() + 6) % 7; // Monday first
  const startD = new Date(first); startD.setDate(1 - offset);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const cells = Math.ceil((offset + last.getDate()) / 7) * 7;
  let html = ""; const tk = todayKey();
  for (let i = 0; i < cells; i++) {
    const dd = new Date(startD); dd.setDate(startD.getDate() + i); const k = keyOf(dd);
    const d = hasDay(k) ? getDay(k) : null; const sm = d ? summarize(d) : null;
    const pr = d ? d.prio.filter(p => p.text.trim()) : [];
    let bar = "";
    if (sm && sm.planned) { const n = Math.min(Math.ceil(sm.plannedMin / 60), 12), dn = Math.round(sm.doneMin / 60); for (let j = 0; j < n; j++) bar += `<i class="${j < dn ? "d" : "f"}"></i>`; }
    html += `<button class="dcell ${k.slice(0, 7) !== m ? "out" : ""} ${k === tk ? "today" : ""}" id="dc-${k}" data-act="open-day" data-k="${k}" aria-label="${dd.toDateString()}">
      <span class="dn"><span>${dd.getDate()}</span>${d && d.finished ? `<span class="fin" title="Finished">✓</span>` : ""}</span>
      ${pr.slice(0, 3).map(p => `<span class="dp ${p.done ? "done" : ""}">${esc(p.text)}</span>`).join("")}
      ${sm && sm.planned ? `<span class="dcount">${fmtDur(sm.doneMin)}/${fmtDur(sm.plannedMin)} done</span>` : ""}
      <span class="dbar">${bar}</span></button>`;
  }
  const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(w => `<div>${w}</div>`).join("");
  return `<div class="month">
    <aside class="pane goals"><div class="pane-head"><h2>Goals for ${first.toLocaleDateString([], { month: "long" })}</h2><span class="hint">Up to 5</span></div><ol>${goals}</ol></aside>
    <div class="month-main">
      <div class="cal"><div class="cal-head">${wd}</div><div class="cal-grid">${html}</div></div>
      <p class="hint">Tap any day to open it. Past days show what you planned and how it went. Future days can be planned ahead.</p>
    </div>
  </div>`;
}


export { renderMonth };
