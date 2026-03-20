import pytest
from pathlib import Path

@pytest.fixture
def plugins_dir(tmp_path):
    return tmp_path / "plugins"

def test_plugin_install(plugins_dir):
    from src.plugins.manager import PluginManager
    mgr = PluginManager(plugins_dir)
    plugin_code = 'class Plugin:\n    name = "twitter-cli"\n    description = "Twitter CLI integration"\n    def activate(self, agent_context): self.ctx = agent_context\n    def deactivate(self): pass\n    def get_tools(self): return [{"name": "post_tweet", "description": "Post a tweet"}]\n'
    metadata = {"name": "twitter-cli", "description": "Twitter CLI", "version": "1.0.0", "entry_point": "main.py"}
    mgr.install(metadata, {"main.py": plugin_code})
    assert "twitter-cli" in mgr.list_plugins()

def test_plugin_load_and_activate(plugins_dir):
    from src.plugins.manager import PluginManager
    from src.plugins.loader import PluginLoader
    mgr = PluginManager(plugins_dir)
    plugin_code = 'class Plugin:\n    name = "test-plugin"\n    def activate(self, ctx): self.active = True\n    def deactivate(self): self.active = False\n    def get_tools(self): return [{"name": "test_tool", "description": "A test tool"}]\n'
    mgr.install({"name": "test-plugin", "version": "1.0.0", "entry_point": "main.py"}, {"main.py": plugin_code})
    loader = PluginLoader(mgr)
    loader.load_plugin("test-plugin")
    assert "test-plugin" in loader.active_plugins
    tools = loader.get_all_tools()
    assert any(t["name"] == "test_tool" for t in tools)

def test_plugin_disable(plugins_dir):
    from src.plugins.manager import PluginManager
    from src.plugins.loader import PluginLoader
    mgr = PluginManager(plugins_dir)
    mgr.install({"name": "removable", "version": "1.0.0", "entry_point": "main.py"},
        {"main.py": "class Plugin:\n def activate(self,c): pass\n def deactivate(self): pass\n def get_tools(self): return []\n"})
    loader = PluginLoader(mgr)
    loader.load_plugin("removable")
    assert "removable" in loader.active_plugins
    loader.unload_plugin("removable")
    assert "removable" not in loader.active_plugins
