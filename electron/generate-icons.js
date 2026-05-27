/**
 * Generates PNG icons at all required sizes from the Aegis shield SVG.
 * Run once with: node electron/generate-icons.js
 * Requires: npm install sharp  (already in devDependencies)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 70" width="512" height="512">
  <rect width="60" height="70" fill="#020818"/>
  <polygon points="30,2 58,15 58,40 30,68 2,40 2,15" fill="#0a0f1e" stroke="#f59e0b" stroke-width="3"/>
  <polygon points="30,10 50,20 50,38 30,58 10,38 10,20" fill="#0d1526" stroke="#f59e0b" stroke-width="1.5"/>
  <line x1="30" y1="10" x2="30" y2="58" stroke="#f59e0b" stroke-width="2"/>
  <line x1="10" y1="29" x2="50" y2="29" stroke="#f59e0b" stroke-width="2"/>
  <polygon points="30,18 38,29 30,40 22,29" fill="#f59e0b" opacity="0.9"/>
</svg>`;

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

// Write the base SVG
fs.writeFileSync(path.join(assetsDir, 'icon.svg'), SVG);

async function generateIcons() {
  let sharp;
  try { sharp = require('sharp'); } catch (e) {
    console.log('sharp not installed — run: npm install sharp');
    console.log('Icons will be generated after sharp is installed.');
    return;
  }

  const sizes = [16, 24, 32, 48, 64, 96, 128, 256, 512];
  const svgBuffer = Buffer.from(SVG);

  for (const size of sizes) {
    const outPath = path.join(assetsDir, `icon-${size}.png`);
    await sharp(svgBuffer).resize(size, size).png().toFile(outPath);
    console.log(`Generated ${size}x${size} → ${outPath}`);
  }

  // Main icon.png (256px for Linux)
  await sharp(svgBuffer).resize(256, 256).png().toFile(path.join(assetsDir, 'icon.png'));

  // Tray icons (22px for Windows, 18px for macOS)
  await sharp(svgBuffer).resize(32, 32).png().toFile(path.join(assetsDir, 'tray-icon.png'));
  await sharp(svgBuffer).resize(32, 32).png().toFile(path.join(assetsDir, 'tray-icon-alert.png'));
  await sharp(svgBuffer).resize(32, 32).png().toFile(path.join(assetsDir, 'tray-icon-monitor.png'));

  console.log('All PNG icons generated.');
  console.log('Note: For production builds, convert icon.png to icon.ico (Windows) and icon.icns (macOS).');
  console.log('Use: https://icoconvert.com or npm install png-to-ico');
}

generateIcons().catch(console.error);
