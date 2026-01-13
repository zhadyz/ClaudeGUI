/**
 * Generate Windows ICO file from Claude logo SVG
 * Run with: node scripts/generate-icon.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const toIco = require('to-ico');

async function generateIcons() {
  const iconsDir = path.join(__dirname, '../assets/icons');
  const svgPath = path.join(__dirname, '../assets/claude.svg');

  // Ensure directory exists
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  console.log('Generating Claude icons from SVG...');

  // Read the SVG
  const svgBuffer = fs.readFileSync(svgPath);

  // Create PNG buffers at different sizes needed for ICO
  const sizes = [16, 32, 48, 64, 128, 256];
  const pngBuffers = [];

  for (const size of sizes) {
    const pngBuffer = await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toBuffer();

    pngBuffers.push(pngBuffer);
    console.log(`  Created ${size}x${size} PNG buffer`);
  }

  // Also save a main PNG at 256px
  const mainPngPath = path.join(iconsDir, 'claude-icon.png');
  await sharp(svgBuffer)
    .resize(256, 256)
    .png()
    .toFile(mainPngPath);
  console.log('  Saved claude-icon.png');

  // Convert to ICO
  try {
    const icoBuffer = await toIco(pngBuffers);
    const icoPath = path.join(iconsDir, 'icon.ico');
    fs.writeFileSync(icoPath, icoBuffer);
    console.log('  Created icon.ico');
  } catch (err) {
    console.error('Error creating ICO:', err.message);
  }

  console.log('\nDone! Icon files created:');
  console.log('  - assets/icons/icon.ico (Windows taskbar/installer)');
  console.log('  - assets/icons/claude-icon.png (256x256 PNG)');
}

generateIcons().catch(console.error);
