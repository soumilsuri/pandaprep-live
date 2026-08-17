# 08 — Agentic Observability, Telemetry & Evaluation Implementation Guide

> **Master Architecture Reference**:
> This document translates the comprehensive engineering blueprint from [`agentic-observability-evals-report.md`](file:///d:/coding_d/PandaPrep/agentic-observability-evals-report.md) into concrete, actionable implementation specifications for `backend-agentic`.
>
> **Core AI Provider**: **DeepSeek V4 Flash Free** (`deepseek-v4-flash-free`) via **OpenCode Zen** ([https://opencode.ai/docs/](https://opencode.ai/docs/)).
> **Agent Framework**: **LangGraph.js** & **LangChain** (`@langchain/openai` configured with OpenCode Zen base URL `https://api.opencode.ai/v1`).

---

## 1. Implementation Status & Audit Matrix

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        OBSERVABILITY & EVALS STATUS SUMMARY                            │
├────────────────────────────────┬───────────────────────────────┬────────────────────────┤
│ PILLAR 1: Traceability         │ PILLAR 2: Operational Health  │ PILLAR 3: Evaluations  │
│ 80% Complete                   │ 50% Complete                  │ 40% Complete           │
│ (Correlation IDs & Checkpoints │ (Heartbeats & Queue telemetry │ (Live Verifier active; │
│  active; Langfuse hook needed) │  active; Aggregation needed)  │  CI/CD Benchmarks miss)│
└────────────────────────────────┴───────────────────────────────┴────────────────────────┘
```

| Component | Status | Code Location | What Needs to be Implemented |
|---|---|---|---|
| **1. Correlation ID Middleware** | ✅ Implemented | [`correlation-id.middleware.ts`](file:///d:/coding_d/PandaPrep/backend-agentic/src/middleware/correlation-id.middleware.ts) | Complete. Generates UUID `requestId` and threads to logs & DB. |
| **2. Structured Pino JSON Logger** | ✅ Implemented | [`config/logger.ts`](file:///d:/coding_d/PandaPrep/backend-agentic/src/config/logger.ts) | Complete. Emits structured JSON with child request IDs. |
| **3. Mongo Node Checkpointing** | ✅ Implemented | [`graph/checkpointer.ts`](file:///d:/coding_d/PandaPrep/backend-agentic/src/graph/checkpointer.ts) & [`agent-checkpoint.model.ts`](file:///d:/coding_d/PandaPrep/backend-agentic/src/models/agent-checkpoint.model.ts) | Complete. Persists full workspace snapshot after every node. |
| **4. Worker Heartbeat & Sweeper** | ✅ Implemented | [`queue/heartbeat.ts`](file:///d:/coding_d/PandaPrep/backend-agentic/src/queue/heartbeat.ts) & [`queue/sweeper.ts`](file:///d:/coding_d/PandaPrep/backend-agentic/src/queue/sweeper.ts) | Complete. Detects dead workers and re-queues stale missions. |
| **5. Live Verifier Contract Checks** | ✅ Implemented | [`agents/verifier.agent.ts`](file:///d:/coding_d/PandaPrep/backend-agentic/src/agents/verifier.agent.ts) | Complete. Audits 6 contracts and stores `verification_results`. |
| **6. Langfuse Span Telemetry** | ❌ Backlog | [`queue/worker.ts`](file:///d:/coding_d/PandaPrep/backend-agentic/src/queue/worker.ts) | Install `langfuse-langchain`, initialize callback, and pass to LangGraph. |
| **7. Operational Metrics Endpoint** | ❌ Backlog | [`controllers/metrics.controller.ts`](file:///d:/coding_d/PandaPrep/backend-agentic/src/controllers/) | Add `GET /api/pipeline/metrics` with MongoDB aggregation pipelines. |
| **8. Offline Golden Dataset & Evals** | ❌ Backlog | `backend-agentic/evals/` | Add 20-syllabi benchmark dataset, eval runner, and CI/CD workflow. |
| **9. Model Provider Migration** | ❌ Backlog | [`agents/llm.ts`](file:///d:/coding_d/PandaPrep/backend-agentic/src/agents/llm.ts) | Update LLM client to OpenCode Zen (`deepseek-v4-flash-free`). |

---

## 2. Implementation Specifications

### Task 1: Model Provider Migration to DeepSeek V4 Flash Free (OpenCode Zen)
- **Target File**: [`backend-agentic/src/agents/llm.ts`](file:///d:/coding_d/PandaPrep/backend-agentic/src/agents/llm.ts)
- **Dependencies**: Install `@langchain/openai` in `backend-agentic/package.json`.
- **Configuration**:
  ```typescript
  import { ChatOpenAI } from '@langchain/openai';
  import { env } from '../config/env.js';

  export function getCapableLLM(temperature = 0.2): ChatOpenAI {
    return new ChatOpenAI({
      modelName: 'deepseek-v4-flash-free',
      temperature,
      configuration: {
        baseURL: env.OPENCODE_BASE_URL || 'https://api.opencode.ai/v1',
        apiKey: env.OPENCODE_API_KEY,
      },
    });
  }

  export function getFastLLM(temperature = 0.0): ChatOpenAI {
    return getCapableLLM(temperature);
  }
  ```

---

### Task 2: Pillar 1 — Langfuse Span Telemetry Hook
- **Target File**: [`backend-agentic/src/queue/worker.ts`](file:///d:/coding_d/PandaPrep/backend-agentic/src/queue/worker.ts)
- **Dependencies**: Install `langfuse-langchain` in `backend-agentic/package.json`.
- **Environment Variables**: Add `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` to `env.ts`.
- **Implementation**:
  ```typescript
  import { CallbackHandler } from 'langfuse-langchain';

  // Inside AgentWorker.processMission():
  const langfuseHandler = new CallbackHandler({
    sessionId: requestId,
    userId: mission.user_id ? String(mission.user_id) : undefined,
    tags: [payload.note_type || 'detailed', env.NODE_ENV],
  });

  const finalState = await notesGenerationGraph.invoke(graphInput, {
    callbacks: [langfuseHandler],
  });
  ```

---

### Task 3: Pillar 2 — Real-Time Operational Health Metrics Endpoint
- **Target Files**:
  - New Controller: `backend-agentic/src/controllers/metrics.controller.ts`
  - Routes: `backend-agentic/src/routes/pipeline.routes.ts`
- **Route**: `GET /api/pipeline/metrics` (Protected by API Key / Admin Auth)
- **Metrics Calculated via MongoDB Aggregation (`NotesWorkspaceModel`)**:
  1. **Section Repair Rate**: `(Total Repaired Sections / Total Drafted Sections) * 100` (Target: `< 15%`).
  2. **Checklist Exhaustion Rate**: `(Missions with outstanding_gaps > 0 / Total Missions) * 100` (Target: `< 3%`).
  3. **Average DAG Node Count**: Average number of nodes in `topic_graph.nodes` (Target: `8 to 14`).
  4. **Latency Percentiles**: P50, P95, P99 calculated over `NotesRequestModel.processing_time_ms`.
  5. **Queue Health**: Count of active workers heartbeating in the last 30s.

---

### Task 4: Pillar 3 — Offline Golden Dataset & CI/CD Regression Gate
- **Target Directory**: `backend-agentic/evals/`
- **Deliverables**:
  1. `evals/golden-syllabi.json`: 20 diverse, multi-discipline benchmark syllabi (CS, Organic Chemistry, Thermodynamics, Law, Medicine).
  2. `evals/eval-runner.ts`: Script that runs `notesGenerationGraph.invoke()` against all 20 syllabi, calculating:
     - **Completeness ($S_{\text{comp}}$)**: $100\%$ required coverage against checklist.
     - **Faithfulness ($S_{\text{faith}}$)**: Citation grounding score.
     - **Coherence ($S_{\text{cohere}}$)**: Terminology consistency check.
     - **LaTeX Syntax ($S_{\text{syntax}}$)**: Zero unclosed delimiters.
     - **Aggregate Score ($Q_{\text{aggregate}}$)**: Weighted mean across all 20 tests.
  3. `.github/workflows/evals.yml`: Automated GitHub Actions workflow on Pull Requests that compares $Q_{\text{PR}}$ vs $Q_{\text{main}}$ and **fails the build if the score drops by $> 2\%$**.

---

## 3. Verification & Acceptance Criteria

1. **Langfuse Verification**: Running a mission generates a complete trace flamegraph in the Langfuse dashboard with nested tool spans and token counts.
2. **Metrics Endpoint Verification**: `GET /api/pipeline/metrics` returns valid JSON with aggregated repair rates and latency percentiles.
3. **CI/CD Regression Verification**: Running `npm run test:evals` executes the 20 golden syllabi and asserts an aggregate score $\ge 95\%$.
