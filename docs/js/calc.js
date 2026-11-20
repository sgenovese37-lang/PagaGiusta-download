/* PagaGiusta - calendario turni e calcoli (regole dell'azienda). Tutto in locale. */
(function (root) {
  'use strict';

  var REGOLE = {
    pomOre: 4, pomPct: 27.5,          // turno 14-22: ore 18-22 al 27,5%
    notteOre: 8, nottePct: 60.5,      // turno 22-6: 8 ore al 60,5%
    straordNPct: 160.5,               // straordinario notturno (paga oraria x 160,5%)
    straordDPct: 125,                 // straordinario diurno: DA VERIFICARE con una busta
    cigOraria: { 2026: 7.6168 },      // cassa integrazione: tetto INPS netto / 176 ore
    festDomOre: 6.66,                 // festività caduta di domenica
    incentivi: { '368': 0.82, '369': 0.0717, '390': 0.1813 },
    buono: 9,
    buonoMinOre: 6,
    malattiaBreveGiorni: 5, malattiaCarenzaDa: 3, malattiaCarenzaPct: 50,
    ferieMese: 16.667, rolMese: 8.667
  };

  var TURNI = {
    M: { nome: 'Mattina', orario: '6 – 14', esteso: '6:00 – 14:00', breve: 'M' },
    P: { nome: 'Pomeriggio', orario: '14 – 22', esteso: '14:00 – 22:00', breve: 'P' },
    N: { nome: 'Notte', orario: '22 – 6', esteso: '22:00 – 6:00', breve: 'N' },
    C: { nome: 'Centrale', orario: '7:30 – 16', esteso: '7:30 – 16:00', breve: 'C' }
  };
  var CENTRALI = { '0730': { orario: '7:30 – 16', esteso: '7:30 – 16:00' }, '0900': { orario: '9 – 17:30', esteso: '9:00 – 17:30' } };
  function infoC(state) { return CENTRALI[(state && state.centrale) || '0730'] || CENTRALI['0730']; }

  var TIPI = {
    lavoro: 'Lavoro', ferie: 'Ferie', rol: 'ROL', cig: 'Cassa integrazione', malattia: 'Malattia',
    congedo: 'Congedo parentale', legge104: 'Permesso Legge 104', sciopero: 'Sciopero', corso: 'Corso', permesso: 'Permesso privato',
    chiusura: 'Chiusura aziendale', festa: 'Festa'
  };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function key(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +(p[2] || 1)); }
  function monday(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); var wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x; }
  function weeksBetween(a, b) { return Math.round((monday(b) - monday(a)) / (7 * 864e5)); }

  function pasqua(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month - 1, day);
  }
  var festeCache = {};
  function feste(y) {
    if (festeCache[y]) return festeCache[y];
    var f = {};
    ['01-01', '01-06', '04-25', '05-01', '06-02', '08-15', '11-01', '12-08', '12-25', '12-26'].forEach(function (md) { f[y + '-' + md] = true; });
    if (y >= 2026) f[y + '-10-04'] = true; // San Francesco, festa nazionale dal 2026
    var p = pasqua(y); p.setDate(p.getDate() + 1); f[key(p)] = true; // Lunedì dell'Angelo
    festeCache[y] = f; return f;
  }
  function isFesta(d) { return !!feste(d.getFullYear())[key(d)]; }

  // Turno di una data: override settimanale, altrimenti rotazione dall'ancora
  function turno(state, d) {
    var wk = key(monday(d));
    if (state.settimane && state.settimane[wk]) return state.settimane[wk];
    if (state.tipoOrario === 'centrale') return 'C';
    var a = state.ancora; if (!a) return null;
    var ord = state.ordine || ['N', 'P', 'M'];
    var i0 = ord.indexOf(a.turno), w = weeksBetween(parse(a.settimana), d);
    return ord[((i0 + w) % ord.length + ord.length) % ord.length];
  }

  // Descrizione completa di un giorno
  function giorno(state, d) {
    var k = key(d), wd = d.getDay(), festa = isFesta(d);
    var gl = state.giorniLav || [1, 2, 3, 4, 5], oreG = state.oreGiorno || 8;
    var weekend = gl.indexOf(wd) < 0; // giorno non lavorativo (sabato, domenica o giorno libero del part-time)
    var ov = (state.giorni && state.giorni[k]) || {};
    var t = turno(state, d);
    var tipo = ov.tipo || (weekend ? 'libero' : festa ? 'festa' : 'lavoro');
    var ore = ov.ore !== undefined ? Math.min(ov.ore, oreG) : oreG;
    // contratto di solidarietà: ogni giorno di lavoro ha alcune ore di cassa integrazione
    if (!ov.tipo && tipo === 'lavoro' && state.solidOre > 0) { tipo = 'cig'; ore = Math.min(state.solidOre, oreG); }
    var g = { key: k, data: d, turno: t, tipo: tipo, festa: festa, weekend: weekend, straord: ov.straord || 0, ore: ore, nota: ov.nota || '' };
    // ore lavorate e assenze
    g.lavorate = 0; g.ferie = 0; g.rol = 0; g.cig = 0; g.corso = 0; g.assenza = 0; g.congedo = 0; g.malattia = 0; g.l104 = 0; g.sciopero = 0;
    if (tipo === 'lavoro') g.lavorate = oreG;
    else if (tipo === 'ferie') { g.ferie = ore; g.lavorate = oreG - g.ferie; }
    else if (tipo === 'rol') { g.rol = ore; g.lavorate = oreG - g.rol; }
    else if (tipo === 'cig') { g.cig = ore; g.lavorate = oreG - g.cig; }
    else if (tipo === 'corso') { g.corso = ore; g.lavorate = oreG - g.corso; }
    else if (tipo === 'permesso') { g.assenza = ore; g.lavorate = oreG - g.assenza; }
    else if (tipo === 'congedo') { g.congedo = ore; g.lavorate = oreG - g.congedo; }
    else if (tipo === 'malattia') { g.malattia = oreG; }
    else if (tipo === 'legge104') { g.l104 = ore; g.lavorate = oreG - g.l104; }
    else if (tipo === 'chiusura') { g.rol = oreG; g.chiusura = true; }
    else if (tipo === 'sciopero') { g.sciopero = ore; g.lavorate = oreG - g.sciopero; }
    if (tipo === 'libero') g.lavorate = 0;
    g.oreGiorno = oreG;
    // maggiorazioni
    g.pom = 0; g.notte = 0;
    if (g.lavorate > 0 && t === 'P') g.pom = Math.max(0, Math.min(REGOLE.pomOre, g.lavorate - 4));
    if (g.lavorate > 0 && t === 'N') g.notte = g.lavorate;
    // buono pasto: almeno 6 ore tra lavoro, corso e straordinario; in cassa integrazione spetta sempre
    g.buono = (g.cig > 0 || g.lavorate + g.corso + g.straord >= REGOLE.buonoMinOre) ? 1 : 0;
    return g;
  }

  function giorniMese(y, m) { var out = [], d = new Date(y, m - 1, 1); while (d.getMonth() === m - 1) { out.push(new Date(d)); d.setDate(d.getDate() + 1); } return out; }

  function ultimaBusta(state) {
    var ks = Object.keys(state.buste || {}).sort();
    return ks.length ? state.buste[ks[ks.length - 1]] : null;
  }

  function parametri(state) {
    var b = ultimaBusta(state), p = {};
    p.pagaOraria = (b && b.pagaOraria) || state.pagaOraria || null;
    var v300 = b && b.voci.find(function (v) { return v.code === '300' && v.comp; });
    p.retribuzione = (v300 && v300.comp) || (b && b.retribuzioneMensile) || (p.pagaOraria ? p.pagaOraria * 173 * ((state.oreGiorno || 8) / 8) : null);
    p.incentivi = Object.assign({}, REGOLE.incentivi, (b && b.incentivi) || {});
    p.buono = state.buono || REGOLE.buono;
    p.rapportoNetto = b && b.netto && b.totComp ? b.netto / b.totComp : 0.75;
    p.congedoPct = 0.3;
    p.sindacatoPct = 0; p.cometaPct = 0; p.esoneroPct = 0;
    if (b) {
      var vs = b.voci.find(function (v) { return (v.code === '813' || v.code === '814' || /SIND/.test(v.desc)) && v.tratt; });
      if (vs && vs.aliquota) p.sindacatoPct = vs.aliquota;
      var ve = b.voci.find(function (v) { return v.code === '1110' && v.comp; });
      if (ve && ve.aliquota) p.esoneroPct = ve.aliquota;
      var vc = b.voci.find(function (v) { return v.code === '1286' && v.tratt; });
      if (vc && vc.aliquota) p.cometaPct = vc.aliquota;
    }
    if (b) {
      var v644 = b.voci.find(function (v) { return v.code === '644'; }), h = b.ore && b.ore.congedo;
      if (v644 && h && p.pagaOraria) p.congedoPct = v644.comp / h / p.pagaOraria;
    }
    return p;
  }

  // Malattie dell'anno: giorni di malattia consecutivi (sabati, domeniche e feste non interrompono)
  function episodiMalattia(state, y) {
    var keys = Object.keys(state.giorni || {}).filter(function (k) { return k.slice(0, 4) == y && state.giorni[k].tipo === 'malattia'; }).sort();
    var out = [], cur = null, last = null;
    keys.forEach(function (k) {
      var d = parse(k), unito = false;
      if (cur && last) {
        unito = true; var x = new Date(last); x.setDate(x.getDate() + 1);
        while (x < d) { var gx = giorno(state, x); if (!(gx.weekend || gx.festa || gx.tipo === 'libero')) { unito = false; break; } x.setDate(x.getDate() + 1); }
      }
      if (!unito) { cur = { giorni: [] }; out.push(cur); }
      cur.giorni.push(k); last = d;
    });
    var nBrevi = 0;
    out.forEach(function (ep) {
      ep.breve = ep.giorni.length <= REGOLE.malattiaBreveGiorni;
      if (ep.breve) { nBrevi++; ep.n = nBrevi; }
      ep.ridotta = ep.breve && nBrevi >= REGOLE.malattiaCarenzaDa;
      ep.carenza = ep.giorni.slice(0, 3).map(function (k) { return { key: k, ore: giorno(state, parse(k)).malattia }; });
    });
    return out;
  }
  function malattiaInfo(state, k) {
    var eps = episodiMalattia(state, +k.slice(0, 4));
    for (var i = 0; i < eps.length; i++) if (eps[i].giorni.indexOf(k) >= 0) { var e = eps[i]; return { n: e.n, breve: e.breve, ridotta: e.ridotta && e.giorni.indexOf(k) < 3, giorni: e.giorni.length }; }
    return null;
  }

  // Stima del mese dal calendario
  function stimaMese(state, y, m) {
    var p = parametri(state), po = p.pagaOraria || 0;
    var s = { y: y, m: m, giorni: [], ore: { lavorate: 0, pom: 0, notte: 0, ferie: 0, rol: 0, cig: 0, corsi: 0, straord: 0, straordN: 0, festivita: 0, assenze: 0, congedo: 0, malattia: 0, l104: 0, chiusura: 0, sciopero: 0 }, buoni: 0 };
    giorniMese(y, m).forEach(function (d) {
      var g = giorno(state, d); s.giorni.push(g);
      var o = s.ore;
      o.lavorate += g.lavorate; o.pom += g.pom; o.notte += g.notte; o.ferie += g.ferie; o.rol += g.rol; o.cig += g.cig;
      o.corsi += g.corso; o.assenze += g.assenza; o.congedo += g.congedo; o.malattia += g.malattia; o.l104 += g.l104;
      if (g.chiusura) o.chiusura += g.oreGiorno;
      o.sciopero += g.sciopero;
      if (g.straord) { o.straord += g.straord; if (g.turno === 'N') o.straordN += g.straord; }
      if (g.festa && d.getDay() === 0) o.festivita += REGOLE.festDomOre * ((state.oreGiorno || 8) / 8);
      s.buoni += g.buono;
    });
    var o = s.ore, cigOra = REGOLE.cigOraria[y] || REGOLE.cigOraria[2026];
    var r = [];
    r.push({ voce: 'Paga base', importo: p.retribuzione || 0 });
    if (o.festivita) r.push({ voce: 'Festività di domenica', importo: o.festivita * po });
    if (o.notte) r.push({ voce: 'Notti · ' + fmtOre(o.notte) + ' h al 60,5%', importo: o.notte * po * REGOLE.nottePct / 100 });
    if (o.pom) r.push({ voce: 'Pomeriggi · ' + fmtOre(o.pom) + ' h al 27,5%', importo: o.pom * po * REGOLE.pomPct / 100 });
    var sd = o.straord - o.straordN;
    if (o.straordN) r.push({ voce: 'Straordinario notte · ' + fmtOre(o.straordN) + ' h', importo: o.straordN * po * REGOLE.straordNPct / 100 });
    if (sd) r.push({ voce: 'Straordinario · ' + fmtOre(sd) + ' h (stima)', importo: sd * po * REGOLE.straordDPct / 100, stima: true });
    var inc = o.lavorate * (p.incentivi['368'] + p.incentivi['369']) + (o.lavorate + o.straord) * p.incentivi['390'];
    r.push({ voce: 'Incentivi · ' + fmtOre(o.lavorate) + ' h lavorate', importo: inc });
    if (o.cig) r.push({ voce: 'Cassa integrazione · ' + fmtOre(o.cig) + ' h', importo: o.cig * cigOra - o.cig * po, nota: o.cig + ' h × ' + cigOra.toString().replace('.', ',') + ' € al posto della paga' });
    if (o.congedo) r.push({ voce: 'Congedo parentale · ' + fmtOre(o.congedo) + ' h (stima)', importo: o.congedo * po * (p.congedoPct - 1), stima: true });
    if (o.assenze) r.push({ voce: 'Permessi privati · ' + fmtOre(o.assenze) + ' h (non pagati)', importo: -o.assenze * po, stima: true });
    if (o.sciopero) r.push({ voce: 'Sciopero · ' + fmtOre(o.sciopero) + ' h (non pagate)', importo: -o.sciopero * po });
    if (o.l104) r.push({ voce: 'Permessi Legge 104 · ' + fmtOre(o.l104) + ' h', importo: 0, nota: 'Pagati come ore normali (l\'azienda li anticipa per l\'INPS), ma senza incentivi' });
    if (o.chiusura) r.push({ voce: 'Chiusura aziendale · ' + fmtOre(o.chiusura) + ' h', importo: 0, nota: 'Pagata come un giorno di ferie, ma le ore vengono scalate dai tuoi ROL' });
    if (o.malattia) {
      r.push({ voce: 'Malattia · ' + fmtOre(o.malattia) + ' h', importo: 0, nota: 'Pagata normalmente: in parte dall\'INPS e il resto lo integra l\'azienda' });
      var mk = y + '-' + (m < 10 ? '0' : '') + m, ridotte = 0, nEp = 0;
      episodiMalattia(state, y).forEach(function (ep) {
        if (!ep.ridotta) return;
        ep.carenza.forEach(function (c) { if (c.key.slice(0, 7) === mk) { ridotte += c.ore; nEp = ep.n; } });
      });
      if (ridotte) r.push({ voce: 'Malattia breve n. ' + nEp + ' dell\'anno · ' + fmtOre(ridotte) + ' h al ' + REGOLE.malattiaCarenzaPct + '%', importo: -ridotte * po * (100 - REGOLE.malattiaCarenzaPct) / 100, stima: true, nota: 'Dalla ' + REGOLE.malattiaCarenzaDa + 'ª malattia breve dell\'anno i primi 3 giorni sono pagati al ' + REGOLE.malattiaCarenzaPct + '%' });
    }
    if (p.esoneroPct) {
      var impEs = r.reduce(function (a, x) { return a + x.importo; }, 0) - o.cig * cigOra;
      r.push({ voce: 'Esonero contributivo (stima)', importo: impEs * p.esoneroPct / 100, stima: true, nota: 'Sconto sui contributi presente nella tua ultima busta' });
    }
    s.righe = r;
    s.lordo = r.reduce(function (a, x) { return a + x.importo; }, 0);
    s.netto = s.lordo * p.rapportoNetto;
    // trattenute stimate: INPS, quota sindacale (se c'è nella tua busta), tasse
    var cigEuro = o.cig * cigOra, impPrev = Math.max(0, s.lordo - cigEuro);
    s.trattenute = [];
    var inps = impPrev * 0.0949; s.trattenute.push({ voce: 'Contributi INPS (9,49%)', importo: inps });
    if (p.sindacatoPct) s.trattenute.push({ voce: 'Quota sindacale (' + String(p.sindacatoPct).replace('.', ',') + '%)', importo: (p.retribuzione || 0) * p.sindacatoPct / 100 });
    if (p.cometaPct) s.trattenute.push({ voce: 'Fondo Cometa (' + String(p.cometaPct).replace('.', ',') + '%)', importo: (p.retribuzione || 0) * p.cometaPct / 100 });
    var gia = s.trattenute.reduce(function (a, x) { return a + x.importo; }, 0);
    s.trattenute.push({ voce: 'Tasse IRPEF e addizionali (stima)', importo: Math.max(0, s.lordo - s.netto - gia) });
    s.buoniEuro = s.buoni * p.buono;
    s.pagaMancante = !p.pagaOraria;
    s.malattiaNota = o.malattia > 0;
    return s;
  }

  // Confronto calendario ↔ busta (ore)
  function confronta(stima, busta) {
    var b = busta.ore, o = stima.ore, out = [];
    function riga(nome, cal, bus) { if (!cal && !bus) return; out.push({ nome: nome, cal: cal, busta: bus, ok: Math.abs(cal - bus) < 0.6 }); }
    riga('Ore lavorate', o.lavorate, b.lavorate || 0);
    riga('Ore di notte (60,5%)', o.notte, b.notte);
    riga('Ore di pomeriggio (27,5%)', o.pom, b.pom);
    riga('Ore di ferie', o.ferie, b.ferie);
    riga('Ore di cassa integrazione', o.cig, b.cig);
    riga('Ore di straordinario', o.straord, b.straord);
    riga('Ore di corso', o.corsi, b.corsi);
    riga('Festività di domenica', o.festivita, b.festivita);
    return out;
  }

  // Ricostruisce i giorni del mese dalla busta (per allineare il calendario)
  function giorniDaBusta(state, busta) {
    var y = +busta.mese.slice(0, 4), m = +busta.mese.slice(5, 7), rc = busta.righeCal || {}, out = { giorni: {}, settimane: {} };
    function riga(re) { for (var k in rc) if (re.test(k)) return rc[k].giorni; return {}; }
    var ret = riga(/^RETRIB/), notte = riga(/^MAGG/), ferie = riga(/^FERIE/), cig = riga(/^SOL|^CIG|^INT/), corsi = riga(/^CORSI/), straord = riga(/^STRAORD/), sciop = riga(/^SCIOP/), l104 = riga(/104/);
    var votiSett = {};
    giorniMese(y, m).forEach(function (d) {
      var dd = d.getDate(), k = key(d), wd = d.getDay();
      if (wd === 0 || wd === 6) return;
      var h = function (v) { return v ? parseFloat(v) : 0; };
      var g = {};
      if (h(ferie[dd]) >= 8) g = { tipo: 'ferie', ore: 8 };
      else if (h(sciop[dd]) > 0) g = { tipo: 'sciopero', ore: h(sciop[dd]) };
      else if (h(l104[dd]) > 0) g = { tipo: 'legge104', ore: h(l104[dd]) };
      else if (h(cig[dd]) > 0) g = { tipo: 'cig', ore: h(cig[dd]) };
      else if (h(corsi[dd]) > 0) g = { tipo: 'corso', ore: h(corsi[dd]) };
      else if (h(ferie[dd]) > 0) g = { tipo: 'ferie', ore: h(ferie[dd]) };
      else if (h(ret[dd]) >= 8) g = { tipo: 'lavoro' };
      else if (!isFesta(d)) g = { tipo: 'permesso', ore: 8 - h(ret[dd]) };
      if (h(straord[dd])) g.straord = h(straord[dd]);
      if (Object.keys(g).length && !(g.tipo === 'lavoro' && !g.straord)) out.giorni[k] = g;
      // turno della settimana dalle maggiorazioni
      var wk = key(monday(d)); votiSett[wk] = votiSett[wk] || { M: 0, P: 0, N: 0 };
      var n = h(notte[dd]);
      if (h(ret[dd]) > 0 || g.tipo === 'cig') { if (n >= 6) votiSett[wk].N++; else if (n > 0) votiSett[wk].P++; else if (h(ret[dd]) >= 8) votiSett[wk].M++; }
    });
    for (var wk in votiSett) {
      var v = votiSett[wk], best = null, bv = 0;
      ['N', 'P', 'M'].forEach(function (t) { if (v[t] > bv) { bv = v[t]; best = t; } });
      if (best === 'M' && state.tipoOrario === 'centrale') best = 'C';
      if (best) out.settimane[wk] = best;
    }
    return out;
  }

  function ferieRol(state, oggi) {
    var b = ultimaBusta(state); if (!b || !b.ferie) return null;
    var by = +b.mese.slice(0, 4), bm = +b.mese.slice(5, 7);
    var meseN = bm; // mesi trascorsi nell'anno alla data della busta
    var fMese = b.ferie.maturate && meseN ? b.ferie.maturate / meseN : REGOLE.ferieMese;
    var rMese = b.rol && b.rol.maturate && meseN ? b.rol.maturate / meseN : REGOLE.rolMese;
    var res = { busta: b.mese, ferieBusta: b.ferie.residuo, rolBusta: b.rol ? b.rol.residuo : 0, ferieMese: fMese, rolMese: rMese, mesi: 0, ferieUsate: 0, rolUsati: 0 };
    // mesi completi dopo la busta fino al mese scorso
    var d = new Date(by, bm, 1); var lim = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
    while (d < lim) { res.mesi++; d.setMonth(d.getMonth() + 1); }
    // ferie/rol segnati nel calendario dopo il mese della busta
    var start = new Date(by, bm, 1);
    Object.keys(state.giorni || {}).forEach(function (k) {
      var dt = parse(k); if (dt < start) return;
      var g = giorno(state, dt); res.ferieUsate += g.ferie; res.rolUsati += g.rol;
    });
    res.ferie = res.ferieBusta + res.mesi * fMese - res.ferieUsate;
    res.rol = res.rolBusta + res.mesi * rMese - res.rolUsati;
    return res;
  }

  function tredicesima(state) {
    var p = parametri(state); if (!p.retribuzione) return null;
    var lordo = p.retribuzione;
    var imp = lordo * (1 - 0.0949);
    return { lordo: lordo, nettoMin: imp * (1 - 0.33), nettoMax: imp * (1 - 0.23) };
  }

  // Giorno in cui arriva la busta del mese (y,m): il 10 del mese dopo, o il venerdì prima
  function giornoBusta(y, m) {
    var d = new Date(y, m, 10), wd = d.getDay();
    if (wd === 6) d.setDate(9); else if (wd === 0) d.setDate(8);
    return d;
  }

  function fmtOre(v) { return root.PGBusta ? root.PGBusta.ore(v) : String(Math.round(v * 100) / 100); }

  root.PGCalc = {
    REGOLE: REGOLE, TURNI: TURNI, TIPI: TIPI, CENTRALI: CENTRALI, infoC: infoC, key: key, parse: parse, monday: monday, turno: turno, giorno: giorno,
    giorniMese: giorniMese, stimaMese: stimaMese, confronta: confronta, giorniDaBusta: giorniDaBusta,
    ferieRol: ferieRol, tredicesima: tredicesima, giornoBusta: giornoBusta, isFesta: isFesta, parametri: parametri,
    ultimaBusta: ultimaBusta, fmtOre: fmtOre, episodiMalattia: episodiMalattia, malattiaInfo: malattiaInfo
  };
})(typeof window !== 'undefined' ? window : globalThis);
