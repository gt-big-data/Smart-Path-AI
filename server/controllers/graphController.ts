//graphController.ts
import { Request, Response } from 'express';
import OpenAI from 'openai';
import { pythonServiceClient } from '../utils/axiosConfig';
import { findOwnedChat, normalizeSessionUserId } from '../services/chatService';
import { getChatConfidenceMap, normalizeConceptId, updateChatConceptConfidence } from '../services/progressService';

// Initialize OpenAI with explicit API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',  // Provide empty string as fallback
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
    // Prevent browser/CDN cache from serving stale placeholder graphs.
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    const response = await pythonServiceClient.get('/view-graph', {
      params: { graph_id: String(graph_id) }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching graph data:', error);
    res.status(500).json({ error: 'Failed to fetch graph data' });
  }
};

export const generateQuestionsWithAnswers = async (req: Request, res: Response) => {
  try {
    const graph_id = req.query.graph_id;
    const userId = normalizeSessionUserId((req.session as any)?.passport?.user);
    const chatId = String(req.query.chat_id || req.query.chatId || '');
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
      return res.status(401).json({ error: 'User not authenticated. Cannot generate personalized questions.' });
    }

    if (!chatId) {
      return res.status(400).json({ error: 'chat_id is required' });
    }

    const ownedChat = await findOwnedChat(userId, chatId, String(graph_id));
    if (!ownedChat) {
      return res.status(404).json({ error: 'Chat or graph not found for this user' });
    }

    const confidenceByConcept = await getChatConfidenceMap(userId, chatId);

    const id = encodeURIComponent(String(graph_id));
    const url = `/questions/${id}?length=${length}&format=${questionFormat}`;

    console.log(`Requesting questions from AI server: ${url}`);

    const response = await pythonServiceClient.post(url, {
      confidence_by_concept: confidenceByConcept,
    });

    // The AI server returns { questions: [ { text, correct_answer, topic_id }, ... ] }
    const questions = response.data?.questions;
    if (!Array.isArray(questions)) {
      console.error('Invalid response from AI server:', response.data);
      return res.status(502).json({ error: 'Invalid response from AI question generation service' });
    }

    const qa_pairs = questions.map((q: any, idx: number) => {
      const conceptId = normalizeConceptId({
        concept_id: q.concept_id,
        topic_id: q.topic_id,
        topicID: q.topicID,
        conceptId: q.conceptId,
      });
      const sourceField = q.concept_id ? 'concept_id' :
        q.topic_id ? 'topic_id' :
        q.topicID ? 'topicID' :
        q.conceptId ? 'conceptId' : 'NONE';
      
      console.log(`[Backend] Question ${idx + 1} - conceptId extracted from field: ${sourceField}, value: ${conceptId}`);
      console.log(`[Backend] Question ${idx + 1} - Available fields:`, {
        conceptId: q.conceptId,
        concept_id: q.concept_id,
        topic_id: q.topic_id,
        topicID: q.topicID,
        id: q.id
      });
      
      return {
        question: q.text || '',
        answer: q.correct_answer || '',
        concept_id: conceptId,
        conceptId,
        // Optional metadata for future UI use
        id: q.id,
        explanation: q.explanation,
        difficulty: q.difficulty,
        format: q.format,
      };
    });

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
  concept_id?: string;
  conceptId?: string;
  chat_id?: string;
  graph_id?: string;
  attempt_id?: string;
  isRetry?: boolean;
}

const normalizeAnswer = (value: string = ''): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');

const evaluateAnswerFallback = (userAnswer: string, correctAnswer: string) => {
  const normalizedUser = normalizeAnswer(userAnswer);
  const normalizedCorrect = normalizeAnswer(correctAnswer);

  const normalizedChoice = (value: string) => {
    const first = value.charAt(0);
    if (['a', 'b', 'c', 'd'].includes(first)) return first;
    if (value === 'true' || value === 't') return 'true';
    if (value === 'false' || value === 'f') return 'false';
    return value;
  };

  const compactUser = normalizedChoice(normalizedUser);
  const compactCorrect = normalizedChoice(normalizedCorrect);
  const isCorrect = !!compactCorrect && compactUser === compactCorrect;

  if (isCorrect) {
    return {
      isCorrect: true,
      feedback: "Nice work. That's correct.",
      followUpQuestion: "What key idea helped you choose that answer?",
    };
  }

  return {
    isCorrect: false,
    feedback: "Not quite. Re-check the key concept in the question and try again.",
    followUpQuestion: "What evidence from the topic supports your choice?",
  };
};

export const verifyAnswer = async (req: Request, res: Response) => {
  const userId = normalizeSessionUserId((req.session as any)?.passport?.user);
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const {
    question = '',
    userAnswer = '',
    correctAnswer = '',
    isRetry = false,
  }: VerifyAnswerRequest = req.body || {};
  const chatId = String(req.body?.chat_id || req.body?.chatId || '');
  const conceptId = normalizeConceptId(req.body);
  const attemptId = String(req.body?.attempt_id || req.body?.attemptId || '');

  if (!chatId || !conceptId || !attemptId || attemptId.length > 200) {
    return res.status(400).json({ error: 'chat_id, concept_id, and attempt_id are required' });
  }
  if (
    typeof question !== 'string' ||
    typeof userAnswer !== 'string' ||
    typeof correctAnswer !== 'string' ||
    typeof isRetry !== 'boolean'
  ) {
    return res.status(400).json({ error: 'question, userAnswer, correctAnswer, and isRetry are required' });
  }

  try {
    const ownedChat = await findOwnedChat(userId, chatId, req.body?.graph_id ? String(req.body.graph_id) : undefined);
    if (!ownedChat) {
      return res.status(404).json({ error: 'Chat not found for this user' });
    }

    const isSkipped = userAnswer === 'SKIPPED' || String(userAnswer).trim().toUpperCase() === 'SKIP';
    let result: { isCorrect: boolean; feedback: string; followUpQuestion: string };

    if (isSkipped) {
      result = {
        isCorrect: false,
        feedback: 'You skipped this question. Skipped questions are counted as incorrect for confidence tracking.',
        followUpQuestion: '',
      };
    } else {
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

Even partially correct answers should receive encouraging feedback.
Return valid JSON only.`;

  const userPrompt = `Evaluate this answer conceptually:

Question: "${question}"
Student's Answer: "${userAnswer}"
Reference Correct Answer: "${correctAnswer || ''}"

Provide feedback in this JSON format:
{
  "isCorrect": boolean (true if understanding is demonstrated, even if not perfectly worded),
  "score": number (0-100, based on conceptual understanding),
  "feedback": "Encouraging feedback focusing on what was good and what could be improved, without revealing the exact answer",
  "conceptualHint": "If needed, a hint about missing concepts without giving away the answer",
  "thinkingPrompt": "A question to help the student think deeper about the topic"
}`;

      try {
        const completion = await openai.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          model: 'gpt-4o-mini',
          temperature: 0.3,
          max_tokens: 500,
          response_format: { type: 'json_object' },
        });

        const responseContent = completion.choices[0]?.message?.content;
        if (!responseContent) throw new Error('No response from OpenAI');

        const cleaned = responseContent
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/, '')
          .trim();
        const evaluation = JSON.parse(cleaned);
        const isCorrect = Number(evaluation.score) >= 70;

        result = {
          isCorrect,
          feedback: String(evaluation.feedback || 'Answer evaluated.'),
          followUpQuestion: isCorrect
            ? String(evaluation.thinkingPrompt || '')
            : `Hint: ${String(evaluation.conceptualHint || '')}`,
        };
      } catch (llmError) {
        console.error('LLM verify fallback engaged:', llmError);
        result = evaluateAnswerFallback(String(userAnswer), String(correctAnswer || ''));
      }
    }

    const progress = await updateChatConceptConfidence({
      userId,
      chatId,
      conceptId,
      isCorrect: result.isCorrect,
      isRetry: isSkipped ? false : Boolean(isRetry),
      attemptId,
    });

    return res.json({ ...result, confidence_score: progress.confidence_score });
  } catch (error) {
    console.error('Error verifying answer or updating progress:', error);
    return res.status(500).json({ error: 'Could not verify answer and save progress' });
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
    const url = `/user/${userId}/profile`;
    console.log(`Fetching user profile from AI server: ${url}`);
    const response = await pythonServiceClient.get(url, {
      params: { graph_id: String(graph_id) }
    });

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

    const response = await pythonServiceClient.get('/view-graph', {
      params: { graph_id: String(graph_id) }
    });
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

// Quiz clarifications use their own AI endpoint: the chat one answers directly and pulls in graph facts that give answers away
export const clarifyQuizQuestion = async (req: Request, res: Response) => {
  const userId = (req.session as any)?.passport?.user;
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const { question, studentQuestion, correctAnswer } = req.body || {};
  if (!question || !studentQuestion?.trim() || !correctAnswer) {
    return res.status(400).json({ error: 'question, studentQuestion and correctAnswer are required' });
  }

  try {
    const response = await pythonServiceClient.post('/clarify-quiz-question', {
      question,
      student_question: studentQuestion,
      correct_answer: correctAnswer,
    });
    res.json({ message: response.data.message });
  } catch (error: any) {
    console.error('Error clarifying quiz question:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: 'Failed to clarify quiz question' });
  }
};
