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
  graph: {
    nodes: any[];
    relationships: any[];
  };
}

interface GraphVisualizationProps {
  data: GraphData | null;
}

interface CustomNodeProps extends NodeProps {
  style?: React.CSSProperties;
}

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
        bottom: '80px',  // Position above the node
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

  const getNodeLabel = (node: any) => {
    // If it's a Topic or Subtopic, try name first, then follow the hierarchy
    if (node.labels.includes('Topic') || node.labels.includes('Subtopic')) {
      if (node.properties.name && node.properties.name.trim()) {
        return node.properties.name;
      }
      // If no name, follow text → description → illustration → explanation → 'No Label'
      const content = node.properties.text || 
                     node.properties.description || 
                     node.properties.illustration || 
                     node.properties.explanation || 
                     'No Label';
      return content.split(' ').slice(0, 4).join(' ') + (content.split(' ').length > 4 ? '...' : '');
    }
    // For Definition and Example, follow text → description → illustration → explanation → 'No Label'
    const content = node.properties.text || 
                   node.properties.description || 
                   node.properties.illustration || 
                   node.properties.explanation || 
                   'No Label';
    return content.split(' ').slice(0, 4).join(' ') + (content.split(' ').length > 4 ? '...' : '');
  };

  const processGraphData = useCallback((graphData: GraphData) => {
    if (!graphData) return;

    // Process nodes
    const processedNodes: Node[] = graphData.graph.nodes.map((node) => ({
      id: node.id,
      type: 'default',
      data: { 
        label: getNodeLabel(node),
        description: node.properties.description || node.properties.text,
        type: node.labels[0]
      },
      position: { x: 0, y: 0 },
      style: {
        background: getNodeColor(node.labels[0]),
        color: '#ffffff',
        border: '1px solid rgba(255,255,255,0.2)',
        width: '200px',           // Set fixed width for the outer node
        height: '70px',           // Set fixed height for the outer node
        padding: 0,               // Remove padding from outer node
        display: 'flex',          // Add flex display
        alignItems: 'center',     // Center content vertically
        justifyContent: 'center', // Center content horizontally
      },
    }));

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

  const getNodeColor = (label: string) => {
    const colors: { [key: string]: string } = {
      Topic: 'rgba(99, 102, 241, 1)',      // Indigo - more solid
      Definition: 'rgba(139, 92, 246, 1)',  // Purple - more solid
      Example: 'rgba(236, 72, 153, 1)',     // Pink - more solid
      Subtopic: 'rgba(20, 184, 166, 1)',    // Teal - more solid
    };
    return colors[label] || 'rgba(100, 116, 139, 1)'; // Default slate color
  };

  const forceDirectedLayout = (nodes: Node[], edges: Edge[]) => {
    const positions: { x: number; y: number }[] = [];
    const spacing = 300; // Increased spacing between nodes
    const width = Math.max(1000, nodes.length * 200);
    const height = Math.max(800, nodes.length * 150);
    
    // Initialize positions in a grid pattern
    const cols = Math.ceil(Math.sqrt(nodes.length));
    nodes.forEach((_, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      positions.push({
        x: col * spacing + (Math.random() * 50 - 25), // Add small random offset
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