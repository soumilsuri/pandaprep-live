# PandaPrep 2.0 — Agentic Observability, Telemetry & Evaluation Engineering Report

**Target System**: PandaPrep Agentic Backend (`backend-agentic`)  
**Core Frameworks**: LangGraph.js, Langfuse, MongoDB Atlas, Pino, and **DeepSeek V4 Flash Free** (`deepseek-v4-flash-free`) via **OpenCode Zen** ([https://opencode.ai/docs/](https://opencode.ai/docs/))  
**Document Purpose**: Definitive technical guide, production operational blueprint, and architecture defense for observability, telemetry, automated evals, LLM-as-a-Judge, and Human-in-the-Loop (HITL).

---

## Table of Contents
1. [Executive Summary: The 3-Pillar Observability Architecture](#1-executive-summary-the-3-pillar-observability-architecture)
2. [Pillar 1: System-Level Traceability (The Execution Audit Trail)](#2-pillar-1-system-level-traceability-the-execution-audit-trail)
   - 2.1 Distributed Correlation ID Threading
   - 2.2 Node-by-Node State Checkpointing & Time-Travel Debugging
   - 2.3 Span-Level Telemetry & Flamegraphs (Langfuse Integration)
3. [Pillar 2: Runtime Operational Telemetry (System Health & SLAs)](#3-pillar-2-runtime-operational-telemetry-system-health--slas)
   - 3.1 AI Quality & Loop Health Metrics
   - 3.2 RAG Knowledge Grounding Telemetry
   - 3.3 Stateless Queue & Worker Fleet Metrics
   - 3.4 Latency Percentiles (P50/P95/P99) & Token Economics
4. [Pillar 3: Evaluation Frameworks (Online vs. Offline)](#4-pillar-3-evaluation-frameworks-online-vs-offline)
   - 4.1 Offline Pre-Deployment CI/CD Regression Gate
   - 4.2 Online Continuous Production Auditing
   - 4.3 Core Evaluation Dimensions & Scoring Rubrics
5. [LLM-as-a-Judge: Methodology, Bias Mitigation & Calibration](#5-llm-as-a-judge-methodology-bias-mitigation--calibration)
   - 5.1 The Self-Grading Bias Problem & Model Decoupling
   - 5.2 Anchored Rubrics vs. Open-Ended Scoring
   - 5.3 Programmatic Pre-Filters vs. LLM Judges
   - 5.4 Mitigating Position and Verbosity Biases
6. [Human-in-the-Loop (HITL) & The Active Learning Flywheel](#6-human-in-the-loop-hitl--the-active-learning-flywheel)
   - 6.1 Implicit vs. Explicit Human Feedback Signals
   - 6.2 Human Triage for Disputed Edge Cases
   - 6.3 Self-Expanding Golden Dataset Flywheel
7. [Real-World Incident Walkthrough (60-Second Root Cause Analysis)](#7-real-world-incident-walkthrough-60-second-root-cause-analysis)
8. [Interview Defense Cheat Sheet](#8-interview-defense-cheat-sheet)

---

## 1. Executive Summary: The 3-Pillar Observability Architecture

In deterministic software, monitoring is straightforward: servers emit HTTP status codes, latencies, and database query times. In a **Multi-Agent AI System**, execution is non-deterministic, branching, and stateful: agents make probabilistic choices, invoke parallel tools, evaluate contracts, and self-heal in bounded loops.

To maintain production reliability, PandaPrep implements a **3-Pillar Observability & Evaluation System**:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          3 PILLARS OF AGENTIC OBSERVABILITY                             │
├────────────────────────────────┬───────────────────────────────┬────────────────────────┤
│ PILLAR 1: Traceability         │ PILLAR 2: Operational Health  │ PILLAR 3: Evaluations  │
│ "What exact path did mission   │ "Is the macro-system healthy  │ "Is note quality high  │
│  X take through the graph?"    │  across 10,000 live runs?"    │  and regression-free?" │
└────────────────────────────────┴───────────────────────────────┴────────────────────────┘
```

---

## 2. Pillar 1: System-Level Traceability (The Execution Audit Trail)

Pillar 1 ensures every single student request leaves an immutable, reproducible audit trail across network boundaries, asynchronous job queues, LLM provider calls, and database writes.

```text
[Client Request] ──► [Express API Gateway (Generates UUID requestId)]
                           │
                           ▼
                    [MongoDB Queue (mission_id)]
                           │
                           ▼
                    [Worker Process (Pino Child Logger)]
                           │
                           ├─► Node Checkpoints ──► MongoDB `agent_checkpoints`
                           │
                           └─► LLM Spans & Tools ──► Langfuse Flamegraphs
```

### 2.1 Distributed Correlation ID Threading
1. **Ingress Generation**: Express middleware (`correlation-id.middleware.ts`) extracts or creates a UUID v4:
   ```typescript
   const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
   req.correlationId = correlationId;
   res.setHeader('X-Correlation-ID', correlationId);
   ```
2. **Queue Propagation**: The ID is stored as `mission_id` in the `missions` collection.
3. **Structured Logger Injection**: Pino child loggers automatically attach `{ requestId }` to every JSON log line emitted by workers, agents, and tools.
4. **Outbound API Tagging**: The correlation ID is passed to Brevo email headers, OpenCode Zen API metadata, and Tavily search metadata.

### 2.2 Node-by-Node State Checkpointing & Time-Travel Debugging
After every node execution in LangGraph (`intake`, `planner`, `writer`, `verifier`, `repair`, `finalize`), `MongoAgentCheckpointer` persists an immutable snapshot document into MongoDB's `agent_checkpoints` collection:

```typescript
// backend-agentic/src/graph/checkpointer.ts
await AgentCheckpointModel.create({
  thread_id: missionId,            // Unified requestId
  checkpoint_id: uuidv4(),         // Unique snapshot ID
  parent_checkpoint_id: parentId,  // Linked list of state transitions
  node: 'planner',                 // Current agent node
  state: stateSnapshot,            // Full Notes Workspace state at this exact second
  metadata: { timestamp: new Date(), node: 'planner' }
});
```

#### Why Node Checkpointing is Critical:
* **Time-Travel Post-Mortems**: Engineers can inspect the exact state of `coverage_checklist` before and after the Verifier ran, isolating prompt reasoning bugs in seconds.
* **Crash Resumability (Idempotence)**: If a container restarts during Section 8, a new worker loads `loadLatestCheckpoint(missionId)` and resumes execution directly from Section 8, saving previously generated sections and paid LLM tokens.
* **Non-Blocking Safety**: Checkpoint writes run inside a `safeCheckpoint()` try/catch block. Observability failures log a warning and **never crash a student's live mission**.

### 2.3 Span-Level Telemetry & Flamegraphs (Langfuse Integration)
While checkpoints record *state*, telemetry tracks *tokens, latency, and costs*. We selected **Langfuse** (open-source Apache 2.0 with a generous 50,000 free observations/mo tier) as our Layer 3 engine.

#### LangGraph Hook:
```typescript
import { CallbackHandler } from 'langfuse-langchain';

const langfuseHandler = new CallbackHandler({
  sessionId: mission.request_id,
  userId: mission.user_id,
  tags: [mission.note_type, 'production'],
});

const finalState = await notesGenerationGraph.invoke(initialState, {
  callbacks: [langfuseHandler],
});
```

#### Production Flamegraph Visualization:
```text
[Mission: mission-uuid-123] ── Total Duration: 34.2s ($0.0031)
 ├── [Span 1: Intake Node] ── 410ms (320 tokens)
 ├── [Span 2: Planner Node] ── 1.8s (1,450 tokens)
 │    └── [Tool Span: search_web] ── 650ms
 ├── [Span 3: Parallel Writers] ── 26.1s (14,200 tokens total)
 │    ├── [Writer: Section 01 (DeepSeek V4)] ── 12.4s (3,100 tokens)
 │    │    └── [Tool: retrieve_reference (Atlas Vector Search)] ── 85ms
 │    ├── [Writer: Section 03 (DeepSeek V4)] ── 11.8s (2,900 tokens)
 │    └── [Writer: Section 02 (DeepSeek V4)] ── 13.7s (3,400 tokens)
 ├── [Span 4: Verifier Node] ── 3.2s (2,100 tokens - 6 Contract Checks)
 └── [Span 5: Finalizer Node (TypeScript)] ── 12ms (0 tokens - Pure Code)
```

---

## 3. Pillar 2: Runtime Operational Telemetry (System Health & SLAs)

Pillar 2 aggregates metrics across thousands of runs to identify macro-trends, prompt drift, queue congestion, and SLA violations in real time.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PILLAR 2: OPERATIONAL METRICS RADAR                             │
├───────────────────────────────────┬────────────────────────────────────────────────────┤
│ 1. AI Quality & Loop Health       │ 2. RAG & Knowledge Grounding                       │
│ • Section Repair Rate (< 15%)     │ • Avg Vector Similarity (>= 0.72)                  │
│ • Exhaustion Rate (< 3%)          │ • Ungrounded Fallback Rate (< 5%)                  │
├───────────────────────────────────┼────────────────────────────────────────────────────┤
│ 3. Queue & Worker Fleet           │ 4. Latency SLAs & Cost                             │
│ • Time-in-Queue (< 2.0s)          │ • P50: 29s | P95: 41s | P99: 46s                   │
│ • Stale Claim Recoveries (= 0)    │ • Dollar Cost per Note: $0.00 (Free Tier)          │
└───────────────────────────────────┴────────────────────────────────────────────────────┘
```

### 3.1 AI Quality & Loop Health Metrics
* **Section Repair Rate**: Percentage of sections failing initial verifier audit and requiring a patch.
  $$\text{Repair Rate} = \frac{\text{Repaired Sections}}{\text{Total Drafted Sections}} \times 100$$
  * *Target*: **< 15%**.
  * *Alert Condition*: If $> 25\%$, prompts have drifted or the LLM provider changed model behavior.
* **Checklist Exhaustion Rate**: Percentage of missions where `outstanding_gaps.length > 0` (failed 2 repair iterations).
  * *Target*: **< 3%**.
* **DAG Node Distribution**: Average number of planned sections.
  * *Target*: **8 to 14 nodes**.
  * *Alert Condition*: If $> 18$ nodes, the Planner's macro-clustering logic is breaking down.

### 3.2 RAG Knowledge Grounding Telemetry
* **Average Cosine Similarity**: Tracks semantic similarity scores returned by Atlas Vector Search.
  * *Target*: **>= 0.72**.
  * *Degradation (< 0.60)*: Indicates low-quality student PDF scans or chunking misalignment.
* **Ungrounded Fallback Rate**: Percentage of sections where similarity fell below the $0.65$ threshold, forcing the writer to generate from base knowledge without citations. (Target: $< 5\%$).

### 3.3 Stateless Queue & Worker Fleet Metrics
* **Queue Wait Time (Time-to-Claim)**: Time between HTTP enqueue and worker atomic lock.
  * *Target*: **< 2.0 seconds**.
  * *Alert (> 10s)*: Worker fleet is saturated; triggers auto-scaling of worker instances.
* **Worker Heartbeat Liveness**: Real-time count of active workers updating `last_seen_at` every 10s.
* **Stale Claim Recovery Rate**: Stalled missions reclaimed per day. (Target: $0$).

### 3.4 Latency Percentiles & Token Economics
* **P50 Latency (Median)**: **28 to 32 seconds**.
* **P95 Latency (Single Repair Run)**: **38 to 42 seconds**.
* **P99 Latency (Max Repair Run)**: **45 to 48 seconds**.
* **Target SLA**: 99.9% of missions complete in $< 60$ seconds.
* **Average Token Consumption**: ~12k input tokens + ~6k output tokens = $0.00 total monthly bill.

---

## 4. Pillar 3: Evaluation Frameworks (Online vs. Offline)

Pillar 3 provides the scientific grading harness that protects PandaPrep from prompt regressions, hallucination spikes, and formatting degradation.

```text
               ┌────────────────────────────────────────────────────────┐
               │         PANDAPREP DUAL-LOOP EVALUATION SYSTEM          │
               └────────────────────────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────────────┐
│ OFFLINE CI/CD REGRESSION GATE        │  │ ONLINE LIVE PRODUCTION AUDITING      │
│ • Runs in GitHub Actions before merge│  │ • Verifier audits 100% of live notes │
│ • 20 Diverse Golden Syllabi          │  │ • Logs 6 contract scores in Mongo    │
│ • Blocks PR if Quality Score < 95%   │  │ • Feeds edge cases to Golden Dataset │
└──────────────────────────────────────┘  └──────────────────────────────────────┘
```

### 4.1 Offline Pre-Deployment CI/CD Regression Gate
Every pull request altering `writer.agent.ts`, `planner.agent.ts`, or system prompts executes an automated GitHub Actions test suite against a **Golden Benchmark Dataset of 20 Diverse Syllabi**:
1. *Computer Science*: Advanced Graph Algorithms & Dynamic Programming.
2. *Organic Chemistry*: Reaction Mechanisms & Aromatic Substitution.
3. *Thermodynamics*: Entropy, Enthalpy & Carnot Heat Engines.
4. *Constitutional Law*: Fundamental Rights & Judicial Precedents.
5. *Medical Physiology*: Cardiac Electrophysiology & Renal Clearance.

**CI/CD Rule**: If the aggregate score drops by $> 2\%$ compared to `main`, the build fails and blocks the PR from merging.

### 4.2 Online Continuous Production Auditing
In production, the **Verifier Agent** acts as an automatic, real-time judge on 100% of live student notes, evaluating:
1. *Coverage*: Are all syllabus requirements addressed?
2. *Missing Topics*: Are zero checklist items left pending?
3. *Grounding*: Are facts supported by reference citations?
4. *Terminology*: Are definitions consistent across sections?
5. *Cross-References*: Do markdown section anchors resolve?
6. *LaTeX Syntax*: Are math delimiters balanced?

### 4.3 Core Evaluation Dimensions & Scoring Rubrics

| Dimension | Measurement Method | Target Threshold |
|---|---|---|
| **1. Completeness (Recall)** | Programmatic set check against `coverage_checklist` | **100%** |
| **2. Faithfulness (Groundedness)** | Ragas / LLM Judge checking claims against retrieved PDF chunks | **>= 0.92** |
| **3. Coherence** | Semantic audit checking for definition contradictions | **>= 0.95** |
| **4. LaTeX / Syntax Integrity** | Deterministic balanced-stack linter (`checkLatexSyntax`) | **100% (0 errors)** |

---

## 5. LLM-as-a-Judge: Methodology, Bias Mitigation & Calibration

Using an LLM to evaluate another LLM requires rigorous engineering to prevent hallucinated grades, subjective variance, and systemic biases.

### 5.1 The Self-Grading Bias Problem & Context Decoupling
* **The Problem**: If the exact same prompt context or persona that wrote the notes also evaluates them, it suffers from self-grading confirmation bias (it rarely marks its own output as incorrect).
* **PandaPrep Solution**: We strictly decouple the generation role from the judge role:
  * **Role Isolation**: The Verifier and CI/CD Judge operate with a zero-temperature (`temperature = 0.0`), strict adversarial auditor prompt and isolated context window, completely independent of the creative writer prompt.
  * **Unified Free Model**: Powered by **DeepSeek V4 Flash Free** via **OpenCode Zen** ([https://opencode.ai/docs/](https://opencode.ai/docs/)).

### 5.2 Anchored Rubrics vs. Open-Ended Scoring
We never ask an LLM judge: *"Is this good? Rate 1 to 5."* Open-ended prompts suffer from massive score variance.  
Instead, we use **Few-Shot Anchored Rubrics** with discrete behavioral definitions:

```text
[Score 5 - Exemplary]:
- Covers 100% of assigned key concepts.
- Reuses exact definitions from prerequisite sections.
- All mathematical equations formatted in valid LaTeX ($...$ / $$...$$).
- Zero unsupported factual claims.

[Score 3 - Marginal / Requires Repair]:
- Covers primary concept but omits a required edge case (e.g. explains Single Rotations, omits Double Rotations).
- LaTeX syntax is valid, but an anchor link is broken.
- Triggers targeted repair with actionable feedback.

[Score 1 - Critical Failure]:
- Hallucinates concepts not present in syllabus.
- Contradicts earlier defined terms.
- Broken math delimiters crashing frontend renderers.
```

### 5.3 Programmatic Pre-Filters vs. LLM Judges
**Rule: Never use an expensive LLM call for something deterministic code can verify.**
Before invoking the DeepSeek Verifier:
1. `checkLatexSyntax()` runs a balanced-stack algorithm in TypeScript to verify matching `$` and `$$` delimiters.
2. An exact array search checks whether all `mapped_section_id` values exist.
3. Only if code pre-checks pass is the LLM judge invoked for semantic grounding and completeness.

### 5.4 Mitigating Position, Length & Verbosity Biases
* **Verbosity Bias**: LLMs naturally assign higher scores to longer answers. We normalize scores by checking **Information Density** (concise, clear explanations score higher than repetitive filler).
* **Position Bias**: When evaluating multi-section coherence, the judge evaluates section pairs in forward and reverse order to ensure Section 1 isn't favored over Section 10.

---

## 6. Human-in-the-Loop (HITL) & The Active Learning Flywheel

While the live generation loop is 100% autonomous (no human delay before a student gets notes), human intelligence is integrated systematically into the **Quality Flywheel**.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        THE ACTIVE LEARNING QUALITY FLYWHEEL                            │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
[Production Traffic] ──► [Verifier Catches Complex Failure (Repair Loop Exhausted)]
                                    │
                                    ▼
                      [Logged to MongoDB `flagged_runs`]
                                    │
                                    ▼
                      [Human Subject Matter Expert Review]
                                    │
                                    ▼
                      [Curation into Offline Golden Dataset]
                                    │
                                    ▼
                      [Prompt / Code Enhanced in CI/CD]
                                    │
                                    ▼
                      [System Permanently Immune to that Edge Case!]
```

### 6.1 Implicit vs. Explicit Human Feedback Signals
We collect continuous student signals without forcing intrusive popups:
* **Explicit Feedback**: Star rating and optional feedback modal on the reader interface.
* **Implicit Signals**:
  * *PDF Download Rate*: Did the student click `window.print()`? (High satisfaction signal).
  * *Markdown Copy Rate*: Did the student copy sections to Notion/Anki?
  * *Q&A Interaction*: Did the student ask clarifying questions indicating missing content in Section 4?

### 6.2 Human Triage for Disputed Edge Cases
Missions where `outstanding_gaps.length > 0` (repair bounds reached) or where user feedback is $< 3$ stars are automatically flagged in MongoDB. A weekly engineering review inspects the Langfuse flamegraph and checkpoint history to identify:
1. Was the Verifier too strict? $\rightarrow$ Tune Verifier rubric.
2. Did the Writer fail to explain a niche concept? $\rightarrow$ Update Writer prompt with few-shot guidance.

---

## 7. Real-World Incident Walkthrough (60-Second Root Cause Analysis)

### Scenario: A student reports *"My Operating Systems notes missed Banker's Algorithm."*

Here is how our 3-Pillar Observability isolates the exact bug in 60 seconds:

```text
Step 1 (Find the Request):
Search `X-Correlation-ID: "9b1deb4d..."` in Log Viewer.
└── Worker claimed job at 14:02:10 UTC, finished in 32s.

Step 2 (Check Checkpoint 2 - Planner Node in MongoDB):
Inspect `agent_checkpoints.state.topicGraph.nodes`:
└── Topic Graph Node: `sec_04: Deadlock Avoidance & Banker's Algorithm` WAS PLANNED.
└── Checklist item `chk_07: Banker's Algorithm Safety State` WAS CREATED.
(Conclusion: Planner worked perfectly!).

Step 3 (Check Checkpoint 3 - Writer Node in MongoDB):
Inspect `agent_checkpoints.state.generatedSections.sec_04`:
└── Writer drafted section on Deadlock Avoidance, but only wrote 1 sentence on Banker's Algorithm.

Step 4 (Check Checkpoint 4 - Verifier Node in MongoDB):
Inspect `agent_checkpoints.state.verificationResults`:
└── Verifier correctly caught the omission!
└── Flagged: `chk_07 status: pending, issue: missing Banker's Algorithm allocation matrices`.
└── Repair feedback emitted: "Add full resource allocation table and safety state algorithm."

Step 5 (Check Checkpoint 5 - Repair Node):
Inspect `agent_checkpoints.state.repairIterations`:
└── Provider returned a 429 rate limit during the repair pass, falling back to base section.
└── Recorded in `outstanding_gaps`.

Root Cause Identified in 45 seconds:
Temporary provider rate limit during repair iteration 1.
Action Taken: Added exponential backoff jitter to repair worker.
```

---

## 8. Interview Defense Cheat Sheet

| Question | Core Architectural Answer |
|---|---|
| **"How do you trace distributed agent runs?"** | Unified UUID `X-Correlation-ID` threaded across Express API, MongoDB queue, Pino logs, and Langfuse span telemetry. |
| **"How do you debug AI reasoning failures?"** | MongoDB `agent_checkpoints` stores an immutable snapshot of working memory at every node transition, enabling time-travel debugging. |
| **"How do you prevent prompt regressions?"** | GitHub Actions CI/CD gate evaluates prompt changes against 20 diverse Golden Syllabi using Ragas/LLM-as-a-Judge, blocking merges if scores drop $> 2\%$. |
| **"How do you avoid self-grading bias in evals?"** | Strict prompt and persona isolation with anchored 1–5 rubrics and deterministic TypeScript pre-linters. |
| **"Where does human feedback fit into autonomous generation?"** | Active learning flywheel: production edge cases and user ratings feed directly back into curating and expanding the Golden Benchmark Dataset. |
| **"What observability tool did you choose and why?"** | **Langfuse**: Open-source (Apache 2.0), 50k free traces/mo, automatic token cost tracking for OpenCode Zen models, and native LangGraph.js callback integration. |
