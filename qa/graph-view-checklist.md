# Graph view QA checklist (T1, #35)

Use this checklist for Q1 (#43) and for any PR that touches the graph view. Run it against all four X1 fixtures: `small`, `no-center`, `history` and `large`.

Most rows run on their own. Rows marked **Manual** need the real backend or a person looking at the screen.

## How to run it

```bash
npm install
npm i --no-save playwright && npx playwright install chromium   # once
npm run qa:harness       # terminal 1: Vite serves the harness on :5199
npm run qa:checklist     # terminal 2: writes qa/results/latest.md + screenshots
npm run bench:layout     # layout timing on every fixture
```

The harness (`qa/harness/`) mounts the real `GraphVisualization` with a fixture and a fake concept-progress list. You don't need a login, Mongo or the AI server. To click around by hand, open `http://localhost:5199/?fixture=large`. The buttons along the top switch fixtures without a reload.

The runner stubs `/api/search-graph` and `/api/semantic-search-graph`. Each stub returns the nodes whose name contains the query. The automated search rows therefore test the UI, not search quality.

## Layout (L1 #31, spacing #41)

| ID | Check | How |
|---|---|---|
| L-01 | Every node in the fixture renders | Auto |
| L-02 | No two node boxes overlap, measured at their rendered size | Auto |
| L-03 | The tree center sits at the layout origin. On `no-center`, the most-connected Topic stands in as center | Auto |
| L-04 | Deeper nodes sit on wider rings | Auto |
| L-05 | The first view shows the center plus its first two rings | Auto |
| L-06 | Layout time on `large` stays under the baseline (see `qa/results/layout-baseline.md`) | `npm run bench:layout` |
| L-07 | Labels fit inside their nodes and contain no markdown (`**`) | **Manual**, check the screenshots |
| L-08 | You can follow the edges by eye: they don't collapse into one shared trunk | **Manual** |

## Edges (#32)

| ID | Check | How |
|---|---|---|
| E-01 | At rest, edges show no labels and no animation | Auto |
| E-02 | Hovering an edge shows its relationship label | Auto |
| E-03 | The label disappears when the mouse leaves the edge | Auto |

## Path highlight (P1)

| ID | Check | How |
|---|---|---|
| P-01 | Clicking a node numbers each step from the center to that node | Auto |
| P-02 | Path nodes get the orange border and every other node fades to 0.18 | Auto |
| P-03 | Path edges, and only path edges, turn orange, animate and show labels | Auto |
| P-04 | Escape clears the path | Auto |
| P-05 | Clicking empty canvas clears the path | Auto |
| P-06 | Clicking the center clears the path | Auto |
| P-07 | The deepest node in the tree gets a complete path | Auto |
| P-08 | Path clicks never move nodes | Auto |
| P-09 | The unfinished path bar (P2a) stays hidden | Auto |

## Search (regression)

| ID | Check | How |
|---|---|---|
| S-01 | Keyword search calls `/api/search-graph` with the open graph's `graph_id`, once after the debounce | Auto |
| S-02 | Each hit gets the yellow border and no other node does | Auto |
| S-03 | "Found N matching nodes" matches the hit count | Auto |
| S-04 | While a path shows, an off-path hit keeps a yellow ring at 0.55 opacity | Auto |
| S-05 | Switching to Semantic re-runs the query against `/api/semantic-search-graph` | Auto |
| S-06 | The X button clears every highlight | Auto |
| S-07 | A query with no hits shows no result line and no highlights | Auto |
| S-08 | Searching never moves nodes | Auto |
| S-09 | Real keyword search on a real graph returns the nodes you expect, and numeric ids still match | **Manual**, needs Express + AI server |
| S-10 | Real semantic search returns related nodes for a paraphrased query | **Manual** |
| S-11 | (#40, unmerged) Results list rows show label, type and trail; clicking a row or pressing Enter highlights the path and pans to the node | **Manual** after #40 merges |

## Node editing (F3, regression)

| ID | Check | How |
|---|---|---|
| N-01 | The pencil opens the popup and doesn't start a path | Auto |
| N-02 | The popup sits inside the window | Auto |
| N-03 | Apply changes the node's label and color | Auto |
| N-04 | Editing never moves nodes | Auto |
| N-05 | An edit survives search, path and progress changes | Auto |
| N-06 | An edited node still shows live confidence dots | Auto |
| N-07 | Cancel and click-outside both close the popup without saving | Auto |
| N-08 | Edits don't carry over when you open a different graph | Auto |
| N-09 | Reopening a graph starts with no edits. Edits live in the browser session only | Auto, confirm with the team that this is intended |
| N-10 | Dragging the popup by its header keeps it on screen | **Manual** |

## Confidence dots (regression)

| ID | Check | How |
|---|---|---|
| C-01 | Each node shows three dots, filled by score: >0 one, >0.4 two, >0.7 three. The runner tests 0, 0.2, 0.4, 0.41, 0.7, 0.71 and 1, keyed both by node id and by `<prefix>_<name>` | Auto |
| C-02 | A score of 0 looks different from "no score yet" | Auto |
| C-03 | Dots update when progress changes, and nodes stay put | Auto |
| C-04 | One progress entry fills at most one node | Auto |
| C-05 | A short or partial conceptId doesn't match unrelated nodes | Auto |
| C-06 | After a real quiz, the quizzed concepts' dots change on the graph and on /progress | **Manual**, needs the full stack |

## Other

| ID | Check | How |
|---|---|---|
| R-01 | A node you dragged stays put through search and progress updates | Auto |
| G-01 | No console errors or page errors | Auto |
| G-02 | The graph panel works inside /chat: resizing the panel, switching chats, loading a new PDF | **Manual** |
