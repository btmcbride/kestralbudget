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
const macIconsetDirectory = path.join(outputDirectory, 'kestral-budget.iconset');
const macIconSizes = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
];

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
await mkdir(macIconsetDirectory, { recursive: true });
await writeFile(markPath, transparentMark);
const pngPaths = await Promise.all(sizes.map(async (size) => {
  const output = path.join(outputDirectory, `kestral-budget-${size}.png`);
  await sharp(transparentMark).resize(size, size).png().toFile(output);
  return output;
}));

const icon = await pngToIco(pngPaths);
await writeFile(path.join(outputDirectory, 'kestral-budget.ico'), icon);
await Promise.all(macIconSizes.map(([name, size]) =>
  sharp(transparentMark).resize(size, size).png().toFile(path.join(macIconsetDirectory, name))));
console.log(`Generated ${markPath}, ${path.join(outputDirectory, 'kestral-budget.ico')}, and the macOS iconset`);