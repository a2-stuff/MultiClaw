import importlib.util
import sys
from pathlib import Path
from src.skills.manager import SkillManager

class SkillExecutor:
    def __init__(self, manager: SkillManager):
        self.manager = manager

    def execute(self, skill_name: str, context: dict | None = None) -> dict:
        path = self.manager.get_skill_path(skill_name)
        if not path or not path.exists():
            raise FileNotFoundError(f"Skill '{skill_name}' not found")
        module = self._load_module(skill_name, path)
        if not hasattr(module, "run"):
            raise AttributeError(f"Skill '{skill_name}' has no run() function")
        return module.run(context or {})

    def _load_module(self, name: str, path: Path):
        # Verify the module path is within the skills directory
        resolved = path.resolve()
        skills_base = self.manager.skills_dir.resolve()
        if not resolved.is_relative_to(skills_base):
            raise ValueError(f"Skill path escapes skills directory: {path}")
        module_name = f"skill_{name}"
        if module_name in sys.modules:
            del sys.modules[module_name]
        spec = importlib.util.spec_from_file_location(module_name, str(resolved))
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)
        return module
