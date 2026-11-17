# Find the file that changed and read its diff

## Who

A greppa user.

## Goal

Find the file that changed and read its diff.

## Test

By hand, in the `direction-v7-focus-border-files` scene. The scene shows fixed review data, so the
steps check visible results, not a saved review.

## Steps

1. Open the scene. The file list shows the changed files, and the first file's diff is open.
2. Click `crates/greppa-core/src/git.rs` in the file list. Its diff opens, and the row is selected.
3. Click the first comment in the comments panel. The diff jumps to the commented line.
4. Click the folder-tree toggle in the file list toolbar. The files group under folders.
5. Expand `crates/greppa-core/tests`. Its files show.
6. Collapse `crates/greppa-core/tests`. Its files hide.

## End state

The tester names the file they opened and the comment they read.
