"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.semanticSearchGraph = exports.searchGraph = exports.getNodeMetadata = exports.getUserProfile = exports.generateConversationResponse = exports.verifyAnswer = exports.generateQuestionsWithAnswers = exports.viewGraph = void 0;
const openai_1 = __importDefault(require("openai"));
const ConceptProgress_1 = __importDefault(require("../models/ConceptProgress"));
const axiosConfig_1 = require("../utils/axiosConfig");
// Initialize OpenAI with explicit API key
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY || '', // Provide empty string as fallback
});
// Verify API key is loaded
if (!process.env.OPENAI_API_KEY) {
    console.error('Warning: OPENAI_API_KEY is not set in environment variables');
}
// Helper function to update confidence score
const updateConfidenceScore = (userId, conceptId, isCorrect, isRetry) => __awaiter(void 0, void 0, void 0, function* () {
    if (!userId || !conceptId) {
        console.log('Skipping confidence score update: missing userId or conceptId.');
        return;
    }
    let progress = yield ConceptProgress_1.default.findOne({ user: userId, conceptId });
    if (!progress) {
        progress = new ConceptProgress_1.default({ user: userId, conceptId, confidenceScore: 0.5 });
    }
    if (isCorrect) {
        progress.confidenceScore += isRetry ? 0.05 : 0.1;
    }
    else {
        progress.confidenceScore -= 0.1;
    }
    // Clamp the score between 0 and 1
    progress.confidenceScore = Math.max(0, Math.min(1, progress.confidenceScore));
    yield progress.save();
    console.log(`Updated confidence score for concept ${conceptId} to ${progress.confidenceScore}`);
});
const updateConfidenceScoreSafe = (userId, conceptId, isCorrect, isRetry) => __awaiter(void 0, void 0, void 0, function* () {
    if (!userId || !conceptId)
        return;
    try {
        yield updateConfidenceScore(userId, conceptId, isCorrect, isRetry);
    }
    catch (err) {
        console.error('Non-fatal confidence update error:', err);
    }
});
const viewGraph = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const response = yield axiosConfig_1.pythonServiceClient.get('/view-graph', {
            params: { graph_id: String(graph_id) }
        });
        res.json(response.data);
    }
    catch (error) {
        console.error('Error fetching graph data:', error);
        res.status(500).json({ error: 'Failed to fetch graph data' });
    }
});
exports.viewGraph = viewGraph;
const generateQuestionsWithAnswers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const graph_id = req.query.graph_id;
        const userId = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport) === null || _b === void 0 ? void 0 : _b.user;
        const rawLength = req.query.length;
        const parsedLength = Number(rawLength);
        const allowed = [5, 10, 15];
        const length = allowed.includes(parsedLength) ? parsedLength : 5;
        // Handle format parameter
        const format = req.query.format;
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
        const response = yield axiosConfig_1.pythonServiceClient.post(url, {});
        // The AI server returns { questions: [ { text, correct_answer, topic_id }, ... ] }
        const questions = (_c = response.data) === null || _c === void 0 ? void 0 : _c.questions;
        if (!Array.isArray(questions)) {
            console.error('Invalid response from AI server:', response.data);
            return res.status(502).json({ error: 'Invalid response from AI question generation service' });
        }
        const qa_pairs = questions.map((q, idx) => {
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
                // Optional metadata for future UI use
                id: q.id,
                explanation: q.explanation,
                difficulty: q.difficulty,
                format: q.format,
            };
        });
        res.json({ status: 'success', qa_pairs, graph_id: graph_id, requested_length: length, actual_length: qa_pairs.length });
    }
    catch (error) {
        console.error('Error generating questions and answers:', error.message);
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return res.status(503).json({
                error: 'AI service is currently unavailable',
                message: 'The Python service on port 8000 is not responding. Please ensure it is running.'
            });
        }
        res.status(500).json({ error: 'Failed to generate questions and answers' });
    }
});
exports.generateQuestionsWithAnswers = generateQuestionsWithAnswers;
const normalizeAnswer = (value = '') => value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
const evaluateAnswerFallback = (userAnswer, correctAnswer) => {
    const normalizedUser = normalizeAnswer(userAnswer);
    const normalizedCorrect = normalizeAnswer(correctAnswer);
    const normalizedChoice = (value) => {
        const first = value.charAt(0);
        if (['a', 'b', 'c', 'd'].includes(first))
            return first;
        if (value === 'true' || value === 't')
            return 'true';
        if (value === 'false' || value === 'f')
            return 'false';
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
const verifyAnswer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const userId = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport) === null || _b === void 0 ? void 0 : _b.user;
    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }
    try {
        const { question, userAnswer, correctAnswer, conceptId, isRetry } = req.body;
        // Handle skipped questions - treat as incorrect
        if (userAnswer === 'SKIPPED' || userAnswer.trim().toUpperCase() === 'SKIP') {
            yield updateConfidenceScoreSafe(userId, conceptId, false, false);
            return res.json({
                isCorrect: false,
                feedback: `You skipped this question. Skipped questions are counted as incorrect for confidence tracking.`,
                followUpQuestion: ''
            });
        }
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

Provide feedback in this JSON format:
{
  "isCorrect": boolean (true if understanding is demonstrated, even if not perfectly worded),
  "score": number (0-100, based on conceptual understanding),
  "feedback": "Encouraging feedback focusing on what was good and what could be improved, without revealing the exact answer",
  "conceptualHint": "If needed, a hint about missing concepts without giving away the answer",
  "thinkingPrompt": "A question to help the student think deeper about the topic"
}`;
        try {
            // Prefer LLM conceptual grading, but keep a deterministic fallback if formatting/service fails.
            const completion = yield openai.chat.completions.create({
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                model: "gpt-4o-mini",
                temperature: 0.3,
                max_tokens: 500,
                response_format: { type: "json_object" },
            });
            const responseContent = (_d = (_c = completion.choices[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content;
            if (!responseContent) {
                throw new Error('No response from OpenAI');
            }
            const cleaned = responseContent
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/\s*```$/, '')
                .trim();
            const result = JSON.parse(cleaned);
            const isCorrect = result.score >= 70;
            // Update confidence score
            yield updateConfidenceScoreSafe(userId, conceptId, isCorrect, isRetry || false);
            // Transform the result to match the expected frontend format while preserving the new evaluation approach
            const transformedResult = {
                isCorrect, // Consider answers with 70% or higher understanding as correct
                feedback: result.feedback,
                followUpQuestion: result.score >= 70
                    ? result.thinkingPrompt
                    : `Hint: ${result.conceptualHint}`
            };
            res.json(transformedResult);
        }
        catch (llmError) {
            console.error('LLM verify fallback engaged:', llmError);
            const fallback = evaluateAnswerFallback(userAnswer, correctAnswer || '');
            yield updateConfidenceScoreSafe(userId, conceptId, fallback.isCorrect, isRetry || false);
            res.json(fallback);
        }
    }
    catch (error) {
        console.error('Error verifying answer:', error);
        const { userAnswer, correctAnswer, conceptId, isRetry } = req.body || {};
        const fallback = evaluateAnswerFallback(String(userAnswer || ''), String(correctAnswer || ''));
        yield updateConfidenceScoreSafe(userId, conceptId, fallback.isCorrect, Boolean(isRetry));
        res.json(fallback);
    }
});
exports.verifyAnswer = verifyAnswer;
const generateConversationResponse = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        // Read from request body (frontend sends as POST body)
        const message = req.body.message;
        const graph_id = req.body.graph_id;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        if (!graph_id) {
            return res.status(400).json({ error: 'graph_id is required' });
        }
        console.log(`Generating conversation response for graph ${graph_id}: "${message}"`);
        // Forward request to Python/FastAPI backend which handles Neo4j and OpenAI
        const response = yield axiosConfig_1.pythonServiceClient.post(`/generate-conversation-response`, {}, {
            params: {
                user_input: message,
                graph_id: graph_id
            }
        });
        console.log('✅ Conversation response generated successfully');
        // Return the response from Python backend
        res.json({
            success: true,
            message: response.data.message, // ← Keep as 'message' to match frontend expectation
            response: response.data.message, // ← Add 'response' for compatibility
            graph_id: response.data.graph_id
        });
    }
    catch (error) {
        console.error('Error generating conversation response:', {
            message: error.message,
            response_status: (_a = error.response) === null || _a === void 0 ? void 0 : _a.status,
            response_data: (_b = error.response) === null || _b === void 0 ? void 0 : _b.data,
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
});
exports.generateConversationResponse = generateConversationResponse;
const getUserProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const userId = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport) === null || _b === void 0 ? void 0 : _b.user;
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
        const response = yield axiosConfig_1.pythonServiceClient.get(url, {
            params: { graph_id: String(graph_id) }
        });
        // Forward the data from the AI server directly to the frontend
        res.json(response.data);
    }
    catch (error) {
        const status = ((_c = error.response) === null || _c === void 0 ? void 0 : _c.status) || 500;
        const errorDetail = ((_d = error.response) === null || _d === void 0 ? void 0 : _d.data) || 'Failed to fetch user profile from AI service.';
        console.error(`Error fetching user profile from AI service: Status ${status}`, errorDetail);
        res.status(status).json({ error: 'Failed to fetch user profile', detail: errorDetail });
    }
});
exports.getUserProfile = getUserProfile;
// Fetch metadata for specific node/concept ids from the AI graph proxy
const getNodeMetadata = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const graph_id = req.query.graph_id;
        const conceptIdsRaw = (req.query.concept_ids || req.query.concept_id);
        if (!graph_id)
            return res.status(400).json({ error: 'graph_id is required' });
        if (!conceptIdsRaw)
            return res.status(400).json({ error: 'concept_ids or concept_id is required' });
        const wanted = String(conceptIdsRaw).split(',').map(s => s.trim()).filter(Boolean);
        const response = yield axiosConfig_1.pythonServiceClient.get('/view-graph', {
            params: { graph_id: String(graph_id) }
        });
        const nodes = ((_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.graph) === null || _b === void 0 ? void 0 : _b.nodes) || [];
        const matches = nodes.filter((node) => {
            const props = node.properties || {};
            const candidates = [props.topicID, props.topicId, props.topic_id, props.conceptId, props.concept_id, node.id]
                .filter(Boolean)
                .map(String);
            return candidates.some((c) => wanted.includes(c));
        }).map((n) => ({ id: n.id, labels: n.labels, properties: n.properties }));
        res.json({ nodes: matches });
    }
    catch (error) {
        console.error('Error fetching node metadata:', (error === null || error === void 0 ? void 0 : error.message) || error);
        res.status(500).json({ error: 'Failed to fetch node metadata' });
    }
});
exports.getNodeMetadata = getNodeMetadata;
const searchGraph = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g;
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
        const response = yield axiosConfig_1.pythonServiceClient.get('/search-graph', {
            params: {
                graph_id: String(graph_id),
                query: String(query)
            }
        });
        res.json(response.data);
    }
    catch (error) {
        console.error('Error searching graph:', {
            message: error.message,
            response_status: (_a = error.response) === null || _a === void 0 ? void 0 : _a.status,
            response_data: (_b = error.response) === null || _b === void 0 ? void 0 : _b.data,
            code: error.code
        });
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return res.status(503).json({
                error: 'AI service is currently unavailable',
                message: 'The Python service on port 8000 is not responding. Please ensure it is running.'
            });
        }
        // Return the actual error from Python service if available
        const errorMessage = ((_d = (_c = error.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.error) || ((_f = (_e = error.response) === null || _e === void 0 ? void 0 : _e.data) === null || _f === void 0 ? void 0 : _f.message) || 'Failed to search graph';
        res.status(((_g = error.response) === null || _g === void 0 ? void 0 : _g.status) || 500).json({ error: errorMessage });
    }
});
exports.searchGraph = searchGraph;
const semanticSearchGraph = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g;
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
        const response = yield axiosConfig_1.pythonServiceClient.get('/semantic-search-graph', {
            params: {
                graph_id: String(graph_id),
                query: String(query),
                top_k: Number(top_k)
            }
        });
        res.json(response.data);
    }
    catch (error) {
        console.error('Error in semantic search:', {
            message: error.message,
            response_status: (_a = error.response) === null || _a === void 0 ? void 0 : _a.status,
            response_data: (_b = error.response) === null || _b === void 0 ? void 0 : _b.data,
            code: error.code
        });
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return res.status(503).json({
                error: 'AI service is currently unavailable',
                message: 'The Python service on port 8000 is not responding. Please ensure it is running.'
            });
        }
        // Return the actual error from Python service if available
        const errorMessage = ((_d = (_c = error.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.error) || ((_f = (_e = error.response) === null || _e === void 0 ? void 0 : _e.data) === null || _f === void 0 ? void 0 : _f.message) || 'Failed to perform semantic search';
        res.status(((_g = error.response) === null || _g === void 0 ? void 0 : _g.status) || 500).json({ error: errorMessage });
    }
});
exports.semanticSearchGraph = semanticSearchGraph;
