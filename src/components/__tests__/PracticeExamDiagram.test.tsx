import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PracticeExamDiagram from '../PracticeExamDiagram';
import type { NodeLinkDiagram, PlotDiagram } from '../../../server/services/practiceExamDiagram';

const plot: PlotDiagram = {
  kind: 'plot', caption: 'Motion graph', x_label: 'Time (s)', y_label: 'Position (m)',
  x_min: 0, x_max: 4, y_min: 0, y_max: 10,
  series: [{ label: 'Object A', style: 'line', points: [{ x: 0, y: 2 }, { x: 4, y: 6 }] }],
};
const network: NodeLinkDiagram = {
  kind: 'node_link', caption: 'Directed network',
  nodes: [{ id: 'a', label: 'A', x: 0, y: 0 }, { id: 'b', label: 'B', x: 1, y: 1 }],
  edges: [{ source: 'a', target: 'b', label: '4', directed: true }],
};

describe('practice exam diagrams', () => {
  it('renders correct coordinate transforms, axis units and series labels', () => {
    const html = renderToStaticMarkup(<PracticeExamDiagram diagram={plot} />);
    expect(html).toContain('points="85,279 555,167"');
    expect(html).toContain('Time (s)');
    expect(html).toContain('Position (m)');
    expect(html).toContain('Object A');
    expect(html).toContain('role="img"');
    expect(html).toContain('<title');
  });
  it('keeps scatter points unconnected and labels as escaped text', () => {
    const value = { ...plot, caption: '<script>alert(1)</script>',
      series: [{ ...plot.series[0], style: 'scatter' as const }] };
    const html = renderToStaticMarkup(<PracticeExamDiagram diagram={value} />);
    expect(html).not.toContain('<polyline');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
  it('places negative coordinates and zero axes correctly', () => {
    const value = { ...plot, x_min: -2, x_max: 2, y_min: -4, y_max: 4,
      series: [{ ...plot.series[0], points: [{ x: -2, y: -4 }, { x: 0, y: 0 }, { x: 2, y: 4 }] }] };
    const html = renderToStaticMarkup(<PracticeExamDiagram diagram={value} />);
    expect(html).toContain('points="85,335 320,195 555,55"');
    expect(html).toContain('M 320 55 V 335');
    expect(html).toContain('M 85 195 H 555');
  });
  it('shows edge direction, weights, and all node labels', () => {
    const html = renderToStaticMarkup(<PracticeExamDiagram diagram={network} />);
    expect(html).toContain('<polygon');
    expect(html).toContain('>4</text>');
    expect(html).toContain('>A</text>');
    expect(html).toContain('>B</text>');
    expect(html).not.toMatch(/NaN|Infinity/);
    const undirected = { ...network, edges: [{ ...network.edges[0], directed: false }] };
    expect(renderToStaticMarkup(<PracticeExamDiagram diagram={undirected} />)).not.toContain('<polygon');
  });
  it('renders Markov self-loops and separates opposite arrows and their probabilities', () => {
    const value = { ...network, nodes: [
      { id: 'a', label: 'A', x: 0.25, y: 0.5 }, { id: 'b', label: 'B', x: 0.75, y: 0.5 },
    ], edges: [
      { source: 'a', target: 'a', label: '0.3', directed: true },
      { source: 'a', target: 'b', label: '0.7', directed: true },
      { source: 'b', target: 'a', label: '0.6', directed: true },
      { source: 'b', target: 'b', label: '0.4', directed: true },
    ] };
    const html = renderToStaticMarkup(<PracticeExamDiagram diagram={value} />);
    expect(html.match(/<polygon/g)).toHaveLength(4);
    expect(html.match(/ C /g)).toHaveLength(2);
    expect(html.match(/ Q /g)).toHaveLength(2);
    for (const probability of ['0.3', '0.7', '0.6', '0.4']) expect(html).toContain(`>${probability}</text>`);
    expect(html).not.toMatch(/NaN|Infinity/);
  });
});
