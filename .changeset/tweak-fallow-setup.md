---
---

Tooling-only: tighten fallow setup with custom 5-zone architecture boundaries, explicit rule
severities, test-file overrides, and stricter complexity thresholds (`maxCyclomatic: 10`,
`maxCognitive: 10`, `maxCrap: 30`) aligned with McCabe/SonarQube guidance. Drop the now-redundant
`eslint/complexity` rule from oxlint. Cache fallow's parse/churn artefacts in CI. Bump fallow 2.54.3
→ 2.63.0 with regenerated baselines.
