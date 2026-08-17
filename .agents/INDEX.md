# PandaPrep Agent Documentation Index

Welcome to the **PandaPrep Redesign Context & Implementation Knowledge Base**. This directory (`.agents/`) contains the architectural blueprints, interface contracts, legacy audits, agent specifications, and infrastructure designs for transitioning PandaPrep from a rigid linear pipeline to a robust **Bounded Agentic System**.

---

## 📌 Quick Task-to-File Map

Use this directory to load minimal, token-efficient context tailored to the specific component you are implementing or modifying:

| When You Are Working On... | Read This File | Summary |
|---|---|---|
| **API routes, request schemas, status polling, frontend Markdown integration** | [`01-contracts-and-interfaces.md`](./01-contracts-and-interfaces.md) | Frontend-Backend API contract (`POST /generate-notes`, `GET /generation-status/:requestId`), direct Markdown payload delivery, `<MarkdownViewer />` panel, and `window.print()` PDF export. |
| **Understanding past bugs, crashes, bottlenecks, or why the legacy queue failed** | [`02-legacy-architecture-and-failures.md`](./02-legacy-architecture-and-failures.md) | As-implemented monolithic pipeline review, Root Causes (RC-1 to RC-4), microservice bottlenecks, and lessons learned from the exam season crash. |
| **High-level agentic flow, state machine, and system boundaries** | [`03-target-agentic-architecture.md`](./03-target-agentic-architecture.md) | Bounded agentic workflow, state machine (Intake → Plan → Generate → Verify & Repair → Finalize Markdown), and the strict deterministic vs. agentic boundary. |
| **Shared working memory, MongoDB schema, topic graphs, terms/anchors tracking** | [`04-notes-workspace-schema.md`](./04-notes-workspace-schema.md) | Concrete schema for the `notes_workspaces` collection (topic graph, coverage checklist, terms defined, cross-references, final markdown, style decisions, outstanding gaps). |
| **Prompt templates, Planner, Writer, Verifier, Repair Loop, or Q&A Agent** | [`05-agent-specifications.md`](./05-agent-specifications.md) | Exact responsibilities, input/output JSON schemas, contract checks, prompt constraints, and repair bounding rules for each agent. |
| **Tools (Vector search, MongoDB storage, Email) & Mongo Queue** | [`06-tool-registry-and-infra.md`](./06-tool-registry-and-infra.md) | In-process Tool Registry, pure Markdown storage in MongoDB, Mongo-backed atomic queue claim (`findOneAndUpdate`), heartbeat sweeper, and checkpointing. |
| **Implementation phases, step-by-step roadmap, observability, testing** | [`07-implementation-and-migration-roadmap.md`](./07-implementation-and-migration-roadmap.md) | 5-phase migration roadmap, Markdown viewer UI rollout, cost/latency controls, structured logging, correlation IDs, and testing matrix. |
| **Observability, Langfuse telemetry, health metrics, and CI/CD evals** | [`08-agentic-observability-and-evals.md`](./08-agentic-observability-and-evals.md) | Implementation specs for Langfuse tracing, real-time MongoDB metrics endpoints, Golden Dataset evals, and DeepSeek V4 Flash Free migration. |

---

## 🧠 Core System Invariants (Must Never Violate)

1. **Markdown-First Delivery**: Notes are stored directly as lightweight Markdown text (~18 KB) in MongoDB. The frontend renders them interactively in a Claude-style panel (`react-markdown` + `rehype-katex`), and users download PDFs via client-side `window.print()`, eliminating the server-side PDF microservice completely.
2. **TypeScript for Backend**: The new agentic backend (`src/agentic/`) must be written in **TypeScript** for strict compile-time typing of the Notes Workspace schema, LangGraph state channels, and tool definitions.
3. **Scoped Frontend Updates**: Frontend modifications are strictly scoped to the reading experience: replacing the static PDF iframe in `generate/page.tsx` with `<MarkdownViewer />` and wiring the "Download" button to `window.print()`.
4. **Side-by-Side Coexistence**: The new agentic backend must be implemented cleanly alongside the legacy pipeline (via modular services/routes), allowing safe verification before decommissioning legacy code.
5. **Bounded Autonomy (No Free-Running Loops)**: Loops are hard-capped (e.g., max 2 repair iterations per section, 1 document-level pass, max 3–4 Q&A tool steps). Prompts are strictly scoped using workspace summaries rather than raw context dumps.
6. **Deterministic Infrastructure Stays Deterministic**: Authentication (Firebase), Payments (Razorpay), Notes Storage (MongoDB), and Email (Brevo) remain plain deterministic code—never wrapped in autonomous agent loops.
7. **No Redis / No BullMQ**: Job claiming and run checkpoints are managed natively within MongoDB Atlas using atomic operations (`findOneAndUpdate`), worker heartbeats, and checkpoint collections.

---

## 📂 File Structure Overview

```text
.agents/
├── INDEX.md                                # Master documentation map (This file)
├── 01-contracts-and-interfaces.md          # Input/output schemas, polling endpoints, Markdown reader UI
├── 02-legacy-architecture-and-failures.md  # Legacy pipeline breakdown & audit failure modes
├── 03-target-agentic-architecture.md       # Target bounded agentic workflow & state machine
├── 04-notes-workspace-schema.md            # Working memory schema (notes_workspaces collection)
├── 05-agent-specifications.md              # Planner, Writer, Verifier, and Q&A Agent specs & prompts
├── 06-tool-registry-and-infra.md           # Tool registry, Markdown storage, Mongo queue & checkpointer
├── 07-implementation-and-migration-roadmap.md # Step-by-step rollout, observability & testing
└── 08-agentic-observability-and-evals.md   # Observability, Langfuse telemetry, metrics & evals guide
```
