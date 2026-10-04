// Renders guide-pdf/pages/NN.html (one A4 fragment each, with its own NN.css)
// to one PDF per page, then merge.py joins them.
//   PW_MODULE=<path to playwright> node guide-pdf/build.mjs <locale> <outdir> [--shots]
// Each page is rendered alone, so one page's CSS can never leak into another.
const { chromium } = await import(process.env.PW_MODULE || 'playwright');
import { readFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname);
const [,, locale = 'en', outDir = '/tmp/guide-pages', ...flags] = process.argv;
const dir = process.env.PAGES_DIR || path.join(here, 'pages');
const base = readFileSync(path.join(here, 'base.css'), 'utf8');
const fonts = readFileSync(path.join(here, 'fonts.css'), 'utf8');
const read = (f) => { try { return readFileSync(path.join(dir, f), 'utf8'); } catch { return ''; } };
mkdirSync(outDir, { recursive: true });
const files = readdirSync(dir).filter((f) => /^\d\d\.html$/.test(f)).sort();
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 794, height: 1123 } })).newPage();
const unitsSrc = readFileSync(path.join(here, 'units.js'), 'utf8');
const dictFile = path.join(here, 'i18n', `${locale}.json`);
const dict = locale === 'en' ? null : JSON.parse(readFileSync(dictFile, 'utf8'));
const extract = flags.includes('--extract');
const allUnits = {};
const missingAll = [];
const problems = [];
const fits = [];
for (const f of files) {
  const n = f.slice(0, 2);
  const doc = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><style>${fonts}</style><style>${base}</style><style>${read(`${n}.css`)}</style>
<style>@page{size:794px 1123px;margin:0}html,body{margin:0;background:#fff}</style></head><body>${read(f)}</body></html>`;
  // fonts are referenced relatively: write next to the sources so url(fonts/..) resolves
  const tmp = path.join(here, `.tmp-${n}.html`);
  (await import('node:fs')).writeFileSync(tmp, doc);
  await page.goto(`file://${tmp}`);
  await page.evaluate(() => document.fonts.ready);
  if (extract || dict) {
    const r = await page.evaluate(`(${unitsSrc.trim().replace(/;$/, '')})(${JSON.stringify(extract ? 'extract' : 'apply')}, ${JSON.stringify(dict || {})})`);
    if (extract) allUnits[n] = r; else missingAll.push(...r.map((k) => `${n}: ${k.slice(0, 80)}`));
  }
  // Fit: pages are a fixed A4 height, and a translation is rarely the same
  // length as the English. When the content runs into the footer, shrink it
  // just enough (CSS zoom re-wraps text into the wider box, so it shrinks
  // faster than linearly). Never below MIN, so a page that still does not fit
  // is reported rather than made unreadable.
  const fitted = await page.evaluate((MIN) => {
    const pg = document.querySelector('.page');
    const foot = pg && pg.querySelector('.foot');
    if (!pg || !foot) return null;
    const keep = (c) => c.classList.contains('run') || c.classList.contains('foot') || getComputedStyle(c).position === 'absolute';
    const wrap = document.createElement('div');
    wrap.className = 'fit';
    [...pg.children].filter((c) => !keep(c)).forEach((c) => wrap.appendChild(c));
    pg.insertBefore(wrap, foot);
    const limit = () => foot.getBoundingClientRect().top - 14;
    const bottom = () => {
      let b = 0;
      wrap.querySelectorAll('*').forEach((e) => { const r = e.getBoundingClientRect(); if (r.height) b = Math.max(b, r.bottom); });
      return b;
    };
    let z = 1;
    while (bottom() > limit() && z > MIN) { z = Math.round((z - 0.01) * 100) / 100; wrap.style.zoom = String(z); }
    return z;
  }, 0.74);
  if (fitted !== null && fitted < 1) fits.push(`${n}: ${fitted}`);
  const found = await page.evaluate(() => {
    const out = [];
    const pg = document.querySelector('.page');
    if (!pg) return [{ kind: 'no .page' }];
    const pr = pg.getBoundingClientRect();
    const foot = pg.querySelector('.foot');
    const limit = foot ? foot.getBoundingClientRect().top : pr.bottom - 6;
    pg.querySelectorAll('*').forEach((el) => {
      if (el.closest('.foot') || el.classList.contains('run')) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const leaf = !el.children.length && (el.textContent || '').trim();
      if (leaf && r.bottom > limit + 1) out.push({ kind: 'below-limit', by: Math.round(r.bottom - limit), text: el.textContent.trim().slice(0, 40) });
      if (leaf && r.right > pr.right - 20) out.push({ kind: 'right-edge', by: Math.round(r.right - (pr.right - 20)), text: el.textContent.trim().slice(0, 40) });
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') out.push({ kind: 'clipped-x', text: (el.textContent || '').trim().slice(0, 40) });
      if (el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflowY !== 'visible' && el.clientHeight) out.push({ kind: 'clipped-y', text: (el.textContent || '').trim().slice(0, 40) });
    });
    // text boxes that overlap each other (leaf elements only)
    const leaves = [...pg.querySelectorAll('*')].filter((e) => !e.children.length && (e.textContent || '').trim() && !e.closest('.foot') && !e.classList.contains('run'));
    const rects = leaves.map((e) => ({ e, r: e.getBoundingClientRect() })).filter((x) => x.r.width && x.r.height);
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i].r, b = rects[j].r;
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 3 && h > 3) out.push({ kind: 'overlap', text: `${rects[i].e.textContent.trim().slice(0, 25)} <> ${rects[j].e.textContent.trim().slice(0, 25)}`, w: Math.round(w), h: Math.round(h) });
    }
    return out;
  });
  if (found.length) problems.push({ page: n, found });
  await page.pdf({ path: path.join(outDir, `${n}.pdf`), width: '794px', height: '1123px', printBackground: true, preferCSSPageSize: true });
  if (flags.includes('--shots')) await page.screenshot({ path: path.join(outDir, `${n}.png`) });
  (await import('node:fs')).unlinkSync(tmp);
}
if (extract) { (await import('node:fs')).writeFileSync(path.join(outDir, 'units.json'), JSON.stringify(allUnits, null, 1)); }
if (missingAll.length) console.log('MISSING ' + missingAll.length + '\n' + missingAll.join('\n'));
console.log('FIT ' + fits.join(' | '));
console.log(JSON.stringify(problems, null, 1));
await browser.close();
