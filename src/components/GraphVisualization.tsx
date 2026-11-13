import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactFlow, { MiniMap, NodeMouseHandler, NodeProps, ReactFlowInstance, useEdgesState, useNodesState } from 'reactflow';
import 'reactflow/dist/style.css';
import './graph/graph-flow.css';
import PathBar from './graph/PathBar';
import { buildGraphTree } from '../lib/graphTree';
import { useCollapse } from '../lib/collapse';
import { getPathHighlight } from '../lib/pathHighlight';
import { buildSearchResultItems } from '../lib/searchResults';
import { applyGraphStyles, BaseGraph, NodeEdit, PATH_COLOR, resolveConfidenceScores } from '../lib/graphStyles';
import { buildBaseGraph, DEFAULT_NODE_SIZE } from '../lib/buildBaseGraph';
import { getNodeColor } from '../lib/graphPalette';
import type { GraphData } from '../types/graph';
import type { ConceptProgress } from '../types/chat';
import { GraphNode } from './graph/GraphNode';
import { NodeEditState } from './graph/nodeEdit';
import NodeEditPopup from './graph/NodeEditPopup';
import GraphSearchBar from './graph/GraphSearchBar';
import GraphZoomControls from './graph/GraphZoomControls';
import GraphLegend from './graph/GraphLegend';
import GraphFocusHint from './graph/GraphFocusHint';
import GraphLoader from './graph/GraphLoader';
import GraphEmptyState from './graph/GraphEmptyState';
import { useGraphSearch } from './graph/useGraphSearch';
import { graphView } from './graph/graphClasses';

// Path bar preview with hardcoded steps; wired up in P2b. Keep hidden until it is wired
// to the loaded graph and active path.
const SHOW_PATH_BAR = false;

// Rings from the center that the first view zooms to; the rest of the graph is a pan away
const INITIAL_FOCUS_DEPTH = 2;

// Zoom a clicked search result is shown at, at least, so its label is readable
const SEARCH_RESULT_MIN_ZOOM = 0.8;

// Opacity of nodes outside the category picked in the legend
const CATEGORY_DIM_OPACITY = 0.18;

interface GraphVisualizationProps {
  data: GraphData | null;
  conceptProgress: ConceptProgress[];
  isLoading?: boolean;
  onFocusChange?: (label: string | null) => void;
  focusClearToken?: number;
}

/**
 * The knowledge graph: React Flow canvas plus search, zoom, legend and the selected-concept hint.
 * Structure lives in buildBaseGraph; styling layers (confidence, edits, search, path, collapse,
 * category) are combined by applyGraphStyles, so a restyle never moves nodes.
 */
const GraphVisualization: React.FC<GraphVisualizationProps> = ({
  data,
  conceptProgress,
  isLoading = false,
  onFocusChange,
  focusClearToken = 0,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [activePathTargetId, setActivePathTargetId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [minimapLocked, setMinimapLocked] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [nodeEditState, setNodeEditState] = useState<NodeEditState | null>(null);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);

  // Custom label/color edits by node id. Kept apart from the nodes so a restyle doesn't drop them,
  // and tagged with the graph they were made on so a newly loaded graph doesn't inherit them.
  const [nodeEditsState, setNodeEditsState] = useState<{ graph: BaseGraph | null; byId: Record<string, NodeEdit> }>(
    { graph: null, byId: {} }
  );

  const search = useGraphSearch(data);
  const { searchQuery, searchMode, searchContext, hasCurrentSearchResponse, searchResults, isSearching } = search;
  const { setSearchQuery, setSearchMode, setPendingSearchNavigation, pendingSearchNavigation } = search;

  const graphTree = useMemo(
    () => buildGraphTree(data?.graph ?? { nodes: [], relationships: [] }),
    [data?.graph]
  );

  const baseGraph = useMemo(
    () => (data?.graph ? buildBaseGraph(data, graphTree) : null),
    [data, graphTree]
  );

  const activePath = useMemo(
    () => (activePathTargetId ? getPathHighlight(graphTree, activePathTargetId) : null),
    [activePathTargetId, graphTree]
  );

  const clearActivePath = useCallback(() => {
    setActivePathTargetId(null);
  }, []);

  const appliedClearToken = useRef(focusClearToken);
  useEffect(() => {
    if (focusClearToken === appliedClearToken.current) return;
    appliedClearToken.current = focusClearToken;
    clearActivePath();
  }, [focusClearToken, clearActivePath]);

  const focusedLabel = useMemo(() => {
    if (!activePathTargetId) return null;
    const label = nodes.find((node) => node.id === activePathTargetId)?.data?.label;
    return typeof label === 'string' ? label : null;
  }, [activePathTargetId, nodes]);

  useEffect(() => {
    onFocusChange?.(focusedLabel);
  }, [focusedLabel, onFocusChange]);

  // Category color of the highlighted node: its glow and path edges take it
  const activePathColor = useMemo(() => {
    const node = baseGraph?.nodes.find((n) => n.id === activePathTargetId);
    return typeof node?.data?.color === 'string' ? node.data.color : PATH_COLOR;
  }, [baseGraph, activePathTargetId]);

  // Clicking the highlighted node again clears its path; the center always clears it
  const handleNodeClick = useCallback<NodeMouseHandler>(
    (_, node) => {
      if (node.id === graphTree.centerId) {
        clearActivePath();
        return;
      }
      setActivePathTargetId((current) => (current === node.id ? null : node.id));
    },
    [clearActivePath, graphTree.centerId]
  );

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clearActivePath();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [clearActivePath]);

  useEffect(() => {
    if (activePathTargetId && !graphTree.nodes.has(activePathTargetId)) {
      clearActivePath();
    }
  }, [activePathTargetId, clearActivePath, graphTree]);

  // Close the edit popup when clicking elsewhere
  useEffect(() => {
    if (!nodeEditState) return;
    const handler = () => setNodeEditState(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [nodeEditState]);

  const handleNodeEditSave = (nodeId: string, label: string, color: string) => {
    setNodeEditsState(prev => ({
      graph: baseGraph,
      byId: { ...(prev.graph === baseGraph ? prev.byId : {}), [nodeId]: { label, color } },
    }));
  };

  // The center and its nearest rings, for the first view of each graph
  const initialFocusNodes = useMemo(() => {
    if (!baseGraph) return [];
    const rendered = new Set(baseGraph.nodes.map(node => node.id));
    return graphTree.order
      .filter(id => rendered.has(id) && (graphTree.nodes.get(id)?.depth ?? Infinity) <= INITIAL_FOCUS_DEPTH)
      .map(id => ({ id }));
  }, [baseGraph, graphTree]);

  // Styling layers, each its own piece of state, combined in one place
  const confidenceScores = useMemo(
    () => resolveConfidenceScores(baseGraph?.confidenceKeys ?? [], conceptProgress),
    [baseGraph, conceptProgress]
  );
  const nodeEdits = useMemo(
    () => (nodeEditsState.graph === baseGraph ? nodeEditsState.byId : {}),
    [nodeEditsState, baseGraph]
  );
  // The search API may return numeric ids; node ids are strings
  const searchHits = useMemo(() => new Set(searchResults.map(String)), [searchResults]);
  const collapse = useCollapse(graphTree, baseGraph?.nodes);

  // Passed to every GraphNode as props: the pencil opens the editor, the badge toggles a branch.
  // Both callbacks are stable, so React Flow keeps the same nodeTypes across renders.
  const nodeTypes = useMemo(() => ({
    default: (props: NodeProps) => (
      <GraphNode {...props} onEditRequest={setNodeEditState} onToggleCollapse={collapse.toggleCollapsed} />
    ),
  }), [collapse.toggleCollapsed]);

  const styledGraph = useMemo(() => {
    if (!baseGraph) return null;
    const styled = applyGraphStyles(baseGraph, {
      confidenceScores,
      nodeEdits,
      searchHits,
      activePath,
      collapse: collapse.layer,
      pathColor: activePathColor,
    });
    if (!activeCategory) return styled;
    return {
      nodes: styled.nodes.map(node => ({
        ...node,
        style: { ...node.style, opacity: node.data.type === activeCategory ? 1 : CATEGORY_DIM_OPACITY },
      })),
      edges: styled.edges,
    };
  }, [baseGraph, confidenceScores, nodeEdits, searchHits, activePath, activePathColor, collapse.layer, activeCategory]);

  // Push the styled graph into React Flow. A new base graph replaces everything; a style-only
  // change keeps what React Flow tracks itself (dragged positions, measured sizes, selection).
  const syncedBaseRef = useRef<BaseGraph | null>(null);
  useEffect(() => {
    if (!styledGraph) return;

    if (syncedBaseRef.current !== baseGraph) {
      syncedBaseRef.current = baseGraph;
      setNodes(styledGraph.nodes);
      setEdges(styledGraph.edges);
      return;
    }

    setNodes(prev => {
      const prevById = new Map(prev.map(node => [node.id, node]));
      return styledGraph.nodes.map(node => {
        const current = prevById.get(node.id);
        // A node that gets hidden is deselected too, so Backspace can't delete it unseen
        return current
          ? { ...current, data: node.data, style: node.style, hidden: node.hidden, selected: current.selected && !node.hidden }
          : node;
      });
    });
    setEdges(prev => {
      const prevById = new Map(prev.map(edge => [edge.id, edge]));
      return styledGraph.edges.map(edge => {
        const current = prevById.get(edge.id);
        return current ? { ...edge, selected: current.selected && !edge.hidden } : edge;
      });
    });
  }, [baseGraph, styledGraph, setNodes, setEdges]);

  // Normal relationship labels stay hidden until their edge is hovered. Path edges
  // keep the label and animation supplied by applyGraphStyles.
  const visibleEdges = useMemo(() => {
    const baseEdgesById = new Map((baseGraph?.edges ?? []).map(edge => [edge.id, edge]));

    return edges.map(edge => {
      const hovered = edge.id === hoveredEdgeId;
      if (!hovered || edge.animated) return edge;

      const baseEdge = baseEdgesById.get(edge.id);
      return {
        ...edge,
        label: baseEdge?.label,
        labelStyle: { ...edge.labelStyle, fill: '#374151' },
        zIndex: Math.max(Number(edge.zIndex ?? 0), 1),
      };
    });
  }, [baseGraph, edges, hoveredEdgeId]);

  // Search hits as list rows, in the order the API ranked them
  const searchResultItems = useMemo(
    () => buildSearchResultItems(searchResults.map(String), styledGraph?.nodes ?? [], graphTree),
    [searchResults, styledGraph, graphTree]
  );

  // Open a search result: show its path and pan to it, keeping the current zoom unless it's too far out to read.
  // TODO(C1): call expandTo(nodeId) first so a result inside a collapsed branch is shown.
  const handleSearchResultClick = useCallback((nodeId: string) => {
    if (nodeId === graphTree.centerId) clearActivePath();
    else setActivePathTargetId(nodeId);

    if (!flowInstance) return;
    requestAnimationFrame(() => {
      const node = flowInstance.getNode(nodeId);
      if (!node) return;
      const position = node.positionAbsolute ?? node.position;
      const width = node.width ?? DEFAULT_NODE_SIZE.width;
      const height = node.height ?? DEFAULT_NODE_SIZE.height;
      flowInstance.setCenter(position.x + width / 2, position.y + height / 2, {
        zoom: Math.max(flowInstance.getZoom(), SEARCH_RESULT_MIN_ZOOM),
        duration: 600,
      });
    });
  }, [clearActivePath, flowInstance, graphTree.centerId]);

  const handleSearchSubmit = () => {
    if (!hasCurrentSearchResponse) setPendingSearchNavigation(searchContext);
    else if (searchResultItems.length > 0) handleSearchResultClick(searchResultItems[0].id);
  };

  useEffect(() => {
    if (!pendingSearchNavigation) return;
    if (pendingSearchNavigation !== searchContext) {
      setPendingSearchNavigation(null);
      return;
    }
    if (!hasCurrentSearchResponse) return;
    setPendingSearchNavigation(null);
    if (searchResultItems.length > 0) handleSearchResultClick(searchResultItems[0].id);
  }, [pendingSearchNavigation, searchContext, hasCurrentSearchResponse, searchResultItems, handleSearchResultClick, setPendingSearchNavigation]);

  // Zoom to the center's nearest rings once per graph, after its nodes reach React Flow
  const fittedBaseRef = useRef<BaseGraph | null>(null);
  useEffect(() => {
    if (!flowInstance || !baseGraph || fittedBaseRef.current === baseGraph || initialFocusNodes.length === 0) return;
    fittedBaseRef.current = baseGraph;
    const frame = requestAnimationFrame(() => {
      flowInstance.fitView({ nodes: initialFocusNodes, padding: 0.2, minZoom: 0.1, maxZoom: 1, duration: 600 });
    });
    return () => cancelAnimationFrame(frame);
  }, [flowInstance, baseGraph, initialFocusNodes]);

  if (!data?.graph) {
    return (
      <div className={`graph-view ${graphView}`}>
        {isLoading
          ? <GraphLoader title="Building knowledge graph" detail="Extracting concepts and relationships…" />
          : <GraphEmptyState />}
      </div>
    );
  }

  const legendEntries = (baseGraph?.nodeTypes ?? [])
    .map(type => ({ type, color: getNodeColor(type, baseGraph?.subject) }))
    .sort((a, b) => a.type.localeCompare(b.type));

  return (
    <div className={`graph-view ${graphView}`}>
      {/* Portaled to <body> because the Chat page wraps the graph in a backdrop-blur panel,
          which would make position: fixed relative to that panel. */}
      {nodeEditState && createPortal(
        <NodeEditPopup
          editState={nodeEditState}
          onClose={() => setNodeEditState(null)}
          onSave={handleNodeEditSave}
        />,
        document.body
      )}

      <GraphSearchBar
        query={searchQuery}
        mode={searchMode}
        isSearching={isSearching}
        results={searchResultItems}
        activeNodeId={activePathTargetId}
        onQueryChange={setSearchQuery}
        onModeChange={setSearchMode}
        onSubmit={handleSearchSubmit}
        onResultClick={handleSearchResultClick}
      />

      {SHOW_PATH_BAR && (
        <div style={{ position: 'absolute', top: 64, left: 14, zIndex: 30, width: 'min(340px, calc(100% - 230px))' }}>
          <PathBar
            steps={[
              { id: 'linear-algebra', label: 'Linear Algebra' },
              { id: 'vector-spaces', label: 'Vector spaces' },
              { id: 'eigenvalues', label: 'Eigenvalues' },
            ]}
            onStepClick={() => {}}
            onFocus={() => {}}
            onClear={() => {}}
          />
        </div>
      )}

      <GraphZoomControls
        onZoomIn={() => flowInstance?.zoomIn()}
        onZoomOut={() => flowInstance?.zoomOut()}
        onReset={() => flowInstance?.fitView()}
        minimapLocked={minimapLocked}
        onToggleMinimapLock={() => setMinimapLocked(locked => !locked)}
      />

      {focusedLabel && <GraphFocusHint label={focusedLabel} onClear={clearActivePath} />}

      <GraphLegend
        entries={legendEntries}
        activeType={activeCategory}
        onSelect={(type) => setActiveCategory(current => (current === type ? null : type))}
      />

      <ReactFlow
        nodes={nodes}
        edges={visibleEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={clearActivePath}
        onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
        onEdgeMouseLeave={(_, edge) => setHoveredEdgeId(currentId => (currentId === edge.id ? null : currentId))}
        nodeTypes={nodeTypes}
        onInit={setFlowInstance}
        minZoom={0.1}
        maxZoom={4}
        defaultViewport={{ x: 0, y: 0, zoom: 0.2 }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
          style: { strokeWidth: 2 },
          labelStyle: { fontSize: 12, fill: '#888' },
        }}
      >
        <MiniMap
          nodeColor={(n) => (n.style?.background as string) || '#fff'}
          zoomable={!minimapLocked}
          pannable={!minimapLocked}
          maskColor="rgba(0, 0, 0, 0.2)"
        />
      </ReactFlow>
    </div>
  );
};

export default GraphVisualization;
