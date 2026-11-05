//! `cargo xtask mutation`: runs cargo-mutants and prints Tau's mutation report on stdout.
//!
//! Exit codes follow Tau's contract: 0 for `pass`, `nothing`, or survivors in audit mode, 2 for
//! survivors in changed mode, and 1 for an error or any unmutated file. Everything except the
//! report goes to stderr, because Tau parses stdout as JSON.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode, Stdio};

use serde_json::{Value, json};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Mode {
    Changed,
    Audit,
}

#[derive(Debug, PartialEq, Eq)]
struct Request {
    mode: Mode,
    targets: Vec<String>,
    max_mutants: Option<usize>,
}

struct Scope {
    diff: Option<PathBuf>,
    files: Vec<String>,
}

#[derive(Debug, PartialEq, Eq)]
struct Survivor {
    file: String,
    line: usize,
    mutator: String,
    original: String,
    replacement: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Position {
    line: usize,
    column: usize,
}

enum Outcome {
    Nothing,
    Ran {
        survivors: Vec<Survivor>,
        unmutated: Vec<String>,
    },
}

const OUTPUT_DIRECTORY: &str = "target/mutants";
const MAX_JOBS: usize = 4;

fn parse_max_mutants(value: Option<&String>) -> Result<usize, String> {
    let value = value.ok_or("--max-mutants needs a number.")?;

    let parsed: usize = value
        .parse()
        .map_err(|_| format!("--max-mutants needs a positive integer, not {value}."))?;

    if parsed == 0 {
        return Err("--max-mutants must be at least 1.".to_string());
    }

    Ok(parsed)
}

fn parse_request(arguments: &[String]) -> Result<Request, String> {
    let (mode_name, rest) = arguments
        .split_first()
        .ok_or("Name a mode: changed or audit.")?;

    let mut targets = Vec::new();
    let mut max_mutants = None;
    let mut remaining = rest.iter();

    while let Some(argument) = remaining.next() {
        if argument == "--max-mutants" {
            max_mutants = Some(parse_max_mutants(remaining.next())?);
        } else if argument.starts_with('-') {
            return Err(format!("Unknown option {argument}."));
        } else {
            targets.push(argument.clone());
        }
    }

    let mode = match mode_name.as_str() {
        "changed" if targets.len() == 1 => Mode::Changed,
        "changed" => return Err("Changed mode needs exactly one base commit.".to_string()),
        "audit" if !targets.is_empty() => Mode::Audit,
        "audit" => return Err("Audit mode needs at least one file.".to_string()),
        _ => return Err(format!("Unknown mode {mode_name}. Use changed or audit.")),
    };

    Ok(Request {
        mode,
        targets,
        max_mutants,
    })
}

impl Scope {
    fn arguments(&self) -> Vec<String> {
        let mut arguments = Vec::new();

        if let Some(diff) = &self.diff {
            arguments.push("--in-diff".to_string());
            arguments.push(diff.display().to_string());
        }

        for file in &self.files {
            arguments.push("--file".to_string());
            arguments.push(file.clone());
        }

        arguments
    }
}

/// cargo-mutants matches `--file` as a glob against workspace-relative paths, so `./a.rs` or an
/// absolute path would match nothing and wrongly report `nothing`.
fn workspace_relative_path(root: &Path, path: &str) -> Result<String, String> {
    let file = root
        .join(path)
        .canonicalize()
        .map_err(|error| format!("Could not find {path}: {error}"))?;

    let canonical_root = root
        .canonicalize()
        .map_err(|error| format!("Could not resolve {}: {error}", root.display()))?;

    let relative = file
        .strip_prefix(&canonical_root)
        .map_err(|_| format!("{path} is outside the workspace."))?;

    let parts: Vec<String> = relative
        .components()
        .map(|part| part.as_os_str().to_string_lossy().into_owned())
        .collect();

    Ok(parts.join("/"))
}

fn write_diff(root: &Path, output: &Path, base: &str) -> Result<Option<PathBuf>, String> {
    let diff = Command::new("git")
        .args(["diff", "--no-ext-diff", base, "--"])
        .current_dir(root)
        .stderr(Stdio::inherit())
        .output()
        .map_err(|error| format!("Could not start git diff: {error}"))?;

    if !diff.status.success() {
        return Err(format!("git diff {base} failed with {}.", diff.status));
    }

    if diff.stdout.is_empty() {
        return Ok(None);
    }

    let path = output.join("changes.diff");

    fs::write(&path, &diff.stdout)
        .map_err(|error| format!("Could not write {}: {error}", path.display()))?;

    Ok(Some(path))
}

fn count_mutants(root: &Path, scope: &Scope) -> Result<BTreeMap<String, usize>, String> {
    let listing = Command::new("cargo")
        .args(["mutants", "--workspace", "--list", "--json"])
        .args(scope.arguments())
        .current_dir(root)
        .stderr(Stdio::inherit())
        .output()
        .map_err(|error| format!("Could not start cargo mutants: {error}"))?;

    if !listing.status.success() {
        return Err(format!(
            "cargo mutants --list failed with {}.",
            listing.status
        ));
    }

    let mutants: Value = serde_json::from_slice(&listing.stdout)
        .map_err(|error| format!("cargo mutants --list printed invalid JSON: {error}"))?;

    let mutants = mutants
        .as_array()
        .ok_or("cargo mutants --list did not print a JSON array.")?;

    let mut counts = BTreeMap::new();

    for mutant in mutants {
        let file = mutant["file"]
            .as_str()
            .ok_or("A listed mutant has no file.")?;

        *counts.entry(file.to_string()).or_insert(0) += 1;
    }

    Ok(counts)
}

fn apply_cap(
    counts: &BTreeMap<String, usize>,
    max_mutants: Option<usize>,
) -> (Vec<String>, Vec<String>) {
    let mut remaining = max_mutants.unwrap_or(usize::MAX);
    let mut selected = Vec::new();
    let mut unmutated = Vec::new();

    for (file, &count) in counts {
        if count <= remaining {
            remaining -= count;
            selected.push(file.clone());
        } else {
            unmutated.push(file.clone());
        }
    }

    (selected, unmutated)
}

fn job_count() -> usize {
    let available = std::thread::available_parallelism().map_or(1, |count| count.get());

    available.min(MAX_JOBS)
}

fn run_mutants(root: &Path, output: &Path, scope: &Scope) -> Result<(), String> {
    let status = Command::new("cargo")
        .args(["mutants", "--workspace", "--no-shuffle", "--jobs"])
        .arg(job_count().to_string())
        .arg("--output")
        .arg(output)
        .args(scope.arguments())
        .current_dir(root)
        .stdout(std::io::stderr())
        .status()
        .map_err(|error| format!("Could not start cargo mutants: {error}"))?;

    // cargo-mutants exits 2 for missed mutants and 3 for timeouts. A timed-out mutant counts as
    // caught, as Stryker counts it in Tau's own mutation script, so only missed mutants survive.
    match status.code() {
        Some(0 | 2 | 3) => Ok(()),
        Some(4) => Err("The unmutated tree fails to build or pass its tests.".to_string()),
        _ => Err(format!("cargo mutants failed with {status}.")),
    }
}

fn read_position(value: &Value) -> Option<Position> {
    let line = usize::try_from(value["line"].as_u64()?).ok()?;
    let column = usize::try_from(value["column"].as_u64()?).ok()?;

    Some(Position { line, column })
}

fn span_text(source: &str, start: Position, end: Position) -> String {
    let lines: Vec<&str> = source.lines().collect();
    let mut text = String::new();

    for line_number in start.line..=end.line {
        let Some(line) = lines.get(line_number.saturating_sub(1)) else {
            break;
        };

        let characters: Vec<char> = line.chars().collect();
        let last = characters.len();
        let from = if line_number == start.line {
            start.column.saturating_sub(1)
        } else {
            0
        };
        let to = if line_number == end.line {
            end.column.saturating_sub(1)
        } else {
            last
        };
        let to = to.min(last);

        if line_number > start.line {
            text.push('\n');
        }

        text.extend(&characters[from.min(to)..to]);
    }

    text
}

fn read_survivor(root: &Path, mutant: &Value) -> Result<Survivor, String> {
    let file = mutant["file"]
        .as_str()
        .ok_or("A missed mutant has no file.")?;
    let start = read_position(&mutant["span"]["start"]).ok_or("A missed mutant has no start.")?;
    let end = read_position(&mutant["span"]["end"]).ok_or("A missed mutant has no end.")?;

    let source = fs::read_to_string(root.join(file))
        .map_err(|error| format!("Could not read {file}: {error}"))?;

    Ok(Survivor {
        file: file.to_string(),
        line: start.line,
        mutator: mutant["genre"].as_str().unwrap_or("Unknown").to_string(),
        original: span_text(&source, start, end),
        replacement: mutant["replacement"]
            .as_str()
            .unwrap_or_default()
            .to_string(),
    })
}

fn read_survivors(root: &Path, output: &Path) -> Result<Vec<Survivor>, String> {
    let path = output.join("mutants.out").join("outcomes.json");

    let text = fs::read_to_string(&path)
        .map_err(|error| format!("Could not read {}: {error}", path.display()))?;

    let outcomes: Value = serde_json::from_str(&text)
        .map_err(|error| format!("{} is not valid JSON: {error}", path.display()))?;

    let outcomes = outcomes["outcomes"]
        .as_array()
        .ok_or("outcomes.json has no outcomes list.")?;

    outcomes
        .iter()
        .filter(|outcome| outcome["summary"] == "MissedMutant")
        .map(|outcome| read_survivor(root, &outcome["scenario"]["Mutant"]))
        .collect()
}

fn mutate(root: &Path, request: &Request) -> Result<Outcome, String> {
    let output = root.join(OUTPUT_DIRECTORY);

    fs::create_dir_all(&output)
        .map_err(|error| format!("Could not create {}: {error}", output.display()))?;

    let scope = match request.mode {
        Mode::Changed => match write_diff(root, &output, &request.targets[0])? {
            Some(diff) => Scope {
                diff: Some(diff),
                files: Vec::new(),
            },
            None => return Ok(Outcome::Nothing),
        },
        Mode::Audit => Scope {
            diff: None,
            files: request
                .targets
                .iter()
                .map(|path| workspace_relative_path(root, path))
                .collect::<Result<_, _>>()?,
        },
    };

    let counts = count_mutants(root, &scope)?;

    if counts.is_empty() {
        return Ok(Outcome::Nothing);
    }

    let (selected, unmutated) = apply_cap(&counts, request.max_mutants);

    if selected.is_empty() {
        return Ok(Outcome::Ran {
            survivors: Vec::new(),
            unmutated,
        });
    }

    let selected_scope = Scope {
        diff: scope.diff,
        files: selected,
    };

    run_mutants(root, &output, &selected_scope)?;

    let survivors = read_survivors(root, &output)?;

    Ok(Outcome::Ran {
        survivors,
        unmutated,
    })
}

fn error_report(message: &str) -> Value {
    json!({
        "version": 1,
        "status": "error",
        "error": message,
        "survivors": [],
        "unmutated": [],
    })
}

fn ran_report(mode: Mode, survivors: &[Survivor], unmutated: &[String]) -> (Value, u8) {
    let survivor_values: Vec<Value> = survivors
        .iter()
        .map(|survivor| {
            json!({
                "file": survivor.file,
                "line": survivor.line,
                "mutator": survivor.mutator,
                "original": survivor.original,
                "replacement": survivor.replacement,
                // cargo-mutants measures no coverage, so every missed mutant counts as covered.
                "covered": true,
            })
        })
        .collect();

    let mut report = json!({
        "version": 1,
        "status": "pass",
        "survivors": survivor_values,
        "unmutated": unmutated,
    });

    if !survivors.is_empty() {
        report["status"] = json!("survivors");
    }

    if !unmutated.is_empty() {
        if survivors.is_empty() {
            report["status"] = json!("error");
            report["error"] = json!("Files over the mutant cap were not mutated.");
        }

        return (report, 1);
    }

    let exit = match (survivors.is_empty(), mode) {
        (false, Mode::Changed) => 2,
        _ => 0,
    };

    (report, exit)
}

#[expect(
    clippy::print_stdout,
    reason = "the mutation report is the command's stdout output"
)]
pub(crate) fn run(root: &Path, arguments: &[String]) -> ExitCode {
    let request = match parse_request(arguments) {
        Ok(request) => request,
        Err(message) => {
            println!("{}", error_report(&message));
            return ExitCode::FAILURE;
        }
    };

    let (report, exit) = match mutate(root, &request) {
        Ok(Outcome::Nothing) => (
            json!({ "version": 1, "status": "nothing", "survivors": [], "unmutated": [] }),
            0,
        ),
        Ok(Outcome::Ran {
            survivors,
            unmutated,
        }) => ran_report(request.mode, &survivors, &unmutated),
        Err(message) => (error_report(&message), 1),
    };

    println!("{report}");
    ExitCode::from(exit)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn strings(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    fn survivor() -> Survivor {
        Survivor {
            file: "src/lib.rs".to_string(),
            line: 3,
            mutator: "BinaryOperator".to_string(),
            original: "<=".to_string(),
            replacement: ">".to_string(),
        }
    }

    #[test]
    fn parse_request_reads_modes_and_cap() {
        let changed = parse_request(&strings(&["changed", "main", "--max-mutants", "5"]));
        let audit = parse_request(&strings(&["audit", "a.rs", "b.rs"]));

        assert_eq!(
            changed,
            Ok(Request {
                mode: Mode::Changed,
                targets: strings(&["main"]),
                max_mutants: Some(5),
            })
        );
        assert_eq!(
            audit.map(|request| request.targets),
            Ok(strings(&["a.rs", "b.rs"]))
        );
    }

    #[test]
    fn parse_request_rejects_bad_input() {
        assert!(parse_request(&strings(&["changed"])).is_err());
        assert!(parse_request(&strings(&["changed", "a", "b"])).is_err());
        assert!(parse_request(&strings(&["audit"])).is_err());
        assert!(parse_request(&strings(&["audit", "a.rs", "--max-mutants", "0"])).is_err());
        assert!(parse_request(&strings(&["audit", "a.rs", "--jobs"])).is_err());
        assert!(parse_request(&strings(&["other", "a.rs"])).is_err());
    }

    #[test]
    fn apply_cap_skips_files_that_do_not_fit() {
        let counts = BTreeMap::from([
            ("a.rs".to_string(), 2),
            ("b.rs".to_string(), 5),
            ("c.rs".to_string(), 1),
        ]);

        assert_eq!(
            apply_cap(&counts, Some(3)),
            (strings(&["a.rs", "c.rs"]), strings(&["b.rs"]))
        );
        assert_eq!(
            apply_cap(&counts, None),
            (strings(&["a.rs", "b.rs", "c.rs"]), vec![])
        );
    }

    #[test]
    fn workspace_relative_path_normalizes_existing_files() {
        let root = crate::workspace_root();
        let expected = Ok("crates/greppa-core/src/lib.rs".to_string());
        let absolute = root.join("crates/greppa-core/src/lib.rs");

        assert_eq!(
            workspace_relative_path(&root, "./crates/greppa-core/src/lib.rs"),
            expected
        );
        assert_eq!(
            workspace_relative_path(&root, &absolute.display().to_string()),
            expected
        );
        assert!(workspace_relative_path(&root, "crates/missing.rs").is_err());
    }

    #[test]
    fn read_survivors_keeps_only_missed_mutants() {
        let root = std::env::temp_dir().join(format!("greppa-xtask-{}", std::process::id()));
        let output = root.join("out");
        let mutant = |summary: &str, replacement: &str| {
            json!({
                "summary": summary,
                "scenario": { "Mutant": {
                    "file": "lib.rs",
                    "genre": "BinaryOperator",
                    "replacement": replacement,
                    "span": { "start": { "line": 1, "column": 3 }, "end": { "line": 1, "column": 5 } },
                } },
            })
        };
        let outcomes = json!({ "outcomes": [
            { "scenario": "Baseline", "summary": "Success" },
            mutant("CaughtMutant", "||"),
            mutant("MissedMutant", ">"),
            mutant("Timeout", "<"),
        ] });

        fs::create_dir_all(output.join("mutants.out")).expect("create output");
        fs::write(root.join("lib.rs"), "a <= b\n").expect("write source");
        fs::write(
            output.join("mutants.out/outcomes.json"),
            outcomes.to_string(),
        )
        .expect("write outcomes");

        let survivors = read_survivors(&root, &output);

        fs::remove_dir_all(&root).expect("remove temporary directory");
        assert_eq!(
            survivors,
            Ok(vec![Survivor {
                file: "lib.rs".to_string(),
                line: 1,
                mutator: "BinaryOperator".to_string(),
                original: "<=".to_string(),
                replacement: ">".to_string(),
            }])
        );
    }

    #[test]
    fn span_text_reads_single_and_multiple_lines() {
        let source = "fn a() {\n    x <= y\n}\n";
        let start = Position { line: 2, column: 7 };

        assert_eq!(
            span_text(source, start, Position { line: 2, column: 9 }),
            "<="
        );
        assert_eq!(
            span_text(
                source,
                Position { line: 1, column: 8 },
                Position { line: 3, column: 2 }
            ),
            "{\n    x <= y\n}"
        );
    }

    #[test]
    fn ran_report_sets_status_and_exit_code() {
        let found = [survivor()];
        let skipped = strings(&["b.rs"]);

        let (passed, passed_exit) = ran_report(Mode::Changed, &[], &[]);
        let (changed, changed_exit) = ran_report(Mode::Changed, &found, &[]);
        let (audit, audit_exit) = ran_report(Mode::Audit, &found, &[]);
        let (capped, capped_exit) = ran_report(Mode::Audit, &[], &skipped);

        assert_eq!((passed["status"].as_str(), passed_exit), (Some("pass"), 0));
        assert_eq!(
            (changed["status"].as_str(), changed_exit),
            (Some("survivors"), 2)
        );
        assert_eq!(
            (audit["status"].as_str(), audit_exit),
            (Some("survivors"), 0)
        );
        assert_eq!((capped["status"].as_str(), capped_exit), (Some("error"), 1));
        assert_eq!(changed["survivors"][0]["original"], "<=");
        assert_eq!(capped["unmutated"], json!(["b.rs"]));
    }
}
