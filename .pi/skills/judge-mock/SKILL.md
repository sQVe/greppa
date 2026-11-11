---
name: judge-mock
description:
  Judge one greppa UI mock scene, or a real app view, with two AI judges. Use when a mock or an
  app view needs a pass or fail decision on its look, clarity, or task fit, or when the user asks
  to judge, review, or gate a mock.
---

# Judge a mock

Two AI judges review one mock and list findings. The session applies the pass rule to their answers.
Judges give no scores.

Use scope `scene` for a mock scene built from real greppa UI parts with fake data. Use scope `app`
for a real app view.

Keep each round's files in `.tau/judge/<mock>/`. Git ignores that folder.

Capture uses ruta. Install it before the first round:

```sh
cargo install --git https://github.com/sQVe/ruta --tag v0.2.0 --locked ruta
```

`RUTA_NAME=<name>` selects a separate sandbox at `/var/tmp/ruta-<name>`.
After building the scene binary, you may also run ruta directly from the workspace root.
See [the development guide](../../../docs/development.md#sandbox) for the sandbox tools.

## Steps

1. Run the check and save its output:

   ```sh
   mkdir -p .tau/judge/<mock>
   cargo xtask check > .tau/judge/<mock>/check.txt 2>&1
   ```

   If the check fails, stop the round. Fix the failures first. No judge can overrule a failing
   check.

2. Capture the scene for scope `scene`:

   ```sh
   cargo xtask mock capture <mock>
   ```

   The command builds and validates the scene, removes stale capture files, and calls
   `ruta capture --out .tau/judge/<mock> -- <mock>`. ruta opens the scene on a private headless
   display and writes `shot.png`, `crop.png`, and `capture.json` there. The crop is exactly the
   scene panel, and the full shot gives the neighboring context. ruta stops the capture's scene
   and display without stopping a running interactive sandbox.

   Scope `app` has no capture command yet. Once real views exist, capture them the same way: the
   app draws the view at the fixed scene origin and size, and `cargo xtask mock capture` grabs the
   window. State the missing capture in the packet until then.

3. For scope `scene`, read the shot's pixel size and `crop.geometry` (`<w>x<h>+<x>+<y>`) from
   `.tau/judge/<mock>/capture.json`.

4. Write `.tau/judge/<mock>/context.md` with:
   - The scope, the component name, and the input mode.
   - The shot's pixel size and the crop box in shot pixels.
   - The tasks for the part, one short line each. Write what a user does on the surface, such as
     "Find the file that changed."

   Keep every line neutral. Do not name a state, a defect, or an expected result; the judges find
   those in the images.

5. Launch two fresh subagents in the same turn. Use the `subagent` tool with the `scout` profile.
   Give both the same task:
   - Model `openai/gpt-6.1-sol` for one subagent, with answer path `.tau/judge/<mock>/gpt.md`.
   - Model `claude-bridge/claude-opus-5-5` for the other, with answer path
     `.tau/judge/<mock>/opus.md`.

   The task gives these paths and nothing else:
   - `.pi/skills/judge-mock/judge.md`, the judge instructions.
   - `.tau/judge/<mock>/context.md`.
   - `.tau/judge/<mock>/shot.png`, the full shot.
   - `.tau/judge/<mock>/crop.png`, the crop.
   - `.tau/judge/<mock>/check.txt`, the check output.
   - The scope, `scene` or `app`, and the answer path.

   The task tells the subagent to follow the judge instructions, write its answer to its answer path
   with no other text in the file, and name that path in its report. Never give a judge this
   `SKILL.md`: its Smoke test section holds the expected verdicts.

6. Apply the pass rule to both answers. Read each answer's findings and hard failures in full:

   A mock passes when all three hold:
   - `cargo xtask check` passed in step 1.
   - Neither judge lists a finding of severity 2 or higher.
   - Neither judge lists a hard failure.

   Otherwise the mock fails. A verdict line that disagrees with the rule does not change the result.

7. If either answer has a `needs evidence` verdict, add the evidence it names to the packet, launch
   two fresh judges as in step 5, and apply the pass rule again before you report. Missing evidence
   listed beside a `pass` or `fail` verdict, such as states a still image cannot show, does not
   start a new round.

8. Report the result:
   - On pass, report pass.
   - On fail, report each judge's findings of severity 2 or higher and each hard failure, with the
     location and suggested fix.

9. After the mock changes, start a new round at step 1 with a new shot and crop. In a later round,
   check which earlier findings are fixed. Do this check yourself, in the session, and do not tell
   the judges.

## Rules

- Never show a judge the other judge's answer, an earlier verdict, or an earlier finding.
- Use fresh subagents for every round. Do not reuse a judge's earlier answer.
- Do not edit an answer file by hand. If a file is invalid, have that judge answer again in a fresh
  subagent.
- Do not edit `judge.md` in a round.

## Smoke test

Four scenes in `greppa-ui` check this procedure. Run them with
`cargo xtask mock capture smoke-N` and judge each one as a normal round in `.tau/judge/smoke-N/`.
Each scene must give the expected verdict below. The expected verdicts follow from each scene's
design. They are not results from a judge run.

| Scene     | Expected verdict | Design                                                     |
| --------- | ---------------- | ---------------------------------------------------------- |
| `smoke-1` | fail             | No section header, and no row is selected.                 |
| `smoke-2` | pass             | Clean: a section header, a selected first row, all labels. |
| `smoke-3` | fail             | Every file label is blank.                                 |
| `smoke-4` | pass             | One row is a little shorter than its neighbors.            |

Run the smoke test again when a judge model, `judge.md`, or what step 5 gives the judges changes.
