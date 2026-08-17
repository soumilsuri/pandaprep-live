# PandaPrep — Bounded Agentic Backend

The autonomous revision notes synthesis and grounded multi-turn Q&A engine for PandaPrep.

---

## 📚 API Documentation & Specifications

Complete, production-grade documentation and machine-readable specifications are available in the [`docs/`](file:///d:/coding_d/PandaPrep/backend-agentic/docs) directory:

- 📖 **[API Reference & Fetch MCP Testing Guide](file:///d:/coding_d/PandaPrep/backend-agentic/docs/API_DOCUMENTATION.md)** — Complete endpoint catalog, schemas, rate limits, status codes, Fetch MCP tool payloads, cURL snippets, and step-by-step test workflows.
- 📐 **[OpenAPI 3.1.0 Specification (YAML)](file:///d:/coding_d/PandaPrep/backend-agentic/docs/openapi.yaml)** — Formal OpenAPI YAML contract.
- 📐 **[OpenAPI 3.1.0 Specification (JSON)](file:///d:/coding_d/PandaPrep/backend-agentic/docs/openapi.json)** — Machine-readable OpenAPI JSON for automated tools and test harnesses.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env` and configure your API keys and MongoDB connection string:
```bash
cp .env.example .env
```

### 3. Run Development Server
```bash
npm run dev
```
The server will start on `http://localhost:8001`.

### 4. Run Test Suite
```bash
npm test
```

### 5. Run Evaluation Benchmarks
```bash
npm run test:evals
```

---

## 📡 Core Endpoints Summary

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Server and MongoDB liveness check | No |
| `GET` | `/api/health` | Namespaced healthcheck alias | No |
| `POST` | `/api/pipeline/generate-notes` | Enqueue autonomous notes synthesis | Yes (`Bearer <token>`) |
| `GET` | `/api/pipeline/generation-status/:requestId` | Poll notes generation status and output | Yes (`Bearer <token>`) |
| `GET` | `/api/pipeline/metrics` | Real-time observability metrics & latency | Yes (`Bearer <token>`) |
| `POST` | `/api/chat/chat-with-notes` | Grounded multi-turn Q&A against notes | Yes (`Bearer <token>`) |
| `POST` | `/api/chat/message` | Grounded chat alias endpoint | Yes (`Bearer <token>`) |
| `GET` | `/api/chat/history/:missionId` | Retrieve paginated chat history | Yes (`Bearer <token>`) |
