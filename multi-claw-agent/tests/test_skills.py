import json
import pytest
from pathlib import Path

@pytest.fixture
def skills_dir(tmp_path):
    return tmp_path / "skills"

def test_skill_install(skills_dir):
    from src.skills.manager import SkillManager
    mgr = SkillManager(skills_dir)
    skill_content = 'def run(context):\n    return {"result": "hello from skill"}\n'
    metadata = {"name": "test-skill", "description": "A test skill", "version": "1.0.0", "entry_point": "main.py"}
    mgr.install(metadata, {"main.py": skill_content})
    assert "test-skill" in mgr.list_skills()
    info = mgr.get_skill("test-skill")
    assert info["version"] == "1.0.0"

def test_skill_execute(skills_dir):
    from src.skills.manager import SkillManager
    from src.skills.executor import SkillExecutor
    mgr = SkillManager(skills_dir)
    skill_content = 'def run(context):\n    return {"result": f"hello {context.get(\'name\', \'world\')}"}\n'
    mgr.install({"name": "greet", "version": "1.0.0", "entry_point": "main.py"}, {"main.py": skill_content})
    executor = SkillExecutor(mgr)
    result = executor.execute("greet", {"name": "MultiClaw"})
    assert result["result"] == "hello MultiClaw"

def test_skill_uninstall(skills_dir):
    from src.skills.manager import SkillManager
    mgr = SkillManager(skills_dir)
    mgr.install({"name": "temp-skill", "version": "1.0.0", "entry_point": "main.py"}, {"main.py": "def run(ctx): return {}"})
    assert "temp-skill" in mgr.list_skills()
    mgr.uninstall("temp-skill")
    assert "temp-skill" not in mgr.list_skills()
