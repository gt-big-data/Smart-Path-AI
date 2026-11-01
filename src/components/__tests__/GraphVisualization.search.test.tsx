import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Node } from 'reactflow';
import GraphVisualization from '../GraphVisualization';

const flow = vi.hoisted(() => ({ getNode: vi.fn(), setCenter: vi.fn(), fitView: vi.fn() }));

vi.mock('reactflow', async () => {
  const React = await import('react');
  const useNodesState = (initial: Node[]) => {
    const [nodes, setNodes] = React.useState(initial);
    return [nodes, setNodes, () => {}];
  };
  function Flow({ nodes, onInit }: { nodes: Node[]; onInit: (instance: unknown) => void }) {
    const current = React.useRef(nodes);
    current.current = nodes;
    const instance = React.useRef({
      getNode: (id: string) => {
        flow.getNode(id);
        return current.current.find(node => node.id === id);
      },
      getZoom: () => 0.2,
      setCenter: flow.setCenter,
      fitView: flow.fitView,
    });
    React.useEffect(() => { onInit(instance.current); }, [onInit]);
    return null;
  }
  return {
    default: Flow, useNodesState, useEdgesState: useNodesState,
    Background: () => null, Controls: () => null, MiniMap: () => null,
    Handle: () => null, Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  };
});

const data = {
  status: 'success', graph_id: 'graph1',
  graph: {
    nodes: ['center', 'alpha', 'beta'].map(id => ({
      id, labels: ['Topic'], properties: { name: id, isCenter: id === 'center' },
    })),
    relationships: ['alpha', 'beta'].map(id => ({ source: 'center', target: id, type: 'HAS_TOPIC' })),
  },
};
const progress: [] = [];
const fetchMock = vi.fn<typeof fetch>();
let view: ReactTestRenderer;

function response(ids: string[]): Response {
  return { json: async () => ({ status: 'success', node_ids: ids }) } as Response;
}

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>(done => { resolve = done; });
  return { promise, resolve };
}

async function query(value: string) {
  await act(async () => { view.root.findByType('input').props.onChange({ target: { value } }); });
}

async function enter() {
  await act(async () => {
    view.root.findByType('input').props.onKeyDown({ key: 'Enter', preventDefault: vi.fn() });
  });
}

async function debounce() {
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  fetchMock.mockReset();
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('fetch', fetchMock);
  await act(async () => { view = create(<GraphVisualization data={data} conceptProgress={progress} />); });
});

afterEach(async () => {
  await act(async () => { view.unmount(); });
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('graph search navigation', () => {
  it('waits for the current query when Enter is pressed during the debounce', async () => {
    fetchMock.mockResolvedValueOnce(response(['alpha'])).mockResolvedValueOnce(response(['beta']));
    await query('alpha');
    await debounce();
    await query('beta');
    await enter();

    expect(flow.getNode).not.toHaveBeenCalled();
    await debounce();
    expect(flow.getNode).toHaveBeenCalledExactlyOnceWith('beta');
    expect(flow.setCenter).toHaveBeenCalledTimes(1);
  });

  it('opens the first result when Enter precedes the first search response', async () => {
    const pending = deferredResponse();
    fetchMock.mockReturnValue(pending.promise);
    await query('beta');
    await debounce();
    await enter();
    expect(flow.getNode).not.toHaveBeenCalled();

    await act(async () => { pending.resolve(response(['beta'])); });
    expect(flow.getNode).toHaveBeenCalledExactlyOnceWith('beta');
  });

  it('opens an already loaded current result immediately without another request', async () => {
    fetchMock.mockResolvedValue(response(['alpha']));
    await query('alpha');
    await debounce();
    await enter();
    expect(flow.getNode).toHaveBeenCalledExactlyOnceWith('alpha');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('waits for the selected search mode instead of opening a keyword result', async () => {
    fetchMock.mockResolvedValueOnce(response(['alpha'])).mockResolvedValueOnce(response(['beta']));
    await query('alpha');
    await debounce();
    const semantic = view.root.findAllByType('button').find(button => button.children.includes('Semantic'))!;
    await act(async () => { semantic.props.onClick(); });
    await enter();
    expect(flow.getNode).not.toHaveBeenCalled();

    await debounce();
    expect(String(fetchMock.mock.calls[1][0])).toContain('/semantic-search-graph?');
    expect(flow.getNode).toHaveBeenCalledExactlyOnceWith('beta');
  });

  it('ignores an older request that completes after the current request', async () => {
    const old = deferredResponse();
    fetchMock.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response(['beta']));
    await query('alpha');
    await debounce();
    await query('beta');
    await debounce();
    await act(async () => { old.resolve(response(['alpha'])); });
    await enter();
    expect(flow.getNode).toHaveBeenCalledExactlyOnceWith('beta');
  });

  it('cancels queued navigation when the query is cleared', async () => {
    const pending = deferredResponse();
    fetchMock.mockReturnValue(pending.promise);
    await query('alpha');
    await debounce();
    await enter();
    await query('');
    await act(async () => { pending.resolve(response(['alpha'])); });
    await debounce();
    expect(flow.getNode).not.toHaveBeenCalled();
  });

  it('does not carry queued navigation to another graph', async () => {
    const pending = deferredResponse();
    fetchMock.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(response(['beta']));
    await query('alpha');
    await debounce();
    await enter();
    await act(async () => {
      view.update(<GraphVisualization data={{ ...data, graph_id: 'graph2' }} conceptProgress={progress} />);
    });
    await debounce();
    await act(async () => { pending.resolve(response(['alpha'])); });
    expect(flow.getNode).not.toHaveBeenCalled();
  });

  it('does not navigate when the current search has no rendered results', async () => {
    fetchMock.mockResolvedValue(response(['missing']));
    await query('missing');
    await enter();
    await debounce();
    expect(flow.getNode).not.toHaveBeenCalled();
  });
});
