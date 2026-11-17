
const INITIAL_MASTERY = 0.2;
const LEARNING_PROBABILITY = 0.1;
const GUESS_PROBABILITY = 0.2;
const SLIP_PROBABILITY = 0.1;

export const calculateBayesianConfidence = (
  previousConfidence: number = INITIAL_MASTERY,
  isCorrect: boolean
): number => {
  const mastery = Math.max(0, Math.min(1, previousConfidence));

  let posterior: number;

  if (isCorrect) {
    posterior =
      (mastery * (1 - SLIP_PROBABILITY)) /
      (mastery * (1 - SLIP_PROBABILITY) +
        (1 - mastery) * GUESS_PROBABILITY);
  } else {
    posterior =
      (mastery * SLIP_PROBABILITY) /
      (mastery * SLIP_PROBABILITY +
        (1 - mastery) * (1 - GUESS_PROBABILITY));
  }

  return posterior + (1 - posterior) * LEARNING_PROBABILITY;
};
