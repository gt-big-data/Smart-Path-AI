// Run with: node --test server/tests
const test = require('node:test');
const assert = require('node:assert');
const { exactChoiceVerdict } = require('../controllers/graphController.js');

test('multiple choice is graded by letter', () => {
  assert.strictEqual(exactChoiceVerdict('A) ATP', 'A'), true);
  assert.strictEqual(exactChoiceVerdict('B) Glucose', 'A'), false);
  assert.strictEqual(exactChoiceVerdict('b', 'B'), true);
  // A word that merely starts with A is not choice A
  assert.strictEqual(exactChoiceVerdict('About energy', 'A'), false);
  assert.strictEqual(exactChoiceVerdict('SKIPPED', 'A'), false);
});

test('true/false accepts T/F and True/False in any case', () => {
  assert.strictEqual(exactChoiceVerdict('True', 'True'), true);
  assert.strictEqual(exactChoiceVerdict('false', 'T'), false);
  assert.strictEqual(exactChoiceVerdict('F', 'False'), true);
});

test('open-ended answers are left to the LLM', () => {
  assert.strictEqual(exactChoiceVerdict('Plants make glucose from light', 'Photosynthesis converts light to glucose'), null);
});
