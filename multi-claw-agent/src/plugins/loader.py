import importlib.util
import sys
from pathlib import Path
from src.plugins.manager import PluginManager

class PluginLoader:
    def __init__(self, manager: PluginManager):
        self.manager = manager
        self.active_plugins: dict[str, object] = {}

    def load_plugin(self, name: str):
        path = self.manager.get_entry_path(name)
        if not path or not path.exists():
            raise FileNotFoundError(f"Plugin '{name}' not found")
        # Verify the module path is within the plugins directory
        resolved = path.resolve()
        plugins_base = self.manager.plugins_dir.resolve()
        if not resolved.is_relative_to(plugins_base):
            raise ValueError(f"Plugin path escapes plugins directory: {path}")
        module_name = f"plugin_{name}"
        if module_name in sys.modules:
            del sys.modules[module_name]
        spec = importlib.util.spec_from_file_location(module_name, str(resolved))
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)
        if not hasattr(module, "Plugin"):
            raise AttributeError(f"Plugin '{name}' has no Plugin class")
        instance = module.Plugin()
        instance.activate({})
        self.active_plugins[name] = instance

    def unload_plugin(self, name: str):
        instance = self.active_plugins.pop(name, None)
        if instance and hasattr(instance, "deactivate"):
            instance.deactivate()

    def get_all_tools(self) -> list[dict]:
        tools = []
        for name, plugin in self.active_plugins.items():
            if hasattr(plugin, "get_tools"):
                plugin_tools = plugin.get_tools()
                for t in plugin_tools: t["plugin"] = name
                tools.extend(plugin_tools)
        return tools

    def load_all_enabled(self):
        for name in self.manager.list_plugins():
            meta = self.manager.get_plugin(name)
            if meta and meta.get("enabled", True):
                try: self.load_plugin(name)
                except Exception as e: print(f"Failed to load plugin {name}: {e}")
