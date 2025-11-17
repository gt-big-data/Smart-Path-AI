//graphController.ts
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

// Helper function to update confidence score
const updateConfidenceScore = async (userId: string, conceptId: string, isCorrect: boolean, isRetry: boolean) => {
  if (!userId || !conceptId) {
    console.log('Skipping confidence score update: missing userId or conceptId.');
    return;
  }

  let progress = await ConceptProgress.findOne({ user: userId, conceptId });

  if (!progress) {
    progress = new ConceptProgress({ user: userId, conceptId, confidenceScore: 0.5 });
  }

  if (isCorrect) {
    progress.confidenceScore += isRetry ? 0.05 : 0.1;
  } else {
    progress.confidenceScore -= 0.1;
  }

  // Clamp the score between 0 and 1
  progress.confidenceScore = Math.max(0, Math.min(1, progress.confidenceScore));

  await progress.save();
  console.log(`Updated confidence score for concept ${conceptId} to ${progress.confidenceScore}`);
};


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

    if (!userId) {
      // The Python server needs a user_id to fetch progress.
      // If the user is not authenticated, we cannot generate personalized questions.
      // We could either return an error or generate generic questions.
      // For now, let's return an error to make the dependency clear.
      return res.status(401).json({ error: 'User not authenticated. Cannot generate personalized questions.' });
    }

    const id = encodeURIComponent(String(graph_id));
    const url = `http://localhost:8000/questions/${id}?user_id=${userId}`;

    console.log(`Requesting questions from AI server: ${url}`);

    const response = await axios.post(url, {});

    // The AI server returns { questions: [ { text, correct_answer, topic_id }, ... ] }
    const questions = response.data?.questions;
    if (!Array.isArray(questions)) {
      console.error('Invalid response from AI server:', response.data);
      return res.status(502).json({ error: 'Invalid response from AI question generation service' });
    }

    const qa_pairs = questions.map((q: any) => ({
      question: q.text || '',
      answer: q.correct_answer || '',
      conceptId: q.topic_id || ''
    }));

    res.json({ status: 'success', qa_pairs, graph_id: graph_id });
  } catch (error: any) {
    console.error('Error generating questions and answers:', error.message);
    res.status(500).json({ error: 'Failed to generate questions and answers' });
  }
};

interface VerifyAnswerRequest {
  question: string;
  userAnswer: string;
  correctAnswer: string;
  conceptId?: string;
  isRetry?: boolean;
}

export const verifyAnswer = async (req: Request, res: Response) => {
  const userId = (req.session as any)?.passport?.user;
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    const { question, userAnswer, conceptId, isRetry }: VerifyAnswerRequest = req.body;

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
      model: "gpt-4o-mini",
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
      const isCorrect = result.score >= 70;

      // Update confidence score
      if (userId && conceptId) {
        await updateConfidenceScore(userId, conceptId, isCorrect, isRetry || false);
      } else {
          console.log('Skipping confidence score update: missing userId or conceptId in request body.');
      }

      // Transform the result to match the expected frontend format while preserving the new evaluation approach
      const transformedResult = {
        isCorrect, // Consider answers with 70% or higher understanding as correct
        feedback: result.feedback,
        followUpQuestion: result.score >= 70 
          ? result.thinkingPrompt 
          : `Hint: ${result.conceptualHint}`
      };
      res.json(transformedResult);
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      // If parsing fails, we still need to send a response to the client.
      // We should NOT try to update score here as it might be the cause of the error.
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

interface GenerateConversationRequest {
  message: string;
  graph_id: string;
}

export const generateConversationResponse = async (req: Request, res: Response) => {
  try {
    const message = req.query.user_input as string;
    const graph_id = req.query.graph_id as string;

    if (!message) {
      return res.status(400).json({ error: 'Message (user_input) is required' });
    }

    if (!graph_id) {
      return res.status(400).json({ error: 'graph_id is required' });
    }

    // Forward request to Python/FastAPI backend which handles Neo4j and OpenAI
    const response = await axios.post(
      `http://localhost:8000/generate-conversation-response?user_input=${encodeURIComponent(message)}&graph_id=${encodeURIComponent(graph_id)}`
    );

    // Return the response from Python backend
    res.json({
      success: true,
      message: response.data.message,  // ← Keep as 'message' to match frontend expectation
      response: response.data.message, // ← Add 'response' for compatibility
      graph_id: response.data.graph_id
    });

  } catch (error) {
    console.error('Error generating conversation response:', error);
    
    // Handle specific error cases
    if (axios.isAxiosError(error) && error.response) {
      return res.status(error.response.status).json({
        success: false,
        error: error.response.data.detail || 'Failed to generate response',
        response: "I apologize, but I'm having trouble generating a response right now. Please try again."
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to generate response',
      response: "I apologize, but I'm having trouble generating a response right now. Please try again."
    });
  }
};
