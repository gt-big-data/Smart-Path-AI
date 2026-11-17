import type { Question } from './quizState';

// The AI server isn't consistent about the concept id field name
export type RawPair = {
  question?: string;
  answer?: string;
  conceptId?: string;
  concept_id?: string;
  topicId?: string;
  topic_id?: string;
  id?: string;
  conceptName?: string;
  explanation?: string;
  format?: string;
};

/** Splits a question into its prompt and lettered (or True/False) choices */
export function splitQuestion(question: Question) {
  const lines = question.question.split('\n');
  const choices = lines.map(line => line.trim()).filter(line => /^[A-D][).]\s*\S/.test(line));
  if (choices.length >= 2) return { prompt: lines.filter(line => !choices.includes(line.trim())).join('\n').trim(), choices };
  const inline = [...question.question.matchAll(/(?:^|\s)([A-D][).]\s*.*?)(?=\s+[A-D][).]\s*|$)/g)].map(match => match[1].trim());
  if (inline.length >= 2) return { prompt: question.question.slice(0, question.question.indexOf(inline[0])).trim(), choices: inline };
  if (question.format === 'tf' || /^true or false:/i.test(question.question)) {
    return { prompt: question.question, choices: ['True', 'False'] };
  }
  return { prompt: question.question, choices: [] };
}

/** "B) Mitochondria" -> "B", anything else is returned unchanged */
export const choiceLetter = (answer: string) => answer.match(/^([A-D])[).]/)?.[1] ?? answer;

/** Chat message sent when a student asks the Study Assistant about a quiz question */
export const buildAskAssistantPrompt = (question: string) =>
  `I'm taking a quiz and don't understand this question: “${question}” Can you explain the underlying concept without giving away the answer?`;

/** Full text of the correct choice when the stored answer is only a letter */
export function displayAnswer(question: Question) {
  const letter = question.answer.trim().match(/^[A-D]$/i)?.[0].toUpperCase();
  return letter ? splitQuestion(question).choices.find(choice => choice.startsWith(`${letter})`) || choice.startsWith(`${letter}.`)) || question.answer : question.answer;
}
