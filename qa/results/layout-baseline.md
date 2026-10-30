# Layout baseline (T1, #35)

Measured 2026-10-30 on `main` at 773858e. Reproduce with `npm run bench:layout` (15 timed runs after 2 warm-ups).

Machine: Node v22.23.4, Intel Xeon @ 2.80GHz, 2 cores (cloud container). Absolute numbers on your laptop will differ, so compare the ratios.

When we wrote T1, the graph view used `forceDirectedLayout` (a grid with 50 repulsion passes). L1 (#31) has since replaced it with the radial layout. The script times the old code, copied verbatim from 2fddf3b0, alongside the radial layout on the same nodes, edges and sizes.

## large.json (554 nodes, 736 edges)

| Layout | Median | p95 | Overlapping node pairs |
|---|--:|--:|--:|
| Old force-directed (pre-L1): **the number L1 had to beat** | **159 ms** | 212 ms | 124 |
| Radial, tree build + layout (main) | 4.4 ms | 10.8 ms | 0 |
| Radial, layout only | 2.1 ms | 6.2 ms | 0 |

L1 runs about 36 times faster than the old layout and removes all 124 overlaps. In the browser, the harness takes about 1.1 s from page load until all 554 nodes reach the DOM. React Flow rendering accounts for most of that, not layout.

## Other fixtures (median)

| Fixture | Nodes | Old force-directed | Radial (tree + layout) |
|---|--:|--:|--:|
| history | 63 | 3.8 ms | 0.70 ms |
| small | 32 | 1.0 ms | 0.21 ms |
| no-center | 32 | 0.52 ms | 0.12 ms |

## Catch: the first view on large.json

Speed passes, but the picture fails. The center of `large` has 130 children, and the outer rings have to hold about 550 nodes, so `radialLayout` scales every ring by the same factor. Ring 1 lands about 9,200 px out, and the rings run out to about 14,000 px. The initial `fitView` stops at `minZoom` 0.1, so the student sees the center node and a mass of edge lines with no other nodes (checklist L-05, `qa/results/large-initial.png` after a run). Collapse state (C1) or a first view that targets ring 1 alone could fix this. The L1 owner should make that call.
