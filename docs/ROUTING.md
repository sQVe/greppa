# Routing design

## URL structure

Section-specific routes derive the active panel from the path. Selection state is persisted behind a
short `s=<id>` handle backed by a client cache and server store. The `file`, `wt`, and `commits`
params are mutually exclusive across routes.

```text
/changes                        landing, no selection
/changes?s=Ab1x                 committed file selection (resolved from state id)
/worktree?s=Cd2y                worktree file selection
/commits?s=Ef3z                 commit selection
```

Legacy `/review` URLs redirect to the appropriate section route via `sectionForState`.

## State persistence

Selection state is too large for comfortable URLs, so it's compressed into a short id:

1. Client generates a `nanoid(4)` id.
2. State is cached in-memory (`stateCache`) and posted to `POST /api/state`.
3. URL shows only `?s=<id>`.
4. On navigation, `beforeLoad` resolves the id from cache or `GET /api/state/:id`.

`findExistingId` deduplicates identical states via a reverse cache lookup.

## Scroll target

Hash fragment encodes the file to scroll into view within a stacked diff. Optional line anchor with
`:L{n}`.

```text
/changes?s=Ab1x#src/b.ts          scroll to b.ts
/changes?s=Ab1x#src/b.ts:L42      scroll to line 42 of b.ts
```

Hash is managed through the router via `navigate({ hash })`.

## Select-all sentinel

`?file=*` and `?wt=*` mean "all files in that section." Resolves dynamically at page load against
the current ref pair. Directory selections use explicit paths; only the section-level "select all"
uses the `*` sentinel.

## Derived state

The active file tree section is derived from the current route path.

| Route       | Expanded section |
| ----------- | ---------------- |
| `/changes`  | Changes          |
| `/worktree` | Working tree     |
| `/commits`  | Commits          |

## When the URL updates

A history entry represents a new intent. Refining the current selection (multi-select toggles, range
extensions) replaces the current entry.

| Action                                     | URL change         | History method |
| ------------------------------------------ | ------------------ | -------------- |
| Click file (single select)                 | `/changes?s=<id>`  | pushState      |
| Cmd+click (multi-select toggle)            | `/changes?s=<id>`  | replaceState   |
| Shift+click (range select)                 | `/changes?s=<id>`  | replaceState   |
| Click section header (select all)          | `/changes?s=<id>`  | replaceState   |
| Switch source (e.g. committed -> worktree) | `/worktree?s=<id>` | pushState      |
| Click commit                               | `/commits?s=<id>`  | pushState      |
| Shift+click commit (range)                 | `/commits?s=<id>`  | replaceState   |
| Cmd+click commit (discrete toggle)         | `/commits?s=<id>`  | replaceState   |
| Scroll past file boundary                  | no URL change      | -              |
| Page load with `#target`                   | scroll to file     | -              |

## Scroll behavior

URL drives scroll, never the reverse.

- Scrolling through stacked diffs does not touch the URL.
- File tree clicks set the hash via `navigate({ hash })`.
- On page load or hash change, `useHashScroll` scrolls to the target after diffs render.
- `activeFilePath` (from IntersectionObserver) highlights the file tree visually -- React state
  only, not URL state.

## TanStack Router implementation

Section-specific routes with validated search params:

```typescript
import { zodValidator, fallback } from '@tanstack/zod-adapter';
import { z } from 'zod';

const changesSearch = z.object({
  s: fallback(z.string(), '').default(''),
  file: fallback(z.array(z.string()), []).default([]),
});

const changesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/changes',
  validateSearch: zodValidator(changesSearch),
  beforeLoad: async ({ search }) => {
    if (!search.s || search.file.length > 0) {
      return;
    }
    const state = await resolveState(search.s);
    // redirect to correct section if state belongs elsewhere
  },
});
```

Read with `Route.useSearch()`. Update via `navigateWithState` which handles state caching and
routing.

## Migration

Redirect old routes to the new scheme:

```text
/                              ->  /changes
/review?s=Ab1x                 ->  /changes?s=Ab1x (or appropriate section)
/file/src/utils/parse.ts       ->  /changes?file=src/utils/parse.ts
/wt/src/hooks/useAuth.ts       ->  /worktree?wt=src/hooks/useAuth.ts
```

## Future considerations

Ref pair (`base`/`head`) is currently set at server start via CLI args. When greppa supports
switching between repos, PRs, or comparisons within a running app, the ref pair should move into the
URL (e.g., `?base=main&head=feat/foo`).
