/* PagaGiusta - interfaccia. Tutti i dati restano nel telefono (localStorage). */
(function () {
  'use strict';
  var C = window.PGCalc, B = window.PGBusta;
  var VERSIONE = '1.0 Beta' + (window.PG_BUILD ? ' ' + window.PG_BUILD : '');
  var STORE = 'pagagiusta-v1';
  var MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  var GG = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

  var IS_APP = !!window.Android;                          // app Android
  var IS_WEB = /^https?:/.test(location.protocol) && !IS_APP; // web app (iPhone)
  var IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function standalone() { try { return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches; } catch (e) { return false; } }
  if (IS_WEB && 'serviceWorker' in navigator) { try { navigator.serviceWorker.register('sw.js'); } catch (e) { } }
  var state = load();
  if (state.onboarded && !state.inizio) { state.inizio = new Date().toISOString().slice(0, 7); try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { } }
  var ui = { tab: 'turni', calY: null, calM: null, meseY: null, meseM: null, bustaSel: null, onbTurno: null, onbBusta: null };
  var oggi = new Date();
  ui.calY = ui.meseY = oggi.getFullYear(); ui.calM = ui.meseM = oggi.getMonth() + 1;

  // La sezione Mese va dal primo mese con dati (busta più vecchia o mese di inizio) al mese in corso
  function meseIdx(y, m) { return y * 12 + (m - 1); }
  function limitiMese() {
    var max = meseIdx(oggi.getFullYear(), oggi.getMonth() + 1), min = max;
    if (state.inizio) min = Math.min(min, meseIdx(+state.inizio.slice(0, 4), +state.inizio.slice(5, 7)));
    Object.keys(state.buste || {}).forEach(function (k) { min = Math.min(min, meseIdx(+k.slice(0, 4), +k.slice(5, 7))); });
    return { min: min, max: max };
  }

  function load() {
    try { var s = JSON.parse(localStorage.getItem(STORE) || 'null'); if (s && s.v === 1) return s; } catch (e) { }
    return { v: 1, onboarded: false, ordine: ['N', 'P', 'M'], ancora: null, settimane: {}, giorni: {}, buste: {}, buono: 9, tema: 'auto' };
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { toast('Impossibile salvare i dati sul telefono'); } }

  // ---------- utilità ----------
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function eur(v) { return B.eur(v); }
  function ore(v) { return C.fmtOre(v || 0); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function meseNome(y, m) { return cap(MESI[m - 1]) + ' ' + y; }
  function meseKeyLabel(k) { return meseNome(+k.slice(0, 4), +k.slice(5, 7)); }
  function toast(msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }
  function applyTheme() {
    if (state.tema === 'light' || state.tema === 'dark') document.documentElement.setAttribute('data-theme', state.tema);
    else document.documentElement.removeAttribute('data-theme');
  }

  var IC = {
    save: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>',
    cal: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>',
    bar: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    doc: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h8M9 17h8"/></svg>',
    sun: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    left: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    right: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',
    gear: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    check: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    checkS: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    warn: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 17h.01"/></svg>',
    warnS: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 7v6M12 17h.01"/></svg>',
    info: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 11v6M12 7h.01"/></svg>',
    pdf: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M12 11v6M9 14l3 3 3-3"/></svg>',
    lock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>'
  };
  var LOGO = '<svg width="84" height="84" viewBox="0 0 200 200" aria-hidden="true"><rect width="200" height="200" rx="46" fill="#0F766E"/><g fill="none" stroke-width="18" stroke-linecap="round" transform="rotate(-90 100 100)"><circle cx="100" cy="100" r="58" stroke="#FCD34D" stroke-dasharray="104 260.4" transform="rotate(8 100 100)"/><circle cx="100" cy="100" r="58" stroke="#93C5FD" stroke-dasharray="104 260.4" transform="rotate(128 100 100)"/><circle cx="100" cy="100" r="58" stroke="#C7D2FE" stroke-dasharray="104 260.4" transform="rotate(248 100 100)"/></g><path d="M76 102l16 16 32-34" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var PRIVACY_TXT = 'PagaGiusta usa internet <b>solo per scaricare i suoi aggiornamenti</b>. Le tue buste paga e i tuoi dati restano <b>solo sul tuo telefono</b>: non vengono inviati, condivisi o salvati altrove. <b>Nessuno può vederli, nemmeno chi ha creato l\'app.</b> Dalla busta l\'app legge solo numeri e voci: nome, codice fiscale, indirizzo e IBAN vengono ignorati. Puoi cancellare tutto in qualsiasi momento dalle Impostazioni.';

  // ---------- import PDF ----------
  function scegliPdf(cb) {
    var inp = $('#filePdf'); inp.value = '';
    inp.onchange = function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () { importaBytes(new Uint8Array(r.result), cb); };
      r.onerror = function () { erroreBusta(new Error('Il telefono non mi fa aprire il file (' + (f.name || '') + ')'), null); };
      r.readAsArrayBuffer(f);
    };
    inp.click();
  }

  function importaBytes(bytes, cb) {
    B.leggiPdf(bytes).then(function (b) {
      state.buste[b.mese] = b;
      save();
      if (cb) cb(b); else { ui.tab = 'busta'; ui.bustaSel = b.mese; render(); }
      toast('Busta di ' + meseKeyLabel(b.mese).toLowerCase() + ' letta');
      if (state.onboarded && !state.guidaControlloVista && C.ultimaBusta(state) === b) guidaControllo(b.mese);
    }).catch(function (e) {
      erroreBusta(e, bytes);
    });
  }

  function erroreBusta(e, bytes) {
    var msg = e && e.message ? e.message : String(e);
    var info = 'Dimensione file: ' + (bytes ? Math.round(bytes.length / 1024) + ' KB' : '?') + ' · Inizio: ' + (bytes ? String.fromCharCode.apply(null, bytes.subarray(0, 8)).replace(/[^\x20-\x7e]/g, '?') : '?') +
      ' · ' + (typeof DecompressionStream === 'undefined' ? 'senza DS' : 'con DS') + ' · ' + navigator.userAgent.replace(/^Mozilla\/5\.0 /, '').slice(0, 90);
    var el = document.createElement('div'); el.className = 'nv';
    el.innerHTML = '<div class="box" role="dialog"><div class="top"><span>Busta non letta</span></div><h2>Non riesco a leggere questa busta</h2>' +
      '<p>' + esc(msg) + '</p><p class="small" style="font-size:12px;color:var(--tx2)">Se il problema continua, fai uno screenshot di questa schermata e mandalo a chi ti ha dato l\'app.<br>' + esc(info) + '</p>' +
      '<button class="btn" data-x="1">Chiudi</button></div>';
    el.querySelector('[data-x]').onclick = function () { el.remove(); };
    document.body.appendChild(el);
  }

  // chiamata dall'app Android quando condividi un PDF con PagaGiusta
  window.PGApp = {
    importPdfBase64: function (b64) {
      try {
        var bin = atob(b64), bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        importaBytes(bytes, function (b) {
          if (!state.onboarded) { ui.onbBusta = b.mese; render(); return; }
          ui.tab = 'busta'; ui.bustaSel = b.mese; render();
        });
      } catch (e) { toast('File non valido'); }
    },
    aggiornamento: function (info) { ui.update = info; mostraAggiornamento(); },
    progresso: function (p) { statoAgg('dl', p); },
    erroreAggiornamento: function () { statoAgg('err'); },
    permessoInstallazione: function () { statoAgg('perm'); },
    installazione: function () { statoAgg('inst'); },
    back: function () {
      var sc = $('.scrim'); if (sc) { sc.remove(); return true; }
      if (ui.tab === 'busta' && ui.bustaSel) { ui.bustaSel = null; render(); return true; }
      if (ui.tab !== 'turni') { ui.tab = 'turni'; render(); return true; }
      return false;
    }
  };

  // ---------- render ----------
  function render() {
    applyTheme();
    var app = $('#app');
    if (!state.onboarded) { app.innerHTML = renderOnb(); bindOnb(); return; }
    var html = '';
    if (ui.tab === 'turni') html = renderTurni();
    else if (ui.tab === 'mese') html = renderMese();
    else if (ui.tab === 'busta') html = renderBusta();
    else if (ui.tab === 'ferie') html = renderFerie();
    else if (ui.tab === 'impostazioni') html = renderImpostazioni();
    app.innerHTML = html + renderTabs();
    bind();
    window.scrollTo(0, 0);
  }

  function renderTabs() {
    function b(id, ic, lab) { return '<button data-tab="' + id + '" class="' + (ui.tab === id ? 'on' : '') + '">' + ic + lab + '</button>'; }
    return '<nav class="tabs">' + b('turni', IC.cal, 'Turni') + b('mese', IC.bar, 'Mese') + b('busta', IC.doc, 'Busta') + b('ferie', IC.sun, 'Ferie') + '</nav>';
  }

  // ---- Onboarding ----
  function renderOnb() {
    function ch(t) {
      var T = tInfo(t);
      return '<button class="choice t-' + t + (ui.onbTurno === t ? ' on' : '') + '" data-onbt="' + t + '"><span>' + T.nome + '</span><span>' + T.orario + (ui.onbTurno === t ? ' ✓' : '') + '</span></button>';
    }
    function chC(k) {
      var on = ui.onbTurno === 'C' && (state.centrale || '0730') === k;
      return '<button class="choice t-C' + (on ? ' on' : '') + '" data-onbc="' + k + '"><span>Orario centrale</span><span>' + C.CENTRALI[k].esteso + (on ? ' ✓' : '') + '</span></button>';
    }
    var bustaOk = ui.onbBusta ? '<div class="status ok"><div class="ic">' + IC.check + '</div><div><b>Busta letta</b><span>' + meseKeyLabel(ui.onbBusta) + ': paga, incentivi, ferie e ROL presi.</span></div></div>' : '';
    return '<div class="screen onb">' +
      '<div class="brand">' + LOGO + '<div class="wordmark">Paga<span>Giusta</span></div><div class="muted">La tua busta paga, finalmente chiara.</div></div>' +
      '<div class="card"><h3>' + IC.lock.replace('stroke-width', 'stroke="currentColor" stroke-width') + ' La tua privacy</h3><div class="muted">' + PRIVACY_TXT + '</div></div>' +
      '<div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="stepn">1 di 2</div><div class="q">Che turno fai questa settimana?</div>' + ch('M') + ch('P') + ch('N') +
      '<div class="muted small">I turni girano Notte → Pomeriggio → Mattina. Puoi cambiarlo nelle Impostazioni.</div>' +
      '<div class="q" style="font-size:16px;margin-top:6px">Oppure fai l\'orario centrale?</div>' + chC('0730') + chC('0900') +
      '<div class="muted small">Lavori part-time? Lo imposti dopo, nelle Impostazioni.</div></div>' +
      '<div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="stepn">2 di 2</div><div class="q">Importa la tua ultima busta paga</div>' +
      '<div class="muted">Su EGO scarica il PDF della tua <b>ultima busta paga</b> e caricalo qui. L\'app parte da quella busta: ricava paga oraria, incentivi, ferie e ROL.</div>' + bustaOk +
      '<button class="btn dashed" id="onbPdf">' + IC.pdf + (ui.onbBusta ? 'Importa un\'altra busta' : 'Scegli il PDF della busta') + '</button></div>' +
      '<button class="btn" id="onbGo">Inizia</button>' +
      '<div style="text-align:center"><button class="linkbtn" id="onbSkip">Salta, lo faccio dopo</button></div>' +
      '<div class="muted small" style="text-align:center">Versione ' + VERSIONE + '</div></div>';
  }
  function bindOnb() {
    document.querySelectorAll('[data-onbt]').forEach(function (b) { b.onclick = function () { ui.onbTurno = b.getAttribute('data-onbt'); state.tipoOrario = 'turni'; render(); }; });
    document.querySelectorAll('[data-onbc]').forEach(function (b) { b.onclick = function () { ui.onbTurno = 'C'; state.tipoOrario = 'centrale'; state.centrale = b.getAttribute('data-onbc'); render(); }; });
    $('#onbPdf').onclick = function () { scegliPdf(function (b) { ui.onbBusta = b.mese; render(); }); };
    function finish() {
      if (ui.onbTurno && ui.onbTurno !== 'C') state.ancora = { settimana: C.key(C.monday(new Date())), turno: ui.onbTurno };
      else if (!state.ancora) state.ancora = { settimana: C.key(C.monday(new Date())), turno: 'M' };
      if (ui.onbBusta) allinea(state.buste[ui.onbBusta]);
      state.inizio = C.key(oggi).slice(0, 7);
      state.novitaViste = NOVITA_ID;
      state.onboarded = true; save(); ui.tab = 'turni'; render();
      if (!ui.onbTurno) toast('Imposta il turno di questa settimana dalle Impostazioni');
      if (ui.onbBusta) guidaControllo(ui.onbBusta);
    }
    $('#onbGo').onclick = function () { if (!ui.onbTurno) { toast('Scegli il turno di questa settimana'); return; } finish(); };
    $('#onbSkip').onclick = finish;
  }

  // Dopo la prima busta: spiega quali giorni controllare per il prossimo controllo
  function guidaControllo(mk) {
    var y = +mk.slice(0, 4), m = +mk.slice(5, 7), ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
    var nomeB = MESI[m - 1], nomeN = MESI[nm - 1];
    var inCorso = new Date(ny, nm - 1, 1) <= oggi;
    var el = document.createElement('div'); el.className = 'nv';
    el.innerHTML = '<div class="box" role="dialog" aria-label="Ultimo passo"><div class="top"><span>Ultimo passo</span></div>' +
      '<div class="ill"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4M9 15l2 2 4-4"/></svg></div>' +
      '<h2>Controlla i giorni di ' + nomeN + '</h2>' +
      '<p>La busta di <b>' + nomeB + '</b> è caricata: ' + nomeB + ' è già controllato e chiuso. La prossima busta sarà quella di <b>' + nomeN + '</b>.</p>' +
      '<p>' + (inCorso ? 'Nel calendario controlla tutti i giorni dal <b>1° ' + nomeN + ' a oggi</b>, anche quelli prima che arrivasse la busta, e segna ' : 'Durante ' + nomeN + ' segna nel calendario ') +
      'ferie, ROL, cassa integrazione, malattia, cambi turno e straordinari. Così il controllo con la prossima busta sarà giusto.</p>' +
      (inCorso ? '<p class="small" style="font-size:13px;color:var(--tx2)">I giorni che verranno potrai segnarli man mano.</p>' : '') +
      '<button class="btn" data-g="vai">' + (inCorso ? 'Vai a ' + nomeN : 'Ho capito') + '</button></div>';
    el.querySelector('[data-g]').onclick = function () {
      state.guidaControlloVista = true; save(); el.remove();
      ui.tab = 'turni'; ui.calY = ny; ui.calM = nm; render();
    };
    document.body.appendChild(el);
  }

  function allinea(b) {
    if (!b) return;
    var al = C.giorniDaBusta(state, b);
    // rimuove eventuali giorni di quel mese e applica quelli della busta
    Object.keys(state.giorni).forEach(function (k) { if (k.slice(0, 7) === b.mese) delete state.giorni[k]; });
    Object.assign(state.giorni, al.giorni);
    Object.keys(al.settimane).forEach(function (wk) { state.settimane[wk] = al.settimane[wk]; });
    save();
  }

  // ---- Turni ----
  function tInfo(t, wk) {
    var T = Object.assign({}, C.TURNI[t] || { nome: 'Turno', orario: '', esteso: '' });
    if (t === 'C') {
      var k = (wk && state.settimaneC && state.settimaneC[wk]) || state.centrale || '0730';
      var ci = C.CENTRALI[k] || C.CENTRALI['0730']; T.orario = ci.orario; T.esteso = ci.esteso;
    }
    return T;
  }
  // settimana futura non confermata = turno "previsto"
  function previsto(d) {
    var wk = C.key(C.monday(d));
    if (wk <= C.key(C.monday(oggi))) return false;
    if (state.settimane && state.settimane[wk]) return false;
    if (state.giorni && state.giorni[C.key(d)]) return false;
    return true;
  }
  function infoTurno(g) {
    if (g.tipo !== 'lavoro') {
      if (g.tipo === 'libero') return { cls: 't-free', big: g.festa ? 'Festa' : 'Giorno libero', chips: [] };
      if (g.tipo === 'festa') return { cls: 't-free', big: 'Festa', chips: ['Pagata nella paga del mese'] };
      var chips = [];
      if (g.lavorate > 0) chips.push(ore(g.lavorate) + ' h lavorate');
      return { cls: 't-free', big: C.TIPI[g.tipo] + (g.ore && g.ore < 8 && g.tipo !== 'malattia' ? ' · ' + ore(g.ore) + ' h' : ''), chips: chips };
    }
    var T = tInfo(g.turno, C.key(C.monday(g.data))), ch = [];
    if (g.turno === 'N') ch.push('8 h di notte al 60,5%');
    else if (g.turno === 'P') ch.push('4 h al 27,5% (18–22)');
    else ch.push('Nessuna maggiorazione');
    if (g.buono) ch.push('Buono pasto ' + eur(state.buono || C.REGOLE.buono));
    if (g.straord) ch.push('+' + ore(g.straord) + ' h straordinario');
    return { cls: 't-' + g.turno, big: T.nome + ' · ' + T.esteso, chips: ch };
  }

  function bannerBusta() {
    // promemoria: dal giorno della busta in poi, se manca la busta del mese scorso
    var y = oggi.getFullYear(), m = oggi.getMonth(); // mese scorso = m (0-based) -> m
    var py = m === 0 ? y - 1 : y, pm = m === 0 ? 12 : m;
    var k = py + '-' + (pm < 10 ? '0' : '') + pm;
    if (state.buste[k]) return '';
    var gb = C.giornoBusta(py, pm);
    if (oggi < gb) return '';
    return '<div class="status info"><div class="ic">' + IC.doc.replace('stroke-width', 'stroke="#fff" stroke-width') + '</div><div style="flex:1"><b>È arrivata la busta di ' + MESI[pm - 1] + '?</b><span>Scaricala da EGO e importala per il controllo.</span></div></div>' +
      '<button class="btn secondary" data-act="pdf">' + IC.pdf + 'Importa la busta di ' + MESI[pm - 1] + '</button>';
  }

  function addGiorni(k, n) { var d = C.parse(k); d.setDate(d.getDate() + n); return C.key(d); }
  function bannerBackup() {
    if (!Object.keys(state.buste || {}).length) return '';
    var oggiK = C.key(oggi);
    if (state.backupRimanda && oggiK < state.backupRimanda) return '';
    if (state.ultimoBackup && oggiK < addGiorni(state.ultimoBackup, 30)) return '';
    return '<div class="card bk"><div class="bk-h">' + IC.save + '<div><b>' + (state.ultimoBackup ? 'È passato un mese dall\'ultima copia' : 'Salva una copia dei tuoi dati') + '</b><span>I dati sono solo su questo telefono. Se lo cambi o lo perdi, con la copia ritrovi turni e buste.</span></div></div>' +
      '<div class="two-btn"><button class="btn" data-act="backup">Salva la copia</button><button class="btn secondary" data-act="backupDopo">Più tardi</button></div></div>';
  }

  function renderTurni() {
    var g = C.giorno(state, oggi), it = infoTurno(g);
    var y = ui.calY, m = ui.calM, days = C.giorniMese(y, m), first = (days[0].getDay() + 6) % 7;
    var cells = '', nN = 0, nMP = 0, nPrev = 0;
    for (var i = 0; i < first; i++) cells += '<div class="day empty"></div>';
    days.forEach(function (d) {
      var gd = C.giorno(state, d), cls = 'day', lab = '';
      var NOMI_X = { ferie: 'Ferie', rol: 'ROL', cig: 'Cassa integrazione', malattia: 'Malattia', congedo: 'Congedo', legge104: 'Legge 104', corso: 'Corso', permesso: 'Permesso', sciopero: 'Sciopero', chiusura: 'Chiusura', festa: 'Festa' };
      if (gd.tipo === 'lavoro') { cls += ' t-' + gd.turno; lab = tInfo(gd.turno).nome; if (gd.turno === 'N') nN++; else nMP++; }
      else if (gd.tipo === 'libero') { cls += ' t-free'; }
      else { cls += ' x-' + gd.tipo; lab = NOMI_X[gd.tipo] || ''; }
      if (gd.tipo === 'libero') cls = 'day t-free';
      if (C.key(d) === C.key(oggi)) cls += ' today-ring';
      if (gd.tipo !== 'libero' && previsto(d)) { cls += ' prev'; nPrev++; }
      var dot = gd.straord ? '<i class="dot"></i>' : '';
      cells += '<button class="' + cls + '" data-day="' + C.key(d) + '" style="' + (gd.tipo === 'libero' ? 'background:var(--free-bg);color:var(--free-tx)' : '') + '">' + dot + '<span class="n">' + d.getDate() + '</span><span class="t' + (lab.length > 8 ? ' sm' : '') + '">' + (lab === 'Cassa integrazione' ? 'Cassa<br>integrazione' : lab) + '</span></button>';
    });
    return '<div class="screen">' +
      '<div class="topbar"><div><div class="kicker">Paga<b style="color:var(--teal-tx)">Giusta</b><span class="beta">BETA</span></div><h1>I miei turni</h1></div>' +
      '<div class="row"><button class="iconbtn" data-act="settings" aria-label="Impostazioni">' + IC.gear + '</button></div></div>' +
 bannerBusta() + bannerBackup() +
      '<button class="today ' + it.cls + '" data-day="' + C.key(oggi) + '" style="border:none;text-align:left;width:100%">' +
      '<div class="lab">Oggi · ' + GG[oggi.getDay()] + ' ' + oggi.getDate() + ' ' + MESI[oggi.getMonth()] + '</div>' +
      '<div class="big">' + esc(it.big) + '</div><div class="chips">' + it.chips.map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('') + '</div></button>' +
      '<div class="card cal"><div class="cal-head"><button class="iconbtn" data-act="calPrev" aria-label="Mese precedente">' + IC.left + '</button>' +
      '<div style="text-align:center"><b>' + meseNome(y, m) + '</b><div class="muted small">' + nN + ' notti · ' + nMP + ' mattine/pom.</div></div>' +
      '<button class="iconbtn" data-act="calNext" aria-label="Mese successivo">' + IC.right + '</button></div>' +
      '<div class="grid7" style="margin-bottom:6px"><div class="wd">L</div><div class="wd">M</div><div class="wd">M</div><div class="wd">G</div><div class="wd">V</div><div class="wd">S</div><div class="wd">D</div></div>' +
      '<div class="grid7">' + cells + '</div>' +
      '<div class="legend"><span><i class="sw" style="background:var(--m-bg)"></i>M · 6–14</span><span><i class="sw" style="background:var(--p-bg)"></i>P · 14–22</span><span><i class="sw" style="background:var(--n-bg)"></i>N · 22–6</span>' +
      (state.tipoOrario === 'centrale' ? '<span><i class="sw" style="background:var(--c-bg)"></i>C · ' + C.infoC(state).orario + '</span>' : '') + '<span><i class="sw" style="background:#FDBA74"></i>Ferie</span><span><i class="sw" style="background:#FCA5A5"></i>Cassa int.</span><span><i class="sw" style="background:#DC2626;border-radius:6px;width:8px;height:8px"></i>Straord.</span></div></div>' +
      '<div class="two-btn"><button class="btn" data-act="piuGiorni">' + IC.cal + 'Segna più giorni</button><button class="btn secondary" data-dayedit="' + C.key(oggi) + '">Cambio turno</button></div>' +
      '<div class="muted small" style="text-align:center">Tocca un giorno per vederlo o cambiarlo. Con "Segna più giorni" metti in un colpo solo ferie, cassa integrazione o malattia di più giorni.</div>' +
      '</div>';
  }

  // ---- Foglio del giorno: prima il riepilogo, poi (se si può) la modifica ----
  var IC_LOCK = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  var IC_WARN = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>';
  var NOTE_TIPO = {
    malattia: 'La malattia è pagata normalmente: in parte dall\'INPS e il resto lo integra l\'azienda. Dalla 3ª malattia breve dell\'anno (fino a 5 giorni) i primi 3 giorni sono pagati al 50%.',
    chiusura: 'La chiusura aziendale è pagata come un giorno di ferie, ma le ore vengono scalate dai tuoi ROL.',
    legge104: 'I permessi Legge 104 sono pagati come ore normali, ma in quelle ore non maturano gli incentivi.',
    permesso: 'Il permesso privato non è pagato: le ore vengono tolte dalla paga.',
    sciopero: 'Le ore di sciopero non sono pagate: vengono tolte dalla paga, e in quelle ore non maturano gli incentivi.'
  };
  var NOMI_G = { lavoro: 'Lavoro', ferie: 'Ferie', rol: 'ROL', cig: 'Cassa integrazione', malattia: 'Malattia', congedo: 'Congedo parentale', legge104: 'Legge 104', corso: 'Corso', permesso: 'Permesso privato', sciopero: 'Sciopero', chiusura: 'Chiusura aziendale', festa: 'Festa', libero: 'Giorno libero' };
  function meseChiuso(k) { return !!(state.buste && state.buste[k.slice(0, 7)]); }

  function riepilogoGiorno(g) {
    var k = g.key, T = g.turno ? tInfo(g.turno, C.key(C.monday(g.data))) : null, prev = previsto(g.data);
    var cls = g.tipo === 'lavoro' ? 't-' + g.turno : g.tipo === 'libero' || g.tipo === 'festa' ? 't-free' : 'x-' + g.tipo;
    var big, sub = '', righe = [];
    var oreTipo = { ferie: g.ferie, rol: g.rol, cig: g.cig, corso: g.corso, permesso: g.assenza, congedo: g.congedo, legge104: g.l104, sciopero: g.sciopero }[g.tipo];
    if (g.tipo === 'lavoro') { big = T.nome + ' · ' + T.esteso; if (prev) sub = 'Previsto dalla rotazione'; }
    else if (g.tipo === 'libero') big = g.festa ? 'Festa' : 'Giorno libero';
    else if (g.tipo === 'festa') { big = 'Festa'; sub = 'Pagata nella paga del mese'; }
    else if (g.tipo === 'malattia' || g.tipo === 'chiusura') big = NOMI_G[g.tipo] + ', giornata intera';
    else if (oreTipo !== undefined && oreTipo < g.oreGiorno) big = NOMI_G[g.tipo] + ' · ' + ore(oreTipo) + ' ore';
    else big = NOMI_G[g.tipo] + ', giornata intera';
    if (g.tipo !== 'lavoro' && g.lavorate > 0 && T) righe.push(['Lavoro', ore(g.lavorate) + ' h · ' + T.nome]);
    if (g.pom) righe.push(['Maggiorazione pomeriggio', ore(g.pom) + ' h al 27,5%']);
    if (g.notte) righe.push(['Maggiorazione notte', ore(g.notte) + ' h al 60,5%']);
    if (g.straord) righe.push(['Straordinario', '+' + ore(g.straord) + ' h']);
    if (g.tipo === 'malattia') {
      var mi = C.malattiaInfo(state, k);
      if (mi && mi.breve) righe.push(['Malattia breve', 'n. ' + mi.n + ' dell\'anno']);
      if (mi && mi.ridotta) righe.push(['Paga di questo giorno', 'al 50%']);
    }
    if (g.tipo !== 'libero') righe.push(['Buono pasto', g.buono ? 'Sì · ' + eur(state.buono || C.REGOLE.buono) : 'No']);
    return '<div class="today ' + cls + (prev && g.tipo === 'lavoro' ? ' prev' : '') + '"><div class="big" style="font-size:22px">' + esc(big) + '</div>' + (sub ? '<div class="small" style="opacity:.85">' + esc(sub) + '</div>' : '') + '</div>' +
      (righe.length ? '<div class="card list riep">' + righe.map(function (r) { return '<div class="li"><span>' + esc(r[0]) + '</span><span class="v">' + esc(r[1]) + '</span></div>'; }).join('') + '</div>' : '') +
      (NOTE_TIPO[g.tipo] ? '<div class="muted small">' + NOTE_TIPO[g.tipo] + '</div>' : '') ;
  }

  function apriGiorno(k, diretto) {
    var d = C.parse(k), g = C.giorno(state, d), ov, tipo, oreV, straord, wk = C.key(C.monday(d)), turnoSett, orC;
    function ripristina() {
      ov = Object.assign({}, state.giorni[k] || {});
      tipo = ov.tipo || g.tipo; oreV = ov.ore !== undefined ? ov.ore : (state.oreGiorno || 8); straord = ov.straord || 0;
      turnoSett = C.turno(state, d); orC = (state.settimaneC && state.settimaneC[wk]) || state.centrale || '0730';
    }
    ripristina();
    var chiuso = meseChiuso(k), passato = k < C.key(oggi);
    var settBloccata = false;
    for (var i = 0; i < 7; i++) { var x = new Date(C.parse(wk)); x.setDate(x.getDate() + i); if (meseChiuso(C.key(x))) settBloccata = true; }
    var modo = chiuso ? 'vista' : diretto ? 'diretto' : 'vista', conferma = false;
    var sc = document.createElement('div'); sc.className = 'scrim';
    function titolo() { return '<h2>' + cap(GG[d.getDay()]) + ' ' + d.getDate() + ' ' + MESI[d.getMonth()] + (d.getFullYear() !== oggi.getFullYear() ? ' ' + d.getFullYear() : '') + '</h2>'; }
    function draw() { if (modo === 'vista') drawVista(); else drawEdit(); }
    function drawVista() {
      var piede;
      if (chiuso) piede = '<div class="lockbox">' + IC_LOCK + '<div><b>Mese chiuso</b>La busta di ' + MESI[d.getMonth()] + ' è già stata importata e controllata: questo giorno non si può più modificare.</div></div>' +
        '<button class="btn secondary" data-close="1">Chiudi</button>';
      else if (passato && conferma) piede = '<div class="lockbox warn">' + IC_WARN + '<div><b>Vuoi davvero correggere questo giorno?</b>È un giorno già passato. Correggilo solo se avevi segnato qualcosa di sbagliato, così il controllo della busta resta giusto.</div></div>' +
        '<button class="btn" data-edit="1">Sì, correggi</button><button class="btn secondary" data-no="1">No, lascia così</button>';
      else if (passato) piede = '<button class="btn secondary" data-corr="1">Correggi</button><button class="btn secondary" data-close="1">Chiudi</button>';
      else piede = '<button class="btn" data-edit="1">Modifica</button><button class="btn secondary" data-close="1">Chiudi</button>';
      sc.innerHTML = '<div class="sheet" role="dialog" aria-label="Giorno"><div class="grab"></div>' + titolo() + riepilogoGiorno(g) + piede + '</div>';
      var b;
      if ((b = sc.querySelector('[data-close]'))) b.onclick = function () { sc.remove(); };
      if ((b = sc.querySelector('[data-edit]'))) b.onclick = function () { modo = 'modifica'; conferma = false; draw(); };
      if ((b = sc.querySelector('[data-corr]'))) b.onclick = function () { conferma = true; draw(); };
      if ((b = sc.querySelector('[data-no]'))) b.onclick = function () { conferma = false; draw(); };
    }
    function drawEdit() {
      var tipi = ['lavoro', 'ferie', 'rol', 'cig', 'malattia', 'congedo', 'legge104', 'permesso', 'sciopero', 'chiusura', 'corso', 'festa'];
      var nomi = { lavoro: 'Lavoro', ferie: 'Ferie', rol: 'ROL', cig: 'Cassa integr.', malattia: 'Malattia', congedo: 'Congedo', legge104: 'Legge 104', corso: 'Corso', permesso: 'Permesso privato', sciopero: 'Sciopero', chiusura: 'Chiusura aziendale', festa: 'Festa' };
      var weekend = g.weekend;
      var showOre = ['ferie', 'rol', 'cig', 'corso', 'permesso', 'congedo', 'legge104', 'sciopero'].indexOf(tipo) >= 0;
      sc.innerHTML = '<div class="sheet" role="dialog" aria-label="Giorno"><div class="grab"></div>' +
        titolo() +
        (settBloccata ? '<div class="lockbox">' + IC_LOCK + '<div><b>Turno della settimana non modificabile</b>Una parte di questa settimana è in un mese già chiuso dalla busta. Puoi cambiare solo questo giorno.</div></div><div style="display:none">' : '<div>') + '<div class="stepn" style="margin-bottom:8px">Turno di tutta la settimana</div><div class="seg">' +
        ['M', 'P', 'N', 'C'].map(function (t) { return '<button class="opt t-' + t + (turnoSett === t ? ' on' : '') + '" data-wk="' + t + '">' + tInfo(t).nome + '</button>'; }).join('') + '</div>' +
        (turnoSett === 'C' ? '<div class="seg" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-top:8px">' + ['0730', '0900'].map(function (k) { return '<button class="opt t-C' + (orC === k ? ' on' : '') + '" data-orc="' + k + '">' + C.CENTRALI[k].esteso + '</button>'; }).join('') + '</div>' : '') +
        (previsto(d) && !settBloccata ? '<div class="muted small" style="margin-top:8px">Questa settimana è <b>prevista</b> dalla rotazione: salvando la confermi.</div>' : '') + '</div>' +
        '<div><div class="stepn" style="margin-bottom:8px">Questo giorno</div><div class="opts">' +
        (weekend ? '<button class="opt' + (tipo === 'libero' ? ' on' : '') + '" data-tipo="libero">Libero</button>' : '') +
        tipi.filter(function (t) { return !weekend || t === 'lavoro' || t === 'corso'; }).map(function (t) { return '<button class="opt' + (tipo === t ? ' on' : '') + '" data-tipo="' + t + '">' + nomi[t] + '</button>'; }).join('') + '</div></div>' +
        (showOre ? '<div class="stepper"><div><b style="font-size:15px">Ore di ' + esc(nomi[tipo].toLowerCase()) + '</b><div class="muted small">8 = giornata intera</div></div><div class="ctr"><button data-o="-1" aria-label="Meno">−</button><b>' + ore(oreV) + '</b><button data-o="1" aria-label="Più">+</button></div></div>' : '') +
        '<div class="stepper"><div><b style="font-size:15px">Straordinario</b><div class="muted small">Ore in più oltre il turno</div></div><div class="ctr"><button data-s="-1" aria-label="Meno">−</button><b>' + ore(straord) + '</b><button data-s="1" aria-label="Più">+</button></div></div>' +
        (NOTE_TIPO[tipo] ? '<div class="muted small">' + NOTE_TIPO[tipo] + '</div>' : '') +
        '<button class="btn" data-save="1">Salva</button><button class="btn secondary" data-close="1">Annulla</button></div>';
      sc.querySelectorAll('[data-tipo]').forEach(function (b) { b.onclick = function () { tipo = b.getAttribute('data-tipo'); drawEdit(); }; });
      sc.querySelectorAll('[data-wk]').forEach(function (b) { b.onclick = function () { turnoSett = b.getAttribute('data-wk'); drawEdit(); }; });
      sc.querySelectorAll('[data-orc]').forEach(function (b) { b.onclick = function () { orC = b.getAttribute('data-orc'); drawEdit(); }; });
      sc.querySelectorAll('[data-o]').forEach(function (b) { b.onclick = function () { oreV = Math.max(1, Math.min(state.oreGiorno || 8, oreV + +b.getAttribute('data-o'))); drawEdit(); }; });
      sc.querySelectorAll('[data-s]').forEach(function (b) { b.onclick = function () { straord = Math.max(0, Math.min(12, straord + +b.getAttribute('data-s'))); drawEdit(); }; });
      sc.querySelector('[data-close]').onclick = function () { if (modo === 'diretto') sc.remove(); else { modo = 'vista'; ripristina(); draw(); } };
      sc.querySelector('[data-save]').onclick = function () {
        if (!settBloccata && (turnoSett !== C.turno(state, d) || previsto(d))) state.settimane[wk] = turnoSett;
        state.settimaneC = state.settimaneC || {};
        if (!settBloccata) { if (turnoSett === 'C') state.settimaneC[wk] = orC; else delete state.settimaneC[wk]; }
        var def = g.weekend ? 'libero' : g.festa ? 'festa' : 'lavoro';
        var nv = {};
        if (tipo !== def) nv.tipo = tipo;
        if (showOre && oreV !== (state.oreGiorno || 8)) nv.ore = oreV;
        if (straord) nv.straord = straord;
        if (Object.keys(nv).length) state.giorni[k] = nv; else delete state.giorni[k];
        save(); sc.remove(); render();
      };
    }
    sc.onclick = function (e) { if (e.target === sc) sc.remove(); };
    draw(); document.body.appendChild(sc);
  }

  // ---- Più giorni insieme ----
  function apriPiuGiorni(pre) {
    pre = pre || {};
    var tipi = ['ferie', 'rol', 'cig', 'malattia', 'congedo', 'legge104', 'corso', 'permesso', 'sciopero', 'chiusura', 'lavoro'];
    var nomi = { ferie: 'Ferie', rol: 'ROL', cig: 'Cassa integr.', malattia: 'Malattia', congedo: 'Congedo', legge104: 'Legge 104', corso: 'Corso', permesso: 'Permesso privato', sciopero: 'Sciopero', chiusura: 'Chiusura aziendale', lavoro: 'Lavoro normale' };
    var dal = pre.dal || C.key(oggi), al = pre.al || dal, tipo = pre.tipo || 'ferie';
    var sc = document.createElement('div'); sc.className = 'scrim';
    function calcola() {
      var a = dal <= al ? dal : al, z = dal <= al ? al : dal, d = C.parse(a), fine = C.parse(z), r = { giorni: [], saltati: 0, chiusi: 0, passati: 0 }, n = 0;
      while (d <= fine && n < 120) {
        var k = C.key(d), g = C.giorno(state, d);
        if (meseChiuso(k)) r.chiusi++;
        else if (g.weekend || (g.festa && tipo !== 'lavoro')) r.saltati++;
        else { r.giorni.push(k); if (k < C.key(oggi)) r.passati++; }
        d.setDate(d.getDate() + 1); n++;
      }
      r.troppi = n >= 120; return r;
    }
    function data(k) { var d = C.parse(k); return GG[d.getDay()].slice(0, 3) + ' ' + d.getDate() + ' ' + MESI[d.getMonth()]; }
    function draw() {
      var r = calcola(), oreG = state.oreGiorno || 8;
      var info = r.troppi ? '<div class="lockbox warn">' + IC_WARN + '<div><b>Periodo troppo lungo</b>Scegli al massimo 4 mesi alla volta.</div></div>' :
        '<div class="sumbox"><b>' + (r.giorni.length ? r.giorni.length + (r.giorni.length === 1 ? ' giorno lavorativo' : ' giorni lavorativi') + ' · ' + ore(r.giorni.length * oreG) + ' ore' : 'Nessun giorno da segnare') + '</b>' +
        (r.giorni.length ? '<span>da ' + data(r.giorni[0]) + ' a ' + data(r.giorni[r.giorni.length - 1]) + ' → <b>' + esc(nomi[tipo]) + '</b></span>' : '') +
        (r.saltati ? '<span>Sabati, domeniche e feste restano come sono.</span>' : '') +
        (r.chiusi ? '<span>' + r.chiusi + ' giorni sono in un mese già chiuso dalla busta: non vengono toccati.</span>' : '') + '</div>' +
        (r.passati ? '<div class="lockbox warn">' + IC_WARN + '<div><b>Attenzione: ' + r.passati + (r.passati === 1 ? ' giorno è già passato' : ' giorni sono già passati') + '</b>Va bene solo se stai correggendo qualcosa che avevi segnato male.</div></div>' : '');
      sc.innerHTML = '<div class="sheet" role="dialog" aria-label="Segna più giorni"><div class="grab"></div><h2>Segna più giorni</h2>' +
        '<div class="dates"><label><span>Dal</span><input type="date" id="pgDal" value="' + dal + '"></label><label><span>Al</span><input type="date" id="pgAl" value="' + al + '"></label></div>' +
        '<div><div class="stepn" style="margin-bottom:8px">Cosa sono questi giorni?</div><div class="opts">' +
        tipi.map(function (t) { return '<button class="opt' + (tipo === t ? ' on' : '') + '" data-tipo="' + t + '">' + nomi[t] + '</button>'; }).join('') + '</div></div>' +
        info + (NOTE_TIPO[tipo] ? '<div class="muted small">' + NOTE_TIPO[tipo] + '</div>' : '') +
        (tipo === 'lavoro' ? '<div class="muted small">"Lavoro normale" cancella ferie, cassa o altro segnato in quei giorni e rimette il turno.</div>' : '') +
        '<button class="btn" data-save="1"' + (r.giorni.length && !r.troppi ? '' : ' disabled') + '>Segna ' + (r.giorni.length || '') + ' giorni</button><button class="btn secondary" data-close="1">Annulla</button></div>';
      var iD = sc.querySelector('#pgDal'), iA = sc.querySelector('#pgAl');
      iD.onchange = function () { if (iD.value) { dal = iD.value; if (al < dal) al = dal; } draw(); };
      iA.onchange = function () { if (iA.value) al = iA.value; draw(); };
      sc.querySelectorAll('[data-tipo]').forEach(function (b) { b.onclick = function () { tipo = b.getAttribute('data-tipo'); draw(); }; });
      sc.querySelector('[data-close]').onclick = function () { sc.remove(); };
      sc.querySelector('[data-save]').onclick = function () {
        var r2 = calcola(); if (!r2.giorni.length || r2.troppi) return;
        r2.giorni.forEach(function (k) {
          var ov = Object.assign({}, state.giorni[k] || {});
          delete ov.ore;
          if (tipo === 'lavoro') delete ov.tipo; else ov.tipo = tipo;
          if (Object.keys(ov).length) state.giorni[k] = ov; else delete state.giorni[k];
        });
        save(); sc.remove();
        var d0 = C.parse(r2.giorni[0]); ui.tab = 'turni'; ui.calY = d0.getFullYear(); ui.calM = d0.getMonth() + 1; render();
        toast(r2.giorni.length + ' giorni segnati come ' + nomi[tipo].toLowerCase());
      };
    }
    sc.onclick = function (e) { if (e.target === sc) sc.remove(); };
    draw(); document.body.appendChild(sc);
  }

  function descGiorno(g) {
    var t;
    if (g.tipo === 'lavoro') t = tInfo(g.turno, C.key(C.monday(g.data))).nome;
    else if (g.tipo === 'libero') t = 'Libero';
    else {
      var oT = { ferie: g.ferie, rol: g.rol, cig: g.cig, corso: g.corso, permesso: g.assenza, congedo: g.congedo, legge104: g.l104, sciopero: g.sciopero }[g.tipo];
      t = (NOMI_G[g.tipo] || g.tipo) + (oT !== undefined && oT < g.oreGiorno ? ' ' + ore(oT) + ' h' : '');
    }
    if (g.straord) t += ' + ' + ore(g.straord) + ' h straord.';
    return t;
  }

  // ---- Mese ----
  function renderMese() {
    var y = ui.meseY, m = ui.meseM, s = C.stimaMese(state, y, m);
    var k = y + '-' + (m < 10 ? '0' : '') + m, b = state.buste[k];
    var head = '<div class="topbar"><div><div class="kicker">' + meseNome(y, m) + '</div><h1>Il mio mese</h1></div>' +
      '<div class="row"><button class="iconbtn' + (meseIdx(y, m) <= limitiMese().min ? ' off' : '') + '" data-act="mesePrev" aria-label="Mese precedente">' + IC.left + '</button><button class="iconbtn' + (meseIdx(y, m) >= limitiMese().max ? ' off' : '') + '" data-act="meseNext" aria-label="Mese successivo">' + IC.right + '</button></div></div>';
    if (s.pagaMancante && !b) {
      return '<div class="screen">' + head + '<div class="status info"><div class="ic">' + IC.info + '</div><div><b>Manca la tua paga</b><span>Importa una busta paga: l\'app ricava la tua paga oraria e può fare i calcoli.</span></div></div><button class="btn" data-act="pdf">' + IC.pdf + 'Importa una busta (PDF)</button></div>';
    }
    var stat, righe, lordo, netto, nettoSub, o = s.ore;
    if (b) {
      var conf = C.confronta(s, b), bad = conf.filter(function (c) { return !c.ok; });
      var ctrlBad = (b.controlli || []).filter(function (c) { return !c.ok; });
      if (!bad.length && !ctrlBad.length) stat = '<div class="status ok"><div class="ic">' + IC.check + '</div><div><b>Tutto torna</b><span>Le ore della busta corrispondono ai tuoi turni e i conti sono giusti.</span></div></div>';
      else stat = '<div class="status warn"><div class="ic">' + IC.warn + '</div><div><b>Da controllare</b><span>' + (bad.length ? bad.length + ' differenze tra calendario e busta' : '') + (bad.length && ctrlBad.length ? ' · ' : '') + (ctrlBad.length ? 'calcoli della busta da verificare' : '') + '</span></div></div>';
      stat += '<div class="card list checks"><div class="li" style="font-weight:700">Calendario e busta a confronto</div>' +
        conf.map(function (c) {
          var e = c.ok ? 0 : C.euroDifferenza(state, c, y);
          var sub = c.ok ? '' : '<span class="sub ' + (e < -0.5 ? 'neg' : '') + '">' + (Math.abs(e) < 0.5 ? 'Non cambia quasi niente in euro' : '≈ ' + eur(Math.abs(e)) + (e < 0 ? ' in meno in busta' : ' in più in busta')) + '</span>';
          return '<div class="li"><span><span class="ck ' + (c.ok ? 'ok">' + IC.checkS : 'no">' + IC.warnS) + '</span> ' + esc(c.nome) + sub + '</span><span class="v">' + ore(c.cal) + ' h · busta ' + ore(c.busta) + ' h</span></div>';
        }).join('') + (bad.length ? (function () {
          var tot = bad.reduce(function (a, c) { return a + C.euroDifferenza(state, c, y); }, 0);
          return Math.abs(tot) >= 0.5 ? '<div class="li difftot"><span>In tutto, rispetto ai tuoi turni</span><span class="v ' + (tot < 0 ? 'neg' : '') + '">' + (tot < 0 ? '≈ − ' : '≈ + ') + eur(Math.abs(tot)) + '</span></div>' + '<div class="li"><span class="muted small">Prima di preoccuparti guarda i giorni qui sotto: spesso è il calendario a non essere aggiornato (per esempio ferie non segnate).</span></div>' : '';
        })() : '') + '</div>';
      if (bad.length) {
        var gd = C.giorniDiversi(state, b);
        stat += '<div class="card list"><div class="li" style="font-weight:700">' + (gd.length ? 'Giorni da guardare' : 'Dove cercare') + '</div>' +
          (gd.length ? gd.slice(0, 10).map(function (x) {
            return '<button class="li gdiff" data-day="' + x.key + '"><span><b>' + cap(GG[x.data.getDay()]).slice(0, 3) + ' ' + x.data.getDate() + '</b></span><span class="gd2"><span>Calendario: <b>' + esc(descGiorno(x.cal)) + '</b></span><span>Busta: <b>' + esc(descGiorno(x.busta)) + '</b></span></span></button>';
          }).join('') + (gd.length > 10 ? '<div class="li muted small">… e altri ' + (gd.length - 10) + ' giorni</div>' : '')
            : '<div class="li muted small">Non trovo un giorno preciso: la differenza è sparsa nel mese. Controlla turni e straordinari segnati.</div>') +
          '<div class="li" style="display:block"><span class="muted small">Se la busta è giusta e il calendario no (per esempio un cambio turno che non avevi segnato), puoi copiare i giorni dalla busta. Se invece hai ragione tu, porta questo confronto all\'ufficio del personale.</span><button class="btn secondary" style="margin-top:10px" data-act="allinea" data-k="' + k + '">Usa i giorni della busta nel calendario</button></div></div>';
      }
      righe = b.voci.filter(function (v) { return v.comp; }).map(function (v) { var sp = B.spiega(v, b); return { voce: sp.titolo, importo: v.comp }; });
      lordo = b.totComp; netto = b.netto; nettoSub = 'Netto in busta · trattenute ' + eur(b.totTratt);
    } else {
      stat = '<div class="status warn"><div class="ic">' + IC.info + '</div><div><b>Questa è una STIMA di ' + MESI[m - 1] + ', non la busta</b><span>Calcolata dai tuoi turni. Quando arriva la busta di ' + MESI[m - 1] + ', importala: qui vedrai le cifre vere e il controllo.</span></div></div>';
      var ubm = C.ultimaBusta(state);
      if (ubm) stat += '<button class="btn secondary" data-act="vaiMese" data-k="' + ubm.mese + '">Vai alla busta di ' + MESI[+ubm.mese.slice(5, 7) - 1] + '</button>';
      righe = s.righe; lordo = s.lordo; netto = s.netto; nettoSub = 'Netto stimato (indicativo)';
    }
    var tiles = '<div class="tiles"><div class="tile"><b>' + ore(o.lavorate) + '</b><span>ore lavorate</span></div><div class="tile night"><b>' + ore(o.notte + o.pom) + '</b><span>ore magg.</span></div>' +
      '<div class="tile"><b>' + ore(o.ferie + o.rol) + '</b><span>ferie/ROL</span></div><div class="tile"><b>' + ore(o.cig) + '</b><span>cassa int.</span></div></div>';
    var list = '<div class="card list"><div class="li" style="font-weight:700">' + (b ? 'Le competenze della busta' : 'Come si arriva al lordo') + '</div>' +
      righe.map(function (r) { return '<div class="li"><span>' + esc(r.voce) + (r.nota ? '<span class="sub">' + esc(r.nota) + '</span>' : '') + '</span><span class="v' + (r.importo < 0 ? ' neg' : '') + '">' + eur(r.importo) + '</span></div>'; }).join('') +
      '<div class="li tot"><span>Lordo totale</span><span>' + eur(lordo) + '</span></div></div>';
    var buoni = '<div class="card list"><div class="li"><span>Buoni pasto Edenred<span class="sub">' + s.buoni + ' giorni lavorati × ' + eur(C.parametri(state).buono) + '</span></span><span class="v">' + eur(s.buoniEuro) + '</span></div></div>';
    var notes = (s.malattiaNota && !b ? '<div class="muted small">Malattia: stima basata sulle regole indicate dal sindacato, da confermare con una busta vera.</div>' : '') +
      (!b && s.righe.some(function (r) { return r.stima; }) ? '<div class="muted small">Le voci con "(stima)" sono indicative: verranno precise quando l\'app conoscerà una tua busta con quelle voci.</div>' : '');
    var tratt = '';
    if (!b && s.trattenute) tratt = '<div class="card list"><div class="li" style="font-weight:700">Trattenute stimate</div>' +
      s.trattenute.map(function (t) { return '<div class="li"><span>' + esc(t.voce) + '</span><span class="v neg">− ' + eur(t.importo) + '</span></div>'; }).join('') + '</div>';
    return '<div class="screen">' + head + stat + tiles + list + tratt +
      '<div class="netto"><div><small>' + nettoSub + '</small></div><b>' + eur(netto) + '</b></div>' + buoni + notes + '</div>';
  }

  // ---- Andamento mese per mese ----
  function andamento(ksDesc) {
    if (ksDesc.length < 2) return ksDesc.length === 1 ? '<div class="card muted small" style="text-align:center">Dalla seconda busta caricata qui vedrai l\'andamento mese per mese.</div>' : '';
    var ks = ksDesc.slice(0, 12).reverse(), tipo = ui.andamento || 'netto';
    var M = { netto: ['Netto', function (b) { return b.netto || 0; }, true], notte: ['Ore di notte', function (b) { return (b.ore && b.ore.notte) || 0; }], cig: ['Cassa int.', function (b) { return (b.ore && b.ore.cig) || 0; }] };
    var f = M[tipo][1], eurM = M[tipo][2], vals = ks.map(function (k) { return f(state.buste[k]); }), max = Math.max.apply(null, vals.concat([1]));
    var W = 300, H = 150, n = ks.length, bw = Math.min(34, (W - 10) / n - 8), step = (W - 10) / n;
    var bars = ks.map(function (k, i) {
      var v = vals[i], h = Math.max(2, v / max * (H - 40)), x = 5 + i * step + (step - bw) / 2, y = H - 18 - h, last = i === n - 1;
      return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="5" class="' + (last ? 'bar-on' : 'bar') + '"/>' +
        (last || n <= 6 ? '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 5).toFixed(1) + '" text-anchor="middle" class="bar-v">' + (eurM ? B.fmt(Math.round(v), 0) : ore(v)) + '</text>' : '') +
        '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 4) + '" text-anchor="middle" class="bar-l">' + MESI[+k.slice(5, 7) - 1].slice(0, 3) + '</text>';
    }).join('');
    var media = vals.reduce(function (a, v) { return a + v; }, 0) / n;
    return '<div class="card trend"><h3 style="margin:0">Mese per mese</h3>' +
      '<div class="seg" style="grid-template-columns:repeat(3,minmax(0,1fr))">' + Object.keys(M).map(function (t) { return '<button class="opt' + (t === tipo ? ' on' : '') + '" data-act="andamento" data-v="' + t + '">' + M[t][0] + '</button>'; }).join('') + '</div>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" aria-hidden="true">' + bars + '</svg>' +
      '<div class="muted small">Media: <b style="color:var(--tx)">' + (eurM ? eur(media) : ore(media) + ' h') + '</b> al mese' + (n > 1 ? ' · ultime ' + n + ' buste' : '') + '</div></div>';
  }

  // ---- Busta ----
  function renderBusta() {
    var ks = Object.keys(state.buste).sort().reverse();
    if (ui.bustaSel && state.buste[ui.bustaSel]) return renderBustaDett(state.buste[ui.bustaSel]);
    return '<div class="screen"><div class="topbar"><div><div class="kicker">Le tue buste</div><h1>La busta spiegata</h1></div></div>' +
      '<button class="btn" data-act="pdf">' + IC.pdf + 'Importa la busta (PDF)</button>' +
      '<div class="privacy">' + IC.lock + '<span>Resta solo sul tuo telefono, non viene inviata a nessuno.</span></div>' +
      (IS_APP ? '<div class="card muted small"><b style="color:var(--tx)">Come si fa:</b> scarica la busta da EGO, poi tocca il pulsante qui sopra e scegli il PDF dalla cartella Download. Oppure, dalla cartella Download, tieni premuto sul file → Condividi → PagaGiusta.</div>'
        : '<div class="card muted small"><b style="color:var(--tx)">Come si fa:</b> scarica la busta da EGO (finisce nell\'app File, cartella Download), poi tocca il pulsante qui sopra e scegli il PDF.</div>') +
      andamento(ks) +
      (ks.length ? '<div class="card list">' + ks.map(function (k) { var b = state.buste[k]; return '<button class="li" data-busta="' + k + '" style="width:100%;background:none;border:none;border-bottom:1px solid var(--line2);text-align:left;padding:12px 0"><span><b>' + meseKeyLabel(k) + '</b><span class="sub">Netto ' + eur(b.netto) + '</span></span><span class="v">›</span></button>'; }).join('') + '</div>' : '<div class="muted" style="text-align:center;padding:20px">Nessuna busta importata.</div>') +
      '</div>';
  }

  // "Dove vanno i tuoi soldi": il lordo diviso tra netto, tasse, contributi e trattenute
  function ciambella(b) {
    if (!b.totComp || !b.totTratt) return '';
    function somma(f) { return b.voci.filter(f).reduce(function (a, v) { return a + (v.tratt || 0); }, 0); }
    var tasse = (b.irpef || 0) + (b.addizionali || 0);
    var sind = somma(function (v) { return (v.code === '813' || v.code === '814' || /SIND/.test(v.desc)) && v.tratt; });
    var cometa = somma(function (v) { return (v.code === '1286' || /COMETA/.test(v.desc)) && v.tratt; });
    var contr = b.totTratt - tasse - sind - cometa;
    var netto = b.totComp - b.totTratt;
    var seg = [['Netto: a te', netto, '#14B8A6'], ['Tasse (IRPEF e addizionali)', tasse, '#F59E0B'], ['Contributi INPS e altre trattenute', contr, '#6366F1'], ['Quota sindacale', sind, '#EC4899'], ['Fondo Cometa (pensione)', cometa, '#A855F7']]
      .filter(function (x) { return x[1] > 0.5; });
    if (seg.some(function (x) { return x[1] < 0; }) || netto <= 0) return '';
    var tot = seg.reduce(function (a, x) { return a + x[1]; }, 0), R = 54, Cc = 2 * Math.PI * R, off = 0, gap = seg.length > 1 ? 2 : 0;
    var arcs = seg.map(function (x) {
      var len = x[1] / tot * Cc, a = '<circle cx="70" cy="70" r="' + R + '" fill="none" stroke="' + x[2] + '" stroke-width="22" stroke-dasharray="' + Math.max(0, len - gap).toFixed(2) + ' ' + (Cc - Math.max(0, len - gap)).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 70 70)"/>';
      off += len; return a;
    }).join('');
    var su100 = Math.round(netto / b.totComp * 100);
    return '<div class="card donut"><h3 style="margin:0">Dove vanno i tuoi soldi</h3>' +
      '<div class="dn-row"><svg viewBox="0 0 140 140" width="140" height="140" aria-hidden="true">' + arcs + '<text x="70" y="66" text-anchor="middle" class="dn-big">' + su100 + ' €</text><text x="70" y="86" text-anchor="middle" class="dn-sm">su 100 €</text></svg>' +
      '<div class="dn-leg">' + seg.map(function (x) { return '<div><i style="background:' + x[2] + '"></i><span>' + esc(x[0]) + '<b>' + eur(x[1]) + ' · ' + Math.round(x[1] / tot * 100) + '%</b></span></div>'; }).join('') + '</div></div>' +
      '<div class="muted small">Su ogni 100 € lordi, a te arrivano circa ' + su100 + ' €. Il resto va in tasse e contributi (che ti servono per la pensione).</div></div>';
  }

  function renderBustaDett(b) {
    var voci = b.voci.map(function (v) { return { v: v, s: B.spiega(v, b) }; });
    var comp = voci.filter(function (x) { return x.s.tipo === 'comp'; }), tratt = voci.filter(function (x) { return x.s.tipo === 'tratt'; }), info = voci.filter(function (x) { return x.s.tipo === 'info'; });
    function card(x) {
      var imp = x.s.importo !== null && x.s.importo !== undefined ? '<span class="' + (x.s.tipo === 'tratt' ? 'tratt' : '') + '">' + (x.s.tipo === 'tratt' ? '− ' : '') + eur(x.s.importo) + '</span>' : '';
      return '<div class="voce"><div class="h"><span>' + esc(x.s.titolo) + '<span class="badge">' + esc(x.v.code) + '</span>' + (x.s.sconosciuta ? '<span class="badge">nuova</span>' : '') + '</span>' + imp + '</div><p>' + esc(x.s.testo) + '</p></div>';
    }
    var tasse = '';
    if (b.irpef !== null) tasse += '<div class="voce"><div class="h"><span>Tasse IRPEF</span><span class="tratt">− ' + eur(b.irpef) + '</span></div><p>L\'imposta sul reddito del mese, già ridotta dalle detrazioni per lavoro dipendente.</p></div>';
    if (b.addizionali) tasse += '<div class="voce"><div class="h"><span>Addizionali regionale e comunale</span><span class="tratt">− ' + eur(b.addizionali) + '</span></div><p>Le tasse locali (Regione e Comune), di solito trattenute a rate durante l\'anno.</p></div>';
    var ctrl = (b.controlli || []).map(function (c) { return '<div class="li"><span><span class="ck ' + (c.ok ? 'ok">' + IC.checkS : 'no">' + IC.warnS) + '</span> ' + esc(c.testo) + '</span></div>'; }).join('');
    var fr = '';
    if (b.ferie) fr = '<div class="warnbox"><div class="t">Ferie e permessi a fine ' + MESI[+b.mese.slice(5, 7) - 1] + '</div><div class="two">' +
      '<div class="mini"><b>≈ ' + Math.floor(b.ferie.residuo / 8) + ' giorni</b><span>Ferie · ' + ore(b.ferie.residuo) + ' ore</span></div>' +
      '<div class="mini"><b>≈ ' + Math.floor((b.rol ? b.rol.residuo : 0) / 8) + ' giorni</b><span>ROL · ' + ore(b.rol ? b.rol.residuo : 0) + ' ore</span></div></div></div>';
    return '<div class="screen"><div class="topbar"><div><div class="kicker">' + meseKeyLabel(b.mese) + '</div><h1>La busta spiegata</h1></div>' +
      '<button class="iconbtn" data-act="bustaBack" aria-label="Indietro">' + IC.left + '</button></div>' +
      '<div class="netto"><div><small>Netto in busta</small><small>Lordo ' + eur(b.totComp) + ' · trattenute ' + eur(b.totTratt) + '</small></div><b>' + eur(b.netto) + '</b></div>' +
      ciambella(b) +
      '<div class="card list checks"><div class="li" style="font-weight:700">Controlli sui conti</div>' + ctrl + '</div>' +
      '<h3 style="margin:6px 0 0">Cosa ti pagano</h3>' + comp.map(card).join('') +
      '<h3 style="margin:6px 0 0">Cosa ti trattengono</h3>' + tratt.map(card).join('') + tasse +
      fr + '<h3 style="margin:6px 0 0">Voci informative</h3>' + info.map(card).join('') +
      '<button class="btn secondary" data-act="vaiMese" data-k="' + b.mese + '">Confronta con i miei turni</button>' +
      '<button class="btn danger" data-act="delBusta" data-k="' + b.mese + '">Elimina questa busta dall\'app</button></div>';
  }

  // ---- Simulatore ferie ----
  function simulatore() {
    ui.simDal = ui.simDal || addGiorni(C.key(oggi), 7); ui.simAl = ui.simAl || addGiorni(ui.simDal, 4);
    var tipo = ui.simTipo || 'ferie', r = C.simulaFerie(state, ui.simDal, ui.simAl, tipo, oggi);
    var nome = tipo === 'ferie' ? 'ferie' : 'ROL', altro = tipo === 'ferie' ? 'ROL' : 'ferie';
    var res = '';
    if (r && r.giorni) {
      var ok = r.resto >= -0.01;
      res = '<div class="simres ' + (ok ? 'ok' : 'no') + '"><div class="simrow"><span>Ti servono</span><b>' + ore(r.ore) + ' h · ' + r.giorni + (r.giorni === 1 ? ' giorno' : ' giorni') + '</b></div>' +
        '<div class="simrow"><span>' + (r.mesi ? 'Avrai a disposizione' : 'Hai a disposizione') + '</span><b>' + ore(r.disponibili) + ' h di ' + nome + '</b></div>' +
        '<div class="simbig">' + (ok ? 'Ti resterebbero <b>' + ore(r.resto) + ' h</b> (≈ ' + Math.floor(r.resto / 8) + ' giorni)' : 'Non bastano: ti mancano <b>' + ore(-r.resto) + ' h</b>') + '</div>' +
        (!ok ? '<div class="small">Potresti usare anche i ' + altro + ': ne avrai circa ' + ore(r.altro) + ' h.</div>' : '') +
        (r.mesi ? '<div class="small">Contate anche le ore che maturano nei prossimi ' + (r.mesi === 1 ? 'mese' : r.mesi + ' mesi') + '. Sabati, domeniche e feste non contano.</div>' : '<div class="small">Sabati, domeniche e feste non contano.</div>') + '</div>' +
        '<button class="btn secondary" data-act="simSegna">' + IC.cal + 'Segna questi giorni nel calendario</button>';
    } else res = '<div class="muted small">Nel periodo scelto non ci sono giorni lavorativi.</div>';
    return '<div class="card sim"><h3 style="margin:0">Prova delle ferie</h3><div class="muted small">Scegli le date: l\'app ti dice quante ore ti servono e quante ne restano. Utile prima di fare la richiesta su EGO.</div>' +
      '<div class="dates"><label><span>Dal</span><input type="date" id="simDal" value="' + ui.simDal + '"></label><label><span>Al</span><input type="date" id="simAl" value="' + ui.simAl + '"></label></div>' +
      '<div class="seg" style="grid-template-columns:repeat(2,minmax(0,1fr))"><button class="opt' + (tipo === 'ferie' ? ' on' : '') + '" data-act="simTipo" data-v="ferie">Ferie</button><button class="opt' + (tipo === 'rol' ? ' on' : '') + '" data-act="simTipo" data-v="rol">ROL</button></div>' +
      res + '</div>';
  }

  // ---- Ferie ----
  function renderFerie() {
    var fr = C.ferieRol(state, oggi), t = C.tredicesima(state), s = C.stimaMese(state, oggi.getFullYear(), oggi.getMonth() + 1);
    var html = '<div class="screen"><div class="topbar"><div><div class="kicker">Ferie, ROL e altro</div><h1>Ferie e permessi</h1></div></div>';
    if (!fr) html += '<div class="status info"><div class="ic">' + IC.info + '</div><div><b>Importa una busta</b><span>Le ferie e i ROL residui si leggono dalla busta paga.</span></div></div><button class="btn" data-act="pdf">' + IC.pdf + 'Importa una busta (PDF)</button>';
    else {
      html += '<div class="warnbox"><div class="t">Ferie e permessi che ti restano</div><div class="two">' +
        '<div class="mini"><b>≈ ' + Math.floor(fr.ferie / 8) + ' giorni</b><span>Ferie · ' + ore(fr.ferie) + ' ore</span></div>' +
        '<div class="mini"><b>≈ ' + Math.floor(fr.rol / 8) + ' giorni</b><span>ROL · ' + ore(fr.rol) + ' ore</span></div></div>' +
        (fr.rol > 120 ? '<div class="small">Hai tanti ROL accumulati: dopo qualche anno, oltre una certa soglia, puoi chiedere di farteli pagare oppure usarli.</div>' : '') + '</div>' +
        '<div class="card list"><div class="li" style="font-weight:700">Come è calcolato</div>' +
        '<div class="li"><span>Dalla busta di ' + meseKeyLabel(fr.busta).toLowerCase() + '</span><span class="v">' + ore(fr.ferieBusta) + ' h · ' + ore(fr.rolBusta) + ' h</span></div>' +
        (fr.mesi ? '<div class="li"><span>Maturate dopo (' + fr.mesi + ' mesi)</span><span class="v">+' + ore(fr.mesi * fr.ferieMese) + ' h · +' + ore(fr.mesi * fr.rolMese) + ' h</span></div>' : '') +
        ((fr.ferieUsate || fr.rolUsati) ? '<div class="li"><span>Segnate nel calendario</span><span class="v">−' + ore(fr.ferieUsate) + ' h · −' + ore(fr.rolUsati) + ' h</span></div>' : '') +
        '<div class="li"><span class="muted small">Ogni mese maturano circa ' + ore(fr.ferieMese) + ' ore di ferie e ' + ore(fr.rolMese) + ' ore di ROL.</span></div></div>';
    }
    if (fr) html += simulatore();
    if (t) html += '<div class="card list"><div class="li" style="font-weight:700">Tredicesima (dicembre)</div>' +
      '<div class="li"><span>Lordo</span><span class="v">' + eur(t.lordo) + '</span></div>' +
      '<div class="li"><span>Netto indicativo</span><span class="v">' + B.fmt(Math.round(t.nettoMin / 10) * 10, 0) + ' – ' + B.fmt(Math.round(t.nettoMax / 10) * 10, 0) + ' €' + '</span></div>' +
      '<div class="li"><span class="muted small">Sulla tredicesima si pagano contributi e tasse ma non si applicano le detrazioni: il netto dipende dal tuo reddito dell\'anno. Mesi di cassa integrazione possono ridurla un po\'.</span></div></div>';
    html += '<div class="card list"><div class="li" style="font-weight:700">Buoni pasto di ' + MESI[oggi.getMonth()] + '</div><div class="li"><span>' + s.buoni + ' giorni lavorati (previsti)</span><span class="v">' + eur(s.buoniEuro) + '</span></div></div>';
    html += '</div>';
    return html;
  }

  // ---- Impostazioni ----
  function renderImpostazioni() {
    var ordTxt = state.ordine.map(function (t) { return C.TURNI[t].nome; }).join(' → ');
    var turnoOra = C.turno(state, oggi);
    return '<div class="screen settings"><div class="topbar"><div><div class="kicker">PagaGiusta ' + VERSIONE + '</div><h1>Impostazioni</h1></div><button class="iconbtn" data-act="tabTurni" aria-label="Indietro">' + IC.left + '</button></div>' +
      '<div class="card"><h3>Il tuo orario</h3><select id="tipoOrario" style="width:100%">' +
      '<option value="turni"' + (state.tipoOrario !== 'centrale' ? ' selected' : '') + '>Turni a rotazione (mattina, pomeriggio, notte)</option>' +
      '<option value="0730"' + (state.tipoOrario === 'centrale' && (state.centrale || '0730') === '0730' ? ' selected' : '') + '>Orario centrale 7:30 – 16:00</option>' +
      '<option value="0900"' + (state.tipoOrario === 'centrale' && state.centrale === '0900' ? ' selected' : '') + '>Orario centrale 9:00 – 17:30</option></select></div>' +
      '<div class="card"><h3>Part-time</h3><select id="oreGiorno" style="width:100%">' +
      [8, 7, 6, 5, 4].map(function (h) { return '<option value="' + h + '"' + ((state.oreGiorno || 8) === h ? ' selected' : '') + '>' + (h === 8 ? 'No, tempo pieno (8 ore al giorno)' : 'Sì, ' + h + ' ore al giorno') + '</option>'; }).join('') + '</select>' +
      '<div class="stepn" style="margin:12px 0 8px">Giorni in cui lavori</div><div class="grid7">' +
      [[1, 'L'], [2, 'M'], [3, 'M'], [4, 'G'], [5, 'V'], [6, 'S'], [0, 'D']].map(function (x) { var on = (state.giorniLav || [1, 2, 3, 4, 5]).indexOf(x[0]) >= 0; return '<button class="opt' + (on ? ' on' : '') + '" data-gl="' + x[0] + '" style="min-height:44px;padding:0">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="muted small" style="margin-top:10px">Per il part-time verticale togli i giorni in cui non lavori. La paga base viene presa dalla tua busta.</div></div>' +
      '<div class="card"><h3>Solidarietà (cassa integrazione ogni giorno)</h3><select id="solidOre" style="width:100%">' +
      [0, 1, 2, 3, 4].map(function (h) { return '<option value="' + h + '"' + ((state.solidOre || 0) === h ? ' selected' : '') + '>' + (h === 0 ? 'No' : 'Sì, ' + h + ' ' + (h === 1 ? 'ora' : 'ore') + ' di cassa al giorno') + '</option>'; }).join('') + '</select>' +
      '<div class="muted small" style="margin-top:10px">Se lavori meno ore perché sei in solidarietà (ad esempio 6 ore di lavoro + 2 di cassa integrazione), impostalo qui: NON è un part-time.</div></div>' +
      (state.tipoOrario === 'centrale' ? '' : '<div class="card"><h3>Turno di questa settimana</h3><div class="seg">' + ['M', 'P', 'N'].map(function (t) { return '<button class="opt t-' + t + (turnoOra === t ? ' on' : '') + '" data-anc="' + t + '">' + C.TURNI[t].nome + '</button>'; }).join('') + '</div>' +
      '<div class="muted small" style="margin-top:10px">Da qui l\'app calcola tutte le settimane, avanti e indietro. Le settimane che hai cambiato a mano restano come le hai segnate.</div></div>') +
      '<div class="card list"><div class="li"><span>Ordine dei turni<span class="sub">' + ordTxt + '</span></span><select id="ordine"><option value="NPM"' + (state.ordine.join('') === 'NPM' ? ' selected' : '') + '>Notte → Pom. → Mattina</option><option value="MPN"' + (state.ordine.join('') === 'MPN' ? ' selected' : '') + '>Mattina → Pom. → Notte</option></select></div>' +
      '<div class="li"><span>Valore buono pasto</span><select id="buono">' + [5, 6, 7, 8, 9, 10].map(function (v) { return '<option value="' + v + '"' + (+state.buono === v ? ' selected' : '') + '>' + v + ' €</option>'; }).join('') + '</select></div>' +
      '<div class="li"><span>Tema</span><select id="tema"><option value="auto"' + (state.tema === 'auto' ? ' selected' : '') + '>Come il telefono</option><option value="light"' + (state.tema === 'light' ? ' selected' : '') + '>Chiaro</option><option value="dark"' + (state.tema === 'dark' ? ' selected' : '') + '>Scuro</option></select></div></div>' +
      '<div class="card"><h3>Backup</h3><div class="muted small" style="margin-bottom:10px">Salva una copia dei tuoi dati (turni e buste lette) in un file. Sul telefono nuovo puoi ricaricarla.</div>' +
      '<div class="two"><button class="btn secondary" data-act="backup">Salva copia</button><button class="btn secondary" data-act="restore">Ricarica copia</button></div></div>' +
      '<div class="card"><h3>' + IC.lock.replace('stroke-width', 'stroke="currentColor" stroke-width') + ' La tua privacy</h3><div class="muted">' + PRIVACY_TXT + '</div></div>' +
      '<div class="card"><h3>Versione di prova (Beta)</h3><div class="muted small">Può avere ancora qualche errore: confronta sempre i calcoli con la tua busta paga. Se trovi un problema, segnalalo: il messaggio non contiene nessun dato della tua busta.</div>' +
      '<button class="btn secondary" style="margin-top:10px" data-act="segnala">Segnala un problema</button>' +
      '<button class="btn secondary" style="margin-top:10px" data-act="novita">Rivedi le novità</button></div>' +
      (IS_WEB && !standalone() ? '<button class="btn secondary" data-act="guidaHome">Aggiungi alla schermata Home</button>' : '') +
      '<button class="btn danger" data-act="wipe">Cancella tutti i miei dati</button>' +
      '<div class="muted small" style="text-align:center">PagaGiusta ' + VERSIONE + ' · i tuoi dati restano sul telefono</div></div>';
  }

  // ---------- eventi ----------
  function bind() {
    document.querySelectorAll('[data-tab]').forEach(function (b) {
      b.onclick = function () {
        var t = b.getAttribute('data-tab');
        if (t === 'mese' && ui.tab !== 'mese') { var L0 = limitiMese(), i0 = Math.max(L0.min, Math.min(L0.max, meseIdx(ui.calY, ui.calM))); ui.meseY = Math.floor(i0 / 12); ui.meseM = i0 % 12 + 1; }
        ui.tab = t; if (ui.tab === 'busta') ui.bustaSel = null; render();
      };
    });
    document.querySelectorAll('[data-day]').forEach(function (b) { b.onclick = function () { apriGiorno(b.getAttribute('data-day')); }; });
    document.querySelectorAll('[data-dayedit]').forEach(function (b) { b.onclick = function () { apriGiorno(b.getAttribute('data-dayedit'), true); }; });
    document.querySelectorAll('[data-busta]').forEach(function (b) { b.onclick = function () { ui.bustaSel = b.getAttribute('data-busta'); render(); }; });
    document.querySelectorAll('[data-anc]').forEach(function (b) {
      b.onclick = function () { state.ancora = { settimana: C.key(C.monday(oggi)), turno: b.getAttribute('data-anc') }; delete state.settimane[C.key(C.monday(oggi))]; save(); render(); toast('Turni aggiornati'); };
    });
    var to = $('#tipoOrario'); if (to) to.onchange = function () {
      if (to.value === 'turni') state.tipoOrario = 'turni'; else { state.tipoOrario = 'centrale'; state.centrale = to.value; }
      if (state.tipoOrario === 'turni' && !state.ancora) state.ancora = { settimana: C.key(C.monday(oggi)), turno: 'M' };
      save(); render(); toast('Orario aggiornato');
    };
    var so = $('#solidOre'); if (so) so.onchange = function () { state.solidOre = +so.value; save(); render(); toast('Salvato'); };
    var og = $('#oreGiorno'); if (og) og.onchange = function () { state.oreGiorno = +og.value; save(); render(); toast('Orario aggiornato'); };
    document.querySelectorAll('[data-gl]').forEach(function (b) {
      b.onclick = function () {
        var d = +b.getAttribute('data-gl'), gl = (state.giorniLav || [1, 2, 3, 4, 5]).slice(), i = gl.indexOf(d);
        if (i >= 0) { if (gl.length === 1) { toast('Serve almeno un giorno'); return; } gl.splice(i, 1); } else gl.push(d);
        state.giorniLav = gl; save(); render();
      };
    });
    var o = $('#ordine'); if (o) o.onchange = function () { state.ordine = o.value.split(''); save(); render(); };
    var sd = $('#simDal'), sa = $('#simAl');
    if (sd) sd.onchange = function () { if (sd.value) { ui.simDal = sd.value; if (ui.simAl < ui.simDal) ui.simAl = ui.simDal; } render(); };
    if (sa) sa.onchange = function () { if (sa.value) { ui.simAl = sa.value; if (ui.simAl < ui.simDal) ui.simDal = ui.simAl; } render(); };
    var bu = $('#buono'); if (bu) bu.onchange = function () { state.buono = +bu.value; save(); toast('Salvato'); };
    var te = $('#tema'); if (te) te.onchange = function () { state.tema = te.value; save(); render(); };
    document.querySelectorAll('[data-act]').forEach(function (b) {
      b.onclick = function () {
        var a = b.getAttribute('data-act'), k = b.getAttribute('data-k');
        if (a === 'pdf') scegliPdf();
        else if (a === 'settings') { ui.tab = 'impostazioni'; render(); }
        else if (a === 'tabTurni') { ui.tab = 'turni'; render(); }
        else if (a === 'piuGiorni') apriPiuGiorni();
        else if (a === 'backupDopo') { state.backupRimanda = addGiorni(C.key(oggi), 14); save(); render(); toast('Te lo ricordo tra due settimane'); }
        else if (a === 'simSegna') apriPiuGiorni({ dal: ui.simDal, al: ui.simAl, tipo: ui.simTipo || 'ferie' });
        else if (a === 'simTipo') { ui.simTipo = b.getAttribute('data-v'); render(); }
        else if (a === 'andamento') { ui.andamento = b.getAttribute('data-v'); render(); }
        else if (a === 'calPrev') { ui.calM--; if (ui.calM < 1) { ui.calM = 12; ui.calY--; } render(); }
        else if (a === 'calNext') { ui.calM++; if (ui.calM > 12) { ui.calM = 1; ui.calY++; } render(); }
        else if (a === 'mesePrev' || a === 'meseNext') {
          var L = limitiMese(), i = meseIdx(ui.meseY, ui.meseM) + (a === 'mesePrev' ? -1 : 1);
          if (i < L.min || i > L.max) { toast(a === 'meseNext' ? 'Il mese in corso è l\'ultimo: i mesi futuri si vedono quando arrivano' : 'Non ci sono mesi precedenti con dati'); return; }
          ui.meseY = Math.floor(i / 12); ui.meseM = i % 12 + 1; render();
        }
        else if (a === 'bustaBack') { ui.bustaSel = null; render(); }
        else if (a === 'vaiMese') { ui.tab = 'mese'; ui.meseY = +k.slice(0, 4); ui.meseM = +k.slice(5, 7); render(); }
        else if (a === 'allinea') { allinea(state.buste[k]); toast('Calendario aggiornato con i giorni della busta'); render(); }
        else if (a === 'delBusta') { if (confirmBox('Eliminare la busta di ' + meseKeyLabel(k).toLowerCase() + ' dall\'app?')) { delete state.buste[k]; save(); ui.bustaSel = null; render(); } }
        else if (a === 'backup') backup();
        else if (a === 'restore') restore();
        else if (a === 'segnala') segnala();
        else if (a === 'novita') mostraNovita(true);
        else if (a === 'guidaHome') guidaHome(true);
        else if (a === 'wipe') { if (confirmBox('Vuoi cancellare tutti i dati di PagaGiusta da questo telefono? Non si può annullare.')) { try { localStorage.removeItem(STORE); } catch (e) { } state = load(); ui.onbTurno = null; ui.onbBusta = null; render(); toast('Tutti i dati sono stati cancellati'); } }
      };
    });
  }

  function confirmBox(msg) {
    if (window.Android && window.Android.confirm) return window.Android.confirm(msg);
    return window.confirm(msg);
  }

  function backup() {
    state.ultimoBackup = C.key(oggi); delete state.backupRimanda; save(); if (state.onboarded && ui.tab === 'turni') render();
    var data = JSON.stringify(state), name = 'PagaGiusta-backup-' + C.key(oggi) + '.json';
    if (window.Android && window.Android.saveFile) { window.Android.saveFile(name, data); return; }
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = name; a.click();
  }
  function restore() {
    var inp = $('#fileBackup'); inp.value = '';
    inp.onchange = function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try { var s = JSON.parse(r.result); if (!s || s.v !== 1) throw new Error(); state = s; save(); render(); toast('Copia ricaricata'); }
        catch (e) { toast('Questo file non è una copia di PagaGiusta'); }
      };
      r.readAsText(f);
    };
    inp.click();
  }
  function segnala() {
    var txt = 'Ciao! Ho trovato un problema in PagaGiusta ' + VERSIONE + ':\n\n(scrivi qui cosa non va)';
    if (window.Android && window.Android.share) window.Android.share(txt);
    else if (navigator.share) navigator.share({ text: txt }).catch(function () { });
    else toast('Scrivi a chi ti ha dato l\'app');
  }

  // ---------- Animazione di apertura (a ogni avvio dell'app) ----------
  function rigaStato() {
    if (!state.onboarded) return '';
    var y = oggi.getFullYear(), m = oggi.getMonth();
    var py = m === 0 ? y - 1 : y, pm = m === 0 ? 12 : m, k = py + '-' + (pm < 10 ? '0' : '') + pm;
    var b = state.buste[k];
    function esito(bb) {
      var key = bb.mese, yy = +key.slice(0, 4), mm = +key.slice(5, 7);
      var conf = C.confronta(C.stimaMese(state, yy, mm), bb).filter(function (c) { return !c.ok; }).length;
      var ctrl = (bb.controlli || []).filter(function (c) { return !c.ok; }).length;
      return 'Busta di ' + MESI[mm - 1] + ': ' + (conf || ctrl ? 'da controllare' : 'tutto torna ✓');
    }
    if (b) return esito(b);
    if (oggi >= C.giornoBusta(py, pm)) return 'È arrivata la busta di ' + MESI[pm - 1] + '?';
    var ult = C.ultimaBusta(state);
    if (ult) return esito(ult);
    return 'Importa la tua prima busta';
  }
  function gearSvg(cls, col) {
    return '<svg class="gear ' + cls + '" viewBox="0 0 100 100" aria-hidden="true"><path fill="' + col + '" d="M43 4h14l2 12a36 36 0 0 1 9 4l10-7 10 10-7 10a36 36 0 0 1 4 9l12 2v14l-12 2a36 36 0 0 1-4 9l7 10-10 10-10-7a36 36 0 0 1-9 4l-2 12H43l-2-12a36 36 0 0 1-9-4l-10 7-10-10 7-10a36 36 0 0 1-4-9L3 57V43l12-2a36 36 0 0 1 4-9l-7-10 10-10 10 7a36 36 0 0 1 9-4z"/><circle cx="50" cy="50" r="15" fill="#475569"/></svg>';
  }
  function splash() {
    try { if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { mostraBenvenuto(); mostraNovita(); return; } } catch (e) { }
    var el = document.createElement('div'); el.className = 'sp'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="stage"><div class="machine"><i class="led"></i></div>' + gearSvg('g1', '#94A3B8') + gearSvg('g2', '#E8A27C') + gearSvg('g3', '#CBD5E1') +
      '<div class="belt"></div><div class="slot"><div class="doc"><div class="ln t"></div><div class="ln s"></div><div class="ln"></div><div class="ln m"></div><div class="ln s"></div><div class="tot">€ ✓</div></div></div>' +
      '<div class="stamp"><i>✓</i>GIUSTA</div><div class="coin c1">€</div><div class="coin c2">€</div><div class="coin c3">€</div>' +
      '<svg class="logo" viewBox="0 0 200 200"><rect width="200" height="200" rx="46" fill="#0B5D57" stroke="#14B8A6" stroke-width="3"/><g fill="none" stroke-width="18" stroke-linecap="round" transform="rotate(-90 100 100)"><circle class="ring r1" cx="100" cy="100" r="58" stroke="#FCD34D" transform="rotate(8 100 100)"/><circle class="ring r2" cx="100" cy="100" r="58" stroke="#93C5FD" transform="rotate(128 100 100)"/><circle class="ring r3" cx="100" cy="100" r="58" stroke="#C7D2FE" transform="rotate(248 100 100)"/></g><path class="chk" d="M76 102l16 16 32-34" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<div class="wm"><b>Paga<span>Giusta</span></b><div class="tag">La tua busta paga, finalmente chiara.</div></div>' +
      '</div><div class="skip">Tocca per saltare</div>';
    document.body.appendChild(el);
    var done = false;
    function chiudi() { if (done) return; done = true; el.classList.add('bye'); setTimeout(function () { el.remove(); mostraBenvenuto(); mostraNovita(); }, 400); }
    el.addEventListener('click', chiudi);
    setTimeout(chiudi, 3700);
  }

  // ---------- Tutorial delle novità (dopo ogni aggiornamento) ----------
  var NOVITA_ID = '1.0-beta-20';
  var NOVITA = [
    { ic: '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4M7 14h10"/></svg>',
      t: 'Segna più giorni insieme', d: 'Nella schermata Turni c\'è il pulsante "Segna più giorni": scegli dal… al… e cosa sono (ferie, cassa integrazione, malattia…). Sabati, domeniche e feste restano liberi.' },
    { ic: '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15 9.5a3.5 3.5 0 1 0 0 5M8 11h5M8 13h5"/></svg>',
      t: 'Le differenze in euro', d: 'Quando la busta non torna con i tuoi turni, nella sezione Mese ora vedi quanto vale la differenza in euro e in quali giorni cercare l\'errore.' },
    { ic: '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9v9z"/><path d="M14 3.3A9 9 0 0 1 20.7 10H14z"/></svg>',
      t: 'Dove vanno i tuoi soldi', d: 'Aprendo una busta vedi un grafico con quanto arriva a te, quanto va in tasse e quanto in contributi. Dalla seconda busta vedi anche l\'andamento mese per mese.' },
    { ic: '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v3M5.6 5.6l2.1 2.1M3 12h3M18.4 5.6l-2.1 2.1M21 12h-3"/><circle cx="12" cy="13" r="4"/><path d="M4 20h16"/></svg>',
      t: 'Prova delle ferie e copia dei dati', d: 'Nella sezione Ferie puoi provare delle date e vedere quante ore ti restano, prima di chiederle su EGO. E ogni tanto l\'app ti ricorda di salvare una copia dei tuoi dati.' }
  ];
  function mostraNovita(forza) {
    if (!forza && (!state.onboarded || state.novitaViste === NOVITA_ID)) return;
    var i = 0, el = document.createElement('div'); el.className = 'nv';
    function fine() { state.novitaViste = NOVITA_ID; save(); el.remove(); }
    function draw() {
      var n = NOVITA[i], last = i === NOVITA.length - 1;
      el.innerHTML = '<div class="box" role="dialog" aria-label="Novità"><div class="top"><span>Novità · ' + VERSIONE + '</span>' +
        (last ? '' : '<button class="linkbtn" data-nv="skip">Salta</button>') + '</div>' +
        (i === 0 && !forza ? '<div class="upsafe ok">' + IC.checkS.replace('stroke="#fff"', 'stroke="currentColor"') + '<span><b>PagaGiusta è aggiornata' + (IS_WEB ? ' (da sola)' : '') + '.</b> I tuoi dati ci sono tutti, non devi fare niente. Ecco cosa c\'è di nuovo:</span></div>' : '') +
        '<div class="ill">' + n.ic + '</div><h2>' + esc(n.t) + '</h2><p>' + esc(n.d) + '</p>' +
        '<div class="dots">' + NOVITA.map(function (x, k) { return '<i class="' + (k === i ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
        '<button class="btn" data-nv="next">' + (last ? 'Ho capito' : 'Avanti') + '</button></div>';
      var sk = el.querySelector('[data-nv="skip"]'); if (sk) sk.onclick = fine;
      el.querySelector('[data-nv="next"]').onclick = function () { if (last) fine(); else { i++; draw(); } };
    }
    draw(); document.body.appendChild(el);
  }

  // ---------- Popup aggiornamento (il controllo lo fa l'app Android, senza inviare dati) ----------
  function statoAgg(fase, p) {
    var el = ui.upEl; if (!el || !el.parentNode) return;
    var box = el.querySelector('.box'), ill = '<div class="ill"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg></div>';
    var top = '<div class="top"><span>Aggiornamento ' + esc(ui.update ? ui.update.versione : '') + '</span></div>';
    if (fase === 'dl') {
      var bar = box.querySelector('.pbar i');
      if (bar) { bar.style.width = p + '%'; box.querySelector('.pct').textContent = p + '%'; return; }
      box.innerHTML = top + ill + '<h2>Passo 1 di 2: scarico la nuova versione…</h2><div class="pbar"><i style="width:' + (p || 0) + '%"></i></div><p class="pct" style="text-align:center;font-weight:700">' + (p || 0) + '%</p><p class="small" style="font-size:13px;color:var(--tx2)">Non chiudere l\'app. Quando arriva al 100% si apre da sola la finestra di Android.</p>';
    } else if (fase === 'inst') {
      box.innerHTML = top + ill + '<h2>Passo 2 di 2: conferma</h2><p>Nella finestra di Android tocca <b>"Aggiorna"</b> (o "Installa"). Dopo qualche secondo riapri PagaGiusta.</p><div class="upsafe">' + IC.lock + '<span><b>I tuoi dati restano</b>, non devi rifare niente.</span></div><p class="small" style="font-size:13px;color:var(--tx2)">Non vedi la finestra di Android? Tocca "Riprova".</p><button class="btn secondary" data-up="riprova">Riprova</button><button class="btn secondary" data-up="chiudi">Chiudi</button>';
    } else if (fase === 'perm') {
      box.innerHTML = top + ill + '<h2>Serve un permesso (solo la prima volta)</h2><div class="upsteps"><div><i>1</i><span>Si è aperta un\'impostazione di Android.</span></div><div><i>2</i><span>Attiva l\'interruttore <b>"Consenti da questa fonte"</b>.</span></div><div><i>3</i><span>Torna indietro con la freccia: l\'aggiornamento riparte da solo.</span></div></div><button class="btn secondary" data-up="chiudi">Chiudi</button>';
    } else if (fase === 'err') {
      box.innerHTML = top + ill + '<h2>Download non riuscito</h2><p>Controlla di essere connesso a internet (Wi-Fi o dati) e riprova. I tuoi dati non sono stati toccati.</p><button class="btn" data-up="riprova">Riprova</button><button class="btn secondary" data-up="chiudi">Più tardi</button>';
    }
    var ch = box.querySelector('[data-up="chiudi"]'); if (ch) ch.onclick = function () { el.remove(); ui.updateShown = false; };
    var rp = box.querySelector('[data-up="riprova"]'); if (rp) rp.onclick = function () { statoAgg('dl', 0); window.Android.apriAggiornamento(); };
  }

  function mostraAggiornamento() {
    if (!ui.update || ui.updateShown) return;
    if (document.querySelector('.sp') || document.querySelector('.nv') || !state.onboarded) { setTimeout(mostraAggiornamento, 800); return; }
    ui.updateShown = true;
    var info = ui.update, el = document.createElement('div'); el.className = 'nv';
    var note = String(info.note || '').split('\n').map(function (r) { return r.replace(/^[-*•]\s*/, '').trim(); }).filter(Boolean);
    var num = String(info.versione || '').replace(/^v?1\.0-beta\./, '');
    el.innerHTML = '<div class="box" role="dialog" aria-label="Aggiornamento"><div class="top"><span>Aggiornamento disponibile</span></div>' +
      '<h2>È pronta la nuova versione di PagaGiusta</h2><p class="small" style="margin-top:-6px;color:var(--tx2)">Versione 1.0 Beta ' + esc(num) + (window.PG_BUILD ? ' · tu hai la ' + window.PG_BUILD : '') + '</p>' +
      (note.length ? '<div class="upnote"><b>Cosa cambia</b>' + note.slice(0, 6).map(function (n) { return '<div>• ' + esc(n) + '</div>'; }).join('') + '</div>' : '') +
      '<div class="upsteps"><b>Come si aggiorna (meno di un minuto)</b>' +
      '<div><i>1</i><span>Tocca <b>"Aggiorna ora"</b>: l\'app scarica la nuova versione.</span></div>' +
      '<div><i>2</i><span>Android ti chiede se vuoi aggiornare l\'app: tocca <b>"Aggiorna"</b> (o "Installa").</span></div>' +
      '<div><i>3</i><span>Fatto! Riapri PagaGiusta.</span></div></div>' +
      '<div class="upsafe">' + IC.lock + '<span><b>I tuoi dati restano.</b> Turni e buste non si cancellano: non devi rifare niente.</span></div>' +
      '<button class="btn" data-up="si">Aggiorna ora</button><button class="btn secondary" data-up="no">Più tardi</button></div>';
    ui.upEl = el;
    el.querySelector('[data-up="si"]').onclick = function () {
      if (window.Android && window.Android.apriAggiornamento) { statoAgg('dl', 0); window.Android.apriAggiornamento(); } else el.remove();
    };
    el.querySelector('[data-up="no"]').onclick = function () { el.remove(); };
    document.body.appendChild(el);
  }

  // ---------- Benvenuto: al primo avvio, una breve descrizione dell'app ----------
  function mostraBenvenuto() {
    if (state.onboarded || state.benvenutoVisto) return;
    var el = document.createElement('div'); el.className = 'nv';
    var punti = [
      ['📄', 'Legge la busta paga in PDF (quella che scarichi da EGO) e la spiega voce per voce, in parole semplici'],
      ['✅', 'Controlla se notti, pomeriggi, straordinari, incentivi e cassa integrazione tornano con i turni che hai fatto'],
      ['🏖️', 'Ti dice quante ferie e ROL ti restano'],
      ['🍽️', 'Conta i buoni pasto del mese e stima la tredicesima']
    ];
    el.innerHTML = '<div class="box" role="dialog" aria-label="Benvenuto"><div class="top"><span>Benvenuto</span><button class="linkbtn" data-w="ok">Salta</button></div>' +
      '<div style="display:flex;justify-content:center">' + LOGO + '</div>' +
      '<h2 style="text-align:center">Ciao! Questa è PagaGiusta</h2><p style="text-align:center">L\'app pensata per chi lavora a turni, per avere la busta paga sempre sotto controllo.</p>' +
      '<div class="card list" style="padding:4px 16px">' + punti.map(function (x) { return '<div class="li" style="justify-content:flex-start;gap:12px"><span style="font-size:20px">' + x[0] + '</span><span>' + esc(x[1]) + '</span></div>'; }).join('') + '</div>' +
      '<p class="small" style="font-size:13px;color:var(--tx2)">🔒 Le tue buste e i tuoi dati restano solo sul tuo telefono: nessuno li vede, nemmeno chi ha creato l\'app. Niente account. È una versione di prova (Beta): confronta sempre i calcoli con la tua busta.</p>' +
      '<button class="btn" data-w="ok">Iniziamo</button></div>';
    el.querySelectorAll('[data-w]').forEach(function (b) { b.onclick = function () { state.benvenutoVisto = true; save(); el.remove(); guidaHome(); }; });
    document.body.appendChild(el);
  }

  // ---------- iPhone: come aggiungere PagaGiusta alla schermata Home ----------
  function guidaHome(forza) {
    if (!IS_WEB || standalone()) return;
    if (!forza && state.guidaHomeVista) return;
    var el = document.createElement('div'); el.className = 'nv';
    var share = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-4px"><path d="M12 3v12M8 7l4-4 4 4M5 11v9h14v-9"/></svg>';
    el.innerHTML = '<div class="box" role="dialog" aria-label="Aggiungi alla schermata Home"><div class="top"><span>Installa PagaGiusta</span><button class="linkbtn" data-g="ok">Dopo</button></div>' +
      '<h2>Mettila nella schermata Home</h2><p>Così si apre come un\'app vera, a schermo intero, e funziona anche senza internet.</p>' +
      '<div class="card list" style="padding:4px 16px">' +
      '<div class="li" style="justify-content:flex-start;gap:12px"><b>1</b><span>Tocca il pulsante <b>Condividi</b> ' + share + ' in basso (o in alto) in Safari</span></div>' +
      '<div class="li" style="justify-content:flex-start;gap:12px"><b>2</b><span>Scorri e scegli <b>"Aggiungi alla schermata Home"</b></span></div>' +
      '<div class="li" style="justify-content:flex-start;gap:12px"><b>3</b><span>Tocca <b>"Aggiungi"</b>: trovi l\'icona di PagaGiusta tra le tue app</span></div></div>' +
      (IS_IOS ? '' : '<p class="small" style="font-size:13px;color:var(--tx2)">Su Android conviene installare l\'app vera: chiedi il link a chi ti ha passato PagaGiusta.</p>') +
      '<p class="small" style="font-size:13px;color:var(--tx2)">Importante: usa sempre PagaGiusta dall\'icona nella Home, così i tuoi dati restano salvati.</p>' +
      '<button class="btn" data-g="ok">Ho capito</button></div>';
    el.querySelectorAll('[data-g]').forEach(function (b) { b.onclick = function () { state.guidaHomeVista = true; save(); el.remove(); }; });
    document.body.appendChild(el);
  }

  render();
  splash();
})();
