# Graph view checklist: automated run

Run 2026-10-30T21:38:09.637Z · fixtures: small, no-center, history, large

| Check | small | no-center | history | large |
|---|:-:|:-:|:-:|:-:|
| L-01 every node renders | ✅ | ✅ | ✅ | ✅ |
| L-02 no node boxes overlap (rendered DOM size) | ✅ | ✅ | ✅ | ✅ |
| L-03 tree center sits at the layout origin | ✅ | ✅ | ✅ | ✅ |
| L-04 deeper nodes sit on wider rings | ✅ | ✅ | ✅ | ✅ |
| L-05 first view shows the center and its first two rings | ✅ | ✅ | ✅ | ❌ |
| E-01 no edge labels or animation at rest | ✅ | ✅ | ✅ | ✅ |
| E-02 hovering an edge shows its label | ✅ | ✅ | ✅ | ✅ |
| E-03 label hides again when the mouse leaves | ✅ | ✅ | ✅ | ✅ |
| C-01 every node has three dots, filled per score (>0, >0.4, >0.7) | ✅ | ✅ | ✅ | ✅ |
| C-02 score 0 looks different from "no score yet" | ❌ | ❌ | ❌ | ❌ |
| C-03 dots update when progress changes, without moving nodes | ✅ | ✅ | ✅ | ✅ |
| C-04 one progress entry lights at most one node | ❌ | ❌ | ❌ | ❌ |
| C-05 short or partial conceptIds don't match unrelated nodes | ✅ | ✅ | ✅ | ✅ |
| P-01 clicking a node numbers its path from the center | ✅ | ✅ | ✅ | ✅ |
| P-02 path nodes get the orange border, others fade | ✅ | ✅ | ✅ | ✅ |
| P-03 only path edges are animated, orange and labelled | ✅ | ✅ | ✅ | ✅ |
| P-04 Escape clears the path | ✅ | ✅ | ✅ | ✅ |
| P-05 clicking empty canvas clears the path | ✅ | ✅ | ✅ | ✅ |
| P-06 clicking the center clears the path | ✅ | ✅ | ✅ | ✅ |
| P-07 deepest node gets a full path | ✅ | ✅ | ✅ | ✅ |
| P-08 path clicks never move nodes | ✅ | ✅ | ✅ | ✅ |
| P-09 unfinished path bar stays hidden | ✅ | ✅ | ✅ | ✅ |
| S-01 keyword search calls /api/search-graph with this graph_id | ✅ | ✅ | ✅ | ✅ |
| S-02 every hit gets the yellow border, nothing else does | ✅ | ✅ | ✅ | ✅ |
| S-03 "Found N matching nodes" matches the hit count | ✅ | ✅ | ✅ | ✅ |
| S-04 off-path search hit keeps a yellow ring at 0.55 opacity | ✅ | ✅ | ✅ | ✅ |
| S-05 Semantic toggle re-runs the query on /api/semantic-search-graph | ✅ | ✅ | ✅ | ✅ |
| S-06 clearing the box removes every highlight | ✅ | ✅ | ✅ | ✅ |
| S-07 a query with no hits shows no list and no highlights | ✅ | ✅ | ✅ | ✅ |
| S-08 searching never moves nodes | ✅ | ✅ | ✅ | ✅ |
| N-01 pencil opens the popup without starting a path | ✅ | ✅ | ✅ | ✅ |
| N-02 popup sits fully inside the window | ✅ | ✅ | ✅ | ✅ |
| N-03 Apply changes the label and color | ✅ | ✅ | ✅ | ✅ |
| N-04 editing never moves nodes | ✅ | ✅ | ✅ | ✅ |
| N-05 edit survives search, path and progress changes | ✅ | ✅ | ✅ | ✅ |
| N-06 edited node keeps live confidence dots | ✅ | ✅ | ✅ | ✅ |
| N-07 Cancel and clicking outside close without saving | ✅ | ✅ | ✅ | ✅ |
| R-01 a dragged node stays put through search and progress updates | ✅ | ✅ | ✅ | ✅ |
| N-08 edits don't carry over to the next graph | ✅ | ✅ | ✅ | ✅ |
| N-09 reopening the same graph starts without edits | ✅ | ✅ | ✅ | ✅ |
| G-01 no console errors or page errors | ✅ | ✅ | ✅ | ✅ |

## Failures and notes

- **small · C-02 score 0 looks different from "no score yet"**: both show 0 filled dots; a student can't tell "never quizzed" from "got it all wrong"
- **small · C-04 one progress entry lights at most one node**: a single entry with conceptId "apoc.create.uuid()" filled 10 nodes (fixture Topics share that literal topicID)
- **no-center · C-02 score 0 looks different from "no score yet"**: both show 0 filled dots; a student can't tell "never quizzed" from "got it all wrong"
- **no-center · C-04 one progress entry lights at most one node**: a single entry with conceptId "apoc.create.uuid()" filled 10 nodes (fixture Topics share that literal topicID)
- **history · C-02 score 0 looks different from "no score yet"**: both show 0 filled dots; a student can't tell "never quizzed" from "got it all wrong"
- **history · C-04 one progress entry lights at most one node**: a single entry with conceptId "apoc.create.uuid()" filled 3 nodes (fixture Topics share that literal topicID)
- **large · L-05 first view shows the center and its first two rings**: 1/255 on screen at zoom 0.10 (minZoom 0.1); ring 1 mean radius 9166 px
- **large · C-02 score 0 looks different from "no score yet"**: both show 0 filled dots; a student can't tell "never quizzed" from "got it all wrong"
- **large · C-04 one progress entry lights at most one node**: a single entry with conceptId "apoc.create.uuid()" filled 36 nodes (fixture Topics share that literal topicID)

## Browser first-render time (harness load to all nodes in the DOM)

- small: 259 ms
- no-center: 257 ms
- history: 289 ms
- large: 1197 ms
