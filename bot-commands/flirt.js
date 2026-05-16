const fs = require('fs');
const path = require('path');

module.exports.config = {
  name: "flirt",
  aliases: ["flirtevent", "hugot"],
  version: "1.0.0",
  role: 0,
  credits: "AutoBot",
  hasPrefix: false,
  description: "Automatic flirt random target in GC with Tagalog hugot lines",
  usage: "",
  cooldowns: 0,
  category: "events"
};

const hugotLines = [
  "Sana si {name} ang pangalan ng WiFi ko para lagi kang connected sa puso ko. 💕",
  "Ikaw {name}, parang math problem — hindi ko masagot pero lagi ka sa isip ko. 😍",
  "{name}, kung ikaw ay isang bituin, ikaw ang pinakaliwanag sa kalangitan ko. ⭐",
  "Parang panaginip ka lang {name}, kaya ayoko nang gumising. 😴💖",
  "{name}, ikaw yung dahilan kung bakit ako laging nangungulila sa tao kahit nandito ka. 💔",
  "Pag nakikita kita {name}, parang suddenly mayroon na akong dahilan para mag-aral. 📚❤️",
  "{name}, kung ikaw ay isang libro, gusto kitang basahin nang paulit-ulit. 📖💕",
  "Sana {name} ang username ko para ikaw lang ang may access sa puso ko. 🔐💗",
  "Hindi ko alam kung bakit {name}, pero kapag nandito ka, parang okay na ang lahat. 🌸",
  "Kung ako ay cellphone, ikaw {name} ang charger ko — kailangan kita para may buhay ako. 🔋❤️",
  "Sana {name}, may 'save' button sa totoong buhay para mapanatili kita sa tabi ko. 💾💖",
  "{name}, parang sine ka lang — kahit natapos na, iniisip ko pa rin ang ending. 🎬💕",
  "Kapag mainit ang panahon {name}, ikaw ang parang malamig na tubig sa uhaw kong puso. 💧❤️",
  "{name}, ikaw ang playlist ko — lagi kang nasa loop sa isip ko. 🎵💗",
  "Sana {name}, ang tawag sa akin ng puso mo ay 'home'. 🏠❤️",
  "Parang gravity ka {name} — kahit gusto kong lumipad, lagi mo akong binibigyan ng dahilan para manatili. 🌍💕",
  "{name}, kung may libre kang oras, pwede mo ba akong utangin ng isang ngiti? 😊💖",
  "Ikaw {name} yung type ng tao na hindi mo makakalimutan kahit gusto mong kalimutan. 💭❤️",
  "Sana {name}, ikaw ang laging nandoon tuwing kailangan ko ng kumpanya. 🤝💗",
  "Kung ang puso ay kanta, {name} ka ang koro — lagi kang umuulit sa isip ko. 🎶💕",
];

const flirtState = new Map();
const FLIRT_INTERVAL = 30 * 60 * 1000;

module.exports.handleEvent = async function({ api, event, DATA_DIR }) {
  const { threadID, senderID } = event;
  if (!event.body) return;
  if (event.type !== 'message') return;

  const now = Date.now();
  const last = flirtState.get(threadID) || 0;
  if (now - last < FLIRT_INTERVAL) return;

  const chance = Math.random();
  if (chance > 0.08) return;

  flirtState.set(threadID, now);

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

    const line = hugotLines[Math.floor(Math.random() * hugotLines.length)].replace(/{name}/g, targetName);

    const mentions = [{ tag: `@${targetName}`, id: targetID }];
    const body = `💘 ${line}`;

    try {
      api.sendMessage({ body, mentions }, threadID);
    } catch {
      api.sendMessage(body, threadID);
    }
  } catch {}
};
