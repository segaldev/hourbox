import { $ } from "./util.js";

function setSync(s, text) { const el = $("#sync"); el.dataset.s = s; el.textContent = text; }
function setBanner(html) { $("#banner").innerHTML = html ? `<div class="banner">${html}</div>` : ""; }
let toastT;
function toast(msg, action) { // action: {label, act} shows a button, e.g. Undo
  const t = $("#toast"); t.textContent = msg;
  if (action) { const b = document.createElement("button"); b.className = "toast-btn"; b.dataset.act = action.act; b.textContent = action.label; t.append(" ", b); }
  t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, action ? 8000 : 2600);
}


export { setSync, setBanner, toastT, toast };
