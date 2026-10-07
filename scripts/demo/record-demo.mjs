// Records a scripted walkthrough of Kestral Budget for the marketing site.
// Usage (from scripts/demo): npm install; npx playwright install chromium; npm run record
import { mkdirSync, mkdtempSync, readdirSync, rmSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import ffmpegPath from 'ffmpeg-static';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const outDir = resolve(root, 'site', 'img');
const size = { width: 1280, height: 720 };
const workDir = mkdtempSync(join(tmpdir(), 'kestral-demo-'));

const { startServer } = await import(pathToFileURL(join(root, 'server.mjs')).href);
const app = await startServer({ host: '127.0.0.1', port: 0, databasePath: join(workDir, 'demo.sqlite'), staticDirectory: join(root, 'dist') });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: size, recordVideo: { dir: workDir, size } });
const page = await context.newPage();

await page.addInitScript(() => {
  const cursor = document.createElement('div');
  cursor.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;margin:-4px 0 0 -4px;z-index:2147483647;pointer-events:none;transition:transform .02s;'
    + 'background:url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'22\' height=\'22\' viewBox=\'0 0 22 22\'><path d=\'M3 2l14 8-6 1.5L8 18z\' fill=\'white\' stroke=\'black\' stroke-width=\'1.4\' stroke-linejoin=\'round\'/></svg>") no-repeat';
  window.addEventListener('DOMContentLoaded', () => document.documentElement.append(cursor));
  window.addEventListener('mousemove', (event) => { cursor.style.transform = `translate(${event.clientX}px,${event.clientY}px)`; }, true);
});

const pause = (ms) => page.waitForTimeout(Math.round(ms * 0.55));
let pointer = { x: 640, y: 360 };

async function glide(locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  const target = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(target.x, target.y, { steps: 16 });
  pointer = target;
}
async function click(locator, after = 500) {
  await glide(locator);
  await pause(180);
  await locator.click();
  await pause(after);
}
async function type(locator, text) {
  await click(locator, 150);
  await locator.pressSequentially(text, { delay: 35 });
  await pause(250);
}

await page.goto(app.origin);
await page.mouse.move(pointer.x, pointer.y);
await pause(1800);

await click(page.getByRole('button', { name: /Create your first budget/ }), 1200);
await click(page.getByRole('button', { name: /Set up/ }), 1200);

const dialog = page.getByRole('dialog');
const steps = [
  { source: 'Paycheck', amount: '4200' },
  { source: 'Rent', amount: '1450' },
  { source: 'Electric', amount: '120' },
];
await type(dialog.getByRole('textbox', { name: 'Income source' }), steps[0].source);
await type(dialog.getByRole('spinbutton', { name: 'Planned amount' }), steps[0].amount);
await click(dialog.getByRole('button', { name: /Add income/ }), 900);
await click(dialog.getByRole('button', { name: /Continue/ }), 900);

const later = [
  [['Rent', '1450'], ['Electric', '100']],
  [['Groceries', '520'], ['Dining out', '150']],
  [['Streaming', '16']],
  [['Car loan', '320']],
  [['Emergency fund', '400']],
];
for (const items of later) {
  for (const [name, amount] of items) {
    await type(dialog.getByRole('textbox', { name: 'Item name' }), name);
    await type(dialog.getByRole('spinbutton', { name: 'Planned amount' }), amount);
    await click(dialog.getByRole('button', { name: /Add item/ }), 800);
  }
  await click(dialog.getByRole('button', { name: /Continue|Finish|Done|Create/ }), 900);
}

await pause(1800);
await click(page.getByRole('button', { name: /Maybe later/ }), 1200);

async function addTransaction(description, amount, category, item) {
  await click(page.getByRole('button', { name: /Quick Transaction/ }), 900);
  await type(dialog.getByRole('textbox', { name: 'Description' }), description);
  await type(dialog.getByRole('spinbutton', { name: 'Amount' }), amount);
  const categorySelect = dialog.getByRole('combobox', { name: 'Budget category' });
  await glide(categorySelect);
  await categorySelect.selectOption({ label: category });
  await pause(600);
  const itemSelect = dialog.getByRole('combobox', { name: /Budget item/ });
  await glide(itemSelect);
  await itemSelect.selectOption({ label: item });
  await pause(600);
  await click(dialog.getByRole('button', { name: 'Add transaction' }), 1200);
}
await addTransaction('Grocery store', '84.50', 'Expenses · Expenses', 'Groceries');
await addTransaction('Pizza night', '38.20', 'Expenses · Expenses', 'Dining out');
await addTransaction('Electric bill (actual)', '136', 'Bills · Bills', 'Electric');
await pause(3500);
await click(page.getByRole('button', { name: 'Transactions' }), 2000);
await click(page.getByRole('button', { name: 'Reports' }), 1500);
await click(page.getByRole('button', { name: /Run report/ }).first(), 6000);
await click(page.getByRole('button', { name: 'Dashboard' }), 2500);

await context.close();
await browser.close();
await app.close();

const recorded = readdirSync(workDir).find((file) => file.endsWith('.webm'));
const source = join(workDir, recorded);
mkdirSync(outDir, { recursive: true });
const run = (args) => {
  const result = spawnSync(ffmpegPath, ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('ffmpeg failed');
};
run(['-i', source, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(outDir, 'demo.mp4')]);
run(['-i', source, '-an', '-c:v', 'libvpx-vp9', '-crf', '38', '-b:v', '0', join(outDir, 'demo.webm')]);
run(['-sseof', '-1.5', '-i', source, '-frames:v', '1', join(outDir, 'demo-poster.jpg')]);
if (!process.env.KEEP_WORKDIR) rmSync(workDir, { recursive: true, force: true });
console.log('Wrote demo.mp4, demo.webm, demo-poster.jpg to', outDir);
