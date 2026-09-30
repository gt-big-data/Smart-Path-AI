/** Versioned AI/Express contract. Answer keys never belong in pre-submission responses. */
export interface ExamPart {
  id: string; label: string; type: 'mcq' | 'tf' | 'short_answer' | 'long_answer' | 'numeric';
  prompt: string; choices: string[] | null; answer: string; explanation: string; rubric: string;
  points: number; depends_on: string[];
}
export interface ExamQuestion {
  id: string; label: string; stem: string; concept_ids: string[]; parts: ExamPart[];
}
export interface ExamSection { name: string; instructions: string | null; questions: ExamQuestion[] }
export interface ExamDefinition {
  schema_version: 2; title: string; instructions: string | null; time_limit_minutes: number | null;
  total_points: number; sections: ExamSection[];
}
export interface Answer { part_id: string; user_answer: string }
export interface GradeResult {
  part_id: string; points_earned: number; points_possible: number; isCorrect: boolean;
  feedback: string; correct_answer: string; explanation: string;
}
export interface Grading { score: number; total: number; results: GradeResult[] }

export function examParts(exam: ExamDefinition): ExamPart[] {
  return exam.sections.flatMap(s => s.questions.flatMap(q => q.parts));
}

export function validateExam(value: unknown): asserts value is ExamDefinition {
  const exam = value as ExamDefinition;
  const fail = () => { throw new Error('AI service returned an invalid exam'); };
  if (!exam || exam.schema_version !== 2 || typeof exam.title !== 'string' || !exam.title.trim()
      || !Array.isArray(exam.sections) || !exam.sections.length || exam.sections.length > 40) return fail();
  const seen = new Set<string>();
  let questionCount = 0;
  let partCount = 0;
  let total = 0;
  const id = (value: unknown) => {
    if (typeof value !== 'string' || !value.trim() || value.length > 200 || seen.has(value)) return fail();
    seen.add(value);
  };
  for (const section of exam.sections) {
    if (typeof section.name !== 'string' || !Array.isArray(section.questions) || !section.questions.length) return fail();
    for (const question of section.questions) {
      id(question.id); questionCount++;
      if (typeof question.stem !== 'string' || typeof question.label !== 'string'
          || !Array.isArray(question.concept_ids) || !question.concept_ids.length
          || question.concept_ids.some(c => typeof c !== 'string' || !c)
          || !Array.isArray(question.parts) || !question.parts.length || question.parts.length > 20) return fail();
      const preceding = new Set<string>();
      for (const part of question.parts) {
        id(part.id); partCount++;
        if (!['mcq', 'tf', 'short_answer', 'long_answer', 'numeric'].includes(part.type)
            || typeof part.label !== 'string' || typeof part.prompt !== 'string' || !part.prompt.trim()
            || typeof part.answer !== 'string' || !part.answer.trim()
            || typeof part.explanation !== 'string' || !part.explanation.trim()
            || typeof part.rubric !== 'string' || !part.rubric.trim()
            || !Number.isFinite(part.points) || part.points <= 0 || part.points > 1000
            || !Array.isArray(part.depends_on) || part.depends_on.some(d => !preceding.has(d))) return fail();
        if (part.type === 'mcq') {
          if (!Array.isArray(part.choices) || part.choices.length !== 4 || new Set(part.choices).size !== 4
              || part.choices.some(c => typeof c !== 'string' || !c.trim()) || !part.choices.includes(part.answer)) return fail();
        } else if (part.choices !== null) return fail();
        if (part.type === 'tf' && !['True', 'False'].includes(part.answer)) return fail();
        preceding.add(part.id);
        total += part.points;
      }
    }
  }
  if (questionCount > 40 || partCount > 100 || !Number.isFinite(exam.total_points)
      || Math.abs(total - exam.total_points) > 0.001) return fail();
}

export function validateAnswers(value: unknown, exam: ExamDefinition): Answer[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('answers must be an array of at most 100 parts');
  const allowed = new Set(examParts(exam).map(p => p.id));
  const seen = new Set<string>();
  return value.map(answer => {
    if (!answer || typeof answer.part_id !== 'string' || !allowed.has(answer.part_id)
        || seen.has(answer.part_id) || typeof answer.user_answer !== 'string' || answer.user_answer.length > 20000
        || Object.keys(answer).some(k => !['part_id', 'user_answer'].includes(k))) {
      throw new Error('Each answer needs a unique valid part_id and user_answer of at most 20,000 characters');
    }
    seen.add(answer.part_id);
    return { part_id: answer.part_id, user_answer: answer.user_answer };
  });
}

export function publicExam(exam: ExamDefinition) {
  // Explicit projection also excludes the source blueprint, which can contain sample solutions.
  return {
    schema_version: exam.schema_version, title: exam.title, instructions: exam.instructions,
    time_limit_minutes: exam.time_limit_minutes, total_points: exam.total_points,
    sections: exam.sections.map(s => ({ name: s.name, instructions: s.instructions,
      questions: s.questions.map(q => ({ id: q.id, label: q.label, stem: q.stem, concept_ids: q.concept_ids,
        parts: q.parts.map(p => ({ id: p.id, label: p.label, type: p.type, prompt: p.prompt,
          choices: p.choices, points: p.points, depends_on: p.depends_on })) })) })),
  };
}

export function validateGrading(value: unknown, exam: ExamDefinition): Grading {
  const grade = value as Grading;
  const parts = examParts(exam);
  if (!grade || !Number.isFinite(grade.score) || !Number.isFinite(grade.total)
      || Math.abs(grade.total - exam.total_points) > 0.001 || !Array.isArray(grade.results)
      || grade.results.length !== parts.length) throw new Error('AI service returned invalid grading');
  let score = 0;
  const results = grade.results.map((r, i) => {
    const part = parts[i];
    if (r.part_id !== part.id || !Number.isFinite(r.points_earned)
        || r.points_earned < 0 || r.points_earned > part.points || r.points_possible !== part.points
        || typeof r.feedback !== 'string' || !r.feedback.trim()) throw new Error('AI service returned invalid grading');
    score += r.points_earned;
    // The stored key, rather than a model echo, supplies solutions.
    return { part_id: part.id, points_earned: r.points_earned, points_possible: part.points,
      isCorrect: r.points_earned === part.points, feedback: r.feedback,
      correct_answer: part.answer, explanation: part.explanation };
  });
  if (Math.abs(score - grade.score) > 0.001) throw new Error('AI service returned invalid grading total');
  return { score, total: exam.total_points, results };
}
