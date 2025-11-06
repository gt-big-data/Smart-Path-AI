import { Request, Response } from 'express';
import axios from 'axios';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

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
    if (!graph_id) {
      return res.status(400).json({ error: 'graph_id is required' });
    }
    const response = await axios.get(`http://localhost:8000/generate-questions-with-answers?graph_id=${graph_id}`);
    res.json(response.data);
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

interface GenerateConversationRequest {
  message: string;
  graph_id: string;
}

export const generateConversationResponse = async (req: Request, res: Response) => {
  try {
    const { message, graph_id }: GenerateConversationRequest = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
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
      response: response.data.message,
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