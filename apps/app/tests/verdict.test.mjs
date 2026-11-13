import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, sortedEngines } from '../src/lib/verdict.ts';
const analysis = (stats, results = {}) => ({ data: { attributes: { status: 'completed', stats, results } } });
test('undetected con harmless cero es limpio', () => {
  assert.equal(classify(analysis({ harmless: 0, malicious: 0, suspicious: 0, undetected: 68 })), 'clean');
});
test('sin respuestas es indeterminado; amenaza tiene prioridad sobre sospechoso', () => {
  assert.equal(classify(analysis({ harmless: 0, malicious: 0, suspicious: 0, undetected: 0 })), 'unknown');
  assert.equal(classify(analysis({ harmless: 0, malicious: 1, suspicious: 2, undetected: 65 })), 'threat');
  assert.equal(classify(analysis({ harmless: 0, malicious: 0, suspicious: 1, undetected: 67 })), 'suspicious');
});
test('motores detectores primero, fallos al final, sin perder motores', () => {
  const results = Object.fromEntries(['failure', 'undetected', 'suspicious', 'harmless', 'malicious', 'type-unsupported', 'timeout'].map(category => [category, { category, result: null }]));
  assert.deepEqual(sortedEngines(analysis(undefined, results)).map(e => e.category), ['malicious', 'suspicious', 'undetected', 'harmless', 'failure', 'type-unsupported', 'timeout']);
});
