// Run with: node --test qa/tests/*.mjs (no browser or Playwright installation needed).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { confidenceDistinction } from '../checklist-checks.mjs';

const appearance = (overrides = {}) => JSON.stringify({
  border: '1.5px solid white', backgroundColor: 'transparent', text: '', accessibleLabel: '', ...overrides,
});

test('zero-score styling can differ from unscored styling with both showing zero filled dots', () => {
  const zero = { filled: 0, confidenceAppearance: appearance({ border: '1.5px solid red' }) };
  const unscored = { filled: 0, confidenceAppearance: appearance() };
  assert.equal(confidenceDistinction(zero, unscored).status, 'PASS');
});

test('an accessible label can distinguish confidence states without changing dot counts', () => {
  const zero = { filled: 0, confidenceAppearance: appearance({ accessibleLabel: 'Confidence: 0%' }) };
  const unscored = { filled: 0, confidenceAppearance: appearance({ accessibleLabel: 'Not assessed' }) };
  assert.equal(confidenceDistinction(zero, unscored).status, 'PASS');
});

test('different graph node labels and colors do not disguise identical confidence indicators', () => {
  const zero = { filled: 0, label: 'Photosynthesis', background: 'green', confidenceAppearance: appearance() };
  const unscored = { filled: 0, label: 'Chlorophyll', background: 'blue', confidenceAppearance: appearance() };
  assert.equal(confidenceDistinction(zero, unscored).status, 'FAIL');
});

test('dot counts alone cannot override identical indicator snapshots', () => {
  assert.equal(confidenceDistinction(
    { filled: 1, confidenceAppearance: appearance() },
    { filled: 0, confidenceAppearance: appearance() },
  ).status, 'FAIL');
});

test('missing confidence indicators are reported as unexercised', () => {
  assert.equal(confidenceDistinction(undefined, { confidenceAppearance: appearance() }).status, 'INFO');
});

test('a caught fixture crash writes failure reports and exits nonzero', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-qa-exit-'));
  try {
    const qaRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    for (const file of ['run-checklist.mjs', 'checklist-checks.mjs']) {
      fs.copyFileSync(path.join(qaRoot, file), path.join(temp, file));
    }
    const mockPackage = path.join(temp, 'node_modules', 'playwright');
    fs.mkdirSync(mockPackage, { recursive: true });
    fs.writeFileSync(path.join(mockPackage, 'package.json'), JSON.stringify({ name: 'playwright', main: 'index.cjs' }));
    fs.writeFileSync(path.join(mockPackage, 'index.cjs'), `
      module.exports = { chromium: { launch: async () => ({
        newPage: async () => ({
          on() {}, route() {},
          async goto() { throw new Error('Simulated harness failure'); }
        }),
        async close() {}
      }) } };
    `);

    const run = spawnSync(process.execPath, [path.join(temp, 'run-checklist.mjs')], {
      cwd: temp, env: { ...process.env, FIXTURES: 'small' }, encoding: 'utf8', timeout: 10000,
    });
    assert.ifError(run.error);
    const report = JSON.parse(fs.readFileSync(path.join(temp, 'results', 'latest.json'), 'utf8'));
    assert.equal(report.results[0].id, 'RUNNER');
    assert.equal(report.results[0].status, 'FAIL');
    assert.match(report.results[0].detail, /Simulated harness failure/);
    assert.ok(fs.existsSync(path.join(temp, 'results', 'latest.md')));
    assert.equal(run.status, 1, run.stdout + run.stderr);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
