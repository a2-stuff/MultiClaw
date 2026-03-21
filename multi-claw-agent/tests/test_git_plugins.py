"""Tests for GitPluginManager."""
import json
import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from src.plugins.git_manager import GitPluginManager


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_skill(path: Path, name: str, description: str = "") -> None:
    """Write a SKILL.md with YAML frontmatter to *path*."""
    path.mkdir(parents=True, exist_ok=True)
    (path / "SKILL.md").write_text(
        f"---\nname: {name}\ndescription: {description}\n---\n\nBody text."
    )


def _fake_clone_ok(args, **kwargs):
    """Simulate a successful git clone by creating the target directory."""
    # args = ["git", "clone", "--depth", "1", repo_url, str(repo_dir)]
    repo_dir = Path(args[-1])
    repo_dir.mkdir(parents=True, exist_ok=True)
    return MagicMock(returncode=0, stdout="", stderr="")


def _fake_pull_ok(args, **kwargs):
    return MagicMock(returncode=0, stdout="Already up to date.", stderr="")


# ---------------------------------------------------------------------------
# check_git
# ---------------------------------------------------------------------------

def test_check_git_available(tmp_path):
    mgr = GitPluginManager(tmp_path)
    with patch("subprocess.run", return_value=MagicMock(returncode=0)):
        assert mgr.check_git() is True


def test_check_git_not_available(tmp_path):
    mgr = GitPluginManager(tmp_path)
    with patch("subprocess.run", side_effect=FileNotFoundError):
        assert mgr.check_git() is False


# ---------------------------------------------------------------------------
# install
# ---------------------------------------------------------------------------

def test_install_clones_repo_and_writes_plugin_json(tmp_path):
    mgr = GitPluginManager(tmp_path)

    def fake_clone(args, **kwargs):
        repo_dir = Path(args[-1])
        repo_dir.mkdir(parents=True, exist_ok=True)
        _make_skill(repo_dir / "skills" / "skill-a", "do-thing", "Does a thing")
        return MagicMock(returncode=0, stdout="", stderr="")

    with patch("subprocess.run", side_effect=fake_clone):
        result = mgr.install("My Plugin", "my-plugin", "https://example.com/repo.git")

    assert result["success"] is True
    assert result["name"] == "My Plugin"
    assert result["slug"] == "my-plugin"
    assert len(result["skills"]) == 1
    assert result["skills"][0]["name"] == "do-thing"

    plugin_json = tmp_path / "my-plugin" / "plugin.json"
    assert plugin_json.exists()
    data = json.loads(plugin_json.read_text())
    assert data["type"] == "git-plugin"


def test_install_idempotent_if_already_exists(tmp_path):
    mgr = GitPluginManager(tmp_path)
    repo_dir = tmp_path / "my-plugin" / "repo"
    repo_dir.mkdir(parents=True)
    _make_skill(repo_dir / "skills" / "sk", "existing-skill")

    # subprocess.run should NOT be called for clone when repo already exists
    with patch("subprocess.run") as mock_run:
        result = mgr.install("My Plugin", "my-plugin", "https://example.com/repo.git")

    mock_run.assert_not_called()
    assert result["success"] is True
    assert result["skills"][0]["name"] == "existing-skill"


def test_install_cleans_up_on_clone_failure(tmp_path):
    mgr = GitPluginManager(tmp_path)

    def fake_clone_fail(args, **kwargs):
        repo_dir = Path(args[-1])
        repo_dir.mkdir(parents=True, exist_ok=True)
        return MagicMock(returncode=1, stdout="", stderr="fatal: repo not found")

    with patch("subprocess.run", side_effect=fake_clone_fail):
        result = mgr.install("My Plugin", "my-plugin", "https://example.com/bad.git")

    assert result["success"] is False
    assert "git clone failed" in result["error"]
    # Plugin dir should be cleaned up
    assert not (tmp_path / "my-plugin").exists()


def test_install_succeeds_with_no_skills_directory(tmp_path):
    """Plugins without a skills/ directory are valid — skills are optional."""
    mgr = GitPluginManager(tmp_path)

    def fake_clone_no_skills(args, **kwargs):
        repo_dir = Path(args[-1])
        repo_dir.mkdir(parents=True, exist_ok=True)
        # No skills/ directory
        return MagicMock(returncode=0, stdout="", stderr="")

    with patch("subprocess.run", side_effect=fake_clone_no_skills):
        result = mgr.install("My Plugin", "my-plugin", "https://example.com/repo.git")

    assert result["success"] is True
    assert result["skills"] == []
    assert (tmp_path / "my-plugin").exists()


# ---------------------------------------------------------------------------
# discover_skills
# ---------------------------------------------------------------------------

def test_discover_skills_parses_frontmatter(tmp_path):
    mgr = GitPluginManager(tmp_path)
    skills_path = tmp_path / "skills"
    _make_skill(skills_path / "alpha", "skill-alpha", "Alpha skill")
    _make_skill(skills_path / "beta", "skill-beta", "Beta skill")

    skills = mgr.discover_skills(skills_path)
    names = {s["name"] for s in skills}
    assert names == {"skill-alpha", "skill-beta"}
    descriptions = {s["description"] for s in skills}
    assert "Alpha skill" in descriptions


def test_discover_skills_skips_malformed(tmp_path):
    mgr = GitPluginManager(tmp_path)
    skills_path = tmp_path / "skills"
    # Good skill
    _make_skill(skills_path / "good", "good-skill")
    # Malformed: no frontmatter at all
    bad_dir = skills_path / "bad"
    bad_dir.mkdir(parents=True)
    (bad_dir / "SKILL.md").write_text("No frontmatter here")
    # Invalid YAML in frontmatter
    ugly_dir = skills_path / "ugly"
    ugly_dir.mkdir(parents=True)
    (ugly_dir / "SKILL.md").write_text("---\n: bad: yaml: [\n---\n")

    skills = mgr.discover_skills(skills_path)
    assert len(skills) == 1
    assert skills[0]["name"] == "good-skill"


# ---------------------------------------------------------------------------
# update
# ---------------------------------------------------------------------------

def test_update_pulls_and_rescans(tmp_path):
    mgr = GitPluginManager(tmp_path)
    repo_dir = tmp_path / "my-plugin" / "repo"
    repo_dir.mkdir(parents=True)
    _make_skill(repo_dir / "skills" / "sk", "updated-skill", "Updated")
    # Write initial metadata
    mgr._write_metadata(tmp_path / "my-plugin", {"name": "My Plugin", "slug": "my-plugin", "skills": []})

    with patch("subprocess.run", side_effect=_fake_pull_ok):
        result = mgr.update("my-plugin")

    assert result["success"] is True
    assert result["skills"][0]["name"] == "updated-skill"


def test_update_returns_error_if_not_installed(tmp_path):
    mgr = GitPluginManager(tmp_path)
    result = mgr.update("nonexistent")
    assert result["success"] is False
    assert "not installed" in result["error"]


# ---------------------------------------------------------------------------
# uninstall
# ---------------------------------------------------------------------------

def test_uninstall_removes_directory(tmp_path):
    mgr = GitPluginManager(tmp_path)
    plugin_dir = tmp_path / "my-plugin"
    plugin_dir.mkdir()
    (plugin_dir / "plugin.json").write_text("{}")

    assert mgr.uninstall("my-plugin") is True
    assert not plugin_dir.exists()


def test_uninstall_nonexistent_returns_false(tmp_path):
    mgr = GitPluginManager(tmp_path)
    assert mgr.uninstall("does-not-exist") is False


# ---------------------------------------------------------------------------
# get_skills
# ---------------------------------------------------------------------------

def test_get_skills_reads_from_metadata(tmp_path):
    mgr = GitPluginManager(tmp_path)
    plugin_dir = tmp_path / "my-plugin"
    mgr._write_metadata(
        plugin_dir,
        {
            "name": "My Plugin",
            "slug": "my-plugin",
            "type": "git-plugin",
            "skills": [{"name": "skill-a", "description": "Skill A"}],
        },
    )

    skills = mgr.get_skills("my-plugin")
    assert len(skills) == 1
    assert skills[0]["name"] == "skill-a"


def test_get_skills_returns_empty_if_not_installed(tmp_path):
    mgr = GitPluginManager(tmp_path)
    assert mgr.get_skills("nonexistent") == []


# ---------------------------------------------------------------------------
# detect_version
# ---------------------------------------------------------------------------

def test_detect_version_from_package_json(tmp_path):
    mgr = GitPluginManager(tmp_path)
    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()
    (repo_dir / "package.json").write_text(json.dumps({"name": "mypkg", "version": "1.2.3"}))

    assert mgr.detect_version(repo_dir) == "1.2.3"


def test_detect_version_from_claude_plugin_json(tmp_path):
    mgr = GitPluginManager(tmp_path)
    repo_dir = tmp_path / "repo"
    claude_plugin_dir = repo_dir / ".claude-plugin"
    claude_plugin_dir.mkdir(parents=True)
    (claude_plugin_dir / "plugin.json").write_text(json.dumps({"version": "2.0.0"}))

    assert mgr.detect_version(repo_dir) == "2.0.0"


def test_detect_version_prefers_package_json(tmp_path):
    mgr = GitPluginManager(tmp_path)
    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()
    (repo_dir / "package.json").write_text(json.dumps({"version": "3.0.0"}))
    claude_plugin_dir = repo_dir / ".claude-plugin"
    claude_plugin_dir.mkdir()
    (claude_plugin_dir / "plugin.json").write_text(json.dumps({"version": "9.9.9"}))

    assert mgr.detect_version(repo_dir) == "3.0.0"


def test_detect_version_returns_none_if_no_files(tmp_path):
    mgr = GitPluginManager(tmp_path)
    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()
    assert mgr.detect_version(repo_dir) is None


# ---------------------------------------------------------------------------
# is_git_plugin
# ---------------------------------------------------------------------------

def test_is_git_plugin_true(tmp_path):
    mgr = GitPluginManager(tmp_path)
    mgr._write_metadata(
        tmp_path / "my-slug",
        {"name": "My Plugin", "slug": "my-slug", "type": "git-plugin"},
    )
    assert mgr.is_git_plugin("My Plugin") is True


def test_is_git_plugin_false_for_regular_plugin(tmp_path):
    mgr = GitPluginManager(tmp_path)
    mgr._write_metadata(
        tmp_path / "my-slug",
        {"name": "My Plugin", "slug": "my-slug", "type": "plugin"},
    )
    assert mgr.is_git_plugin("My Plugin") is False


def test_is_git_plugin_false_when_no_plugins(tmp_path):
    mgr = GitPluginManager(tmp_path)
    assert mgr.is_git_plugin("anything") is False
