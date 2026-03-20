import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

_SAFE_FILENAME = re.compile(r"^[a-zA-Z0-9_\-][a-zA-Z0-9_\-./]*$")

def _validate_filename(filename: str, base_dir: Path) -> Path:
    """Validate filename has no path traversal and resolves within base_dir."""
    if not filename or ".." in filename or filename.startswith("/") or filename.startswith("\\"):
        raise ValueError(f"Invalid filename: {filename}")
    if not _SAFE_FILENAME.match(filename):
        raise ValueError(f"Invalid characters in filename: {filename}")
    resolved = (base_dir / filename).resolve()
    if not resolved.is_relative_to(base_dir.resolve()):
        raise ValueError(f"Path traversal detected: {filename}")
    return resolved

class SkillManager:
    def __init__(self, skills_dir: Path):
        self.skills_dir = Path(skills_dir)
        self.skills_dir.mkdir(parents=True, exist_ok=True)

    def install(self, metadata: dict, files: dict[str, bytes | str]) -> dict:
        name = metadata["name"]
        if not re.match(r"^[a-zA-Z0-9_\-]+$", name):
            raise ValueError(f"Invalid skill name: {name}")
        skill_dir = self.skills_dir / name
        skill_dir.mkdir(parents=True, exist_ok=True)
        for filename, content in files.items():
            file_path = _validate_filename(filename, skill_dir)
            file_path.parent.mkdir(parents=True, exist_ok=True)
            if isinstance(content, bytes):
                file_path.write_bytes(content)
            else:
                file_path.write_text(content)
        meta = {**metadata, "installed_at": datetime.now(timezone.utc).isoformat()}
        (skill_dir / "skill.json").write_text(json.dumps(meta, indent=2))
        return meta

    def uninstall(self, name: str) -> bool:
        if not re.match(r"^[a-zA-Z0-9_\-]+$", name):
            raise ValueError(f"Invalid skill name: {name}")
        skill_dir = self.skills_dir / name
        if skill_dir.exists():
            shutil.rmtree(skill_dir)
            return True
        return False

    def list_skills(self) -> list[str]:
        return [d.name for d in self.skills_dir.iterdir() if d.is_dir() and (d / "skill.json").exists()]

    def get_skill(self, name: str) -> dict | None:
        meta_path = self.skills_dir / name / "skill.json"
        if not meta_path.exists(): return None
        return json.loads(meta_path.read_text())

    def get_skill_path(self, name: str) -> Path | None:
        meta = self.get_skill(name)
        if not meta: return None
        entry = meta.get("entry_point")
        if not entry: return None
        return self.skills_dir / name / entry
