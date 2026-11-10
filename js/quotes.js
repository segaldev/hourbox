// Quote of the day: a short Stoic or Zen line at the top of the planner. Turned on in Settings (saved in your account).
// The list lives here so it works offline and never breaks. Each day shows one quote, the same on every device.
import { S, mutate } from "./state.js";
import { esc, parseKey } from "./util.js";

const QUOTES = [
  // Stoic
  ["Waste no more time arguing about what a good man should be. Be one.", "Marcus Aurelius", "Meditations"],
  ["If it is not right, do not do it; if it is not true, do not say it.", "Marcus Aurelius", "Meditations"],
  ["The impediment to action advances action. What stands in the way becomes the way.", "Marcus Aurelius", "Meditations"],
  ["Very little is needed to make a happy life; it is all within yourself, in your way of thinking.", "Marcus Aurelius", "Meditations"],
  ["Confine yourself to the present.", "Marcus Aurelius", "Meditations"],
  ["Loss is nothing else but change, and change is Nature’s delight.", "Marcus Aurelius", "Meditations"],
  ["How much more grievous are the consequences of anger than the causes of it.", "Marcus Aurelius", "Meditations"],
  ["The best revenge is not to be like your enemy.", "Marcus Aurelius", "Meditations"],
  ["Look within. Within is the fountain of good, and it will ever bubble up, if you will ever dig.", "Marcus Aurelius", "Meditations"],
  ["Never let the future disturb you. You will meet it, if you have to, with the same weapons of reason which today arm you against the present.", "Marcus Aurelius", "Meditations"],
  ["Dwell on the beauty of life. Watch the stars, and see yourself running with them.", "Marcus Aurelius", "Meditations"],
  ["The soul becomes dyed with the color of its thoughts.", "Marcus Aurelius", "Meditations"],
  ["Receive without pride, let go without attachment.", "Marcus Aurelius", "Meditations"],
  ["Our life is what our thoughts make it.", "Marcus Aurelius", "Meditations"],
  ["Do every act of your life as though it were the very last act of your life.", "Marcus Aurelius", "Meditations"],
  ["We suffer more often in imagination than in reality.", "Seneca", "Letters to Lucilius"],
  ["While we are postponing, life speeds by.", "Seneca", "Letters to Lucilius"],
  ["It is not that we have a short time to live, but that we waste a lot of it.", "Seneca", "On the Shortness of Life"],
  ["Begin at once to live, and count each separate day as a separate life.", "Seneca", "Letters to Lucilius"],
  ["As long as you live, keep learning how to live.", "Seneca", "Letters to Lucilius"],
  ["Wherever there is a human being, there is an opportunity for a kindness.", "Seneca", ""],
  ["Associate with people who are likely to improve you.", "Seneca", "Letters to Lucilius"],
  ["Hold every hour in your grasp. Lay hold of today’s task, and you will not need to depend so much upon tomorrow’s.", "Seneca", "Letters to Lucilius"],
  ["The whole future lies in uncertainty: live immediately.", "Seneca", "On the Shortness of Life"],
  ["If a man knows not to which port he sails, no wind is favorable.", "Seneca", "Letters to Lucilius"],
  ["Difficulties strengthen the mind, as labor does the body.", "Seneca", ""],
  ["Men are disturbed not by things, but by the opinions about things.", "Epictetus", "Enchiridion"],
  ["First say to yourself what you would be; and then do what you have to do.", "Epictetus", "Discourses"],
  ["No great thing is created suddenly.", "Epictetus", "Discourses"],
  ["Make the best use of what is in your power, and take the rest as it happens.", "Epictetus", ""],
  ["If you want to improve, be content to be thought foolish and stupid.", "Epictetus", "Enchiridion"],
  ["He is a wise man who does not grieve for the things which he has not, but rejoices for those which he has.", "Epictetus", ""],
  ["Wealth consists not in having great possessions, but in having few wants.", "Epictetus", ""],
  ["No man is free who is not master of himself.", "Epictetus", ""],
  ["First learn the meaning of what you say, and then speak.", "Epictetus", ""],
  ["Well-being is realized by small steps, but is truly no small thing.", "Zeno of Citium", ""],
  // Zen
  ["In the beginner’s mind there are many possibilities, but in the expert’s there are few.", "Shunryu Suzuki", "Zen Mind, Beginner’s Mind"],
  ["Zen is not some kind of excitement, but concentration on our usual everyday routine.", "Shunryu Suzuki", "Zen Mind, Beginner’s Mind"],
  ["When you do something, you should burn yourself completely, like a good bonfire, leaving no trace of yourself.", "Shunryu Suzuki", "Zen Mind, Beginner’s Mind"],
  ["Leave your front door and your back door open. Let thoughts come and go. Just don’t serve them tea.", "Shunryu Suzuki", ""],
  ["Before enlightenment, chop wood, carry water. After enlightenment, chop wood, carry water.", "Zen proverb", ""],
  ["When walking, walk. When eating, eat.", "Zen proverb", ""],
  ["Sitting quietly, doing nothing, spring comes, and the grass grows by itself.", "Zen saying", ""],
  ["Let go, or be dragged.", "Zen proverb", ""],
  ["No snowflake ever falls in the wrong place.", "Zen saying", ""],
  ["When hungry, eat; when tired, sleep.", "Zen saying", ""],
  ["Fall seven times, stand up eight.", "Japanese proverb", ""],
  ["Every day is a good day.", "Yunmen", ""],
  ["Not knowing is most intimate.", "Dizang", ""],
  ["The Great Way is not difficult for those who have no preferences.", "Sengcan", "Xinxin Ming"],
  ["Do not seek the truth; only cease to cherish opinions.", "Sengcan", "Xinxin Ming"],
  ["To study the Buddha way is to study the self. To study the self is to forget the self.", "Dōgen", "Genjōkōan"],
  ["If you cannot find the truth right where you are, where else do you expect to find it?", "Dōgen", ""],
  ["The old pond; a frog jumps in — the sound of water.", "Matsuo Bashō", ""],
  ["Do not seek to follow in the footsteps of the wise; seek what they sought.", "Matsuo Bashō", ""],
  ["The present moment is filled with joy and happiness. If you are attentive, you will see it.", "Thich Nhat Hanh", ""],
  ["Walk as if you are kissing the Earth with your feet.", "Thich Nhat Hanh", ""],
  ["Smile, breathe and go slowly.", "Thich Nhat Hanh", ""],
  ["Feelings come and go like clouds in a windy sky. Conscious breathing is my anchor.", "Thich Nhat Hanh", ""],
];

const quotesOn = () => !!(S.docs.settings && S.docs.settings.quote);
const setQuotesOn = on => mutate("settings", Object.assign({ kind: "settings" }, S.docs.settings || {}), st => { st.quote = on; });
function quoteFor(k) { // the same quote for a given date everywhere; neighbouring days differ
  const day = Math.round(parseKey(k).getTime() / 864e5);
  return QUOTES[((day * 37) % QUOTES.length + QUOTES.length) % QUOTES.length];
}
function renderQuote(k) {
  if (!quotesOn()) return "";
  const [text, who, src] = quoteFor(k);
  return `<figure class="quote" id="quote"><blockquote>${esc(text)}</blockquote><figcaption>${esc(who)}${src ? `, <cite>${esc(src)}</cite>` : ""}</figcaption></figure>`;
}
function renderQuoteSettings() {
  const on = quotesOn();
  return `<section class="pane setup"><div class="pane-head"><h2>Quote of the day</h2></div>
    <p>${on ? "On. A short Stoic or Zen quote sits at the top of the planner, a different one each day." : "Show a short Stoic or Zen quote at the top of the planner, a different one each day."}</p>
    <div class="setup-actions">${on ? `<button class="btn ghost" type="button" data-act="quote-off" id="qt-off">Turn off</button>` : `<button class="btn primary" type="button" data-act="quote-on" id="qt-on">Show a quote each day</button>`}</div>
  </section>`;
}

export { QUOTES, quotesOn, setQuotesOn, quoteFor, renderQuote, renderQuoteSettings };
