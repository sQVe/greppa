---
'@greppa/web': patch
---

Fix per-file commit selection edge cases:

- `/commits` route now preserves file-only selections — previously a state with `commitFile` but no
  `commits` would redirect to `/changes`.
- Expanded commits with no files retain their selection highlight instead of disappearing.
- Replace racy time-based pointer suppression with a deterministic boolean flag cleared on the next
  microtask.
