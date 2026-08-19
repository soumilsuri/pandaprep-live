# PandaPrep — Agentic Architecture Redesign (Final)

**Builds on**: `architecture.md` (as implemented), `audit.md`, `redesign.md` (scale and reliability redesign)  
**Implementation**: TypeScript backend (`backend-agentic`), LangGraph.js, MongoDB Atlas, and **DeepSeek V4 Flash Free** (`deepseek-v4-flash-free`) via **OpenCode Zen** ([https://opencode.ai/docs/](https://opencode.ai/docs/)).  
**Key Evolution**: Pure **Markdown-First** architecture with client-side PDF export (`window.print()`). The external `md-to-pdf` microservice and Cloudinary PDF storage are completely eliminated in favor of direct, ultra-lightweight Markdown text storage in MongoDB.

---

## 1. TL;DR

PandaPrep's legacy pipeline was a fixed sequence of prompt calls named `*Agent`. Nothing in it planned, remembered what it already wrote, verified its own output, or recovered from server restarts. It was a brittle linear chain coupled to an in-memory queue and an external PDF rendering microservice.

This redesign replaces the generation core with a **bounded agentic workflow** built with **LangGraph.js** in **TypeScript**:

1. A **Planner Agent** turns the syllabus into a **topic graph** (DAG) and an explicit **coverage checklist**.
2. **Writer Agents** draft sections against a **persistent Notes Workspace** (shared state in MongoDB Atlas), building on prior definitions and anchors so sections are never generated in isolation.
3. A **Verifier Agent** validates the draft against the coverage checklist and a strict 6-point contract, triggering a **bounded repair loop** (max 2 iterations per section).
4. A tool-using **Q&A Agent** allows students to interrogate their completed notes post-delivery (`search_notes`, `search_reference`, `quiz_me`, `explain_more`, `search_web`).
5. **Markdown-First & In-Browser PDF**: Notes are delivered and stored as pure Markdown (~18 KB) in MongoDB. The Next.js frontend renders them in a Claude-style interactive panel (`react-markdown` + `rehype-katex`), and students download vector PDFs via native browser `window.print()`. The heavy server-side `md-to-pdf` microservice and Cloudinary PDF storage are completely removed.
6. Everything with a single deterministic path—authentication (Firebase), payments (Razorpay), database storage (MongoDB Atlas), job claiming, and email delivery (Brevo)—remains plain deterministic infrastructure.

---

## 2. Problem Restated

Two pain points drove PandaPrep from its inception:

1. **Tedious entry**: Revision previously meant pasting one topic at a time into ChatGPT.
2. **Context loss**: As conversations grew, ChatGPT lost track of how earlier topics connected to later ones, producing fragmented notes with repetitive or contradictory definitions.

The original linear pipeline solved problem one (a single form submission replaced topic-by-topic entry) but failed to solve problem two. It grouped topics once up-front and trusted the grouping blindly. Nothing tracked defined terminology, nothing linked sections together, and nothing verified syllabus coverage prior to delivery.

---

## 3. Why the Legacy System Was Automation, Not Agentic

Examining the legacy `*Agent` classes reveals a pure linear script:

- `SyllabusAnalyzerAgent` made one prompt call, parsed JSON, and retried the exact same call on parse failure. It could not adapt to sparse lines like "Unit 3: Trees" and never validated its own plan.
- `NotesGeneratorAgent` retrieved a fixed top 3 chunks per section, generated content in isolation, and never checked what earlier sections had established.
- `ChatWithNotesAgent` performed a single vector retrieval and one generation per message, unable to seek additional context.

None of these components chose actions based on observation or maintained shared state. Furthermore, the infrastructure relied on an in-memory queue (`MAX_CONCURRENT_JOBS = 1`), local disk vector stores, and an external `md-to-pdf` microservice that took down the entire request if it glitched.

---

## 4. Why an Agentic Workflow is Justified

The core product failure—coherence breaking down across a multi-section syllabus—is fundamentally a state management and verification challenge:

- **Working memory**: Coherent notes require remembering defined terms, cross-reference anchors, and established depth/style across sections. A persistent Notes Workspace in MongoDB Atlas provides this.
- **Planning as a checkable artifact**: Decomposing a syllabus into a topic graph DAG and a coverage checklist turns generation into an auditable plan execution.
- **Self-correction**: An automated verifier inspecting checklist coverage, terminology consistency, grounding citations, and LaTeX syntax transforms a raw first draft into a verified revision guide.
- **Adaptive tool use**: Dynamic retrieval decisions (widening queries, falling back gracefully, or triggering targeted web search) ensure high quality even with sparse syllabi.

---

## 5. Why a Fully Autonomous Agent is Rejected

A free-running, unconstrained autonomous agent (one open-ended loop generating the whole syllabus without bounds) is explicitly rejected:

- **Latency and cost**: Open-ended loops multiply LLM calls unpredictably.
- **Loss of structure**: Study notes require deterministic formatting (headings, TOC, LaTeX math blocks).
- **Recreating the founding problem**: Dumping an entire syllabus into one expanding context window recreates the exact context pollution PandaPrep was built to avoid.
- **Rate limit safety**: Hard caps on concurrency and loops prevent API throttling.

**Verdict**: Bounded autonomy over deterministic infrastructure.

---

## 6. Design Principles

1. **Bounded autonomy**: Strict iteration caps on every loop (max 2 section repairs, 1 document-level pass, max 3–4 Q&A tool steps).
2. **State is a concrete MongoDB artifact**: The Notes Workspace has a typed schema (`notes_workspaces` collection), not a vague memory abstraction.
3. **The plan is testable**: The Planner outputs an explicit `coverage_checklist` that the Verifier tests against.
4. **Markdown-First delivery**: Store lightweight Markdown (~18 KB) in MongoDB. Offload PDF compilation to the client's browser (`window.print()`).
5. **Deterministic stays deterministic**: Auth (Firebase), payments (Razorpay), storage (MongoDB), and email (Brevo) stay plain deterministic code.
6. **No polling or connection overhead**: Clean HTTP status polling against MongoDB (`GET /api/pipeline/generation-status/:requestId`) replaces fragile WebSocket connection maps.
7. **Scoped prompts**: Writers receive a scoped workspace slice (prerequisite terms, anchors, style rules)—never raw full-document context dumps.

---

## 7. High-Level Architecture

```text
Student (Frontend)
   │  syllabus + preferences (existing form)
   ▼
API Layer (Stateless Express in TypeScript, 2+ instances)
   │  validates request, creates mission, returns HTTP 202
   ▼
MongoDB Atlas
   ├── `missions` (atomic queue & status tracking)
   ├── `notes_workspaces` (shared working memory & final markdown)
   ├── `agent_checkpoints` (LangGraph node-by-node runtime recovery)
   ├── `chat_histories` (persisted multi-turn Q&A context)
   └── Atlas Vector Search (document embeddings)
   ▲
   │ atomic claim & state sync
   ▼
Worker (LangGraph.js StateGraph Runtime in TypeScript)
   │
   ├─► 1. Intake Resolution: Interprets user_instructions (DeepSeek V4 Flash Free)
   │
   ├─► 2. Planner Agent: Parses syllabus ──► Produces Topic Graph & Coverage Checklist
   │        │ (calls `search_web` only if syllabus line is sparse)
   │        ▼
   ├─► 3. Writer Agents: Drafts sections concurrently (DeepSeek V4 Flash Free)
   │        ├── Reads: Scoped workspace slice (dependencies, terms, style)
   │        ├── Calls: `retrieve_reference` (Atlas Vector Search)
   │        └── Writes: `generated_sections`, `terms_defined`, `cross_reference_anchors`
   │        ▼
   ├─► 4. Verifier Agent: 6 automated contract checks (DeepSeek V4 Flash Free)
   │        ├── [Pass] ──► Proceed to Finalize
   │        └── [Fail] ──► Targeted feedback ──► Writer Repair Pass (Max 2 iterations)
   │                       (Unresolved items logged in `outstanding_gaps`)
   │        ▼
   └─► 5. Finalize (Deterministic):
            ├── Assemble Table of Contents & format LaTeX equations
            ├── Persist completed Markdown in `notes_workspaces` and `NotesRequestModel`
            ├── `notify` (Brevo email with notes ready status)
            └── Deliver Markdown payload to frontend `<MarkdownViewer />`
```

---

## 8. The Notes Workspace Schema (`notes_workspaces`)

The Notes Workspace is a single typed MongoDB document per mission acting as the shared working memory across agents:

| Field | Type | Purpose |
|---|---|---|
| `mission_id` | `string` | Unique UUID v4 for the generation mission (indexed). |
| `user_id` | `ObjectId` | Reference to the user requesting the notes. |
| `syllabus_topics` | `string[]` | Unmodified parsed syllabus requirements (ground truth). |
| `topic_graph` | `object` | Nodes (sections, key concepts) and edges (prerequisite dependencies). |
| `coverage_checklist`| `array` | Requirements mapped to sections with status (`pending`, `drafted`, `verified`). |
| `generated_sections`| `map` | Drafted markdown content, word count, and status per section ID. |
| `final_markdown` | `string` | Fully assembled, TOC-linked, LaTeX-formatted markdown document (~18 KB). |
| `terms_defined` | `array` | Registry of key terms, definitions, and the section that introduced them. |
| `cross_reference_anchors` | `array` | Markdown anchors for cross-section referencing (`#sec-01-bst`). |
| `style_decisions` | `object` | Global tone, depth, and LaTeX formatting rules. |
| `sources_used` | `map` | Reference chunk IDs and web search queries used per section. |
| `verification_results`| `array` | Audit trail of Verifier findings, pass/fail status, and targeted repair feedback. |
| `outstanding_gaps` | `array` | Unresolved gaps recorded and shipped visibly if repair bounds are reached. |

### Scoped Workspace Reads (`getScopedWorkspaceSlice`)
Writers do not receive the entire workspace document. An internal helper filters the workspace down to only prerequisite definitions, style rules, and available anchors relevant to that specific section, keeping prompts compact and token-efficient.

---

## 9. In-Process Tool Registry

All tools are implemented as strongly typed TypeScript functions in `backend-agentic/src/tools/`:

| Tool | Invocation Trigger | Underlying Implementation |
|---|---|---|
| `retrieve_reference` | Writer needs source material | Atlas Vector Search over document embeddings. |
| `retrieve_workspace` | Writer / Q&A queries facts | Direct typed query against MongoDB `notes_workspaces` collection. |
| `search_web` | Sparse syllabus line OR out-of-scope Q&A | Tavily AI Search API. |
| `finalize_markdown` | Finalize step after verification | Assembles TOC, validates math blocks, and saves final text to MongoDB. |
| `notify` | Notes generated and saved | Brevo Transactional Email API. |

*(Note: The external `md-to-pdf` microservice and Cloudinary PDF upload tools have been completely eliminated).*

---

## 10. Deterministic Infrastructure Boundary

| Agentic (Decides based on state) | Deterministic (Fixed sequence, always) |
|---|---|
| Syllabus decomposition (Planner DAG) | Authentication (Firebase Admin JWT verification) |
| Adaptive retrieval & grounding | Payments & Billing (Razorpay webhooks) |
| Section drafting with workspace memory | Queueing & atomic job claiming (`findOneAndUpdate`) |
| Contract verification & repair loop | Markdown storage in MongoDB Atlas (~18 KB text) |
| Interactive Q&A tool selection | Client-side PDF export (`window.print()` / `@media print` CSS) |
| | Transactional Email dispatch (Brevo API) |
| | User history & profile CRUD |

---

## 11. MongoDB Atlas Queue & LangGraph Checkpointer

Both job queueing and runtime checkpointing are handled natively in MongoDB Atlas, eliminating Redis and BullMQ:

- **Atomic Queue Claims**: Workers claim pending jobs atomically using `findOneAndUpdate({ status: 'queued', next_attempt_at: { $lte: now } }, { $set: { status: 'processing', worker_id, last_seen_at } })`.
- **Stalled Worker Recovery**: Workers heartbeat every 10s. A background sweeper requeues missions whose `last_seen_at` exceeds 60s with exponential backoff.
- **LangGraph Checkpointing**: LangGraph persists state after every node transition in the `agent_checkpoints` collection. If a worker reboots mid-job, it resumes from the last completed node.
- **Rate Limiting**: Sized for abuse deterrence via atomic windowed counters in the `rate_limits` collection.

---

## 12. Detailed Agent Workflow

### 12.1 Intake Resolution
Lightweight step interpreting free-text `user_instructions` using **DeepSeek V4 Flash Free** via **OpenCode Zen** ([https://opencode.ai/docs/](https://opencode.ai/docs/)) to set explicit style and depth parameters before planning begins.

### 12.2 Planner Agent
- Breaks syllabus into a DAG `topic_graph` with prerequisite relationships.
- Generates the testable `coverage_checklist`.
- Invokes `search_web` only if a syllabus line is sparse (e.g., "Unit 3: Trees").

### 12.3 Writer Agents
- Independent sections generate concurrently (bounded by rate limit pool); dependent sections generate in topological order.
- Generates content with LaTeX math (`$...$`, `$$...$$`).
- Registers newly introduced terms into `terms_defined` and anchors into `cross_reference_anchors`.

### 12.4 Verifier Agent & Bounded Repair Loop
Runs 6 automated contract checks:
1. **Coverage**: Every syllabus requirement mapped and addressed.
2. **Missing Topics**: Zero pending items.
3. **Grounding**: Factual claims traceable to `sources_used`.
4. **Terminology**: No conflicting definitions across sections.
5. **Cross-References**: Referenced anchors exist in the registry.
6. **Syntax**: Properly formatted Markdown and closed LaTeX blocks.

*Repair Bound*: Maximum **2 repair iterations** per section + **1 document pass**. Unresolved items are logged in `outstanding_gaps` and delivered visibly.

### 12.5 Finalization & Delivery
- Table of Contents assembly and final LaTeX validation.
- Markdown persisted directly to MongoDB (`notes_workspaces` and `NotesRequestModel.markdown_content`).
- Brevo email dispatched.
- Frontend status poll receives the Markdown payload and renders it in `<MarkdownViewer />`.

---

## 13. Cost and Latency Controls

- **Bounded Repair**: Hard cap of 2 repair iterations per section.
- **Unified High-Efficiency MoE Model**: **DeepSeek V4 Flash Free** via OpenCode Zen ([https://opencode.ai/docs/](https://opencode.ai/docs/)) provides 1M context, high MoE throughput, and generous free rate limits.
- **Scoped Summaries**: Prompts receive compact workspace slices rather than full-document dumps.
- **Zero PDF Latency**: Direct Markdown delivery saves 25–40 seconds per request.
- **Search as Exception**: `search_web` runs only on sparse lines or out-of-scope Q&A.

---

## 14. Interactive Q&A Agent

Post-delivery revision assistant tool suite:
- `search_notes`: Vector / keyword search over student's generated workspace.
- `search_reference`: Vector search over uploaded reference material in Atlas Vector Search.
- `quiz_me`: Generates practice questions and evaluates answers for active recall.
- `explain_more`: Expands concepts with stepped explanations.
- `search_web`: Bounded external search (explicitly labeled if outside syllabus).
- Multi-turn chat history persisted in MongoDB `chat_histories` collection.

---

## 15. Failure Handling & Resilience

- **Worker Crash**: Resumes from last LangGraph checkpoint in MongoDB Atlas.
- **Stale Claims**: Automatically reclaimed and re-queued by background sweeper.
- **Zero Rendering Outages**: Removing server-side PDF microservices eliminates rendering timeouts and headless browser crashes entirely.
- **Unresolved Repair Gaps**: Shipped visibly in `outstanding_gaps` rather than stalling.

---

## 16. Observability & Telemetry

- **Correlation IDs**: `requestId` (UUID v4) threaded through every log, LLM invocation, and database update.
- **Structured JSON Logs**: Winston/Pino structured logging with ISO timestamps and pipeline execution stages.
- **Agent Run Tracing**: Node transitions, tool calls, and verifier audits persisted in MongoDB with Langfuse telemetry integration.
- **Operational Health Metrics**: Real-time aggregation of active missions, P95 generation latency, repair loop rates, and token consumption via `/api/admin/metrics/health`.

---

## 17. Evaluation Framework & Quality Benchmarks (Online vs. Offline Evals)

To guarantee academic rigor and prevent prompt or model regressions, PandaPrep implements a **Dual-Loop Evaluation System** combining real-time online verification with pre-deployment CI/CD regression gating.

```text
               ┌────────────────────────────────────────────────────────┐
               │         PANDAPREP DUAL-LOOP EVALUATION SYSTEM          │
               └────────────────────────────────────────────────────────┘
                                     │
            ┌────────────────────────┴────────────────────────┐
            ▼                                                 ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────────────┐
│ OFFLINE CI/CD REGRESSION GATE        │  │ ONLINE LIVE PRODUCTION AUDITING      │
│ • Runs via `npm run test:evals`      │  │ • Verifier audits 100% of live notes │
│ • 20 Diverse Golden Syllabi          │  │ • 6 contract checks in StateGraph    │
│ • Blocks PR if Q_aggregate < 95%     │  │ • Logs audits in `notes_workspaces`  │
│ • Fails on > 2% score regression     │  │ • Edge cases feed back into dataset  │
└──────────────────────────────────────┘  └──────────────────────────────────────┘
```

### 17.1 Core Evaluation Dimensions & Scoring Rubric

The evaluation engine (`backend-agentic/evals/scoring.ts`) computes scores on four orthogonal axes ($0.0 \le S \le 1.0$):

| Dimension | Metric | Measurement Method | Target Threshold |
|---|---|---|---|
| **Completeness** | $S_{comp}$ | Programmatic verification of `coverage_checklist` mapping, expected keyword presence, and zero unresolved gaps. | **$\ge 0.95$ (95%)** |
| **Faithfulness** | $S_{faith}$ | Grounding verification confirming claims trace back to retrieved source chunks (`sources_used`) with zero ungrounded assertions. | **$\ge 0.92$ (92%)** |
| **Coherence** | $S_{cohere}$ | Semantic consistency auditing unique term definitions (`terms_defined`) and bidirectional anchor resolution (`cross_reference_anchors`). | **$\ge 0.95$ (95%)** |
| **LaTeX & Syntax** | $S_{syntax}$ | Deterministic balanced-stack parser (`checkLatexSyntax`) validating `$`, `$$`, and `\begin{env}...\end{env}` blocks. | **$1.00$ (0 errors)** |

### 17.2 Composite Quality Score Formula ($Q_i$)

Every generated note receives a composite quality score calculated as:

$$Q_i = (0.35 \cdot S_{comp} + 0.25 \cdot S_{faith} + 0.20 \cdot S_{cohere} + 0.20 \cdot S_{syntax}) \times 100$$

For a benchmark suite of $N$ syllabi, the aggregate score is:

$$Q_{aggregate} = \frac{1}{N} \sum_{i=1}^{N} Q_i$$

### 17.3 Offline Golden Benchmark Suite (`backend-agentic/evals/`)

- **20 Curated Golden Syllabi** (`golden-syllabi.json`): Diverse corpus spanning STEM, Humanities, Law, Medicine, and Economics (e.g., *Dynamic Programming*, *Reaction Mechanisms*, *Carnot Heat Engines*, *Constitutional Law*, *Renal Physiology*).
- **Automated Test Harness** (`eval-runner.ts` / `npm run test:evals`): Executes the end-to-end StateGraph, calculates per-syllabus and aggregate metrics, and prints structured evaluation tables.
- **CI/CD Quality Gate**: Enforces $Q_{aggregate} \ge 95.0\%$ with a strict zero-regression rule (fails if aggregate score drops by $> 2\%$ versus `main`).

### 17.4 LLM-as-a-Judge Methodology & Bias Mitigation

- **Self-Grading Bias Mitigation**: The Verifier and offline judge operate under strict role isolation (zero-temperature $T=0.0$, adversarial auditor persona, isolated context window) decoupled from the creative Writer agent.
- **Anchored 1–5 Rubrics**: Scoring uses discrete behavioral definitions (e.g., Score 5 requires 100% coverage, prerequisite term reuse, valid LaTeX, and zero unsupported claims) rather than subjective Likert ratings.
- **Position & Length Bias Defenses**: Slices are evaluated in forward and reverse sequence, with length penalties normalized against syllabus density.

---

## 18. Security & Boundary Defenses

- Scoped CORS and default-deny authentication with Firebase Admin.
- Strict Zod/JSON-Schema validation on all agent structured outputs before updating workspace state.
- Delimited user inputs to defend against prompt injection.
- Reference material and web search results treated as untrusted input.

---

## 19. Phased Implementation Roadmap

1. **Phase 1: TypeScript Runtime & Mongo Queue** (`backend-agentic` setup, LangGraph.js, `MissionModel`, atomic claims, heartbeats).
2. **Phase 2: Planner, Notes Workspace & Writers** (`NotesWorkspaceModel`, DAG Planner, scoped Writer concurrency).
3. **Phase 3: Verifier & Bounded Repair** (6-point contract checker, targeted repair loops, `outstanding_gaps`).
4. **Phase 4: Tool Registry & Frontend Markdown Reader** (Tavily search, MongoDB markdown storage, Next.js `<MarkdownViewer />`, `window.print()` CSS).
5. **Phase 5: Interactive Q&A Agent** (Tool-using Q&A agent with persisted chat history in MongoDB).
6. **Phase 6: Observability, Telemetry & Automated Evals** (Langfuse tracing, `/api/admin/metrics`, 20 Golden Syllabi CI/CD evaluation runner via `npm run test:evals`).

---

## 20. Architectural Comparison

| Concern | Legacy Monolith | Intermediate Redesign (`redesign.md`) | Final Agentic Architecture (`backend-agentic`) |
|---|---|---|---|
| **Language & Engine** | JavaScript linear scripts | JavaScript linear scripts | **TypeScript + LangGraph.js StateGraph** |
| **Syllabus Analysis** | One-shot topic grouping | One-shot topic grouping | **Topic Graph DAG + Coverage Checklist** |
| **Section Generation** | Isolated sequential calls | Isolated parallel calls | **Shared Notes Workspace (Memory across sections)** |
| **Self-Correction** | None | None | **Verifier Agent + Bounded Repair Loop (max 2)** |
| **Quality Evaluation** | None (untested output) | Manual spot-checking | **Dual-Loop Evals: Online Verifier + 20 Golden Syllabi CI/CD ($Q \ge 95\%$)** |
| **PDF & Notes Output** | External Azure `md-to-pdf` microservice | External Azure `md-to-pdf` microservice | **Pure Markdown in MongoDB + Browser `window.print()`** |
| **Notes Storage** | Cloudinary (1–2 MB PDF per note) | Cloudinary (1–2 MB PDF per note) | **MongoDB Atlas (~18 KB Markdown text per note)** |
| **Queue & State** | In-memory JS array (`MAX_CONCURRENT_JOBS=1`)| BullMQ + Redis | **MongoDB Atlas Atomic Claim (`findOneAndUpdate`)** |
| **Step Recovery** | Full replay from scratch | Hand-rolled step checkpoints | **LangGraph Mongo Checkpoints (Node-by-node)** |
| **Vector Store** | Local disk FAISS (`temp/vectorstores/`) | Atlas Vector Search | **Atlas Vector Search (Document embeddings)** |
| **LLM Tiering** | Groq Llama 3.3 only | Groq Llama 3.3 only | **DeepSeek V4 Flash Free via OpenCode Zen** |
| **Infrastructure Count** | Monolith + Microservice + Disk | Monolith + Microservice + Redis | **Stateless TypeScript API/Worker + MongoDB Atlas ($0 infra)** |

---

## 21. Evolution & Architectural Decisions

### Key Decisions Accepted:
- **Markdown-First & Client-Side PDF (`window.print()`)**: Eliminates the heavy `md-to-pdf` microservice and Cloudinary PDF storage. Storing Markdown text in MongoDB is 50x lighter (~18 KB), eliminates 25s of rendering latency, and gives students a Claude-style interactive reader.
- **Concrete Notes Workspace Schema**: Structured state tracking `topic_graph`, `coverage_checklist`, `terms_defined`, `cross_reference_anchors`, and `final_markdown`.
- **LangGraph.js & TypeScript**: Native StateGraph execution with MongoDB checkpoint persistence.
- **Dual-Loop Evals & Quality Gates**: Online Verifier agent in the StateGraph plus 20-syllabi offline CI/CD regression suite (`npm run test:evals`) enforcing $Q_{aggregate} \ge 95.0\%$.
- **MongoDB Atlas for Queue, Checkpoints & Vector Search**: Single managed failure domain in Atlas with atomic operations.
- **DeepSeek V4 Flash Free via OpenCode Zen**: High-performance MoE model with 1M context, generous free quotas, and optimized agentic coding/reasoning capabilities ([https://opencode.ai/docs/](https://opencode.ai/docs/)).