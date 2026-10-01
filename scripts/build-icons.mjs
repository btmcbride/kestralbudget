import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pngToIco from 'png-to-ico';
import sharp from 'sharp';

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reference = path.join(projectDirectory, 'icon.png');
const publicDirectory = path.join(projectDirectory, 'public');
const markPath = path.join(publicDirectory, 'kestral-mark.png');
const outputDirectory = path.join(projectDirectory, 'assets');
const sizes = [16, 24, 32, 48, 64, 128, 256];

const cropped = await sharp(reference)
  .trim({ background: { r: 240, g: 240, b: 240 }, threshold: 20 })
  .png()
  .toBuffer();
const { width, height } = await sharp(cropped).metadata();
const cornerRadius = Math.round(Math.min(width, height) * 0.18);
const cornerMask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${cornerRadius}" fill="#fff"/></svg>`);
const transparentMark = await sharp(cropped)
  .ensureAlpha()
  .composite([{ input: cornerMask, blend: 'dest-in' }])
  .png()
  .toBuffer();

await mkdir(publicDirectory, { recursive: true });
await mkdir(outputDirectory, { recursive: true });
await writeFile(markPath, transparentMark);
const pngPaths = await Promise.all(sizes.map(async (size) => {
  const output = path.join(outputDirectory, `kestral-budget-${size}.png`);
  await sharp(transparentMark).resize(size, size).png().toFile(output);
  return output;
}));

const icon = await pngToIco(pngPaths);
await writeFile(path.join(outputDirectory, 'kestral-budget.ico'), icon);
console.log(`Generated ${markPath} and ${path.join(outputDirectory, 'kestral-budget.ico')}`);