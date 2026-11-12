// Quote of the day: a short Stoic, Zen or other contemplative line beside the planner. Turned on in Settings (saved in
// your account). The list ships with the app, so it works offline and never breaks. Each day shows one quote, the same
// on every device.
import { render } from "./render.js";
import { S, mutate } from "./state.js";
import { esc, parseKey } from "./util.js";

// The quotes (over a thousand) live in quotes-data.js, loaded only when the quote is turned on.
let QUOTES = null, loading = null;
function loadQuotes() {
  if (QUOTES || loading) return;
  loading = import("./quotes-data.js").then(m => { QUOTES = m.QUOTES; render(); }).catch(() => { loading = null; });
}

const quotesOn = () => !!(S.docs.settings && S.docs.settings.quote);
const setQuotesOn = on => mutate("settings", Object.assign({ kind: "settings" }, S.docs.settings || {}), st => { st.quote = on; });
const baseIdx = k => { const N = QUOTES.length, day = Math.round(parseKey(k).getTime() / 864e5); return ((day * 389) % N + N) % N; };
// the same quote for a given date everywhere; neighbouring days differ. The reload button picks another one,
// for this window only (a reload brings back the quote of the day).
const shown = {};
const quoteIdx = k => shown[k] != null ? shown[k] : baseIdx(k);
const quoteFor = k => QUOTES[quoteIdx(k)];
function nextQuote(k) { if (!QUOTES) return; const N = QUOTES.length; shown[k] = (quoteIdx(k) + 1 + Math.floor(Math.random() * (N - 1))) % N; }
function renderQuote(k) {
  if (!quotesOn()) return "";
  if (!QUOTES) { loadQuotes(); return ""; }
  const [text, who, work, tr] = quoteFor(k);
  return `<figure class="quote" id="quote"><span class="qlabel">Quote of the day</span><blockquote>${esc(text)}</blockquote><figcaption>${esc(who)}${work ? `, <cite>${esc(work)}</cite>` : ""}${tr ? `<span class="qtr">, tr. ${esc(tr)}</span>` : ""}</figcaption>
    <button type="button" class="qnext" data-act="quote-next" id="quote-next" aria-label="Show another quote" title="Another quote"><svg viewBox="0 0 24 24"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/></svg></button></figure>`;
}
function renderQuoteSettings() {
  const on = quotesOn();
  return `<section class="pane setup"><div class="pane-head"><h2>Quote of the day</h2></div>
    <p>${on ? "On. A short Stoic or Zen quote sits beside the planner, a different one each day. The ↻ button shows another." : "Show a short Stoic or Zen quote beside the planner, a different one each day, from over a thousand."}</p>
    <div class="setup-actions">${on ? `<button class="btn ghost" type="button" data-act="quote-off" id="qt-off">Turn off</button>` : `<button class="btn primary" type="button" data-act="quote-on" id="qt-on">Show a quote each day</button>`}</div>
  </section>`;
}

export { quotesOn, setQuotesOn, quoteFor, nextQuote, renderQuote, renderQuoteSettings };
