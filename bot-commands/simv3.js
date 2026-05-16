const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const threadsFile = path.join(__dirname, "sim_threads.json");

function loadActiveThreads() {
  try {
    const data = fs.readFileSync(threadsFile, "utf8");
    const arr = JSON.parse(data);
    return new Set(arr);
  } catch (e) {
    return new Set();
  }
}

function saveActiveThreads(set) {
  fs.writeFileSync(threadsFile, JSON.stringify(Array.from(set)), "utf8");
}

let activeSimThreads = loadActiveThreads();

module.exports.config = {
  name: "simv3",
  version: "3.0.0",
  permission: 0,
  credits: "Nax",
  prefix: false,
  premium: false,
  description: "Auto-reply with SimSimi AI, stays on until turned off (persistent)",
  category: "without prefix",
  usages: "sim on | sim off",
  cooldowns: 3,
  dependencies: {
    "axios": ""
  }
};

module.exports.languages = {
  "english": {
    "on": "SimSimi auto-reply activated! All messages will receive SimSimi responses.",
    "off": "SimSimi auto-reply deactivated.",
    "alreadyOn": "SimSimi auto-reply is already active in this thread.",
    "alreadyOff": "SimSimi auto-reply is not active in this thread.",
    "apiError": "Error: Failed to connect to Sim API.",
    "noResponse": "Error: No response from Sim API."
  }
};

module.exports.handleEvent = async function({ api, event }) {
  const { threadID, body, senderID } = event;
  if (!activeSimThreads.has(threadID)) return;
  if (!body || senderID === api.getCurrentUserID()) return;

  try {
    const apiKey = "2a5a2264d2ee4f0b847cb8bd809ed34bc3309be7";
    const apiUrl = `https://simsimi.ooguy.com/sim?query=${encodeURIComponent(body)}&apikey=${apiKey}`;
    const { data } = await axios.get(apiUrl);
    if (!data || !data.respond) return;
    api.sendMessage(data.respond, threadID, event.messageID);
  } catch (error) {
    console.error("sim handleEvent error:", error.message);
  }
};

module.exports.run = async function({ api, event, args }) {
  const { threadID, messageID } = event;
  const subcmd = (args[0] || "").toLowerCase();

  if (subcmd === "on") {
    if (activeSimThreads.has(threadID)) {
      return api.sendMessage("SimSimi auto-reply is already active in this thread.", threadID, messageID);
    }
    activeSimThreads.add(threadID);
    saveActiveThreads(activeSimThreads);
    return api.sendMessage("SimSimi auto-reply activated! All messages will receive SimSimi responses.", threadID, messageID);
  }

  if (subcmd === "off") {
    if (!activeSimThreads.has(threadID)) {
      return api.sendMessage("SimSimi auto-reply is not active in this thread.", threadID, messageID);
    }
    activeSimThreads.delete(threadID);
    saveActiveThreads(activeSimThreads);
    return api.sendMessage("SimSimi auto-reply deactivated.", threadID, messageID);
  }

  return api.sendMessage("Usage:\nsim on - activate SimSimi auto-reply\nsim off - deactivate auto-reply", threadID, messageID);
};
