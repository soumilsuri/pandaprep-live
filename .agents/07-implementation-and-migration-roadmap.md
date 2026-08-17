# 07 — Implementation & Migration Roadmap

## 1. Phased Migration Strategy

To guarantee zero downtime and avoid breaking the existing user base, the new agentic backend is implemented in **5 distinct phases**. The legacy pipeline remains operational during development.

---

### 🚀 Phase 1: TypeScript Setup, Core Runtime (LangGraph.js) & Mongo-Backed Queue
- **Deliverables**:
  - Configure **TypeScript** (`tsconfig.json`, `tsx` / `ts-node` runtime) in `backend/` for the new `src/agentic/` module.
  - Set up **LangGraph.js** (`@langchain/langgraph`, `@langchain/core`, `@langchain/openai` configured for OpenCode Zen API).
  - Implement strongly-typed `MissionModel` and `AgentCheckpointModel` in MongoDB for LangGraph checkpointer.
  - Build atomic job claim (`claimNextMission`), worker heartbeat, and stale mission recovery sweeper (`recoverStaleMissions`).
  - Set up LangGraph `StateGraph` with MongoDB checkpoint persistence.
  - Validate that `POST /api/pipeline/generate-notes` and `GET /api/pipeline/generation-status/:requestId` work end-to-end with a basic passthrough graph.

---

### 🚀 Phase 2: Planner Agent, Notes Workspace & Writers
- **Deliverables**:
  - Implement `NotesWorkspaceModel` schema in MongoDB.
  - Implement `PlannerAgent` producing `topic_graph`, `coverage_checklist`, and `style_decisions`.
  - Implement `getScopedWorkspaceSlice` helper to extract token-bounded context for each section.
  - Implement `WriterAgent` to draft sections concurrently against the workspace, updating `terms_defined` and `cross_reference_anchors`.

---

### 🚀 Phase 3: Verifier Agent & Bounded Repair Loop
- **Deliverables**:
  - Implement `VerifierAgent` with the 6 contract checks (coverage, missing topics, grounding, terminology, cross-refs, syntax).
  - Build the targeted repair loop (max 2 section iterations + 1 document pass).
  - Implement `outstanding_gaps` recording for unresolvable issues.

---

### 🚀 Phase 4: Tool Registry & Frontend Markdown Reader
- **Deliverables**:
  - Implement the in-process Tool Registry (`retrieve_reference`, `retrieve_workspace`, `search_web`, `finalize_markdown`, `notify`).
  - Persist assembled markdown directly in `notes_workspaces` and `NotesRequestModel.markdown_content`.
  - Build `<MarkdownViewer />` in Next.js frontend (`react-markdown` + `rehype-katex`) and wire up `window.print()` with `@media print` CSS for 1-click PDF download.
  - Update `history/page.tsx` to open notes directly in the interactive viewer.

---

### 🚀 Phase 5: Upgraded Interactive Q&A Agent
- **Deliverables**:
  - Upgrade Q&A pipeline to tool-using agent (`search_notes`, `search_reference`, `quiz_me`, `explain_more`, `search_web`).
  - Store multi-turn chat history in MongoDB `chat_histories` collection.
  - Enforce maximum 3–4 tool steps per student turn.

---

## 2. Cost & Latency Bounding Checklist

| Constraint Area | Target Limit | Enforcement Mechanism |
|---|---|---|
| **Repair Loop Iterations** | Max 2 per section, 1 doc pass | Graph transition condition checks loop counter in workspace. |
| **Writer Concurrency** | Bounded (e.g. 3 concurrent) | `p-limit` or worker pool tied to OpenCode Zen rate limits. |
| **Prompt Size** | Scoped Workspace Summary | Filter workspace down to prerequisites only via `getScopedWorkspaceSlice`. |
| **Model Tiers** | Unified Fast MoE Model | **DeepSeek V4 Flash Free** via **OpenCode Zen** ([https://opencode.ai/docs/](https://opencode.ai/docs/)). |
| **Q&A Tool Depth** | Max 3–4 calls per message | Agent graph termination condition after 4 tool executions. |

---

## 3. Observability & Telemetry Blueprint

1. **Correlation IDs**:
   - Generate `requestId` (UUID v4) at API intake.
   - Thread `requestId` as metadata through every log entry, LLM invocation, MongoDB update, and external HTTP request (`X-Correlation-ID` header).
2. **Structured JSON Logging**:
   - Use Winston or Pino to log events in JSON format:
   ```json
   {
     "timestamp": "2026-08-14T23:01:00.000Z",
     "level": "info",
     "requestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
     "stage": "verifier_check",
     "sectionId": "sec_02",
     "passed": false,
     "issuesFound": 1
   }
   ```
3. **Agent Run Tracing**:
   - Persist node execution logs in MongoDB so failed or degraded runs can be inspected without digging through ephemeral console logs.

---

## 4. Verification & Testing Matrix

| Component | Automated Test Focus |
|---|---|
| **API Contracts** | Verify HTTP 202 response schema and status polling endpoints match frontend requirements. |
| **Mongo Queue** | Test atomic claiming (`findOneAndUpdate`) under concurrent simulated workers to ensure zero double-claims. |
| **Planner Output** | Schema validation on `topic_graph` (DAG validation) and `coverage_checklist`. |
| **Verifier Contract** | Unit tests with intentionally corrupted sections (missing topic, contradictory definition) to verify repair triggering. |
| **Circuit Breaker** | Simulate microservice timeout/500 to verify markdown remains safely saved in MongoDB. |
