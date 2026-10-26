const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateExam, publicExam, validateAnswers, validateGrading } = require('../services/practiceExamContract');
const exam = {
  schema_version: 2, title: 'Chemistry', instructions: null, time_limit_minutes: 30, total_points: 5,
  sections: [{ name: 'Calculations', instructions: null, questions: [{ id: 'q1', label: '1', stem: 'Shared scenario',
    concept_ids: ['topic-1'], parts: [
      { id: 'q1-a', label: 'a', type: 'numeric', prompt: 'Calculate moles', choices: null, answer: '2 mol',
        explanation: 'Mass divided by molar mass', rubric: 'Method 1 point, answer 1 point', points: 2, depends_on: [] },
      { id: 'q1-b', label: 'b', type: 'mcq', prompt: 'Choose concentration', choices: ['1 M','2 M','3 M','4 M'],
        answer: '2 M', explanation: 'Moles divided by volume', rubric: 'Exact option', points: 3, depends_on: ['q1-a'] },
    ] }] }],
};
test('public exam preserves ordered parts but excludes keys and rubrics', () => {
  validateExam(exam);
  const shown = publicExam(exam);
  assert.deepEqual(shown.sections[0].questions[0].parts.map(p => p.id), ['q1-a','q1-b']);
  for (const p of shown.sections[0].questions[0].parts) {
    assert.equal('answer' in p, false); assert.equal('explanation' in p, false); assert.equal('rubric' in p, false);
  }
});
test('rejects invented IDs, duplicate answers and client-supplied keys', () => {
  for (const answers of [
    [{ part_id: 'unknown', user_answer: 'x' }],
    [{ part_id: 'q1-a', user_answer: 'x' }, { part_id: 'q1-a', user_answer: 'y' }],
    [{ part_id: 'q1-a', user_answer: 'x', correct_answer: 'x' }],
  ]) assert.throws(() => validateAnswers(answers, exam));
  assert.deepEqual(validateAnswers([], exam), []);
});
test('rejects mismatched totals and invalid dependencies', () => {
  assert.throws(() => validateExam({ ...exam, total_points: 100 }));
  const invalid = structuredClone(exam);
  invalid.sections[0].questions[0].parts[0].depends_on = ['q1-b'];
  assert.throws(() => validateExam(invalid));
});
test('grading uses saved solutions and bounds partial credit', () => {
  const response = { score: 4, total: 5, results: [
    { part_id: 'q1-a', points_earned: 1, points_possible: 2, feedback: 'Method correct', correct_answer: 'bad echo' },
    { part_id: 'q1-b', points_earned: 3, points_possible: 3, feedback: 'Correct' },
  ] };
  const grading = validateGrading(response, exam);
  assert.equal(grading.results[0].correct_answer, '2 mol');
  assert.equal(grading.results[0].isCorrect, false);
  assert.throws(() => validateGrading({ ...response, score: 100 }, exam));
  assert.throws(() => validateGrading({ ...response, results: response.results.slice(0, 1) }, exam));
});
test('failed diagram questions survive projection and do not affect answers or totals', () => {
  const partial = structuredClone(exam);
  const failed = { id: 'q2', label: '2', stem: '', concept_ids: [], parts: [], error: 'Required diagram missing' };
  partial.sections[0].questions.push(failed);
  validateExam(partial);
  assert.deepEqual(publicExam(partial).sections[0].questions[1], failed);
  assert.throws(() => validateAnswers([{ part_id: 'q2-p1', user_answer: 'x' }], partial));
  assert.throws(() => validateExam({ ...partial, total_points: 10 }));
  const invalid = structuredClone(partial);
  invalid.sections[0].questions[1].parts = [exam.sections[0].questions[0].parts[0]];
  assert.throws(() => validateExam(invalid));
  const allFailed = { ...partial, total_points: 0, sections: [{ name: 'Diagrams', questions: [failed] }] };
  validateExam(allFailed);
  assert.deepEqual(validateGrading({ score: 0, total: 0, results: [] }, allFailed).results, []);
});
test('grouped binary and select-all items retain their controls and validate selections', () => {
  const value = structuredClone(exam);
  const parts = value.sections[0].questions[0].parts;
  Object.assign(parts[0], { type: 'binary', group_label: '(a)', group_instructions: 'Possible or impossible?',
    choices: ['Possible', 'Impossible'], answer: 'Possible' });
  Object.assign(parts[1], { type: 'multi_select', answer: '["1 M","3 M"]' });
  validateExam(value);
  const shown = publicExam(value).sections[0].questions[0].parts;
  assert.equal(shown[0].group_label, '(a)');
  assert.deepEqual(shown[0].choices, ['Possible', 'Impossible']);
  assert.equal(shown[1].type, 'multi_select');
  assert.equal('answer' in shown[1], false);
  assert.doesNotThrow(() => validateAnswers([{ part_id: 'q1-b', user_answer: '["3 M","1 M"]' }], value));
  for (const user_answer of ['not json', '["bad"]', '["1 M","1 M"]']) {
    assert.throws(() => validateAnswers([{ part_id: 'q1-b', user_answer }], value));
  }
  parts[1].answer = '["not a choice"]';
  assert.throws(() => validateExam(value));
});


test('unverified questions stay visible but cannot be answered or scored', () => {
  const value = structuredClone(exam);
  value.sections[0].questions[0].error = 'Could not verify; may contain errors';
  value.total_points = 0;
  validateExam(value);
  const shown = publicExam(value).sections[0].questions[0];
  assert.equal(shown.parts.length, 2);
  assert.equal(shown.parts[0].prompt, 'Calculate moles');
  assert.equal('answer' in shown.parts[0], false);
  assert.throws(() => validateAnswers([{ part_id: 'q1-a', user_answer: '2 mol' }], value));
  assert.deepEqual(validateGrading({ score: 0, total: 0, results: [] }, value).results, []);
  assert.throws(() => validateExam({ ...value, total_points: 5 }));
});
