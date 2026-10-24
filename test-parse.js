// Run: node test-parse.js
const P = require('./parse.js');
let fail = 0;
function check(label, got, want) {
  const ok = want === null ? got === null : Math.abs(got - want) < 0.051;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: got ${got}, want ${want}`);
}

const samples = [
  { text: 'GREAT NORTHERN\nORIGINAL LAGER\n4.2% ALC/VOL\n375mL\nCONTAINS APPROX 1.2 STANDARD DRINKS', abv: 4.2, vol: 375, std: 1.2, src: 'label' },
  { text: 'VICTORIA BITTER\nALC. 4.9% VOL\n375 ML\n1.4 STANDARD DRINKS', abv: 4.9, vol: 375, std: 1.4, src: 'label' },
  { text: 'Shiraz 2021\nBarossa Valley\n14.5% vol 750mL\nThis wine contains 8.6 standard drinks', abv: 14.5, vol: 750, std: 8.6, src: 'label' },
  { text: 'CORONA EXTRA\n4.5% alc/vol\n355ml', abv: 4.5, vol: 355, std: 1.26, src: 'calculated' },
  { text: 'Vodka\n40% ALC/VOL 700 mL\n22 STD DRINKS', abv: 40, vol: 700, std: 22, src: 'label' },
  { text: 'GIN 37.5% vol 70cl', abv: 37.5, vol: 700, std: 20.71, src: 'calculated' },
  { text: 'Cider made with 100% real apples\nALC 5.0% VOL\n24 x 330mL\nApprox. 1.3 Standard Drinks', abv: 5.0, vol: 330, std: 1.3, src: 'label' },
  { text: 'PALE ALE 5.6°/o ALC/VOL 375mI 1.6 STANDARD DRlNKS', abv: 5.6, vol: 375, std: 1.6, src: 'label' },
  { text: 'Prosecco DOC 11% Vol 1.5L', abv: 11, vol: 1500, std: 13.02, src: 'calculated' },
  { text: 'STANDARD DRINKS: 2.1\nALC 6.5% VOL 400ml', abv: 6.5, vol: 400, std: 2.1, src: 'label' },
  { text: 'Juice 25% fruit 250ml', abv: null, vol: 250, std: null, src: null },
  { text: 'ABV 4.6 440mL tall can', abv: 4.6, vol: 440, std: 1.6, src: 'calculated' },
];

samples.forEach((s, i) => {
  const r = P.parseLabel(s.text);
  console.log(`\n#${i + 1} name=${JSON.stringify(r.name)} src=${r.standardsSource}`);
  check('abv', r.abv, s.abv);
  check('volume', r.volumeMl, s.vol);
  check('standards', r.standards, s.std);
  if (r.standardsSource !== s.src) { fail++; console.log(`FAIL  source: got ${r.standardsSource}, want ${s.src}`); }
});

console.log('\n-- maths --');
check('375mL @4.8% std', P.standardsFrom(375, 4.8), 1.42);
const now = Date.now();
const sim = P.simulateBac([{ time: now, standards: 2 }], { weightKg: 80, sex: 'male' }, now, now + 6 * 3600e3, 2);
// Peak for 20 g, 80 kg male ~ 20/(0.68*80000)*100 = 0.0368 minus elimination during absorption
check('peak BAC (2 std, 80kg M) ~0.03', Math.round(sim.peak.bac * 100) / 100, 0.03);
const z = P.timeToZero([{ time: now, standards: 2 }], { weightKg: 80, sex: 'male' }, now);
check('hours to zero ~2.45 (0.0368/0.015)', Math.round((z - now) / 360e3) / 10, 2.45);

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED');
process.exit(fail ? 1 : 0);
