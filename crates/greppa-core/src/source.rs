use std::path::{Path, PathBuf};

use thiserror::Error;

use crate::git::{Git, GitError};

/// What the user asked to review, with the names as typed. It is also the source's identity:
/// resolving it again after a branch moves gives new SHAs for the same request.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum SourceRequest {
    WorkingTree,
    Branch { base: String },
    Range { from: String, to: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct CommitId(String);

impl CommitId {
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReviewSource {
    identity: SourceRequest,
    git_folder: PathBuf,
    base: CommitId,
    head: Option<CommitId>,
    merge_base: Option<CommitId>,
    commits: Vec<CommitId>,
}

impl ReviewSource {
    pub fn identity(&self) -> &SourceRequest {
        &self.identity
    }

    pub fn git_folder(&self) -> &Path {
        &self.git_folder
    }

    pub fn base(&self) -> &CommitId {
        &self.base
    }

    /// `None` for the working tree, whose head is the files on disk.
    pub fn head(&self) -> Option<&CommitId> {
        self.head.as_ref()
    }

    pub fn merge_base(&self) -> Option<&CommitId> {
        self.merge_base.as_ref()
    }

    /// The commits from base to head, oldest first.
    pub fn commits(&self) -> &[CommitId] {
        &self.commits
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum ParseError {
    #[error("`{argument}` needs a commit on both sides of `..`")]
    EmptyRangeSide { argument: String },
    #[error("`{argument}` uses `...`; use `A..B`")]
    SymmetricRange { argument: String },
    #[error("expected at most one argument, got {}", arguments.join(" "))]
    TooManyArguments { arguments: Vec<String> },
}

#[derive(Debug, Error)]
pub enum ResolveError {
    #[error("{} is not a Git repository: {stderr}", folder.display())]
    NotARepository { folder: PathBuf, stderr: String },
    #[error("`{name}` does not name a commit")]
    UnknownRef { name: String },
    #[error("`{base}` and `{head}` have no common commit")]
    NoMergeBase { base: String, head: String },
    #[error(transparent)]
    Git(#[from] GitError),
}

impl SourceRequest {
    /// Parses the command line arguments after the program name.
    ///
    /// # Errors
    ///
    /// Returns a [`ParseError`] for more than one argument, `A...B`, or a range with an empty side.
    pub fn parse<S: AsRef<str>>(arguments: &[S]) -> Result<Self, ParseError> {
        match arguments {
            [] => Ok(Self::WorkingTree),
            [argument] => Self::parse_argument(argument.as_ref()),
            _ => Err(ParseError::TooManyArguments {
                arguments: arguments
                    .iter()
                    .map(|argument| argument.as_ref().to_owned())
                    .collect(),
            }),
        }
    }

    fn parse_argument(argument: &str) -> Result<Self, ParseError> {
        if argument.contains("...") {
            return Err(ParseError::SymmetricRange {
                argument: argument.to_owned(),
            });
        }

        let Some((from, to)) = argument.split_once("..") else {
            return Ok(Self::Branch {
                base: argument.to_owned(),
            });
        };

        if from.is_empty() || to.is_empty() {
            return Err(ParseError::EmptyRangeSide {
                argument: argument.to_owned(),
            });
        }

        Ok(Self::Range {
            from: from.to_owned(),
            to: to.to_owned(),
        })
    }

    /// Resolves every name to a commit SHA now, so call it again to follow moved branches.
    ///
    /// # Errors
    ///
    /// Returns a [`ResolveError`] when `folder` is not in a repository, a name is not a commit,
    /// a branch has no common commit with `HEAD`, or `git` fails.
    pub fn resolve(&self, folder: &Path) -> Result<ReviewSource, ResolveError> {
        let git = Git::new(folder);
        let git_folder = git_folder(&git, folder)?;
        let revisions = match self {
            Self::WorkingTree => Revisions {
                base: commit(&git, HEAD)?,
                head: None,
                merge_base: None,
                commits: Vec::new(),
            },
            Self::Branch { base } => {
                let head = commit(&git, HEAD)?;
                let merge_base = merge_base(&git, base, &head)?;
                let commits = commits_between(&git, &merge_base, &head)?;

                Revisions {
                    base: merge_base.clone(),
                    head: Some(head),
                    merge_base: Some(merge_base),
                    commits,
                }
            }
            Self::Range { from, to } => {
                let base = commit(&git, from)?;
                let head = commit(&git, to)?;
                let commits = commits_between(&git, &base, &head)?;

                Revisions {
                    base,
                    head: Some(head),
                    merge_base: None,
                    commits,
                }
            }
        };

        Ok(ReviewSource {
            identity: self.clone(),
            git_folder,
            base: revisions.base,
            head: revisions.head,
            merge_base: revisions.merge_base,
            commits: revisions.commits,
        })
    }
}

const HEAD: &str = "HEAD";

/// Git exits with this code when `rev-parse --verify --quiet` or `merge-base` finds nothing.
const NOT_FOUND_EXIT_CODE: i32 = 1;

struct Revisions {
    base: CommitId,
    head: Option<CommitId>,
    merge_base: Option<CommitId>,
    commits: Vec<CommitId>,
}

fn git_folder(git: &Git, folder: &Path) -> Result<PathBuf, ResolveError> {
    match git.run(&["rev-parse", "--absolute-git-dir"]) {
        Ok(path) => Ok(PathBuf::from(path)),
        Err(GitError::Failed { stderr, .. }) => Err(ResolveError::NotARepository {
            folder: folder.to_path_buf(),
            stderr,
        }),
        Err(error) => Err(error.into()),
    }
}

fn commit(git: &Git, name: &str) -> Result<CommitId, ResolveError> {
    let revision = format!("{name}^{{commit}}");

    match git.run(&[
        "rev-parse",
        "--verify",
        "--quiet",
        "--end-of-options",
        &revision,
    ]) {
        Ok(sha) => Ok(CommitId(sha)),
        Err(error) if is_not_found(&error) => Err(ResolveError::UnknownRef {
            name: name.to_owned(),
        }),
        Err(error) => Err(error.into()),
    }
}

fn merge_base(git: &Git, base: &str, head: &CommitId) -> Result<CommitId, ResolveError> {
    let base_commit = commit(git, base)?;

    match git.run(&["merge-base", base_commit.as_str(), head.as_str()]) {
        Ok(sha) => Ok(CommitId(sha)),
        Err(error) if is_not_found(&error) => Err(ResolveError::NoMergeBase {
            base: base.to_owned(),
            head: HEAD.to_owned(),
        }),
        Err(error) => Err(error.into()),
    }
}

fn commits_between(
    git: &Git,
    base: &CommitId,
    head: &CommitId,
) -> Result<Vec<CommitId>, ResolveError> {
    let range = format!("{}..{}", base.as_str(), head.as_str());
    let output = git.run(&["rev-list", "--reverse", "--topo-order", &range])?;

    Ok(output.lines().map(|sha| CommitId(sha.to_owned())).collect())
}

fn is_not_found(error: &GitError) -> bool {
    matches!(
        error,
        GitError::Failed {
            exit_code: Some(NOT_FOUND_EXIT_CODE),
            ..
        }
    )
}

#[cfg(test)]
mod tests {
    use super::{ParseError, SourceRequest};

    #[test]
    fn parse_accepts_the_three_source_forms() {
        let cases: [(&[&str], SourceRequest); 3] = [
            (&[], SourceRequest::WorkingTree),
            (
                &["main"],
                SourceRequest::Branch {
                    base: "main".to_owned(),
                },
            ),
            (
                &["v1.0..feature/x"],
                SourceRequest::Range {
                    from: "v1.0".to_owned(),
                    to: "feature/x".to_owned(),
                },
            ),
        ];

        for (arguments, expected) in cases {
            assert_eq!(
                SourceRequest::parse(arguments),
                Ok(expected),
                "arguments {arguments:?}"
            );
        }
    }

    #[test]
    fn parse_rejects_each_invalid_form_with_its_own_error() {
        let cases: [(&[&str], ParseError); 5] = [
            (
                &["..main"],
                ParseError::EmptyRangeSide {
                    argument: "..main".to_owned(),
                },
            ),
            (
                &["main.."],
                ParseError::EmptyRangeSide {
                    argument: "main..".to_owned(),
                },
            ),
            (
                &[".."],
                ParseError::EmptyRangeSide {
                    argument: "..".to_owned(),
                },
            ),
            (
                &["main...feature"],
                ParseError::SymmetricRange {
                    argument: "main...feature".to_owned(),
                },
            ),
            (
                &["main", "feature"],
                ParseError::TooManyArguments {
                    arguments: vec!["main".to_owned(), "feature".to_owned()],
                },
            ),
        ];

        for (arguments, expected) in cases {
            assert_eq!(
                SourceRequest::parse(arguments),
                Err(expected),
                "arguments {arguments:?}"
            );
        }
    }
}
