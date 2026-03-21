import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from src.auth import require_api_key
from src.config import settings
from src.plugins.manager import PluginManager
from src.plugins.loader import PluginLoader

router = APIRouter(prefix="/api/plugins", dependencies=[Depends(require_api_key)])
plugin_manager = PluginManager(settings.plugins_dir)
plugin_loader = PluginLoader(plugin_manager)

@router.get("/")
async def list_plugins():
    names = plugin_manager.list_plugins()
    result = []
    for n in names:
        meta = plugin_manager.get_plugin(n)
        if meta:
            meta["active"] = n in plugin_loader.active_plugins
            result.append(meta)
    return result

@router.post("/install")
async def install_plugin(metadata: str = Form(...), files: list[UploadFile] = File(...)):
    meta = json.loads(metadata)
    file_contents = {}
    for f in files:
        content = await f.read()
        file_contents[f.filename] = content.decode("utf-8")
    result = plugin_manager.install(meta, file_contents)
    if result.get("enabled", True):
        try: plugin_loader.load_plugin(meta["name"])
        except Exception as e: return {"installed": True, "activated": False, "error": str(e)}
    return {"installed": True, "activated": True, "plugin": result}

@router.post("/{name}/activate")
async def activate_plugin(name: str, body: dict | None = None):
    import shutil
    from pathlib import Path

    # If plugin not in local plugins dir, copy from built-in source
    local_dir = Path(settings.plugins_dir) / name
    if not local_dir.exists():
        # Built-in plugins live in the agent source tree (resolve symlinks)
        source_plugins = Path(__file__).resolve().parent.parent.parent / "plugins"
        # Try exact name match, then with underscores (e.g. hello-plugin vs hello_plugin)
        source_dir = source_plugins / name
        if not source_dir.exists():
            alt_name = name.replace("-", "_")
            source_dir = source_plugins / alt_name
        if source_dir.exists():
            shutil.copytree(source_dir, local_dir)
        else:
            raise HTTPException(status_code=404, detail=f"Plugin '{name}' not found")

    # Store manifest in plugin.json if provided (for health checks)
    if body and body.get("manifest"):
        plugin_json = local_dir / "plugin.json"
        if plugin_json.exists():
            meta = json.loads(plugin_json.read_text())
            meta["manifest"] = body["manifest"]
            plugin_json.write_text(json.dumps(meta, indent=2))

    try:
        plugin_loader.load_plugin(name)
        return {"activated": True}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.post("/{name}/deactivate")
async def deactivate_plugin(name: str):
    plugin_loader.unload_plugin(name)
    return {"deactivated": True}

@router.delete("/{name}")
async def uninstall_plugin(name: str):
    import shutil
    from pathlib import Path
    from src.api.git_plugins import git_manager

    # Resolve name/slug — try original, underscore variant, and dash variant
    candidates = [name]
    if "-" in name:
        candidates.append(name.replace("-", "_"))
    elif "_" in name:
        candidates.append(name.replace("_", "-"))

    # Try git plugin uninstall first
    for slug in candidates:
        if git_manager.is_git_plugin(slug):
            if git_manager.uninstall(slug):
                return {"uninstalled": True}

    # Try built-in plugin uninstall
    # Determine if this is the main agent source tree (don't delete source files)
    source_plugins = Path(__file__).resolve().parent.parent.parent / "plugins"
    is_source_dir = Path(settings.plugins_dir).resolve() == source_plugins.resolve()

    for slug in candidates:
        # Unload from memory
        if slug in plugin_loader.active_plugins:
            plugin_loader.unload_plugin(slug)

        plugin_dir = Path(settings.plugins_dir) / slug
        if plugin_dir.exists():
            if is_source_dir:
                # Main agent: deactivate and mark disabled, don't delete source files
                meta_path = plugin_dir / "plugin.json"
                if meta_path.exists():
                    try:
                        meta = json.loads(meta_path.read_text())
                        meta["enabled"] = False
                        meta_path.write_text(json.dumps(meta, indent=2))
                    except Exception:
                        pass
                return {"uninstalled": True, "note": "Plugin disabled (source files preserved)"}
            else:
                # Spawned agent: delete the copied plugin files
                shutil.rmtree(plugin_dir)
                return {"uninstalled": True}

    raise HTTPException(status_code=404, detail="Plugin not found")

@router.get("/tools")
async def list_plugin_tools():
    return plugin_loader.get_all_tools()
