/**
 * Creates minimal placeholder icon files so Electron can launch
 * before proper icons are generated. Run with:
 *   node electron/create-placeholder-icons.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

// Minimal 1x1 transparent PNG (valid PNG header + IHDR + IDAT + IEND)
const TINY_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6260000000000200' +
  '0175e1a860000000049454e44ae426082', 'hex'
);

const files = ['icon.png', 'tray-icon.png', 'tray-icon-alert.png', 'tray-icon-monitor.png'];
files.forEach(function(f) {
  const p = path.join(assetsDir, f);
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, TINY_PNG);
    console.log('Created placeholder:', f);
  } else {
    console.log('Already exists:', f);
  }
});

// For Windows: create a minimal .ico file (same PNG wrapped)
const icoPath = path.join(assetsDir, 'icon.ico');
if (!fs.existsSync(icoPath)) {
  // ICO file with 1x1 PNG image
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);  // reserved
  header.writeUInt16LE(1, 2);  // type: ICO
  header.writeUInt16LE(1, 4);  // count: 1 image
  const dirEntry = Buffer.alloc(16);
  dirEntry.writeUInt8(1, 0);   // width
  dirEntry.writeUInt8(1, 1);   // height
  dirEntry.writeUInt8(0, 2);   // color count
  dirEntry.writeUInt8(0, 3);   // reserved
  dirEntry.writeUInt16LE(1, 4); // planes
  dirEntry.writeUInt16LE(32, 6); // bit count
  dirEntry.writeUInt32LE(TINY_PNG.length, 8); // size
  dirEntry.writeUInt32LE(22, 12); // offset = 6 + 16
  fs.writeFileSync(icoPath, Buffer.concat([header, dirEntry, TINY_PNG]));
  console.log('Created placeholder: icon.ico');
}

console.log('\nPlaceholder icons created. Run "node electron/generate-icons.js" after installing sharp for proper icons.');
