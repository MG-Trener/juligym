// Usage: node scripts/optimize-images.cjs input-map.json [path-to-sharp]
// Lossy WebP encoding only; source artwork and framing remain unchanged.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require(process.argv[3] || 'sharp');
const root = path.resolve(__dirname, '..');
(async () => {
  const inputs = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
  await fs.mkdir(path.join(root, 'assets/exercises'), { recursive: true });
  for (const [id, source] of Object.entries(inputs)) {
    if (!/^[a-z]+$/.test(id)) throw new Error('Invalid asset name');
    const output = path.join(root, 'assets/exercises', id + '.webp');
    await sharp(source).webp({ quality: 88, effort: 6 }).toFile(output);
    console.log(id, (await fs.stat(output)).size);
  }
})();
