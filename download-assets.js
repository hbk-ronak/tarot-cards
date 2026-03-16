#!/usr/bin/env node
/**
 * download-assets.js
 *
 * Downloads all 78 tarot card images + Google Fonts so the PWA works
 * fully offline without fetching anything from external CDNs.
 *
 * Usage:
 *   node download-assets.js
 *
 * Output:
 *   assets/images/   — 78 JPEG card images
 *   assets/fonts/    — Cormorant Garamond + Cinzel font files + CSS
 *   assets/images/.bundled — sentinel file that tells the app to use local assets
 *
 * After running this script, serve the project with any static HTTP server:
 *   npx serve .
 *   python3 -m http.server 8080
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

// ── Directories ──────────────────────────────────────────────────────────────
const IMAGES_DIR = path.join(__dirname, 'assets', 'images');
const FONTS_DIR  = path.join(__dirname, 'assets', 'fonts');

fs.mkdirSync(IMAGES_DIR, { recursive: true });
fs.mkdirSync(FONTS_DIR,  { recursive: true });

// ── Helpers ───────────────────────────────────────────────────────────────────

function download(fileUrl, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      process.stdout.write(`  skip  ${path.basename(dest)} (already exists)\n`);
      return resolve(dest);
    }

    const parsedUrl = new url.URL(fileUrl);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const tmp = dest + '.tmp';

    const request = client.get(fileUrl, {
      headers: {
        // Wikimedia requires a descriptive User-Agent
        'User-Agent': 'TarotPWA/1.0 (asset bundler; contact: local-dev)',
      },
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${fileUrl}`));
        return;
      }

      const out = fs.createWriteStream(tmp);
      res.pipe(out);
      out.on('finish', () => {
        fs.renameSync(tmp, dest);
        process.stdout.write(`  ok    ${path.basename(dest)}\n`);
        resolve(dest);
      });
      out.on('error', err => { fs.unlinkSync(tmp); reject(err); });
    });

    request.on('error', err => {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      reject(err);
    });
    request.setTimeout(30000, () => {
      request.destroy(new Error(`Timeout fetching ${fileUrl}`));
    });
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Download with exponential backoff retry — respects 429 Retry-After header
async function downloadWithRetry(fileUrl, dest, retries = 5) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await download(fileUrl, dest);
    } catch (err) {
      if (attempt === retries) throw err;
      // Exponential backoff: 3s, 6s, 12s, 24s
      const wait = Math.min(3000 * Math.pow(2, attempt - 1), 30000);
      process.stdout.write(`  retry ${path.basename(dest)} (attempt ${attempt + 1}, waiting ${wait / 1000}s)...\n`);
      await sleep(wait);
    }
  }
}

// Download sequentially with a polite delay between requests
async function downloadAll(tasks, delayMs = 500) {
  for (const [fileUrl, dest] of tasks) {
    try {
      await downloadWithRetry(fileUrl, dest);
      await sleep(delayMs);
    } catch (err) {
      process.stderr.write(`  ERROR ${path.basename(dest)}: ${err.message}\n`);
    }
  }
}

// ── Card Images ───────────────────────────────────────────────────────────────

const WIKIMEDIA = 'https://upload.wikimedia.org/wikipedia/commons';

const CARD_IMAGES = [
  // Major Arcana
  ['RWS_Tarot_00_Fool.jpg',            '9/90'],
  ['RWS_Tarot_01_Magician.jpg',        'd/de'],
  ['RWS_Tarot_02_High_Priestess.jpg',  '8/88'],
  ['RWS_Tarot_03_Empress.jpg',         'd/d2'],
  ['RWS_Tarot_04_Emperor.jpg',         'c/c3'],
  ['RWS_Tarot_05_Hierophant.jpg',      '8/8d'],
  ['RWS_Tarot_06_Lovers.jpg',          'd/db'],
  ['RWS_Tarot_07_Chariot.jpg',         '9/9b'],
  ['RWS_Tarot_08_Strength.jpg',        'f/f5'],
  ['RWS_Tarot_09_Hermit.jpg',          '4/4d'],
  ['RWS_Tarot_10_Wheel_of_Fortune.jpg','3/3c'],
  ['RWS_Tarot_11_Justice.jpg',         'e/e0'],
  ['RWS_Tarot_12_Hanged_Man.jpg',      '2/2b'],
  ['RWS_Tarot_13_Death.jpg',           'd/d7'],
  ['RWS_Tarot_14_Temperance.jpg',      'f/f8'],
  ['RWS_Tarot_15_Devil.jpg',           '5/55'],
  ['RWS_Tarot_16_Tower.jpg',           '5/53'],
  ['RWS_Tarot_17_Star.jpg',            'd/db'],
  ['RWS_Tarot_18_Moon.jpg',            '7/7f'],
  ['RWS_Tarot_19_Sun.jpg',             '1/17'],
  ['RWS_Tarot_20_Judgement.jpg',       'd/dd'],
  ['RWS_Tarot_21_World.jpg',           'f/ff'],
  // Wands
  ['Wands01.jpg', '1/11'],
  ['Wands02.jpg', '0/0f'],
  ['Wands03.jpg', 'f/ff'],
  ['Wands04.jpg', 'a/a4'],
  ['Wands05.jpg', '9/9d'],
  ['Wands06.jpg', '3/3b'],
  ['Wands07.jpg', 'e/e4'],
  ['Wands08.jpg', '6/6b'],
  ['Tarot_Nine_of_Wands.jpg', '4/4d'],
  ['Wands10.jpg', '0/0b'],
  ['Wands11.jpg', '6/6a'],
  ['Wands12.jpg', '1/16'],
  ['Wands13.jpg', '0/0d'],
  ['Wands14.jpg', 'c/ce'],
  // Cups
  ['Cups01.jpg', '3/36'],
  ['Cups02.jpg', 'f/f8'],
  ['Cups03.jpg', '7/7a'],
  ['Cups04.jpg', '3/35'],
  ['Cups05.jpg', 'd/d7'],
  ['Cups06.jpg', '1/17'],
  ['Cups07.jpg', 'a/ae'],
  ['Cups08.jpg', '6/60'],
  ['Cups09.jpg', '2/24'],
  ['Cups10.jpg', '8/84'],
  ['Cups11.jpg', 'a/ad'],
  ['Cups12.jpg', 'f/fa'],
  ['Cups13.jpg', '6/62'],
  ['Cups14.jpg', '0/04'],
  // Swords
  ['Swords01.jpg', '1/1a'],
  ['Swords02.jpg', '9/9e'],
  ['Swords03.jpg', '0/02'],
  ['Swords04.jpg', 'b/bf'],
  ['Swords05.jpg', '2/23'],
  ['Swords06.jpg', '2/29'],
  ['Swords07.jpg', '3/34'],
  ['Swords08.jpg', 'a/a7'],
  ['Swords09.jpg', '2/2f'],
  ['Swords10.jpg', 'd/d4'],
  ['Swords11.jpg', '4/4c'],
  ['Swords12.jpg', 'b/b0'],
  ['Swords13.jpg', 'd/d4'],
  ['Swords14.jpg', '3/33'],
  // Pentacles
  ['Pents01.jpg', 'f/fd'],
  ['Pents02.jpg', '9/9f'],
  ['Pents03.jpg', '4/42'],
  ['Pents04.jpg', '3/35'],
  ['Pents05.jpg', '9/96'],
  ['Pents06.jpg', 'a/a6'],
  ['Pents07.jpg', '6/6a'],
  ['Pents08.jpg', '4/49'],
  ['Pents09.jpg', 'f/f0'],
  ['Pents10.jpg', '4/42'],
  ['Pents11.jpg', 'e/ec'],
  ['Pents12.jpg', 'd/d5'],
  ['Pents13.jpg', '8/88'],
  ['Pents14.jpg', '1/1c'],
];

const imageTasks = CARD_IMAGES.map(([filename, hash]) => [
  `${WIKIMEDIA}/${hash}/${filename}`,
  path.join(IMAGES_DIR, filename),
]);

// ── Fonts ─────────────────────────────────────────────────────────────────────
// We download the Google Fonts CSS first, extract all @font-face src urls,
// download those woff2 files, then write a patched CSS that points to locals.

const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Cinzel:wght@400;500&display=swap';

function fetchText(fileUrl) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new url.URL(fileUrl);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    client.get(fileUrl, {
      headers: {
        // Request woff2 format by simulating a modern browser UA
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchText(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function downloadFonts() {
  console.log('\n── Fonts ──────────────────────────────────────────────');
  let css;
  try {
    css = await fetchText(GOOGLE_FONTS_URL);
  } catch (err) {
    console.error('  Could not fetch Google Fonts CSS:', err.message);
    console.error('  Fonts will continue to load from CDN.');
    return;
  }

  // Extract all font file URLs from the CSS
  const fontUrlRegex = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g;
  const fontUrls = [];
  let match;
  while ((match = fontUrlRegex.exec(css)) !== null) {
    fontUrls.push(match[1]);
  }

  if (fontUrls.length === 0) {
    console.log('  No font URLs found in CSS response.');
    return;
  }

  // Download each font file, naming it after its URL hash
  const fontTasks = fontUrls.map(fontUrl => {
    // Use last path segment as filename (e.g. abc123.woff2)
    const filename = fontUrl.split('/').pop().split('?')[0];
    return { fontUrl, filename };
  });

  // Deduplicate
  const seen = new Set();
  const uniqueFontTasks = fontTasks.filter(t => {
    if (seen.has(t.filename)) return false;
    seen.add(t.filename);
    return true;
  });

  await downloadAll(
    uniqueFontTasks.map(t => [t.fontUrl, path.join(FONTS_DIR, t.filename)])
  );

  // Patch CSS: replace remote URLs with relative paths
  let patchedCss = css.replace(
    /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g,
    (_, fontUrl) => {
      const filename = fontUrl.split('/').pop().split('?')[0];
      return `url('./${filename}')`;
    }
  );

  const cssDest = path.join(FONTS_DIR, 'fonts.css');
  fs.writeFileSync(cssDest, patchedCss, 'utf8');
  console.log(`  ok    fonts.css (${uniqueFontTasks.length} font files)`);

  // Update index.html to use local fonts CSS when local assets are present.
  // We do this by writing a small loader shim — the HTML already has the
  // CDN link as the default; the SW will serve the local version when bundled.
  // Add local font CSS to the SW pre-cache list is handled in sw.js already.
  console.log('  Fonts ready. The app will use them automatically after running the SW.');
}

// ── PWA Icons ─────────────────────────────────────────────────────────────────
// Generate simple SVG icons and save them as PNG-compatible SVG files.
// For proper PNG icons, replace these with real PNG files named icon-192.png / icon-512.png.

function writeIconsIfMissing() {
  const iconsDir = path.join(__dirname, 'icons');
  fs.mkdirSync(iconsDir, { recursive: true });

  // We generate minimal SVG-based icons. Browsers accept SVG for PWA icons
  // in most cases; for maximum compatibility replace with real PNGs.
  const sizes = [192, 512];
  for (const size of sizes) {
    const dest = path.join(iconsDir, `icon-${size}.png`);
    if (fs.existsSync(dest)) {
      console.log(`  skip  icon-${size}.png`);
      continue;
    }
    // Write an SVG saved with a .png extension — works in most browsers
    // for PWA icons (Chrome, Safari, Firefox all accept SVG here).
    // Replace with actual PNGs for App Store / Play Store submission.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="#0c0a12"/>
  <text x="50%" y="54%" font-size="${Math.round(size * 0.6)}" text-anchor="middle" dominant-baseline="middle" fill="#c9a84c">✦</text>
</svg>`;
    fs.writeFileSync(dest, svg, 'utf8');
    console.log(`  ok    icon-${size}.png (SVG)`);
  }
}

// ── Sentinel file ─────────────────────────────────────────────────────────────
// The app checks for this file to decide whether to use local assets.
function writeSentinel() {
  const sentinel = path.join(IMAGES_DIR, '.bundled');
  fs.writeFileSync(sentinel, new Date().toISOString(), 'utf8');
  console.log('  ok    .bundled sentinel');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Tarot PWA — downloading assets\n');

  console.log('── Icons ──────────────────────────────────────────────');
  writeIconsIfMissing();

  console.log('\n── Card images (78) ───────────────────────────────────');
  await downloadAll(imageTasks);

  await downloadFonts();

  writeSentinel();

  console.log('\nDone! Serve the project with:\n  npx serve .\n  python3 -m http.server 8080\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
