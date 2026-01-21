import assert from 'assert';
import { parseRequestedKeys, matchPhysicalFindings } from './services/physFinder';

function testParse() {
  const r1 = parseRequestedKeys('hr, rr, temp');
  assert.deepStrictEqual(r1.canonical, ['heart_rate', 'respiratory_rate', 'temperature']);

  const r2 = parseRequestedKeys('pulse and temp');
  assert.deepStrictEqual(r2.canonical, ['heart_rate', 'temperature']);

  const r3 = parseRequestedKeys('hr rr temp');
  assert.deepStrictEqual(r3.canonical, ['heart_rate', 'respiratory_rate', 'temperature']);
  // group token tests
  const g1 = parseRequestedKeys('vitals');
  const expectedGroup = ['heart_rate','respiratory_rate','temperature','blood_pressure'];
  assert.deepStrictEqual(g1.canonical.sort(), expectedGroup.sort());
}

function testMatch() {
  const SAMPLE = `Heart rate: 88 bpm\nRespiratory rate: 20/min\nTemperature: 38 C\nMucous membranes: pink`;
  const req = parseRequestedKeys('hr, rr');
  const res = matchPhysicalFindings(req, SAMPLE);
  const keys = res.map(r => r.canonicalKey);
  assert.deepStrictEqual(keys, ['heart_rate', 'respiratory_rate']);
  if (!(res[0].lines.length > 0)) throw new Error('heart_rate lines missing');
  if (!(res[1].lines.length > 0)) throw new Error('respiratory_rate lines missing');
}

function run() {
  try {
    testParse();
    testMatch();
    console.log('All physFinder tests passed');
    process.exit(0);
  } catch (e) {
    console.error('PhysFinder tests failed:', e);
    process.exit(2);
  }
}

run();
