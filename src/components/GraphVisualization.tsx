//GraphVisualization.tsx
import React, { useCallback, useEffect, memo, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  NodeProps,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Search, X } from 'lucide-react';
import { computeNodeSizes } from '../lib/nodesizing';

interface GraphData {
  status: string;
  subject?: string;
  graph: {
    nodes: any[];
    relationships: any[];
  };
}

interface ConceptProgress {
  conceptId: string;
  confidenceScore: number;
  lastAttempted?: Date;
}

const SUBJECT_MAP: { [key: string]: string } = {
  'math': 'math',
  'mathematics': 'math',
  'english': 'english',
  'literature': 'english',
  'history': 'history',
  'science': 'science',
  'other': 'default',
  'default': 'default',
};

interface GraphVisualizationProps {
  data: GraphData | null;
  conceptProgress: ConceptProgress[];
  isLoading?: boolean;
}

interface CustomNodeProps extends NodeProps {
  style?: React.CSSProperties;
}

// Node edit popup state interface
interface NodeEditState {
  nodeId: string;
  label: string;
  color: string;
  x: number;
  y: number;
}

const COLOR_PALETTE = {
  BLUE: 'rgba(59, 130, 246, 1)',
  INDIGO: 'rgba(99, 102, 241, 1)',
  PURPLE: 'rgba(139, 92, 246, 1)',
  PINK: 'rgba(236, 72, 153, 1)',
  RED: 'rgba(239, 68, 68, 1)',
  ORANGE: 'rgba(249, 115, 22, 1)',
  AMBER: 'rgba(245, 158, 11, 1)',
  YELLOW: 'rgba(234, 179, 8, 1)',
  LIME: 'rgba(132, 204, 22, 1)',
  GREEN: 'rgba(34, 197, 94, 1)',
  EMERALD: 'rgba(16, 185, 129, 1)',
  TEAL: 'rgba(20, 184, 166, 1)',
  CYAN: 'rgba(6, 182, 212, 1)',
  SKY: 'rgba(14, 165, 233, 1)',
  VIOLET: 'rgba(124, 58, 237, 1)',
  FUCHSIA: 'rgba(217, 70, 239, 1)',
  ROSE: 'rgba(244, 63, 94, 1)',
  SLATE: 'rgba(100, 116, 139, 1)',
};

const subjectColorSchemes: { [subject: string]: { [nodeType: string]: string } } = {
  base: {
    Topic: COLOR_PALETTE.BLUE,
    Subtopic: COLOR_PALETTE.TEAL,
    Definition: COLOR_PALETTE.PURPLE,
    Example: COLOR_PALETTE.PINK,
    Source: COLOR_PALETTE.SLATE,
    Application: COLOR_PALETTE.ORANGE,
  },
  
  english: {
    Topic: COLOR_PALETTE.BLUE,
    Subtopic: COLOR_PALETTE.TEAL,
    Definition: COLOR_PALETTE.PURPLE,
    Example: COLOR_PALETTE.PINK,
    Work: COLOR_PALETTE.INDIGO,
    Author: COLOR_PALETTE.VIOLET,
    LiteraryDevice: COLOR_PALETTE.FUCHSIA,
    Theme: COLOR_PALETTE.ROSE,
    CriticalTheory: COLOR_PALETTE.AMBER,
    Application: COLOR_PALETTE.ORANGE,
    Genre: COLOR_PALETTE.CYAN,
  },
  
  history: {
    Topic: COLOR_PALETTE.BLUE,
    Event: COLOR_PALETTE.RED,
    Figure: COLOR_PALETTE.VIOLET,
    Location: COLOR_PALETTE.GREEN,
    Concept: COLOR_PALETTE.PURPLE,
    Document: COLOR_PALETTE.AMBER,
    Cause: COLOR_PALETTE.ORANGE,
    Consequence: COLOR_PALETTE.PINK,
    Definition: COLOR_PALETTE.TEAL,
    Source: COLOR_PALETTE.SLATE,
  },
  
  math: {
    Topic: COLOR_PALETTE.BLUE,
    Subtopic: COLOR_PALETTE.TEAL,
    Definition: COLOR_PALETTE.PURPLE,
    Example: COLOR_PALETTE.PINK,
    Formula: COLOR_PALETTE.GREEN,
    Property: COLOR_PALETTE.CYAN,
    Theorem: COLOR_PALETTE.AMBER,
    Proof: COLOR_PALETTE.ORANGE,
    Application: COLOR_PALETTE.VIOLET,
  },
  
  mathematics: {
    Topic: COLOR_PALETTE.BLUE,
    Subtopic: COLOR_PALETTE.TEAL,
    Definition: COLOR_PALETTE.PURPLE,
    Example: COLOR_PALETTE.PINK,
    Formula: COLOR_PALETTE.GREEN,
    Property: COLOR_PALETTE.CYAN,
    Theorem: COLOR_PALETTE.AMBER,
    Proof: COLOR_PALETTE.ORANGE,
    Application: COLOR_PALETTE.VIOLET,
  },
  
  science: {
    Topic: COLOR_PALETTE.BLUE,
    Subtopic: COLOR_PALETTE.TEAL,
    Definition: COLOR_PALETTE.PURPLE,
    Example: COLOR_PALETTE.PINK,
    Equation: COLOR_PALETTE.GREEN,
    Principle: COLOR_PALETTE.EMERALD,
    Theory: COLOR_PALETTE.AMBER,
    Evidence: COLOR_PALETTE.CYAN,
    Scientist: COLOR_PALETTE.VIOLET,
    Concept: COLOR_PALETTE.INDIGO,
    Application: COLOR_PALETTE.ORANGE,
    GraphMetadata: COLOR_PALETTE.SLATE,
    MendelianGenetics: COLOR_PALETTE.LIME,
    CellTheory: COLOR_PALETTE.SKY,
    Evolution: COLOR_PALETTE.ROSE,
    Discovery: COLOR_PALETTE.FUCHSIA,
  },
  
  default: {
    Topic: COLOR_PALETTE.BLUE,
    Subtopic: COLOR_PALETTE.TEAL,
    Definition: COLOR_PALETTE.PURPLE,
    Example: COLOR_PALETTE.PINK,
    Source: COLOR_PALETTE.SLATE,
    Application: COLOR_PALETTE.ORANGE,
  },
};

const nodeStyles = {
  padding: '12px 20px',
  fontSize: '18px',
  fontWeight: '500' as const,
  textAlign: 'center' as const,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  letterSpacing: '0.5px',
  lineHeight: '1.3',
  width: '100%',
  height: '100%',
  margin: 0,
  boxSizing: 'border-box' as const,
  borderRadius: '24px',
};

const NodeTooltip = ({ content }: { content: string }) => {
  if (!content) return null;
  
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 0, 0, 0.85)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '13px',
        pointerEvents: 'none',
        zIndex: 1000,
        maxWidth: '250px',
        whiteSpace: 'normal',
        wordBreak: 'break-word',
        textAlign: 'left',
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
      }}
    >
      {content}
    </div>
  );
};

// Loading screen component
const GraphLoadingScreen = ({ isLoading }: { isLoading: boolean }) => {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '20px',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: 'white',
    }}>
      {isLoading ? (
        <>
          {/* Animated graph nodes */}
          <div style={{ position: 'relative', width: '80px', height: '80px' }}>
            <style>{`
              @keyframes orbit {
                0% { transform: rotate(0deg) translateX(30px) rotate(0deg); }
                100% { transform: rotate(360deg) translateX(30px) rotate(-360deg); }
              }
              @keyframes pulse-center {
                0%, 100% { transform: scale(1); opacity: 0.9; }
                50% { transform: scale(1.15); opacity: 1; }
              }
              @keyframes orbit2 {
                0% { transform: rotate(120deg) translateX(30px) rotate(-120deg); }
                100% { transform: rotate(480deg) translateX(30px) rotate(-480deg); }
              }
              @keyframes orbit3 {
                0% { transform: rotate(240deg) translateX(30px) rotate(-240deg); }
                100% { transform: rotate(600deg) translateX(30px) rotate(-600deg); }
              }
            `}</style>
            {/* Center node */}
            <div style={{
              position: 'absolute',
              top: '50%', left: '50%',
              width: '20px', height: '20px',
              borderRadius: '50%',
              background: '#14b8a6',
              transform: 'translate(-50%, -50%)',
              animation: 'pulse-center 1.5s ease-in-out infinite',
              boxShadow: '0 0 15px rgba(20, 184, 166, 0.6)',
            }} />
            {/* Orbiting nodes */}
            {['#3b82f6', '#8b5cf6', '#f59e0b'].map((color, i) => (
              <div key={i} style={{
                position: 'absolute',
                top: '50%', left: '50%',
                width: '12px', height: '12px',
                borderRadius: '50%',
                background: color,
                marginTop: '-6px', marginLeft: '-6px',
                animation: `orbit${i === 0 ? '' : i + 1} ${1.8 + i * 0.3}s linear infinite`,
                boxShadow: `0 0 8px ${color}`,
              }} />
            ))}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#e2e8f0', marginBottom: '6px' }}>
              Building Knowledge Graph
            </div>
            <div style={{ fontSize: '14px', color: '#64748b' }}>
              Extracting concepts and relationships...
            </div>
          </div>
          {/* Animated progress dots */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: '8px', height: '8px',
                borderRadius: '50%',
                background: '#14b8a6',
                animation: `pulse-center 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Empty state icon */}
          <div style={{
            width: '72px', height: '72px',
            borderRadius: '16px',
            background: 'rgba(20, 184, 166, 0.1)',
            border: '1px solid rgba(20, 184, 166, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
          }}>
            🗂️
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#e2e8f0', marginBottom: '6px' }}>
              No Graph Uploaded Yet
            </div>
            <div style={{ fontSize: '14px', color: '#64748b', maxWidth: '260px', lineHeight: '1.5' }}>
              Upload a PDF to generate your knowledge graph and start exploring concepts.
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Node Edit Popup component
const NodeEditPopup = ({
  editState,
  onClose,
  onSave,
}: {
  editState: NodeEditState;
  onClose: () => void;
  onSave: (id: string, label: string, color: string) => void;
}) => {
  const [label, setLabel] = useState(editState.label);
  const [color, setColor] = useState(editState.color);

  const colorOptions = Object.values(COLOR_PALETTE);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: editState.y,
        left: editState.x,
        zIndex: 9999,
        background: 'white',
        borderRadius: '10px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
        padding: '16px',
        width: '240px',
        border: '1px solid #e5e7eb',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>Edit Node</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
          <X className="w-4 h-4" style={{ color: '#6b7280' }} />
        </button>
      </div>

      {/* Label field */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '4px' }}>
          Label
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={{
            width: '100%',
            padding: '7px 10px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            fontSize: '13px',
            color: '#111827',
            outline: 'none',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => e.target.style.borderColor = '#14b8a6'}
          onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
        />
      </div>

      {/* Color picker */}
      <div style={{ marginBottom: '14px' }}>
        <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '6px' }}>
          Color
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {colorOptions.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: c,
                border: color === c ? '2px solid #111827' : '2px solid transparent',
                cursor: 'pointer',
                outline: color === c ? '2px solid white' : 'none',
                outlineOffset: '-3px',
                transition: 'transform 0.1s',
              }}
              title={c}
            />
          ))}
        </div>
      </div>

      {/* Preview */}
      <div style={{ marginBottom: '14px' }}>
        <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '6px' }}>
          Preview
        </label>
        <div style={{
          background: color,
          color: 'white',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: '500',
          textAlign: 'center',
          wordBreak: 'break-word',
        }}>
          {label || 'Node Label'}
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            padding: '7px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            background: 'white',
            color: '#374151',
            fontSize: '13px',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => { onSave(editState.nodeId, label, color); onClose(); }}
          style={{
            flex: 1,
            padding: '7px',
            borderRadius: '6px',
            border: 'none',
            background: '#14b8a6',
            color: 'white',
            fontSize: '13px',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          Apply
        </button>
      </div>
    </div>
  );
};

// Function to render confidence circles based on score
const renderConfidenceCircles = (confidenceScore: number | null) => {
  if (confidenceScore === null || confidenceScore === undefined) {
    return (
      <div style={{
        position: 'absolute',
        top: '6px',
        left: '6px',
        display: 'flex',
        gap: '3px',
        zIndex: 10,
      }}>
        {[1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'transparent',
              border: '1.5px solid rgba(255, 255, 255, 0.7)',
            }}
          />
        ))}
      </div>
    );
  }

  let filledCircles = 0;
  if (confidenceScore > 0.7) {
    filledCircles = 3;
  } else if (confidenceScore > 0.4) {
    filledCircles = 2;
  } else if (confidenceScore > 0.0) {
    filledCircles = 1;
  } else {
    filledCircles = 0;
  }

  return (
    <div style={{
      position: 'absolute',
      top: '6px',
      left: '6px',
      display: 'flex',
      gap: '3px',
      zIndex: 10,
    }}>
      {[1, 2, 3].map(i => (
        <div
          key={i}
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: i <= filledCircles ? 'rgba(255, 255, 255, 0.9)' : 'transparent',
            border: '1.5px solid rgba(255, 255, 255, 0.7)',
          }}
        />
      ))}
    </div>
  );
};

// We need a global callback ref for the node edit popup trigger
// This lets CustomNode (which doesn't have direct access to parent state) fire an event upward
const nodeClickCallbacks = new Map<string, (e: React.MouseEvent) => void>();

const CustomNode = memo((props: CustomNodeProps) => {
  const { data, style = {}, id } = props;
  const [showTooltip, setShowTooltip] = useState(false);
  
  const truncateText = (text: string) => {
    if (!text) return '';
    if (text.length <= 30) return text;
    return text.substring(0, 30) + '...';
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const cb = nodeClickCallbacks.get('onNodeEdit');
    if (cb) cb({ ...e, currentTarget: e.currentTarget, target: e.target } as React.MouseEvent);
    // Store node info for the popup
    (window as any).__pendingNodeEdit = {
      nodeId: id,
      label: data.label,
      color: (style as any).background || '#3b82f6',
      x: Math.min(e.clientX + 10, window.innerWidth - 260),
      y: Math.min(e.clientY + 10, window.innerHeight - 340),
    };
    window.dispatchEvent(new CustomEvent('node-edit-request'));
  };
  
  return (
    <>
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ background: '#555', width: '8px', height: '8px', top: '-4px' }} 
      />
      <div
        style={{
          ...nodeStyles,
          ...style,
          position: 'relative',
          cursor: 'pointer',
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onDoubleClick={handleDoubleClick}
        title="Double-click to edit"
      >
        {renderConfidenceCircles(data.confidenceScore)}
        {data.customLabel || truncateText(data.label)}
      </div>
      {showTooltip && !data.customLabel && <NodeTooltip content={data.description} />}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ background: '#555', width: '8px', height: '8px', bottom: '-4px' }} 
      />
    </>
  );
});

const nodeTypes = {
  default: CustomNode,
};

const GraphVisualization: React.FC<GraphVisualizationProps> = ({ data, conceptProgress, isLoading = false }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [minimapLocked, setMinimapLocked] = useState(false);
  const [currentSubject, setCurrentSubject] = useState<string>('default');
  const [nodeTypesInGraph, setNodeTypesInGraph] = useState<Set<string>>(new Set());
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<'keyword' | 'semantic'>('keyword');

  // Node edit popup state
  const [nodeEditState, setNodeEditState] = useState<NodeEditState | null>(null);

  // Listen for node edit requests from CustomNode
  useEffect(() => {
    const handler = () => {
      const pending = (window as any).__pendingNodeEdit;
      if (pending) {
        setNodeEditState(pending);
        (window as any).__pendingNodeEdit = null;
      }
    };
    window.addEventListener('node-edit-request', handler);
    return () => window.removeEventListener('node-edit-request', handler);
  }, []);

  // Close popup when clicking elsewhere
  useEffect(() => {
    const handler = () => setNodeEditState(null);
    if (nodeEditState) {
      window.addEventListener('click', handler);
    }
    return () => window.removeEventListener('click', handler);
  }, [nodeEditState]);

  const handleNodeEditSave = (nodeId: string, label: string, color: string) => {
    setNodes(prev => prev.map(node => {
      if (node.id !== nodeId) return node;
      return {
        ...node,
        data: { ...node.data, customLabel: label },
        style: { ...node.style, background: color },
      };
    }));
  };

  const getNodeLabel = (node: any) => {
    const nameBasedNodeTypes = [
      'Topic', 'Subtopic', 'Event', 'Figure', 'Location', 
      'Concept', 'Document', 'Work', 'Author', 'LiteraryDevice',
      'Theme', 'CriticalTheory', 'Genre', 'Formula', 'Property',
      'Theorem', 'Proof', 'Equation', 'Principle', 'Theory',
      'Evidence', 'Scientist'
    ];
    
    const shouldUseName = node.labels.some(label => nameBasedNodeTypes.includes(label));
    
    const truncateText = (text: string, maxWords: number = 4): string => {
      const words = text.split(' ');
      if (words.length <= maxWords) return text;
      return words.slice(0, maxWords).join(' ') + '...';
    };
    
    if (shouldUseName) {
      if (node.properties.name && node.properties.name.trim()) {
        return truncateText(node.properties.name.trim());
      }
    }
    
    const possibleProperties = [
      'text', 'description', 'illustration', 'explanation',
      'content', 'title', 'label', 'summary', 'definition', 'name',
    ];
    
    for (const prop of possibleProperties) {
      const value = node.properties[prop];
      if (value && typeof value === 'string' && value.trim()) {
        return truncateText(value.trim());
      }
    }
    
    for (const [key, value] of Object.entries(node.properties || {})) {
      if (typeof value === 'string' && value.trim() && key !== 'id') {
        return truncateText(value.trim());
      }
    }
    
    const nodeType = node.labels?.[0] || 'Node';
    console.warn('Node with no displayable properties, using fallback:', {
      labels: node.labels,
      properties: Object.keys(node.properties || {}),
      id: node.id,
      fallback: nodeType
    });
    
    return nodeType;
  };

  const getNodeColor = (nodeType: string, subject: string = 'default') => {
    const normalizedSubject = subject.toLowerCase().trim();
    const colorScheme = subjectColorSchemes[normalizedSubject] || subjectColorSchemes.default;
    const color = colorScheme[nodeType] || COLOR_PALETTE.SLATE;
    return color;
  };

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || !data?.graph) {
      setSearchResults([]);
      return;
    }

    const graphId = (data as any).graph_id;
    if (!graphId) return;

    setIsSearching(true);
    try {
      const endpoint = searchMode === 'semantic' ? 'semantic-search-graph' : 'search-graph';
      const url = `http://localhost:4000/api/${endpoint}?graph_id=${graphId}&query=${encodeURIComponent(query)}`;
      const response = await fetch(url, { credentials: 'include' });
      const result = await response.json();
      if (result.status === 'success') {
        setSearchResults(result.node_ids || []);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('[Graph Search] Error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [data, searchMode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) handleSearch(searchQuery);
      else setSearchResults([]);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  useEffect(() => {
    if (searchResults.length > 0) {
      setNodes(prevNodes => 
        prevNodes.map(node => ({
          ...node,
          style: {
            ...node.style,
            border: searchResults.includes(node.id) 
              ? '3px solid #fbbf24' 
              : '1px solid rgba(255,255,255,0.2)',
            boxShadow: searchResults.includes(node.id)
              ? '0 0 15px rgba(251, 191, 36, 0.6)'
              : 'none',
            borderRadius: '24px',
          }
        }))
      );
    } else {
      setNodes(prevNodes => 
        prevNodes.map(node => ({
          ...node,
          style: {
            ...node.style,
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: 'none',
            borderRadius: '24px',
          }
        }))
      );
    }
  }, [searchResults, setNodes]);

  const processGraphData = useCallback((graphData: GraphData) => {
    if (!graphData) return;

    const subject = graphData.subject || 'default';
    setCurrentSubject(subject);

    const confidenceMap = new Map<string, number>();
    const confidenceByName = new Map<string, number>();
    
    conceptProgress.forEach(progress => {
      confidenceMap.set(progress.conceptId, progress.confidenceScore);
      const namePart = progress.conceptId.split('_').pop() || progress.conceptId;
      confidenceByName.set(namePart.toLowerCase(), progress.confidenceScore);
    });

    // One row per id: duplicate ids break React keys and inflate the graph.
    const seenNodeIds = new Set<string>();
    const nodesInput = graphData.graph.nodes.filter((n) => {
      const id = String(n.id);
      if (seenNodeIds.has(id)) return false;
      seenNodeIds.add(id);
      return true;
    });

    const processedEdges: Edge[] = graphData.graph.relationships.map((rel, i) => ({
      id: `${rel.source}-${rel.target}-${String(rel.type)}-${i}`,
      source: rel.source,
      target: rel.target,
      label: rel.type.replace(/_/g, ' '),
      type: 'smoothstep',
      style: { stroke: '#888', strokeWidth: 2 },
      labelStyle: { fill: '#888', fontSize: 10 },
      animated: true,
    }));

    // Node Sizing
    const nodeIds = nodesInput.map(n => n.id);

    // Guard: only pass edges whose endpoints exist in nodeIds so phantom IDs
    // (e.g. stale refs after deduplication) don't pollute connectionCount stats.
    const nodeIdSet = new Set(nodeIds);
    const safeEdges = processedEdges.filter(
      e => nodeIdSet.has(e.source) && nodeIdSet.has(e.target)
    );

    const { sizes, connectionCount } = computeNodeSizes(
      nodeIds,
      safeEdges,
      confidenceMap,
      { scale: 'log' }
    );

    const allWidths = [...sizes.values()].map(s => s.width).sort((a, b) => a - b);
    const medianWidth = allWidths[Math.floor(allWidths.length / 2)] ?? 200;
    const layoutSpacing = Math.max(360, medianWidth + 100);

    const connectedNodeIds = new Set<string>();
    safeEdges.forEach(edge => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });

    const isFallbackLabel = (label: string, nodeType: string): boolean => {
      const normalizedLabel = label.toLowerCase().trim();
      return label === nodeType || 
             label === 'Node' || 
             normalizedLabel === 'other' ||
             normalizedLabel === 'unknown' ||
             normalizedLabel === 'undefined' ||
             normalizedLabel === 'null' ||
             normalizedLabel === '';
    };

    const nodeTypeColorMap = new Map<string, string>();
    
    const processedNodes: Node[] = nodesInput
      .map((node) => {
        const nodeType = node.labels[0];
        const nodeColor = getNodeColor(nodeType, subject);
        const nodeLabel = getNodeLabel(node);
        
        if (!nodeTypeColorMap.has(nodeType)) {
          nodeTypeColorMap.set(nodeType, nodeColor);
        }
        
        const hasFallbackLabel = isFallbackLabel(nodeLabel, nodeType);
        const hasConnections = connectedNodeIds.has(node.id);
        
        if (hasFallbackLabel && !hasConnections) {
          return null;
        }
        
        let confidenceScore = confidenceMap.get(node.id) ?? null;
        
        if (confidenceScore === null) {
          const possibleIds = [
            node.properties.conceptId,
            node.properties.topicId,
            node.properties.topicID,
            node.properties.topic_id,
            node.properties.concept_id,
            node.properties.id,
          ].filter(Boolean);
          
          for (const possibleId of possibleIds) {
            confidenceScore = confidenceMap.get(String(possibleId)) ?? null;
            if (confidenceScore !== null) break;
          }
        }
        
        if (confidenceScore === null && node.properties.name) {
          const nodeName = node.properties.name.toLowerCase();
          confidenceScore = confidenceByName.get(nodeName) ?? null;
        }
        
        if (confidenceScore === null) {
          for (const [conceptId, score] of confidenceMap.entries()) {
            if (conceptId.includes(node.id) || node.id.includes(conceptId)) {
              confidenceScore = score;
              break;
            }
          }
        }
        
        const size = sizes.get(node.id) ?? { width: 200, height: 70 };
        return {
          id: node.id,
          type: 'default',
          data: {
            label: nodeLabel,
            description: node.properties.description || node.properties.text,
            type: nodeType,
            subject: subject,
            confidenceScore: confidenceScore,
            connections: connectionCount.get(node.id) ?? 0,  // expose for tooltip
          },
          position: { x: 0, y: 0 },
          style: {
            background: nodeColor,
            color: '#ffffff',
            border: '1px solid rgba(255,255,255,0.2)',
            width: `${size.width}px`,
            height: `${size.height}px`,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '24px',
          },
        };
      })
      .filter((node): node is Node => node !== null);

    const validNodeIds = new Set(processedNodes.map(node => node.id));
    const validEdges = processedEdges.filter(edge =>
      validNodeIds.has(edge.source) && validNodeIds.has(edge.target)
    );

    const nodePositions = forceDirectedLayout(processedNodes, validEdges, layoutSpacing);
    processedNodes.forEach((node, index) => {
      node.position = nodePositions[index];
    });

    setNodes(processedNodes);
    setEdges(validEdges);
    
    const typesInGraph = new Set<string>();
    processedNodes.forEach(node => {
      if (node.data?.type) typesInGraph.add(node.data.type);
    });
    setNodeTypesInGraph(typesInGraph);
  }, [setNodes, setEdges, conceptProgress]);

  useEffect(() => {
    if (data?.graph) {
      processGraphData(data);
    }
  }, [data, processGraphData]);

  const forceDirectedLayout = (nodes: Node[], edges: Edge[], spacing: number = 360) => {
    const positions: { x: number; y: number }[] = [];
    const width = Math.max(1000, nodes.length * 200);
    const height = Math.max(800, nodes.length * 150);
    
    const cols = Math.ceil(Math.sqrt(nodes.length));
    nodes.forEach((_, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      positions.push({
        x: col * spacing + (Math.random() * 50 - 25),
        y: row * spacing + (Math.random() * 50 - 25),
      });
    });

    const iterations = 50;
    for (let i = 0; i < iterations; i++) {
      for (let j = 0; j < nodes.length; j++) {
        for (let k = j + 1; k < nodes.length; k++) {
          const dx = positions[k].x - positions[j].x;
          const dy = positions[k].y - positions[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < spacing) {
            const force = (spacing - distance) / distance;
            const moveX = dx * force * 0.1;
            const moveY = dy * force * 0.1;
            positions[k].x += moveX;
            positions[k].y += moveY;
            positions[j].x -= moveX;
            positions[j].y -= moveY;
          }
        }
      }

      edges.forEach(edge => {
        const sourceIndex = nodes.findIndex(n => n.id === edge.source);
        const targetIndex = nodes.findIndex(n => n.id === edge.target);
        if (sourceIndex >= 0 && targetIndex >= 0) {
          const dx = positions[targetIndex].x - positions[sourceIndex].x;
          const dy = positions[targetIndex].y - positions[sourceIndex].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance > spacing) {
            const force = (distance - spacing) / distance;
            const moveX = dx * force * 0.05;
            const moveY = dy * force * 0.05;
            positions[sourceIndex].x += moveX;
            positions[sourceIndex].y += moveY;
            positions[targetIndex].x -= moveX;
            positions[targetIndex].y -= moveY;
          }
        }
      });
    }

    const minX = Math.min(...positions.map(p => p.x));
    const maxX = Math.max(...positions.map(p => p.x));
    const minY = Math.min(...positions.map(p => p.y));
    const maxY = Math.max(...positions.map(p => p.y));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    positions.forEach(pos => {
      pos.x = pos.x - centerX + width / 2;
      pos.y = pos.y - centerY + height / 2;
    });

    return positions;
  };

  // Show loading/empty state
  if (!data?.graph) {
    return <GraphLoadingScreen isLoading={isLoading} />;
  }

  const legendEntries = Array.from(nodeTypesInGraph).map(type => ({
    type,
    color: getNodeColor(type, currentSubject)
  })).sort((a, b) => a.type.localeCompare(b.type));

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Node Edit Popup */}
      {nodeEditState && (
        <NodeEditPopup
          editState={nodeEditState}
          onClose={() => setNodeEditState(null)}
          onSave={handleNodeEditSave}
        />
      )}

      {/* Hint tooltip */}
      <div style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        zIndex: 10,
        background: 'rgba(0,0,0,0.5)',
        color: 'rgba(255,255,255,0.7)',
        fontSize: '11px',
        padding: '4px 10px',
        borderRadius: '20px',
        pointerEvents: 'none',
      }}>
        Double-click a node to edit
      </div>

      {/* Search Bar */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        width: '90%',
        maxWidth: '600px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: 'white',
          borderRadius: '8px',
          padding: '8px 12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb',
        }}>
          <Search className="w-5 h-5 text-gray-400 mr-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search topics, concepts, definitions..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '14px',
              color: '#1f2937',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ padding: '4px', cursor: 'pointer', background: 'transparent', border: 'none' }}
            >
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
          {isSearching && (
            <div className="ml-2 text-sm text-gray-500">Searching...</div>
          )}
          <div style={{
            display: 'flex',
            gap: '4px',
            marginLeft: '8px',
            borderLeft: '1px solid #e5e7eb',
            paddingLeft: '8px',
          }}>
            <button
              onClick={() => setSearchMode('keyword')}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                borderRadius: '4px',
                border: 'none',
                background: searchMode === 'keyword' ? '#14b8a6' : '#f3f4f6',
                color: searchMode === 'keyword' ? 'white' : '#6b7280',
                cursor: 'pointer',
                fontWeight: searchMode === 'keyword' ? '600' : '400',
              }}
            >
              Keyword
            </button>
            <button
              onClick={() => setSearchMode('semantic')}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                borderRadius: '4px',
                border: 'none',
                background: searchMode === 'semantic' ? '#14b8a6' : '#f3f4f6',
                color: searchMode === 'semantic' ? 'white' : '#6b7280',
                cursor: 'pointer',
                fontWeight: searchMode === 'semantic' ? '600' : '400',
              }}
            >
              Semantic
            </button>
          </div>
        </div>
        {searchResults.length > 0 && (
          <div style={{
            marginTop: '8px',
            padding: '8px 12px',
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            fontSize: '12px',
            color: '#6b7280',
          }}>
            Found {searchResults.length} matching node{searchResults.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
      
      {/* Legend */}
      {legendEntries.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          background: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          padding: '8px 10px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          maxWidth: '250px',
          maxHeight: '300px',
          overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {legendEntries.map((entry) => (
              <div
                key={entry.type}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '10px',
                  padding: '2px 6px',
                  background: '#f9fafb',
                  borderRadius: '2px',
                }}
                title={entry.type.replace(/([A-Z])/g, ' $1').trim()}
              >
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '2px',
                  backgroundColor: entry.color,
                  border: '1px solid rgba(0, 0, 0, 0.15)',
                  flexShrink: 0,
                }} />
                <span style={{ color: '#4b5563', whiteSpace: 'nowrap' }}>
                  {entry.type.replace(/([A-Z])/g, ' $1').trim()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.5, minZoom: 0.1, maxZoom: 1, duration: 800 }}
        minZoom={0.1}
        maxZoom={4}
        defaultViewport={{ x: 0, y: 0, zoom: 0.2 }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          style: { strokeWidth: 2 },
          labelStyle: { fontSize: 12, fill: '#888' },
        }}
      >
        <Background color="#888" gap={16} />
        <Controls 
          showZoom={true}
          showFitView={true}
          position="bottom-right"
          style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          <button
            onClick={() => setMinimapLocked(!minimapLocked)}
            style={{
              background: minimapLocked ? '#555' : '#fff',
              color: minimapLocked ? '#fff' : '#555',
              border: '1px solid #555',
              borderRadius: '4px',
              padding: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
            }}
            title={minimapLocked ? 'Unlock minimap' : 'Lock minimap'}
          >
            {minimapLocked ? '🔒' : '🔓'}
          </button>
        </Controls>
        <MiniMap 
          style={{ 
            background: 'rgba(255,255,255,0.1)',
            position: 'absolute',
            right: minimapLocked ? '0' : '20px',
            bottom: minimapLocked ? '0' : '20px',
          }}
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