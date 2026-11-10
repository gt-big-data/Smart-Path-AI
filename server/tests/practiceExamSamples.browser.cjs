/** Real-browser component regression test. Run with Vite on localhost:5174 and
 * Playwright available in NODE_PATH. All API calls are intercepted; no app data
 * or credentials are read. See PRACTICE_EXAM_UI.md for the command.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

test('save a PDF, reuse after reload, recover generation failures and reject oversized uploads', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
    const errors = [];
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
    const samples = [];
    let uploads = 0, generations = 0, failGeneration = false;
    await page.route('**/api/practice-exams/**', async route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: {
          'Access-Control-Allow-Origin': 'http://127.0.0.1:5174',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Headers': 'content-type',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        } });
      }
      let body;
      if (url.pathname.endsWith('/samples') && request.method() === 'GET') {
        body = { samples, total: samples.length };
      } else if (url.pathname.endsWith('/samples')) {
        uploads++;
        assert.match(request.postData(), /name="chat_id"\r\n\r\nchat-test/);
        assert.match(request.postData(), /filename="chemistry.pdf"/);
        if (!samples.length) samples.push({ id: 'sample-1', chat_id: 'chat-test',
          filename: 'chemistry.pdf', size_bytes: 1234, created_at: '2026-11-09T12:00:00Z' });
        body = { sample: samples[0] };
      } else {
        generations++;
        assert.deepEqual(request.postDataJSON(), { chat_id: 'chat-test', sample_pdf_id: 'sample-1' });
        body = failGeneration ? { error: 'Generation unavailable' } : { id: `exam-${generations}`, title: 'Fresh exam' };
      }
      return route.fulfill({ status: failGeneration && !url.pathname.endsWith('/samples') ? 502 : 200,
        contentType: 'application/json', body: JSON.stringify(body), headers: {
          'Access-Control-Allow-Origin': 'http://127.0.0.1:5174', 'Access-Control-Allow-Credentials': 'true',
        } });
    });
    // Mount the actual production component with a minimal parent that provides
    // the panel's busy/error callbacks. The Vite refresh preamble is required.
    await page.route('**/pdf-browser-test', route => route.fulfill({ contentType: 'text/html', body: `
      <html><body><div id="root"></div>
      <script type="module">
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {};
        window.$RefreshSig$ = () => type => type;
        window.__vite_plugin_react_preamble_installed__ = true;
        const { default: React } = await import('/node_modules/.vite/deps/react.js');
        const { useState } = React;
        const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
        const { createRoot } = ReactDOM;
        const { default: Samples } = await import('/src/components/PracticeExamSamples.tsx');
        await import('/src/index.css');
        function App() {
          const [busy, setBusy] = useState(false), [error, setError] = useState('');
          const [result, setResult] = useState('');
          const act = async (label, action) => {
            setBusy(true); setError('');
            try { await action(); } catch (e) { setError(e.response?.data?.error || e.message); }
            finally { setBusy(false); }
          };
          return React.createElement('main', { style: { padding: 24 } },
            React.createElement('p', { id: 'test-error' }, error),
            React.createElement('p', { id: 'test-result' }, result),
            React.createElement(Samples, { chatId: 'chat-test', busy, act,
              onGenerated: value => setResult(value.id), refreshExams: async () => {} }));
        }
        createRoot(document.getElementById('root')).render(React.createElement(App));
      </script></body></html>` }));
    await page.goto('http://127.0.0.1:5174/pdf-browser-test');
    await page.getByText('No sample PDFs saved on this page.', { exact: false }).waitFor();
    const generate = page.getByRole('button', { name: 'Generate exam', exact: true });
    assert.equal(await generate.isDisabled(), true);
    await page.getByLabel('Upload a new sample exam PDF').setInputFiles({
      name: 'chemistry.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\ntest'),
    });
    await page.getByRole('button', { name: 'Save PDF', exact: true }).click();
    await page.getByText('PDF saved.', { exact: false }).waitFor();
    assert.equal(uploads, 1); assert.equal(generations, 0);
    assert.equal(await page.getByRole('radio').isChecked(), true);
    assert.match(await page.getByRole('link', { name: 'View PDF chemistry.pdf' }).getAttribute('href'), /samples\/sample-1\/file$/);
    await page.reload();
    await page.getByRole('radio').check();
    await generate.click();
    await page.locator('#test-result').filter({ hasText: 'exam-1' }).waitFor();
    assert.equal(uploads, 1);
    failGeneration = true;
    await generate.click();
    await page.getByText('Your sample PDF is saved.', { exact: false }).waitFor();
    await page.locator('#test-error').filter({ hasText: 'Generation unavailable' }).waitFor();
    failGeneration = false;
    await generate.click();
    await page.locator('#test-result').filter({ hasText: 'exam-3' }).waitFor();
    assert.equal(uploads, 1);
    if (process.env.PRACTICE_EXAM_BROWSER_SCREENSHOT) {
      await page.screenshot({ path: process.env.PRACTICE_EXAM_BROWSER_SCREENSHOT, fullPage: true });
    }
    await page.getByLabel('Upload a new sample exam PDF').setInputFiles({
      name: 'oversized.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
    });
    await page.getByRole('button', { name: 'Save PDF', exact: true }).click();
    await page.locator('#test-error').filter({ hasText: 'at most 10 MB' }).waitFor();
    assert.equal(uploads, 1);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
