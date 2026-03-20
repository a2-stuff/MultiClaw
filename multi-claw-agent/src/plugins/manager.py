import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

class PluginManager:
    def __init__(self, plugins_dir: Path):
        self.plugins_dir = Path(plugins_dir)
        self.plugins_dir.mkdir(parents=True, exist_ok=True)

    def install(self, metadata: dict, files: dict[str, str]) -> dict:
        name = metadata["name"]
        plugin_dir = self.plugins_dir / name
        plugin_dir.mkdir(parents=True, exist_ok=True)
        for filename, content in files.items():
            (plugin_dir / filename).write_text(content)
        meta = {**metadata, "installed_at": datetime.now(timezone.utc).isoformat(), "enabled": True}
        (plugin_dir / "plugin.json").write_text(json.dumps(meta, indent=2))
        return meta

    def uninstall(self, name: str) -> bool:
        plugin_dir = self.plugins_dir / name
        if plugin_dir.exists():
            shutil.rmtree(plugin_dir)
            return True
        return False

    def list_plugins(self) -> list[str]:
        return [d.name for d in self.plugins_dir.iterdir() if d.is_dir() and (d / "plugin.json").exists()]

    def get_plugin(self, name: str) -> dict | None:
        meta_path = self.plugins_dir / name / "plugin.json"
        if not meta_path.exists(): return None
        return json.loads(meta_path.read_text())

    def get_entry_path(self, name: str) -> Path | None:
        meta = self.get_plugin(name)
        if not meta: return None
        return self.plugins_dir / name / meta.get("entry_point", "main.py")
