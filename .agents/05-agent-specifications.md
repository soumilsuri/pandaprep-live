# 05 — Agent Specifications & Prompts

> **Developer Reference & Official Documentation**:
> - Base Gemini API Docs: [https://ai.google.dev/gemini-api/docs](https://ai.google.dev/gemini-api/docs)
> - Gemini 3.7 Flash Model: [https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash)
> - Gemini Embeddings (`gemini-embedding-2`): [https://ai.google.dev/gemini-api/docs/embeddings](https://ai.google.dev/gemini-api/docs/embeddings)
> - Agent Framework: **LangChain** (`@langchain/core`, `@langchain/google-genai`, `@langchain/groq`) & **LangGraph.js** (`@langchain/langgraph`)

---

## 1. Intake Resolution Step

- **Model Tier**: Fast/Lightweight (Google `gemini-3.7-flash` or fast tier)
- **Role**: Interprets free-text `user_instructions` (e.g., "I just need to pass" vs "I want rigorous depth") to set definitive style and depth parameters before planning begins.
- **Output**: JSON payload configuring `education_level`, `depth`, and `focus_areas`.

---

## 2. Planner Agent

- **Model Tier**: Capable LLM (Groq `llama-3.3-70b-versatile` or Google `gemini-3.7-flash`)
- **Role**: Decomposes raw syllabus into an actionable, testable plan:
  1. Builds the `topic_graph` with semantic prerequisites and section ordering.
  2. Generates the `coverage_checklist` mapping every syllabus requirement to a section.
  3. Uses `search_web` **only** if a syllabus line is sparse (e.g. "Unit 3: Trees").

### Input Schema
```json
{
  "subject_name": "Data Structures",
  "syllabus": "Unit 1: BSTs...\nUnit 2: AVL Trees...",
  "note_type": "detailed",
  "education_level": "intermediate",
  "user_instructions": "Focus on balancing rotations"
}
```

### System Prompt Directive
```text
You are the PandaPrep Lead Syllabus Planner.
Your job is to analyze the syllabus and produce a structured generation plan:
1. Break down the syllabus into sequential sections.
2. Identify prerequisite relationships between sections (edges in a DAG).
3. Create a strict coverage checklist where EVERY syllabus item is assigned to a section.
4. Establish the tone and depth rules in style_decisions.
5. If a topic line is too brief to understand, invoke `search_web` to inspect standard academic curricula for that topic.

Return ONLY a valid JSON object matching the Planner Output Schema.
```

### Output JSON Schema
```json
{
  "topic_graph": {
    "nodes": [
      {
        "section_id": "sec_01",
        "title": "Binary Search Trees",
        "estimated_words": 500,
        "key_concepts": ["BST properties", "Search", "Insertion", "Deletion"]
      }
    ],
    "edges": [
      { "from": "sec_01", "to": "sec_02", "relationship": "prerequisite" }
    ]
  },
  "coverage_checklist": [
    {
      "requirement_id": "req_01",
      "syllabus_text": "Binary Search Trees: Insertion, Deletion, Search",
      "mapped_section_id": "sec_01",
      "status": "pending"
    }
  ],
  "style_decisions": {
    "depth": "detailed",
    "tone": "rigorous",
    "include_code_examples": true
  }
}
```

---

## 3. Writer Agent

- **Model Tier**: High-Capability LLM (Groq `llama-3.3-70b-versatile`)
- **Role**: Drafts individual sections against the Notes Workspace.
- **Execution**: Independent sections generate concurrently; prerequisite-chained sections generate in topological sequence.

### Input
- **Scoped Workspace Slice**: Prerequisite terms already defined, available cross-reference anchors, and style decisions.
- **Reference Context**: Retrieved from Atlas Vector Search (`retrieve_reference`).

### System Prompt Directive
```text
You are a PandaPrep Section Writer. You are drafting section: {section_title}.

CONTEXT & CONSTRAINTS:
1. Reference Material Chunks: {reference_chunks}
2. Established Definitions to Reuse: {prerequisite_terms}
3. Available Anchors to Link to: {available_anchors}
4. Style & Depth Guidelines: {style_rules}

RULES:
- Maintain full mathematical precision using LaTeX ($...$ for inline, $$...$$ for display).
- If introducing a critical technical definition, output it in the `new_terms_defined` field.
- If creating an anchor for later sections to reference, output it in `new_anchors` field.
- Do NOT repeat basic definitions already established in prior sections.
```

### Output JSON Schema
```json
{
  "section_id": "sec_02",
  "content_markdown": "## AVL Trees and Rotations\n\nAs established in [BST Fundamentals](#sec-01-bst), ...",
  "new_terms_defined": [
    {
      "term": "Balance Factor",
      "definition": "Height(Left Subtree) - Height(Right Subtree)"
    }
  ],
  "new_anchors": [
    {
      "anchor_id": "sec-02-avl-rotations",
      "label": "Four Cases of AVL Rotations"
    }
  ],
  "sources_used": ["ref_page_12_chunk_3"]
}
```

---

## 4. Verifier Agent & Repair Loop

- **Model Tier**: Structured Evaluator (Google `gemini-3.7-flash` or fast tier)
- **Role**: Executes concrete automated contract checks across generated notes before finalization.

### The 6 Contract Checks
1. **Syllabus Coverage**: Does every item in `coverage_checklist` have its required content present in the mapped section?
2. **Missing Topics**: Are any checklist items still marked `pending`?
3. **Grounding & Citations**: Are factual claims grounded in `sources_used`? (Lightweight hallucination check).
4. **Terminology Consistency**: Are terms in `terms_defined` reused consistently across sections without conflicting definitions?
5. **Cross-Reference Integrity**: Do all referenced markdown anchors exist in `cross_reference_anchors`?
6. **Syntax & Formatting**: Are LaTeX equations properly closed? Are tables and markdown properly formatted?

### Bounded Repair Loop Rules
- If Verifier detects issues:
  - Generates targeted, specific repair instructions for the responsible section.
  - Sends repair task back to Writer Agent for a patch pass.
- **Hard Caps**:
  - Maximum **2 repair iterations** per section.
  - Maximum **1 document-level consistency pass**.
  - If issues remain after max iterations, record them in `outstanding_gaps` and ship visibly rather than stalling or looping.

### Verifier Output Schema
```json
{
  "passed": false,
  "section_id": "sec_02",
  "iteration": 1,
  "issues": [
    {
      "check": "coverage",
      "severity": "high",
      "description": "Coverage checklist req_02 mentions 'LR rotation case' but section sec_02 only covers LL and RR.",
      "repair_instruction": "Add an explicit subsection explaining Double Left-Right (LR) rotations with an example."
    }
  ]
}
```

---

## 5. Interactive Q&A Agent

- **Model Tier**: Conversational / Tool-Using Agent
- **Role**: Post-delivery revision assistant for students to interact with their generated notes.

### Available Tools
| Tool Name | Action / Purpose |
|---|---|
| `search_notes` | Vector / keyword search over the student's own generated workspace. (Primary source) |
| `search_reference` | Vector search over original reference material if notes lack detail. |
| `quiz_me` | Generates active-recall questions and evaluates student answers. |
| `explain_more` | Expands a specific concept with simplified analogies or stepped walkthroughs. |
| `search_web` | Fallback search for out-of-scope questions (explicitly labeled as external). |

### Decision Rules & Bounds
- Maximum **3 to 4 tool calls** per student query.
- Chat history is stored persistently in MongoDB (`chat_histories` collection), preventing data loss across restarts.
