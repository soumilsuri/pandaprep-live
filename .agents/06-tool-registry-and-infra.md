# 06 — Tool Registry & Infrastructure Architecture

## 1. In-Process Tool Registry

All agent tools run in-process within the worker as **strongly typed JavaScript functions**.

### Why MCP (Model Context Protocol) is Deferred
Every agent that requires tools (Planner, Writers, Verifier, Q&A) runs inside the same Node.js worker process. There is no cross-process or remote service boundary within the generation graph that justifies the serialization and network overhead of MCP.
An internal typed registry provides identical tool capabilities with zero transport latency. If external agents (e.g. external dashboards) require access in the future, the registry functions can be wrapped in an MCP adapter without changing core tool logic.

---

## 2. Tool Definitions & Execution

| Tool | Invocation Trigger | Underlying Implementation |
|---|---|---|
| `retrieve_reference` | Writer needs source material for section | Atlas Vector Search over document embeddings (`gemini-embedding-2`). |
| `retrieve_workspace` | Writer / Q&A needs notes workspace facts | Direct query against MongoDB `notes_workspaces` collection. |
| `search_web` | Sparse syllabus line OR out-of-scope Q&A | Web search API (e.g. Tavily / Gemini Grounding) with strict token limits on results. |
| `finalize_markdown` | Finalize step after verification passes | Compiles TOC, validates LaTeX syntax, saves final Markdown string to MongoDB. |
| `notify` | Notes generated & saved | Brevo Transactional Email API (notifying user notes are ready to view/download). |

---

## 3. Pure Markdown Storage & Browser-Side PDF Export

The legacy architecture required an external Azure Web App microservice running headless Chrome to convert markdown to PDF. This added 25+ seconds of latency, high RAM usage, and created a single point of failure.

### The Modern Markdown-First Pipeline
```
[Notes Verified & Combined]
            │
            ▼
1. Assemble Table of Contents & Clean LaTeX Math ($...$, $$...$$)
            │
            ▼
2. Persist Full Markdown in `notes_workspaces` & `NotesRequestModel` (~18 KB in MongoDB Atlas)
            │
            ▼
3. Dispatch Brevo Email & Mark Mission Status: 'completed'
            │
            ▼
4. Frontend Polling Receives Markdown Payload Instantly
            │
            ├─► Instant Claude-Style Reading View in `<MarkdownViewer />`
            └─► 1-Click "Download PDF" using native browser `window.print()`
```

*Benefits:*
- **Zero Server Rendering Overhead**: No headless browser, no Puppeteer, no external microservice.
- **Ultra-Compact Database Footprint**: 18 KB markdown is ~50x smaller than a PDF. Storing 10,000 notes takes only ~180 MB.
- **Zero-Latency History**: Opening past notes loads instantly from MongoDB without downloading multi-megabyte PDF binaries.

---

## 4. MongoDB Atlas Queue & Checkpointer Architecture

### Why No Redis / BullMQ?
1. **Scale Matching**: The system processes job starts (tens to low hundreds per minute), not high-throughput request spikes. Mongo polling at 2–3s intervals is negligible compared to a 1–3 minute generation run.
2. **Single Failure Domain**: Storing missions, working memory, and checkpoints inside MongoDB Atlas eliminates dual-system synchronization issues (e.g., Redis state vs Mongo state divergence).
3. **Operational Simplicity**: Removes external managed Redis instances.

---

### Queue Data Model & Atomic Claiming

#### Collection: `missions`
```javascript
{
  "_id": ObjectId("..."),
  "request_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "user_id": ObjectId("..."),
  "status": "queued", // "queued" | "processing" | "completed" | "failed"
  "worker_id": null,
  "claimed_at": null,
  "last_seen_at": null,
  "retry_count": 0,
  "next_attempt_at": ISODate("2026-08-14T23:00:00Z"),
  "payload": { /* form submission data */ }
}
```

#### Atomic Claiming Pattern (`findOneAndUpdate`)
MongoDB guarantees atomicity for single-document updates, preventing race conditions between workers:
```javascript
async function claimNextMission(workerId) {
  const now = new Date();
  return await MissionModel.findOneAndUpdate(
    {
      status: 'queued',
      next_attempt_at: { $lte: now }
    },
    {
      $set: {
        status: 'processing',
        worker_id: workerId,
        claimed_at: now,
        last_seen_at: now
      }
    },
    { sort: { created_at: 1 }, new: true }
  );
}
```

---

### Stalled Job Sweeper & Heartbeat

To prevent lost jobs if a worker crashes mid-task:
1. **Heartbeat**: The active worker updates `last_seen_at = new Date()` every 10 seconds during processing.
2. **Stale Recovery Sweep**: A background timer runs every 30 seconds:
```javascript
async function recoverStaleMissions() {
  const staleThreshold = new Date(Date.now() - 60000); // 60s without heartbeat
  await MissionModel.updateMany(
    {
      status: 'processing',
      last_seen_at: { $lt: staleThreshold },
      retry_count: { $lt: 3 }
    },
    {
      $set: {
        status: 'queued',
        worker_id: null,
        next_attempt_at: new Date(Date.now() + 5000) // 5s backoff
      },
      $inc: { retry_count: 1 }
    }
  );
}
```

---

### Agent Runtime Checkpointing

The agent runtime writes intermediate graph state to the `agent_checkpoints` collection after each node transition (Intake → Planner → Writer → Verifier).
When a recovered worker resumes a mission, it reads the latest checkpoint from MongoDB and **continues from the last successful step** rather than re-running from scratch.

---

### Mongo-Backed Rate Limiting

Rate limiting is handled via a windowed counter in `rate_limits` collection:
```javascript
async function checkRateLimit(userId, maxRequests = 5, windowMinutes = 10) {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
  const doc = await RateLimitModel.findOneAndUpdate(
    { userId, windowStart: { $gte: windowStart } },
    { $inc: { count: 1 }, $setOnInsert: { windowStart: new Date() } },
    { upsert: true, new: true }
  );
  return doc.count <= maxRequests;
}
```
