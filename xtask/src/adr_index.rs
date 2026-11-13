use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::Path;

use anyhow::Context as _;
use thiserror::Error;

const ADR_DIRECTORY: &str = "docs/adr";
const INDEX_FILE: &str = "README.md";
const NUMBER_LENGTH: usize = 4;

#[derive(Debug, Error, PartialEq, Eq)]
enum Problem {
    #[error("docs/adr: ADR number {number} is used by {}", files.join(", "))]
    DuplicateNumber { number: String, files: Vec<String> },
    #[error("docs/adr/{file}: the first heading must be `# ADR {number}: Title`")]
    WrongHeading { file: String, number: String },
    #[error("docs/adr/{file}: number {number} is listed as retired in docs/adr/README.md")]
    RetiredNumber { file: String, number: String },
    #[error("docs/adr/README.md lists {file} {count} times; list it once")]
    IndexCount { file: String, count: usize },
    #[error("docs/adr/README.md lists {file}, which does not exist")]
    MissingFile { file: String },
    #[error(
        "docs/adr/README.md has an index line that is not `- [NNNN: Title](./file.md)`: {line}"
    )]
    UnparsedEntry { line: String },
    #[error("docs/adr/README.md labels {file} as `{label}`; use `{expected}`")]
    WrongLabel {
        file: String,
        label: String,
        expected: String,
    },
}

struct AdrFile {
    name: String,
    text: String,
}

struct IndexEntry<'a> {
    label: &'a str,
    file: &'a str,
}

pub(crate) fn check(root: &Path) -> anyhow::Result<()> {
    let directory = root.join(ADR_DIRECTORY);
    let index_path = directory.join(INDEX_FILE);
    let index = fs::read_to_string(&index_path)
        .with_context(|| format!("Could not read {}", index_path.display()))?;
    let adrs = read_adrs(&directory)?;
    let problems = find_problems(&adrs, &index);

    if problems.is_empty() {
        return Ok(());
    }

    let lines: Vec<String> = problems.iter().map(ToString::to_string).collect();

    anyhow::bail!("{}", lines.join("\n"))
}

fn read_adrs(directory: &Path) -> anyhow::Result<Vec<AdrFile>> {
    let entries = fs::read_dir(directory)
        .with_context(|| format!("Could not list {}", directory.display()))?;
    let mut adrs = Vec::new();

    for entry in entries {
        let entry = entry.with_context(|| "Could not read an entry")?;
        let name = entry.file_name().to_string_lossy().into_owned();

        if adr_number(&name).is_none() {
            continue;
        }

        let path = entry.path();
        let text = fs::read_to_string(&path)
            .with_context(|| format!("Could not read {}", path.display()))?;

        adrs.push(AdrFile { name, text });
    }

    adrs.sort_by(|left, right| left.name.cmp(&right.name));

    Ok(adrs)
}

fn find_problems(adrs: &[AdrFile], index: &str) -> Vec<Problem> {
    let mut problems = duplicate_numbers(adrs);
    let retired = retired_numbers(index);
    let (entries, unparsed) = index_entries(index);

    for adr in adrs {
        let number = adr_number(&adr.name).expect("read_adrs keeps only numbered ADR files");
        let title = heading_title(&adr.text, number);

        if title.is_none() {
            problems.push(Problem::WrongHeading {
                file: adr.name.clone(),
                number: number.to_string(),
            });
        }

        if retired.contains(number) {
            problems.push(Problem::RetiredNumber {
                file: adr.name.clone(),
                number: number.to_string(),
            });
        }

        let listed: Vec<&IndexEntry> = entries
            .iter()
            .filter(|entry| entry.file == adr.name)
            .collect();

        if listed.len() != 1 {
            problems.push(Problem::IndexCount {
                file: adr.name.clone(),
                count: listed.len(),
            });
        }

        let Some(title) = title else {
            continue;
        };

        let expected = format!("{number}: {title}");

        for entry in listed {
            if entry.label != expected {
                problems.push(Problem::WrongLabel {
                    file: adr.name.clone(),
                    label: entry.label.to_string(),
                    expected: expected.clone(),
                });
            }
        }
    }

    let names: BTreeSet<&str> = adrs.iter().map(|adr| adr.name.as_str()).collect();
    let missing: BTreeSet<&str> = entries
        .iter()
        .map(|entry| entry.file)
        .filter(|file| !names.contains(file))
        .collect();

    for file in missing {
        problems.push(Problem::MissingFile {
            file: file.to_string(),
        });
    }

    for line in unparsed {
        problems.push(Problem::UnparsedEntry {
            line: line.to_string(),
        });
    }

    problems
}

fn duplicate_numbers(adrs: &[AdrFile]) -> Vec<Problem> {
    let mut files_by_number: BTreeMap<&str, Vec<String>> = BTreeMap::new();

    for adr in adrs {
        let number = adr_number(&adr.name).expect("read_adrs keeps only numbered ADR files");

        files_by_number
            .entry(number)
            .or_default()
            .push(adr.name.clone());
    }

    files_by_number
        .into_iter()
        .filter(|(_, files)| files.len() > 1)
        .map(|(number, files)| Problem::DuplicateNumber {
            number: number.to_string(),
            files,
        })
        .collect()
}

fn adr_number(name: &str) -> Option<&str> {
    let number = name.get(..NUMBER_LENGTH)?;
    let slug = name[NUMBER_LENGTH..]
        .strip_prefix('-')?
        .strip_suffix(".md")?;
    let is_number = number.bytes().all(|byte| byte.is_ascii_digit());

    if is_number && !slug.is_empty() {
        Some(number)
    } else {
        None
    }
}

fn heading_title<'a>(text: &'a str, number: &str) -> Option<&'a str> {
    let heading = text.lines().find(|line| line.starts_with('#'))?;
    let prefix = format!("# ADR {number}: ");
    let title = heading.strip_prefix(&prefix)?.trim();

    if title.is_empty() { None } else { Some(title) }
}

fn section<'a>(text: &'a str, heading: &str) -> impl Iterator<Item = &'a str> {
    text.lines()
        .skip_while(move |line| line.trim_end() != heading)
        .skip(1)
        .take_while(|line| !line.starts_with("## "))
}

fn index_entries(index: &str) -> (Vec<IndexEntry<'_>>, Vec<&str>) {
    let mut entries = Vec::new();
    let mut unparsed = Vec::new();

    for line in section(index, "## Index") {
        let line = line.trim();

        if let Some(entry) = index_entry(line) {
            entries.push(entry);
        } else if links_to_markdown(line) {
            unparsed.push(line);
        }
    }

    (entries, unparsed)
}

fn index_entry(line: &str) -> Option<IndexEntry<'_>> {
    let item = ["- ", "* ", "+ "]
        .iter()
        .find_map(|bullet| line.strip_prefix(bullet))?;
    let entry = item.trim_start().strip_prefix('[')?.strip_suffix(')')?;
    let (label, target) = entry.split_once("](")?;
    let file = target.strip_prefix("./").unwrap_or(target);
    let is_plain_file = !file.is_empty() && !file.contains(['/', '(', ')', ' ']);

    if is_plain_file {
        Some(IndexEntry { label, file })
    } else {
        None
    }
}

fn links_to_markdown(line: &str) -> bool {
    line.contains("](") && line.contains(".md")
}

fn retired_numbers(index: &str) -> BTreeSet<&str> {
    section(index, "## Retired")
        .filter_map(|line| line.trim().strip_prefix('|')?.split('|').next())
        .map(str::trim)
        .filter(|cell| !cell.is_empty() && cell.bytes().all(|byte| byte.is_ascii_digit()))
        .collect()
}

#[cfg(test)]
mod tests;
