import { Request, Response } from 'express';
import { ownedQuizRun, quizRunView, completeQuizRun, QuizRunError } from '../services/quizRuns';

function route(complete: boolean) {
  return async (req: Request, res: Response) => {
    const user = (req.session as any)?.passport?.user;
    if (!user) return res.status(401).json({ error: 'Sign in to access quizzes' });
    const owner = String(typeof user === 'object' ? user._id : user);
    try {
      const quiz = complete ? await completeQuizRun(owner, req.params.id)
        : quizRunView(await ownedQuizRun(owner, req.params.id));
      return res.json({ quiz });
    } catch (error) {
      if (error instanceof QuizRunError) return res.status(error.status).json({ error: error.message });
      console.error('Quiz history request failed', error);
      return res.status(500).json({ error: 'Could not load or save the quiz. Please retry.' });
    }
  };
}
export const getQuizRun = route(false);
export const finishQuizRun = route(true);
