/* Porta de source/QrCode.brs (Roku 0.1.88): codificador QR mínimo para a
 * tela de ativação. Modo byte, versão 4 (33x33), correção L: até 78 bytes.
 * qrMatrix(texto) -> matriz [linha][coluna] com 1 = módulo escuro, ou null.
 * ES5 puro; também roda no Node para os testes.
 */
(function (root) {
  'use strict';
  var SIZE = 33, DATA_CW = 80, ECC_CW = 20;

  function pushBits(bits, value, count) { for (var i = count - 1; i >= 0; i--) bits.push((value >> i) & 1); }
  function empty(value) { var rows = []; for (var r = 0; r < SIZE; r++) { var row = []; for (var c = 0; c < SIZE; c++) row.push(value); rows.push(row); } return rows; }

  function utf8Bytes(text) {
    var out = [], s = unescape(encodeURIComponent(text));
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 255);
    return out;
  }

  function finder(m, r0, c0) {
    for (var r = -1; r <= 7; r++) for (var c = -1; c <= 7; c++) {
      var rr = r0 + r, cc = c0 + c;
      if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) continue;
      var on = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6)) || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      m[rr][cc] = on ? 1 : 0;
    }
  }

  function maskBit(mask, r, c) {
    switch (mask) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return (r * c) % 2 + (r * c) % 3 === 0;
      case 6: return ((r * c) % 2 + (r * c) % 3) % 2 === 0;
      default: return ((r + c) % 2 + (r * c) % 3) % 2 === 0;
    }
  }

  function format(m, mask) {
    var value = (1 << 3) | mask, v = value << 10;
    for (var i = 14; i >= 10; i--) if (v & (1 << i)) v ^= 0x537 << (i - 10);
    var bits = ((value << 10) | v) ^ 0x5412;
    var pos1 = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
    var pos2 = [[SIZE - 1, 8], [SIZE - 2, 8], [SIZE - 3, 8], [SIZE - 4, 8], [SIZE - 5, 8], [SIZE - 6, 8], [SIZE - 7, 8], [8, SIZE - 8], [8, SIZE - 7], [8, SIZE - 6], [8, SIZE - 5], [8, SIZE - 4], [8, SIZE - 3], [8, SIZE - 2], [8, SIZE - 1]];
    for (i = 0; i <= 14; i++) {
      var bit = (bits >> (14 - i)) & 1;
      m[pos1[i][0]][pos1[i][1]] = bit;
      m[pos2[i][0]][pos2[i][1]] = bit;
    }
  }

  function penalty(m) {
    var total = 0;
    for (var a = 0; a < SIZE; a++) {
      var runRow = 1, runCol = 1;
      for (var b = 1; b < SIZE; b++) {
        if (m[a][b] === m[a][b - 1]) runRow++; else { if (runRow >= 5) total += runRow - 2; runRow = 1; }
        if (m[b][a] === m[b - 1][a]) runCol++; else { if (runCol >= 5) total += runCol - 2; runCol = 1; }
      }
      if (runRow >= 5) total += runRow - 2;
      if (runCol >= 5) total += runCol - 2;
    }
    return total;
  }

  function qrMatrix(text) {
    var bytes = utf8Bytes(String(text || ''));
    if (bytes.length > 78) return null;
    var gfExp = [], gfLog = [], i, j, x = 1;
    for (i = 0; i < 512; i++) gfExp.push(0);
    for (i = 0; i < 256; i++) gfLog.push(0);
    for (i = 0; i < 255; i++) { gfExp[i] = x; gfLog[x] = i; x *= 2; if (x >= 256) x ^= 0x11D; }
    for (i = 255; i < 512; i++) gfExp[i] = gfExp[i - 255];
    function mul(a, b) { return a === 0 || b === 0 ? 0 : gfExp[gfLog[a] + gfLog[b]]; }

    var bits = [];
    pushBits(bits, 4, 4);
    pushBits(bits, bytes.length, 8);
    for (i = 0; i < bytes.length; i++) pushBits(bits, bytes[i], 8);
    var terminator = Math.min(4, DATA_CW * 8 - bits.length);
    for (i = 0; i < terminator; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    var codewords = [];
    for (i = 0; i < bits.length; i += 8) { var value = 0; for (j = 0; j < 8; j++) value = value * 2 + bits[i + j]; codewords.push(value); }
    for (var pad = 0; codewords.length < DATA_CW; pad++) codewords.push(pad % 2 === 0 ? 0xEC : 0x11);

    var gen = [1];
    for (i = 0; i < ECC_CW; i++) {
      var next = [];
      for (j = 0; j <= gen.length; j++) next.push(0);
      for (j = 0; j < gen.length; j++) { next[j] ^= gen[j]; next[j + 1] ^= mul(gen[j], gfExp[i]); }
      gen = next;
    }
    var work = codewords.slice();
    for (i = 0; i < ECC_CW; i++) work.push(0);
    for (i = 0; i < DATA_CW; i++) {
      var coef = work[i];
      if (coef) for (j = 1; j < gen.length; j++) work[i + j] ^= mul(gen[j], coef);
    }
    var all = [];
    for (i = 0; i < DATA_CW; i++) pushBits(all, codewords[i], 8);
    for (i = DATA_CW; i < DATA_CW + ECC_CW; i++) pushBits(all, work[i], 8);

    var base = empty(-1);
    finder(base, 0, 0); finder(base, 0, SIZE - 7); finder(base, SIZE - 7, 0);
    for (i = 8; i <= SIZE - 9; i++) { base[6][i] = (i + 1) % 2; base[i][6] = (i + 1) % 2; }
    for (var r = -2; r <= 2; r++) for (var c = -2; c <= 2; c++) base[26 + r][26 + c] = Math.max(Math.abs(r), Math.abs(c)) === 1 ? 0 : 1;
    base[SIZE - 8][8] = 1;
    for (i = 0; i <= 8; i++) { if (base[8][i] === -1) base[8][i] = 0; if (base[i][8] === -1) base[i][8] = 0; }
    for (i = 0; i <= 7; i++) { if (base[8][SIZE - 1 - i] === -1) base[8][SIZE - 1 - i] = 0; if (base[SIZE - 1 - i][8] === -1) base[SIZE - 1 - i][8] = 0; }

    var best = null, bestPenalty = 0;
    for (var mask = 0; mask < 8; mask++) {
      var m = empty(0);
      for (r = 0; r < SIZE; r++) for (c = 0; c < SIZE; c++) if (base[r][c] !== -1) m[r][c] = base[r][c];
      var index = 0, upward = true;
      for (var col = SIZE - 1; col > 0; col -= 2) {
        if (col === 6) col--;
        for (var step = 0; step < SIZE; step++) {
          r = upward ? SIZE - 1 - step : step;
          for (var k = 0; k < 2; k++) {
            c = col - k;
            if (base[r][c] !== -1) continue;
            var bit = index < all.length ? all[index] : 0;
            index++;
            if (maskBit(mask, r, c)) bit = 1 - bit;
            m[r][c] = bit;
          }
        }
        upward = !upward;
      }
      format(m, mask);
      var score = penalty(m);
      if (!best || score < bestPenalty) { best = m; bestPenalty = score; }
    }
    return best;
  }

  /* Desenha a matriz como SVG (módulos escuros agrupados por linha). */
  function qrSvg(text, moduleSize, color) {
    var matrix = qrMatrix(text);
    if (!matrix) return '';
    var size = matrix.length * moduleSize, rects = '';
    for (var r = 0; r < matrix.length; r++) {
      var c = 0;
      while (c < matrix.length) {
        if (!matrix[r][c]) { c++; continue; }
        var start = c;
        while (c < matrix.length && matrix[r][c]) c++;
        rects += '<rect x="' + start * moduleSize + '" y="' + r * moduleSize + '" width="' + (c - start) * moduleSize + '" height="' + moduleSize + '"/>';
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" shape-rendering="crispEdges" fill="' + (color || '#070b14') + '">' + rects + '</svg>';
  }

  var api = { qrMatrix: qrMatrix, qrSvg: qrSvg };
  root.EP = root.EP || {};
  root.EP.QrCode = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
