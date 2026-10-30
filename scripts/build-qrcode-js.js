const fs = require('fs');
const path = require('path');

const araseCode = fs.readFileSync(path.join(__dirname, '../test/helpers/arase-qrcode.js'), 'utf8');

const outputCode = `/**
 * KMR Control - Production QR Code Engine
 * Pure JavaScript ISO/IEC 18004 Model 2 QR Code Generator
 * Built upon Kazuhiko Arase's reference implementation (MIT License)
 * Zero external runtime dependencies, 100% offline, cross-platform.
 */

(function (global) {
  'use strict';

  // --- KAZUHIKO ARASE QR CODE CORE ENGINE ---
${araseCode}

  // --- SIMPLE QR CODE ADAPTER FOR KMR CONTROL ---
  class SimpleQrEngine {
    constructor() {
      // GF(256) tables for test suite backwards compatibility
      this.EXP = new Uint8Array(512);
      this.LOG = new Uint8Array(256);
      let val = 1;
      for (let i = 0; i < 255; i++) {
        this.EXP[i] = val;
        this.EXP[i + 255] = val;
        this.LOG[val] = i;
        val = (val << 1) ^ (val >= 128 ? 0x11d : 0);
      }
    }

    gfMul(x, y) {
      if (x === 0 || y === 0) return 0;
      return this.EXP[this.LOG[x] + this.LOG[y]];
    }

    getGeneratorPoly(degree) {
      let poly = [1];
      for (let i = 0; i < degree; i++) {
        const next = new Array(poly.length + 1).fill(0);
        for (let j = 0; j < poly.length; j++) {
          next[j] ^= this.gfMul(poly[j], this.EXP[i]);
          next[j + 1] ^= poly[j];
        }
        poly = next;
      }
      return poly;
    }

    rsComputeRemainder(data, numEcWords) {
      const gen = this.getGeneratorPoly(numEcWords);
      const remainder = new Array(numEcWords).fill(0);
      for (const b of data) {
        const factor = b ^ remainder[0];
        remainder.shift();
        remainder.push(0);
        for (let i = 0; i < numEcWords; i++) {
          remainder[i] ^= this.gfMul(gen[numEcWords - 1 - i], factor);
        }
      }
      return remainder;
    }

    generateMatrix(text, errorCorrectionLevel = 'M') {
      // Type 0 = auto-select optimal version (1 to 40)
      const qr = qrcode(0, errorCorrectionLevel);
      qr.addData(text);
      qr.make();

      const size = qr.getModuleCount();
      const matrix = [];
      for (let r = 0; r < size; r++) {
        const row = new Uint8Array(size);
        for (let c = 0; c < size; c++) {
          row[c] = qr.isDark(r, c) ? 1 : 0;
        }
        matrix.push(row);
      }
      const version = (size - 17) / 4;
      return { size, matrix, version, qr };
    }

    toSvg(text, margin = 4, errorCorrectionLevel = 'M') {
      const qr = qrcode(0, errorCorrectionLevel);
      qr.addData(text);
      qr.make();

      const size = qr.getModuleCount();
      const totalSize = size + margin * 2;
      let rects = '';
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (qr.isDark(r, c)) {
            rects += \`<rect x="\${c + margin}" y="\${r + margin}" width="1" height="1"/>\`;
          }
        }
      }

      return \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 \${totalSize} \${totalSize}" shape-rendering="crispEdges" style="width: 100%; height: 100%; display: block;"><rect width="\${totalSize}" height="\${totalSize}" fill="#ffffff"/><g fill="#000000">\${rects}</g></svg>\`;
    }
  }

  const instance = new SimpleQrEngine();
  instance.qrcode = qrcode;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = instance;
  }
  if (typeof global !== 'undefined') {
    global.SimpleQrCode = instance;
    global.qrcode = qrcode;
  }
})(typeof window !== 'undefined' ? window : globalThis);
`;

const dest = path.join(__dirname, '../src/renderer/scripts/qrcode.js');
fs.writeFileSync(dest, outputCode, 'utf8');
console.log('Successfully written', dest, 'size:', outputCode.length);
