from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from src.auth import require_api_key
from src.config import settings
from src.plugins.git_manager import GitPluginManager
from src.plugins.manifest import ManifestRunner, parse_manifest

router = APIRouter(prefix="/api/plugins", dependencies=[Depends(require_api_key)])
git_manager = GitPluginManager(settings.plugins_dir)
manifest_runner = ManifestRunner(settings.plugins_dir)


class InstallGitRequest(BaseModel):
    name: str
    slug: str
    repo_url: str
    manifest: dict | None = None
    env_vars: dict | None = None


@router.post("/install-git")
async def install_git_plugin(body: InstallGitRequest):
    result = git_manager.install(
        body.name, body.slug, body.repo_url,
        manifest=body.manifest, env_vars=body.env_vars,
    )
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Install failed"))
    return result


@router.post("/{slug}/update-git")
async def update_git_plugin(slug: str):
    result = git_manager.update(slug)
    if not result.get("success"):
        error = result.get("error", "Update failed")
        if "not installed" in error:
            raise HTTPException(status_code=404, detail=error)
        raise HTTPException(status_code=500, detail=error)
    return result


@router.delete("/{slug}/uninstall-git")
async def uninstall_git_plugin(slug: str):
    removed = git_manager.uninstall(slug)
    if not removed:
        raise HTTPException(status_code=404, detail=f"Plugin '{slug}' not found")
    return {"success": True, "slug": slug}


@router.get("/{slug}/skills")
async def get_plugin_skills(slug: str):
    skills = git_manager.get_skills(slug)
    return {"skills": skills}


@router.get("/{slug}/health")
async def plugin_health_check(slug: str):
    meta = git_manager.get_metadata(slug)
    if not meta:
        raise HTTPException(status_code=404, detail=f"Plugin '{slug}' not found")

    manifest_data = meta.get("manifest")
    if not manifest_data:
        return {"healthy": True, "checks": [], "note": "No health checks defined"}

    manifest = parse_manifest(manifest_data)
    results = manifest_runner.run_health_checks(slug, manifest)
    return {
        "healthy": all(r.passed for r in results),
        "checks": [
            {
                "type": r.type,
                "description": r.description,
                "passed": r.passed,
                "output": r.output,
                "error": r.error,
            }
            for r in results
        ],
    }
