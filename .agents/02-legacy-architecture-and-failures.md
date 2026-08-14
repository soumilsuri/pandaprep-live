# 02 — Legacy Architecture & Failure Modes (Audit)

## 1. Overview of Legacy Architecture

The original PandaPrep backend is a monolithic Express.js app in Node.js with an external microservice for PDF rendering.

```
Client (Next.js) ──► Express API ──► In-Memory Queue (MAX_CONCURRENT_JOBS=1)
                                           │
 ┌─────────────────────────────────────────┴─────────────────────────────────────────┐
 │ Linear Pipeline Execution                                                         │
 │ 1. SyllabusAnalyzerAgent (One-shot Groq call for topic grouping)                  │
 │ 2. Reference PDF Loading (LangChain + Local FAISS on disk: temp/vectorstores/)    │
 │ 3. NotesGeneratorAgent (Sequential Groq calls, k=3 chunk retrieval)               │
 │ 4. LaTeX Processing (mathjax-node to SVG)                                         │
 │ 5. md-to-pdf Microservice (Synchronous HTTP call to Azure Web App)                │
 │ 6. Cloudinary Upload & Brevo Email Notification                                   │
 └───────────────────────────────────────────────────────────────────────────────────┘
```

Despite naming classes `*Agent`, the legacy implementation was a **rigid linear chain with no agentic behavior**:
- No state retained across generated sections.
- No dynamic tool selection.
- No self-correction or verification against syllabus coverage.
- No recovery from transient failures or restart events.

---

## 2. The Four Root Causes of System Failure

An architectural audit of the legacy codebase identified four root causes (RC-1 to RC-4) responsible for almost all production issues:

### 🚨 RC-1: In-Memory Process State
- **Problem**: The job queue array (`queue = []`), active WebSocket connections (`activeConnections = new Map()`), and Q&A chat history (`ChatWithNotesAgent.chatHistories = new Map()`) all lived purely in Node.js heap memory.
- **Consequence**:
  - Any server restart, deployment, or PaaS recycle wiped all active jobs and user chat histories.
  - Multi-instance scaling was impossible: separate instances could not share in-memory queues or coordinate WebSocket clients.

### 🚨 RC-2: Local Disk as Durable Storage
- **Problem**: Vector stores (`temp/vectorstores/{documentId}`) and intermediate markdown/PDF files were written to local disk and verified only with `fs.existsSync()`.
- **Consequence**:
  - In cloud/container environments (Azure Web Apps / Vercel), local storage is ephemeral. A restart between vector store indexing and notes generation caused fatal missing-index errors.
  - Documents could not be shared across worker processes.

### 🚨 RC-3: Hardcoded Single-Threaded Execution
- **Problem**: `MAX_CONCURRENT_JOBS = 1` was hardcoded globally to prevent Groq API rate limits. Additionally, within each job, every section was generated strictly serially.
- **Consequence**:
  - System throughput had a permanent ceiling of 1 job at a time (~30s to 3.5 minutes per job).
  - During exam season peak load, the queue grew without bound. A single hung LLM call blocked all users indefinitely.

### 🚨 RC-4: Lack of Checkpointing and Idempotency
- **Problem**: The pipeline never recorded intermediate step completion (e.g. "Section 1 drafted", "PDF compiled", "Email dispatched").
- **Consequence**:
  - Any failure at Step 9 (PDF conversion) or Step 10 (Cloudinary upload) caused the entire job to fail, discarding all already-paid-for LLM generations.
  - Recovery attempts had to restart the mission completely from scratch.

---

## 3. Product & Quality Failures (Why Notes Failed Students)

Beyond infrastructure bottlenecks, the generation quality suffered from two core design flaws:

1. **The Context Loss Problem**:
   - Each section was generated as an isolated LLM call with only the top 3 vector chunks.
   - The generator had no memory of terms previously defined, styles established, or cross-references introduced in earlier sections.
   - Result: Notes lacked coherent narrative flow, repeated basic definitions, and drifted in style.

2. **Unverified Syllabus Coverage**:
   - `SyllabusAnalyzerAgent` grouped topics once up-front into prompt batches. Downstream steps blindly trusted this grouping.
   - Nothing verified whether the generated markdown actually covered all syllabus requirements or contained hallucinated claims unsupported by the reference material.

---

## 4. "Never Repeat" Implementation Rules

When developing the new agentic architecture:
1. ❌ **Do NOT use in-memory arrays or maps for queues, jobs, or chat state.**
2. ❌ **Do NOT store vector indexes or intermediate generation state exclusively on local disk.**
3. ❌ **Do NOT hardcode `MAX_CONCURRENT_JOBS = 1` or force independent sections to generate serially.**
4. ❌ **Do NOT execute linear steps without checkpointing state transitions to MongoDB.**
5. ❌ **Do NOT rely on heavy external PDF microservices or server-side headless browsers when direct Markdown delivery + browser-side rendering (`window.print()`) is 50x lighter and faster.**
6. ❌ **Do NOT finalize and deliver notes without running automated verifier contract checks.**
