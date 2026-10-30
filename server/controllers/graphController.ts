//graphController.ts
import { Request, Response } from 'express';
import OpenAI from 'openai';
import ConceptProgress from '../models/ConceptProgress';
import User from '../models/User';
import { pythonServiceClient } from '../utils/axiosConfig';

// Initialize OpenAI with explicit API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',  // Provide empty string as fallback
});

// Verify API key is loaded
if (!process.env.OPENAI_API_KEY) {
  console.error('Warning: OPENAI_API_KEY is not set in environment variables');
}

// Helper function to update confidence score
const updateConfidenceScore = async (
  userId: string,
  chatId: string,
  conceptId: string,
  isCorrect: boolean,
  isRetry: boolean,
  submissionId: string
) => {
  if (!userId || !chatId || !conceptId) {
    console.log('Skipping confidence score update: missing userId, chatId, or conceptId.');
    throw new Error('Confidence score update requires userId, chatId, and conceptId');
  }

  const filter = { user: userId, chatId, conceptId };
  const delta = isCorrect ? (isRetry ? 0.05 : 0.1) : -0.1;
  try {
    await ConceptProgress.updateOne(filter, {
      $setOnInsert: { confidenceScore: 0.5, submissionIds: [] },
    }, { upsert: true });
  } catch (error: any) {
    // Concurrent first submissions can race to create the same uniquely indexed record.
    if (error.code !== 11000) throw error;
  }

  const updated = await ConceptProgress.findOneAndUpdate(
    { ...filter, submissionIds: { $ne: submissionId } },
    [{
      $set: {
        confidenceScore: {
          $max: [0, { $min: [1, { $add: [{ $ifNull: ['$confidenceScore', 0.5] }, delta] }] }],
        },
        submissionIds: {
          $setUnion: [{ $ifNull: ['$submissionIds', []] }, [submissionId]],
        },
        lastAttempted: new Date(),
      },
    }],
    { new: true }
  );
  const progress = updated || await ConceptProgress.findOne(filter);
  if (!progress) throw new Error('Confidence record could not be created');
  console.log(`Updated confidence score for concept ${conceptId} to ${progress.confidenceScore}`);
  return progress;
};

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
    const userId = (req.session as any)?.passport?.user;
    const chatId = req.query.chat_id;
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

    if (typeof chatId !== 'string' || !chatId.trim()) {
      return res.status(400).json({ error: 'chat_id is required' });
    }

    const chatOwner = await User.exists({
      _id: userId,
      chats: { $elemMatch: { chat_id: chatId, graph_id: String(graph_id) } },
    });
    if (!chatOwner) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const progress = await ConceptProgress.find({ user: userId, chatId })
      .select({ conceptId: 1, confidenceScore: 1, _id: 0 })
      .lean();
    const id = encodeURIComponent(String(graph_id));
    const url = `/questions/${id}?user_id=${encodeURIComponent(String(userId))}&length=${length}&format=${questionFormat}`;
    const mongoProgress = progress.reduce<Record<string, number>>((scores, item) => {
      scores[item.conceptId] = item.confidenceScore;
      return scores;
    }, {});

    console.log(`Requesting questions from AI server: ${url}`);

    const response = await pythonServiceClient.post(url, {
      mongo_progress: mongoProgress,
    });

    // The AI server returns { questions: [ { text, correct_answer, topic_id }, ... ] }
    const questions = response.data?.questions;
    if (!Array.isArray(questions)) {
      console.error('Invalid response from AI server:', response.data);
      return res.status(502).json({ error: 'Invalid response from AI question generation service' });
    }

    const qa_pairs = questions.map((q: any, idx: number) => {
      const conceptId = q.conceptId || q.concept_id || q.topic_id || q.topicID || q.id || '';
      const sourceField = q.conceptId ? 'conceptId' : 
                         q.concept_id ? 'concept_id' : 
                         q.topic_id ? 'topic_id' : 
                         q.topicID ? 'topicID' : 
                         q.id ? 'id' : 'NONE';
      
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
        conceptId: conceptId,
        conceptName: q.concept_name || '',
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
  conceptId?: string;
  isRetry?: boolean;
  chat_id?: string;
  graph_id?: string;
}

const normalizeAnswer = (value: string = ''): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');

// Multiple-choice and true/false questions have exactly one right answer, so grade them exactly
// instead of by LLM judgment. Returns null for open-ended questions.
export const exactChoiceVerdict = (userAnswer: string, correctAnswer: string): boolean | null => {
  const correct = correctAnswer.trim().toUpperCase();
  const user = userAnswer.trim().toUpperCase();
  if (/^[A-D]$/.test(correct)) return user.match(/^([A-D])(?:[).:\s]|$)/)?.[1] === correct;
  const trueFalse = (value: string) => (value === 'T' || value === 'TRUE' ? 'TRUE' : value === 'F' || value === 'FALSE' ? 'FALSE' : null);
  if (trueFalse(correct)) return trueFalse(user) === trueFalse(correct);
  return null;
};

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
  const userId = (req.session as any)?.passport?.user;
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    const { question, userAnswer, correctAnswer, conceptId, isRetry, chat_id: chatId, graph_id: graphId } = req.body as VerifyAnswerRequest;
    if (typeof chatId !== 'string' || !chatId.trim()) {
      return res.status(400).json({ error: 'chat_id is required' });
    }
    if (typeof conceptId !== 'string' || !conceptId.trim()) {
      return res.status(400).json({ error: 'conceptId is required' });
    }
    const submissionId = req.body.submission_id;
    if (typeof submissionId !== 'string' || !submissionId.trim()) {
      return res.status(400).json({ error: 'submission_id is required' });
    }
    const chatOwner = await User.exists({
      _id: userId,
      ...(graphId
        ? { chats: { $elemMatch: { chat_id: chatId, graph_id: graphId } } }
        : { 'chats.chat_id': chatId }),
    });
    if (!chatOwner) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    const normalizedConceptId = conceptId.trim();

    // Handle skipped questions - treat as incorrect
    if (userAnswer === 'SKIPPED' || userAnswer.trim().toUpperCase() === 'SKIP') {
      await updateConfidenceScore(userId, chatId, normalizedConceptId, false, false, submissionId);
      return res.json({
        isCorrect: false,
        feedback: `You skipped this question. Skipped questions are counted as incorrect for confidence tracking.`,
        followUpQuestion: ''
      });
    }

    const exact = exactChoiceVerdict(userAnswer, correctAnswer || '');

    // Construct the prompt for GPT
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
${exact === null ? '' : `\nThis is a multiple-choice or true/false question, and the student's answer is ${exact ? 'CORRECT' : 'INCORRECT'}. Your feedback must match that.\n`}
Provide feedback in this JSON format:
{
  "isCorrect": boolean (true if understanding is demonstrated, even if not perfectly worded),
  "score": number (0-100, based on conceptual understanding),
  "feedback": "Encouraging feedback focusing on what was good and what could be improved, without revealing the exact answer",
  "conceptualHint": "If needed, a hint about missing concepts without giving away the answer",
  "thinkingPrompt": "A question to help the student think deeper about the topic"
}`;

    let response: { isCorrect: boolean; feedback: string; followUpQuestion: string };
    try {
      // Prefer LLM conceptual grading, but keep a deterministic fallback if formatting/service fails.
      const completion = await openai.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        model: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" },
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('No response from OpenAI');
      }

      const cleaned = responseContent
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
      const result = JSON.parse(cleaned);
      const isCorrect = exact ?? result.score >= 70;

      response = {
        isCorrect, // Consider answers with 70% or higher understanding as correct
        feedback: result.feedback,
        followUpQuestion: isCorrect
          ? result.thinkingPrompt
          : `Hint: ${result.conceptualHint}`
      };
    } catch (llmError) {
      console.error('LLM verify fallback engaged:', llmError);
      response = evaluateAnswerFallback(userAnswer, correctAnswer || '');
    }
    await updateConfidenceScore(userId, chatId, normalizedConceptId, response.isCorrect, isRetry || false, submissionId);
    return res.json(response);
  } catch (error) {
    console.error('Error verifying answer:', error);
    return res.status(500).json({ error: 'Failed to verify answer or save progress' });
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
  if (!process.env.QUIZ_CLARIFY_SERVICE_TOKEN) {
    console.error('QUIZ_CLARIFY_SERVICE_TOKEN is not configured');
    return res.status(503).json({ error: 'Quiz clarification service is not configured' });
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
