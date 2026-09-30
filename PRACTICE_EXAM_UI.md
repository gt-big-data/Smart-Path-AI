# Practice exam UI handoff (API version 2)

The backend is implemented; this branch intentionally contains no React/Vite changes.
Practice exams belong to an existing study chat and use its current Neo4j graph.
Users upload **only the sample exam PDF**, not their notes again.

## User flow

Place “Practice Exam” beside “Start Quiz” in the chat header. Disable it when the chat
has no `graph_id`. Keep exam rendering/state in separate components rather than extending
the quiz question loop. Pause the active quiz or require the user to finish it before
opening an exam attempt; quiz answers and exam answers are different workflows.

1. On opening the panel, load exams for `currentChat.id`.
2. Upload a sample PDF and generate an exam. This is a long request, not a background job.
3. Render `sections`, `questions`, and `parts` in their returned array order. Display section
   instructions, original question labels, each shared `stem`, and then each part prompt.
4. Create an attempt, or resume a saved draft from the attempts list.
5. Autosave complete answer snapshots, retaining the latest returned `revision`.
6. Flush the last autosave before submitting. Submit grades the saved snapshot.
7. Show score, per-part feedback, partial credit and solutions from the submitted attempt.
8. Reopen attempts from history. A retake creates a new attempt on the same exam; it does
   not regenerate the questions. A new parallel exam uses the upload/generation endpoint.

`time_limit_minutes` is display metadata. The server does not enforce a countdown or auto-submit.
Store panel/attempt selection per chat, and do not display responses from a previous chat after switching.

## Browser API

All requests go to the **Express** server under `/api/practice-exams`, using the existing
session cookie (`withCredentials: true` or `credentials: 'include'`). Never call the Python
exam API from the browser or expose its service token.

| Method | Path relative to `/api/practice-exams` | Input | Response |
|---|---|---|---|
| POST | `/` | Multipart `chat_id`, `practice_exam` PDF | `201`: exam metadata + public `exam` |
| GET | `/?chat_id=...&limit=20&offset=0` | Owned chat ID; limit 1–100 | `{exams, total, limit, offset}` |
| GET | `/:examId` | — | Metadata + public `exam` |
| POST | `/:examId/attempts` | `{request_id}` | `201` new / `200` existing `{attempt}` |
| GET | `/:examId/attempts` | — | `{attempts}` (latest 100) |
| GET | `/:examId/attempts/:attemptId` | — | `{attempt}` |
| PATCH | `/:examId/attempts/:attemptId` | `{revision, answers}` | Updated `{attempt}` |
| POST | `/:examId/attempts/:attemptId/submit` | `{revision}` | Submitted `{attempt}` |

Use a stable `request_id`, such as `crypto.randomUUID()`, for attempt creation and reuse it
if that creation request is retried. A new deliberate retake gets a new ID. IDs contain
8–100 letters, digits, underscores or hyphens. An ID cannot be reused for another exam.

### Generate

```ts
const form = new FormData();
form.append('chat_id', currentChat.id);
form.append('practice_exam', samplePdf);
const { data: savedExam } = await axios.post(
  `${API_BASE_URL}/api/practice-exams`, form,
  { withCredentials: true, timeout: 600_000 },
);
// Let the browser set multipart Content-Type and its boundary.
```

Metadata fields are `id`, `chat_id`, `graph_id`, `schema_version`, `title`, `total_points`,
`sample_filename`, `created_at`. `graph_id` is the immutable graph used at generation, even
if a subsequent notes upload changes the chat's active graph.

The public exam shape is:

```json
{
  "schema_version": 2,
  "title": "Solutions Practice Exam",
  "instructions": "Show work.",
  "time_limit_minutes": 20,
  "total_points": 5,
  "sections": [{
    "name": "Part I: Calculations",
    "instructions": "Show all work.",
    "questions": [{
      "id": "q1", "label": "1", "stem": "A shared solution scenario...",
      "concept_ids": ["topic-id"],
      "parts": [
        { "id": "q1-p1", "label": "(a)", "type": "numeric", "prompt": "Calculate moles.",
          "choices": null, "points": 2, "depends_on": [] },
        { "id": "q1-p2", "label": "(b)", "type": "numeric", "prompt": "Calculate molarity.",
          "choices": null, "points": 3, "depends_on": ["q1-p1"] }
      ]
    }]
  }]
}
```

Treat IDs as opaque strings; do not construct them from labels. Every question has at
least one part. Standalone questions have one part and may have an empty part label or stem.

Input controls:

- `mcq`: radio buttons for `choices`. Submit the **exact choice text**, not A/B/C/D or an index.
- `tf`: radio buttons submitting `"True"` or `"False"`.
- `numeric`: text input allowing units and scientific notation.
- `short_answer`, `long_answer`: appropriately sized text areas.
- `depends_on`: keep the parts together and show their shared context; this does not prohibit
  answering a later part when an earlier answer is blank.

There are no `answer`, `explanation`, or `rubric` fields in public exams. Solutions appear
only in completed attempt grading. Render content as text; do not insert it as HTML.

### Draft and submit

```ts
const root = `${API_BASE_URL}/api/practice-exams/${savedExam.id}`;
const options = { withCredentials: true };
const { data: created } = await axios.post(`${root}/attempts`, {
  request_id: crypto.randomUUID(),
}, options);
let attempt = created.attempt;
const path = `${root}/attempts/${attempt.id}`;

const { data: updated } = await axios.patch(path, {
  revision: attempt.revision,
  answers: [{ part_id: 'q1-p1', user_answer: '0.1 mol' }],
}, options);
attempt = updated.attempt;

const { data: completed } = await axios.post(`${path}/submit`, {
  revision: attempt.revision,
}, { ...options, timeout: 300_000 });
attempt = completed.attempt;
```

A PATCH replaces the entire answer snapshot. Send every answer to retain; omitted parts
are unanswered. At most 100 entries, each with a unique valid `part_id`, and up to 20,000
characters per answer. The existing Express JSON parser also limits total request size
to 100 KB. Send only `part_id` and `user_answer` within each entry.

Serialize autosaves, retain each response's revision, and flush before submit. A stale
revision returns `409`; reload the attempt and resolve the conflict rather than overwriting
newer answers. Repeated submission of a completed attempt returns its saved result without
regrading. Drafts cannot be edited while grading or after submission.

Attempt fields: `id`, `exam_id`, `status`, `revision`, `answers`, optional `error`,
`submitted_at`, `created_at`, `updated_at`, and `grading` only when submitted.

Statuses: `draft` → `grading` → `submitted`, or `grading_failed`. On an interrupted submit,
GET the attempt: show a spinner and poll while grading; show feedback when submitted;
allow retry when grading failed. A grading operation interrupted by a server restart can
be retried after its ten-minute lease expires, using the current revision. Answers stay saved.

```json
{
  "grading": {
    "score": 4, "total": 5,
    "results": [
      { "part_id": "q1-p1", "points_earned": 1, "points_possible": 2,
        "isCorrect": false, "feedback": "Correct method; check the final calculation.",
        "correct_answer": "0.1 mol", "explanation": "..." },
      { "part_id": "q1-p2", "points_earned": 3, "points_possible": 3,
        "isCorrect": true, "feedback": "Correct.", "correct_answer": "0.2 M", "explanation": "..." }
    ]
  }
}
```

`isCorrect` means full credit; partial credit is represented by `points_earned`. Blank and
omitted answers get zero; the denominator always includes every saved exam part.

## Errors and loading states

Practice exam route errors are JSON `{error: string}`. Display the message as text.
The existing global JSON parser can reject oversized/malformed bodies before these routes;
handle non-JSON error responses too.

- `400`: malformed input or invalid PDF/answers.
- `401`: sign-in required.
- `404`: resource does not exist or belongs to someone else.
- `409`: notes missing, stale draft revision, or another submission is already grading.
- `413`: sample exceeds 10 MB.
- `422`: graph coverage mismatch, unsupported visual, source too large, or generation validation failed.
- `502`: AI unavailable/invalid result. Grading failures retain drafts.
- `503`: service token missing in Express configuration.
- `500`: unexpected server/persistence failure. Reload the saved attempt before retrying.

Generation is synchronous and can take minutes (one generation/check pair per question).
Do not trigger it automatically on chat load. On a timeout, reload the exam list before
retrying because a result may have been saved after the browser lost its response.

## Server setup and database isolation

Set `PRACTICE_EXAM_SERVICE_TOKEN` to the same random value in Express and Python. It is
server-only. Set Express `PYTHON_SERVICE_URL` explicitly to the local Docker address.
The existing default points to the deployed AI service.

For isolated development, override `MONGO_URI` and all three `NEO4J_*` connection settings
with disposable local databases. Do not use the main `.env` database addresses for tests.
No existing data migration is required. Mongoose creates `practiceexams` and
`practiceexamattempts` and their indexes when used; existing models and data are unchanged.

The AI repository's `PRACTICE_EXAM.md` documents its internal endpoints and Docker setup.

## Automated checks

From `Smart-Path-AI`:

```bash
npm --prefix server run build
node --test server/tests/practiceExamContract.test.cjs
```

Integration tests require an isolated MongoDB on local port 27028:

```bash
docker run --rm -d --name smartpath-exam-test-mongo -p 127.0.0.1:27028:27017 mongo:7
PRACTICE_EXAM_TEST_MONGO_URI=mongodb://127.0.0.1:27028/smartpath_exam_test_unique123 \
  node --test server/tests/practiceExam.integration.test.cjs
docker stop smartpath-exam-test-mongo
```

The test rejects remote/main database addresses, refuses an already-existing database, creates its own test records, and drops
only its newly created whitelisted test database on completion. It stubs AI responses but exercises real
Mongo persistence and Express HTTP routes, including ownership, hidden keys, revision
conflicts, duplicate-submit protection and grading failure recovery.
