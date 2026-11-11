/** C-01 owns dot counts; C-02 checks whether the confidence indicators are distinguishable. */
export function confidenceDistinction(zero, unscored) {
  if (!zero?.confidenceAppearance || !unscored?.confidenceAppearance) {
    return { status: 'INFO', detail: 'zero-score and unscored confidence indicators are required for this check' };
  }
  const distinct = zero.confidenceAppearance !== unscored.confidenceAppearance;
  return {
    status: distinct ? 'PASS' : 'FAIL',
    detail: distinct
      ? 'confidence indicators differ in styling, text or accessible label'
      : `confidence indicators have identical styling, text and accessible labels (${zero.filled} filled dots)`,
  };
}
