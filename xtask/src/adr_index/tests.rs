use super::*;

const INDEX: &str = "\
# Architecture decision records

Follow [ADR 0001](./0001-scope.md) for documentation scope.

## Index

### Documentation

- [0001: Scope](./0001-scope.md)
- [0002: Native app](./0002-native-app.md)

## Retired

| ADR | Title | Replaced by | Last commit |
| --- | ----- | ----------- | ----------- |
| 0003 | Old choice | 0002 | abc1234 |
";

fn adr(name: &str, heading: &str) -> AdrFile {
    AdrFile {
        name: name.to_string(),
        text: format!("{heading}\n\n**Status**: Accepted\n"),
    }
}

fn valid_adrs() -> Vec<AdrFile> {
    vec![
        adr("0001-scope.md", "# ADR 0001: Scope"),
        adr("0002-native-app.md", "# ADR 0002: Native app"),
    ]
}

#[test]
fn find_problems_passes_a_consistent_index() {
    assert_eq!(find_problems(&valid_adrs(), INDEX), []);
}

#[test]
fn find_problems_reports_two_files_with_one_number() {
    let mut adrs = valid_adrs();
    adrs.push(adr("0002-sandbox.md", "# ADR 0002: Sandbox"));
    let index = INDEX.replace(
        "- [0002: Native app](./0002-native-app.md)\n",
        "- [0002: Native app](./0002-native-app.md)\n- [0002: Sandbox](./0002-sandbox.md)\n",
    );

    assert_eq!(
        find_problems(&adrs, &index),
        [Problem::DuplicateNumber {
            number: "0002".to_string(),
            files: vec![
                "0002-native-app.md".to_string(),
                "0002-sandbox.md".to_string()
            ],
        }]
    );
}

#[test]
fn find_problems_reports_a_heading_that_does_not_match_the_file() {
    let cases = [
        "# ADR 0003: Native app",
        "# Native app",
        "# ADR 0002:",
        "## ADR 0002: Native app",
    ];

    for heading in cases {
        let adrs = [
            adr("0001-scope.md", "# ADR 0001: Scope"),
            adr("0002-native-app.md", heading),
        ];

        assert_eq!(
            find_problems(&adrs, INDEX),
            [Problem::WrongHeading {
                file: "0002-native-app.md".to_string(),
                number: "0002".to_string(),
            }],
            "{heading}"
        );
    }
}

#[test]
fn find_problems_reports_a_current_adr_with_a_retired_number() {
    let mut adrs = valid_adrs();
    adrs.push(adr("0003-reused.md", "# ADR 0003: Reused"));
    let index = INDEX.replace(
        "### Documentation\n",
        "### Documentation\n\n- [0003: Reused](./0003-reused.md)\n",
    );

    assert_eq!(
        find_problems(&adrs, &index),
        [Problem::RetiredNumber {
            file: "0003-reused.md".to_string(),
            number: "0003".to_string(),
        }]
    );
}

#[test]
fn find_problems_reports_an_adr_listed_zero_times_or_twice() {
    let missing = INDEX.replace("- [0002: Native app](./0002-native-app.md)\n", "");
    let doubled = INDEX.replace(
        "- [0001: Scope](./0001-scope.md)\n",
        "- [0001: Scope](./0001-scope.md)\n- [0001: Scope](./0001-scope.md)\n",
    );
    let cases = [
        (missing, "0002-native-app.md", 0),
        (doubled, "0001-scope.md", 2),
    ];

    for (index, file, count) in cases {
        assert_eq!(
            find_problems(&valid_adrs(), &index),
            [Problem::IndexCount {
                file: file.to_string(),
                count,
            }],
            "{file} listed {count} times"
        );
    }
}

#[test]
fn find_problems_reports_an_index_entry_for_a_missing_file() {
    let index = INDEX.replace(
        "### Documentation\n",
        "### Documentation\n\n- [0004: Gone](./0004-gone.md)\n",
    );

    assert_eq!(
        find_problems(&valid_adrs(), &index),
        [Problem::MissingFile {
            file: "0004-gone.md".to_string(),
        }]
    );
}

#[test]
fn find_problems_reads_star_and_plus_bullets() {
    for bullet in ["*", "+"] {
        let index = INDEX.replace("- [", &format!("{bullet} ["));

        assert_eq!(find_problems(&valid_adrs(), &index), [], "{bullet}");
    }
}

#[test]
fn find_problems_reports_a_star_bullet_entry_for_a_missing_file() {
    let index = INDEX.replace(
        "### Documentation\n",
        "### Documentation\n\n* [0004: Gone](./0004-gone.md)\n",
    );

    assert_eq!(
        find_problems(&valid_adrs(), &index),
        [Problem::MissingFile {
            file: "0004-gone.md".to_string(),
        }]
    );
}

#[test]
fn find_problems_reports_a_star_bullet_duplicate_entry() {
    let index = INDEX.replace(
        "### Documentation\n",
        "### Documentation\n\n* [0001: Scope](./0001-scope.md)\n",
    );

    assert_eq!(
        find_problems(&valid_adrs(), &index),
        [Problem::IndexCount {
            file: "0001-scope.md".to_string(),
            count: 2,
        }]
    );
}

#[test]
fn find_problems_reports_an_index_line_that_does_not_parse() {
    let cases = [
        "- [0002: Native app](./0002-native-app.md) (see also 0001)",
        "- See [0002: Native app](./0002-native-app.md)",
        "-[0002: Native app](./0002-native-app.md)",
        "- [0002: Native app](../adr/0002-native-app.md)",
    ];

    for line in cases {
        let index = INDEX.replace(
            "### Documentation\n",
            &format!("### Documentation\n\n{line}\n"),
        );

        assert_eq!(
            find_problems(&valid_adrs(), &index),
            [Problem::UnparsedEntry {
                line: line.to_string(),
            }],
            "{line}"
        );
    }
}

#[test]
fn find_problems_reports_a_label_that_does_not_match_the_heading() {
    let cases = ["0002: Native apps", "Native app", "0003: Native app"];

    for label in cases {
        let index = INDEX.replace("[0002: Native app]", &format!("[{label}]"));

        assert_eq!(
            find_problems(&valid_adrs(), &index),
            [Problem::WrongLabel {
                file: "0002-native-app.md".to_string(),
                label: label.to_string(),
                expected: "0002: Native app".to_string(),
            }],
            "{label}"
        );
    }
}

#[test]
fn find_problems_reports_every_problem_in_one_run() {
    let adrs = [
        adr("0001-scope.md", "# Scope"),
        adr("0002-native-app.md", "# ADR 0002: Native app"),
    ];
    let index = INDEX.replace("[0002: Native app]", "[0002: Native]");

    assert_eq!(
        find_problems(&adrs, &index),
        [
            Problem::WrongHeading {
                file: "0001-scope.md".to_string(),
                number: "0001".to_string(),
            },
            Problem::WrongLabel {
                file: "0002-native-app.md".to_string(),
                label: "0002: Native".to_string(),
                expected: "0002: Native app".to_string(),
            },
        ]
    );
}

#[test]
fn adr_number_accepts_only_numbered_markdown_files() {
    let cases = [
        ("0001-scope.md", Some("0001")),
        ("README.md", None),
        ("TEMPLATE.md", None),
        ("0001.md", None),
        ("0001-.md", None),
        ("001-scope.md", None),
        ("0001-scope.txt", None),
    ];

    for (name, expected) in cases {
        assert_eq!(adr_number(name), expected, "{name}");
    }
}

#[test]
fn check_reads_the_adr_directory_of_the_root() {
    let root = crate::test_support::temporary_directory();
    let directory = root.path().join(ADR_DIRECTORY);
    let files = [
        (INDEX_FILE, INDEX),
        ("TEMPLATE.md", "# ADR NNNN: Title\n"),
        ("0001-scope.md", "# ADR 0001: Scope\n"),
        ("0002-native-app.md", "# ADR 0002: Native app\n"),
    ];

    fs::create_dir_all(&directory).expect("create docs/adr");

    for (name, text) in files {
        fs::write(directory.join(name), text).expect("write an ADR file");
    }

    check(root.path()).expect("a consistent ADR directory passes");

    fs::write(directory.join("0002-sandbox.md"), "# ADR 0002: Sandbox\n")
        .expect("write a duplicate ADR");

    let error = check(root.path()).expect_err("a duplicate number fails");

    assert!(
        error
            .to_string()
            .contains("ADR number 0002 is used by 0002-native-app.md, 0002-sandbox.md"),
        "{error}"
    );
}
