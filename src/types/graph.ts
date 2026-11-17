/** Graph payload the knowledge graph view renders, as returned by the graph API */
export interface GraphData {
  status: string;
  graph_id?: string;
  subject?: string;
  graph: {
    nodes: any[];
    relationships: any[];
  };
}
