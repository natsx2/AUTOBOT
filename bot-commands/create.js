const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { URLSearchParams } = require('url');

// ──────────────────────────────────────────────────────────────
// Filipino names (from original script)
// ──────────────────────────────────────────────────────────────
const FIRST_NAMES = [
  'Maria','Ana','Joy','Grace','Angel','Angela','Christine','Kristine','Michelle','Shiela',
  'Sheila','Maricel','Marites','Maribel','Marjorie','Jennifer','Jenny','Jessa','Jessica','Janine',
  'Katherine','Catherine','Kathleen','Karen','Karla','Camille','Bianca','Patricia','Patty','Tricia',
  'Aileen','Eileen','Irene','Iris','Hazel','Cherry','Lovely','Honey','Princess','Angelica',
  'Bernadette','Rowena','Rosalie','Roselyn','Rosalinda','Lourdes','Teresa','Therese','Carmela','Carmen',
  'Liza','Elizabeth','Beth','Isabel','Isabela','Bella','Andrea','Andi','Alexandra','Alexa',
  'Nina','Mina','Rina','Jocelyn','Jocelle','Jhoanna','Joan','Joanne','Joanna','Johanna',
  'May','Mae','Mylene','Myra','Myrna','Melanie','Melisa','Melissa','Marissa','Mariz',
  'Pauline','Paula','Paulina','Regina','Rhea','Rochelle','Sharon','Samantha',
  'Sandra','Sarah','Sophia','Sofia','Stephanie','Tiffany','Vanessa','Veronica','Vina','Yvonne',
  'Leah','Lia','Louise','Luisa','Lorraine','Lorna','Lani','Mika','Mikaela',
  'Janelle','Janella','Janice','Joyce','Judy','Judith','Julie','Juliana','Juliet','Julienne',
  'Faith','Hope','Charity','Heaven','Blessy','Precious','Lovelyn','Shaira','Aira','Kyra',
  'Rachelle','Rachel','Reina','Selena','Selina','Trisha','Trina','Wendy','Zenaida',
  'Juan','Jose','Pedro','Paolo','Paul','Mark','John','Johnny','Jonathan','Nathan',
  'Michael','Miguel','Daniel','David','Andrew','Andre','Anthony','Antonio','Albert','Alfred',
  'Brian','Bryan','Benjamin','Carlo','Carlos','Christian','Christopher','Chris','Cedric','Cesar',
  'Dennis','Diego','Dominic','Edward','Edgar','Emmanuel','Eric','Erwin','Francis','Frank',
  'Gabriel','Gilbert','Henry','Ian','Ivan','James','Jasper','Jerome','Joel','Joshua',
  'Kenneth','Kevin','Kyle','Lawrence','Leo','Leonard','Lester','Louis','Lucas','Marco',
  'Martin','Matthew','Melvin','Nathaniel','Noel','Oliver','Patrick','Raymond','Richard',
  'Robert','Ronald','Ryan','Samuel','Sebastian','Steven','Stephen','Thomas','Timothy','Victor',
  'Vincent','Wilfred','William','Xavier','Zachary'
];

const LAST_NAMES = [
  'Santos','Reyes','Cruz','Bautista','Garcia','Mendoza','Flores','Gonzales','Ramos','Aquino',
  'DelaCruz','DelosSantos','Villanueva','Fernandez','Castillo','Torres','Dominguez','Navarro',
  'Salazar','DeGuzman','Perez','Rivera','Lopez','Martinez','Hernandez','Alvarez','Morales',
  'Rojas','Santiago','Padilla','Rosales','Valdez','Estrada','Aguilar','Manalo',
  'Francisco','Romero','Velasco','Soriano','Pascual','Pineda','Ferrer','Cuevas','Suarez','Montes',
  'Calderon','DelosReyes','Lim','Tan','Chua'
];

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
function ri(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function rc(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randChars(chars, n) {
  return Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ──────────────────────────────────────────────────────────────
// Password generator (exact port of Python get_pass())
// ──────────────────────────────────────────────────────────────
function getPassword() {
  const az = 'abcdefghijklmnopqrstuvwxyz';
  const AZ = az.toUpperCase();
  const digits = '0123456789';
  const symbols = '!@#$%^&*()_+=';

  const raw = randChars(az, ri(5, 7));
  const namePart = Math.random() > 0.5
    ? raw.charAt(0).toUpperCase() + raw.slice(1)
    : raw.toLowerCase();
  const symbolPart = randChars(symbols, ri(2, 3));
  const digitPart = randChars(digits, ri(2, 4));
  const endPart = randChars(az + AZ, ri(2, 4));
  const optUpper = randChars(AZ, ri(1, 2));

  return shuffle([namePart, symbolPart, digitPart, endPart, optUpper]).join('');
}

// ──────────────────────────────────────────────────────────────
// Email generator (xiyadmailx_email)
// ──────────────────────────────────────────────────────────────
function getEmail() {
  const name = (rc(FIRST_NAMES) + rc(LAST_NAMES)).toLowerCase().replace(/[^a-z]/g, '');
  return `${name}${ri(1000, 9999)}@xiyadmailx.xyz`;
}

// ──────────────────────────────────────────────────────────────
// Phone generator (generate_phone_number - multi country)
// ──────────────────────────────────────────────────────────────
function getPhone() {
  const countries = [
    { code: '+63', prefixes: ['917','918','919','920','921','922'], len: 7 },
    { code: '+62', prefixes: ['813','815','816','817','818','819'], len: 7 },
    { code: '+88', prefixes: ['017','018','019','016','015'], len: 8 },
    { code: '+91', prefixes: ['98','99','97','96','95','94'], len: 8 },
    { code: '+92', prefixes: ['300','301','302','303','304','305'], len: 7 },
    { code: '+234', prefixes: ['701','703','704','705','706','707','802','803'], len: 7 },
    { code: '+1', prefixes: ['201','202','303','312','415','646','718'], len: 7 },
  ];
  const c = rc(countries);
  const digits = Array.from({ length: c.len }, () => ri(0, 9)).join('');
  return `${c.code}${rc(c.prefixes)}${digits}`;
}

// ──────────────────────────────────────────────────────────────
// User-Agent generator
// ──────────────────────────────────────────────────────────────
function getUA() {
  const models = [
    'SM-G975F','SM-A525F','SM-A325F','SM-G996B',
    'CPH2461','CPH2451','CPH2407','CPH2415',
    'Redmi Note 8','Redmi Note 9','2201116SY','2201123G',
    'Infinix X669C','Infinix X676C','Infinix X683','Infinix X6823',
    'RMX3461','RMX3286','RMX3516',
    'Pixel 5','Pixel 6',
  ];
  const blTypes = ['TKQ1','SKQ1','TP1A','RKQ1','SP1A','RP1A'];
  const androidVer = ri(8, 13);
  const chromeVer = ri(90, 114);
  const model = rc(models);
  const bl = `${rc(blTypes)}.${ri(120000, 220000)}.${rc(['001','002','003','011','012'])}`;
  const chrome = `${chromeVer}.0.${ri(4200, 5400)}.${ri(70, 150)}`;
  return `Mozilla/5.0 (Linux; Android ${androidVer}; ${model} Build/${bl}; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/${chrome} Mobile Safari/537.36`;
}

// ──────────────────────────────────────────────────────────────
// HTML hidden-input extractor (port of Python extractor())
// ──────────────────────────────────────────────────────────────
function extractForm(html) {
  const form = {};
  // Match name="..." value="..." and value="..." name="..." in any order
  const patterns = [
    /<input[^>]*\sname="([^"]+)"[^>]*\svalue="([^"]*)"[^>]*/gi,
    /<input[^>]*\svalue="([^"]*)"[^>]*\sname="([^"]+)"[^>]*/gi,
  ];
  let m;
  while ((m = patterns[0].exec(html)) !== null) form[m[1]] = m[2];
  while ((m = patterns[1].exec(html)) !== null) if (!(m[2] in form)) form[m[2]] = m[1];
  return form;
}

// ──────────────────────────────────────────────────────────────
// Cookie helpers (manual jar — no extra deps needed)
// ──────────────────────────────────────────────────────────────
function parseCookieHeaders(headers) {
  const out = {};
  const raw = headers['set-cookie'] || [];
  const list = Array.isArray(raw) ? raw : [raw];
  for (const h of list) {
    if (!h) continue;
    const [pair] = h.split(';');
    const idx = pair.indexOf('=');
    if (idx < 1) continue;
    out[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  return out;
}

function cookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

// ──────────────────────────────────────────────────────────────
// Core create function — same HTTP flow as Python script
// ──────────────────────────────────────────────────────────────
async function createOneAccount(DATA_DIR) {
  const ua = getUA();
  let jar = {};

  // ── Step 1: GET registration form (same as Python ses.get) ──
  const getResp = await axios.get('https://x.facebook.com/reg', {
    headers: {
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 20000,
    maxRedirects: 5,
    validateStatus: () => true,
  });

  Object.assign(jar, parseCookieHeaders(getResp.headers));
  const form = extractForm(getResp.data || '');

  // ── Generate account info ──
  const firstname = rc(FIRST_NAMES);
  const lastname = rc(LAST_NAMES);
  const password = getPassword();
  const contact = Math.random() > 0.5 ? getPhone() : getEmail();
  const day = ri(15, 28);
  const month = ri(1, 12);
  const year = ri(1985, 2001);
  const ts = Math.floor(Date.now() / 1000);

  // ── Step 2: POST to /reg/submit/ (same payload as Python) ──
  const payload = new URLSearchParams({
    ccp: '2',
    reg_instance: form.reg_instance || '',
    submission_request: 'true',
    reg_impression_id: form.reg_impression_id || '',
    ns: '1',
    logger_id: form.logger_id || '',
    firstname,
    lastname,
    birthday_day: String(day),
    birthday_month: String(month),
    birthday_year: String(year),
    reg_email__: contact,
    sex: '1',
    encpass: `#PWD_BROWSER:0:${ts}:${password}`,
    submit: 'Sign Up',
    fb_dtsg: form.fb_dtsg || '',
    jazoest: form.jazoest || '',
    lsd: form.lsd || '',
  });

  const postHeaders = {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Referer': 'https://mbasic.facebook.com/reg/',
    'Cache-Control': 'max-age=0',
    'sec-ch-ua': '',
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': 'Android',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'Cookie': cookieHeader(jar),
  };

  const postResp = await axios.post(
    'https://www.facebook.com/reg/submit/',
    payload.toString(),
    { headers: postHeaders, timeout: 20000, maxRedirects: 5, validateStatus: () => true }
  );

  // Merge response cookies (same as Python ses.cookies.get_dict())
  Object.assign(jar, parseCookieHeaders(postResp.headers));

  // Also check final redirect URL for checkpoint
  const finalUrl = (postResp.request?.res?.responseUrl) || (postResp.request?.path) || '';
  const isCheckpoint = !!jar.checkpoint_session_id || finalUrl.includes('checkpoint') || postResp.data?.includes?.('checkpoint');

  if (jar.c_user) {
    const uid = jar.c_user;
    // Build cookie string: uid|password|cookie_jar (same as Python Auto_Creat.txt)
    const cookieStr = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join(';');
    const line = `${uid}|${password}|${contact}|${firstname} ${lastname}|${cookieStr}`;

    // Save to bot-data/created_accounts.txt
    const outFile = path.join(DATA_DIR, 'created_accounts.txt');
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.appendFileSync(outFile, line + '\n');
    } catch {}

    return { status: 'ok', uid, password, name: `${firstname} ${lastname}`, contact, dob: `${day}/${month}/${year}` };
  }

  if (isCheckpoint) {
    return { status: 'checkpoint', contact };
  }

  return { status: 'failed', contact };
}

// ──────────────────────────────────────────────────────────────
// Bot command
// ──────────────────────────────────────────────────────────────
module.exports.config = {
  name: 'create',
  aliases: ['autocreate', 'fbcreate', 'makefb', 'gencreate'],
  version: '1.0.0',
  role: 2,
  credits: 'AutoBot',
  hasPrefix: true,
  description: 'Auto-create Facebook accounts (max 10). Usage: !create <count>',
  usage: 'create <count>',
  cooldowns: 30,
  category: 'admin',
};

module.exports.run = async function ({ api, event, args, admin, DATA_DIR }) {
  const { threadID, messageID, senderID } = event;

  if (!(admin || []).includes(senderID)) {
    return api.sendMessage('❌ This command is for admins only.', threadID, messageID);
  }

  const count = Math.min(10, Math.max(1, parseInt(args[0]) || 1));

  // Send initial status
  let statusMsgID = null;
  try {
    const info = await new Promise((res, rej) => {
      const r = api.sendMessage(
        `🤖 AUTO-CREATE STARTED\n\n📊 Target: ${count} account(s)\n✅ OK: 0  ⚠️ CP: 0  ❌ Failed: 0\n\n⏳ Creating...`,
        threadID, (err, d) => (err ? rej(err) : res(d)), messageID
      );
      if (r && typeof r.then === 'function') r.then(res).catch(rej);
    });
    statusMsgID = info?.messageID;
  } catch {}

  let ok = 0, cp = 0, failed = 0;
  const results = [];

  for (let i = 0; i < count; i++) {
    // Update live status
    if (statusMsgID) {
      try {
        api.editMessage(
          `🤖 AUTO-CREATE (${i + 1}/${count})\n\n✅ OK: ${ok}  ⚠️ CP: ${cp}  ❌ Failed: ${failed}\n\n⏳ Working on #${i + 1}...`,
          statusMsgID
        );
      } catch {}
    }

    try {
      const result = await createOneAccount(DATA_DIR);
      results.push(result);
      if (result.status === 'ok') ok++;
      else if (result.status === 'checkpoint') cp++;
      else failed++;
    } catch (err) {
      failed++;
      results.push({ status: 'error', msg: err.message });
      await new Promise(r => setTimeout(r, 5000)); // back-off on error
    }

    // 2s delay between accounts (avoids rate limiting, same as Python time.sleep(1))
    if (i < count - 1) await new Promise(r => setTimeout(r, 2000));
  }

  // ── Build final report ──
  const successful = results.filter(r => r.status === 'ok');

  let report = `🤖 AUTO-CREATE COMPLETE!\n`;
  report += `━━━━━━━━━━━━━━━━━━\n`;
  report += `✅ Success : ${ok}\n`;
  report += `⚠️ Checkpoint: ${cp}\n`;
  report += `❌ Failed  : ${failed}\n`;

  if (successful.length > 0) {
    report += `\n📋 CREATED ACCOUNTS:\n`;
    for (const acc of successful) {
      report += `━━━━━━━━━━━━━━\n`;
      report += `👤 ${acc.name}\n`;
      report += `🆔 UID : ${acc.uid}\n`;
      report += `🔑 Pass: ${acc.password}\n`;
      report += `📱 ${acc.contact}\n`;
      report += `🎂 DOB : ${acc.dob}\n`;
    }
    report += `\n💾 Full data saved to bot-data/created_accounts.txt`;
  } else {
    report += `\n⚠️ No accounts created successfully.\nFacebook may be blocking registrations from this IP. Try using a VPN (1.1.1.1 DNS / SOCKS5 proxy) and retry.`;
  }

  // Edit the live status or send new message
  if (statusMsgID) {
    try { api.editMessage(report, statusMsgID); return; } catch {}
  }
  api.sendMessage(report, threadID);
};
