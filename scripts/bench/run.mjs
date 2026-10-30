// Bundles layoutBaseline.ts with esbuild (already a Vite dependency) and runs it in Node.
import { build } from 'esbuild';
import { spawnSync } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outfile = path.join(mkdtempSync(path.join(tmpdir(), 'layout-bench-')), 'bench.mjs');

await build({
  entryPoints: [path.join(here, 'layoutBaseline.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  external: ['reactflow'], // type-only import
  logLevel: 'warning',
});

const { status } = spawnSync(process.execPath, [outfile], { stdio: 'inherit' });
process.exit(status ?? 1);
