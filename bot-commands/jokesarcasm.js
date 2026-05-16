const path = require('path');

module.exports.config = {
  name: "jokesarcasm",
  aliases: ["joke", "sarcasm", "tawa"],
  version: "1.0.0",
  role: 0,
  credits: "AutoBot",
  hasPrefix: false,
  description: "Automatic random joke and Tagalog sarcasm greet to random members every hour",
  usage: "",
  cooldowns: 0,
  category: "events"
};

const jokes = [
  'Bakit hindi makapag-aral ang espiritu? Kasi wala siyang katawan na pag-aralan! 👻😂',
  'Anong tawag sa nag-aaral sa loob ng eroplano? High school! ✈️😄',
  'Bakit lagi nagtatago ang mga matematiko? Kasi marami silang problema! 🔢😆',
  'Anong tawag sa isang baboy na may kuryente? Electric pig-let! ⚡🐷😂',
  'Bakit hindi kumakain ang basketball players ng donut? Kasi laging may loob ang problema! 🏀🍩',
  'Anong masasabi natin sa naging abogado ang calculator? Nagsisigurado na lagi may defense! 📱⚖️😄',
  'Bakit hindi makatulog ang blanket? Kasi covered na siya! 🛌😂',
  'Teacher: Anong chemical formula ng tubig? Student: H-I-J-K-L-M-N-O! Teacher: Bakit? Student: H to O! 💧😆',
  'Anong pinaka-mahal na damit? Wedding dress — one-time use pero habang buhay ang utang! 👰😂',
  'Bakit hindi lumalabas ang libro sa labas ng bahay? Kasi afraid na ma-spoil ang plot! 📚😄',
];

const sarcasms = [
  '🙄 Wow, {name}, ang galing mo talaga. Nag-reply ka nang 3 araw pagkatapos... pero okay lang, buhay ka pa naman.',
  '😌 {name} nag-online na pala! Akala ko forever na offline sa buhay namin ah. Welcome back!',
  '🤣 {name}, ang lalalim ng sinabi mo. Para kang... oh wait, wala. Pang-joke ka lang talaga.',
  '😏 {name} grabe ka talaga ha. Ang galing mo mag-type ng "haha" sa lahat ng message. Talent!',
  '🙃 {name} lagi kang present sa chat pero pag kailangan ng tawid sa buhay, wala ka. Characteristic.',
  '😂 {name} sana all! May oras pang mag-scroll ng chat kahit puno ng trabaho. Sana all may ganyang disiplina!',
  '🤨 {name} interesting decision yan. Sigurado ka ba diyan? Kasi... actually, bahala ka na.',
  '😅 {name} grabe ka mag-react ng haha. Kahit hindi funny, hahaha ka pa rin. Born comedian talaga!',
  '🙄 {name} sige keep scrolling. Kahit hindi naintindihan, react na agad. Signature move!',
  '😒 {name} ah, nagbasa ng message pero hindi nag-reply. Classic na classic move. 10/10.',
];

const greetState = new Map();
const GREET_INTERVAL = 60 * 60 * 1000;

module.exports.handleEvent = async function({ api, event, DATA_DIR }) {
  if (event.type !== 'message') return;
  if (!event.body || event.body.trim().length === 0) return;

  const { threadID } = event;
  const now = Date.now();
  const last = greetState.get(threadID) || 0;
  if (now - last < GREET_INTERVAL) return;

  const chance = Math.random();
  if (chance > 0.1) return;

  greetState.set(threadID, now);

  try {
    const threadInfo = await new Promise((res, rej) => {
      const r = api.getThreadInfo(threadID, (e, d) => e ? rej(e) : res(d));
      if (r && typeof r.then === 'function') r.then(res).catch(rej);
    });

    const participants = (threadInfo?.participantIDs || []).filter(id => id !== api.getCurrentUserID());
    if (participants.length === 0) return;

    const targetID = participants[Math.floor(Math.random() * participants.length)];

    let targetName = 'ka';
    try {
      const info = await new Promise((res, rej) => {
        const r = api.getUserInfo(targetID, (e, d) => e ? rej(e) : res(d));
        if (r && typeof r.then === 'function') r.then(res).catch(rej);
      });
      const u = info?.[targetID] || info?.[String(targetID)];
      if (u?.name) targetName = u.name.split(' ')[0];
    } catch {}

    const isJoke = Math.random() > 0.5;

    let msg;
    if (isJoke) {
      const joke = jokes[Math.floor(Math.random() * jokes.length)];
      msg = `😂 Hoy ${targetName}, narinig mo na ba ito?\n\n${joke}`;
    } else {
      const sarcasm = sarcasms[Math.floor(Math.random() * sarcasms.length)].replace(/{name}/g, targetName);
      msg = sarcasm;
    }

    const mentions = [{ tag: `@${targetName}`, id: targetID }];
    try {
      api.sendMessage({ body: msg, mentions }, threadID);
    } catch {
      api.sendMessage(msg, threadID);
    }
  } catch {}
};
