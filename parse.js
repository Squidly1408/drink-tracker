/* Label text parsing + alcohol maths. Works in the browser (window.DrinkParse) and Node (module.exports). */
(function (root) {
  'use strict';

  var ETHANOL_DENSITY = 0.789; // g/mL
  var GRAMS_PER_STANDARD = 10; // Australian standard drink

  /** Standard drinks from volume (mL) and ABV (%): L x ABV x 0.789 */
  function standardsFrom(volumeMl, abv) {
    if (!(volumeMl > 0) || !(abv > 0)) return 0;
    return (volumeMl / 1000) * abv * ETHANOL_DENSITY;
  }

  /** Grams of pure alcohol for a number of standard drinks. */
  function gramsFromStandards(std) { return std * GRAMS_PER_STANDARD; }

  function num(s) { return parseFloat(String(s).replace(',', '.')); }

  /** Clean common OCR confusions before matching. */
  function normalise(text) {
    return String(text || '')
      .replace(/\r/g, '\n')
      .replace(/[°º]\s*\/\s*[oO0]/g, '%')   // "°/o" read for %
      .replace(/(\d)\s*[oO](?=\s*(?:vol|alc|abv)\b)/gi, '$1%') // "4.5o vol"
      .replace(/(\d)\s*%\s*[oO]\b/g, '$1%')
      .replace(/(\d)[oO](?=[.,]?\d)/g, '$10')          // "1o0" -> "100"
      .replace(/(\d)\s*[,.]\s+(\d)/g, '$1.$2')         // "4. 5" -> "4.5"
      .replace(/\bm\s*[lI1|]\b/gi, 'ml')               // "m l", "mI", "m1"
      .replace(/(\d)\s*[mM][lLI1|]\b/g, '$1ml')
      .replace(/[ \t]+/g, ' ');
  }

  /** Detect "1.4 STANDARD DRINKS" style declarations. Returns number or null. */
  function findStandardDrinks(text) {
    var t = normalise(text);
    var word = '(?:standard|stand[a-z]*|std\\.?|stnd\\.?|stds?)\\s*\\.?\\s*dr[i1l]nk\\s*s?';
    var patterns = [
      new RegExp('(\\d{1,2}(?:[.,]\\d{1,2})?)\\s*(?:approx\\.?\\s*)?' + word, 'i'),
      new RegExp(word + '\\s*[:\\-]?\\s*(?:approx\\.?\\s*)?(\\d{1,2}(?:[.,]\\d{1,2})?)', 'i')
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = t.match(patterns[i]);
      if (m) {
        var v = num(m[1]);
        if (v > 0 && v <= 60) return Math.round(v * 100) / 100;
      }
    }
    return null;
  }

  /** Find ABV %. Prefers percentages with alc/vol/abv context. */
  function findAbv(text) {
    var t = normalise(text);
    var cands = [];
    var re = /(\d{1,2}(?:[.,]\d{1,2})?)\s*%/g, m;
    while ((m = re.exec(t))) {
      var v = num(m[1]);
      if (!(v > 0 && v <= 80)) continue;
      var ctx = t.slice(Math.max(0, m.index - 25), m.index + m[0].length + 25).toLowerCase();
      var score = 1;
      if (/alc|abv|vol|alcohol/.test(ctx)) score += 5;
      if (/juice|fruit|sugar|less|reduced|off|fat|natural|real|recycl|protein|daily/.test(ctx)) score -= 4;
      if (v === 100) score -= 5;
      cands.push({ v: v, score: score, i: m.index });
    }
    // "ABV 5.2" / "ALC 13.5 VOL" without a % sign
    var re2 = /\b(?:abv|alc\.?)\s*[:.]?\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:%|vol|by)?/gi;
    while ((m = re2.exec(t))) {
      var v2 = num(m[1]);
      if (v2 > 0 && v2 <= 80) cands.push({ v: v2, score: 4, i: m.index });
    }
    if (!cands.length) return null;
    cands.sort(function (a, b) { return b.score - a.score || a.i - b.i; });
    return cands[0].score > 0 ? cands[0].v : null;
  }

  var COMMON_SIZES = [200, 250, 275, 285, 330, 340, 355, 375, 425, 440, 500, 568, 700, 750, 1000, 1500, 2000, 3000, 4000];

  /** Find container volume in mL. Handles ml, cl, l/litre; ignores multipack counts. */
  function findVolume(text) {
    var t = normalise(text);
    var cands = [];
    var re = /(\d{1,4}(?:[.,]\d{1,3})?)\s*(ml|cl|litres?|liters?|ltr|lt|l)\b/gi, m;
    while ((m = re.exec(t))) {
      var v = num(m[1]);
      var unit = m[2].toLowerCase();
      if (unit === 'cl') v *= 10;
      else if (unit !== 'ml') v *= 1000;
      if (!(v >= 20 && v <= 6000)) continue;
      var score = 1;
      if (COMMON_SIZES.some(function (s) { return Math.abs(s - v) < 1; })) score += 3;
      var before = t.slice(Math.max(0, m.index - 12), m.index).toLowerCase();
      if (/\d\s*[x×]\s*$/.test(before)) score += 1; // "24 x 375ml": per-unit size
      var ctx = t.slice(Math.max(0, m.index - 20), m.index + m[0].length + 20).toLowerCase();
      if (/per|serve|serving|average|nutrition|100\s*ml/.test(ctx)) score -= 3;
      cands.push({ v: Math.round(v), score: score, i: m.index });
    }
    if (!cands.length) return null;
    cands.sort(function (a, b) { return b.score - a.score || a.i - b.i; });
    return cands[0].v;
  }

  var NOISE = /(alc|vol|standard|drink|ml\b|\d\s*%|warning|pregnan|contains|ingredient|brewed|product of|made in|australia|www\.|\.com|recycl|refund|cents|\bvic\b|\bnsw\b|\bsa\b|best before|made with|\bwith\b|serve|chilled|nutrition|energy|sugar|preservative|sulphite)/i;

  /** Guess a drink name: the most prominent-looking short line of letters. */
  function findName(text) {
    var lines = String(text || '').split(/\n+/).map(function (l) {
      return l.replace(/[^A-Za-z0-9&' \-]/g, ' ').replace(/\s+/g, ' ').trim();
    });
    var best = null, bestScore = -Infinity;
    lines.forEach(function (l, idx) {
      if (l.length < 3 || l.length > 32) return;
      if (NOISE.test(l)) return;
      var letters = (l.match(/[A-Za-z]/g) || []).length;
      if (letters / l.length < 0.7) return;
      var words = l.split(' ');
      if (words.some(function (w) { return w.length > 1 && !/[aeiouyAEIOUY]/.test(w) && /[A-Za-z]{3,}/.test(w); })) return; // OCR junk
      var score = 0;
      if (l === l.toUpperCase()) score += 2;
      if (words.length >= 1 && words.length <= 4) score += 2;
      score -= idx * 0.3; // earlier lines tend to be the brand
      score += Math.min(letters, 14) / 7;
      if (/\d/.test(l)) score -= 1.5;
      if (score > bestScore) { bestScore = score; best = l; }
    });
    if (!best) return null;
    return best.toLowerCase().replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });
  }

  /** Parse full label text. standardsSource: 'label' | 'calculated' | null */
  function parseLabel(text) {
    var abv = findAbv(text);
    var volumeMl = findVolume(text);
    var labelStd = findStandardDrinks(text);
    var calcStd = (abv && volumeMl) ? standardsFrom(volumeMl, abv) : null;
    var standards = labelStd != null ? labelStd : (calcStd != null ? Math.round(calcStd * 100) / 100 : null);
    return {
      name: findName(text),
      abv: abv,
      volumeMl: volumeMl,
      standards: standards,
      standardsSource: labelStd != null ? 'label' : (calcStd != null ? 'calculated' : null),
      calculatedStandards: calcStd != null ? Math.round(calcStd * 100) / 100 : null
    };
  }

  /**
   * Widmark-style BAC simulation. drinks: [{time(ms), standards}]
   * opts: {weightKg, sex:'male'|'female', absorbMin=45, beta=0.015 (g/100mL per hour)}
   * Returns {points:[{t, bac}], peak, zeroAt (ms or null)}. BAC in g/100mL (AU convention, e.g. 0.05).
   */
  function simulateBac(drinks, opts, fromMs, toMs, stepMin) {
    var r = opts.sex === 'female' ? 0.55 : 0.68;
    var W = Math.max(30, opts.weightKg || 75) * 1000; // grams
    var beta = opts.beta || 0.015;
    var absorbMs = (opts.absorbMin || 45) * 60000;
    var step = (stepMin || 2) * 60000;
    var elimPerStep = (beta / 100) * r * W * (step / 3600000); // grams eliminated per step
    var body = 0, pts = [], peak = { t: fromMs, bac: 0 };
    for (var t = fromMs; t <= toMs; t += step) {
      drinks.forEach(function (d) {
        var g = gramsFromStandards(d.standards);
        // linear absorption over absorbMs: fraction absorbed in (t-step, t]
        var a0 = Math.min(1, Math.max(0, (t - step - d.time) / absorbMs));
        var a1 = Math.min(1, Math.max(0, (t - d.time) / absorbMs));
        body += g * (a1 - a0);
      });
      body = Math.max(0, body - elimPerStep);
      var bac = body / (r * W) * 100;
      pts.push({ t: t, bac: bac });
      if (bac > peak.bac) peak = { t: t, bac: bac };
    }
    return { points: pts, peak: peak };
  }

  /** Time (ms epoch) BAC reaches ~zero, starting at nowMs. null if already zero. */
  function timeToZero(drinks, opts, nowMs) {
    if (!drinks.length) return null;
    var start = Math.min.apply(null, drinks.map(function (d) { return d.time; }));
    var sim = simulateBac(drinks, opts, start, nowMs + 48 * 3600000, 2);
    var lastPositive = null;
    for (var i = 0; i < sim.points.length; i++) if (sim.points[i].bac > 0.0005) lastPositive = sim.points[i].t;
    if (lastPositive == null || lastPositive < nowMs) return null;
    return lastPositive;
  }

  var api = {
    standardsFrom: standardsFrom, gramsFromStandards: gramsFromStandards,
    normalise: normalise, findStandardDrinks: findStandardDrinks, findAbv: findAbv,
    findVolume: findVolume, findName: findName, parseLabel: parseLabel,
    simulateBac: simulateBac, timeToZero: timeToZero
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DrinkParse = api;
})(typeof window !== 'undefined' ? window : this);
