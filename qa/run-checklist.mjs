/**
 * Runs the automated part of qa/graph-view-checklist.md against every X1 fixture.
 *
 *   npm run qa:harness          # terminal 1 (Vite on :5199)
 *   npm run qa:checklist        # terminal 2
 *
 * Needs Playwright with Chromium. If you don't have it:
 *   npm i --no-save playwright && npx playwright install chromium
 *
 * Writes qa/results/latest.json, qa/results/latest.md and one screenshot per fixture.
 * Search is stubbed: /api/search-graph and /api/semantic-search-graph return the
 * nodes whose name contains the query, so this checks the UI, not search quality.
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'results');
const BASE = process.env.HARNESS_URL ?? 'http://localhost:5199';
const FIXTURES = (process.env.FIXTURES ?? 'small,no-center,history,large').split(',');
fs.mkdirSync(OUT, { recursive: true });

// Values from src/lib/graphStyles.ts
const SEARCH_YELLOW = 'rgb(251, 191, 36)';
const PATH_ORANGE = 'rgb(212, 88, 28)';
const OFF_PATH_NODE_OPACITY = 0.18;
const OFF_PATH_SEARCH_HIT_OPACITY = 0.55;
const OFF_PATH_EDGE_OPACITY = 0.14;

const results = [];
const record = (fixture, id, status, detail) => {
  results.push({ fixture, id, status, detail });
  const mark = { PASS: '✓', FAIL: '✗', INFO: '·' }[status];
  console.log(`  ${mark} ${id} ${status}${detail ? ` — ${detail}` : ''}`);
};

/** One row per rendered node: flow position, size, styles, dots, step badge, label. */
const readNodes = page => page.evaluate(() => {
  return [...document.querySelectorAll('.react-flow__node')].map(el => {
    const m = /translate\(([-\d.e]+)px,\s*([-\d.e]+)px\)/.exec(el.style.transform) ?? [];
    const inner = el.querySelector(':scope > div:not(.react-flow__handle)');
    const dotWrap = inner?.firstElementChild;
    const dots = dotWrap ? [...dotWrap.children] : [];
    const filled = dots.filter(d => d.style.backgroundColor && d.style.backgroundColor !== 'transparent').length;
    const badge = el.querySelector('[aria-label^="Path step"]');
    const text = [...(inner?.childNodes ?? [])].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    return {
      id: el.getAttribute('data-id'),
      x: Number(m[1]), y: Number(m[2]),
      w: el.offsetWidth, h: el.offsetHeight,
      opacity: Number(el.style.opacity || 1),
      border: el.style.border,
      boxShadow: el.style.boxShadow,
      background: el.style.background || el.style.backgroundColor,
      dotCount: dots.length,
      filled,
      step: badge ? Number(badge.textContent) : null,
      label: text,
    };
  });
});

const readEdges = page => page.evaluate(() => {
  return [...document.querySelectorAll('.react-flow__edge')].map(el => {
    const p = el.querySelector('.react-flow__edge-path');
    return {
      id: (el.getAttribute('data-testid') ?? '').replace(/^rf__edge-/, ''),
      animated: el.classList.contains('animated'),
      label: el.querySelector('.react-flow__edge-text')?.textContent ?? null,
      stroke: p?.style.stroke ?? '',
      opacity: Number(p?.style.opacity || 1),
    };
  });
});

const qa = page => page.evaluate(() => {
  const q = window.__qa;
  return { fixtureName: q.fixtureName, graphId: q.graphId, centerId: q.centerId, order: q.order, depth: q.depth, nodes: q.nodes, expectedScores: q.expectedScores };
});

const settle = (page, ms = 450) => page.waitForTimeout(ms);
const viewport = page => page.evaluate(() => {
  const m = /translate\(([-\d.e]+)px,\s*([-\d.e]+)px\)\s*scale\(([-\d.e]+)\)/.exec(document.querySelector('.react-flow__viewport').style.transform);
  return { x: Number(m[1]), y: Number(m[2]), zoom: Number(m[3]) };
});
const posKey = nodes => JSON.stringify(nodes.map(n => [n.id, Math.round(n.x), Math.round(n.y)]).sort());
const clickNodeEl = (page, id) => page.evaluate(id => {
  document.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true }));
}, id);
const clickPane = page => page.evaluate(() => {
  document.querySelector('.react-flow__pane').dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
const focus = async (page, id, zoom = 0.8) => {
  await page.evaluate(([id, zoom]) => window.__qaFocus(id, zoom), [id, zoom]);
  await settle(page, 300);
};
const expectedDots = s => (s === null || s === undefined ? 0 : s > 0.7 ? 3 : s > 0.4 ? 2 : s > 0 ? 1 : 0);

async function runFixture(browser, fixture) {
  console.log(`\n${fixture}`);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  // Search stub
  const searchCalls = [];
  let nodeNames = [];
  await page.route(/\/api\/(semantic-)?search-graph/, route => {
    const url = new URL(route.request().url());
    const q = (url.searchParams.get('query') ?? '').toLowerCase();
    searchCalls.push({ endpoint: url.pathname, graphId: url.searchParams.get('graph_id'), query: q });
    const ids = nodeNames.filter(n => (n.name ?? '').toLowerCase().includes(q)).map(n => n.id);
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': BASE, 'Access-Control-Allow-Credentials': 'true' },
      body: JSON.stringify({ status: 'success', node_ids: ids }),
    });
  });

  await page.goto(`${BASE}/?fixture=${fixture}`);
  const ctx0 = await page.evaluate(() => window.__qa?.nodes?.length);
  await page.waitForFunction(n => document.querySelectorAll('.react-flow__node').length >= n, ctx0, { timeout: 60000 });
  const renderMs = await page.evaluate(() => performance.now() - window.__qaLoadStart);
  await settle(page, 1000); // initial fitView animates for 600ms
  const ctx = await qa(page);
  nodeNames = ctx.nodes;

  // ---------- Load & layout (L1, #41) ----------
  let nodes = await readNodes(page);
  record(fixture, 'L-01 every node renders', nodes.length === ctx.nodes.length ? 'PASS' : 'FAIL', `${nodes.length}/${ctx.nodes.length} nodes, first render ${renderMs.toFixed(0)} ms in browser`);

  let overlapping = 0;
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j];
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlapping++;
  }
  record(fixture, 'L-02 no node boxes overlap (rendered DOM size)', overlapping === 0 ? 'PASS' : 'FAIL', `${overlapping} overlapping pairs`);

  const center = nodes.find(n => n.id === ctx.centerId);
  const atOrigin = center && Math.abs(center.x + center.w / 2) < 1 && Math.abs(center.y + center.h / 2) < 1;
  record(fixture, 'L-03 tree center sits at the layout origin', atOrigin ? 'PASS' : 'FAIL',
    `center "${ctx.nodes.find(n => n.id === ctx.centerId)?.name}"${fixture === 'no-center' ? ' (no isCenter flag: fallback pick)' : ''}`);

  // Ring order: mean distance from the center grows with depth
  const meanR = {};
  for (const n of nodes) {
    const d = ctx.depth[n.id];
    const r = Math.hypot(n.x + n.w / 2, n.y + n.h / 2);
    (meanR[d] ??= []).push(r);
  }
  const ringMeans = Object.keys(meanR).map(Number).sort((a, b) => a - b).map(d => meanR[d].reduce((s, r) => s + r, 0) / meanR[d].length);
  const ringsOrdered = ringMeans.every((r, i) => i === 0 || r > ringMeans[i - 1]);
  record(fixture, 'L-04 deeper nodes sit on wider rings', ringsOrdered ? 'PASS' : 'FAIL', `mean radius by depth: ${ringMeans.map(r => r.toFixed(0)).join(' < ')}`);

  // Initial view: center and depth 1-2 in the viewport
  const vp = await viewport(page);
  const box = await page.locator('.react-flow').boundingBox();
  const onScreen = n => {
    const sx = vp.x + n.x * vp.zoom, sy = vp.y + n.y * vp.zoom;
    return sx + n.w * vp.zoom > 0 && sx < box.width && sy + n.h * vp.zoom > 0 && sy < box.height;
  };
  const near = nodes.filter(n => ctx.depth[n.id] <= 2);
  const nearOn = near.filter(onScreen).length;
  record(fixture, 'L-05 first view shows the center and its first two rings', nearOn === near.length ? 'PASS' : 'FAIL', `${nearOn}/${near.length} on screen at zoom ${vp.zoom.toFixed(2)} (minZoom 0.1); ring 1 mean radius ${ringMeans[1]?.toFixed(0)} px`);
  await page.screenshot({ path: path.join(OUT, `${fixture}-initial.png`) });

  // ---------- Edges (#32) ----------
  let edges = await readEdges(page);
  const labelled = edges.filter(e => e.label).length;
  const animated = edges.filter(e => e.animated).length;
  record(fixture, 'E-01 no edge labels or animation at rest', labelled === 0 && animated === 0 ? 'PASS' : 'FAIL', `${labelled} labelled, ${animated} animated of ${edges.length}`);

  // Hover: find a point on an on-screen edge that isn't under a node and move the mouse there
  const hoverPoint = await page.evaluate(() => {
    for (const g of document.querySelectorAll('.react-flow__edge')) {
      const p = g.querySelector('.react-flow__edge-interaction') ?? g.querySelector('.react-flow__edge-path');
      const len = p.getTotalLength();
      for (const t of [0.5, 0.35, 0.65, 0.2, 0.8]) {
        const pt = p.getPointAtLength(len * t);
        const m = p.getScreenCTM();
        const x = pt.x * m.a + pt.y * m.c + m.e, y = pt.x * m.b + pt.y * m.d + m.f;
        if (x < 20 || y < 140 || x > innerWidth - 300 || y > innerHeight - 200) continue;
        const hit = document.elementFromPoint(x, y);
        if (hit && g.contains(hit)) return { x, y, id: g.getAttribute('data-testid') };
      }
    }
    return null;
  });
  if (hoverPoint) {
    await page.mouse.move(hoverPoint.x, hoverPoint.y);
    await settle(page, 250);
    edges = await readEdges(page);
    const shown = edges.filter(e => e.label);
    record(fixture, 'E-02 hovering an edge shows its label', shown.length === 1 ? 'PASS' : 'FAIL', shown.length ? `"${shown[0].label}"` : 'no label appeared');
    await page.mouse.move(5, 5);
    await settle(page, 250);
    edges = await readEdges(page);
    record(fixture, 'E-03 label hides again when the mouse leaves', edges.every(e => !e.label) ? 'PASS' : 'FAIL', '');
  } else {
    record(fixture, 'E-02 hovering an edge shows its label', 'INFO', 'no uncovered edge segment on screen to hover');
  }

  // ---------- Confidence dots ----------
  nodes = await readNodes(page);
  const dotMismatch = nodes.filter(n => n.dotCount !== 3 || n.filled !== expectedDots(ctx.expectedScores[n.id]));
  const scored = Object.keys(ctx.expectedScores).length;
  record(fixture, 'C-01 every node has three dots, filled per score (>0, >0.4, >0.7)', dotMismatch.length === 0 ? 'PASS' : 'FAIL',
    dotMismatch.length === 0 ? `${scored} scored nodes incl. boundaries 0, 0.4, 0.7; ${nodes.length - scored} unscored` :
      dotMismatch.slice(0, 3).map(n => `${n.label}: ${n.filled} filled, expected ${expectedDots(ctx.expectedScores[n.id])} (score ${ctx.expectedScores[n.id]})`).join('; '));

  const zeroScoreIds = Object.entries(ctx.expectedScores).filter(([, s]) => s === 0).map(([id]) => id);
  const unscored = nodes.find(n => !(n.id in ctx.expectedScores));
  const zero = nodes.find(n => zeroScoreIds.includes(n.id));
  if (zero && unscored) {
    record(fixture, 'C-02 score 0 looks different from "no score yet"', zero.filled !== unscored.filled ? 'PASS' : 'FAIL',
      `both show ${zero.filled} filled dots; a student can't tell "never quizzed" from "got it all wrong"`);
  }

  const before = posKey(nodes);
  await page.evaluate(() => window.__qa.shiftProgress(3));
  await settle(page);
  const ctxShift = await qa(page);
  nodes = await readNodes(page);
  const liveMismatch = nodes.filter(n => n.filled !== expectedDots(ctxShift.expectedScores[n.id]));
  record(fixture, 'C-03 dots update when progress changes, without moving nodes', liveMismatch.length === 0 && posKey(nodes) === before ? 'PASS' : 'FAIL',
    `${liveMismatch.length} stale nodes, positions ${posKey(nodes) === before ? 'unchanged' : 'MOVED'}`);
  await page.evaluate(() => window.__qa.shiftProgress(0));
  await settle(page);

  // Fixture data: many Topics carry the literal string "apoc.create.uuid()" as topicID
  await page.evaluate(() => window.__qa.setRawProgress([{ conceptId: 'apoc.create.uuid()', confidenceScore: 0.9 }]));
  await settle(page);
  nodes = await readNodes(page);
  const lit = nodes.filter(n => n.filled === 3).length;
  record(fixture, 'C-04 one progress entry lights at most one node', lit <= 1 ? 'PASS' : 'FAIL',
    `a single entry with conceptId "apoc.create.uuid()" filled ${lit} nodes (fixture Topics share that literal topicID)`);

  const shortId = ctx.centerId.split(':').pop();
  await page.evaluate(id => window.__qa.setRawProgress([{ conceptId: id, confidenceScore: 0.9 }]), shortId);
  await settle(page);
  nodes = await readNodes(page);
  const litShort = nodes.filter(n => n.filled === 3).length;
  record(fixture, 'C-05 short or partial conceptIds don\'t match unrelated nodes', litShort <= 1 ? 'PASS' : 'FAIL',
    `conceptId "${shortId}" filled ${litShort} nodes via the substring fallback in resolveConfidenceScores`);
  await page.evaluate(() => window.__qa.shiftProgress(0));
  await settle(page);

  // ---------- Path highlight (P1) ----------
  nodes = await readNodes(page);
  const restPositions = posKey(nodes);
  const target = nodes.find(n => ctx.depth[n.id] === 2) ?? nodes.find(n => ctx.depth[n.id] === 1);
  const expectedPath = await page.evaluate(id => window.__qa.pathTo(id), target.id);
  await focus(page, target.id);
  const tb = await page.locator(`.react-flow__node[data-id="${target.id}"]`).boundingBox();
  await page.mouse.click(tb.x + tb.width / 2, tb.y + tb.height / 2);
  await settle(page);
  nodes = await readNodes(page);
  edges = await readEdges(page);
  const stepsOk = expectedPath.every((id, i) => nodes.find(n => n.id === id)?.step === i + 1);
  const badgeCount = nodes.filter(n => n.step !== null).length;
  record(fixture, 'P-01 clicking a node numbers its path from the center', stepsOk && badgeCount === expectedPath.length ? 'PASS' : 'FAIL',
    `${expectedPath.map(id => ctx.nodes.find(n => n.id === id)?.name).join(' › ')}`);
  const offPath = nodes.filter(n => !expectedPath.includes(n.id));
  const dimOk = offPath.every(n => Math.abs(n.opacity - OFF_PATH_NODE_OPACITY) < 0.01);
  const pathBorderOk = expectedPath.every(id => nodes.find(n => n.id === id)?.border.includes(PATH_ORANGE));
  record(fixture, 'P-02 path nodes get the orange border, others fade', dimOk && pathBorderOk ? 'PASS' : 'FAIL', `${offPath.length} faded to ${OFF_PATH_NODE_OPACITY}`);
  const pathEdges = edges.filter(e => e.animated);
  const pathEdgesOk = pathEdges.length === expectedPath.length - 1 && pathEdges.every(e => e.label && e.stroke === PATH_ORANGE);
  const otherEdgesOk = edges.filter(e => !e.animated).every(e => !e.label && Math.abs(e.opacity - OFF_PATH_EDGE_OPACITY) < 0.01);
  record(fixture, 'P-03 only path edges are animated, orange and labelled', pathEdgesOk && otherEdgesOk ? 'PASS' : 'FAIL',
    `${pathEdges.length} path edges for ${expectedPath.length} nodes`);
  await page.screenshot({ path: path.join(OUT, `${fixture}-path.png`) });

  await page.keyboard.press('Escape');
  await settle(page);
  nodes = await readNodes(page);
  record(fixture, 'P-04 Escape clears the path', nodes.every(n => n.step === null && n.opacity === 1) ? 'PASS' : 'FAIL', '');

  await clickNodeEl(page, target.id);
  await settle(page, 200);
  await clickPane(page);
  await settle(page);
  nodes = await readNodes(page);
  record(fixture, 'P-05 clicking empty canvas clears the path', nodes.every(n => n.step === null && n.opacity === 1) ? 'PASS' : 'FAIL', '');

  await clickNodeEl(page, target.id);
  await settle(page, 200);
  await clickNodeEl(page, ctx.centerId);
  await settle(page);
  nodes = await readNodes(page);
  record(fixture, 'P-06 clicking the center clears the path', nodes.every(n => n.step === null) ? 'PASS' : 'FAIL', '');

  const deepest = ctx.order[ctx.order.length - 1];
  const deepPath = await page.evaluate(id => window.__qa.pathTo(id), deepest);
  await clickNodeEl(page, deepest);
  await settle(page);
  nodes = await readNodes(page);
  const deepOk = deepPath.every((id, i) => nodes.find(n => n.id === id)?.step === i + 1);
  record(fixture, 'P-07 deepest node gets a full path', deepOk ? 'PASS' : 'FAIL', `${deepPath.length} steps (depth ${ctx.depth[deepest]})`);
  await page.keyboard.press('Escape');
  await settle(page);
  record(fixture, 'P-08 path clicks never move nodes', posKey(await readNodes(page)) === restPositions ? 'PASS' : 'FAIL', '');

  const pathBar = await page.getByRole('button', { name: 'Focus' }).count();
  record(fixture, 'P-09 unfinished path bar stays hidden', pathBar === 0 ? 'PASS' : 'FAIL', '');

  // ---------- Search (regression) ----------
  const named = ctx.nodes.find(n => ctx.depth[n.id] === 2 && n.id !== target.id && n.name && /[a-z]{5,}/i.test(n.name)) ?? ctx.nodes[1];
  const query = (named.name.match(/[A-Za-z]{5,}/) ?? [named.name])[0];
  const expectedHits = ctx.nodes.filter(n => (n.name ?? '').toLowerCase().includes(query.toLowerCase())).map(n => n.id);
  const input = page.getByPlaceholder('Search topics, concepts, definitions...');
  await input.fill(query);
  await settle(page, 900);
  nodes = await readNodes(page);
  const hitNodes = nodes.filter(n => n.border.includes(SEARCH_YELLOW));
  const callOk = searchCalls.length > 0 && searchCalls.at(-1).graphId === ctx.graphId && searchCalls.at(-1).endpoint.endsWith('/api/search-graph');
  record(fixture, 'S-01 keyword search calls /api/search-graph with this graph_id', callOk ? 'PASS' : 'FAIL', `query "${query}", ${searchCalls.length} call(s) after debounce`);
  const hitsOk = hitNodes.length === expectedHits.length && expectedHits.every(id => hitNodes.some(n => n.id === id));
  record(fixture, 'S-02 every hit gets the yellow border, nothing else does', hitsOk ? 'PASS' : 'FAIL', `${hitNodes.length} highlighted, ${expectedHits.length} returned`);
  const foundText = await page.getByText(/Found \d+ matching node/).textContent().catch(() => '');
  record(fixture, 'S-03 "Found N matching nodes" matches the hit count', foundText.includes(`Found ${expectedHits.length} matching node`) ? 'PASS' : 'FAIL', foundText);

  // Search hit stays visible while a path is shown
  const offPathHit = expectedHits.find(id => !expectedPath.includes(id) && id !== ctx.centerId);
  await clickNodeEl(page, target.id);
  await settle(page);
  nodes = await readNodes(page);
  if (!offPathHit) {
    record(fixture, 'S-04 off-path search hit keeps a yellow ring at 0.55 opacity', 'INFO', 'every hit was on the path; not exercised');
  } else {
    const h = nodes.find(n => n.id === offPathHit);
    record(fixture, 'S-04 off-path search hit keeps a yellow ring at 0.55 opacity', h.boxShadow.includes(SEARCH_YELLOW) && Math.abs(h.opacity - OFF_PATH_SEARCH_HIT_OPACITY) < 0.01 ? 'PASS' : 'FAIL', `opacity ${h.opacity}`);
  }
  await page.keyboard.press('Escape');
  await settle(page);

  const callsBefore = searchCalls.length;
  await page.getByRole('button', { name: 'Semantic' }).click();
  await settle(page, 900);
  const sem = searchCalls.slice(callsBefore);
  record(fixture, 'S-05 Semantic toggle re-runs the query on /api/semantic-search-graph', sem.some(c => c.endpoint.endsWith('/semantic-search-graph')) ? 'PASS' : 'FAIL', `${sem.length} new call(s)`);
  await page.getByRole('button', { name: 'Keyword' }).click();
  await settle(page, 900);

  // Clear with the X button
  await input.locator('xpath=..').locator('button').first().click();
  await settle(page, 700);
  nodes = await readNodes(page);
  record(fixture, 'S-06 clearing the box removes every highlight', nodes.every(n => !n.border.includes(SEARCH_YELLOW) && !n.boxShadow.includes(SEARCH_YELLOW)) ? 'PASS' : 'FAIL', '');

  const noHitQuery = 'zzqqxx';
  await input.fill(noHitQuery);
  await settle(page, 900);
  const foundNone = await page.getByText(/Found \d+ matching node/).count();
  nodes = await readNodes(page);
  record(fixture, 'S-07 a query with no hits shows no list and no highlights', foundNone === 0 && nodes.every(n => !n.border.includes(SEARCH_YELLOW)) ? 'PASS' : 'FAIL', '');
  await input.fill('');
  await settle(page, 700);
  record(fixture, 'S-08 searching never moves nodes', posKey(await readNodes(page)) === restPositions ? 'PASS' : 'FAIL', '');

  // ---------- Node editing (F3, regression) ----------
  nodes = await readNodes(page);
  const editTarget = nodes.find(n => ctx.depth[n.id] === 1);
  await focus(page, editTarget.id);
  const pencil = page.locator(`.react-flow__node[data-id="${editTarget.id}"] [aria-label="Edit node"]`);
  await pencil.click();
  await settle(page, 300);
  const popupOpen = await page.getByText('Edit Node', { exact: true }).isVisible();
  nodes = await readNodes(page);
  record(fixture, 'N-01 pencil opens the popup without starting a path', popupOpen && nodes.every(n => n.step === null) ? 'PASS' : 'FAIL', '');

  const popup = page.locator('body > div').filter({ hasText: 'Edit Node' }).last();
  const pb = await page.getByText('Edit Node', { exact: true }).locator('xpath=ancestor::div[contains(@style,"position: fixed")][1]').boundingBox().catch(() => null);
  const inView = pb && pb.x >= 0 && pb.y >= 0 && pb.x + pb.width <= 1440 && pb.y + pb.height <= 900;
  record(fixture, 'N-02 popup sits fully inside the window', inView ? 'PASS' : 'FAIL', pb ? `at ${pb.x.toFixed(0)},${pb.y.toFixed(0)}` : 'popup box not found');

  const newLabel = `QA edited ${fixture}`;
  const labelInput = popup.locator('input[type="text"]');
  await labelInput.fill(newLabel);
  const swatch = popup.locator('button[title^="rgb"]').nth(2);
  const swatchColor = await swatch.getAttribute('title');
  await swatch.click();
  await popup.getByRole('button', { name: 'Apply' }).click();
  await settle(page);
  nodes = await readNodes(page);
  const edited = nodes.find(n => n.id === editTarget.id);
  // Palette entries are rgba(r, g, b, 1); the browser serialises them as rgb(r, g, b)
  const toRgb = c => c.replace(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*1\)$/, 'rgb($1, $2, $3)');
  const editOk = edited.label === newLabel && edited.background.includes(toRgb(swatchColor));
  record(fixture, 'N-03 Apply changes the label and color', editOk ? 'PASS' : 'FAIL', `label "${edited.label}", background ${edited.background}`);
  record(fixture, 'N-04 editing never moves nodes', posKey(nodes) === restPositions ? 'PASS' : 'FAIL', '');

  // Edit survives other layers
  await input.fill(query);
  await settle(page, 900);
  await clickNodeEl(page, target.id);
  await settle(page);
  await page.evaluate(() => window.__qa.shiftProgress(2));
  await settle(page);
  await page.keyboard.press('Escape');
  await input.fill('');
  await settle(page, 700);
  nodes = await readNodes(page);
  const still = nodes.find(n => n.id === editTarget.id);
  record(fixture, 'N-05 edit survives search, path and progress changes', still.label === newLabel && still.background.includes(toRgb(swatchColor)) ? 'PASS' : 'FAIL', '');
  const editedDots = still.filled === expectedDots((await qa(page)).expectedScores[editTarget.id]);
  record(fixture, 'N-06 edited node keeps live confidence dots', editedDots ? 'PASS' : 'FAIL', `${still.filled} filled`);

  // Cancel and click-outside discard changes
  const other = nodes.find(n => ctx.depth[n.id] === 1 && n.id !== editTarget.id);
  await focus(page, other.id);
  await page.locator(`.react-flow__node[data-id="${other.id}"] [aria-label="Edit node"]`).click();
  await settle(page, 200);
  await page.locator('body > div').filter({ hasText: 'Edit Node' }).last().locator('input[type="text"]').fill('SHOULD NOT SAVE');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await settle(page, 200);
  await page.locator(`.react-flow__node[data-id="${other.id}"] [aria-label="Edit node"]`).click();
  await settle(page, 200);
  await page.locator('body > div').filter({ hasText: 'Edit Node' }).last().locator('input[type="text"]').fill('SHOULD NOT SAVE');
  await page.mouse.click(30, 300);
  await settle(page, 300);
  nodes = await readNodes(page);
  const closed = !(await page.getByText('Edit Node', { exact: true }).isVisible().catch(() => false));
  record(fixture, 'N-07 Cancel and clicking outside close without saving', closed && nodes.find(n => n.id === other.id).label !== 'SHOULD NOT SAVE' ? 'PASS' : 'FAIL', '');

  // Drag then restyle keeps the dragged spot
  const dragEl = page.locator(`.react-flow__node[data-id="${other.id}"]`);
  const db = await dragEl.boundingBox();
  await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2);
  await page.mouse.down();
  await page.mouse.move(db.x + db.width / 2 + 120, db.y + db.height / 2 + 60, { steps: 8 });
  await page.mouse.up();
  await settle(page, 200);
  const draggedPos = (await readNodes(page)).find(n => n.id === other.id);
  await page.evaluate(() => window.__qa.shiftProgress(5));
  await input.fill(query);
  await settle(page, 900);
  const afterRestyle = (await readNodes(page)).find(n => n.id === other.id);
  const moved = Math.hypot(draggedPos.x - nodes.find(n => n.id === other.id).x, draggedPos.y - nodes.find(n => n.id === other.id).y) > 20;
  record(fixture, 'R-01 a dragged node stays put through search and progress updates', moved && Math.abs(afterRestyle.x - draggedPos.x) < 1 && Math.abs(afterRestyle.y - draggedPos.y) < 1 ? 'PASS' : 'FAIL',
    moved ? '' : 'drag did not move the node');
  await input.fill('');
  await settle(page, 600);

  // Loading another graph drops edits
  const nextFixture = fixture === 'small' ? 'no-center' : 'small';
  await page.evaluate(n => window.__qa.loadFixture(n), nextFixture);
  await page.waitForFunction(n => window.__qa.fixtureName === n, nextFixture);
  await settle(page, 1200);
  nodes = await readNodes(page);
  const leaked = nodes.filter(n => n.label.startsWith('QA edited'));
  record(fixture, 'N-08 edits don\'t carry over to the next graph', leaked.length === 0 ? 'PASS' : 'FAIL', `switched to ${nextFixture}`);
  await page.evaluate(n => window.__qa.loadFixture(n), fixture);
  await page.waitForFunction(n => window.__qa.fixtureName === n, fixture);
  await settle(page, 1200);
  nodes = await readNodes(page);
  record(fixture, 'N-09 reopening the same graph starts without edits', nodes.every(n => !n.label.startsWith('QA edited')) ? 'PASS' : 'FAIL',
    'edits are session-only by design: nothing is sent to the server');

  const errs = errors.filter(e => !/favicon/.test(e));
  record(fixture, 'G-01 no console errors or page errors', errs.length === 0 ? 'PASS' : 'FAIL', errs.slice(0, 2).join(' | '));

  await page.close();
  return renderMs;
}

const browser = await chromium.launch();
const renderTimes = {};
for (const f of FIXTURES) {
  try {
    renderTimes[f] = await runFixture(browser, f);
  } catch (err) {
    record(f, 'RUNNER', 'FAIL', `runner crashed: ${err.message.split('\n')[0]}`);
  }
}
await browser.close();

// ---------- Report ----------
const ids = [...new Set(results.map(r => r.id))];
const cell = (f, id) => {
  const r = results.find(x => x.fixture === f && x.id === id);
  return r ? { PASS: '✅', FAIL: '❌', INFO: 'ℹ️' }[r.status] : '—';
};
let md = `# Graph view checklist: automated run\n\nRun ${new Date().toISOString()} · fixtures: ${FIXTURES.join(', ')}\n\n`;
md += `| Check | ${FIXTURES.join(' | ')} |\n|---|${FIXTURES.map(() => ':-:').join('|')}|\n`;
for (const id of ids) md += `| ${id} | ${FIXTURES.map(f => cell(f, id)).join(' | ')} |\n`;
md += `\n## Failures and notes\n\n`;
for (const r of results.filter(r => r.status !== 'PASS')) md += `- **${r.fixture} · ${r.id}**: ${r.detail}\n`;
md += `\n## Browser first-render time (harness load to all nodes in the DOM)\n\n`;
for (const [f, t] of Object.entries(renderTimes)) md += `- ${f}: ${t.toFixed(0)} ms\n`;
fs.writeFileSync(path.join(OUT, 'latest.md'), md);
fs.writeFileSync(path.join(OUT, 'latest.json'), JSON.stringify({ results, renderTimes }, null, 2));

const fails = results.filter(r => r.status === 'FAIL').length;
console.log(`\n${results.length - fails}/${results.length} checks passed · report: qa/results/latest.md`);
