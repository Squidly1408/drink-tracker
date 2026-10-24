(function () {
  'use strict';
  var P = window.DrinkParse;
  var TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  var STORE_KEY = 'drinkTracker.v1';

  // Typical Australian serves. Beer ABV defaults to full-strength lager (~4.8%).
  var PRESETS = [
    { name: 'Pot / middy', vol: 285, abv: 4.8 },
    { name: 'Schooner', vol: 425, abv: 4.8 },
    { name: 'Pint', vol: 570, abv: 4.8 },
    { name: 'Can / stubby', vol: 375, abv: 4.8 },
    { name: 'Mid schooner', vol: 425, abv: 3.5 },
    { name: 'Wine glass', vol: 150, abv: 13 },
    { name: 'Large wine', vol: 250, abv: 13 },
    { name: 'Sparkling', vol: 150, abv: 11.5 },
    { name: 'Shot / nip', vol: 30, abv: 40 },
    { name: 'Double spirit', vol: 60, abv: 40 },
    { name: 'RTD can', vol: 375, abv: 5 },
    { name: 'Cider', vol: 375, abv: 5 }
  ];

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
    b.innerHTML = '<b>' + esc(p.name) + '</b><small>' + p.vol + ' mL &middot; ' + p.abv + '% &middot; ' +
      round(P.standardsFrom(p.vol, p.abv), 1) + ' std</small>';
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
  function renderBac() {
    var drinks = state.current.drinks, now = Date.now(), s = state.settings;
    var opts = { weightKg: s.weightKg, sex: s.sex };
    var canvas = $('chart'), dpr = window.devicePixelRatio || 1;
    var W = canvas.clientWidth || 300, H = 200;
    canvas.width = W * dpr; canvas.height = H * dpr;
    var ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    var css = getComputedStyle(document.documentElement);
    var cGrid = css.getPropertyValue('--grid').trim(), cMuted = css.getPropertyValue('--muted').trim(), cLine = css.getPropertyValue('--chart').trim();
    ctx.font = '11px system-ui, sans-serif';

    if (!drinks.length) {
      $('bacNow').textContent = '0.000'; $('zeroAt').textContent = '–'; $('peakInfo').textContent = '';
      ctx.fillStyle = cMuted; ctx.textAlign = 'center';
      ctx.fillText('Log a drink to see the estimated curve', W / 2, H / 2); return;
    }
    var start = drinks[0].time - 15 * 60000;
    var zero = P.timeToZero(drinks, opts, now);
    var end = Math.max(now, zero || 0, drinks[drinks.length - 1].time + 60 * 60000) + 30 * 60000;
    var sim = P.simulateBac(drinks, opts, start, end, 2);
    var nowPt = sim.points.reduce(function (best, p) { return Math.abs(p.t - now) < Math.abs(best.t - now) ? p : best; }, sim.points[0]);
    $('bacNow').textContent = (now < start ? 0 : nowPt.bac).toFixed(3);
    $('zeroAt').textContent = zero ? fmtTime(zero) : 'now';
    $('peakInfo').textContent = 'Est. peak ' + sim.peak.bac.toFixed(3) + ' g/100mL around ' + fmtTime(sim.peak.t) +
      '. Assumes ' + s.weightKg + ' kg, ' + s.sex + ', ~45 min absorption, elimination 0.015/h.';

    var pad = { l: 40, r: 10, t: 10, b: 24 }, pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    var yMax = Math.max(0.04, Math.ceil(sim.peak.bac * 1.2 * 100) / 100);
    var x = function (t) { return pad.l + (t - start) / (end - start) * pw; };
    var y = function (b) { return pad.t + ph - b / yMax * ph; };

    ctx.strokeStyle = cGrid; ctx.fillStyle = cMuted; ctx.lineWidth = 1; ctx.textAlign = 'right';
    var yStep = yMax <= 0.06 ? 0.01 : yMax <= 0.15 ? 0.02 : 0.05;
    for (var b = 0; b <= yMax + 1e-9; b += yStep) {
      ctx.beginPath(); ctx.moveTo(pad.l, y(b)); ctx.lineTo(W - pad.r, y(b)); ctx.stroke();
      ctx.fillText(b.toFixed(2), pad.l - 6, y(b) + 4);
    }
    ctx.textAlign = 'center';
    var hourMs = 3600000, hrStep = (end - start) > 8 * hourMs ? 2 : 1;
    var firstHr = new Date(start); firstHr.setMinutes(0, 0, 0);
    for (var t = firstHr.getTime() + hourMs; t < end; t += hourMs * hrStep) {
      ctx.fillText(new Date(t).toLocaleTimeString('en-AU', { hour: 'numeric' }), x(t), H - 6);
    }
    // area + line
    ctx.beginPath(); ctx.moveTo(x(start), y(0));
    sim.points.forEach(function (p) { ctx.lineTo(x(p.t), y(p.bac)); });
    ctx.lineTo(x(end), y(0)); ctx.closePath();
    ctx.globalAlpha = 0.15; ctx.fillStyle = cLine; ctx.fill(); ctx.globalAlpha = 1;
    ctx.beginPath();
    sim.points.forEach(function (p, i) { i ? ctx.lineTo(x(p.t), y(p.bac)) : ctx.moveTo(x(p.t), y(p.bac)); });
    ctx.strokeStyle = cLine; ctx.lineWidth = 2; ctx.stroke();
    // drink markers
    ctx.fillStyle = cLine;
    drinks.forEach(function (d) { ctx.beginPath(); ctx.arc(x(d.time), y(0), 3, 0, Math.PI * 2); ctx.fill(); });
    // now line
    ctx.strokeStyle = cMuted; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x(now), pad.t); ctx.lineTo(x(now), pad.t + ph); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = cMuted; ctx.fillText('now', Math.min(x(now), W - 20), pad.t + 10);
  }

  function render() {
    var d = state.current.drinks;
    $('totalStd').textContent = round(totalStd(d), 1).toFixed(1);
    $('nightLabel').textContent = d.length ? 'Night started ' + fmtDate(d[0].time) + ', ' + fmtTime(d[0].time) : 'No drinks yet tonight';
    renderLog(); renderHistory(); renderBac();
  }

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
  setInterval(render, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); });
  render();
})();
