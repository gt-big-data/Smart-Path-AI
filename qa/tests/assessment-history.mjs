/** Browser checks against the running Vite client, with all APIs mocked. No real user data or AI calls. */
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const pageErrors = [], apiRequests = [];
page.on('pageerror', error => pageErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') console.error('Browser:', message.text()); });
const date = '2026-11-18T22:00:00Z';
const chats = [
  { chat_id: 'chat1', title: 'Ridge Regression', graph_id: 'graph1', date_created: date, messages: [] },
  { chat_id: 'chat2', title: 'Problem Reductions', graph_id: 'graph2', date_created: date, messages: [] },
];
const draft = { quizId: 'draft', attemptId: 'draft-attempt', chatId: 'chat1', graphId: 'graph1',
  completed: false, scoreAvailable: false, currentQuestionIndex: 0,
  qaData: [
    { question: 'Choose the letter.\nA) Correct option\nB) Wrong\nC) Wrong\nD) Wrong', answer: '', conceptId: 'topic1', format: 'mcq' },
    { question: 'Name the conserved quantity.', answer: '', conceptId: 'topic2', format: 'open-ended' },
  ], results: [null, null] };
const legacy = { quizId: 'legacy', attemptId: 'legacy', completed: true, scoreAvailable: false,
  qaData: [{ question: 'Explain a concept', answer: 'Expected explanation', conceptId: '' }],
  results: [{ answer: 'A differently worded explanation', isCorrect: null, feedback: '', skipped: false }], currentQuestionIndex: 0 };
let generated;
const definition = { sections: [{ name: 'Part I', questions: [{ id: 'q1', label: '1', stem: '',
  parts: [{ id: 'p1', label: 'a', type: 'mcq', prompt: 'Choose the correct letter', choices: ['A','B','C','D'], points: 5, depends_on: [] }] }] }] };
const attempt = id => ({ id, status: id === 'draft-exam' ? 'draft' : 'submitted', answers: [{ part_id: 'p1', user_answer: 'A' }],
  revision: 0, created_at: date, answers_locked: id !== 'draft-exam',
  ...(id !== 'draft-exam' ? { grading: { score: id === 'graded-new' ? 4 : 2, total: 5,
    results: [{ part_id: 'p1', points_earned: id === 'graded-new' ? 4 : 2, points_possible: 5,
      feedback: 'Feedback for '+id, correct_answer: 'A', explanation: 'Expected A' }] } } : {}) });
const examItem = { id: 'exam1', kind: 'exam', title: 'Practice algebra', createdAt: date, status: 'draft', score: 4, total: 5,
  attempts: [{ id: 'draft-exam', status: 'draft', createdAt: date, score: null, total: 5 },
    { id: 'graded-new', status: 'submitted', createdAt: date, score: 4, total: 5 },
    { id: 'graded-old', status: 'submitted', createdAt: date, score: 2, total: 5 }] };
const headers = { 'access-control-allow-origin': 'http://localhost:5173', 'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS' };
await context.route('http://localhost:4000/**', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  apiRequests.push(request.method()+' '+path);
  let data = {}, status = 200;
  if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
  if (path === '/auth/check-auth') data = { authenticated: true, user: { name: 'QA student', email: 'qa@example.test' } };
  else if (path === '/chat/user') data = 'fixture-user';
  else if (path.endsWith('/chats')) data = chats;
  else if (path.includes('folder')) data = [];
  else if (path === '/chat/graph-ids') data = { graphIds: ['graph1','graph2'] };
  else if (path === '/api/concept-progress') data = [];
  else if (path === '/api/view-graph') data = { graph_id: url.searchParams.get('graph_id'), graph: {
    nodes: [{ id: 'node1', labels: ['Topic'], properties: { name: 'Models', topicID: 'topic1', isCenter: true } }], relationships: [] } };
  else if (path === '/api/quiz-history') data = { quizHistories: [] };
  else if (path === '/api/progress/assessments') {
    const kind = url.searchParams.get('kind');
    const items = kind === 'quiz' ? [
      { id: 'draft', title: '2-question quiz', kind, createdAt: date, status: draft.completed ? 'completed' : 'draft',
        score: draft.completed ? 1 : null, total: 2 },
      { id: 'legacy', title: 'Older quiz', kind, createdAt: date, status: 'completed', legacy: true, score: null, total: 1 },
    ] : [examItem, { id: 'zero', title: 'Unscorable exam', kind, createdAt: date, status: 'submitted', score: 0, total: 0, attempts: [] }];
    if (kind === 'quiz' && generated) items.unshift({ id: generated.quizId, title: 'New saved quiz', kind,
      createdAt: date, status: 'draft', score: null, total: 2 });
    data = { items, total: items.length, limit: 20, offset: 0 };
  } else if (path === '/api/generate-questions-with-answers') {
    assert.equal(url.searchParams.get('persist'), 'true');
    generated = { ...structuredClone(draft), quizId: 'new-run', attemptId: url.searchParams.get('attempt_id'),
      completed: false, scoreAvailable: false, currentQuestionIndex: 0, results: [null, null] };
    generated.qaData.forEach(q => q.answer = '');
    data = { status: 'success', quiz: generated };
  } else if (path === '/api/quiz-history/runs/new-run') {
    data = { quiz: generated };
  } else if (path === '/api/quiz-history/runs/draft') {
    draft.currentQuestionIndex = draft.results.findIndex(r => !r);
    if (draft.currentQuestionIndex < 0) draft.currentQuestionIndex = 1;
    data = { quiz: draft };
  } else if (path === '/api/quiz-history/runs/legacy') data = { quiz: legacy };
  else if (path === '/api/verify-answer') {
    const input = request.postDataJSON(), index = input.question_index;
    const result = { answer: input.userAnswer, isCorrect: index === 0, feedback: 'Checked answer', skipped: input.userAnswer === 'SKIPPED' };
    draft.results[index] = result; draft.qaData[index].answer = index === 0 ? 'A' : 'energy';
    data = { ...result, correctAnswer: draft.qaData[index].answer, explanation: 'Saved explanation' };
  } else if (path === '/api/quiz-history/runs/draft/complete') {
    draft.completed = true; draft.scoreAvailable = true; data = { quiz: draft };
  } else if (path === '/api/practice-exams/exam1') data = { id: 'exam1', title: 'Practice algebra', total_points: 5, created_at: date, exam: definition };
  else if (path === '/api/practice-exams/exam1/attempts') data = { attempts: ['draft-exam','graded-new','graded-old'].map(attempt) };
  else if (path.startsWith('/api/practice-exams/exam1/attempts/')) data = { attempt: attempt(path.split('/').at(-1)) };
  else { status = 404; data = { error: 'Unexpected test endpoint '+path }; }
  await route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(data) });
});
// Use the same optimized Router module URL as the real components (including Vite's version query).
const compiled = await (await fetch('http://localhost:5173/src/pages/ProgressPage.tsx')).text();
const routerModule = compiled.match(/from ["']([^"']*react-router-dom[^"']*)["']/)?.[1];
assert.ok(routerModule, 'Could not locate the Vite router module');
const html = `<!doctype html><html><body><div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;
</script><script type="module">
import React from '/node_modules/.vite/deps/react.js';
import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
import {BrowserRouter,Routes,Route} from '${routerModule}';
import {AuthProvider} from '/src/context/AuthContext.tsx';
import ProgressPage from '/src/pages/ProgressPage.tsx';import ChatPage from '/src/pages/Chat.tsx';
import '/src/index.css';
const e=React.createElement;
ReactDOM.createRoot(document.getElementById('root')).render(e(BrowserRouter,null,e(AuthProvider,null,e(Routes,null,
e(Route,{path:'/progress',element:e(ProgressPage)}),e(Route,{path:'/chat',element:e(ChatPage)})))));
</script></body></html>`;
await page.route('http://localhost:5173/**', route => route.request().isNavigationRequest()
  ? route.fulfill({ contentType: 'text/html', body: html }) : route.continue());
try {
  await page.goto('http://localhost:5173/progress');
  await page.getByRole('heading', { name: 'Your study activity' }).waitFor();
  const ridge = page.locator('article').filter({ has: page.getByRole('button', { name: /Ridge Regression/ }) });
  const reductions = page.locator('article').filter({ has: page.getByRole('button', { name: /Problem Reductions/ }) });
  assert.equal(await ridge.count(), 1); assert.equal(await reductions.count(), 1);
  await reductions.getByRole('tab', { name: 'Practice exams' }).click();
  await reductions.getByText('Last graded score: 4/5 (80%)').waitFor();
  await reductions.getByText('Last graded score: Not scored').waitFor();
  assert.equal(apiRequests.some(r => r.includes('generate')), false);
  await reductions.getByText('Attempts (3)').click();
  await reductions.getByRole('button', { name: 'View results' }).first().click();
  await page.getByText('Feedback for graded-new').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('attempt_id'), 'graded-new');
  await page.getByRole('button', { name: 'Back to progress', exact: true }).click();
  await page.getByRole('heading', { name: 'Your study activity' }).waitFor();
  const quizGroup = page.locator('article').filter({ has: page.getByRole('button', { name: /Ridge Regression/ }) });
  await quizGroup.getByRole('tab', { name: 'Quizzes', exact: true }).click();
  await quizGroup.getByText('Score unavailable for this older quiz').waitFor();
  await quizGroup.getByRole('button', { name: 'Review quiz' }).click();
  await page.getByText('Score unavailable for this older quiz.', { exact: false }).waitFor();
  assert.equal(apiRequests.filter(r => r.startsWith('POST /api/verify-answer')).length, 0);
  await page.getByRole('button', { name: 'Close quiz', exact: true }).first().click();
  await page.getByRole('heading', { name: 'Your study activity' }).waitFor();
  await page.locator('article').first().getByRole('tab', { name: 'Quizzes', exact: true }).click();
  await page.getByRole('button', { name: 'Resume quiz', exact: true }).click();
  await page.getByRole('radio', { name: /Correct option/ }).click();
  await page.getByRole('button', { name: 'Check answer', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).waitFor();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await page.getByRole('button', { name: 'Skip', exact: true }).waitFor();
  assert.equal(apiRequests.some(r => r.includes('generate-questions')), false);
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.getByRole('button', { name: 'See results', exact: true }).click();
  await page.getByText('1 of 2 correct.', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Close quiz', exact: true }).first().click();
  await page.getByRole('heading', { name: 'Your study activity' }).waitFor();
  await page.locator('article').first().getByRole('tab', { name: 'Quizzes', exact: true }).click();
  await page.getByText('Score: 1/2 (50%)').waitFor();
  await page.setViewportSize({ width: 480, height: 800 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  const tab = page.locator('article').first().getByRole('tab', { name: 'Quizzes', exact: true });
  await tab.focus(); await page.keyboard.press('ArrowRight');
  await page.locator('article').first().getByRole('tab', { name: 'Practice exams' }).waitFor();
  assert.equal(await page.locator('article').first().getByRole('tab', { name: 'Practice exams' }).getAttribute('aria-selected'), 'true');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://localhost:5173/chat');
  await page.getByRole('button', { name: 'Generate quiz', exact: true }).click();
  await page.locator('.modal-backdrop').getByRole('button', { name: 'Generate quiz', exact: true }).click();
  await page.getByRole('button', { name: 'Check answer', exact: true }).waitFor();
  assert.equal(apiRequests.filter(r => r.includes('/api/generate-questions-with-answers')).length, 1);
  assert.notEqual(generated.attemptId, draft.attemptId);
  await page.goto('http://localhost:5173/progress');
  await page.getByRole('heading', { name: 'Your study activity' }).waitFor();
  await page.locator('article').first().getByRole('tab', { name: 'Quizzes', exact: true }).click();
  await page.getByText('New saved quiz', { exact: true }).waitFor();
  assert.deepEqual(pageErrors, []);
  console.log('PASS Progress includes graphs without confidence; tabs, legacy review, exact exam attempt, server-backed quiz resume, scores, narrow layout, keyboard navigation, and newly generated quiz history.');
} catch (error) {
  console.error('Browser failure:', JSON.stringify({ url: page.url(), pageErrors,
    body: (await page.locator('body').innerText()).slice(0, 2000), apiRequests: apiRequests.slice(-12) }));
  throw error;
} finally { await browser.close(); }
