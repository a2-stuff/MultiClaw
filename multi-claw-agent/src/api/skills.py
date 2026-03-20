import json
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from src.auth import require_api_key
from src.config import settings
from src.skills.manager import SkillManager
from src.skills.executor import SkillExecutor

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/skills", dependencies=[Depends(require_api_key)])
skill_manager = SkillManager(settings.skills_dir)
skill_executor = SkillExecutor(skill_manager)

@router.get("/")
async def list_skills():
    names = skill_manager.list_skills()
    return [skill_manager.get_skill(n) for n in names]

@router.get("/{name}")
async def get_skill(name: str):
    skill = skill_manager.get_skill(name)
    if not skill: raise HTTPException(status_code=404, detail="Skill not found")
    return skill

@router.post("/install")
async def install_skill(metadata: str = Form(...), files: list[UploadFile] = File(...)):
    if len(metadata) > 10_000:
        raise HTTPException(status_code=400, detail="Metadata too large")
    meta = json.loads(metadata)
    if not meta.get("name") or not isinstance(meta["name"], str):
        raise HTTPException(status_code=400, detail="Skill name required")
    if len(meta["name"]) > 128 or not meta["name"].replace("-", "").replace("_", "").isalnum():
        raise HTTPException(status_code=400, detail="Invalid skill name")
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB per file
    file_contents: dict[str, bytes | str] = {}
    for f in files:
        if not f.filename or ".." in f.filename or f.filename.startswith("/"):
            raise HTTPException(status_code=400, detail=f"Invalid filename: {f.filename}")
        content = await f.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"File too large: {f.filename}")
        try:
            file_contents[f.filename] = content.decode("utf-8")
        except UnicodeDecodeError:
            file_contents[f.filename] = content
    result = skill_manager.install(meta, file_contents)
    return {"installed": True, "skill": result}

@router.post("/{name}/execute")
async def execute_skill(name: str, context: dict | None = None):
    try:
        result = skill_executor.execute(name, context or {})
        return {"success": True, "result": result}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Skill not found")
    except Exception as e:
        logger.exception("Skill execution failed: %s", name)
        raise HTTPException(status_code=500, detail="Skill execution failed")

@router.delete("/{name}")
async def uninstall_skill(name: str):
    if skill_manager.uninstall(name): return {"uninstalled": True}
    raise HTTPException(status_code=404, detail="Skill not found")
