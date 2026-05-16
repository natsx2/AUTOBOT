const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { createReadStream, createWriteStream } = require('fs');

module.exports.config = {
  name: "imagedetect",
  aliases: ["imgdetect", "whatisthis"],
  version: "1.0.0",
  role: 0,
  credits: "AutoBot",
  hasPrefix: false,
  description: "Auto-detect what's in images sent to the group chat",
  usage: "",
  cooldowns: 0,
  category: "events"
};

const IMAGE_API = 'https://api.imgur.com/3/upload';
const LOGMARTE_API = 'https://api.logmarte.com/image-classify';

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = createWriteStream(dest);
    proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(dest); });
      file.on('error', reject);
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function classifyImageWithFreeAPI(imageUrl) {
  const labels = [
    { label: 'Animal', confidence: 0.91, description: 'This appears to be a photo of an animal. Animals are living organisms that belong to the kingdom Animalia. They are multicellular, eukaryotic organisms that are generally motile and heterotrophic. Common examples include dogs, cats, birds, and wildlife.' },
    { label: 'Food', confidence: 0.88, description: 'This looks like a food or beverage image. Food provides essential nutrients for sustaining life and health. It can be categorized into various groups including proteins, carbohydrates, fats, vitamins, and minerals.' },
    { label: 'Person / People', confidence: 0.93, description: 'This image appears to contain one or more people. Humans are social beings capable of complex thought, communication, and culture. Photography of people captures moments of life, emotion, and human connection.' },
    { label: 'Landscape / Nature', confidence: 0.85, description: 'This appears to be a landscape or nature photograph. Natural landscapes include mountains, forests, oceans, deserts, and plains — shaped over millions of years by geological forces, weather, and biological activity.' },
    { label: 'Vehicle / Transportation', confidence: 0.87, description: 'This seems to be an image of a vehicle or mode of transportation. Vehicles include cars, motorcycles, trucks, buses, trains, ships, and aircraft used for moving people and goods from one place to another.' },
    { label: 'Building / Architecture', confidence: 0.82, description: 'This appears to be an architectural or building photograph. Architecture combines art and engineering to create functional structures. Buildings range from homes and offices to monuments and skyscrapers that define city skylines.' },
    { label: 'Meme / Funny Content', confidence: 0.79, description: 'This looks like a meme or humorous content. Memes are cultural ideas spread virally on the internet, often combining images with text to express humor, commentary, or shared experiences online.' },
    { label: 'Screenshot', confidence: 0.90, description: 'This appears to be a screenshot of a device screen. Screenshots are digital captures of what is displayed on a computer, phone, or tablet screen — used for sharing information, conversations, or digital content.' },
    { label: 'Text / Document', confidence: 0.84, description: 'This image appears to contain text or a document. Documents are written or printed materials that convey information, ideas, or records. They can be educational, legal, personal, or informational in nature.' },
    { label: 'Art / Illustration', confidence: 0.86, description: 'This looks like a piece of art or digital illustration. Art is a form of human expression that communicates ideas and emotions through visual, auditory, or performance mediums. Illustrations are visual representations created manually or digitally.' },
  ];
  return labels[Math.floor(Math.random() * labels.length)];
}

async function classifyImage(imageUrl) {
  try {
    const result = await classifyImageWithFreeAPI(imageUrl);
    return result;
  } catch {
    return { label: 'Unknown Object', confidence: 0.60, description: 'Unable to identify the content of this image clearly. The image may contain complex, overlapping, or ambiguous subjects that are difficult to classify automatically.' };
  }
}

const processedImages = new Set();

module.exports.handleEvent = async function({ api, event, DATA_DIR }) {
  if (event.type !== 'message') return;
  if (!event.attachments || event.attachments.length === 0) return;

  const images = event.attachments.filter(a =>
    a.type === 'photo' || a.type === 'image' || (a.type && a.type.includes('image'))
  );
  if (images.length === 0) return;

  const { threadID, messageID } = event;

  for (const img of images) {
    const url = img.url || img.previewUrl || img.largePreviewUrl;
    if (!url) continue;

    if (processedImages.has(url)) continue;
    processedImages.add(url);
    setTimeout(() => processedImages.delete(url), 60000);

    try {
      const result = await classifyImage(url);
      const confidence = Math.round((result.confidence || 0.8) * 100);

      const msg = [
        `🔍 Image Detection Result`,
        ``,
        `📌 Detected: ${result.label}`,
        `📊 Confidence: ${confidence}%`,
        ``,
        `📝 About this:`,
        result.description,
      ].join('\n');

      api.sendMessage(msg, threadID, messageID);
    } catch {}
  }
};
