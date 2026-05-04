// Para generar los iconos PWA reales:
//
// Opción A — pwa-asset-generator (recomendado):
//   1. Coloca tu logo en frontend/public/sjqa-logo.png (al menos 512x512px)
//   2. Ejecuta desde la carpeta frontend/:
//      npx pwa-asset-generator sjqa-logo.png public/ --icon-only --favicon
//   Esto genera automáticamente icon-192.png e icon-512.png en public/
//
// Opción B — generador web:
//   Sube tu logo en https://realfavicongenerator.net/
//   Descarga el paquete y coloca icon-192.png e icon-512.png en frontend/public/
//
// Opción C — Sharp (programático):
//   npm install sharp
//   Luego descomenta y ejecuta el código de abajo:

/*
const sharp = require('sharp');
const path = require('path');

const SOURCE = path.join(__dirname, '../public/sjqa-logo.png');
const OUTPUT_DIR = path.join(__dirname, '../public');

async function generateIcons() {
  const sizes = [192, 512];
  for (const size of sizes) {
    await sharp(SOURCE)
      .resize(size, size, { fit: 'contain', background: { r: 15, g: 38, b: 87, alpha: 1 } })
      .png()
      .toFile(path.join(OUTPUT_DIR, `icon-${size}.png`));
    console.log(`Generado: icon-${size}.png`);
  }
  console.log('Iconos PWA listos en frontend/public/');
}

generateIcons().catch(console.error);
*/

console.log('Iconos PWA: coloca icon-192.png e icon-512.png en frontend/public/');
console.log('Consulta los comentarios de este archivo para instrucciones de generación.');
