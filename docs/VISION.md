# Greppa — project vision

*Swedish: "greppa" — to grasp, to grip. Also: grep + a.*

## One-liner

A local-first code review tool built for PRs that GitHub can't handle — and for changes that aren't PRs yet. Comments that survive rebases, real session management, and git history insights that give you context a diff alone never could.

## Name and identity

**Greppa** (greppa.dev). Swedish for "to grasp" — as in grasping a changeset. The `grep` prefix gives it instant developer recognition. Available on npm, GitHub, and all major domain TLDs.

- npm: `greppa` and `@greppa/*`
- GitHub: github.com/greppa
- Domain: greppa.dev
- CLI: `npx greppa serve`, `greppa review`, `greppa diff main..feature`

## Why this exists

GitHub's review UI works fine for small, everyday PRs. It falls apart for anything ambitious. Large PRs hit file limits, eat memory, and render so slowly that reviewers skim instead of reviewing. Comments anchor to line numbers and disappear on rebase. There's no concept of a review session — no progress tracking, no way to pick up where you left off. And the diff shows you what changed with zero context about the history of the code you're looking at.

Greppa is for the PRs that matter most: the big ones, the complex ones, the ones where understanding the change is harder than reading the diff. And for changes that aren't PRs yet — LLM-generated code, work-in-progress branches, early feedback rounds — where GitHub has nothing to offer at all.

## Core value propositions

### 1. Performance on large PRs

The primary hook. GitHub chokes on large changesets — file count limits, memory bloat, server timeouts. Greppa runs locally against the actual repo on disk, so:

- Diffs are computed locally via git, no API limits or payload caps
- Files are diffed on demand, not all at once
- Virtualized rendering means DOM size is constant regardless of diff size
- Background indexing pre-caches diffs while you review

A 500-file PR should load as fast as a 5-file PR.

### 2. Comments that survive rebases

Comments anchor to AST nodes, not line numbers. Force-push, rebase, squash — comments follow the code they're attached to. When AST parsing isn't available (unsupported language, malformed file), a content-hash fallback with fuzzy matching provides best-effort relocation.

### 3. Review as a first-class workflow

GitHub treats review as a side effect of a PR. Greppa treats it as an activity:

- Session state: "I reviewed files A through D, left 3 comments, still need to look at the tests." Pick up where you left off across sessions.
- Per-file progress tracking: which files you've viewed, how far you scrolled, when you last looked at each one.
- Review status lifecycle: draft, active, resolved per comment. Overall review progress visible at a glance.
- Review verdicts: approve, request changes, or comment-only. Syncs to GitHub as a proper review submission, not just scattered comments.
- Suggested changes: propose edits inline that the author can preview as an applied diff and commit directly. GitHub supports this but the UX is clunky. Locally, you can show the suggestion as a real before/after diff before it's accepted.

### 4. Git history insights

A diff shows what changed. Git history shows why the code looks the way it does:

- Change frequency: how often this file or function has been modified recently. Hot files deserve more scrutiny.
- Authorship: who last touched this code, and when. Useful context for understanding intent.
- Related PRs: the last N pull requests that touched the same files. What happened here before?

All computed from git log. No external services, no language-specific tooling, no setup. Instant context from data that's already on disk.

### 5. Review anything, not just PRs

GitHub only knows about PRs. Greppa can review any diff between any two refs, including changes that haven't been committed or pushed yet:

- Reviewing LLM-generated changes (Claude Code, Copilot agents) before committing. The agent made 40 changes across 15 files — understand what it did before you accept it.
- Reviewing your own work-in-progress before opening a PR.
- Reviewing a colleague's branch before it's PR-ready, for early informal feedback.

All other features still apply: AST-anchored comments, progress tracking, git history insights. The only difference is there's no GitHub sync target yet, which is fine.

### 6. Code navigation without leaving the review

Reviewing is understanding, and understanding means following references. On GitHub, you see a function changed but have no idea who calls it, what the types are, or where it's imported from. You'd have to switch to your editor to look it up, breaking your review flow completely.

A side panel that works like a peek view: click a symbol, see its definition, call sites, type signature. Navigate the codebase without ever leaving the diff.

- Tree-sitter as the baseline: runs locally, fast, no setup, supports dozens of languages. Gives you symbol extraction, scope analysis, and basic find-usages across the repo. Covers most of what you need in a review context.
- Optional LSP integration: if the user has a language server running (most devs do in their editor), connect to it for richer data — accurate cross-file references, type inference, module-aware go-to-definition. An upgrade layer, not a requirement.

## Design principles

Greppa should actively reduce the cognitive load of reviewing. Every interaction should make reviewing easier, not add friction. In a world where AI agents generate increasingly large changesets, the review step is becoming more frequent and more important. The tool should never work against the reviewer.

- **Triage before you dive in.** Before reading a single line, understand the shape of the change. How many files, what types of changes, what's risky vs. routine. Auto-categorize: logic changes vs. refactors vs. config vs. tests vs. generated files.
- **Smart file ordering.** Not alphabetical. Order by review priority: logic changes first, then tests, then config, then generated/mechanical changes. Files with high change frequency get surfaced higher.
- **Collapse the noise.** Rename-only changes, import reordering, formatting, lockfile updates, generated code. Dim them, collapse them, let the reviewer bulk-approve them with one action.
- **Keyboard-first navigation.** j/k between files, n/p between hunks, c to comment, a to approve a file, s to skip. Never reach for the mouse during a review.
- **File-level verdicts.** Mark a file as "looks good," "needs changes," or "skipped" independently. Your progress is visible. You know exactly what's left.
- **Sticky context.** When you're deep in a long file, the function name or class you're inside stays visible. No scrolling up to remember where you are.
- **One-action review completion.** When you've been through every file, submitting the review should be one keystroke. Not a modal, not a dropdown, not a confirmation dialog.

## What this is not

- Not a GitHub replacement. For PRs, reviews sync bidirectionally with GitHub — Greppa is a better interface to the same workflow. For non-PR reviews, it's a standalone tool.
- Not an AI product. AI could be an opt-in feature later, but the core value is deterministic analysis and thoughtful UX.
- Not an editor extension. It's a focused environment for the review activity.

## Architecture

### Local-first, web server model

The CLI starts a local HTTP + WebSocket server. The UI runs in a browser at localhost. This gives:

- Full filesystem and git access through the server
- Real web tech (websockets, modern rendering) with no framework constraints
- Offline by default
- Zero install friction — install the CLI, run `greppa serve`, open a browser
- Desktop wrapper (Electron, Tauri, etc.) can be added later without rewriting anything

### All TypeScript

Server, CLI, and frontend share a language. Shared types, shared logic.

- `packages/core` — diff parsing, content anchoring, AST operations, git interface
- `packages/server` — local HTTP + WebSocket server
- `packages/cli` — thin CLI layer, starts the server
- `packages/web` — the frontend, diff viewer, interactive UI

### Storage

SQLite via better-sqlite3. Needed for tracking sync state, conflict resolution, comment threading, and ID mapping between local and GitHub. Single portable file, fast queries, WAL mode for concurrent reads.

### GitHub sync

Full two-way. Comments start local, push to GitHub when ready. Pull new comments from GitHub. Sync event log for conflict resolution and retry logic.

## Open questions

- Tree-sitter integration: which bindings? node-tree-sitter vs. web-tree-sitter? How to handle grammar loading for many languages?
- LSP connection: how to discover and connect to an already-running language server? What's the protocol for optional upgrade?
- Diff viewer UX: side-by-side, unified, or both? What makes it feel fast and good?
- How is the file list organized? By directory? By change type? By review status?
- CLI distribution: npx, standalone binary via pkg, or both?
- CLI interface for non-PR reviews: `greppa diff main..feature-branch`? `greppa diff HEAD`? How does this interact with uncommitted/staged changes?

## Future possibilities (not in scope for v1)

- Real-time collaborative review: shared cursors, live annotations, presence. Natural extension of the websocket architecture but a large engineering effort.
- Call graph overlay: see callers/callees of changed functions. Requires language-specific static analysis tooling.
- Test coverage mapping: surface which tests cover changed lines. Requires parsing coverage reports from various CI formats.
- AI-assisted review: opt-in explanations, pattern matching against past bugs. A feature, not the foundation.
- Canvas/spatial view: visualize the PR as a 2D space with files as nodes. Compelling concept but a project in itself.
