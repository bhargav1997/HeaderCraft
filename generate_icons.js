/**
 * Icon generator for HeaderCraft extension.
 * Run: node generate_icons.js
 * Requires: npm install canvas
 */
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

fs.mkdirSync('icons', { recursive: true });

for (const size of [16, 48, 128]) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background gradient — deep indigo to violet
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#6366f1');
  grad.addColorStop(1, '#8b5cf6');

  const r = size / 5;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, r);
  ctx.fillStyle = grad;
  ctx.fill();

  // "H" lettermark
  ctx.fillStyle = 'white';
  ctx.font = `bold ${Math.round(size * 0.55)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('H', size / 2, size / 2 + size * 0.03);

  fs.writeFileSync(
    path.join('icons', `icon-${size}.png`),
    canvas.toBuffer('image/png')
  );
  console.log(`✓ icons/icon-${size}.png  (${size}×${size})`);
}
console.log('Done.');
