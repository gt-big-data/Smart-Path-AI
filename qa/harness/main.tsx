/**
 * QA harness for the graph view (T1, issue #35).
 *
 * Mounts the real GraphVisualization with an X1 fixture and a made-up
 * concept-progress list, with no backend and no login. The checklist runner
 * (qa/run-checklist.mjs) drives it through Playwright; you can also open it by
 * hand: npm run qa:harness, then http://localhost:5199/?fixture=large
 *
 * Search calls go to ${API_BASE_URL}/api/search-graph as usual. The runner
 * stubs them; opened by hand they need the Express server on :4000.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlowProvider, useReactFlow } from 'reactflow';
import GraphVisualization from '../../src/components/GraphVisualization';
import { buildGraphTree, pathTo, RawGraph } from '../../src/lib/graphTree';
import '../../src/index.css';

type Fixture = { status: string; subject?: string; graph_id: string; graph: RawGraph };
type Progress = { conceptId: string; confidenceScore: number };

// Hooks the runner reads and calls through page.evaluate
const qaWindow = window as unknown as Record<string, unknown>;
type GraphData = React.ComponentProps<typeof GraphVisualization>['data'];

const modules = import.meta.glob('../../src/lib/__fixtures__/*.json', { eager: true }) as Record<string, { default: Fixture }>;
const FIXTURES: Record<string, Fixture> = Object.fromEntries(
  Object.entries(modules).map(([file, mod]) => [file.split('/').pop()!.replace('.json', ''), mod.default])
);

/**
 * Scores chosen to sit on each side of the dot thresholds (>0, >0.4, >0.7).
 * Expected filled dots (the runner checks these): 0 -> 0, 0.2 -> 1, 0.4 -> 1, 0.41 -> 2, 0.7 -> 2, 0.71 -> 3, 1 -> 3.
 */
const SCORE_SCHEDULE = [0, 0.2, 0.4, 0.41, 0.7, 0.71, 1];

/**
 * Progress for the first nodes after the center, in tree order. Even slots are
 * keyed by node id, odd slots by name (`quiz_<name>`), so both lookup paths in
 * resolveConfidenceScores are exercised. Every other node gets no entry.
 */
function makeProgress(fixture: Fixture, shift = 0) {
  const tree = buildGraphTree(fixture.graph);
  const byId = new Map(fixture.graph.nodes.map(n => [String(n.id), n]));
  const progress: Progress[] = [];
  const expected: Record<string, number> = {};
  tree.order.slice(1, 1 + SCORE_SCHEDULE.length * 2).forEach((id, i) => {
    const score = SCORE_SCHEDULE[(i + shift) % SCORE_SCHEDULE.length];
    const name = byId.get(id)?.properties?.name as string | undefined;
    const conceptId = i % 2 === 1 && name && !name.includes('_') ? `quiz_${name}` : id;
    progress.push({ conceptId, confidenceScore: score });
    expected[id] = score;
  });
  return { progress, expected };
}

/**
 * GraphVisualization renders its own <ReactFlow>. Wrapping it in a provider makes
 * that ReactFlow use the provider's store, so the runner can pan to a node
 * without touching the component.
 */
function QaBridge() {
  const flow = useReactFlow();
  useEffect(() => {
    qaWindow.__qaFocus = (id: string, zoom = 0.8) => {
      const n = flow.getNode(id);
      if (!n) return false;
      const p = n.positionAbsolute ?? n.position;
      flow.setCenter(p.x + (n.width ?? 0) / 2, p.y + (n.height ?? 0) / 2, { zoom, duration: 0 });
      return true;
    };
  }, [flow]);
  return null;
}

function Harness() {
  const params = new URLSearchParams(location.search);
  const [fixtureName, setFixtureName] = useState(params.get('fixture') ?? 'small');
  const fixture = FIXTURES[fixtureName];
  const [progressState, setProgressState] = useState(() => makeProgress(fixture));
  const tree = useMemo(() => buildGraphTree(fixture.graph), [fixture]);

  // Fresh data object per fixture switch, like Chat.tsx after a graph load
  const data = useMemo(() => ({ ...fixture }), [fixture]);

  useEffect(() => {
    const depth: Record<string, number> = {};
    tree.nodes.forEach((n, id) => { depth[id] = n.depth; });
    qaWindow.__qa = {
      fixtureName,
      fixtures: Object.keys(FIXTURES),
      graphId: fixture.graph_id,
      centerId: tree.centerId,
      order: tree.order,
      depth,
      nodes: fixture.graph.nodes.map(n => ({ id: String(n.id), name: n.properties?.name, labels: n.labels })),
      pathTo: (id: string) => pathTo(tree, id),
      expectedScores: progressState.expected,
      scheduleSize: SCORE_SCHEDULE.length,
      loadFixture: (name: string) => {
        qaWindow.__qaLoadStart = performance.now();
        setFixtureName(name);
        setProgressState(makeProgress(FIXTURES[name]));
      },
      shiftProgress: (shift: number) => setProgressState(makeProgress(fixture, shift)),
      setRawProgress: (progress: Progress[]) => setProgressState({ progress, expected: {} }),
    };
  }, [fixtureName, fixture, tree, progressState]);

  return (
    <>
      <div id="qa-bar">
        <strong>QA harness</strong>
        {Object.keys(FIXTURES).sort().map(name => (
          <button key={name} data-fixture={name} onClick={() => (qaWindow.__qa as { loadFixture: (n: string) => void }).loadFixture(name)} disabled={name === fixtureName}>
            {name}
          </button>
        ))}
        <span data-testid="qa-fixture">{fixtureName}</span>
      </div>
      <div id="qa-graph">
        <ReactFlowProvider>
          <GraphVisualization data={data as GraphData} conceptProgress={progressState.progress} />
          <QaBridge />
        </ReactFlowProvider>
      </div>
    </>
  );
}

qaWindow.__qaLoadStart = performance.now();
createRoot(document.getElementById('root')!).render(<Harness />);
