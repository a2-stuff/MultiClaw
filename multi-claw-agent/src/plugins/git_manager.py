import json
import logging
import os
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)


class GitPluginManager:
    def __init__(self, plugins_dir: Path):
        self.plugins_dir = Path(plugins_dir)
        self.plugins_dir.mkdir(parents=True, exist_ok=True)

    def check_git(self) -> bool:
        """Return True if git is available on PATH."""
        try:
            result = subprocess.run(
                ["git", "--version"],
                capture_output=True,
                timeout=10,
            )
            return result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False

    def install(
        self,
        name: str,
        slug: str,
        repo_url: str,
        manifest: dict | None = None,
        env_vars: dict | None = None,
    ) -> dict:
        """
        Shallow-clone repo_url into plugins_dir/slug/repo/.
        Discovers SKILL.md files, writes plugin.json, and returns metadata dict.
        Idempotent: if the repo directory already exists, skips clone.
        Cleans up on failure.

        If *manifest* is provided, runs manifest-driven post-install steps
        instead of the generic auto-detect logic.  *env_vars* are injected
        into the subprocess environment for manifest steps.
        """
        from src.plugins.manifest import ManifestRunner, parse_manifest

        # Validate repo URL
        if not repo_url.startswith(("https://", "git@")):
            return {"success": False, "error": "Only HTTPS and SSH git URLs are allowed"}
        # Validate slug format
        if not re.match(r"^[a-zA-Z0-9_\-]+$", slug):
            return {"success": False, "error": f"Invalid slug format: {slug}"}

        plugin_dir = self.plugins_dir / slug
        repo_dir = plugin_dir / "repo"

        already_exists = repo_dir.exists()

        if not already_exists:
            plugin_dir.mkdir(parents=True, exist_ok=True)
            try:
                result = subprocess.run(
                    ["git", "clone", "--depth", "1", repo_url, str(repo_dir)],
                    capture_output=True,
                    text=True,
                    timeout=120,
                )
                if result.returncode != 0:
                    shutil.rmtree(plugin_dir, ignore_errors=True)
                    return {
                        "success": False,
                        "error": f"git clone failed: {result.stderr.strip()}",
                    }
            except subprocess.TimeoutExpired:
                shutil.rmtree(plugin_dir, ignore_errors=True)
                return {"success": False, "error": "git clone timed out"}
            except Exception as e:
                shutil.rmtree(plugin_dir, ignore_errors=True)
                return {"success": False, "error": str(e)}

        # Run post-install: manifest-driven if provided, else generic auto-detect
        install_result: dict = {"method": "none"}
        step_results: list[dict] = []

        if manifest:
            parsed = parse_manifest(manifest)
            runner = ManifestRunner(self.plugins_dir)
            for step_res in runner.run_post_install_steps(
                slug, parsed, env_vars=env_vars, plugin_dir=repo_dir
            ):
                step_results.append({
                    "step_id": step_res.step_id,
                    "status": step_res.status,
                    "output": step_res.output,
                    "error": step_res.error,
                })
            install_result["method"] = "manifest"
            failed_steps = [s for s in step_results if s["status"] == "failed"]
            if failed_steps:
                install_result["error"] = "; ".join(
                    f"{s['step_id']}: {s['error']}" for s in failed_steps
                )
        else:
            install_result = self._run_post_install(slug, plugin_dir, repo_dir)

        # Discover skills (optional — not all plugins have a skills/ dir)
        skills_path = repo_dir / "skills"
        skills = self.discover_skills(skills_path) if skills_path.exists() else []
        version = self.detect_version(repo_dir)

        metadata = {
            "name": name,
            "slug": slug,
            "repo_url": repo_url,
            "type": "git-plugin",
            "installed_at": datetime.now(timezone.utc).isoformat(),
            "enabled": True,
            "skills": skills,
            "install_method": install_result.get("method", "none"),
        }
        if version:
            metadata["version"] = version
        if install_result.get("container_id"):
            metadata["container_id"] = install_result["container_id"]
            metadata["container_name"] = f"multiclaw-{slug}"
        if install_result.get("log_file"):
            metadata["install_log"] = install_result["log_file"]
        # Persist manifest for health checks
        if manifest:
            metadata["manifest"] = manifest
        if step_results:
            metadata["post_install_steps"] = step_results

        self._write_metadata(plugin_dir, metadata)

        result = {"success": True, **metadata}
        if install_result.get("error"):
            result["install_warning"] = install_result["error"]
        return result

    def update(self, slug: str) -> dict:
        """Run git pull in the repo directory, then re-scan skills."""
        plugin_dir = self.plugins_dir / slug
        repo_dir = plugin_dir / "repo"

        if not repo_dir.exists():
            return {"success": False, "error": f"Plugin '{slug}' is not installed"}

        try:
            result = subprocess.run(
                ["git", "-C", str(repo_dir), "pull"],
                capture_output=True,
                text=True,
                timeout=120,
            )
            if result.returncode != 0:
                return {
                    "success": False,
                    "error": f"git pull failed: {result.stderr.strip()}",
                }
        except subprocess.TimeoutExpired:
            return {"success": False, "error": "git pull timed out"}
        except Exception as e:
            return {"success": False, "error": str(e)}

        # Re-scan skills and update metadata
        skills_path = repo_dir / "skills"
        skills = self.discover_skills(skills_path) if skills_path.exists() else []
        version = self.detect_version(repo_dir)

        existing = self.get_metadata(slug) or {}
        existing["skills"] = skills
        existing["updated_at"] = datetime.now(timezone.utc).isoformat()
        if version:
            existing["version"] = version

        self._write_metadata(plugin_dir, existing)
        return {"success": True, "output": result.stdout.strip(), **existing}

    def uninstall(self, slug: str) -> bool:
        """Remove the plugin directory and clean up containers. Returns True on success."""
        plugin_dir = self.plugins_dir / slug
        if not plugin_dir.exists():
            return False

        # Clean up Docker container/image if applicable
        meta = self.get_metadata(slug)
        if meta:
            container_name = meta.get("container_name")
            if container_name:
                self._docker_cleanup(container_name, slug)

            # Run uninstall.sh if present
            repo_dir = plugin_dir / "repo"
            uninstall_sh = repo_dir / "uninstall.sh"
            if uninstall_sh.exists():
                try:
                    safe_env = {
                        "PATH": "/usr/local/bin:/usr/bin:/bin",
                        "HOME": str(repo_dir),
                        "LANG": "C.UTF-8",
                    }
                    subprocess.run(
                        ["bash", str(uninstall_sh)],
                        cwd=str(repo_dir),
                        capture_output=True,
                        text=True,
                        timeout=300,
                        env=safe_env,
                    )
                except Exception as e:
                    logger.warning("uninstall.sh failed for %s: %s", slug, e)

        shutil.rmtree(plugin_dir)
        return True

    def get_skills(self, slug: str) -> list[dict]:
        """Return the skills list from plugin.json."""
        meta = self.get_metadata(slug)
        if meta is None:
            return []
        return meta.get("skills", [])

    def get_metadata(self, slug: str) -> dict | None:
        """Read and return plugin.json as a dict, or None if not found."""
        plugin_json = self.plugins_dir / slug / "plugin.json"
        if not plugin_json.exists():
            return None
        try:
            return json.loads(plugin_json.read_text())
        except Exception:
            return None

    def is_git_plugin(self, name: str) -> bool:
        """
        Check whether the installed plugin identified by *name* is a git-plugin.
        Searches all slug directories for a plugin.json whose 'name' field matches.
        """
        if not self.plugins_dir.exists():
            return False
        for slug_dir in self.plugins_dir.iterdir():
            if not slug_dir.is_dir():
                continue
            meta = self.get_metadata(slug_dir.name)
            if meta and meta.get("name") == name and meta.get("type") == "git-plugin":
                return True
        return False

    def discover_skills(self, skills_path: Path) -> list[dict]:
        """
        Recursively find SKILL.md files under skills_path.
        Parse YAML frontmatter for 'name' and 'description'.
        Skip files with malformed or missing frontmatter.
        """
        skills = []
        for skill_file in Path(skills_path).rglob("SKILL.md"):
            try:
                content = skill_file.read_text(encoding="utf-8")
                parsed = self._parse_frontmatter(content)
                if parsed and parsed.get("name"):
                    skills.append(
                        {
                            "name": parsed["name"],
                            "description": parsed.get("description", ""),
                        }
                    )
            except Exception as e:
                logger.debug("Skipping %s: %s", skill_file, e)
        return skills

    def detect_version(self, repo_dir: Path) -> str | None:
        """
        Try to detect a version string from the repo.
        Checks package.json first, then .claude-plugin/plugin.json.
        """
        package_json = repo_dir / "package.json"
        if package_json.exists():
            try:
                data = json.loads(package_json.read_text())
                v = data.get("version")
                if v:
                    return str(v)
            except Exception:
                pass

        claude_plugin_json = repo_dir / ".claude-plugin" / "plugin.json"
        if claude_plugin_json.exists():
            try:
                data = json.loads(claude_plugin_json.read_text())
                v = data.get("version")
                if v:
                    return str(v)
            except Exception:
                pass

        return None

    def _run_post_install(self, slug: str, plugin_dir: Path, repo_dir: Path) -> dict:
        """
        Run post-install setup after git clone. Checks in priority order:
        1. Dockerfile → docker build + docker run
        2. install.sh → bash install.sh
        3. requirements.txt → pip install -r
        4. pyproject.toml with [project] → pip install -e .
        5. None of the above → no-op
        Returns dict with method, optional container_id, log_file, error.
        """
        log_file = str(plugin_dir / "install.log")

        # 1. Dockerfile
        dockerfile = repo_dir / "Dockerfile"
        if dockerfile.exists():
            return self._install_via_docker(slug, repo_dir, log_file)

        # 2. install.sh
        install_sh = repo_dir / "install.sh"
        if install_sh.exists():
            return self._install_via_script(repo_dir, install_sh, log_file)

        # 3. requirements.txt
        requirements = repo_dir / "requirements.txt"
        if requirements.exists():
            return self._install_via_pip(repo_dir, ["pip", "install", "-r", str(requirements)], log_file)

        # 4. pyproject.toml
        pyproject = repo_dir / "pyproject.toml"
        if pyproject.exists():
            try:
                content = pyproject.read_text()
                if "[project]" in content:
                    return self._install_via_pip(repo_dir, ["pip", "install", "-e", str(repo_dir)], log_file)
            except Exception:
                pass

        return {"method": "none"}

    def _install_via_docker(self, slug: str, repo_dir: Path, log_file: str) -> dict:
        """Build Docker image and run container."""
        image_name = f"multiclaw-plugin-{slug}"
        container_name = f"multiclaw-{slug}"

        try:
            # Build
            build_result = subprocess.run(
                ["docker", "build", "-t", image_name, str(repo_dir)],
                capture_output=True,
                text=True,
                timeout=600,  # 10 min for build
            )
            Path(log_file).write_text(
                f"=== docker build ===\n{build_result.stdout}\n{build_result.stderr}\n"
            )
            if build_result.returncode != 0:
                return {
                    "method": "dockerfile",
                    "log_file": log_file,
                    "error": f"docker build failed: {build_result.stderr.strip()[:200]}",
                }

            # Stop and remove any existing container with the same name
            subprocess.run(
                ["docker", "rm", "-f", container_name],
                capture_output=True, timeout=30,
            )

            # Run
            run_result = subprocess.run(
                ["docker", "run", "-d", "--name", container_name,
                 "--restart", "unless-stopped",
                 "--memory", "512m",
                 "--cpus", "1.0",
                 "--read-only",
                 "--tmpfs", "/tmp:size=100m",
                 image_name],
                capture_output=True,
                text=True,
                timeout=60,
            )
            with open(log_file, "a") as f:
                f.write(f"\n=== docker run ===\n{run_result.stdout}\n{run_result.stderr}\n")

            if run_result.returncode != 0:
                return {
                    "method": "dockerfile",
                    "log_file": log_file,
                    "error": f"docker run failed: {run_result.stderr.strip()[:200]}",
                }

            container_id = run_result.stdout.strip()[:12]
            logger.info("Plugin %s running in container %s", slug, container_id)
            return {
                "method": "dockerfile",
                "container_id": container_id,
                "log_file": log_file,
            }

        except subprocess.TimeoutExpired:
            return {"method": "dockerfile", "log_file": log_file, "error": "Docker build/run timed out"}
        except FileNotFoundError:
            return {"method": "dockerfile", "log_file": log_file, "error": "Docker not found on PATH"}
        except Exception as e:
            return {"method": "dockerfile", "log_file": log_file, "error": str(e)}

    def _install_via_script(self, repo_dir: Path, script: Path, log_file: str) -> dict:
        """Run install.sh with restricted environment and 5-minute timeout."""
        if not script.resolve().is_relative_to(repo_dir.resolve()):
            return {"method": "script", "log_file": log_file, "error": "Script path escapes repo directory"}

        safe_env = {
            "PATH": "/usr/local/bin:/usr/bin:/bin",
            "HOME": str(repo_dir),
            "LANG": "C.UTF-8",
            "PLUGIN_DIR": str(repo_dir),
        }

        logger.info("Running install.sh for %s (cwd: %s)", repo_dir.parent.name, repo_dir)
        try:
            result = subprocess.run(
                ["bash", str(script)],
                cwd=str(repo_dir),
                capture_output=True,
                text=True,
                timeout=300,
                env=safe_env,
            )
            Path(log_file).write_text(
                f"=== install.sh ===\n{result.stdout}\n{result.stderr}\n"
            )
            if result.returncode != 0:
                return {
                    "method": "script",
                    "log_file": log_file,
                    "error": f"install.sh failed (exit {result.returncode}): {result.stderr.strip()[:200]}",
                }
            logger.info("install.sh completed for %s", repo_dir.parent.name)
            return {"method": "script", "log_file": log_file}
        except subprocess.TimeoutExpired:
            return {"method": "script", "log_file": log_file, "error": "install.sh timed out (5m)"}
        except Exception as e:
            return {"method": "script", "log_file": log_file, "error": str(e)}

    def _install_via_pip(self, repo_dir: Path, cmd: list[str], log_file: str) -> dict:
        """Run pip install with restricted environment."""
        safe_env = {
            "PATH": "/usr/local/bin:/usr/bin:/bin",
            "HOME": str(repo_dir),
            "LANG": "C.UTF-8",
        }
        venv = os.environ.get("VIRTUAL_ENV", "")
        if venv:
            safe_env["VIRTUAL_ENV"] = venv
        try:
            result = subprocess.run(
                cmd, cwd=str(repo_dir), capture_output=True, text=True,
                timeout=300, env=safe_env,
            )
            Path(log_file).write_text(
                f"=== pip install ===\n{result.stdout}\n{result.stderr}\n"
            )
            if result.returncode != 0:
                return {
                    "method": "pip",
                    "log_file": log_file,
                    "error": f"pip install failed: {result.stderr.strip()[:200]}",
                }
            logger.info("pip install completed for %s", repo_dir.parent.name)
            return {"method": "pip", "log_file": log_file}
        except subprocess.TimeoutExpired:
            return {"method": "pip", "log_file": log_file, "error": "pip install timed out (5m)"}
        except Exception as e:
            return {"method": "pip", "log_file": log_file, "error": str(e)}

    def _docker_cleanup(self, container_name: str, slug: str) -> None:
        """Stop and remove Docker container and image."""
        image_name = f"multiclaw-plugin-{slug}"
        try:
            subprocess.run(["docker", "stop", container_name], capture_output=True, timeout=30)
            subprocess.run(["docker", "rm", container_name], capture_output=True, timeout=30)
            subprocess.run(["docker", "rmi", image_name], capture_output=True, timeout=30)
            logger.info("Cleaned up Docker resources for %s", slug)
        except Exception as e:
            logger.warning("Docker cleanup failed for %s: %s", slug, e)

    def _write_metadata(self, plugin_dir: Path, metadata: dict) -> None:
        """Serialise metadata to plugin_dir/plugin.json."""
        plugin_dir.mkdir(parents=True, exist_ok=True)
        plugin_json = plugin_dir / "plugin.json"
        plugin_json.write_text(json.dumps(metadata, indent=2, default=str))

    def _parse_frontmatter(self, content: str) -> dict | None:
        """
        Parse YAML frontmatter delimited by '---' lines.
        Returns parsed dict, or None if no valid frontmatter found.
        """
        content = content.lstrip()
        if not content.startswith("---"):
            return None
        # Split off the opening '---'
        rest = content[3:]
        # Find the closing '---'
        close_idx = rest.find("---")
        if close_idx == -1:
            return None
        yaml_block = rest[:close_idx].strip()
        try:
            parsed = yaml.safe_load(yaml_block)
            if isinstance(parsed, dict):
                return parsed
        except yaml.YAMLError:
            pass
        return None
