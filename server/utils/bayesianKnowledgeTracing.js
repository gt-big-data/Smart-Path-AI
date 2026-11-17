"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateBayesianConfidence = void 0;
const INITIAL_MASTERY = 0.2;
const LEARNING_PROBABILITY = 0.1;
const GUESS_PROBABILITY = 0.2;
const SLIP_PROBABILITY = 0.1;
const calculateBayesianConfidence = (previousConfidence = INITIAL_MASTERY, isCorrect) => {
    const mastery = Math.max(0, Math.min(1, previousConfidence));
    let posterior;
    if (isCorrect) {
        posterior =
            (mastery * (1 - SLIP_PROBABILITY)) /
                (mastery * (1 - SLIP_PROBABILITY) +
                    (1 - mastery) * GUESS_PROBABILITY);
    }
    else {
        posterior =
            (mastery * SLIP_PROBABILITY) /
                (mastery * SLIP_PROBABILITY +
                    (1 - mastery) * (1 - GUESS_PROBABILITY));
    }
    return posterior + (1 - posterior) * LEARNING_PROBABILITY;
};
exports.calculateBayesianConfidence = calculateBayesianConfidence;
