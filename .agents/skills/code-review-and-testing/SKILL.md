---
name: code-review-and-testing
description: >-
  Use this skill when the user asks to review code, write tests, plan a testing
  strategy, audit code quality, or perform a code review. Activate when the user
  says things like "review this code", "write tests", "create a testing plan",
  "audit this", "code review", "QA this", or "check code quality". This skill
  produces structured code review reports, test plans, and test implementations
  following industry-standard practices (test pyramids, mutation-aware coverage,
  OWASP checklists, and systematic review methodologies).
---

# Code Review & Testing Skill

This skill defines a structured methodology for code review and test planning. It can operate in two modes:

1. **Review Mode** — Audit existing code and produce a structured review report
2. **Test Planning Mode** — Design and implement a comprehensive test strategy

Both modes produce planning artifacts compatible with the [project-planning](../project-planning/SKILL.md) skill.

---

## When to Use This Skill

- User asks to review code, audit quality, or check for issues
- User asks to write tests, plan a testing strategy, or improve coverage
- A phase is complete and needs verification before proceeding
- User asks for a "code review", "QA pass", or "testing plan"
- New code is being merged or deployed and needs validation

## When NOT to Use This Skill

- Running a single existing test that already passes (`npm test` — just run it)
- Fixing a specific, already-identified bug (just fix it)
- The user asks for a quick "does this work?" check (just run the code)

---

# Part 1: Code Review

## Review Methodology

Follow this systematic review process. Do NOT freestyle — follow the checklist.

### Step 1: Scope the Review

Determine what's being reviewed:

- **Single file**: Deep review with line-by-line analysis
- **Feature/PR**: Multi-file review focusing on integration points
- **Architecture**: High-level review of structure, patterns, and dependencies
- **Full codebase**: Module-by-module sweep (use phased approach)

### Step 2: Execute the Review Checklist

For every file or component under review, evaluate against these categories.
Skip categories that don't apply (e.g., skip "Security" for a pure utility function).

#### Category 1: Correctness & Logic

- [ ] **Edge cases**: Null, undefined, empty arrays, empty strings, zero, negative numbers, boundary values
- [ ] **Error handling**: Are errors caught, logged, and propagated correctly? No swallowed exceptions?
- [ ] **Race conditions**: Concurrent access to shared state? Atomic operations where needed?
- [ ] **Off-by-one errors**: Loop bounds, array indices, string slicing, pagination
- [ ] **Type safety**: TypeScript `any` usage? Unsafe casts? Missing null checks?
- [ ] **Async correctness**: Unhandled promise rejections? Missing `await`? Concurrent vs sequential where it matters?
- [ ] **Resource leaks**: Unclosed connections, streams, file handles, event listeners not removed?
- [ ] **Infinite loops / unbounded recursion**: Does every loop/recursion have a guaranteed termination condition?

#### Category 2: Security (OWASP-Informed)

- [ ] **Injection**: SQL/NoSQL injection, command injection, template injection
- [ ] **Auth & authz**: Authentication checks present? Authorization (role/ownership) verified?
- [ ] **Input validation**: All user inputs validated and sanitized? Size limits enforced?
- [ ] **Sensitive data exposure**: Secrets in logs? PII in error messages? API keys in client code?
- [ ] **CORS / CSRF**: Correct origin restrictions? CSRF tokens for state-changing operations?
- [ ] **Dependency vulnerabilities**: Known CVEs in dependencies? `npm audit` clean?
- [ ] **Rate limiting**: Endpoints protected against abuse? Cost-sensitive operations bounded?

#### Category 3: Performance

- [ ] **N+1 queries**: Database queries inside loops?
- [ ] **Unbounded data**: Queries without limits? Responses without pagination?
- [ ] **Memory**: Large objects held in memory unnecessarily? Streaming for large payloads?
- [ ] **Concurrency control**: `p-limit` or equivalent for parallel operations? Connection pool sizing?
- [ ] **Caching**: Repeated expensive computations? Cache invalidation strategy?
- [ ] **Lazy loading**: Large imports or initializations that could be deferred?

#### Category 4: Maintainability & Code Quality

- [ ] **Naming**: Variables, functions, files — do names convey intent?
- [ ] **Single Responsibility**: Each function/class does one thing?
- [ ] **DRY violations**: Duplicated logic that should be extracted?
- [ ] **Dead code**: Unused imports, unreachable branches, commented-out code?
- [ ] **Magic numbers/strings**: Hardcoded values that should be constants or config?
- [ ] **Documentation**: Complex logic has explanatory comments? Public APIs have docstrings?
- [ ] **Consistent patterns**: Does the code follow the conventions established in the rest of the codebase?

#### Category 5: Architecture & Design

- [ ] **Separation of concerns**: Business logic mixed with I/O? Controller doing too much?
- [ ] **Dependency direction**: Higher-level modules importing lower-level ones correctly?
- [ ] **Interface contracts**: Clear input/output types? Backward-compatible changes?
- [ ] **Testability**: Can components be tested in isolation? Dependencies injectable?
- [ ] **Error boundaries**: Failures contained? No cascading failures across modules?

### Step 3: Produce the Review Report

Create a structured review artifact:

```markdown
# Code Review Report — [Scope Description]

**Reviewer**: AI Agent
**Date**: YYYY-MM-DD
**Scope**: [files/components reviewed]
**Verdict**: ✅ Approve | ⚠️ Approve with Comments | 🔴 Request Changes

---

## Summary

Brief 2-3 sentence overall assessment.

---

## Critical Issues (Must Fix)

### CR-001: [Issue Title]
- **File**: [`filename.ts`](file:///path/to/file.ts#L10-L25)
- **Category**: Correctness | Security | Performance
- **Description**: What's wrong and why it matters.
- **Suggested Fix**:
```diff
-problematic code
+fixed code
```

---

## Warnings (Should Fix)

### WR-001: [Issue Title]
- **File**: [`filename.ts`](file:///path/to/file.ts#L42)
- **Category**: Maintainability | Performance
- **Description**: What could be improved.
- **Suggestion**: How to improve it.

---

## Suggestions (Nice to Have)

### SG-001: [Suggestion Title]
- **File**: [`filename.ts`](file:///path/to/file.ts#L55)
- **Description**: Optional improvement.

---

## Positive Observations

List things done well — good patterns, clean abstractions, thorough error handling.
This matters for team morale and reinforcing good practices.

---

## Test Coverage Assessment

| File | Has Tests? | Coverage Quality | Gaps |
|---|:---:|---|---|
| `file1.ts` | ✅ | Good — covers happy + error paths | Missing edge case X |
| `file2.ts` | ❌ | N/A | Needs unit tests |
```

**Severity Definitions:**
- **Critical (CR)**: Bugs, security vulnerabilities, data loss risks. Must be fixed before merge/deploy.
- **Warning (WR)**: Code smells, performance issues, missing error handling. Should be fixed soon.
- **Suggestion (SG)**: Style improvements, optional refactors. Nice to have.

---

# Part 2: Test Planning & Implementation

## Test Strategy Design

### Step 1: Assess the Testing Landscape

Before writing any tests, understand what exists:

1. **Inventory existing tests** — Run `find` or `grep` for test files. Note the testing framework, patterns, and conventions already in use.
2. **Identify the test runner and config** — Vitest, Jest, Mocha, pytest, etc. Read the config file.
3. **Map coverage gaps** — Which modules have tests? Which don't? Which have tests but with shallow coverage?
4. **Understand dependencies** — What needs mocking? Database, external APIs, filesystem, time?

### Step 2: Apply the Test Pyramid

Design tests at the appropriate level:

```
         ╱╲
        ╱  ╲        E2E Tests (few)
       ╱    ╲       Full system, real DB, real APIs
      ╱──────╲
     ╱        ╲     Integration Tests (moderate)
    ╱          ╲    Multiple modules, real DB, mocked externals
   ╱────────────╲
  ╱              ╲  Unit Tests (many)
 ╱                ╲ Single function/class, all deps mocked
╱──────────────────╲
```

**Distribution guidance:**
- **Unit tests** (60-70%): Pure logic, transformations, validators, parsers, utilities
- **Integration tests** (20-30%): Database operations, API routes, multi-module workflows
- **E2E tests** (5-10%): Critical user journeys, deployment verification

### Step 3: Produce the Test Plan

Create a structured test plan artifact:

```markdown
# Test Plan — [Feature/Component Name]

**Date**: YYYY-MM-DD
**Framework**: Vitest | Jest | Mocha | pytest | ...
**Run Command**: `npm run test` | `pytest` | ...

---

## Test Pyramid Distribution

| Level | Count | Scope |
|---|:---:|---|
| Unit | N | Pure logic, validators, transformations |
| Integration | N | DB operations, API routes, multi-module |
| E2E | N | Full user journeys |

---

## Test Suite Breakdown

### Suite 1: [Component Name] (`tests/path/to/test.ts`)

| # | Test Case | Type | What It Verifies |
|---|---|---|---|
| 1 | should [expected behavior] when [condition] | Unit | [specific contract] |
| 2 | should [expected behavior] when [condition] | Integration | [specific contract] |

**Mocking Strategy:**
- [Dependency X]: Mocked because [reason]
- [Database]: Real connection because [reason]

### Suite 2: [Component Name] ...

---

## Coverage Targets

| Metric | Target | Rationale |
|---|---|---|
| Line coverage | ≥80% | Industry standard baseline |
| Branch coverage | ≥70% | Catches untested conditionals |
| Critical path coverage | 100% | All happy + error paths for core features |

---

## Test Data Strategy

- **Fixtures**: Where test data lives, how it's structured
- **Factories**: Dynamic test data generation (if needed)
- **Cleanup**: How test data is cleaned up after each suite
- **Isolation**: How tests avoid interfering with each other

---

## Dependencies & Environment

- **Database**: Real MongoDB (test DB) | In-memory | Mocked
- **External APIs**: Mocked with [tool] | Real with test keys
- **Environment Variables**: Listed in `.env.test` or test setup
```

### Step 4: Write the Tests

Follow these principles when implementing:

**Naming Convention:**
```
should [expected behavior] when [condition/input]
```
Examples:
- `should return 401 when auth token is missing`
- `should atomically claim mission and prevent double claiming`
- `should retry with exponential backoff when rate limited`

**Test Structure (Arrange-Act-Assert):**
```typescript
it('should [expected behavior] when [condition]', async () => {
  // Arrange — set up preconditions and inputs
  const input = createTestInput({ ... });

  // Act — execute the code under test
  const result = await functionUnderTest(input);

  // Assert — verify the expected outcome
  expect(result.status).toBe('success');
  expect(result.data).toMatchObject({ ... });
});
```

**What to Test (Priority Order):**

1. **Happy path**: The primary use case works correctly
2. **Error paths**: Invalid input, missing data, failed dependencies
3. **Edge cases**: Empty inputs, boundary values, concurrent access
4. **Contracts**: Public API interfaces match their documented contracts
5. **Regressions**: Any bug that was fixed should have a test preventing recurrence

**What NOT to Test:**

- Implementation details (private methods, internal state)
- Third-party library internals (trust they work, mock the boundary)
- Trivial getters/setters with no logic
- Framework boilerplate (Express middleware registration order, etc.)

---

## Test Quality Checklist

Before considering tests complete, verify:

- [ ] **Tests actually fail when the code is broken** — Temporarily break the code and confirm the test catches it
- [ ] **No test interdependence** — Tests pass in any order and in isolation
- [ ] **Deterministic** — Tests pass 100% of the time, not flaky
- [ ] **Fast** — Unit tests < 100ms each. Integration tests < 5s each. E2E < 30s each.
- [ ] **Readable** — A new developer can understand what's being tested from the test name and structure alone
- [ ] **Clean setup/teardown** — No leaked database state, no orphaned resources
- [ ] **Assertions are specific** — No bare `toBeTruthy()` when `toBe(expectedValue)` is possible
- [ ] **Error messages are helpful** — Custom assertion messages for complex checks

---

## Combining Review + Testing

When asked to do both a code review and write tests:

1. **Review first** — Identify bugs and issues before writing tests
2. **Fix critical issues** — If authorized, fix bugs found during review
3. **Write tests for fixed bugs** — Every bug fix gets a regression test
4. **Write tests for remaining code** — Follow the test plan
5. **Re-review with tests** — Verify tests actually cover the identified risks
6. **Produce combined report** — Single artifact with review findings + test results

---

## Integration with Project Planning Skill

When code review or testing is part of a larger planned project:

- **Add test tasks to `todo.md`** — Every phase should have a `### Testing` section
- **Log testing decisions in `decisions.md`** — Framework choice, mocking strategy, coverage targets
- **Record test-related risks in `risks.md`** — Flaky tests, missing test infrastructure, slow test suites
- **Include test results in `walkthrough.md`** — Paste actual test output, not paraphrased results
- **Update `requirements.md`** — Map test cases back to requirement IDs for traceability

---

## Anti-Patterns to Avoid

1. **Testing the mock, not the code** — If your test passes regardless of what the code does, you're testing your mock setup
2. **Snapshot overuse** — Snapshots are fragile and hard to review. Use targeted assertions instead.
3. **God test files** — One massive test file for the entire app. Split by module/component.
4. **Test-after-forgot** — Writing all tests at the end. Write tests per-phase as you build.
5. **Coverage theater** — 100% line coverage with zero branch coverage or meaningless assertions
6. **Ignoring test maintenance** — Tests that break on every refactor are a burden, not an asset. Test behavior, not implementation.
7. **Copy-paste test code** — Extract shared setup into `beforeAll`/`beforeEach`, use factory functions for test data
8. **Skipping error paths** — Happy-path-only tests give false confidence. Error handling is where most bugs live.
