# 04 — Notes Workspace Schema (Shared Working Memory)

## 1. Overview & Purpose

The **Notes Workspace** is the core mechanism that prevents context loss across sections. Rather than treating "shared memory" as an abstract idea or dumping an entire chat transcript into every LLM call, the Notes Workspace is a **concrete, structured MongoDB document** created per generation mission (`notes_workspaces` collection).

It acts as the single source of truth that the **Planner**, **Writers**, and **Verifier** read and update throughout the generation lifecycle.

---

## 2. Full MongoDB Schema Specification

```javascript
// MongoDB Collection: `notes_workspaces`
{
  "_id": ObjectId("..."),
  "mission_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d", // UUID v4, indexed
  "user_id": ObjectId("..."),
  "created_at": ISODate("2026-08-14T23:00:00Z"),
  "updated_at": ISODate("2026-08-14T23:02:15Z"),

  // 1. Ground Truth Syllabus Requirements
  "syllabus_topics": [
    "Binary Search Trees: Insertion, Deletion, Search",
    "Balanced Trees: AVL Tree Rotations and Balance Factors",
    "Red-Black Tree Properties and Color Invariants"
  ],

  // 2. Topic Dependency Graph (Planner output)
  "topic_graph": {
    "nodes": [
      {
        "section_id": "sec_01",
        "title": "Binary Search Trees Fundamentals",
        "estimated_words": 500,
        "key_concepts": ["BST property", "search", "insert", "delete"]
      },
      {
        "section_id": "sec_02",
        "title": "AVL Trees and Self-Balancing",
        "estimated_words": 600,
        "key_concepts": ["balance factor", "LL rotation", "RR rotation", "LR/RL rotation"]
      }
    ],
    "edges": [
      {
        "from": "sec_01",
        "to": "sec_02",
        "relationship": "prerequisite" // sec_02 depends on definitions in sec_01
      }
    ]
  },

  // 3. Testable Coverage Checklist (Planner output -> Verifier check)
  "coverage_checklist": [
    {
      "requirement_id": "req_01",
      "syllabus_text": "Binary Search Trees: Insertion, Deletion, Search",
      "mapped_section_id": "sec_01",
      "status": "verified" // "pending" | "drafted" | "verified"
    },
    {
      "requirement_id": "req_02",
      "syllabus_text": "Balanced Trees: AVL Tree Rotations and Balance Factors",
      "mapped_section_id": "sec_02",
      "status": "verified"
    }
  ],

  // 4. Generated Section Content
  "generated_sections": {
    "sec_01": {
      "title": "Binary Search Trees Fundamentals",
      "content_markdown": "## Binary Search Trees...\n...",
      "word_count": 520,
      "status": "completed", // "pending" | "generating" | "completed" | "repairing"
      "updated_at": ISODate("2026-08-14T23:01:10Z")
    },
    "sec_02": {
      "title": "AVL Trees and Self-Balancing",
      "content_markdown": "## AVL Trees...\n...",
      "word_count": 610,
      "status": "completed",
      "updated_at": ISODate("2026-08-14T23:02:00Z")
    }
  },

  // 4b. Fully Assembled Markdown (TOC + All Sections + MathJax LaTeX)
  "final_markdown": "# Data Structures & Algorithms Revision Notes\n\n## Table of Contents\n...",

  // 5. Terminology Registry (Prevents contradictory definitions)
  "terms_defined": [
    {
      "term": "Balance Factor",
      "definition": "Height(Left Subtree) - Height(Right Subtree), valid values are {-1, 0, 1}.",
      "introduced_in_section": "sec_02"
    }
  ],

  // 6. Cross-Reference Anchors (Enables inter-section linking)
  "cross_reference_anchors": [
    {
      "anchor_id": "sec-01-bst-inorder",
      "section_id": "sec_01",
      "label": "In-Order Traversal Sorting Property"
    }
  ],

  // 7. Global Style Decisions (Ensures consistent tone across writers)
  "style_decisions": {
    "depth": "detailed",
    "tone": "academic_rigorous",
    "math_format": "latex_mathjax",
    "include_code_examples": true,
    "primary_language": "English"
  },

  // 8. Grounding & Citations (Reference chunks used per section)
  "sources_used": {
    "sec_01": [
      { "type": "vector_chunk", "source_id": "ref_page_12_chunk_3" }
    ],
    "sec_02": [
      { "type": "vector_chunk", "source_id": "ref_page_15_chunk_1" },
      { "type": "web_search", "query": "AVL tree rotation cases" }
    ]
  },

  // 9. Verifier Audit Trail
  "verification_results": [
    {
      "section_id": "sec_02",
      "iteration": 1,
      "passed": true,
      "checks": {
        "coverage": "pass",
        "terminology": "pass",
        "grounding": "pass",
        "latex_syntax": "pass"
      },
      "issues": []
    }
  ],

  // 10. Outstanding Gaps (Shipped visibly if repair cap is reached)
  "outstanding_gaps": []
}
```

---

## 3. Scoped Workspace Reading (Token & Latency Efficiency)

To prevent LLM prompts from ballooning, a Writer generating `sec_02` **does not receive the entire raw workspace**. Instead, an internal helper function builds a **Scoped Workspace Summary**:

```javascript
/**
 * Generates a compact workspace slice for a given section
 */
function getScopedWorkspaceSlice(workspace, targetSectionId) {
  const targetNode = workspace.topic_graph.nodes.find(n => n.section_id === targetSectionId);
  
  // 1. Identify prerequisite sections
  const prereqSectionIds = workspace.topic_graph.edges
    .filter(e => e.to === targetSectionId)
    .map(e => e.from);

  // 2. Extract terms defined in prerequisites
  const relevantTerms = workspace.terms_defined
    .filter(t => prereqSectionIds.includes(t.introduced_in_section));

  // 3. Extract available cross-reference anchors
  const availableAnchors = workspace.cross_reference_anchors
    .filter(a => prereqSectionIds.includes(a.section_id));

  return {
    section_info: targetNode,
    style_rules: workspace.style_decisions,
    prerequisite_terms: relevantTerms,
    available_anchors: availableAnchors,
  };
}
```

---

## 4. Lifecycle & Isolation Rules

1. **Per-Mission Isolation**: Each notes generation request receives its own distinct `notes_workspace` record keyed by `mission_id`. No cross-mission state bleeding.
2. **Atomic In-Place Updates**: Agents update their specific sub-fields using MongoDB atomic operations (e.g. `$set: { "generated_sections.sec_01": ... }`, `$push: { "terms_defined": { ... } }`).
3. **Persistence for Interactive Q&A**: The workspace document is preserved post-generation, providing the knowledge context for student queries in the interactive Q&A assistant.
