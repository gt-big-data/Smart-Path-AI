import fs from 'fs';
import path from 'path';
import { expect, it } from 'vitest';

// Sample test for the X1 fixtures: real /view-graph responses saved in src/lib/__fixtures__
it('loads the small fixture as a /view-graph response', () => {
  const json = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '__fixtures__', 'small.json'), 'utf8'));
  expect(json.status).toBe('success');
  expect(json.graph.nodes.length).toBeGreaterThan(0);
  expect(json.graph.relationships.length).toBeGreaterThan(0);
});
