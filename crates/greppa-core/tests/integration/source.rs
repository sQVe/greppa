use greppa_core::{CommitId, GitError, ResolveError, SourceRequest};

use crate::repository::{TestRepository, git};

fn shas(commits: &[CommitId]) -> Vec<&str> {
    commits.iter().map(|commit| commit.as_str()).collect()
}

#[test]
fn branch_source_reviews_the_commits_since_the_merge_base() {
    let repository = TestRepository::new();

    repository.commit("first on main");
    let fork = repository.commit("second on main");
    repository.switch_new_branch("feature");
    let tip = repository.commit("on feature");

    let request = SourceRequest::Branch {
        base: "main".to_owned(),
    };
    let source = request.resolve(repository.path()).expect("resolve main");

    assert_eq!(source.base().as_str(), fork);
    assert_eq!(
        source.merge_base().map(|commit| commit.as_str()),
        Some(fork.as_str())
    );
    assert_eq!(
        source.head().map(|commit| commit.as_str()),
        Some(tip.as_str())
    );
    assert_eq!(shas(source.commits()), [tip.as_str()]);
}

#[test]
fn branch_source_follows_a_moved_base_branch_with_the_same_identity() {
    let repository = TestRepository::new();

    let fork = repository.commit("on main");
    repository.switch_new_branch("feature");
    let first = repository.commit("first on feature");
    let tip = repository.commit("second on feature");
    let request = SourceRequest::Branch {
        base: "main".to_owned(),
    };
    let before = request.resolve(repository.path()).expect("resolve main");

    repository.move_branch("main", &first);
    let after = request
        .resolve(repository.path())
        .expect("resolve moved main");

    assert_eq!(before.base().as_str(), fork);
    assert_eq!(after.base().as_str(), first);
    assert_eq!(
        after.merge_base().map(|commit| commit.as_str()),
        Some(first.as_str())
    );
    assert_eq!(shas(after.commits()), [tip.as_str()]);
    assert_eq!(before.identity(), after.identity());
    assert_eq!(after.identity(), &request);
}

#[test]
fn working_tree_source_has_head_as_base_and_no_commits() {
    let repository = TestRepository::new();

    let head = repository.commit("only commit");
    let source = SourceRequest::WorkingTree
        .resolve(repository.path())
        .expect("resolve the working tree");

    assert_eq!(source.base().as_str(), head);
    assert_eq!(source.head(), None);
    assert_eq!(source.merge_base(), None);
    assert!(source.commits().is_empty());
    assert_eq!(source.identity(), &SourceRequest::WorkingTree);
    assert_eq!(
        source.git_folder(),
        repository
            .path()
            .join(".git")
            .canonicalize()
            .expect("canonical Git folder")
    );
}

#[test]
fn range_source_reviews_the_commits_from_one_ref_to_the_other_oldest_first() {
    let repository = TestRepository::new();

    let start = repository.commit("start");
    let middle = repository.commit("middle");
    let end = repository.commit("end");
    repository.git(&["tag", "start-tag", &start]);

    let request = SourceRequest::Range {
        from: "start-tag".to_owned(),
        to: "main".to_owned(),
    };
    let source = request
        .resolve(repository.path())
        .expect("resolve the range");

    assert_eq!(source.base().as_str(), start);
    assert_eq!(
        source.head().map(|commit| commit.as_str()),
        Some(end.as_str())
    );
    assert_eq!(source.merge_base(), None);
    assert_eq!(shas(source.commits()), [middle.as_str(), end.as_str()]);
}

#[test]
fn range_source_resolves_branches_with_unrelated_histories() {
    let repository = TestRepository::new();

    let main = repository.commit("on main");
    repository.switch_orphan_branch("other");
    let other = repository.commit("on other");

    let request = SourceRequest::Range {
        from: "main".to_owned(),
        to: "other".to_owned(),
    };
    let source = request
        .resolve(repository.path())
        .expect("resolve the range");

    assert_eq!(source.base().as_str(), main);
    assert_eq!(
        source.head().map(|commit| commit.as_str()),
        Some(other.as_str())
    );
    assert_eq!(shas(source.commits()), [other.as_str()]);
}

#[test]
fn linked_worktree_source_reports_the_worktree_git_folder() {
    let repository = TestRepository::new();
    let worktrees = tempfile::tempdir().expect("create a temporary directory");
    let worktree = worktrees.path().join("review");

    repository.commit("on main");
    repository.git(&[
        "worktree",
        "add",
        "--quiet",
        "-b",
        "review-branch",
        worktree.to_str().expect("temporary paths are UTF-8"),
    ]);
    git(
        &worktree,
        &["commit", "--quiet", "--allow-empty", "-m", "in worktree"],
    );
    let tip = git(&worktree, &["rev-parse", "HEAD"]);

    let request = SourceRequest::Branch {
        base: "main".to_owned(),
    };
    let source = request
        .resolve(&worktree)
        .expect("resolve from the worktree");

    assert!(
        source.git_folder().ends_with("worktrees/review"),
        "Git folder {}",
        source.git_folder().display()
    );
    assert!(source.git_folder().is_absolute());
    assert_eq!(shas(source.commits()), [tip.as_str()]);
}

#[test]
fn resolve_names_an_unknown_ref() {
    let repository = TestRepository::new();

    repository.commit("on main");

    let requests = [
        SourceRequest::Branch {
            base: "missing".to_owned(),
        },
        SourceRequest::Range {
            from: "main".to_owned(),
            to: "missing".to_owned(),
        },
    ];

    for request in requests {
        let result = request.resolve(repository.path());

        assert!(
            matches!(&result, Err(ResolveError::UnknownRef { name }) if name == "missing"),
            "request {request:?} gave {result:?}"
        );
    }
}

#[test]
fn resolve_names_a_folder_that_is_no_repository() {
    let folder = tempfile::tempdir().expect("create a temporary directory");

    let result = SourceRequest::WorkingTree.resolve(folder.path());

    assert!(
        matches!(&result, Err(ResolveError::NotARepository { folder: reported, .. }) if reported == folder.path()),
        "gave {result:?}"
    );
}

#[test]
fn branch_source_names_both_sides_when_there_is_no_merge_base() {
    let repository = TestRepository::new();

    repository.commit("on main");
    repository.switch_orphan_branch("other");
    repository.commit("on other");

    let request = SourceRequest::Branch {
        base: "main".to_owned(),
    };
    let result = request.resolve(repository.path());

    assert!(
        matches!(&result, Err(ResolveError::NoMergeBase { base, head }) if base == "main" && head == "HEAD"),
        "gave {result:?}"
    );
}

#[test]
fn resolve_reports_a_failed_ref_lookup_as_a_git_failure() {
    let repository = TestRepository::new();

    let fork = repository.commit("on main");
    repository.switch_new_branch("feature");
    repository.commit("on feature");
    repository.git(&["branch", "broken", &fork]);
    repository.corrupt_object(&fork);

    let request = SourceRequest::Branch {
        base: "broken".to_owned(),
    };
    let result = request.resolve(repository.path());

    assert!(
        matches!(&result, Err(ResolveError::Git(GitError::Failed { command, exit_code, .. })) if command.contains("rev-parse") && *exit_code != Some(1)),
        "gave {result:?}"
    );
}

#[test]
fn branch_source_reports_a_failed_merge_base_as_a_git_failure() {
    let repository = TestRepository::new();

    let root = repository.commit("root");
    repository.commit("on main");
    repository.switch_new_branch("feature");
    repository.git(&["reset", "--quiet", "--hard", &root]);
    repository.commit("on feature");
    repository.corrupt_object(&root);

    let request = SourceRequest::Branch {
        base: "main".to_owned(),
    };
    let result = request.resolve(repository.path());

    assert!(
        matches!(&result, Err(ResolveError::Git(GitError::Failed { command, exit_code, .. })) if command.contains("merge-base") && *exit_code != Some(1)),
        "gave {result:?}"
    );
}
