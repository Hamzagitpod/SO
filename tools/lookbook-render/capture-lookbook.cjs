#!/usr/bin/env node
'use strict';
/*
 * capture-lookbook.cjs
 * -------------------------------------------------------------------------
 * Frame-exact, TIMELINE-SYNCHRONISED capture of the "Lookbook CCM x Orion"
 * animation, encoded straight to a high-quality H.264 MP4 with FFmpeg.
 *
 * Why this is frame-accurate (and not "real time"):
 *   The lookbook animation is driven by requestAnimationFrame + performance.now()
 *   (every visual is a pure function of an internal `elapsed` clock). We inject a
 *   VIRTUAL CLOCK before any page script runs: performance.now() and
 *   requestAnimationFrame are overridden so the animation ONLY advances when we
 *   tick it — by exactly 1/fps per captured frame. Screenshotting can take as
 *   long as it needs; the animation never moves on its own, so no frame is ever
 *   missed or duplicated. Output is a perfect, seamless loop.
 *
 * Pipeline: Playwright (Chromium) --PNG frames--> ffmpeg stdin --> MP4
 *
 * Usage:
 *   node capture-lookbook.cjs [path/to/Lookbook.html]
 *
 * Configuration (environment variables, all optional):
 *   LOOKBOOK_HTML  path to the HTML (or pass as first CLI arg)
 *   OUT            output file               (default: ./lookbook.mp4)
 *   FPS            frames per second         (default: 60)
 *   WIDTH/HEIGHT   output resolution         (default: 1920 x 1080, native)
 *   SCALE          deviceScaleFactor         (default: 1; 2 = supersample → crisper)
 *   DURATION       seconds to capture        (default: auto-detected from the page)
 *   CRF            x264 quality 0-51         (default: 18, visually lossless)
 *   PRESET         x264 preset               (default: slow; try veryslow for max)
 *   SHOW_CONTROLS  keep the ❚❚ PAUSE overlay (default: hidden)
 *   FFMPEG         ffmpeg binary path        (default: ffmpeg on PATH)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');

// ----------------------------- configuration --------------------------------
function num(v, d) { const n = parseFloat(v); return Number.isFinite(n) ? n : d; }
function bool(v) { return /^(1|true|yes|on)$/i.test(v || ''); }

const HTML_PATH = path.resolve(
  process.argv[2] || process.env.LOOKBOOK_HTML || 'Lookbook_CCM_x_Orion.html'
);
// FORCE_FORMAT rewrites the component's format (the standalone export ignores
// the data-props "default", so 9:16 must be forced). It also picks the native
// vertical/horizontal resolution when WIDTH/HEIGHT aren't given explicitly.
const FORCE_FORMAT = process.env.FORCE_FORMAT || null;   // '9:16' | '16:9'
const IS_VERTICAL  = FORCE_FORMAT === '9:16';

const FPS       = num(process.env.FPS, 60);
const OUT_W     = Math.round(num(process.env.WIDTH,  IS_VERTICAL ? 1080 : 1920));
const OUT_H     = Math.round(num(process.env.HEIGHT, IS_VERTICAL ? 1920 : 1080));
const SCALE     = num(process.env.SCALE, 1);            // deviceScaleFactor
const CRF       = Math.round(num(process.env.CRF, 18));
const PRESET    = process.env.PRESET || 'slow';
const OUT_FILE  = path.resolve(process.env.OUT || 'lookbook.mp4');
const FFMPEG    = process.env.FFMPEG || 'ffmpeg';
const DURATION_ENV  = process.env.DURATION ? num(process.env.DURATION, 0) : null;
const SHOW_CONTROLS = bool(process.env.SHOW_CONTROLS);
// Optional: serve the page's CDN dependencies (React/ReactDOM/Babel from unpkg)
// from local files instead, for fully offline / reproducible renders. Point this
// at a folder containing react.production.min.js, react-dom.production.min.js and
// babel.min.js. Leave unset to load them from the network as the page intends.
const VENDOR_DIR    = process.env.VENDOR_DIR ? path.resolve(process.env.VENDOR_DIR) : null;

// ----------------------------- playwright load ------------------------------
// Resolve Playwright from local node_modules first, then a global install.
function loadPlaywright() {
  try { return require('playwright'); } catch (_) { /* fall through */ }
  try {
    const g = execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return require(require.resolve('playwright', { paths: [g] }));
  } catch (_) { /* fall through */ }
  console.error('[fatal] Playwright introuvable. Installez-le :\n' +
    '  npm install playwright && npx playwright install chromium');
  process.exit(1);
}
const { chromium } = loadPlaywright();

// ----------------------------- virtual clock --------------------------------
// Runs in the page BEFORE any of its own scripts. Replaces the time source so
// the rAF-driven animation is advanced manually, one frame at a time.
function installVirtualClock() {
  let vt = 0;          // virtual time in ms
  let queue = [];      // pending requestAnimationFrame callbacks
  let id = 0;

  const perf = window.performance || (window.performance = {});
  try {
    Object.defineProperty(perf, 'now', { configurable: true, value: function () { return vt; } });
  } catch (e) { perf.now = function () { return vt; }; }

  window.requestAnimationFrame = function (cb) { queue.push({ i: ++id, cb: cb }); return id; };
  window.cancelAnimationFrame = function (h) {
    queue = queue.filter(function (q) { return q.i !== h; });
  };

  window.__vc = {
    now: function () { return vt; },
    queued: function () { return queue.length; },
    // Set virtual time to t (ms) and flush exactly one frame's worth of
    // callbacks. Callbacks that re-schedule via rAF land in the next batch,
    // mirroring real browser frame semantics.
    tick: function (t) {
      vt = t;
      const batch = queue;
      queue = [];
      for (let k = 0; k < batch.length; k++) {
        try { batch[k].cb(vt); } catch (e) { console.error('[raf]', e); }
      }
      return queue.length;
    }
  };
}

// ----------------------------- format patch ---------------------------------
// The bundle's runtime exposes each prop as its editor *descriptor* object, not
// its value, so `this.props.format` is never the string '9:16' and the layout
// always falls back to 16:9. Rewrite the component source to hardcode the wanted
// format, then load the patched copy from a temp file. Returns the path to load.
function maybePatchFormat(htmlPath, fmt) {
  if (!fmt) return htmlPath;
  const html = fs.readFileSync(htmlPath, 'utf8');
  const re = /(<script type="__bundler\/template">)([\s\S]*?)(<\/script>)/;
  const m = html.match(re);
  if (!m) { console.warn('[warn] template du bundle introuvable — FORCE_FORMAT ignoré'); return htmlPath; }
  const tpl = JSON.parse(m[2]);
  // Replace the RHS expression `this.props.format || '16:9'` (works whether the
  // component declares it with const or let, across export variants).
  const patched = tpl.replace(/this\.props\.format \|\| '16:9'/, "'" + fmt + "'");
  if (patched === tpl) {
    console.warn("[warn] expression `this.props.format || '16:9'` non trouvée — FORCE_FORMAT ignoré");
    return htmlPath;
  }
  // Re-encode, escaping `</` as `<\/` so the inner `</script>` inside the template
  // doesn't prematurely close the outer <script type="__bundler/template"> tag.
  const json = JSON.stringify(patched).replace(/<\//g, '<\\/');
  const outHtml = html.slice(0, m.index) + m[1] + json + m[3] +
    html.slice(m.index + m[0].length);
  const out = path.join(os.tmpdir(), 'lookbook-' + fmt.replace(':', 'x') + '-' + process.pid + '.html');
  fs.writeFileSync(out, outHtml);
  console.log('▶ Format   : forcé en ' + fmt + ' (copie patchée : ' + out + ')');
  return out;
}

// ----------------------------- ffmpeg ---------------------------------------
function startFfmpeg() {
  const vf = (SCALE !== 1)
    ? `scale=${OUT_W}:${OUT_H}:flags=lanczos`        // supersample down for crisp AA
    : 'scale=trunc(iw/2)*2:trunc(ih/2)*2';           // guarantee even dims for yuv420p
  const args = [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', 'pipe:0',
    '-an',
    '-c:v', 'libx264', '-preset', PRESET, '-crf', String(CRF),
    '-pix_fmt', 'yuv420p', '-vf', vf,
    '-movflags', '+faststart', '-r', String(FPS),
    OUT_FILE,
  ];
  const ff = spawn(FFMPEG, args, { stdio: ['pipe', 'inherit', 'inherit'] });
  ff.on('error', (e) => {
    console.error('[fatal] ffmpeg introuvable (' + FFMPEG + '): ' + e.message +
      '\nInstallez ffmpeg (avec libx264) ou définissez FFMPEG=/chemin/ffmpeg');
    process.exit(1);
  });
  ff.stdin.on('error', () => { /* ignore EPIPE; exit code is checked at the end */ });
  return ff;
}

function writeFrame(stdin, buf) {
  return new Promise((resolve) => {
    if (stdin.write(buf)) resolve();
    else stdin.once('drain', resolve);
  });
}

// ----------------------------- main -----------------------------------------
(async () => {
  if (!fs.existsSync(HTML_PATH)) {
    console.error('[fatal] Fichier HTML introuvable : ' + HTML_PATH +
      '\nUsage : node capture-lookbook.cjs <chemin/vers/Lookbook.html>');
    process.exit(1);
  }

  console.log('▶ Lookbook : ' + HTML_PATH);
  console.log('▶ Sortie   : ' + OUT_FILE);
  console.log('▶ Rendu    : ' + OUT_W + 'x' + OUT_H + ' @ ' + FPS + 'fps  (deviceScaleFactor ' + SCALE + ')');
  console.log('▶ Encodage : H.264 / CRF ' + CRF + ' / preset ' + PRESET + ' / yuv420p');

  const browser = await chromium.launch({
    headless: true,
    args: ['--force-color-profile=srgb', '--hide-scrollbars', '--disable-lcd-text'],
  });
  const context = await browser.newContext({
    viewport: { width: OUT_W, height: OUT_H },
    deviceScaleFactor: SCALE,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', (e) => console.error('[page] ' + e.message));

  // Offline mode: fulfil blocked CDN requests (unpkg/jsdelivr/cdnjs) from
  // local vendor copies, matched by filename.
  if (VENDOR_DIR) {
    await page.route(/(unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)\//, (route) => {
      const base = route.request().url().split('?')[0].split('/').pop();
      const local = path.join(VENDOR_DIR, base);
      if (fs.existsSync(local)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/javascript; charset=utf-8',
          body: fs.readFileSync(local),
        });
      }
      return route.continue();
    });
  }

  await page.addInitScript(installVirtualClock);
  const loadPath = maybePatchFormat(HTML_PATH, FORCE_FORMAT);
  await page.goto('file://' + loadPath, { waitUntil: 'load' });

  // 1) Wait for the app to mount (its rAF loop has registered a callback).
  await page.waitForFunction(
    () => window.__vc && window.__vc.queued() > 0 && !!document.getElementById('s0'),
    null, { timeout: 60000 }
  );

  // 2) Force playback if the page happens to start paused, then hide chrome.
  await page.evaluate(() => {
    const b = document.getElementById('ed-play');
    if (b && /LECTURE/i.test(b.textContent || '')) b.click();   // toggle paused -> playing
  });
  await page.addStyleTag({ content:
    'html,body{overflow:hidden!important;margin:0!important;background:#0a0a0b!important;}' +
    (SHOW_CONTROLS ? '' : '#ed-play,#ed-fmt{display:none!important;}')
  });

  // 3) Auto-detect the loop duration from the component source (this.TOTAL).
  let duration = DURATION_ENV;
  if (!duration) {
    duration = await page.evaluate(() => {
      const src = Array.from(document.querySelectorAll('script'))
        .map((n) => n.textContent || '')
        .find((t) => /this\.TOTAL\s*=/.test(t));
      const m = src && src.match(/this\.TOTAL\s*=\s*([\d.]+)/);
      return m ? parseFloat(m[1]) : null;
    });
  }
  if (!duration || !Number.isFinite(duration)) {
    duration = 43.6;
    console.warn('[warn] durée non détectée — repli sur ' + duration + 's');
  }

  // 4) Make sure fonts + images are fully loaded BEFORE the first tick, so the
  //    text metrics and the (measured-once) marquee width are correct.
  await page.evaluate(async () => {
    const fams = ['800 230px "Bricolage Grotesque"', '500 16px "Space Grotesk"', '700 15px "Space Grotesk"'];
    try { await Promise.all(fams.map((f) => document.fonts.load(f))); } catch (e) {}
    try { await document.fonts.ready; } catch (e) {}
    await Promise.all(Array.from(document.images).map((img) =>
      (img.complete && img.naturalWidth) ? null : new Promise((r) => { img.onload = img.onerror = r; })));
  });

  // 5) Prime the loop at t=0 until the first scene is actually rendered.
  await page.waitForFunction(() => {
    window.__vc.tick(0);
    const s0 = document.getElementById('s0');
    return !!s0 && s0.style.opacity === '1';
  }, null, { timeout: 30000, polling: 50 });

  const totalFrames = Math.round(duration * FPS);   // [0, duration) → seamless loop
  const frameMs = 1000 / FPS;
  console.log('▶ Durée    : ' + duration + 's  →  ' + totalFrames + ' frames\n');

  const ff = startFfmpeg();
  const clip = { x: 0, y: 0, width: OUT_W, height: OUT_H };
  const t0 = Date.now();

  for (let i = 0; i < totalFrames; i++) {
    await page.evaluate((t) => window.__vc.tick(t), i * frameMs);   // advance timeline by 1 frame
    const buf = await page.screenshot({ clip, type: 'png' });        // capture exactly that frame
    await writeFrame(ff.stdin, buf);

    if (i % 30 === 0 || i === totalFrames - 1) {
      const done = i + 1;
      const secs = (Date.now() - t0) / 1000;
      const rate = done / secs;
      const eta = (totalFrames - done) / rate;
      process.stdout.write('\r  frame ' + done + '/' + totalFrames +
        '  (' + (100 * done / totalFrames).toFixed(1) + '%)  ' +
        rate.toFixed(1) + ' fps  ETA ' + eta.toFixed(0) + 's   ');
    }
  }
  process.stdout.write('\n');

  ff.stdin.end();
  await new Promise((resolve, reject) => {
    ff.on('close', (code) => code === 0 ? resolve() : reject(new Error('ffmpeg exited with code ' + code)));
  });
  await browser.close();

  const mb = fs.statSync(OUT_FILE).size / 1048576;
  console.log('\n✔ Terminé : ' + OUT_FILE + '  (' + mb.toFixed(1) + ' MB)');
})().catch((e) => {
  console.error('\n[fatal] ' + ((e && e.stack) || e));
  process.exit(1);
});
