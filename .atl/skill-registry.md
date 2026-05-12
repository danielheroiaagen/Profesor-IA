# Skill Registry

Generated: 2026-05-12
Project: profesor ia

## Resolution

- Project-level skills: none detected.
- User-level skills scanned: `C:\Users\Danie\.config\opencode\skills`.
- Excluded by init rules: `sdd-*`, `_shared`, `skill-registry`.
- Project convention files: none detected.

## Compact Rules

### branch-pr

Trigger: creating, opening, or preparing PRs for review.
Path: `C:\Users\Danie\.config\opencode\skills\branch-pr\SKILL.md`

- Every PR must link an approved issue and include exactly one `type:*` label.
- Branch names must match `^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)/[a-z0-9._-]+$`.
- Use conventional commits only, with no `Co-Authored-By` trailers.
- PR body must include issue link, type, summary, changes table, test plan, and checklist.
- Automated checks must pass before merge.

### chained-pr

Trigger: PRs over 400 lines, stacked PRs, review slices.
Path: `C:\Users\Danie\.config\opencode\skills\chained-pr\SKILL.md`

- Split PRs over 400 changed lines unless a maintainer explicitly accepts `size:exception`.
- Keep each PR to one deliverable work unit with tests/docs included.
- Use stacked PRs when slices can land independently; use a tracker branch when the feature must integrate before main.
- Every child PR needs start/end scope, dependencies, out-of-scope items, and a dependency diagram marking current PR.
- Treat polluted diffs as base bugs and retarget or rebase until clean.

### cognitive-doc-design

Trigger: writing guides, READMEs, RFCs, onboarding, architecture, or review-facing docs.
Path: `C:\Users\Danie\.config\opencode\skills\cognitive-doc-design\SKILL.md`

- Lead with the answer, then add context through progressive disclosure.
- Chunk information into small sections with clear headings and signposts.
- Prefer tables, checklists, examples, and templates over prose that requires recall.
- For PR/review docs, state review order, out-of-scope work, and acceptance criteria.
- Keep documentation focused on decisions and verification paths.

### comment-writer

Trigger: PR feedback, issue replies, reviews, Slack messages, or GitHub comments.
Path: `C:\Users\Danie\.config\opencode\skills\comment-writer\SKILL.md`

- Start with the actionable point; avoid long recaps.
- Be warm, direct, and useful in 1 to 3 short paragraphs or tight bullets.
- Explain the technical reason when asking for a change.
- Comment on the highest-value issue instead of piling on preferences.
- Match the thread language; Spanish should use natural Rioplatense voseo.

### go-testing

Trigger: Go tests, go test coverage, Bubbletea teatest, golden files.
Path: `C:\Users\Danie\.config\opencode\skills\go-testing\SKILL.md`

- Prefer table-driven tests with `t.Run` for multiple cases.
- Test behavior and state transitions, not implementation trivia.
- Use `t.TempDir()` for filesystem tests and small interfaces around external boundaries.
- Keep slow or external integration tests skippable with `testing.Short()`.
- Golden files must be deterministic and updated only through the repo update path.

### issue-creation

Trigger: creating GitHub issues, bug reports, or feature requests.
Path: `C:\Users\Danie\.config\opencode\skills\issue-creation\SKILL.md`

- Search existing issues before creating a new one.
- Use the correct issue template; blank issues are disabled.
- Every issue starts as `status:needs-review`; maintainers must add `status:approved` before a PR.
- Questions belong in Discussions, not issues.
- Fill all required template fields and pre-flight checks.

### judgment-day

Trigger: judgment day, dual review, adversarial review, juzgar.
Path: `C:\Users\Danie\.config\opencode\skills\judgment-day\SKILL.md`

- Use only when explicitly requested for a specific target.
- Resolve project skills before judging and inject the same project standards into all judge/fix prompts.
- Run two blind judges in parallel and synthesize only after both finish.
- Ask before fixing Round 1 confirmed issues; re-judge after fixes.
- Terminal states are only `JUDGMENT: APPROVED` or `JUDGMENT: ESCALATED`.

### skill-creator

Trigger: new skills, agent instructions, documenting AI usage patterns.
Path: `C:\Users\Danie\.config\opencode\skills\skill-creator\SKILL.md`

- Create skills only for reusable AI guidance, not trivial one-off docs.
- A skill is a runtime instruction contract, not a tutorial.
- Required frontmatter includes `name`, one-line quoted `description`, `license`, and metadata.
- Keep `SKILL.md` concise; move examples, schemas, and edge cases into local assets or references.
- Register project skills in `AGENTS.md` when they are created.

### work-unit-commits

Trigger: implementation, commit splitting, chained PRs, or keeping tests and docs with code.
Path: `C:\Users\Danie\.config\opencode\skills\work-unit-commits\SKILL.md`

- A commit should represent one deliverable behavior, fix, migration, or docs unit.
- Do not split commits by file type when no commit works alone.
- Keep tests with the code and docs with the user-visible change.
- Each commit should tell a clear story and remain a possible PR slice.
- If SDD forecasts a PR over 400 lines, plan chained PR slices before implementation.
