(function () {
  'use strict';
  var P = window.DrinkParse;
  var TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  var STORE_KEY = 'drinkTracker.v1';

  // Typical Australian serves. Beer ABV defaults to full-strength lager (~4.8%).
  var PRESETS = [
    { name: 'Pot / middy', vol: 285, abv: 4.8, icon: 'pot' },
    { name: 'Schooner', vol: 425, abv: 4.8, icon: 'schooner' },
    { name: 'Pint', vol: 570, abv: 4.8, icon: 'pint' },
    { name: 'Can / stubby', vol: 375, abv: 4.8, icon: 'can' },
    { name: 'Mid schooner', vol: 425, abv: 3.5, icon: 'schooner' },
    { name: 'Wine glass', vol: 150, abv: 13, icon: 'wine' },
    { name: 'Large wine', vol: 250, abv: 13, icon: 'wine' },
    { name: 'Sparkling', vol: 150, abv: 11.5, icon: 'flute' },
    { name: 'Shot / nip', vol: 30, abv: 40, icon: 'shot' },
    { name: 'Double spirit', vol: 60, abv: 40, icon: 'tumbler' },
    { name: 'RTD can', vol: 375, abv: 5, icon: 'can' },
    { name: 'Cider', vol: 375, abv: 5, icon: 'cider' }
  ];

  // Inline SVG icons for the preset tiles (24x24, currentColor).
  var ICONS = {
    pot: '<path d="M7 6h10l-1.2 13a2 2 0 0 1-2 1.8h-3.6a2 2 0 0 1-2-1.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M7.5 10h9l-.8 9a1 1 0 0 1-1 .9H9.3a1 1 0 0 1-1-.9z" fill="currentColor"/><path d="M7 6.5c1-1.6 3-2 5-1.2 2-.8 4-.4 5 1.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    schooner: '<path d="M6 4.5h12l-1.6 15.2a1.5 1.5 0 0 1-1.5 1.3H9.1a1.5 1.5 0 0 1-1.5-1.3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M6.7 9h10.6l-1.2 10.6a.8.8 0 0 1-.8.7H8.7a.8.8 0 0 1-.8-.7z" fill="currentColor"/>',
    pint: '<path d="M6 3.5h12l-.8 4.5.8 2-1.4 9.7a1.5 1.5 0 0 1-1.5 1.3H8.9a1.5 1.5 0 0 1-1.5-1.3L6 10l.8-2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M7.4 10.5h9.2l-1.2 8.8a.8.8 0 0 1-.8.7H9.4a.8.8 0 0 1-.8-.7z" fill="currentColor"/>',
    can: '<rect x="7" y="4" width="10" height="17" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 4.5l1-1.5h5l1 1.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><rect x="9" y="9" width="6" height="7" rx="1" fill="currentColor"/>',
    wine: '<path d="M7 3h10c.4 4.8-1.4 8.5-5 8.5S6.6 7.8 7 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M7.4 6.5h9.2c-.4 2.7-2 4.3-4.6 4.3s-4.2-1.6-4.6-4.3z" fill="currentColor"/><path d="M12 11.5V20M8 21h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    flute: '<path d="M9 2.5h6l-.6 9a2.4 2.4 0 0 1-4.8 0z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.4 6.5h5.2l-.4 5a2.2 2.2 0 0 1-4.4 0z" fill="currentColor"/><path d="M12 14v6.5M8.5 21h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="17.5" cy="4" r="1" fill="currentColor"/><circle cx="18.5" cy="7.5" r=".8" fill="currentColor"/>',
    shot: '<path d="M7 8h10l-1.3 11.2a2 2 0 0 1-2 1.8h-3.4a2 2 0 0 1-2-1.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M7.7 13h8.6l-.8 6a1 1 0 0 1-1 .9h-5a1 1 0 0 1-1-.9z" fill="currentColor"/>',
    tumbler: '<path d="M5 6h14l-1.5 13a2 2 0 0 1-2 1.8h-7a2 2 0 0 1-2-1.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M5.8 12h12.4l-.9 7.2a1 1 0 0 1-1 .8H7.7a1 1 0 0 1-1-.8z" fill="currentColor"/><rect x="9" y="8.5" width="4" height="4" rx="1" transform="rotate(-12 11 10.5)" fill="none" stroke="currentColor" stroke-width="1.5"/>',
    cider: '<path d="M12 7.5c-2.5-1.6-6.5-.6-6.5 4.2 0 4 2.6 8.3 5 8.3.7 0 1-.4 1.5-.4s.8.4 1.5.4c2.4 0 5-4.3 5-8.3 0-4.8-4-5.8-6.5-4.2z" fill="currentColor"/><path d="M12 7.5c0-2 .8-3.4 2-4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M13 5.2c1.6-1.4 3.6-1.2 4.5-.6-.8 1.4-2.6 2-4.5.6z" fill="currentColor" opacity=".6"/>'
  };

  var $ = function (id) { return document.getElementById(id); };

  // ---------- storage ----------
  function defaultState() {
    return { settings: { weightKg: 75, sex: 'male' }, current: { startedAt: null, drinks: [] }, history: [] };
  }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && s.current && Array.isArray(s.current.drinks)) return Object.assign(defaultState(), s);
    } catch (e) { /* ignore */ }
    return defaultState();
  }
  var state = load();
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  // ---------- helpers ----------
  function fmtTime(ms) { return new Date(ms).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }); }
  function fmtDate(ms) { return new Date(ms).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }); }
  function round(n, d) { var f = Math.pow(10, d); return Math.round(n * f) / f; }
  function totalStd(drinks) { return drinks.reduce(function (s, d) { return s + d.standards; }, 0); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hhmm(ms) { var d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  /** Turn an HH:MM input into a timestamp near now (a time later than now is assumed to be yesterday). */
  function timeFromInput(v, refMs) {
    var parts = v.split(':'), d = new Date(refMs);
    d.setHours(+parts[0], +parts[1], 0, 0);
    if (d.getTime() > Date.now() + 5 * 60000) d.setDate(d.getDate() - 1);
    return d.getTime();
  }

  // ---------- presets ----------
  PRESETS.forEach(function (p) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'preset';
    b.innerHTML = '<span class="p-ico" aria-hidden="true"><svg viewBox="0 0 24 24">' + (ICONS[p.icon] || ICONS.schooner) + '</svg></span>' +
      '<b>' + esc(p.name) + '</b><small>' + p.vol + ' mL &middot; ' + p.abv + '%</small>' +
      '<span class="p-std">' + round(P.standardsFrom(p.vol, p.abv), 1) + ' std</span>';
    b.addEventListener('click', function () {
      openConfirm({ name: p.name, volumeMl: p.vol, abv: p.abv }, 'Preset: adjust ABV or size if yours differs.');
    });
    $('presets').appendChild(b);
  });

  // ---------- confirm form ----------
  var stdManual = false, editingId = null;

  function openConfirm(v, hint, opts) {
    opts = opts || {};
    editingId = opts.editId || null;
    $('fName').value = v.name || '';
    $('fVol').value = v.volumeMl != null ? v.volumeMl : '';
    $('fAbv').value = v.abv != null ? v.abv : '';
    $('fTime').value = hhmm(v.time || Date.now());
    $('confirmHint').textContent = hint || '';
    $('ocrDetails').hidden = !opts.ocrText;
    $('ocrText').textContent = opts.ocrText || '';
    $('preview').hidden = !opts.imageUrl;
    if (opts.imageUrl) $('preview').src = opts.imageUrl;
    if (v.standards != null && (v.standardsSource === 'label' || opts.editId)) {
      $('fStd').value = v.standards; stdManual = true;
    } else { stdManual = false; recalc(); }
    updateStdHint(v.standardsSource, v.calculatedStandards);
    $('drinkForm').querySelector('[type=submit]').textContent = editingId ? 'Save changes' : 'Add to tonight';
    $('confirmCard').hidden = false;
    $('confirmCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function recalc() {
    var vol = parseFloat($('fVol').value), abv = parseFloat($('fAbv').value);
    if (vol > 0 && abv > 0) $('fStd').value = round(P.standardsFrom(vol, abv), 2);
    else if (!stdManual) $('fStd').value = '';
  }

  function updateStdHint(source, calc) {
    var h = $('stdHint'); h.className = 'hint';
    if (source === 'label') {
      h.className = 'hint good';
      h.textContent = 'Standard drinks taken from the label' + (calc ? ' (calculated from mL x ABV: ' + calc + ').' : '.');
    } else {
      h.textContent = 'Calculated as litres x ABV x 0.789 (1 standard drink = 10 g alcohol). You can override it.';
    }
  }

  ['fVol', 'fAbv'].forEach(function (id) {
    $(id).addEventListener('input', function () { stdManual = false; recalc(); updateStdHint(null); });
  });
  $('fStd').addEventListener('input', function () { stdManual = true; });
  $('cancelBtn').addEventListener('click', closeConfirm);
  function closeConfirm() { $('confirmCard').hidden = true; editingId = null; }

  $('drinkForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var std = parseFloat($('fStd').value);
    if (!(std >= 0) || std > 100) { $('fStd').focus(); return; }
    var existing = editingId && state.current.drinks.find(function (d) { return d.id === editingId; });
    var drink = existing || { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) };
    drink.name = $('fName').value.trim() || 'Drink';
    drink.volumeMl = parseFloat($('fVol').value) || null;
    drink.abv = parseFloat($('fAbv').value) || null;
    drink.standards = round(std, 2);
    drink.time = timeFromInput($('fTime').value, existing ? existing.time : Date.now());
    if (!existing) state.current.drinks.push(drink);
    state.current.drinks.sort(function (a, b) { return a.time - b.time; });
    if (!state.current.startedAt) state.current.startedAt = state.current.drinks[0].time;
    save(); closeConfirm(); render();
  });

  $('manualBtn').addEventListener('click', function () { openConfirm({}, 'Enter what you know: volume + ABV, or standard drinks directly.'); });

  // ---------- OCR ----------
  var tesseractLoading = null, worker = null;
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve();
    if (!tesseractLoading) {
      tesseractLoading = new Promise(function (res, rej) {
        var s = document.createElement('script');
        s.src = TESSERACT_URL; s.onload = res;
        s.onerror = function () { tesseractLoading = null; rej(new Error('Could not load the OCR library (are you offline?)')); };
        document.head.appendChild(s);
      });
    }
    return tesseractLoading;
  }
  function setOcr(msg, frac) {
    $('ocrStatus').hidden = false; $('ocrMsg').textContent = msg;
    if (frac != null) $('ocrBar').style.width = Math.round(frac * 100) + '%';
  }
  async function getWorker() {
    if (worker) return worker;
    await loadTesseract();
    worker = await Tesseract.createWorker('eng', 1, {
      logger: function (m) {
        if (m.status === 'recognizing text') setOcr('Reading label...', m.progress);
        else if (m.status) setOcr(m.status.charAt(0).toUpperCase() + m.status.slice(1) + '...', m.progress);
      }
    });
    return worker;
  }

  /** Downscale + greyscale + stretch contrast: helps Tesseract on phone photos. */
  function preprocess(source, w, h) {
    var max = 1800, scale = Math.min(1, max / Math.max(w, h));
    var c = $('work'); c.width = Math.round(w * scale); c.height = Math.round(h * scale);
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, c.width, c.height);
    var img = ctx.getImageData(0, 0, c.width, c.height), d = img.data, lo = 255, hi = 0, i, g;
    for (i = 0; i < d.length; i += 4) {
      g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = g; if (g < lo) lo = g; if (g > hi) hi = g;
    }
    var range = Math.max(1, hi - lo);
    for (i = 0; i < d.length; i += 4) { g = (d[i] - lo) * 255 / range; d[i] = d[i + 1] = d[i + 2] = g; }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  async function runOcr(canvas, imageUrl) {
    try {
      setOcr('Loading OCR engine (first time can take a while)...', 0);
      var w = await getWorker();
      var res = await w.recognize(canvas);
      var text = res.data.text || '';
      $('ocrStatus').hidden = true;
      var p = P.parseLabel(text);
      var found = [p.abv && 'ABV', p.volumeMl && 'volume', p.standardsSource === 'label' && 'standard drinks'].filter(Boolean);
      var hint = found.length
        ? 'Found ' + found.join(', ') + '. Please check and correct anything that looks wrong.'
        : 'Could not read the key values. Try a closer, well-lit photo of the ABV / volume text, or enter them below.';
      openConfirm(p, hint, { ocrText: text.trim() || '(no text found)', imageUrl: imageUrl });
    } catch (err) {
      setOcr('OCR failed: ' + err.message + ' You can enter the details manually.', 0);
      openConfirm({}, 'OCR did not work, enter the details manually.');
    }
  }

  $('photoInput').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var url = URL.createObjectURL(f), img = new Image();
    img.onload = function () { runOcr(preprocess(img, img.naturalWidth, img.naturalHeight), url); };
    img.onerror = function () { setOcr('Could not open that image.', 0); };
    img.src = url;
    e.target.value = '';
  });

  // ---------- live camera ----------
  var stream = null;
  $('cameraBtn').addEventListener('click', async function () {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Live camera is not available here (it needs HTTPS or localhost). Use "Photo of label" instead.'); return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      $('video').srcObject = stream; await $('video').play();
      $('cameraBox').hidden = false;
    } catch (err) { alert('Could not open the camera: ' + err.message); }
  });
  function stopCamera() {
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    stream = null; $('cameraBox').hidden = true;
  }
  $('cameraClose').addEventListener('click', stopCamera);
  $('snapBtn').addEventListener('click', function () {
    var v = $('video'); if (!v.videoWidth) return;
    var c = preprocess(v, v.videoWidth, v.videoHeight);
    var url = c.toDataURL('image/jpeg', 0.7);
    stopCamera(); runOcr(c, url);
  });

  // ---------- night / history ----------
  $('endNightBtn').addEventListener('click', function () {
    if (!state.current.drinks.length) return;
    if (!confirm('End this night and move it to history?')) return;
    var d = state.current.drinks;
    state.history.unshift({ startedAt: d[0].time, endedAt: Date.now(), drinks: d, total: round(totalStd(d), 2) });
    state.history = state.history.slice(0, 200);
    state.current = { startedAt: null, drinks: [] };
    save(); render();
  });

  function renderLog() {
    var ul = $('log'); ul.innerHTML = '';
    var drinks = state.current.drinks, running = 0;
    $('logEmpty').hidden = drinks.length > 0;
    drinks.forEach(function (d) {
      running += d.standards;
      var li = document.createElement('li');
      var meta = [d.volumeMl && d.volumeMl + ' mL', d.abv && d.abv + '%', 'total ' + round(running, 1)].filter(Boolean).join(' &middot; ');
      li.innerHTML = '<span class="time">' + fmtTime(d.time) + '</span>' +
        '<span class="what"><b>' + esc(d.name) + '</b><small>' + meta + '</small></span>' +
        '<span class="std">' + round(d.standards, 1) + '</span>' +
        '<button class="del" aria-label="Remove">&times;</button>';
      li.querySelector('.what').addEventListener('click', function () {
        openConfirm(Object.assign({}, d), 'Editing a logged drink.', { editId: d.id });
      });
      li.querySelector('.del').addEventListener('click', function () {
        if (!confirm('Remove "' + d.name + '"?')) return;
        state.current.drinks = state.current.drinks.filter(function (x) { return x.id !== d.id; });
        if (!state.current.drinks.length) state.current.startedAt = null;
        save(); render();
      });
      ul.appendChild(li);
    });
  }

  function renderHistory() {
    var ul = $('history'); ul.innerHTML = '';
    $('historyEmpty').hidden = state.history.length > 0;
    state.history.forEach(function (n, idx) {
      var li = document.createElement('li');
      li.innerHTML = '<div><b>' + fmtDate(n.startedAt) + '</b><br><small>' + n.drinks.length + ' drinks &middot; ' +
        fmtTime(n.startedAt) + ' to ' + fmtTime(n.drinks[n.drinks.length - 1].time) + '</small></div>' +
        '<span class="std">' + round(n.total, 1) + ' std</span><button class="del" aria-label="Delete night">&times;</button>';
      li.querySelector('.del').addEventListener('click', function () {
        if (!confirm('Delete this night from history?')) return;
        state.history.splice(idx, 1); save(); renderHistory();
      });
      ul.appendChild(li);
    });
  }

  // ---------- BAC chart ----------
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function renderBac() {
    var drinks = state.current.drinks, now = Date.now(), s = state.settings;
    var opts = { weightKg: s.weightKg, sex: s.sex };
    var canvas = $('chart'), dpr = window.devicePixelRatio || 1;
    var W = canvas.clientWidth || 300, H = 200;
    canvas.width = W * dpr; canvas.height = H * dpr;
    var ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    var css = getComputedStyle(document.documentElement);
    var cGrid = css.getPropertyValue('--grid').trim(), cMuted = css.getPropertyValue('--muted').trim(), cLine = css.getPropertyValue('--chart').trim();
    var cCard = css.getPropertyValue('--card').trim(), cText = css.getPropertyValue('--text').trim();
    var FONT = '"Outfit", system-ui, sans-serif';
    ctx.font = '500 11px ' + FONT;

    if (!drinks.length) {
      $('bacNow').textContent = '0.000'; $('zeroAt').textContent = '–'; $('peakInfo').textContent = '';
      // faint placeholder curve
      ctx.strokeStyle = cGrid; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(16, H - 30);
      ctx.bezierCurveTo(W * 0.3, H - 30, W * 0.32, 40, W * 0.45, 40); ctx.bezierCurveTo(W * 0.6, 40, W * 0.75, H - 30, W - 16, H - 30);
      ctx.stroke(); ctx.setLineDash([]);
      ctx.font = '500 13px ' + FONT; ctx.textAlign = 'center';
      var msg = 'Log a drink to see the estimated curve', mw = ctx.measureText(msg).width + 24;
      roundRect(ctx, W / 2 - mw / 2, H / 2 - 4, mw, 30, 15); ctx.fillStyle = cCard; ctx.fill(); ctx.strokeStyle = cGrid; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = cMuted; ctx.fillText(msg, W / 2, H / 2 + 15); return;
    }
    var start = drinks[0].time - 15 * 60000;
    var zero = P.timeToZero(drinks, opts, now);
    var end = Math.max(now, zero || 0, drinks[drinks.length - 1].time + 60 * 60000) + 30 * 60000;
    var sim = P.simulateBac(drinks, opts, start, end, 2);
    var nowPt = sim.points.reduce(function (best, p) { return Math.abs(p.t - now) < Math.abs(best.t - now) ? p : best; }, sim.points[0]);
    var nowBac = now < start ? 0 : nowPt.bac;
    $('bacNow').textContent = nowBac.toFixed(3);
    $('zeroAt').textContent = zero ? fmtTime(zero) : 'now';
    $('peakInfo').textContent = 'Est. peak ' + sim.peak.bac.toFixed(3) + ' g/100mL around ' + fmtTime(sim.peak.t) +
      '. Assumes ' + s.weightKg + ' kg, ' + s.sex + ', ~45 min absorption, elimination 0.015/h.';

    var pad = { l: 38, r: 12, t: 16, b: 26 }, pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    var yMax = Math.max(0.04, Math.ceil(sim.peak.bac * 1.2 * 100) / 100);
    var x = function (t) { return pad.l + (t - start) / (end - start) * pw; };
    var y = function (b) { return pad.t + ph - b / yMax * ph; };

    // grid
    ctx.strokeStyle = cGrid; ctx.fillStyle = cMuted; ctx.lineWidth = 1; ctx.textAlign = 'right';
    var yStep = yMax <= 0.06 ? 0.01 : yMax <= 0.15 ? 0.02 : 0.05;
    for (var b = 0; b <= yMax + 1e-9; b += yStep) {
      var gy = Math.round(y(b)) + 0.5;
      ctx.setLineDash(b === 0 ? [] : [2, 4]);
      ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(W - pad.r, gy); ctx.stroke();
      ctx.fillText(b.toFixed(2), pad.l - 8, y(b) + 4);
    }
    ctx.setLineDash([]);
    ctx.textAlign = 'center';
    var hourMs = 3600000, hrStep = (end - start) > 8 * hourMs ? 2 : 1;
    var firstHr = new Date(start); firstHr.setMinutes(0, 0, 0);
    for (var t = firstHr.getTime() + hourMs; t < end; t += hourMs * hrStep) {
      ctx.fillText(new Date(t).toLocaleTimeString('en-AU', { hour: 'numeric' }), x(t), H - 7);
    }
    // gradient area
    var grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ph);
    grad.addColorStop(0, cLine + '66'); grad.addColorStop(1, cLine + '00');
    ctx.beginPath(); ctx.moveTo(x(start), y(0));
    sim.points.forEach(function (p) { ctx.lineTo(x(p.t), y(p.bac)); });
    ctx.lineTo(x(end), y(0)); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    // line: solid up to now, dashed projection after
    function strokeCurve(from, to) {
      ctx.beginPath(); var started = false;
      sim.points.forEach(function (p) {
        if (p.t < from || p.t > to) return;
        if (!started) { ctx.moveTo(x(p.t), y(p.bac)); started = true; } else ctx.lineTo(x(p.t), y(p.bac));
      });
      ctx.stroke();
    }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = cLine; ctx.lineWidth = 2.5;
    ctx.shadowColor = cLine + '88'; ctx.shadowBlur = 8;
    strokeCurve(start, Math.max(start, now));
    ctx.shadowBlur = 0; ctx.globalAlpha = 0.7; ctx.setLineDash([5, 5]);
    strokeCurve(Math.max(start, now - 120000), end);
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    // drink markers
    drinks.forEach(function (d) {
      ctx.beginPath(); ctx.arc(x(d.time), y(0), 4, 0, Math.PI * 2);
      ctx.fillStyle = cCard; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = cLine; ctx.stroke();
    });
    // peak marker
    if (sim.peak.bac > 0) {
      ctx.beginPath(); ctx.arc(x(sim.peak.t), y(sim.peak.bac), 3.5, 0, Math.PI * 2); ctx.fillStyle = cLine; ctx.fill();
    }
    // now line + dot + label
    if (now >= start && now <= end) {
      var nx = x(now);
      ctx.strokeStyle = cMuted; ctx.globalAlpha = 0.6; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(nx, pad.t); ctx.lineTo(nx, pad.t + ph); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(nx, y(nowBac), 9, 0, Math.PI * 2); ctx.fillStyle = cLine + '33'; ctx.fill();
      ctx.beginPath(); ctx.arc(nx, y(nowBac), 5, 0, Math.PI * 2); ctx.fillStyle = cLine; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = cCard; ctx.stroke();
      ctx.font = '600 11px ' + FONT;
      var label = 'now', lw = ctx.measureText(label).width + 14, lx = Math.min(Math.max(nx - lw / 2, pad.l), W - pad.r - lw);
      roundRect(ctx, lx, pad.t - 14, lw, 18, 9); ctx.fillStyle = cText; ctx.fill();
      ctx.fillStyle = cCard; ctx.textAlign = 'center'; ctx.fillText(label, lx + lw / 2, pad.t - 1);
    }
  }

  // ---------- hero ring ----------
  var GUIDE = 4, RING_MAX = 8, lastTotal = null;
  function renderRing(total) {
    var frac = Math.min(total / RING_MAX, 1), over = total > GUIDE;
    var fill = $('ringFill');
    fill.style.strokeDasharray = (frac > 0 ? Math.max(frac * 100, 1.5) : 0) + ' 100';
    fill.classList.toggle('over', over); fill.classList.toggle('empty', frac <= 0);
    // marker at the daily-guideline position on the ring
    var ang = (GUIDE / RING_MAX) * Math.PI * 2;
    $('ringTick').setAttribute('cx', (100 + 84 * Math.cos(ang)).toFixed(2));
    $('ringTick').setAttribute('cy', (100 + 84 * Math.sin(ang)).toFixed(2));
    var note = $('ringNote');
    note.classList.toggle('over', over);
    note.textContent = over ? 'Over the 4-a-day guideline'
      : total > 0 ? round(GUIDE - total, 1) + ' under the 4-a-day guideline' : 'Guideline: max 4 a day';
    if (lastTotal !== null && total !== lastTotal) {
      var n = $('totalStd'); n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop');
    }
    lastTotal = total;
  }

  function render() {
    var d = state.current.drinks;
    var total = round(totalStd(d), 1);
    $('totalStd').textContent = total.toFixed(1);
    renderRing(total);
    $('nightLabel').textContent = d.length ? 'Night started ' + fmtDate(d[0].time) + ', ' + fmtTime(d[0].time) : 'No drinks yet tonight';
    renderLog(); renderHistory(); renderBac();
  }

  // ---------- theme ----------
  var THEME_KEY = 'drinkTracker.theme', MODES = ['auto', 'light', 'dark'];
  function getTheme() {
    try { var t = localStorage.getItem(THEME_KEY); return MODES.indexOf(t) >= 0 ? t : 'auto'; } catch (e) { return 'auto'; }
  }
  function applyTheme(mode) {
    if (mode === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = mode;
    var btn = $('themeBtn'), label = 'Theme: ' + mode;
    btn.dataset.mode = mode; btn.setAttribute('aria-label', label); btn.title = label;
    renderBac();
  }
  $('themeBtn').addEventListener('click', function () {
    var next = MODES[(MODES.indexOf(getTheme()) + 1) % MODES.length];
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* storage unavailable */ }
    applyTheme(next);
  });
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', renderBac); else if (mq.addListener) mq.addListener(renderBac);
  }

  // Keyboard support for the photo button (a <label> for the visually hidden file input).
  $('photoBtn').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('photoInput').click(); }
  });

  // ---------- settings ----------
  $('settingsBtn').addEventListener('click', function () {
    $('sWeight').value = state.settings.weightKg; $('sSex').value = state.settings.sex;
    $('settingsDlg').showModal();
  });
  $('settingsDlg').addEventListener('close', function () {
    if ($('settingsDlg').returnValue !== 'save') return;
    var w = parseFloat($('sWeight').value);
    if (w >= 30 && w <= 300) state.settings.weightKg = w;
    state.settings.sex = $('sSex').value === 'female' ? 'female' : 'male';
    save(); render();
  });
  $('clearAllBtn').addEventListener('click', function () {
    if (!confirm('Delete all drinks, history and settings from this device?')) return;
    state = defaultState(); save(); $('settingsDlg').close(); render();
  });

  window.addEventListener('resize', renderBac);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(renderBac);
  applyTheme(getTheme());
  setInterval(render, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); });
  render();
})();
