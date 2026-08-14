# 03 — Target Agentic Architecture

## 1. Architectural Philosophy: Bounded Agentic Workflow

PandaPrep requires high-quality, structured, syllabus-grounded revision notes.
A fully autonomous, unconstrained agent (one open-ended loop deciding its own steps without bounds) is **strictly rejected**:
- It introduces unpredictable latency and token costs.
- It degrades deterministic structure (headings, table of contents, LaTeX styling).
- It risks context pollution by dumping the entire syllabus history into one ever-expanding prompt.

Instead, PandaPrep implements a **Bounded Agentic Workflow** over **Deterministic Infrastructure**:
- **Agentic** where intelligence, contextual memory, dynamic tool selection, and verification are required (Planning, Section Drafting, Contract Verification, Targeted Repair, Interactive Q&A).
- **Deterministic** where operations have a single standard path (Auth, Payments, Storage, Email, Job Claiming).

### Core Tech Stack
- **Language**: **TypeScript** (for all new agent runtime code in `src/agentic/`)
- **Agent Framework**: **LangGraph.js** (`@langchain/langgraph`) & **LangChain** (`@langchain/core`)
- **LLMs**: Groq `llama-3.3-70b-versatile` (Writers/Planner) & Google `gemini-3.7-flash` (Intake/Verifier/Q&A)
- **Embeddings**: Google `gemini-embedding-2`
- **Database & Vector Store**: MongoDB Atlas (Atomic queue, Notes Workspace, LangGraph checkpoints, Atlas Vector Search)
- **Frontend**: Next.js, React, `react-markdown`, `rehype-katex`

---

## 2. High-Level Architecture & End-to-End Flow

```
Student (Frontend)
   │  syllabus + preferences (existing form, unchanged)
   ▼
API Layer (Stateless, 2+ instances)
   │  validates request, creates mission, returns HTTP 202
   ▼
MongoDB Atlas
   ├── `missions` (atomic queue & status tracking)
   ├── `notes_workspaces` (shared working memory per mission)
   ├── `agent_checkpoints` (node-by-node runtime recovery)
   └── Atlas Vector Search (embeddings for reference material)
   ▲
   │ atomic claim & state sync
   ▼
Worker (LangGraph.js State Graph Runtime)
   │
   ├─► 1. Intake Resolution: Interprets free-text instructions
   │
   ├─► 2. Planner Agent: Parses syllabus ──► Produces Topic Graph & Coverage Checklist
   │        │ (calls `search_web` only if syllabus line is sparse)
   │        ▼
   ├─► 3. Writer Agents: Drafts sections concurrently (bounded by rate limits)
   │        ├── Reads: Scoped workspace slice (dependencies, terms, style)
   │        ├── Calls: `retrieve_reference` (Atlas Vector Search)
   │        └── Writes: `generated_sections`, `terms_defined`, `cross_reference_anchors`
   │        ▼
   ├─► 4. Verifier Agent: Automated contract check (coverage, citations, terminology)
   │        ├── [Pass] ──► Proceed to Finalize
   │        └── [Fail] ──► Targeted feedback ──► Writer Repair Pass (Max 2 iterations)
   │                       (Unresolved items logged in `outstanding_gaps`)
   │        ▼
   └─► 5. Finalize (Deterministic):
            ├── Assemble Table of Contents & format LaTeX equations
            ├── Persist completed Markdown in `notes_workspaces` and `NotesRequestModel`
            ├── `notify` (Brevo email with notes ready notification)
            └── Deliver Markdown directly to frontend `<MarkdownViewer />`
```

---

## 3. The Deterministic vs. Agentic Boundary

To guarantee reliability and prevent cost blowouts, boundaries are strictly enforced:

| Capability | Execution Model | Rationale |
|---|---|---|
| **Syllabus Decomposition** | **Agentic (Planner)** | Syllabus lines have nuanced semantic dependencies; requires topic graph construction. |
| **Section Generation** | **Agentic (Writer)** | Must synthesize reference material while adhering to workspace terms and styles. |
| **Contract Verification** | **Agentic (Verifier)** | Requires semantic comparison between syllabus requirements, citations, and draft. |
| **Section Repair** | **Agentic (Writer)** | Uses verifier feedback to address specific omissions or inconsistencies. |
| **Post-Delivery Q&A** | **Agentic (Q&A)** | Decides dynamically between notes search, reference search, quizzing, or explanation. |
| **Authentication & AuthZ** | **Deterministic** | Standard Firebase JWT token validation. |
| **Payment & Billing** | **Deterministic** | Standard Razorpay webhooks & balance updates. |
| **Job Queue & Recovery** | **Deterministic** | Atomic MongoDB state transitions (`findOneAndUpdate`) and heartbeats. |
| **Markdown Finalization** | **Deterministic** | Assembles TOC, validates LaTeX blocks, saves text to MongoDB. |
| **Notes Storage** | **Deterministic** | Stored directly in MongoDB (~18 KB text; $0 cost; 50x lighter than PDF). |
| **PDF Export** | **Client-Side** | Handled natively by student's browser (`window.print()` / `@media print` CSS). |
| **Transactional Email** | **Deterministic** | Direct Brevo SMTP/API dispatch. |

---

## 4. Cost and Latency Guardrails

Every agentic step operates under strict constraints:
1. **Bounded Repair Loops**: Maximum 2 repair iterations per section, plus 1 document-level pass. If a gap remains unresolved, it is recorded in `outstanding_gaps` and delivered visibly rather than looping indefinitely.
2. **Model Tier Allocation**:
   - Complex generation (Writers, Planner): High-capability LLMs (Groq `llama-3.3-70b-versatile` / Google `gemini-3.7-flash`).
   - Structured checks (Intake, Verifier): Google `gemini-3.7-flash` (or fast tier).
3. **Scoped Prompts (No Context Dumps)**: Writers are provided only a scoped summary of their dependencies, required terms, and style rules—never the full raw workspace or entire syllabus transcript.
4. **Adaptive Web Search**: `search_web` is triggered strictly when a syllabus line is sparse (e.g. "Unit 3: Trees") or when a Q&A question falls outside reference material.
5. **No WebSocket Theater**: Generation progress is tracked via clean database polling (`GET /api/pipeline/generation-status/:requestId`) and email notification, eliminating complex connection state.
