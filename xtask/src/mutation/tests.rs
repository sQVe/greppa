use std::os::unix::fs::PermissionsExt as _;

use tempfile::TempDir;

use super::*;

const LISTING: &str =
    r#"[{"file":"a.rs"},{"file":"a.rs"},{"file":"b.rs"},{"file":"b.rs"},{"file":"c.rs"}]"#;
const DIFF: &str = "diff --git a/a.rs b/a.rs";

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

struct Fixture {
    folder: TempDir,
}

impl Fixture {
    fn new() -> Self {
        let folder = crate::test_support::temporary_directory();
        let outcomes = folder.path().join(OUTPUT_DIRECTORY).join("mutants.out");

        for file in ["a.rs", "b.rs", "c.rs"] {
            fs::write(folder.path().join(file), "").expect("write a source file");
        }

        fs::create_dir_all(&outcomes).expect("create the output folder");
        fs::write(outcomes.join("outcomes.json"), r#"{"outcomes":[]}"#).expect("write outcomes");

        Self { folder }
    }

    fn tool(&self, name: &str, script: &str) -> String {
        let path = self.folder.path().join(name);

        fs::write(&path, format!("#!/bin/sh\n{script}\n")).expect("write a fake tool");
        fs::set_permissions(&path, fs::Permissions::from_mode(0o755))
            .expect("make the fake tool runnable");

        path.to_str()
            .expect("the fake tool path is UTF-8")
            .to_string()
    }

    // Logs each call's arguments to `cargo.log`, prints `listing` for `--list`, and otherwise runs
    // `run`.
    fn cargo(&self, listing: &str, list_exit: u8, run: &str) -> String {
        let script = format!(
            "printf '%s\\n' \"$*\" >> \"$(dirname \"$0\")/cargo.log\"\n\
             case \"$*\" in *--list*) printf '%s' '{listing}'; exit {list_exit};; esac\n\
             {run}"
        );

        self.tool("cargo", &script)
    }

    fn git(&self, diff: &str, exit: u8) -> String {
        self.tool("git", &format!("printf '%s' '{diff}'\nexit {exit}"))
    }

    fn cargo_calls(&self) -> Vec<String> {
        let log = fs::read_to_string(self.folder.path().join("cargo.log")).expect("read cargo.log");

        log.lines().map(str::to_string).collect()
    }

    fn report(&self, arguments: &[&str], cargo: &str, git: &str) -> (Value, u8) {
        report(self.folder.path(), &strings(arguments), cargo, git)
    }

    fn audit(&self, cargo: &str) -> (Value, u8) {
        let git = self.git("", 0);

        self.report(&["audit", "a.rs"], cargo, &git)
    }
}

fn status(report: &(Value, u8)) -> (Option<&str>, u8) {
    (report.0["status"].as_str(), report.1)
}

#[test]
fn run_fails_on_bad_arguments() {
    let fixture = Fixture::new();

    assert_eq!(
        run(fixture.folder.path(), &strings(&["other"])),
        ExitCode::FAILURE
    );
}

#[test]
fn report_fails_when_the_listing_fails() {
    let fixture = Fixture::new();
    let cargo = fixture.cargo("[]", 1, "exit 0");

    assert_eq!(status(&fixture.audit(&cargo)), (Some("error"), 1));
}

#[test]
fn report_fails_when_the_listing_is_not_json() {
    let fixture = Fixture::new();
    let cargo = fixture.cargo("not json", 0, "exit 0");

    assert_eq!(status(&fixture.audit(&cargo)), (Some("error"), 1));
}

#[test]
fn report_reads_the_exit_code_of_the_mutants_run() {
    let cases = [
        ("exit 0", (Some("pass"), 0)),
        ("exit 2", (Some("pass"), 0)),
        ("exit 3", (Some("pass"), 0)),
        ("exit 4", (Some("error"), 1)),
        ("exit 1", (Some("error"), 1)),
        ("kill -9 $$", (Some("error"), 1)),
    ];

    for (run, expected) in cases {
        let fixture = Fixture::new();
        let cargo = fixture.cargo(LISTING, 0, run);

        assert_eq!(status(&fixture.audit(&cargo)), expected, "{run}");
    }
}

#[test]
fn report_fails_when_git_diff_fails() {
    let fixture = Fixture::new();
    let cargo = fixture.cargo(LISTING, 0, "exit 0");
    let git = fixture.git("", 128);

    let report = fixture.report(&["changed", "main"], &cargo, &git);

    assert_eq!(status(&report), (Some("error"), 1));
}

#[test]
fn report_finds_nothing_without_work() {
    let fixture = Fixture::new();
    let cargo = fixture.cargo("[]", 0, "exit 0");
    let git = fixture.git("", 0);

    let empty_diff = fixture.report(&["changed", "main"], &cargo, &git);
    let empty_listing = fixture.audit(&cargo);

    assert_eq!(status(&empty_diff), (Some("nothing"), 0));
    assert_eq!(status(&empty_listing), (Some("nothing"), 0));
}

#[test]
fn report_runs_the_selected_files_within_the_diff() {
    let fixture = Fixture::new();
    let cargo = fixture.cargo(LISTING, 0, "exit 0");
    let git = fixture.git(DIFF, 0);
    let diff = fixture
        .folder
        .path()
        .join(OUTPUT_DIRECTORY)
        .join("changes.diff");

    let report = fixture.report(&["changed", "main", "--max-mutants", "4"], &cargo, &git);
    let calls = fixture.cargo_calls();

    assert_eq!(report.0["unmutated"], json!(["c.rs"]));
    assert_eq!(calls.len(), 2);
    assert!(
        calls[0].ends_with(&format!("--list --json --in-diff {}", diff.display())),
        "{}",
        calls[0]
    );
    assert!(
        calls[1].ends_with(&format!(
            "--in-diff {} --file a.rs --file b.rs",
            diff.display()
        )),
        "{}",
        calls[1]
    );
}

#[test]
fn scope_arguments_keep_flag_and_value_order() {
    let diff = PathBuf::from("out/changes.diff");
    let cases = [
        (None, vec![], vec![]),
        (
            Some(diff.clone()),
            vec![],
            strings(&["--in-diff", "out/changes.diff"]),
        ),
        (
            None,
            strings(&["a.rs", "b.rs"]),
            strings(&["--file", "a.rs", "--file", "b.rs"]),
        ),
        (
            Some(diff),
            strings(&["a.rs", "b.rs"]),
            strings(&[
                "--in-diff",
                "out/changes.diff",
                "--file",
                "a.rs",
                "--file",
                "b.rs",
            ]),
        ),
    ];

    for (diff, files, expected) in cases {
        let scope = Scope { diff, files };

        assert_eq!(scope.arguments(), expected, "{expected:?}");
    }
}

#[test]
fn apply_cap_reports_files_past_the_cap_unmutated() {
    let counts = BTreeMap::from([
        ("a".to_string(), 2),
        ("b".to_string(), 2),
        ("c".to_string(), 1),
    ]);

    assert_eq!(
        apply_cap(&counts, Some(4)),
        (strings(&["a", "b"]), strings(&["c"]))
    );
}

#[test]
fn error_report_carries_the_message() {
    assert_eq!(
        error_report("broken"),
        json!({
            "version": 1,
            "status": "error",
            "error": "broken",
            "survivors": [],
            "unmutated": [],
        })
    );
}

#[test]
fn job_count_uses_available_cores_up_to_the_limit() {
    let available = std::thread::available_parallelism().map_or(1, |count| count.get());
    let jobs = job_count();

    assert!((1..=MAX_JOBS).contains(&jobs), "{jobs}");
    assert_eq!(jobs, available.min(MAX_JOBS));
}

#[test]
fn parse_request_reads_modes_and_cap() {
    let changed = parse_request(&strings(&["changed", "main", "--max-mutants", "5"]))
        .expect("changed parses");
    let audit = parse_request(&strings(&["audit", "a.rs", "b.rs"])).expect("audit parses");

    assert_eq!(
        changed,
        Request {
            mode: Mode::Changed,
            targets: strings(&["main"]),
            max_mutants: Some(5),
        }
    );
    assert_eq!(audit.targets, strings(&["a.rs", "b.rs"]));
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
    let expected = "crates/greppa-core/src/lib.rs";
    let absolute = root.join("crates/greppa-core/src/lib.rs");

    assert_eq!(
        workspace_relative_path(&root, "./crates/greppa-core/src/lib.rs").expect("relative"),
        expected
    );
    assert_eq!(
        workspace_relative_path(&root, &absolute.display().to_string()).expect("absolute"),
        expected
    );
    assert!(workspace_relative_path(&root, "crates/missing.rs").is_err());
}

#[test]
fn read_survivors_keeps_only_missed_mutants() {
    let root = crate::test_support::temporary_directory();
    let output = root.path().join("out");
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
    fs::write(root.path().join("lib.rs"), "a <= b\n").expect("write source");
    fs::write(
        output.join("mutants.out/outcomes.json"),
        outcomes.to_string(),
    )
    .expect("write outcomes");

    let survivors = read_survivors(root.path(), &output).expect("survivors parse");

    assert_eq!(
        survivors,
        vec![Survivor {
            file: "lib.rs".to_string(),
            line: 1,
            mutator: "BinaryOperator".to_string(),
            original: "<=".to_string(),
            replacement: ">".to_string(),
        }]
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
