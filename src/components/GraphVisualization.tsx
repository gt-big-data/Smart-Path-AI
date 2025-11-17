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
}

interface CustomNodeProps extends NodeProps {
  style?: React.CSSProperties;
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

// Function to render confidence circles based on score
const renderConfidenceCircles = (confidenceScore: number | null) => {
  // If null or undefined, show empty circles
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
  
  // Determine number of filled circles based on confidence score
  if (confidenceScore > 0.7) {
    filledCircles = 3; // ●●●
  } else if (confidenceScore > 0.4) {
    filledCircles = 2; // ●●○
  } else if (confidenceScore > 0.0) {
    filledCircles = 1; // ●○○
  } else {
    filledCircles = 0; // ○○○
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

// Custom node component with confidence circles
const CustomNode = memo((props: CustomNodeProps) => {
  const { data, style = {} } = props;
  const [showTooltip, setShowTooltip] = useState(false);
  
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
          position: 'relative',
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {renderConfidenceCircles(data.confidenceScore)}
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

const nodeTypes = {
  default: CustomNode,
};

const GraphVisualization: React.FC<GraphVisualizationProps> = ({ data, conceptProgress }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [minimapLocked, setMinimapLocked] = useState(false);
  const [currentSubject, setCurrentSubject] = useState<string>('default');

  const getNodeLabel = (node: any) => {
    const nameBasedNodeTypes = [
      'Topic', 'Subtopic', 'Event', 'Figure', 'Location', 
      'Concept', 'Document', 'Work', 'Author', 'LiteraryDevice',
      'Theme', 'CriticalTheory', 'Genre', 'Formula', 'Property',
      'Theorem', 'Proof', 'Equation', 'Principle', 'Theory',
      'Evidence', 'Scientist'
    ];
    
    const shouldUseName = node.labels.some(label => nameBasedNodeTypes.includes(label));
    
    if (shouldUseName) {
      if (node.properties.name && node.properties.name.trim()) {
        return node.properties.name;
      }
    }
    
    const content = node.properties.text || 
                   node.properties.description || 
                   node.properties.illustration || 
                   node.properties.explanation ||
                   (!shouldUseName ? node.properties.name : null) ||
                   'No Label';
    
    if (content === 'No Label') {
      console.warn('Node with no displayable properties:', {
        labels: node.labels,
        properties: node.properties,
        id: node.id
      });
    }
    
    return content.split(' ').slice(0, 4).join(' ') + (content.split(' ').length > 4 ? '...' : '');
  };

  const getNodeColor = (nodeType: string, subject: string = 'default') => {
    const normalizedSubject = subject.toLowerCase().trim();
    const colorScheme = subjectColorSchemes[normalizedSubject] || subjectColorSchemes.default;
    const color = colorScheme[nodeType] || COLOR_PALETTE.SLATE;
    return color;
  };

  const processGraphData = useCallback((graphData: GraphData) => {
    if (!graphData) return;

    const subject = graphData.subject || 'default';
    setCurrentSubject(subject);

    // Create maps for flexible matching
    const confidenceMap = new Map<string, number>();
    const confidenceByName = new Map<string, number>();
    
    conceptProgress.forEach(progress => {
      confidenceMap.set(progress.conceptId, progress.confidenceScore);
      // Also try to extract just the name part if conceptId contains underscores or prefixes
      const namePart = progress.conceptId.split('_').pop() || progress.conceptId;
      confidenceByName.set(namePart.toLowerCase(), progress.confidenceScore);
    });

    console.log('🎯 Graph Visualization - Confidence Data:');
    console.log('  Progress entries:', conceptProgress.length);
    console.log('  Stored conceptIds:', Array.from(confidenceMap.keys()));
    console.log('  Graph has', graphData.graph.nodes.length, 'nodes');
    console.log('  Node IDs:', graphData.graph.nodes.map(n => n.id));

    const processedNodes: Node[] = graphData.graph.nodes.map((node) => {
      const nodeType = node.labels[0];
      const nodeColor = getNodeColor(nodeType, subject);
      
      // Try multiple matching strategies:
      // 1. Direct ID match
      let confidenceScore = confidenceMap.get(node.id) ?? null;
      
      // 2. If no match, try matching by node name
      if (confidenceScore === null && node.properties.name) {
        const nodeName = node.properties.name.toLowerCase();
        confidenceScore = confidenceByName.get(nodeName) ?? null;
      }
      
      // 3. If still no match, try matching ID as substring
      if (confidenceScore === null) {
        for (const [conceptId, score] of confidenceMap.entries()) {
          if (conceptId.includes(node.id) || node.id.includes(conceptId)) {
            confidenceScore = score;
            console.log(`  ✅ Matched node ${node.id} via substring to conceptId ${conceptId}`);
            break;
          }
        }
      }
      
      if (confidenceScore !== null) {
        console.log(`  ✅ Node "${node.properties.name || node.id}" has confidence: ${confidenceScore}`);
      }
      
      return {
        id: node.id,
        type: 'default',
        data: { 
          label: getNodeLabel(node),
          description: node.properties.description || node.properties.text,
          type: nodeType,
          subject: subject,
          confidenceScore: confidenceScore, // Add confidence score to node data
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

    const nodePositions = forceDirectedLayout(processedNodes, processedEdges);
    processedNodes.forEach((node, index) => {
      node.position = nodePositions[index];
    });

    setNodes(processedNodes);
    setEdges(processedEdges);
  }, [setNodes, setEdges, conceptProgress]);

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

  if (!data?.graph) {
    return <div className="h-full flex items-center justify-center text-gray-400">No graph data available</div>;
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
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