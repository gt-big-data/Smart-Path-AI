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
