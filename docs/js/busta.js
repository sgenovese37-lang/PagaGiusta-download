/* PagaGiusta - interpretazione della busta paga (Libro Unico del Lavoro, CL System).
   Legge SOLO numeri, codici e mese. I dati personali (nome, codice fiscale, indirizzo,
   IBAN...) vengono ignorati e non vengono mai salvati. */
(function (root) {
  'use strict';

  var MESI = { GEN: 1, FEB: 2, MAR: 3, APR: 4, MAG: 5, GIU: 6, LUG: 7, AGO: 8, SET: 9, OTT: 10, NOV: 11, DIC: 12 };

  // Colonne (fine del numero, in punti PDF) della tabella delle voci
  var COL = { aliquota: 266.6, unita: 343.4, valUnit: 415.4, comp: 492.2, tratt: 569.0 };

  function num(s) {
    if (s === undefined || s === null || s === '') return null;
    var neg = /-$/.test(s) || /^-/.test(s);
    s = s.replace(/-/g, '');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var v = parseFloat(s);
    if (isNaN(v)) return null;
    return neg ? -v : v;
  }

  function charW(row) { return (row.size || 8) * 0.6; }

  // Restituisce i "token" di una riga con posizione assoluta di inizio e fine
  function tokens(row) {
    var out = [], re = /\S+/g, m, cw = charW(row);
    while ((m = re.exec(row.text))) {
      out.push({ t: m[0], x0: row.x + m.index * cw, x1: row.x + (m.index + m[0].length) * cw });
    }
    return out;
  }

  function nearestCol(x1) {
    var best = null, bd = 1e9;
    for (var k in COL) { var d = Math.abs(COL[k] - x1); if (d < bd) { bd = d; best = k; } }
    return bd <= 14 ? best : null;
  }

  function round2(v) { return Math.round(v * 100) / 100; }

  function analyze(allRows) {
    var rows = allRows.filter(function (r) { return r.size >= 6.5 && r.text.trim().length; })
      .map(function (r) { return { x: r.x, y: r.y, size: r.size, text: r.text.replace(/\s+$/, '') }; });
    rows.sort(function (a, b) { return b.y - a.y || a.x - b.x; });

    var res = {
      formato: 'LUL', mese: null, meseLabel: '', giorni: [], righeCal: {}, elementi: [], totElementi: null,
      voci: [], ferie: null, rol: null, irpef: null, addizionali: null, totComp: null, totTratt: null,
      netto: null, arrotondamenti: 0, avvisi: []
    };

    // ---- Mese ----
    rows.some(function (r) {
      var m = /^(GEN|FEB|MAR|APR|MAG|GIU|LUG|AGO|SET|OTT|NOV|DIC)\.(\d{4})$/.exec(r.text.trim());
      if (m) { res.mese = m[2] + '-' + (MESI[m[1]] < 10 ? '0' : '') + MESI[m[1]]; return true; }
      return false;
    });
    if (!res.mese) throw new Error('Non riesco a trovare il mese: è una busta paga di EGO?');

    // ---- Calendario presenze ----
    var wkRow = null;
    rows.some(function (r) { if (/^[glmvsdD*](\s{2}[glmvsdD*])+\s*$/.test(r.text) && r.text.length > 40) { wkRow = r; return true; } return false; });
    var dayCols = [];
    if (wkRow) {
      tokens(wkRow).forEach(function (t, i) { dayCols.push({ day: i + 1, x: t.x0, wk: t.t }); });
      res.giorni = dayCols.map(function (c) { return { d: c.day, wk: c.wk }; });
      var lastX = dayCols.length ? dayCols[dayCols.length - 1].x : 0;
      rows.forEach(function (r) {
        if (r.y >= wkRow.y || r.y < wkRow.y - 110) return;
        if (Math.abs(r.x - (wkRow.x - 57.6)) > 3) return; // righe che partono dalla colonna etichette
        var cw = charW(r), labelChars = Math.round((dayCols[0].x - 3 - r.x) / cw);
        var label = r.text.substring(0, labelChars).trim();
        if (!label) return;
        var entry = { ore: null, gg: null, giorni: {} };
        tokens(r).forEach(function (t) {
          if (t.x0 < dayCols[0].x - 2) return;
          if (t.x0 <= lastX + 3) {
            var best = null, bd = 1e9;
            dayCols.forEach(function (c) { var d = Math.abs(c.x - t.x0); if (d < bd) { bd = d; best = c; } });
            if (best && bd < 3) entry.giorni[best.day] = t.t;
          } else {
            if (entry.ore === null) entry.ore = num(t.t.replace('.', ',')); else entry.gg = num(t.t);
          }
        });
        res.righeCal[label] = entry;
      });
    } else res.avvisi.push('Calendario presenze non trovato');

    // ---- Elementi della retribuzione e totale ----
    var totRowY = null;
    rows.forEach(function (r) {
      var m = /(?:^|\s)(\d{3}) ([A-Z][A-Z'. ]*?)\s+A\s+(-?[\d.]+,\d{2})\s*$/.exec(r.text);
      if (m) res.elementi.push({ code: m[1], desc: m[2].trim(), amount: num(m[3]) });
      var t = /^TOTALE\s+([\d.]+,\d{2})$/.exec(r.text.trim());
      if (t && totRowY === null) { res.totElementi = num(t[1]); totRowY = r.y; }
    });

    // ---- Ferie e ROL ----
    rows.forEach(function (r) {
      var m = /^(FERIE|ROL|EX FEST\.?|PERMESSI)\s+(-?[\d.,]+)\s+(-?[\d.,]+)\s+(-?[\d.,]+)\s+(-?[\d.,]+)\s*$/.exec(r.text.trim());
      if (m) {
        var o = { residuoAP: num(m[2]), maturate: num(m[3]), godute: num(m[4]), residuo: num(m[5]) };
        if (m[1] === 'FERIE') res.ferie = o; else if (m[1] === 'ROL') res.rol = o;
      }
    });

    // ---- Voci ----
    var lastVoceY = null;
    rows.forEach(function (r) {
      if (totRowY !== null && r.y >= totRowY) return;
      if (/\sA\s+-?[\d.]+,\d{2}\s*$/.test(r.text)) return;
      var m = /^(\d{3,4}) (\S.*?)(\s{2,}|$)/.exec(r.text);
      if (!m) return;
      var v = { code: m[1], desc: m[2].trim(), aliquota: null, unita: null, valUnit: null, comp: null, tratt: null };
      var any = false;
      tokens(r).forEach(function (t) {
        if (!/^-?[\d.]+,\d+-?$/.test(t.t)) return;
        var c = nearestCol(t.x1);
        if (c) { v[c] = num(t.t); any = true; }
      });
      if (!any) return;
      // descrizione: tutto quello che c'è prima del primo numero
      var descM = /^(\d{3,4}) (.*?)(\s{2,}-?[\d.]+,\d+|$)/.exec(r.text);
      if (descM) v.desc = descM[2].trim();
      res.voci.push(v);
      lastVoceY = r.y;
    });
    if (!res.voci.length) throw new Error('Non trovo le voci della busta');

    // ---- Riepilogo finale (IRPEF, addizionali, totali, netto) ----
    var sumComp = 0, sumTratt = 0;
    res.voci.forEach(function (v) { if (v.comp) sumComp += v.comp; if (v.tratt) sumTratt += v.tratt; });
    var foot = rows.filter(function (r) { return r.y < lastVoceY; });
    var lastNums = foot.map(function (r) {
      var tt = tokens(r).filter(function (t) { return /^-?[\d.]+,\d+$/.test(t.t); });
      var byCol = {};
      tt.forEach(function (t) { var c = nearestCol(t.x1); if (c === 'comp' || c === 'tratt') byCol[c] = num(t.t); });
      return { r: r, byCol: byCol, tt: tt };
    });
    // totali: riga con totale competenze == somma competenze
    var totIdx = -1;
    lastNums.forEach(function (o, i) {
      if (totIdx < 0 && o.byCol.comp !== undefined && Math.abs(o.byCol.comp - sumComp) < 0.05 && o.byCol.tratt !== undefined) totIdx = i;
    });
    if (totIdx >= 0) {
      res.totComp = lastNums[totIdx].byCol.comp;
      res.totTratt = lastNums[totIdx].byCol.tratt;
      var pre = lastNums.slice(0, totIdx).filter(function (o) { return o.byCol.tratt !== undefined; });
      if (pre.length >= 1) res.irpef = pre[0].byCol.tratt;
      if (pre.length >= 2) res.addizionali = pre[1].byCol.tratt;
      for (var i = totIdx + 1; i < lastNums.length; i++) {
        var o = lastNums[i];
        if (o.byCol.tratt !== undefined) {
          res.netto = o.byCol.tratt;
          if (o.byCol.comp !== undefined) res.arrotondamenti -= o.byCol.comp; // arrotondamento mese precedente
          var next = lastNums[i + 1];
          if (next && next.tt.length) {
            var arr = next.tt.filter(function (t) { return t.x1 > 470 && t.x1 < 520; });
            if (arr.length) res.arrotondamenti += num(arr[arr.length - 1].t);
          }
          break;
        }
      }
    } else res.avvisi.push('Totali non trovati');

    // ---- Dati derivati ----
    var v300 = res.voci.find(function (v) { return v.code === '300'; });
    res.pagaOraria = v300 && v300.valUnit ? v300.valUnit : (res.totElementi ? round2(res.totElementi / 173) : null);
    res.retribuzioneMensile = res.totElementi || (v300 ? v300.comp : null);
    res.ore = oreDaBusta(res);
    res.incentivi = {};
    ['368', '369', '390'].forEach(function (c) { var v = res.voci.find(function (x) { return x.code === c; }); if (v) res.incentivi[c] = v.valUnit; });
    res.controlli = controlli(res, sumComp, sumTratt);
    return res;
  }

  function oreDaBusta(b) {
    var o = { pom: 0, notte: 0, lavorate: null, ferie: 0, cig: 0, straord: 0, straordN: 0, corsi: 0, assenze: 0, festivita: 0, congedo: 0, malattia: 0 };
    b.voci.forEach(function (v) {
      var d = v.desc.toUpperCase(), u = v.unita || 0;
      if (v.code === '349' || /NOTTURN/.test(d) && !/STRAORD/.test(d)) {
        if (Math.abs((v.aliquota || 0) - 27.5) < 0.01) o.pom += u; else o.notte += u;
      } else if (v.code === '900' || /ORE LAVORATE/.test(d)) o.lavorate = (o.lavorate || 0) + u;
      else if (v.code === '902' || /^FERIE/.test(d)) o.ferie += u;
      else if (v.code === '983' || /CIG|INTEGRAZ.*SAL|SOLIDARIET/.test(d)) o.cig += u;
      else if (v.code === '353' || /STRAORD/.test(d)) { o.straord += u; if (/ N\b|NOTT/.test(d)) o.straordN += u; }
      else if (v.code === '345' || /CORSI|SCUOLA/.test(d)) o.corsi += u;
      else if (v.code === '320' || /^ASSENZE/.test(d)) o.assenze += u;
      else if (v.code === '329' || /FESTIVIT/.test(d)) o.festivita += u;
      else if (v.code === '6831') o.congedo += u;
      else if (/MALATT/.test(d) && v.comp) o.malattia += u;
    });
    return o;
  }

  function controlli(b, sumComp, sumTratt) {
    var out = [];
    // 1. ogni voce: ore x valore = importo
    var errVoci = [];
    b.voci.forEach(function (v) {
      var imp = v.comp !== null ? v.comp : v.tratt;
      if (imp === null || imp === 0 || v.unita === null || v.valUnit === null) return;
      if (v.aliquota !== null && v.aliquota > 0 && v.code !== '349' && v.code !== '353' && v.code !== '983') {
        var calcA = round2(v.valUnit * v.aliquota / 100);
        if (Math.abs(calcA - imp) > 0.02) errVoci.push(v);
        return;
      }
      if (v.code === '814' || v.code === '813') { if (Math.abs(round2(v.valUnit * (v.aliquota || 0) / 100) - imp) > 0.02) errVoci.push(v); return; }
      var calc = round2(v.unita * v.valUnit);
      if (Math.abs(calc - imp) > 0.02) errVoci.push(v);
    });
    out.push({ ok: errVoci.length === 0, testo: errVoci.length ? 'Calcoli da verificare: ' + errVoci.map(function (v) { return v.code + ' ' + v.desc; }).join(', ') : 'Ogni voce è calcolata correttamente (ore × importo)' });
    if (b.totComp !== null) out.push({ ok: Math.abs(b.totComp - sumComp) < 0.02, testo: 'Totale competenze ' + eur(b.totComp) });
    if (b.totTratt !== null) {
      var t = sumTratt + (b.irpef || 0) + (b.addizionali || 0);
      out.push({ ok: Math.abs(b.totTratt - t) < 0.05, testo: 'Totale trattenute ' + eur(b.totTratt) });
    }
    if (b.netto !== null && b.totComp !== null) {
      var n = b.totComp - b.totTratt + (b.arrotondamenti || 0);
      out.push({ ok: Math.abs(n - b.netto) < 1.01, testo: 'Netto ' + eur(b.netto) + ' = competenze − trattenute' });
    }
    if (b.totElementi && b.voci.find(function (v) { return v.code === '300'; })) {
      var v300 = b.voci.find(function (v) { return v.code === '300'; });
      out.push({ ok: Math.abs(v300.comp - b.totElementi) < 0.02, testo: 'Paga del mese uguale alla somma degli elementi fissi' });
    }
    return out;
  }

  function fmt(v, dec) {
    var neg = v < 0, f = Math.abs(v).toFixed(dec), parts = f.split('.');
    var int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + int + (dec ? ',' + parts[1] : '');
  }
  function eur(v) {
    if (v === null || v === undefined || isNaN(v)) return '–';
    return fmt(v, 2) + ' €';
  }
  function n2(v, dec) { return fmt(v || 0, dec === undefined ? 2 : dec); }
  function ore(v) { var r = Math.round((v || 0) * 100) / 100; return fmt(r, r % 1 ? 2 : 0).replace(/,(\d)0$/, ',$1'); }

  // Spiegazione in parole semplici di ogni voce
  function spiega(v, b) {
    var d = v.desc.toUpperCase(), po = b.pagaOraria;
    var T = { titolo: titoloBello(v.desc), testo: '', tipo: v.comp !== null ? 'comp' : v.tratt !== null ? 'tratt' : 'info', importo: v.comp !== null ? v.comp : v.tratt !== null ? v.tratt : v.valUnit };
    switch (v.code) {
      case '300': T.titolo = 'Paga del mese'; T.testo = 'La tua paga fissa: ' + ore(v.unita) + ' ore × ' + n2(v.valUnit, 4) + ' € (la tua paga oraria). È sempre uguale, anche nei mesi con ferie.'; break;
      case '320': T.titolo = 'Ore di assenza'; T.testo = ore(v.unita) + ' ore non lavorate (ad esempio cassa integrazione, permessi o corsi) che vengono tolte dalla paga del mese. Poi, se previste, vengono pagate a parte con le voci apposite.'; break;
      case '329': T.titolo = 'Festività di domenica'; T.testo = 'Una festa caduta di domenica: ti viene pagata una giornata in più (' + ore(v.unita) + ' ore).'; break;
      case '345': T.titolo = 'Corsi di formazione'; T.testo = ore(v.unita) + ' ore di corso, pagate come ore normali.'; break;
      case '349':
        if (Math.abs((v.aliquota || 0) - 27.5) < 0.01) { T.titolo = 'Maggiorazione pomeriggio (18-22)'; T.testo = ore(v.unita) + ' ore serali del turno di pomeriggio, pagate il 27,5% in più (' + n2(v.valUnit, 4) + ' € in più all\'ora).'; }
        else { T.titolo = 'Maggiorazione notte (22-6)'; T.testo = ore(v.unita) + ' ore del turno di notte, pagate il ' + n2(v.aliquota, 1) + '% in più (' + n2(v.valUnit, 4) + ' € in più all\'ora).'; }
        break;
      case '353': T.titolo = 'Straordinario' + (/ N\b/.test(d) ? ' notturno' : ''); T.testo = ore(v.unita) + ' ore di straordinario pagate al ' + n2(v.aliquota, 1) + '% della paga oraria (' + n2(v.valUnit, 4) + ' € all\'ora).'; break;
      case '368': case '369': case '390': T.testo = n2(v.valUnit, 4) + ' € per ogni ora lavorata (' + ore(v.unita) + ' ore). Nelle ore di ferie, assenza o cassa integrazione non matura.'; break;
      case '552': T.titolo = 'TFR versato a Cometa'; T.testo = 'Il TFR di questo mese (' + eur(v.valUnit) + ') va al fondo pensione Cometa. Non lo prendi in busta: lo trovi nel fondo.'; T.tipo = 'info'; T.importo = v.valUnit; break;
      case '722': T.titolo = 'TFR del mese'; T.testo = 'Il TFR maturato questo mese (' + eur(v.valUnit) + ') viene accantonato al Fondo Tesoreria INPS. Non lo prendi in busta: lo ricevi quando finisce il rapporto di lavoro.'; T.tipo = 'info'; T.importo = v.valUnit; break;
      case '644': T.titolo = 'Congedo parentale (pagato dall\'INPS)'; T.testo = 'L\'indennità per i giorni di congedo parentale: l\'azienda te la anticipa e poi la recupera dall\'INPS.'; break;
      case '6831': T.titolo = 'Ore di congedo parentale'; T.testo = ore(v.unita) + ' ore di congedo parentale nel mese.'; T.tipo = 'info'; T.importo = null; break;
      case '813': case '814': T.titolo = 'Quota sindacale'; T.testo = 'Il contributo al sindacato: l\'' + n2(v.aliquota, 0) + '% della retribuzione.'; break;
      case '900': T.titolo = 'Ore lavorate'; T.testo = ore(v.unita) + ' ore lavorate davvero nel mese (serve per calcolare gli incentivi).'; T.tipo = 'info'; T.importo = null; break;
      case '902': T.titolo = 'Ore di ferie'; T.testo = ore(v.unita) + ' ore di ferie godute nel mese. Sono pagate con la paga normale, ma senza incentivi e maggiorazioni.'; T.tipo = 'info'; T.importo = null; break;
      case '983': T.titolo = 'Cassa integrazione (solidarietà)'; T.testo = ore(v.unita) + ' ore di cassa integrazione a ' + n2(v.valUnit, 4) + ' € l\'ora. Te la anticipa l\'azienda, poi la paga l\'INPS. L\'importo orario ha un tetto massimo fissato ogni anno.'; break;
      case '1001': T.titolo = 'Contributi INPS'; T.testo = 'Il ' + n2(v.aliquota, 2) + '% del lordo (' + eur(v.valUnit) + ') per la tua pensione futura.'; break;
      case '1110': T.titolo = 'Esonero contributivo'; T.testo = 'Uno sconto sui contributi previsto dalla legge (L. 213/2023) per alcune categorie di lavoratori: ti viene restituita una parte dei contributi.'; break;
      case '1285': T.titolo = 'Cometa: quota dell\'azienda'; T.testo = 'L\'azienda versa per te il ' + n2(v.aliquota, 1) + '% al fondo pensione Cometa (' + eur(v.valUnit) + '). Non ti viene tolto niente.'; T.tipo = 'info'; T.importo = v.valUnit; break;
      case '1286': T.titolo = 'Cometa: la tua quota'; T.testo = 'Il tuo contributo al fondo pensione Cometa: il ' + n2(v.aliquota, 1) + '% della retribuzione. Abbassa un po\' le tasse.'; break;
      case '1401': T.titolo = 'INAIL'; T.testo = 'Assicurazione contro gli infortuni sul lavoro: la paga l\'azienda, a te non viene tolto niente.'; T.tipo = 'info'; T.importo = null; break;
      case '1445': T.titolo = 'Metasalute (fondo sanitario)'; T.testo = 'Fondo sanitario integrativo: ' + eur(v.valUnit) + ' al mese pagati dall\'azienda, a te non viene tolto niente.'; T.tipo = 'info'; T.importo = v.valUnit; break;
      case '2065': T.titolo = 'Ulteriore detrazione (L. 207/2024)'; T.testo = 'Uno sconto sulle tasse previsto dalla legge di bilancio 2025 (' + eur(v.valUnit) + '): è già compreso nel calcolo dell\'IRPEF.'; T.tipo = 'info'; T.importo = v.valUnit; break;
      case '2086': T.titolo = 'Tassa agevolata sui premi'; T.testo = 'Su una parte degli incentivi (' + eur(v.valUnit) + ') paghi solo l\'' + n2(v.aliquota, 0) + '% di tasse invece dell\'IRPEF normale. È un vantaggio per te.'; break;
      default:
        if (/104/.test(d)) { T.titolo = 'Permessi Legge 104'; T.testo = (v.unita ? ore(v.unita) + ' ore di permesso Legge 104. ' : '') + 'Sono permessi pagati: l\'azienda te li anticipa e poi li recupera dall\'INPS.'; break; }
        if (/CHIUS|FERIE COLL/.test(d)) { T.titolo = 'Chiusura aziendale'; T.testo = (v.unita ? ore(v.unita) + ' ore di chiusura aziendale. ' : '') + 'Di solito vengono coperte con le ferie collettive.'; break; }
        if (/PERM/.test(d)) { T.titolo = titoloBello(v.desc); T.testo = (v.unita ? ore(v.unita) + ' ore di permesso. ' : '') + (v.tratt ? 'Sono permessi non pagati: vengono tolti dalla paga.' : 'Ore di permesso del mese.'); break; }
        T.testo = v.comp !== null ? 'Una somma che ti viene pagata.' : v.tratt !== null ? 'Una somma che ti viene trattenuta.' : 'Voce informativa.';
        T.testo += ' L\'app non conosce ancora questa voce: se vuoi, segnalala con "Segnala un problema".';
        T.sconosciuta = true;
    }
    return T;
  }

  function titoloBello(s) {
    s = s.toLowerCase().replace(/\s+/g, ' ').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  async function leggiPdf(bytes) {
    var rows = await root.PGPdf.extractRows(bytes);
    return analyze(rows);
  }

  root.PGBusta = { leggiPdf: leggiPdf, analyze: analyze, spiega: spiega, eur: eur, fmt: fmt, ore: ore };
})(typeof window !== 'undefined' ? window : globalThis);
