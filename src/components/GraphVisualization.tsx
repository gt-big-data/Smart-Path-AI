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

interface GraphData {
  status: string;
  subject?: string;
  graph: {
    nodes: any[];
    relationships: any[];
  };
}

// Map backend subject names to our color scheme keys
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
}

interface CustomNodeProps extends NodeProps {
  style?: React.CSSProperties;
}

// Consistent color palette used across all subjects
const COLOR_PALETTE = {
  BLUE: 'rgba(59, 130, 246, 1)',         // Primary blue
  INDIGO: 'rgba(99, 102, 241, 1)',       // Indigo
  PURPLE: 'rgba(139, 92, 246, 1)',       // Purple
  PINK: 'rgba(236, 72, 153, 1)',         // Pink
  RED: 'rgba(239, 68, 68, 1)',           // Red
  ORANGE: 'rgba(249, 115, 22, 1)',       // Orange
  AMBER: 'rgba(245, 158, 11, 1)',        // Amber
  YELLOW: 'rgba(234, 179, 8, 1)',        // Yellow
  LIME: 'rgba(132, 204, 22, 1)',         // Lime
  GREEN: 'rgba(34, 197, 94, 1)',         // Green
  EMERALD: 'rgba(16, 185, 129, 1)',      // Emerald
  TEAL: 'rgba(20, 184, 166, 1)',         // Teal
  CYAN: 'rgba(6, 182, 212, 1)',          // Cyan
  SKY: 'rgba(14, 165, 233, 1)',          // Sky blue
  VIOLET: 'rgba(124, 58, 237, 1)',       // Violet
  FUCHSIA: 'rgba(217, 70, 239, 1)',      // Fuchsia
  ROSE: 'rgba(244, 63, 94, 1)',          // Rose
  SLATE: 'rgba(100, 116, 139, 1)',       // Slate (default)
};

// Subject-specific color schemes mapped to consistent palette
const subjectColorSchemes: { [subject: string]: { [nodeType: string]: string } } = {
  // Base/Default nodes (used across multiple subjects or as fallback)
  base: {
    Topic: COLOR_PALETTE.BLUE,
    Subtopic: COLOR_PALETTE.TEAL,
    Definition: COLOR_PALETTE.PURPLE,
    Example: COLOR_PALETTE.PINK,
    Source: COLOR_PALETTE.SLATE,
    Application: COLOR_PALETTE.ORANGE,
  },
  
  // English/Literature nodes
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
  
  // History nodes
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
  
  // Mathematics nodes
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
  
  // Science nodes
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
  },
  
  // Default fallback (same as base)
  default: {
    Topic: COLOR_PALETTE.BLUE,
    Subtopic: COLOR_PALETTE.TEAL,
    Definition: COLOR_PALETTE.PURPLE,
    Example: COLOR_PALETTE.PINK,
    Source: COLOR_PALETTE.SLATE,
    Application: COLOR_PALETTE.ORANGE,
  },
};

// Custom node styles - redesigned with flat rectangular style
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
};

// Custom tooltip component
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

// Custom node component
const CustomNode = memo((props: CustomNodeProps) => {
  const { data, style = {} } = props;
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Text truncation helper
  const truncateText = (text: string) => {
    if (!text) return '';
    if (text.length <= 30) return text;
    return text.substring(0, 30) + '...';
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
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {truncateText(data.label)}
      </div>
      {showTooltip && <NodeTooltip content={data.description} />}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ background: '#555', width: '8px', height: '8px', bottom: '-4px' }} 
      />
    </>
  );
});

// Define nodeTypes outside component
const nodeTypes = {
  default: CustomNode,
};

const GraphVisualization: React.FC<GraphVisualizationProps> = ({ data }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [minimapLocked, setMinimapLocked] = useState(false);
  const [currentSubject, setCurrentSubject] = useState<string>('default');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<'keyword' | 'semantic'>('keyword');

  // Search handler function
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || !data?.graph) {
      setSearchResults([]);
      return;
    }

    const graphId = (data as any).graph_id;
    if (!graphId) {
      console.warn('No graph_id available for search');
      return;
    }

    setIsSearching(true);
    try {
      const endpoint = searchMode === 'semantic' 
        ? 'semantic-search-graph' 
        : 'search-graph';
      
      const response = await fetch(
        `http://localhost:4000/api/${endpoint}?graph_id=${graphId}&query=${encodeURIComponent(query)}`,
        { credentials: 'include' }
      );
      const result = await response.json();
      
      if (result.status === 'success') {
        setSearchResults(result.node_ids || []);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [data, searchMode]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        handleSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // Highlight search results
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
          }
        }))
      );
    } else {
      // Reset borders when no search results
      setNodes(prevNodes => 
        prevNodes.map(node => ({
          ...node,
          style: {
            ...node.style,
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: 'none',
          }
        }))
      );
    }
  }, [searchResults, setNodes]);

  const getNodeLabel = (node: any) => {
  // List of node types that should use 'name' property
  const nameBasedNodeTypes = [
    'Topic', 'Subtopic', 'Event', 'Figure', 'Location', 
    'Concept', 'Document', 'Work', 'Author', 'LiteraryDevice',
    'Theme', 'CriticalTheory', 'Genre', 'Formula', 'Property',
    'Theorem', 'Proof', 'Equation', 'Principle', 'Theory',
    'Evidence', 'Scientist'
  ];
  
  // Check if this node type should use 'name' property
  const shouldUseName = node.labels.some(label => nameBasedNodeTypes.includes(label));
  
  if (shouldUseName) {
    // Try 'name' first for these node types
    if (node.properties.name && node.properties.name.trim()) {
      return node.properties.name;
    }
  }
  
  // Fallback hierarchy for all nodes: text → description → illustration → explanation → name (if not checked yet) → 'No Label'
  const content = node.properties.text || 
                 node.properties.description || 
                 node.properties.illustration || 
                 node.properties.explanation ||
                 (!shouldUseName ? node.properties.name : null) || // Check name as fallback if not already checked
                 'No Label';
  
  // If content is still 'No Label', log a warning for debugging
  if (content === 'No Label') {
    console.warn('Node with no displayable properties:', {
      labels: node.labels,
      properties: node.properties,
      id: node.id
    });
  }
  
  // Truncate long text
  return content.split(' ').slice(0, 4).join(' ') + (content.split(' ').length > 4 ? '...' : '');
};

  // Refactored getNodeColor to use subject-specific color schemes
  const getNodeColor = (nodeType: string, subject: string = 'default') => {
    // Normalize subject to lowercase for lookup
    const normalizedSubject = subject.toLowerCase().trim();
    
    // Debug logging to help identify issues
    console.log('Getting color for:', { nodeType, subject: normalizedSubject });
    
    // Get the color scheme for the subject, fallback to default if not found
    const colorScheme = subjectColorSchemes[normalizedSubject] || subjectColorSchemes.default;
    
    console.log('Available node types in scheme:', Object.keys(colorScheme));
    console.log('Looking for nodeType:', nodeType);
    
    // Get the color for the node type, fallback to a default gray if not found
    const color = colorScheme[nodeType] || COLOR_PALETTE.SLATE;
    
    console.log('Assigned color:', color);
    
    return color;
  };

  const processGraphData = useCallback((graphData: GraphData) => {
    if (!graphData) return;

    // Extract and store the subject
    const subject = graphData.subject || 'default';
    setCurrentSubject(subject);

    // Process nodes
    const processedNodes: Node[] = graphData.graph.nodes.map((node) => {
      const nodeType = node.labels[0];
      const nodeColor = getNodeColor(nodeType, subject);
      
      return {
        id: node.id,
        type: 'default',
        data: { 
          label: getNodeLabel(node),
          description: node.properties.description || node.properties.text,
          type: nodeType,
          subject: subject,
        },
        position: { x: 0, y: 0 },
        style: {
          background: nodeColor,
          color: '#ffffff',
          border: '1px solid rgba(255,255,255,0.2)',
          width: '200px',
          height: '70px',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
      };
    });

    // Process edges
    const processedEdges: Edge[] = graphData.graph.relationships.map((rel) => ({
      id: `${rel.source}-${rel.target}`,
      source: rel.source,
      target: rel.target,
      label: rel.type.replace(/_/g, ' '),
      type: 'smoothstep',
      style: { stroke: '#888', strokeWidth: 2 },
      labelStyle: { fill: '#888', fontSize: 10 },
      animated: true,
    }));

    // Apply force-directed layout
    const nodePositions = forceDirectedLayout(processedNodes, processedEdges);
    processedNodes.forEach((node, index) => {
      node.position = nodePositions[index];
    });

    setNodes(processedNodes);
    setEdges(processedEdges);
  }, [setNodes, setEdges]);

  useEffect(() => {
    if (data?.graph) {
      processGraphData(data);
    }
  }, [data, processGraphData]);

  const forceDirectedLayout = (nodes: Node[], edges: Edge[]) => {
    const positions: { x: number; y: number }[] = [];
    const spacing = 300;
    const width = Math.max(1000, nodes.length * 200);
    const height = Math.max(800, nodes.length * 150);
    
    // Initialize positions in a grid pattern
    const cols = Math.ceil(Math.sqrt(nodes.length));
    nodes.forEach((_, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      positions.push({
        x: col * spacing + (Math.random() * 50 - 25),
        y: row * spacing + (Math.random() * 50 - 25),
      });
    });

    // Simple force-directed algorithm
    const iterations = 50;
    for (let i = 0; i < iterations; i++) {
      // Repulsive forces between nodes
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

      // Attractive forces along edges
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

    // Center the layout
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

  if (!data?.graph) {
    return <div className="h-full flex items-center justify-center text-gray-400">No graph data available</div>;
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
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
          {/* Search mode toggle */}
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
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{
          padding: 0.5,
          minZoom: 0.1,
          maxZoom: 1,
          duration: 800,
        }}
        minZoom={0.1}
        maxZoom={4}
        defaultViewport={{
          x: 0,
          y: 0,
          zoom: 0.2,
        }}
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