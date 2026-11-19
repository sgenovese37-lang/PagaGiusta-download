/* PagaGiusta - lettore PDF minimale, tutto in locale (nessuna rete).
   Supporta PDF non cifrati e cifrati con "Standard security handler" (RC4, R2/R3)
   con password utente vuota, come le buste paga scaricate da EGO. */
(function (root) {
  'use strict';

  var PAD = [0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41, 0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08,
    0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80, 0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A];

  // ---------- MD5 (byte array -> byte array) ----------
  function md5(bytes) {
    var K = [], S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
      4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
    for (var i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
    var len = bytes.length, nBlocks = ((len + 8) >>> 6) + 1, words = new Array(nBlocks * 16).fill(0);
    for (i = 0; i < len; i++) words[i >> 2] |= bytes[i] << ((i % 4) * 8);
    words[len >> 2] |= 0x80 << ((len % 4) * 8);
    words[nBlocks * 16 - 2] = (len * 8) >>> 0;
    words[nBlocks * 16 - 1] = Math.floor(len / 536870912) >>> 0;
    var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    for (var blk = 0; blk < nBlocks; blk++) {
      var A = a0, B = b0, C = c0, D = d0;
      for (i = 0; i < 64; i++) {
        var F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * i) % 16; }
        F = (F + A + K[i] + words[blk * 16 + g]) >>> 0;
        A = D; D = C; C = B;
        B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
      }
      a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }
    var out = [];
    [a0, b0, c0, d0].forEach(function (v) { for (var k = 0; k < 4; k++) out.push((v >>> (8 * k)) & 255); });
    return out;
  }

  function rc4(key, data) {
    var s = new Uint8Array(256), i, j = 0, t;
    for (i = 0; i < 256; i++) s[i] = i;
    for (i = 0; i < 256; i++) { j = (j + s[i] + key[i % key.length]) & 255; t = s[i]; s[i] = s[j]; s[j] = t; }
    var out = new Uint8Array(data.length); i = 0; j = 0;
    for (var n = 0; n < data.length; n++) {
      i = (i + 1) & 255; j = (j + s[i]) & 255; t = s[i]; s[i] = s[j]; s[j] = t;
      out[n] = data[n] ^ s[(s[i] + s[j]) & 255];
    }
    return out;
  }

  function latin1(bytes) {
    var s = '', CH = 8192;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return s;
  }

  // Decodifica una stringa letterale PDF (senza parentesi esterne) in array di byte
  function literalBytes(str) {
    var out = [], i = 0;
    while (i < str.length) {
      var c = str.charCodeAt(i);
      if (c === 92) { // backslash
        var n = str[i + 1];
        if (n >= '0' && n <= '7') {
          var j = i + 1, oct = '';
          while (j < str.length && j < i + 4 && str[j] >= '0' && str[j] <= '7') { oct += str[j]; j++; }
          out.push(parseInt(oct, 8) & 255); i = j; continue;
        }
        var map = { n: 10, r: 13, t: 9, b: 8, f: 12 };
        if (map[n] !== undefined) { out.push(map[n]); i += 2; continue; }
        if (n === '\r' || n === '\n') { i += 2; if (n === '\r' && str[i] === '\n') i++; continue; }
        out.push(str.charCodeAt(i + 1) & 255); i += 2; continue;
      }
      out.push(c & 255); i++;
    }
    return out;
  }

  // Estrae una stringa letterale bilanciata a partire da pos (che punta a '(')
  function readLiteral(s, pos) {
    var depth = 0, i = pos;
    for (; i < s.length; i++) {
      var ch = s[i];
      if (ch === '\\') { i++; continue; }
      if (ch === '(') depth++;
      else if (ch === ')') { depth--; if (depth === 0) break; }
    }
    return { value: s.substring(pos + 1, i), end: i + 1 };
  }

  function int32le(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }

  function encryptionKey(s) {
    var m = /\/Filter\s*\/Standard/.exec(s);
    if (!m) return null;
    // trova il dizionario che contiene /Filter /Standard
    var start = s.lastIndexOf('<<', m.index), end = s.indexOf('>>', m.index);
    var dict = s.substring(start, end + 2);
    function num(name, def) { var r = new RegExp('/' + name + '\\s+(-?\\d+)').exec(dict); return r ? parseInt(r[1], 10) : def; }
    function str(name) {
      var r = new RegExp('/' + name + '\\s*\\(').exec(dict);
      if (r) return literalBytes(readLiteral(dict, r.index + r[0].length - 1).value);
      r = new RegExp('/' + name + '\\s*<([0-9A-Fa-f\\s]+)>').exec(dict);
      if (r) return hexBytes(r[1]);
      return null;
    }
    var V = num('V', 0), R = num('R', 2), P = num('P', 0), lenBits = num('Length', 40);
    if (V > 2) throw new Error('Formato di protezione PDF non supportato (V' + V + ')');
    var O = str('O');
    var idm = /\/ID\s*\[\s*<([0-9A-Fa-f\s]+)>/.exec(s);
    var ID = idm ? hexBytes(idm[1]) : [];
    var n = R >= 3 ? lenBits / 8 : 5;
    var h = md5(PAD.concat(O.slice(0, 32), int32le(P), ID));
    if (R >= 3) for (var i = 0; i < 50; i++) h = md5(h.slice(0, n));
    return h.slice(0, n);
  }

  function hexBytes(h) {
    h = h.replace(/\s+/g, ''); var out = [];
    for (var i = 0; i < h.length; i += 2) out.push(parseInt(h.substr(i, 2), 16));
    return out;
  }

  function objectKey(key, num, gen) {
    var k = md5(key.concat([num & 255, (num >> 8) & 255, (num >> 16) & 255, gen & 255, (gen >> 8) & 255]));
    return k.slice(0, Math.min(key.length + 5, 16));
  }


  // ---------- Decompressione "Flate" scritta in JavaScript ----------
  // Serve sui telefoni (es. iPhone con iOS precedente al 16.4) che non hanno DecompressionStream.
  var LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  var LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  var DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  var DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  var CLORD = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  function jsInflate(data) {
    var pos = 0, bitbuf = 0, bitcnt = 0;
    if ((data[0] & 0x0f) === 8 && ((data[0] << 8) | data[1]) % 31 === 0) pos = 2; // intestazione zlib
    var out = new Uint8Array(Math.max(1024, data.length * 4)), op = 0;
    function ensure(n) {
      if (op + n <= out.length) return;
      var nl = out.length * 2; while (nl < op + n) nl *= 2;
      var o2 = new Uint8Array(nl); o2.set(out.subarray(0, op)); out = o2;
    }
    function bits(n) {
      while (bitcnt < n) {
        if (pos >= data.length) throw new Error('PDF troncato');
        bitbuf |= data[pos++] << bitcnt; bitcnt += 8;
      }
      var v = bitbuf & ((1 << n) - 1); bitbuf >>>= n; bitcnt -= n; return v;
    }
    function build(lengths, n) {
      var count = new Uint16Array(16), symbol = new Uint16Array(n), offs = new Uint16Array(16), i;
      for (i = 0; i < n; i++) count[lengths[i]]++;
      count[0] = 0;
      for (i = 1; i < 16; i++) offs[i] = offs[i - 1] + count[i - 1];
      for (i = 0; i < n; i++) if (lengths[i]) symbol[offs[lengths[i]]++] = i;
      return { count: count, symbol: symbol };
    }
    function decode(h) {
      var code = 0, first = 0, index = 0;
      for (var len = 1; len < 16; len++) {
        code |= bits(1);
        var c = h.count[len];
        if (code - c < first) return h.symbol[index + (code - first)];
        index += c; first += c; first <<= 1; code <<= 1;
      }
      throw new Error('Dati compressi non validi');
    }
    var fixedL = null, fixedD = null;
    function fixed() {
      if (!fixedL) {
        var l = new Uint8Array(288), i;
        for (i = 0; i < 144; i++) l[i] = 8; for (; i < 256; i++) l[i] = 9; for (; i < 280; i++) l[i] = 7; for (; i < 288; i++) l[i] = 8;
        fixedL = build(l, 288);
        var d = new Uint8Array(30); for (i = 0; i < 30; i++) d[i] = 5;
        fixedD = build(d, 30);
      }
    }
    function codes(lh, dh) {
      for (;;) {
        var sym = decode(lh);
        if (sym < 256) { ensure(1); out[op++] = sym; }
        else if (sym === 256) return;
        else {
          sym -= 257; if (sym >= 29) throw new Error('Dati compressi non validi');
          var len = LBASE[sym] + bits(LEXT[sym]);
          var ds = decode(dh); var dist = DBASE[ds] + bits(DEXT[ds]);
          if (dist > op) throw new Error('Dati compressi non validi');
          ensure(len);
          for (var k = 0; k < len; k++) { out[op] = out[op - dist]; op++; }
        }
      }
    }
    var last;
    do {
      last = bits(1);
      var type = bits(2);
      if (type === 0) {
        bitbuf = 0; bitcnt = 0;
        var ln = data[pos] | (data[pos + 1] << 8); pos += 4;
        ensure(ln); out.set(data.subarray(pos, pos + ln), op); op += ln; pos += ln;
      } else if (type === 1) { fixed(); codes(fixedL, fixedD); }
      else if (type === 2) {
        var nlen = bits(5) + 257, ndist = bits(5) + 1, ncode = bits(4) + 4, i;
        var cl = new Uint8Array(19);
        for (i = 0; i < ncode; i++) cl[CLORD[i]] = bits(3);
        var ch = build(cl, 19), lens = new Uint8Array(nlen + ndist);
        for (i = 0; i < nlen + ndist;) {
          var sym = decode(ch);
          if (sym < 16) lens[i++] = sym;
          else {
            var rep = 0, val = 0;
            if (sym === 16) { if (!i) throw new Error('Dati compressi non validi'); val = lens[i - 1]; rep = 3 + bits(2); }
            else if (sym === 17) rep = 3 + bits(3);
            else rep = 11 + bits(7);
            while (rep--) lens[i++] = val;
          }
        }
        codes(build(lens.subarray(0, nlen), nlen), build(lens.subarray(nlen), ndist));
      } else throw new Error('Dati compressi non validi');
    } while (!last);
    return out.subarray(0, op);
  }

  async function inflate(bytes) {
    if (typeof DecompressionStream !== 'undefined') {
      try {
        var ds = new DecompressionStream('deflate');
        var stream = new Blob([bytes]).stream().pipeThrough(ds);
        var buf = await new Response(stream).arrayBuffer();
        return new Uint8Array(buf);
      } catch (e) { /* passa al lettore JavaScript */ }
    }
    return jsInflate(bytes);
  }

  // Restituisce le righe di testo: [{x, y, size, font, text}]
  async function extractRows(input) {
    var bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    var s = latin1(bytes);
    if (s.substr(0, 5) !== '%PDF-') throw new Error('Il file non è un PDF');
    var key = encryptionKey(s);
    var re = /(\d+)\s+(\d+)\s+obj\s*<<((?:(?!>>\s*stream)[\s\S])*)>>\s*stream\r?\n/g, m, rows = [];
    while ((m = re.exec(s))) {
      var num = parseInt(m[1], 10), gen = parseInt(m[2], 10), dict = m[3];
      var len = null, lm = /\/Length\s+(\d+)(\s+(\d+)\s+R)?/.exec(dict);
      if (lm) {
        if (lm[2]) {
          var ref = new RegExp('(?:^|[^\\d])' + lm[1] + '\\s+' + lm[3] + '\\s+obj\\s*(\\d+)').exec(s);
          if (ref) len = parseInt(ref[1], 10);
        } else len = parseInt(lm[1], 10);
      }
      var start = m.index + m[0].length;
      if (len === null) len = s.indexOf('endstream', start) - start;
      if (len <= 0) continue;
      if (/\/Subtype\s*\/Image/.test(dict)) continue;
      var data = bytes.subarray(start, start + len);
      if (key) data = rc4(objectKey(key, num, gen), data);
      if (/\/FlateDecode/.test(dict)) {
        try { data = await inflate(data); } catch (e) { continue; }
      } else if (/\/Filter/.test(dict)) continue;
      parseContent(latin1(data), rows);
    }
    return rows;
  }

  // Interpreta un content stream in modo semplice: Tf, Td, TD, Tm, T*, Tj, TJ, ', "
  function parseContent(c, rows) {
    var font = '', size = 0, tx = 0, ty = 0, lx = 0, ly = 0, leading = 0, i = 0, stack = [];
    var tokRe = /\s*(\((?:\\[\s\S]|[^\\)])*\)|\[[^\]]*\]|<<|>>|<[0-9A-Fa-f\s]*>|\/[^\s\/\[\]()<>{}%]+|[^\s\/\[\]()<>{}%]+)/g;
    // gestione stringhe annidate: riscriviamo un tokenizer semplice
    var len = c.length;
    function pushText(txt) { if (txt.length) rows.push({ x: tx, y: ty, size: size, font: font, text: txt }); }
    function decodeStr(tok) {
      if (tok[0] === '(') { var b = literalBytes(tok.substring(1, tok.length - 1)); return String.fromCharCode.apply(null, b); }
      if (tok[0] === '<') { var hb = hexBytes(tok.substring(1, tok.length - 1)); return String.fromCharCode.apply(null, hb); }
      return '';
    }
    while (i < len) {
      var ch = c[i];
      if (ch === ' ' || ch === '\r' || ch === '\n' || ch === '\t') { i++; continue; }
      if (ch === '%') { while (i < len && c[i] !== '\n' && c[i] !== '\r') i++; continue; }
      var tok;
      if (ch === '(') { var lit = readLiteral(c, i); tok = '(' + lit.value + ')'; i = lit.end; stack.push(tok); continue; }
      if (ch === '[') { var depth = 0, j = i; for (; j < len; j++) { if (c[j] === '(') { j = readLiteral(c, j).end - 1; continue; } if (c[j] === '[') depth++; if (c[j] === ']') { depth--; if (!depth) break; } } stack.push(c.substring(i, j + 1)); i = j + 1; continue; }
      if (ch === '<' && c[i + 1] !== '<') { var e = c.indexOf('>', i); stack.push(c.substring(i, e + 1)); i = e + 1; continue; }
      var k = i; while (k < len && !/[\s\[\]()<>\/%]/.test(c[k])) k++;
      if (ch === '/') { k = i + 1; while (k < len && !/[\s\[\]()<>\/%]/.test(c[k])) k++; }
      if (k === i) k = i + 1;
      tok = c.substring(i, k); i = k;
      switch (tok) {
        case 'BT': tx = ty = lx = ly = 0; stack = []; break;
        case 'Tf': size = parseFloat(stack[stack.length - 1]); font = (stack[stack.length - 2] || '').replace('/', ''); stack = []; break;
        case 'Td': lx += parseFloat(stack[stack.length - 2]); ly += parseFloat(stack[stack.length - 1]); tx = lx; ty = ly; stack = []; break;
        case 'TD': leading = -parseFloat(stack[stack.length - 1]); lx += parseFloat(stack[stack.length - 2]); ly += parseFloat(stack[stack.length - 1]); tx = lx; ty = ly; stack = []; break;
        case 'TL': leading = parseFloat(stack[stack.length - 1]); stack = []; break;
        case 'Tm': lx = parseFloat(stack[stack.length - 2]); ly = parseFloat(stack[stack.length - 1]); tx = lx; ty = ly; stack = []; break;
        case 'T*': ly -= leading; tx = lx; ty = ly; stack = []; break;
        case 'Tj': pushText(decodeStr(stack[stack.length - 1] || '')); stack = []; break;
        case "'": ly -= leading; tx = lx; ty = ly; pushText(decodeStr(stack[stack.length - 1] || '')); stack = []; break;
        case '"': ly -= leading; tx = lx; ty = ly; pushText(decodeStr(stack[stack.length - 1] || '')); stack = []; break;
        case 'TJ':
          var arr = stack[stack.length - 1] || '', out = '', r2 = /\((?:\\[\s\S]|[^\\)])*\)|<[0-9A-Fa-f\s]*>/g, mm;
          while ((mm = r2.exec(arr))) out += decodeStr(mm[0]);
          pushText(out); stack = []; break;
        default:
          if (/^[a-zA-Z*']+$/.test(tok) && tok !== 'true' && tok !== 'false' && tok !== 'null') stack = [];
          else stack.push(tok);
      }
    }
  }

  root.PGPdf = { extractRows: extractRows, _md5: md5, _inflate: jsInflate };
})(typeof window !== 'undefined' ? window : globalThis);
