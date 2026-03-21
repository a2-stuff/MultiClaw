"""
Plugin manifest models and execution engine.

Each plugin declares its env vars, dependencies, post-install steps, and
health checks in a PluginManifest.  The ManifestRunner executes those
declarations on the agent host.
"""

import logging
import os
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Generator

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class PluginEnvVar:
    name: str
    description: str
    required: bool = False
    secret: bool = False
    auto_generate: str | None = None
    validation_regex: str | None = None
    default_value: str | None = None


@dataclass
class PluginDependency:
    slug: str
    reason: str


@dataclass
class PluginPostStep:
    id: str
    label: str
    type: str  # "command" | "script" | "copy-skills" | "verify"
    command: str | None = None
    timeout: int = 300


@dataclass
class PluginHealthCheck:
    type: str  # "command" | "http" | "python-import" | "file-exists"
    description: str
    command: str | None = None
    url: str | None = None
    import_path: str | None = None
    file_path: str | None = None


@dataclass
class PluginManifest:
    env_vars: list[PluginEnvVar] = field(default_factory=list)
    dependencies: list[PluginDependency] = field(default_factory=list)
    system_requirements: list[str] = field(default_factory=list)
    post_install_steps: list[PluginPostStep] = field(default_factory=list)
    uninstall_steps: list[PluginPostStep] = field(default_factory=list)
    health_checks: list[PluginHealthCheck] = field(default_factory=list)


@dataclass
class StepResult:
    step_id: str
    status: str  # "success" | "failed" | "skipped"
    output: str = ""
    error: str = ""


@dataclass
class HealthCheckResult:
    type: str
    description: str
    passed: bool
    output: str = ""
    error: str = ""


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

def parse_manifest(data: dict[str, Any]) -> PluginManifest:
    """Parse a manifest dict (from JSON) into a PluginManifest."""
    env_vars = [
        PluginEnvVar(
            name=v["name"],
            description=v.get("description", ""),
            required=v.get("required", False),
            secret=v.get("secret", False),
            auto_generate=v.get("autoGenerate"),
            validation_regex=v.get("validationRegex"),
            default_value=v.get("defaultValue"),
        )
        for v in data.get("envVars", [])
    ]
    dependencies = [
        PluginDependency(slug=d["slug"], reason=d.get("reason", ""))
        for d in data.get("dependencies", [])
    ]
    post_install_steps = [
        PluginPostStep(
            id=s["id"],
            label=s["label"],
            type=s["type"],
            command=s.get("command"),
            timeout=s.get("timeout", 300),
        )
        for s in data.get("postInstallSteps", [])
    ]
    uninstall_steps = [
        PluginPostStep(
            id=s["id"],
            label=s["label"],
            type=s["type"],
            command=s.get("command"),
            timeout=s.get("timeout", 300),
        )
        for s in data.get("uninstallSteps", [])
    ]
    health_checks = [
        PluginHealthCheck(
            type=h["type"],
            description=h["description"],
            command=h.get("command"),
            url=h.get("url"),
            import_path=h.get("importPath"),
            file_path=h.get("filePath"),
        )
        for h in data.get("healthChecks", [])
    ]
    return PluginManifest(
        env_vars=env_vars,
        dependencies=dependencies,
        system_requirements=data.get("systemRequirements", []),
        post_install_steps=post_install_steps,
        uninstall_steps=uninstall_steps,
        health_checks=health_checks,
    )


# ---------------------------------------------------------------------------
# ManifestRunner
# ---------------------------------------------------------------------------

class ManifestRunner:
    """Executes manifest-declared post-install steps and health checks."""

    def __init__(self, plugins_dir: Path):
        self.plugins_dir = Path(plugins_dir)

    # -- dependency / requirement checks ------------------------------------

    def check_dependencies(
        self, manifest: PluginManifest, installed_slugs: set[str]
    ) -> list[str]:
        """Return slugs of missing plugin dependencies."""
        return [
            d.slug for d in manifest.dependencies
            if d.slug not in installed_slugs
        ]

    def check_system_requirements(
        self, manifest: PluginManifest
    ) -> list[str]:
        """Return names of missing system-level requirements."""
        missing = []
        checks = {
            "docker": ["docker", "--version"],
            "nodejs": ["node", "--version"],
            "npm": ["npm", "--version"],
            "pnpm": ["pnpm", "--version"],
            "python": ["python3", "--version"],
            "pip": ["pip3", "--version"],
        }
        for req in manifest.system_requirements:
            cmd = checks.get(req)
            if cmd is None:
                continue
            try:
                result = subprocess.run(
                    cmd, capture_output=True, timeout=10
                )
                if result.returncode != 0:
                    missing.append(req)
            except (FileNotFoundError, subprocess.TimeoutExpired):
                missing.append(req)
        return missing

    # -- post-install steps -------------------------------------------------

    def run_post_install_steps(
        self,
        slug: str,
        manifest: PluginManifest,
        env_vars: dict[str, str] | None = None,
        plugin_dir: Path | None = None,
    ) -> Generator[StepResult, None, None]:
        """
        Execute each post-install step sequentially, yielding a StepResult
        after each.  Env vars from the deploy request are injected into the
        subprocess environment.
        """
        work_dir = plugin_dir or (self.plugins_dir / slug / "repo")
        run_env = self._build_env(env_vars, work_dir)

        for step in manifest.post_install_steps:
            logger.info("Plugin %s: running step '%s' (%s)", slug, step.label, step.id)
            result = self._execute_step(step, run_env, work_dir)
            yield result
            if result.status == "failed":
                logger.warning(
                    "Plugin %s: step '%s' failed: %s", slug, step.id, result.error
                )

    def _execute_step(
        self, step: PluginPostStep, env: dict[str, str], cwd: Path
    ) -> StepResult:
        """Run a single post-install step."""
        if step.type == "command" and step.command:
            return self._run_command(step, env, cwd)
        elif step.type == "script" and step.command:
            return self._run_script(step, env, cwd)
        elif step.type == "verify" and step.command:
            return self._run_command(step, env, cwd)
        elif step.type == "copy-skills":
            return self._copy_skills(step, cwd)
        else:
            return StepResult(
                step_id=step.id,
                status="skipped",
                output=f"Unknown or incomplete step type: {step.type}",
            )

    def _run_command(
        self, step: PluginPostStep, env: dict[str, str], cwd: Path
    ) -> StepResult:
        """Run a shell command."""
        try:
            result = subprocess.run(
                step.command,
                shell=True,
                cwd=str(cwd) if cwd.exists() else None,
                capture_output=True,
                text=True,
                timeout=step.timeout,
                env=env,
            )
            if result.returncode == 0:
                return StepResult(
                    step_id=step.id,
                    status="success",
                    output=result.stdout.strip()[:2000],
                )
            return StepResult(
                step_id=step.id,
                status="failed",
                output=result.stdout.strip()[:1000],
                error=result.stderr.strip()[:1000],
            )
        except subprocess.TimeoutExpired:
            return StepResult(
                step_id=step.id,
                status="failed",
                error=f"Timed out after {step.timeout}s",
            )
        except Exception as e:
            return StepResult(step_id=step.id, status="failed", error=str(e))

    def _run_script(
        self, step: PluginPostStep, env: dict[str, str], cwd: Path
    ) -> StepResult:
        """Run a script file (bash)."""
        script_path = cwd / step.command if step.command else None
        if not script_path or not script_path.exists():
            return StepResult(
                step_id=step.id,
                status="failed",
                error=f"Script not found: {step.command}",
            )
        try:
            result = subprocess.run(
                ["bash", str(script_path)],
                cwd=str(cwd),
                capture_output=True,
                text=True,
                timeout=step.timeout,
                env=env,
            )
            if result.returncode == 0:
                return StepResult(
                    step_id=step.id,
                    status="success",
                    output=result.stdout.strip()[:2000],
                )
            return StepResult(
                step_id=step.id,
                status="failed",
                output=result.stdout.strip()[:1000],
                error=result.stderr.strip()[:1000],
            )
        except subprocess.TimeoutExpired:
            return StepResult(
                step_id=step.id,
                status="failed",
                error=f"Script timed out after {step.timeout}s",
            )
        except Exception as e:
            return StepResult(step_id=step.id, status="failed", error=str(e))

    def _copy_skills(self, step: PluginPostStep, repo_dir: Path) -> StepResult:
        """Copy skills from plugin repo to agent skills directory."""
        import shutil

        skills_src = repo_dir / "skills"
        if not skills_src.exists():
            return StepResult(
                step_id=step.id,
                status="skipped",
                output="No skills/ directory in plugin repo",
            )

        # Target: ~/.claude/skills/<plugin-slug>/
        home = Path.home()
        target = home / ".claude" / "skills"
        target.mkdir(parents=True, exist_ok=True)

        copied = 0
        for skill_dir in skills_src.iterdir():
            if skill_dir.is_dir():
                dest = target / skill_dir.name
                if dest.exists():
                    shutil.rmtree(dest)
                shutil.copytree(skill_dir, dest)
                copied += 1

        return StepResult(
            step_id=step.id,
            status="success",
            output=f"Copied {copied} skill(s) to {target}",
        )

    # -- uninstall steps ----------------------------------------------------

    def run_uninstall_steps(
        self,
        slug: str,
        manifest: PluginManifest,
        plugin_dir: Path | None = None,
    ) -> Generator[StepResult, None, None]:
        """
        Execute each uninstall step sequentially, yielding a StepResult after each.
        Uses real HOME so tools like pipx are accessible at their installed paths.
        """
        work_dir = plugin_dir or (self.plugins_dir / slug / "repo")
        run_env = self._build_env(None, work_dir)

        for step in manifest.uninstall_steps:
            logger.info("Plugin %s: running uninstall step '%s' (%s)", slug, step.label, step.id)
            result = self._execute_step(step, run_env, work_dir)
            yield result
            if result.status == "failed":
                logger.warning(
                    "Plugin %s: uninstall step '%s' failed: %s", slug, step.id, result.error
                )

    # -- health checks ------------------------------------------------------

    def run_health_checks(
        self, slug: str, manifest: PluginManifest
    ) -> list[HealthCheckResult]:
        """Run all health checks defined in the manifest."""
        results = []
        for check in manifest.health_checks:
            result = self._execute_health_check(check)
            results.append(result)
        return results

    def _execute_health_check(self, check: PluginHealthCheck) -> HealthCheckResult:
        """Run a single health check."""
        if check.type == "command" and check.command:
            return self._health_command(check)
        elif check.type == "http" and check.url:
            return self._health_http(check)
        elif check.type == "python-import" and check.import_path:
            return self._health_python_import(check)
        elif check.type == "file-exists" and check.file_path:
            return self._health_file_exists(check)
        return HealthCheckResult(
            type=check.type,
            description=check.description,
            passed=False,
            error=f"Incomplete health check definition for type '{check.type}'",
        )

    def _health_command(self, check: PluginHealthCheck) -> HealthCheckResult:
        try:
            result = subprocess.run(
                check.command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30,
            )
            return HealthCheckResult(
                type=check.type,
                description=check.description,
                passed=result.returncode == 0,
                output=result.stdout.strip()[:500],
                error=result.stderr.strip()[:500] if result.returncode != 0 else "",
            )
        except Exception as e:
            return HealthCheckResult(
                type=check.type,
                description=check.description,
                passed=False,
                error=str(e),
            )

    def _health_http(self, check: PluginHealthCheck) -> HealthCheckResult:
        import urllib.request
        import urllib.error
        import ssl
        from urllib.parse import urlparse

        try:
            parsed = urlparse(check.url)
            is_local = parsed.hostname in ("localhost", "127.0.0.1", "::1")
            ctx = ssl.create_default_context()
            if is_local:
                # Allow self-signed certs for local services (e.g. Portainer)
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
            req = urllib.request.Request(check.url, method="GET")
            with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
                return HealthCheckResult(
                    type=check.type,
                    description=check.description,
                    passed=resp.status < 400,
                    output=f"HTTP {resp.status}",
                )
        except Exception as e:
            return HealthCheckResult(
                type=check.type,
                description=check.description,
                passed=False,
                error=str(e),
            )

    def _health_python_import(self, check: PluginHealthCheck) -> HealthCheckResult:
        import re as _re
        if not _re.match(r"^[a-zA-Z_][a-zA-Z0-9_.]*$", check.import_path):
            return HealthCheckResult(
                type=check.type,
                description=check.description,
                passed=False,
                error=f"Invalid import path: {check.import_path}",
            )
        try:
            result = subprocess.run(
                ["python3", "-c", f"import {check.import_path}"],
                capture_output=True,
                text=True,
                timeout=15,
            )
            return HealthCheckResult(
                type=check.type,
                description=check.description,
                passed=result.returncode == 0,
                output=f"import {check.import_path} succeeded" if result.returncode == 0 else "",
                error=result.stderr.strip()[:500] if result.returncode != 0 else "",
            )
        except Exception as e:
            return HealthCheckResult(
                type=check.type,
                description=check.description,
                passed=False,
                error=str(e),
            )

    def _health_file_exists(self, check: PluginHealthCheck) -> HealthCheckResult:
        expanded = Path(check.file_path).expanduser()
        exists = expanded.exists()
        return HealthCheckResult(
            type=check.type,
            description=check.description,
            passed=exists,
            output=f"{'Found' if exists else 'Not found'}: {expanded}",
        )

    # -- helpers ------------------------------------------------------------

    def _build_env(
        self, env_vars: dict[str, str] | None, work_dir: Path
    ) -> dict[str, str]:
        """Build a subprocess environment with user-provided env vars injected."""
        env = {
            "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
            "HOME": os.environ.get("HOME", str(Path.home())),
            "LANG": "C.UTF-8",
            "PLUGIN_DIR": str(work_dir),
        }
        # Preserve VIRTUAL_ENV if present
        venv = os.environ.get("VIRTUAL_ENV")
        if venv:
            env["VIRTUAL_ENV"] = venv
        # Inject user-provided env vars (never log values)
        if env_vars:
            for key, value in env_vars.items():
                env[key] = value
                logger.info("Injected env var: %s", key)
        return env
