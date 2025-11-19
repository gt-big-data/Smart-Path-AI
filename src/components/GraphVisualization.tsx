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
  const [nodeTypesInGraph, setNodeTypesInGraph] = useState<Set<string>>(new Set());
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<'keyword' | 'semantic'>('keyword');

  const getNodeLabel = (node: any) => {
    const nameBasedNodeTypes = [
      'Topic', 'Subtopic', 'Event', 'Figure', 'Location', 
      'Concept', 'Document', 'Work', 'Author', 'LiteraryDevice',
      'Theme', 'CriticalTheory', 'Genre', 'Formula', 'Property',
      'Theorem', 'Proof', 'Equation', 'Principle', 'Theory',
      'Evidence', 'Scientist'
    ];
    
    const shouldUseName = node.labels.some(label => nameBasedNodeTypes.includes(label));
    
    // Helper function to truncate long text
    const truncateText = (text: string, maxWords: number = 4): string => {
      const words = text.split(' ');
      if (words.length <= maxWords) {
        return text;
      }
      return words.slice(0, maxWords).join(' ') + '...';
    };
    
    // Try name first for name-based node types
    if (shouldUseName) {
      if (node.properties.name && node.properties.name.trim()) {
        return truncateText(node.properties.name.trim());
      }
    }
    
    // Try all possible text properties in order of preference
    const possibleProperties = [
      'text',
      'description', 
      'illustration',
      'explanation',
      'content',
      'title',
      'label',
      'summary',
      'definition',
      'name', // Try name even if not in nameBasedNodeTypes
    ];
    
    // Check each property in order
    for (const prop of possibleProperties) {
      const value = node.properties[prop];
      if (value && typeof value === 'string' && value.trim()) {
        return truncateText(value.trim());
      }
    }
    
    // If no text property found, try to get any string property
    for (const [key, value] of Object.entries(node.properties || {})) {
      if (typeof value === 'string' && value.trim() && key !== 'id') {
        return truncateText(value.trim());
      }
    }
    
    // Last resort: use node type label instead of "No Label"
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

  // Search handler function
  const handleSearch = useCallback(async (query: string) => {
    console.log('[Graph Search] Starting search...', { query, hasData: !!data, hasGraph: !!data?.graph });
    
    if (!query.trim() || !data?.graph) {
      setSearchResults([]);
      return;
    }

    const graphId = (data as any).graph_id;
    console.log('[Graph Search] Graph ID:', graphId);
    
    if (!graphId) {
      console.warn('[Graph Search] No graph_id available for search');
      return;
    }

    setIsSearching(true);
    try {
      const endpoint = searchMode === 'semantic' 
        ? 'semantic-search-graph' 
        : 'search-graph';
      
      const url = `http://localhost:4000/api/${endpoint}?graph_id=${graphId}&query=${encodeURIComponent(query)}`;
      console.log('[Graph Search] Fetching:', url);
      
      const response = await fetch(url, { credentials: 'include' });
      const result = await response.json();
      
      console.log('[Graph Search] Response:', result);
      
      if (result.status === 'success') {
        console.log('[Graph Search] Found nodes:', result.node_ids);
        setSearchResults(result.node_ids || []);
      } else {
        console.warn('[Graph Search] Search failed:', result);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('[Graph Search] Error:', error);
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

  const processGraphData = useCallback((graphData: GraphData) => {
    if (!graphData) return;

    const subject = graphData.subject || 'default';
    setCurrentSubject(subject);
    
    console.log('🎨 Color Mapping Info:');
    console.log('  Subject detected:', subject);
    console.log('  Color scheme:', subjectColorSchemes[subject.toLowerCase()] ? 'Found' : 'Using default');

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

    // First, process edges to find which nodes have connections
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

    // Create a set of node IDs that have connections
    const connectedNodeIds = new Set<string>();
    processedEdges.forEach(edge => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });

    // Helper function to check if a label is just the node type (fallback) or generic labels
    const isFallbackLabel = (label: string, nodeType: string): boolean => {
      const normalizedLabel = label.toLowerCase().trim();
      // Check if label is exactly the node type (our fallback), or generic labels like "other"
      return label === nodeType || 
             label === 'Node' || 
             normalizedLabel === 'other' ||
             normalizedLabel === 'unknown' ||
             normalizedLabel === 'undefined' ||
             normalizedLabel === 'null' ||
             normalizedLabel === '';
    };

    // Track node types and their colors for verification
    const nodeTypeColorMap = new Map<string, string>();
    
    const processedNodes: Node[] = graphData.graph.nodes
      .map((node) => {
        const nodeType = node.labels[0];
        const nodeColor = getNodeColor(nodeType, subject);
        const nodeLabel = getNodeLabel(node);
        
        // Track this node type and color
        if (!nodeTypeColorMap.has(nodeType)) {
          nodeTypeColorMap.set(nodeType, nodeColor);
        }
        
        // Check if this is a fallback label (just the node type)
        const hasFallbackLabel = isFallbackLabel(nodeLabel, nodeType);
        const hasConnections = connectedNodeIds.has(node.id);
        
        // Skip nodes with fallback labels that have no connections
        if (hasFallbackLabel && !hasConnections) {
          console.log(`Filtering out node ${node.id} - has fallback label "${nodeLabel}" and no connections`);
          return null;
        }
        
        // Try multiple matching strategies:
        // 1. Direct ID match
        let confidenceScore = confidenceMap.get(node.id) ?? null;
        
        // 2. Check node properties for conceptId, topicId, etc.
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
            if (confidenceScore !== null) {
              console.log(`  ✅ Matched node ${node.id} via property to conceptId ${possibleId} with score ${confidenceScore}`);
              break;
            }
          }
        }
        
        // 3. If no match, try matching by node name
        if (confidenceScore === null && node.properties.name) {
          const nodeName = node.properties.name.toLowerCase();
          confidenceScore = confidenceByName.get(nodeName) ?? null;
          if (confidenceScore !== null) {
            console.log(`  ✅ Matched node ${node.id} via name "${node.properties.name}" with score ${confidenceScore}`);
          }
        }
        
        // 4. If still no match, try matching ID as substring
        if (confidenceScore === null) {
          for (const [conceptId, score] of confidenceMap.entries()) {
            if (conceptId.includes(node.id) || node.id.includes(conceptId)) {
              confidenceScore = score;
              console.log(`  ✅ Matched node ${node.id} via substring to conceptId ${conceptId} with score ${confidenceScore}`);
              break;
            }
          }
        }
        
        if (confidenceScore !== null) {
          console.log(`  🎯 Node "${node.properties.name || node.id}" FINAL CONFIDENCE: ${confidenceScore}`);
        } else {
          console.log(`  ⚠️ Node "${node.properties.name || node.id}" (${node.id}) - NO MATCH FOUND`);
          console.log(`     Node properties:`, Object.keys(node.properties));
        }
        
        return {
          id: node.id,
          type: 'default',
          data: { 
            label: nodeLabel,
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
      })
      .filter((node): node is Node => node !== null); // Remove null entries

    // Create a set of valid node IDs after filtering
    const validNodeIds = new Set(processedNodes.map(node => node.id));
    
    // Filter edges to only include those where both source and target nodes exist
    const validEdges = processedEdges.filter(edge => 
      validNodeIds.has(edge.source) && validNodeIds.has(edge.target)
    );
    
    // Log color assignments for verification
    console.log('🎨 Node Type Color Assignments:');
    const sortedEntries = Array.from(nodeTypeColorMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    sortedEntries.forEach(([type, color]) => {
      console.log(`  ${type}: ${color}`);
    });
    
    // Check for duplicate colors (should not happen with proper scheme)
    const colorCounts = new Map<string, string[]>();
    sortedEntries.forEach(([type, color]) => {
      if (!colorCounts.has(color)) {
        colorCounts.set(color, []);
      }
      colorCounts.get(color)!.push(type);
    });
    
    const duplicates = Array.from(colorCounts.entries()).filter(([_, types]) => types.length > 1);
    if (duplicates.length > 0) {
      console.warn('⚠️ WARNING: Multiple node types share the same color:');
      duplicates.forEach(([color, types]) => {
        console.warn(`  Color ${color} used by: ${types.join(', ')}`);
      });
    } else {
      console.log('✅ All node types have unique colors!');
    }

    const nodePositions = forceDirectedLayout(processedNodes, validEdges);
    processedNodes.forEach((node, index) => {
      node.position = nodePositions[index];
    });

    setNodes(processedNodes);
    setEdges(validEdges);
    
    // Track which node types are present in the graph for the legend
    const typesInGraph = new Set<string>();
    processedNodes.forEach(node => {
      if (node.data?.type) {
        typesInGraph.add(node.data.type);
      }
    });
    setNodeTypesInGraph(typesInGraph);
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

  // Create legend entries from node types present in graph
  const legendEntries = Array.from(nodeTypesInGraph).map(type => ({
    type,
    color: getNodeColor(type, currentSubject)
  })).sort((a, b) => a.type.localeCompare(b.type));

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
      
      {/* Legend Component - Compact */}
      {legendEntries.length > 0 && (
        <div
          style={{
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
          }}
        >
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
                  borderRadius: '4px',
                }}
                title={entry.type.replace(/([A-Z])/g, ' $1').trim()}
              >
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '2px',
                    backgroundColor: entry.color,
                    border: '1px solid rgba(0, 0, 0, 0.15)',
                    flexShrink: 0,
                  }}
                />
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