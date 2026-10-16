const assert = require('node:assert/strict');
const { test } = require('node:test');
const ChatConceptProgress = require('../models/ChatConceptProgress').default;
const QuizHistory = require('../models/QuizHistory').default;
const { normalizeSessionUserId } = require('../services/chatService');
const {
  buildConfidenceUpdatePipeline,
  confidenceDelta,
  deleteChatProgressAndHistory,
  getChatConfidenceMap,
  getUserConceptProgress,
  normalizeConceptId,
  updateChatConceptConfidence,
} = require('../services/progressService');

const userId = '64b000000000000000000001';

test('normalizes string and deserialized Passport user IDs', () => {
  assert.equal(normalizeSessionUserId(userId), userId);
  assert.equal(normalizeSessionUserId({ _id: userId }), userId);
  assert.equal(normalizeSessionUserId({ id: userId }), userId);
  assert.equal(normalizeSessionUserId(null), '');
});

test('normalizes legacy concept identifier fields to one stable value', () => {
  assert.equal(normalizeConceptId({ topic_id: ' topic-123 ' }), 'topic-123');
  assert.equal(normalizeConceptId({ conceptID: 'topic-123' }), 'topic-123');
  assert.equal(normalizeConceptId(' node-element-123 '), 'node-element-123');
  assert.equal(normalizeConceptId({ id: 'concept-id' }), 'concept-id');
});

test('preserves confidence score deltas and bounds', () => {
  assert.equal(confidenceDelta(true, false), 0.1);
  assert.equal(confidenceDelta(true, true), 0.05);
  assert.equal(confidenceDelta(false, false), -0.1);
});

test('uses an atomic user/chat/concept filter and an idempotency guard', async t => {
  const original = ChatConceptProgress.findOneAndUpdate;
  let captured;
  ChatConceptProgress.findOneAndUpdate = async (...args) => {
    captured = args;
    return { confidence_score: 0.6 };
  };
  t.after(() => { ChatConceptProgress.findOneAndUpdate = original; });

  await updateChatConceptConfidence({
    userId,
    chatId: 'chat-1',
    conceptId: { topicID: 'topic-1' },
    isCorrect: true,
    isRetry: false,
    attemptId: 'quiz-1:0',
  });

  assert.equal(captured[0].user.toString(), userId);
  assert.equal(captured[0].chat_id, 'chat-1');
  assert.equal(captured[0].concept_id, 'topic-1');
  assert.equal(captured[2].upsert, true);
  assert.deepEqual(
    captured[1][0].$set.processed_attempt_ids.$cond[0].$in[0],
    { $literal: 'quiz-1:0' }
  );

  const uniqueIndex = ChatConceptProgress.schema.indexes().find(([keys, options]) =>
    keys.user === 1 && keys.chat_id === 1 && keys.concept_id === 1 && options.unique
  );
  assert.ok(uniqueIndex, 'Mongo enforces one progress record per user/chat/concept');
});

test('reads confidence from Mongo for exactly the requested chat', async t => {
  const original = ChatConceptProgress.find;
  let capturedFilter;
  ChatConceptProgress.find = filter => {
    capturedFilter = filter;
    return Promise.resolve([
      { concept_id: 'topic-1', confidence_score: 0.25 },
      { concept_id: 'node-2', confidence_score: 0.8 },
    ]);
  };
  t.after(() => { ChatConceptProgress.find = original; });

  const scores = await getChatConfidenceMap(userId, 'chat-1');
  assert.equal(capturedFilter.user.toString(), userId);
  assert.equal(capturedFilter.chat_id, 'chat-1');
  assert.deepEqual(scores, { 'topic-1': 0.25, 'node-2': 0.8 });
});

test('chat progress endpoint data excludes unscoped legacy records', async t => {
  const original = ChatConceptProgress.find;
  let capturedFilter;
  ChatConceptProgress.find = filter => {
    capturedFilter = filter;
    return Promise.resolve([{
      concept_id: 'topic-1',
      confidence_score: 0.4,
      chat_id: 'chat-1',
      last_attempted: new Date(0),
      toObject: () => ({ concept_id: 'topic-1', confidence_score: 0.4, chat_id: 'chat-1' }),
    }]);
  };
  t.after(() => { ChatConceptProgress.find = original; });

  const progress = await getUserConceptProgress(userId, 'chat-1');
  assert.equal(capturedFilter.user.toString(), userId);
  assert.equal(capturedFilter.chat_id, 'chat-1');
  assert.equal(progress.length, 1);
  assert.equal(progress[0].legacy, undefined);
});

test('chat deletion removes only the matching user and chat records', async t => {
  const originalProgressDelete = ChatConceptProgress.deleteMany;
  const originalHistoryDelete = QuizHistory.deleteMany;
  const calls = [];
  ChatConceptProgress.deleteMany = async filter => {
    calls.push(['progress', filter]);
    return { deletedCount: 2 };
  };
  QuizHistory.deleteMany = async filter => {
    calls.push(['history', filter]);
    return { deletedCount: 1 };
  };
  t.after(() => {
    ChatConceptProgress.deleteMany = originalProgressDelete;
    QuizHistory.deleteMany = originalHistoryDelete;
  });

  const result = await deleteChatProgressAndHistory(userId, 'chat-1');
  assert.deepEqual(result, { progressDeleted: 2, quizHistoriesDeleted: 1 });
  assert.equal(calls[0][1].user.toString(), userId);
  assert.equal(calls[0][1].chat_id, 'chat-1');
  assert.equal(calls[1][1].userID, userId);
  assert.equal(calls[1][1].chat_id, 'chat-1');
  assert.equal(calls.some(([, filter]) => filter.chat_id === 'chat-2'), false);
});

test('confidence update aggregation leaves an already-processed attempt unchanged', () => {
  const pipeline = buildConfidenceUpdatePipeline(0.1, 'quiz-1:0', new Date('2026-10-16T00:00:00Z'));
  const scoreCondition = pipeline[0].$set.confidence_score.$cond;
  assert.deepEqual(scoreCondition[0].$in[1], { $ifNull: ['$processed_attempt_ids', []] });
  assert.deepEqual(scoreCondition[1], { $ifNull: ['$confidence_score', 0.5] });
  assert.deepEqual(pipeline[0].$set.processed_attempt_ids.$cond[1], { $ifNull: ['$processed_attempt_ids', []] });
});