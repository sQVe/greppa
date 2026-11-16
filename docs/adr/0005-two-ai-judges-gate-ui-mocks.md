# ADR 0005: Two AI judges from different model families gate UI mocks

**Date**: 2026-11-04\
**Status**: Accepted\
**Related**: [Judge skill](../../.pi/skills/judge-mock/SKILL.md)

## Context

greppa's UI is designed in mocks before it is built. Each mock needs a fixed way to decide whether
it is good enough. Without one, the result depends on taste in the moment, and two reviews of the
same mock can disagree.

A scene built from real greppa UI parts shows the visual and clarity parts of a design. It cannot
show how the real view handles the keyboard, a narrow window, or an error. Those parts need the real
view.

Some faults are easier to check than to judge. Contrast, sizes, and color values are examples. Model
judges read these values poorly, so `cargo xtask check` tests them before any judge runs.

Model judges also agree with people less on small differences, so one judge's view of a minor issue
is not reliable on its own. One lenient judge could pass a weak mock.

The judges need an image of the scene. GPUI's test platform draws no pixels, so a capture needs a
real GPUI window. Opening it on the developer's desktop would take over the screen and the input.

## Decision

Mocks are scenes built from real greppa UI parts with fake data, and two AI judges from different
model families gate them. A mock passes only when `cargo xtask check` passes, and neither judge
reports a finding of severity 2 or higher or an open hard failure.

The judges are `openai/gpt-6.1-sol` and `claude-opus-5-5`. They come from different model families,
so they share fewer blind spots. Each judge works alone and does not see the other judge's answer. A
project skill runs each round and holds the procedure, so the procedure can change without code.

### Mocks

- A scene uses greppa's real UI parts and fake data. Scenes live in `greppa-ui`, and a separate
  scene binary opens one by name, so mocks stay out of the app.
- `cargo xtask mock capture <scene>` builds and validates the scene, then calls the installed ruta
  CLI for a private headless GPUI window, a full shot, and a crop of exactly the scene.
  ruta owns display isolation and teardown, so greppa does not keep a second capture implementation.
  It never uses the developer's display or input. Capture runs on Linux only; CI checks its output
  files. See [the sandbox decision](./0009-qa-in-a-private-xwayland-sandbox.md) and
  [the setup commands](../development.md#sandbox).
- The judges see the shot, the crop, and the `cargo xtask check` result.

### Theme values

- App-wide sizes, spacing, radii, text sizes, and colors come from `greppa-ui`'s theme module.
- Visual-direction scenes keep their values under `crates/greppa-ui/src/scenes/directions/`.
  This isolates reference designs from the app-wide theme. The raw-value check exempts all code
  under that directory and `theme.rs`, and rejects raw values elsewhere in `greppa-ui`.
- Contrast tests compute WCAG 2.2 AA ratios for the app theme and direction scenes.
  Direction UI text, muted text, and plain code on diff backgrounds need 4.5:1;
  status marks and controls need 3:1. Direction tests have no known-failure allowance.
- Syntax tokens in direction scenes keep the published Catppuccin Latte colors and are exempt
  from the text contrast threshold. This exception does not apply to UI text or plain code.

### Findings

- Each judge gives findings only, with no scores.
- Each finding has a severity from 0 to 4 on Nielsen's scale, and it names one category.
- A finding of severity 2 or higher fails the mock. Severity 0 and 1 findings do not.
- Missing evidence does not fail the mock. When a judge cannot decide, it answers `needs evidence`,
  and the session supplies what it lacked and judges again, so a gap in the packet leads to a better
  packet, not a failed mock. Missing evidence listed beside a pass or fail, such as states a still
  image cannot show, starts no new round.

### Categories

- A scene is judged on the first eight categories: visual hierarchy, typography, spacing, and
  density, visual consistency, polish, information architecture, discoverability and affordances,
  feedback and state visibility, and task fit.
- A real view is judged on all twelve. The four usability categories are efficiency, control and
  error recovery, accessibility and input, and adaptability. They are judged only on the real view,
  because a scene cannot show them.

### Hard failures

A hard failure fails the mock on its own, whatever the findings. There are five kinds:

- `contrast`: text or control contrast below WCAG 2.2 AA, except syntax tokens in direction
  scenes. It comes from `cargo xtask check`. The app theme's current failing pairs are known
  failures, which pass until a theme change fixes them. A new failing pair, or a listed pair that
  starts to pass, fails the check. Direction contrast tests have no known-failure allowance.
- `rawValue`: a raw size, radius, text size, or color outside the theme module and
  `scenes/directions/`. The exemption covers all code under that directory, not only token files.
  It comes from `cargo xtask check`.
- `hiddenTaskInformation`: information the task needs is hidden or absent. The judges flag it.
- `unclearFocusOrMode`: the user cannot tell which pane has focus or which mode is active. The
  judges flag it.
- `unreadableText`: required text cannot be read at the native display scale. The judges flag it.

### Smoke test

Four smoke scenes (`smoke-1` to `smoke-4`) check the procedure. The skill lists the verdict each one
must give. Changing a judge model or the judge instructions requires a smoke test run.

## Consequences

### Positive

- Two model families share fewer blind spots than two runs of one model.
- One lenient judge cannot pass a mock.
- Each finding names a location and a fix, so a judge says what to change.
- `cargo xtask check` stops clear faults before any model runs.
- Scenes use real UI parts. Outside the direction scenes, they also use the app theme;
  direction scenes keep their own values to isolate reference designs.

### Negative

- Each mock costs two frontier-model runs per round.
- A model update can change findings, so the smoke test must run again.
- A scene cannot show the four usability categories. They wait for the real view.
- Scenes must follow changes to the UI parts, or they show old parts.
- Capture needs ruta on Linux with Weston, Xwayland, xdotool, ImageMagick, and a Vulkan driver,
  so mocks cannot be captured on macOS.
- The pass rule is strict. One severity 2 finding from either judge fails the mock.
- Outside `scenes/directions/`, a one-off size still needs a theme token.
- Published syntax colors in direction scenes can fall below 4.5:1 on diff backgrounds.
  This exception does not apply to UI text or plain code.

## Alternatives considered

### One judge

Use a single model judge. Rejected because one model family shares its blind spots, and one judge's
leniency or harshness would decide the result.

### Category scores with a 9.0 pass line

Each judge scores each category from 0 to 10, and each category passes at 9.0. Rejected because a
score near the pass line is not reliable on its own, as the context explains. Findings name the
defect and its fix, so they decide the verdict.

### Pairwise A/B judging as the gate

Ask judges which of two mocks is better. Rejected because the gate asks whether one mock is good
enough, not which of two is better. Judges can also favor the option they see first.

### Mocks drawn outside GPUI

Draw each mock as an HTML page or an image, styled with greppa's theme values. Rejected because
theme values stop wrong values but not wrong parts. A copy of each greppa part in another toolkit
would be a second set of parts that drifts from the real one.

### Darken syntax colors to meet 4.5:1

Rejected for the direction scenes because this changes the chosen Catppuccin Latte palette.
Keep its published syntax colors, but keep contrast tests for plain code and the surrounding UI.

### Judges check contrast and theme values

Let the judges flag contrast and raw values from the image. Rejected because model judges read
low-level values such as contrast ratios, sizes, and colors poorly, while a check computes them
exactly from the code and the theme.

### Capture on the developer's desktop

Open the scene as a normal window and take a screenshot of the desktop. Rejected because the window
would take over the screen and the input, and the shot would depend on the desktop's scale and other
windows.

### Score usability on scenes

Score efficiency, control and error recovery, accessibility and input, and adaptability on the
scenes too. Rejected because a scene with fake data cannot show keyboard use, recovery from an
error, or a narrow window, so the judges would guess at those findings.
