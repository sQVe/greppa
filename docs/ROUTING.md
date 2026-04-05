# Routing design

> **Note:** This document describes a proposed/future routing model. The current implementation uses
> `/file/$` and `/wt/$` routes with commit selection handled in React state.

## URL structure

Single `/review` route with search params for all selection state. `/` redirects to `/review`. View
mode is inferred from which param is present — `file`, `wt`, and `commits` are mutually exclusive.
Switching source clears the previous selection.

```text
/review                                             landing, no selection
/review?file=src/App.tsx                            single committed file
/review?wt=src/hooks/useAuth.ts                     single worktree file
/review?file=src/a.ts&file=src/b.ts                 multi committed files
/review?wt=src/a.ts&wt=src/b.ts                     multi worktree files
/review?file=*                                      all committed files
/review?wt=*                                        all worktree files
/review?commits=afd970d                             single commit
/review?commits=afd970d&commits=7a6547b             discrete commits (cmd+click)
/review?commits=afd970d..7a6547b                    continuous range (shift+click)
```

## Scroll target

Hash fragment encodes the file to scroll into view within a stacked diff. Optional line anchor with
`:L{n}`.

```text
/review?file=src/a.ts&file=src/b.ts#src/b.ts        scroll to b.ts
/review?file=src/a.ts&file=src/b.ts#src/b.ts:L42    scroll to line 42 of b.ts
```

## Commit params

- Repeated `commits` params = discrete selection (cmd+click). Each SHA is individually selected.
- Single `commits` param with `..` = continuous range (shift+click). All commits between the two
  endpoints.

```text
?commits=abc123&commits=def456       exactly these 2 commits
?commits=abc123..def456              all commits from abc123 to def456
```

## Select-all sentinel

`?file=*` and `?wt=*` mean "all files in that section." Resolves dynamically at page load against
the current ref pair. If the diff set changes (new push, rebase), the file list reflects the current
state.

For a frozen selection, use explicit file params.

## Derived state

The file tree panel section (changes, worktree, commits) is derived from which search param is
present — no extra URL param needed.

| Param present | Expanded section               |
| ------------- | ------------------------------ |
| `file`        | Changes                        |
| `wt`          | Working tree                   |
| `commits`     | Commits                        |
| none          | Default (changes if available) |

## When the URL updates

A history entry represents a new intent. Refining the current selection (multi-select toggles, range
extensions) replaces the current entry.

| Action                                    | URL change                   | History method |
| ----------------------------------------- | ---------------------------- | -------------- |
| Click file (single select)                | `?file=path`                 | pushState      |
| Cmd+click (multi-select toggle)           | `?file=a&file=b`             | replaceState   |
| Shift+click (range select)                | `?file=a&file=b&file=c`      | replaceState   |
| Click section header (select all)         | `?file=*`                    | replaceState   |
| Switch source (e.g. committed → worktree) | `?wt=path` (clears `file`)   | pushState      |
| Click commit                              | `?commits=sha`               | pushState      |
| Shift+click commit (range)                | `?commits=sha1..sha2`        | replaceState   |
| Cmd+click commit (discrete toggle)        | `?commits=sha1&commits=sha2` | replaceState   |
| Click minimap segment                     | `#filepath`                  | replaceState   |
| Scroll past file boundary                 | no URL change                | —              |
| Page load with `#target`                  | scroll to file after render  | —              |

## Scroll behavior

URL drives scroll, never the reverse.

- Scrolling through stacked diffs does not touch the URL.
- Minimap clicks and file tree clicks update the hash via `replaceState`.
- On page load, if a hash fragment is present, `StackedDiffViewer.scrollToFile` runs after diffs
  render.
- `activeFilePath` (from IntersectionObserver) highlights the file tree visually — React state only,
  not URL state.

## TanStack Router implementation

Single route with validated search params:

```typescript
import { zodValidator, fallback } from '@tanstack/zod-adapter';
import { z } from 'zod';

const reviewSearch = z.object({
  file: fallback(z.array(z.string()), []).default([]),
  wt: fallback(z.array(z.string()), []).default([]),
  commits: fallback(z.array(z.string()), []).default([]),
});

const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/review',
  validateSearch: zodValidator(reviewSearch),
});
```

Read with `Route.useSearch()`. Update with:

```typescript
navigate({ search: (prev) => ({ ...prev, file: updatedPaths }), replace: true });
```

Hash managed outside the router via `window.history.replaceState` — TanStack Router does not manage
fragments.

## Migration

Redirect old routes to the new scheme:

```text
/                              →  /review
/file/src/utils/parse.ts       →  /review?file=src%2Futils%2Fparse.ts
/wt/src/hooks/useAuth.ts       →  /review?wt=src%2Fhooks%2FuseAuth.ts
```

## Future considerations

Ref pair (`base`/`head`) is currently set at server start via CLI args. When greppa supports
switching between repos, PRs, or comparisons within a running app, the ref pair should move into the
URL (e.g., `?base=main&head=feat/foo`).
