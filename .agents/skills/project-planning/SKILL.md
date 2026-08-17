---
name: project-planning
description: >-
  Use this skill when the user asks to plan, architect, or design a feature,
  migration, refactor, or new project. Activate when the user says things like
  "make a plan", "create an implementation plan", "plan this out", "write a
  design doc", or "help me think through this before coding". This skill
  produces a coordinated suite of living planning artifacts following industry-
  standard practices (ADRs, risk registers, requirements traceability, and
  phased implementation plans).
---

# Project Planning Skill

This skill defines a structured, multi-artifact planning system for software projects. It produces **6 coordinated living documents** that together provide complete project governance — from high-level architecture decisions down to individual task tracking.

---

## When to Use This Skill

- The user requests a plan, design document, or architecture proposal
- A task involves multiple phases, files, or components
- The user explicitly asks for TODO tracking, decision logging, or risk assessment
- A migration, refactor, or greenfield project is being started
- The scope is large enough that jumping straight to code would be reckless

## When NOT to Use This Skill

- Trivial one-file changes, bug fixes, or typo corrections
- The user explicitly says "just do it" or "skip the plan"
- Follow-up work on an already-approved plan (just execute)

---

## Phase 1: Research (No Code Changes)

Before writing any planning artifacts, perform thorough research:

1. **Read all relevant source material** — specs, existing code, config files, READMEs, `.agents/` docs, and any referenced design documents.
2. **Understand the existing architecture** — directory structure, dependencies, patterns, conventions.
3. **Identify constraints** — deployment targets, API compatibility, shared infrastructure, existing tests.
4. **Surface unknowns** — missing information, ambiguous requirements, decisions that need user input.

> **CRITICAL**: Do NOT modify any source code during research. Only create/update planning artifacts.

---

## Phase 2: Create the Planning Artifact Suite

Create up to **6 artifacts** depending on project complexity. For smaller projects, the Implementation Plan + TODO may suffice. For larger projects, produce the full suite.

### Artifact 1: Implementation Plan (`implementation_plan.md`)

The primary design document. The user must approve this before any code is written.

**Required Sections:**

```markdown
# [Project Name] — Implementation Plan

## Goal
Brief description of the problem, background context, and what the change accomplishes.

## User Review Required
> [!IMPORTANT]
> Decisions or assumptions that MUST be confirmed before proceeding.

> [!WARNING]
> Breaking changes, risks, or items with significant consequences.

## Open Questions
> [!IMPORTANT]
> Numbered list of clarifying questions. Each should be actionable — 
> the user can answer it and unblock work.

> [!NOTE]
> Lower-priority questions that can be deferred.

## Proposed Changes
Organized by phase (for multi-phase work) or by component. Each phase should
deliver a **testable increment**.

### Phase N — [Phase Title]
> One-line summary of what this phase delivers and why it's testable.

#### [NEW] `path/to/new-file.ts`
- Bullet points describing what this file contains

#### [MODIFY] `path/to/existing-file.ts`
- What changes and why

#### [DELETE] `path/to/removed-file.ts`
- Why it's being removed

## Verification Plan

### Automated Tests
- Commands to run, expected outcomes

### Manual Verification
- Steps for the user to verify (deploy, UI check, etc.)
```

**Design Principles:**
- **Phase boundaries** should be testable checkpoints — each phase produces working, verifiable code
- **File annotations** use `[NEW]`, `[MODIFY]`, `[DELETE]` prefixes for scannability
- **GitHub Alerts** (`[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`, `[!NOTE]`, `[!TIP]`) for visual hierarchy
- **Link to source specs** using clickable file links: `[spec name](file:///absolute/path)`
- **Never propose changes to files outside the agreed scope** without flagging them in "User Review Required"

---

### Artifact 2: TODO Tracker (`todo.md`)

A living checklist that tracks every task across all phases. This is the operational heartbeat of the project.

**Required Format:**

```markdown
# [Project Name] — TODO Tracker

> **⚠️ INSTRUCTIONS**: This is a **living document**. Update it as you work:
> - Mark items `[ ]` for uncompleted tasks
> - Mark items `[/]` for in-progress tasks
> - Mark items `[x]` for completed tasks
> - Add new sub-items as you discover work during implementation
> - Add blockers/notes inline under the relevant item
> - When a phase is fully complete, add a `✅ Phase N complete — YYYY-MM-DD` line

---

## Pre-Implementation Setup
- [ ] Item 1
- [ ] Item 2

---

## Phase 1 — [Phase Title]

### [Component Group]
- [ ] Task description with file path
- [ ] Another task

### Testing
- [ ] Test description

---

## Phase 2 — [Phase Title]
...

---

## Post-Implementation
- [ ] Full end-to-end smoke test
- [ ] Security review
- [ ] Documentation
```

**Rules:**
- Mirror the phase structure from the implementation plan exactly
- Group tasks by component within each phase (Models, Controllers, Agents, Tests, etc.)
- Every phase MUST have a `### Testing` sub-section
- The `## Post-Implementation` section captures work that spans all phases
- **Update this file continuously** — mark `[/]` when starting, `[x]` when done, add new items as discovered

---

### Artifact 3: Requirements (`requirements.md`)

Traceability matrix linking every requirement to its source specification.

**Required Format:**

```markdown
# [Project Name] — Requirements

> **⚠️ INSTRUCTIONS**: Update this document if requirements change.
> Track any modifications with a dated note.

---

## 1. Functional Requirements

### FR-1: [Feature Area]
| ID | Requirement | Source |
|---|---|---|
| FR-1.1 | Description | [spec §section](file:///path) |
| FR-1.2 | Description | [spec §section](file:///path) |

---

## 2. Non-Functional Requirements

### NFR-1: [Category (Performance, Reliability, Security, etc.)]
| ID | Requirement | Target |
|---|---|---|
| NFR-1.1 | Description | Measurable target |

---

## 3. Out of Scope
- Explicitly listed items that are NOT being built
```

**Rules:**
- Every functional requirement gets a traceable ID (FR-X.Y)
- Every NFR gets a measurable target, not vague language
- Link source column to the actual spec file with line references where possible
- "Out of Scope" prevents scope creep — list things the user might assume are included

---

### Artifact 4: Decision Log / ADR (`decisions.md`)

Architecture Decision Records capturing every non-trivial technical choice.

**Required Format:**

```markdown
# [Project Name] — Decision Log (ADR)

> **⚠️ INSTRUCTIONS**: Log every non-trivial technical decision here.
> Use the template below. Number entries sequentially.

---

## ADR-001: [Decision Title]

- **Date**: YYYY-MM-DD
- **Status**: Proposed | Accepted | Deprecated | Superseded by ADR-XXX
- **Context**: Why this decision was needed. What problem or trade-off exists.
- **Decision**: What was decided and how.
- **Alternatives Considered**: Other options and why they were rejected (optional but recommended).
- **Consequences**:
  - Positive consequence
  - Negative consequence / trade-off

---

## Template for New Entries

(Copy this for new ADRs)

## ADR-XXX: [Title]
- **Date**: YYYY-MM-DD
- **Status**: Proposed
- **Context**: ...
- **Decision**: ...
- **Consequences**: ...
```

**Rules:**
- Log decisions as they're made — don't batch them at the end
- Status transitions: `Proposed` → `Accepted` → optionally `Deprecated` or `Superseded`
- Include **Alternatives Considered** for any decision that the user might question
- Reference source specs or constraints that drove the decision

---

### Artifact 5: Risk Register (`risks.md`)

Proactive identification of technical risks with mitigations.

**Required Format:**

```markdown
# [Project Name] — Risks & Known Challenges

> **⚠️ INSTRUCTIONS**: Update this document whenever new risks are identified
> or existing risks are resolved. Date all entries.

---

## High Severity

### RISK-001: [Risk Title]
- **Phase**: N
- **Description**: What could go wrong and why.
- **Mitigation**:
  - Concrete action 1
  - Concrete action 2
  - Fallback plan
- **Status**: Open | Mitigated | Resolved | Accepted

---

## Medium Severity

### RISK-002: ...

---

## Low Severity

### RISK-003: ...
```

**Rules:**
- Severity levels: High (blocks delivery), Medium (degrades quality), Low (inconvenience)
- Every risk MUST have at least one concrete mitigation, not just "be careful"
- Update status as risks are resolved during implementation
- Reference the phase where the risk is most likely to manifest

---

### Artifact 6: Walkthrough (`walkthrough.md`)

Post-execution summary of what was built. Created/updated **after** implementation, not before.

**Required Format:**

```markdown
# [Project Name] — Implementation Walkthrough

## 1. [Component/Phase Name]
- **What was built**: Summary with clickable file links
- **Key design decisions**: Reference ADR numbers
- **How it works**: Brief architecture explanation

---

## N. Verification & Test Results

Paste full test output showing all suites passing.

---

## N+1. Summary
- What's done
- What's remaining (if anything)
- Production readiness assessment
```

**Rules:**
- Written incrementally as phases complete, not all at once at the end
- Embed actual test output, not paraphrased results
- Use clickable file links (`[file.ts](file:///path/to/file.ts)`) for every file referenced
- Update existing walkthrough for follow-up work rather than creating a new one

---

## Phase 3: Obtain Approval

After creating the artifacts:

1. **Set `request_feedback = true`** on the implementation plan artifact
2. **STOP and wait** for explicit user approval
3. Do NOT begin coding until the user says to proceed
4. If the user has questions, update the artifacts and re-request feedback

---

## Phase 4: Execute with Continuous Updates

Once approved:

1. **Create `todo.md`** (if not already created) with the full task breakdown
2. Work through phases sequentially, updating `todo.md` after every task
3. Log new ADRs in `decisions.md` as implementation decisions arise
4. Update `risks.md` status as risks are resolved or new ones discovered
5. Update `walkthrough.md` at the end of each phase with test results
6. If significant deviations from the plan are needed, **update `implementation_plan.md` and re-request approval**

---

## Scaling Guidelines

| Project Size | Recommended Artifacts |
|---|---|
| **Small** (1-2 files, < 1 hour) | Implementation Plan + TODO only |
| **Medium** (3-10 files, < 1 day) | Implementation Plan + TODO + Decisions |
| **Large** (10+ files, multi-day) | Full suite (all 6 artifacts) |
| **Migration / Rewrite** | Full suite + extra emphasis on Risks and Requirements |

---

## Anti-Patterns to Avoid

1. **Planning without research** — Never write plans based on assumptions. Read the code first.
2. **Monolithic phases** — Each phase must be independently testable. If it can't be tested alone, split it.
3. **Stale artifacts** — A TODO that isn't updated is worse than no TODO. Keep them current or don't create them.
4. **Vague mitigations** — "Handle errors gracefully" is not a mitigation. "Wrap in try/catch, retry 2x with exponential backoff, log to Pino, return 503" is.
5. **Over-planning trivial work** — Don't produce 6 artifacts for a CSS fix. Use judgment.
6. **Asking approval questions in chat** — Put all questions in the implementation plan's "Open Questions" section so they're persistent and reviewable.
