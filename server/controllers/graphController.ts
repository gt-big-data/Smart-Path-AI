import { Request, Response } from 'express';
import axios from 'axios';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import ConceptProgress from '../models/ConceptProgress';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Initialize OpenAI with explicit API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''  // Provide empty string as fallback
});

// Verify API key is loaded
if (!process.env.OPENAI_API_KEY) {
  console.error('Warning: OPENAI_API_KEY is not set in environment variables');
}

export const viewGraph = async (req: Request, res: Response) => {
  try {
    const graph_id = req.query.graph_id;
    if (!graph_id) {
      return res.status(400).json({ error: 'graph_id is required' });
    }
    const response = await axios.get(`http://localhost:8000/view-graph?graph_id=${graph_id}`);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching graph data:', error);
    res.status(500).json({ error: 'Failed to fetch graph data' });
  }
};

export const generateQuestionsWithAnswers = async (req: Request, res: Response) => {
  try {
    const graph_id = req.query.graph_id;
    const userId = (req.session as any)?.passport?.user;

    if (!graph_id) {
      return res.status(400).json({ error: 'graph_id is required' });
    }

    let progressDict = {};
    if (userId) {
      const userProgress = await ConceptProgress.find({ user: userId });
      progressDict = Object.fromEntries(
        userProgress.map(p => [p.conceptId, p.confidenceScore])
      );
    } else {
      console.log('User not authenticated. Generating generic questions.');
    }

    const id = encodeURIComponent(String(graph_id));

    let response;
    try {
      response = await axios.post(`http://localhost:8000/questions/${id}?use_langchain=true`, {
        progress: progressDict
      });
    } catch (err: any) {
      const status = err?.response?.status;
      console.error(`Primary questions endpoint failed (status=${status}). Attempting legacy fallback...`);
      if (status === 403 || status === 404 || !response) {
        try {
          // Legacy endpoint expected format: GET /generate?graph_id=...&num_questions=5
          response = await axios.get(`http://localhost:5000/generate`, {
            params: { graph_id: id, num_questions: 5 }
          });
        } catch (legacyErr) {
          console.error('Both primary and legacy question endpoints failed:', legacyErr);
          return res.status(502).json({ error: 'AI question generation service unavailable' });
        }
      } else {
        console.error('Error calling primary questions endpoint:', err);
        return res.status(502).json({ error: 'AI question generation failed' });
      }
    }

    // The AI server returns { questions: [ { kind, format, id, text, correct_answer, explanation }, ... ] }
    // Map that to the frontend's expected shape: { status: 'success', qa_pairs: [{ question, answer }, ...] }
    const questions = response.data?.questions || response.data?.data || response.data;
    if (!Array.isArray(questions)) {
      return res.status(502).json({ error: 'Invalid response from AI server' });
    }

    const qa_pairs = questions.map((q: any) => ({
      question: q.text || q.question || '',
      answer: q.correct_answer || q.correctAnswer || '',
      conceptId: q.topic || q.id || ''
    }));

    res.json({ status: 'success', qa_pairs, graph_id: graph_id });
  } catch (error) {
    console.error('Error generating questions and answers:', error);
    res.status(500).json({ error: 'Failed to generate questions and answers' });
  }
};

interface VerifyAnswerRequest {
  question: string;
  userAnswer: string;
  correctAnswer: string;
}

export const verifyAnswer = async (req: Request, res: Response) => {
  try {
    const { question, userAnswer, correctAnswer }: VerifyAnswerRequest = req.body;

    // Construct the prompt for GPT-4
    const systemPrompt = `You are an educational assistant that evaluates student answers based on conceptual understanding rather than exact wording.
Your role is to:
1. Focus on the core concepts and key points in the answer
2. Be lenient with different phrasings as long as they convey the same meaning
3. Provide encouraging and constructive feedback
4. Never reveal the exact correct answer in your feedback
5. Guide students towards better understanding through hints and examples

Evaluate answers based on:
- Core concept understanding (60%)
- Key points coverage (30%)
- Clarity of expression (10%)

Even partially correct answers should receive encouraging feedback.`;

    const userPrompt = `Evaluate this answer conceptually:

Question: "${question}"
Student's Answer: "${userAnswer}"

Provide feedback in this JSON format:
{
  "isCorrect": boolean (true if understanding is demonstrated, even if not perfectly worded),
  "score": number (0-100, based on conceptual understanding),
  "feedback": "Encouraging feedback focusing on what was good and what could be improved, without revealing the exact answer",
  "conceptualHint": "If needed, a hint about missing concepts without giving away the answer",
  "thinkingPrompt": "A question to help the student think deeper about the topic"
}`;

    // Call GPT-4 for verification with higher temperature for more flexible responses
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      model: "gpt-4",
      temperature: 0.8,
      max_tokens: 500
    });

    // Parse the response
    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    try {
      const result = JSON.parse(responseContent);
      // Transform the result to match the expected frontend format while preserving the new evaluation approach
      const transformedResult = {
        isCorrect: result.score >= 70, // Consider answers with 70% or higher understanding as correct
        feedback: result.feedback,
        followUpQuestion: result.score >= 70 
          ? result.thinkingPrompt 
          : `Hint: ${result.conceptualHint}`
      };
      res.json(transformedResult);
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      res.status(500).json({
        isCorrect: false,
        feedback: "There was an error processing your answer. Please try again.",
        followUpQuestion: "Could you explain your thinking process?"
      });
    }

  } catch (error) {
    console.error('Error verifying answer:', error);
    res.status(500).json({
      isCorrect: false,
      feedback: "There was an error verifying your answer. Please try again.",
      followUpQuestion: "Could you rephrase your answer?"
    });
  }
};