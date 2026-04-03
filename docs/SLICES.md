# Greppa — dogfooding roadmap

Five thin vertical slices, ordered to reach daily self-use as fast as possible. Each slice is a
shippable increment that makes the tool more useful for reviewing diffs within the Greppa project
itself.

## Current state

**Working:** CLI `greppa serve`, file listing between refs, per-file diff retrieval, FileTree
(virtualized, directory compaction), DiffViewer (virtualized, char-level Shiki highlighting in web
worker), DetailPanel with tabs, StatusBar, TanStack Router with URL-synced file selection,
constrained text selection, localStorage persistence for review state and preferences, hunk keyboard
nav (`j`/`k`/`n`/`p`).

**Missing:** Comments (read-only fixture display only), review sessions, keyboard file navigation,
inline comment markers, SQLite persistence.

---

## Slice 1: Review any diff (done)

**Goal:** Run `greppa serve [old-ref] [new-ref]` and review that diff in the browser.

| Deliverable              | Detail                                                                            |
| ------------------------ | --------------------------------------------------------------------------------- |
| CLI positional args      | `serve.ts` accepts `[old-ref]` and `[new-ref]`, defaults to default branch + HEAD |
| Merge-base semantics     | Diffs use `git merge-base` so only branch-introduced changes are shown            |
| `GET /api/refs` endpoint | Returns the resolved `{ oldRef, newRef }` pair                                    |
| `useRefs` hook           | Fetches once at startup, `staleTime: Infinity`                                    |
| `App.tsx` wiring         | Refs flow from hook through file list and diff content queries                    |

**Not included:** No in-browser ref switching (that's slice 3). Restart server to change refs.

### Implementation order

1. `GitService.resolveRef` method (`git rev-parse --verify`) + test
2. `RefsApi` endpoint + Http handler + integration test
3. CLI positional argument parsing + test
4. `useRefs` hook + test
5. `App.tsx` wiring (remove hardcoded refs)

---

## Slice 2: Navigate like an editor

**Goal:** Move between files with `]`/`[`, mark reviewed with `e`, never touch the mouse.

| Deliverable                  | Detail                                                       |
| ---------------------------- | ------------------------------------------------------------ |
| `useFileNavigation` hook     | `]`/`[` next/prev file, `e` toggle reviewed, skips in inputs |
| FileTree reviewed indicators | Checkmark or dim for reviewed files                          |
| StatusBar position           | "File 5 of 17 · 3 reviewed"                                  |
| Auto-scroll tree             | Selected file scrolls into view on keyboard nav              |

**Not included:** No file search/filter, no smart ordering, no file-level verdicts beyond
reviewed/unreviewed.

**Why second:** File navigation is the most frequent action in review — far more than commenting.
Making it keyboard-driven aligns the tool with the "editor as metaphor" principle.

### Implementation order

1. `useFileNavigation` hook + tests (unit tests against a flat file list)
2. FileTree reviewed-status indicators + test
3. StatusBar position indicator + test
4. `App.tsx` wiring

---

## Slice 3: In-browser ref selector

**Goal:** Switch comparisons without restarting the server.

| Deliverable             | Detail                                                    |
| ----------------------- | --------------------------------------------------------- |
| `GitService.listRefs`   | `git for-each-ref` for branches + tags                    |
| `GET /api/refs/list`    | Returns available refs                                    |
| `RefSelector` component | Combobox in Header (Radix Popover + input), two instances |
| URL-synced refs         | `oldRef`/`newRef` as route search params                  |

**Not included:** No session management, no merge-base resolution. Review state keyed by
`${oldRef}:${newRef}` in localStorage.

### Implementation order

1. `GitService.listRefs` + test
2. `RefsApi` list endpoint + integration test
3. Router search params for refs
4. `RefSelector` component + test
5. Header integration + App wiring

---

## Slice 4: Inline notes

**Goal:** Click a gutter line or press `c` to leave a note. localStorage persistence.

| Deliverable           | Detail                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `useNotes` store      | `createPersistedStore` keyed by ref pair, stores `{ filePath, lineNumber, body, timestamp }` |
| Gutter click handler  | `+` button on hover, opens inline textarea                                                   |
| `c` keyboard shortcut | Opens note at currently focused line                                                         |
| Inline note rendering | New `VirtualItem` kind in `buildVirtualItems`, rendered between diff rows                    |
| DetailPanel wiring    | `CommentsContent` reads from `useNotes` instead of fixtures                                  |

**Not included:** No threading, no replies, no resolution status, no AST anchoring, no GitHub sync.
Just sticky notes.

### Implementation order

1. `useNotes` hook + schema + tests
2. Gutter action component + test
3. Inline note form component + test
4. Inline note display component + test
5. `buildVirtualItems` extension for note/form rows + tests
6. DiffViewer rendering integration
7. DetailPanel wiring to live note store

---

## Slice 5: SQLite persistence

**Goal:** Notes and review state survive server restarts and browser clears.

| Deliverable                  | Detail                                                |
| ---------------------------- | ----------------------------------------------------- |
| `@effect/sql-sqlite-node`    | `Sql.ts` with WAL mode, `DB_PATH` from env            |
| Migration `001_sessions.sql` | Tables: `review_sessions`, `review_files`, `comments` |
| Session + Comment APIs       | CRUD endpoints following existing Api/Http pattern    |
| Frontend migration           | Hooks switch from localStorage to API calls           |

**Not included:** No GitHub sync, no AST-anchored comments, no multi-user.

### Implementation order

1. `Sql.ts` layer + migration file
2. Session repository + service + tests
3. Session API endpoints + integration tests
4. Comment API endpoints + integration tests
5. Frontend hook migration (notes → API)
6. Frontend hook migration (review state → API)

---

## Technical decisions

| Decision                          | Recommendation                              | Rationale                                                           |
| --------------------------------- | ------------------------------------------- | ------------------------------------------------------------------- |
| Skip SQLite until slice 5         | localStorage sufficient for slices 1–4      | `createPersistedStore` pattern already proven, defer complexity     |
| Line-number anchoring for notes   | Skip tree-sitter for now                    | Good enough for self-review, notes break on rebase (acceptable)     |
| Text input for refs in slice 1    | Handles SHAs, tags, `HEAD~3`, any valid ref | No extra API needed, upgrade to combobox in slice 3                 |
| No auth                           | Single-user local tool                      | Never needed for local-first architecture                           |
| Design note store as an interface | `getNotesForFile`, `addNote` etc.           | Makes localStorage → SQLite migration a backend swap, not a rewrite |

## Risk to watch

**Effect v4 beta + `@effect/sql-sqlite-node` compatibility.** Before committing to slice 5,
spike-test an in-memory SQLite DB with a migration and tagged-template query to validate the
integration surface.

## After slice 4

Pick any comparison via CLI or UI, keyboard-navigate files, read diffs with full syntax
highlighting, and annotate anything worth noting. That's a complete self-review workflow — enough to
use daily on Greppa's own PRs. Slice 5 makes it durable.
