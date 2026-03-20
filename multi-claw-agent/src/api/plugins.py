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
async def activate_plugin(name: str):
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
    from src.api.git_plugins import git_manager
    if git_manager.is_git_plugin(name):
        if git_manager.uninstall(name):
            return {"uninstalled": True}
        raise HTTPException(status_code=404, detail="Plugin not found")
    plugin_loader.unload_plugin(name)
    if plugin_manager.uninstall(name): return {"uninstalled": True}
    raise HTTPException(status_code=404, detail="Plugin not found")

@router.get("/tools")
async def list_plugin_tools():
    return plugin_loader.get_all_tools()
