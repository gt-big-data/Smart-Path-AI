//graphController.ts
import { Request, Response } from 'express';
import axios from 'axios';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import ConceptProgress from '../models/ConceptProgress';
import { pythonServiceClient } from '../utils/axiosConfig';

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
    const rawLength = req.query.length as string | undefined;
    const parsedLength = Number(rawLength);
    const allowed = [5, 10, 15];
    const length = allowed.includes(parsedLength) ? parsedLength : 5;
    
    // Handle format parameter
    const format = req.query.format as string | undefined;
    const allowedFormats = ['mixed', 'mcq', 'true-false', 'open-ended'];
    const questionFormat = format && allowedFormats.includes(format) ? format : 'mixed';

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
    const url = `/questions/${id}?user_id=${userId}&length=${length}&format=${questionFormat}`;

    console.log(`Requesting questions from AI server: ${url}`);

    const response = await pythonServiceClient.post(url, {});

    // The AI server returns { questions: [ { text, correct_answer, topic_id }, ... ] }
    const questions = response.data?.questions;
    if (!Array.isArray(questions)) {
      console.error('Invalid response from AI server:', response.data);
      return res.status(502).json({ error: 'Invalid response from AI question generation service' });
    }

    const qa_pairs = questions.map((q: any) => ({
      question: q.text || '',
      answer: q.correct_answer || '',
      conceptId: q.topic_id || '',
      // Optional metadata for future UI use
      id: q.id,
      explanation: q.explanation,
      difficulty: q.difficulty,
      format: q.format,
    }));

    res.json({ status: 'success', qa_pairs, graph_id: graph_id, requested_length: length, actual_length: qa_pairs.length });
  } catch (error: any) {
    console.error('Error generating questions and answers:', error.message);
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({ 
        error: 'AI service is currently unavailable',
        message: 'The Python service on port 8000 is not responding. Please ensure it is running.'
      });
    }
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
    // Read from request body (frontend sends as POST body)
    const message = req.body.message as string;
    const graph_id = req.body.graph_id as string;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!graph_id) {
      return res.status(400).json({ error: 'graph_id is required' });
    }

    console.log(`Generating conversation response for graph ${graph_id}: "${message}"`);

    // Forward request to Python/FastAPI backend which handles Neo4j and OpenAI
    const response = await pythonServiceClient.post(
      `/generate-conversation-response`,
      {},
      {
        params: {
          user_input: message,
          graph_id: graph_id
        }
      }
    );

    console.log('✅ Conversation response generated successfully');

    // Return the response from Python backend
    res.json({
      success: true,
      message: response.data.message,  // ← Keep as 'message' to match frontend expectation
      response: response.data.message, // ← Add 'response' for compatibility
      graph_id: response.data.graph_id
    });

  } catch (error: any) {
    console.error('Error generating conversation response:', {
      message: error.message,
      response_status: error.response?.status,
      response_data: error.response?.data,
      code: error.code
    });
    
    // Handle connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({
        success: false,
        error: 'AI service is currently unavailable',
        response: 'The AI service on port 8000 is not responding. Please ensure it is running.'
      });
    }
    
    // Handle specific error cases
    if (error.response) {
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

export const getUserProfile = async (req: Request, res: Response) => {
  const userId = (req.session as any)?.passport?.user;
  const graph_id = req.query.graph_id;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  if (!graph_id) {
    return res.status(400).json({ error: 'graph_id is required' });
  }

  try {
    const url = `http://localhost:8000/user/${userId}/profile?graph_id=${graph_id}`;
    console.log(`Fetching user profile from AI server: ${url}`);

    const response = await axios.get(url);

    // Forward the data from the AI server directly to the frontend
    res.json(response.data);

  } catch (error: any) {
    const status = error.response?.status || 500;
    const errorDetail = error.response?.data || 'Failed to fetch user profile from AI service.';
    console.error(`Error fetching user profile from AI service: Status ${status}`, errorDetail);
    res.status(status).json({ error: 'Failed to fetch user profile', detail: errorDetail });
  }
};

// Fetch metadata for specific node/concept ids from the AI graph proxy
export const getNodeMetadata = async (req: Request, res: Response) => {
  try {
    const graph_id = req.query.graph_id as string | undefined;
    const conceptIdsRaw = (req.query.concept_ids || req.query.concept_id) as string | undefined;

    if (!graph_id) return res.status(400).json({ error: 'graph_id is required' });
    if (!conceptIdsRaw) return res.status(400).json({ error: 'concept_ids or concept_id is required' });

    const wanted = String(conceptIdsRaw).split(',').map(s => s.trim()).filter(Boolean);

    const url = `http://localhost:8000/view-graph?graph_id=${encodeURIComponent(String(graph_id))}`;
    const response = await axios.get(url);
    const nodes = response.data?.graph?.nodes || [];

    const matches = nodes.filter((node: any) => {
      const props = node.properties || {};
      const candidates = [props.topicID, props.topicId, props.topic_id, props.conceptId, props.concept_id, node.id]
        .filter(Boolean)
        .map(String);
      return candidates.some((c: string) => wanted.includes(c));
    }).map((n: any) => ({ id: n.id, labels: n.labels, properties: n.properties }));

    res.json({ nodes: matches });
  } catch (error: any) {
    console.error('Error fetching node metadata:', error?.message || error);
    res.status(500).json({ error: 'Failed to fetch node metadata' });
  }
};

export const searchGraph = async (req: Request, res: Response) => {
  try {
    const graph_id = req.query.graph_id;
    const query = req.query.query;
    
    if (!graph_id) {
      return res.status(400).json({ error: 'graph_id is required' });
    }
    
    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    // Forward to Python API
    const response = await pythonServiceClient.get('/search-graph', {
      params: { 
        graph_id: String(graph_id), 
        query: String(query) 
      }
    });
    
    res.json(response.data);
  } catch (error: any) {
    console.error('Error searching graph:', {
      message: error.message,
      response_status: error.response?.status,
      response_data: error.response?.data,
      code: error.code
    });
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({ 
        error: 'AI service is currently unavailable',
        message: 'The Python service on port 8000 is not responding. Please ensure it is running.'
      });
    }
    // Return the actual error from Python service if available
    const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Failed to search graph';
    res.status(error.response?.status || 500).json({ error: errorMessage });
  }
};

export const semanticSearchGraph = async (req: Request, res: Response) => {
  try {
    const graph_id = req.query.graph_id;
    const query = req.query.query;
    const top_k = req.query.top_k || 10;
    
    if (!graph_id) {
      return res.status(400).json({ error: 'graph_id is required' });
    }
    
    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    // Forward to Python API
    const response = await pythonServiceClient.get('/semantic-search-graph', {
      params: {
        graph_id: String(graph_id),
        query: String(query),
        top_k: Number(top_k)
      }
    });
    
    res.json(response.data);
  } catch (error: any) {
    console.error('Error in semantic search:', {
      message: error.message,
      response_status: error.response?.status,
      response_data: error.response?.data,
      code: error.code
    });
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({ 
        error: 'AI service is currently unavailable',
        message: 'The Python service on port 8000 is not responding. Please ensure it is running.'
      });
    }
    // Return the actual error from Python service if available
    const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Failed to perform semantic search';
    res.status(error.response?.status || 500).json({ error: errorMessage });
  }
};
