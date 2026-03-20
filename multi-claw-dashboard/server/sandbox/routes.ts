import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { runInSandbox } from "./runner.js";
import { isDockerAvailable, ensureBaseImage, getDocker } from "./image-cache.js";

const router = Router();
router.use(requireAuth);

// Run plugin in sandbox
router.post("/run", async (req, res) => {
  try {
    const { pluginCode, input, config, agentId } = req.body;
    if (!pluginCode) return res.status(400).json({ error: "pluginCode required" });

    const result = await runInSandbox(pluginCode, input || "", config || {}, agentId);
    res.json(result);
  } catch (err: any) {
    if (err.message?.includes("Docker is not available")) {
      return res.status(503).json({ error: err.message, fallbackAvailable: true });
    }
    console.error("Sandbox execution failed:", err);
    res.status(500).json({ error: "Sandbox execution failed" });
  }
});

// Check Docker status
router.get("/status", async (_req, res) => {
  try {
    const available = await isDockerAvailable();
    if (available) {
      const docker = getDocker();
      const info = await docker.info();
      res.json({
        available: true,
        containers: info.Containers,
        images: info.Images,
        serverVersion: info.ServerVersion,
      });
    } else {
      res.json({ available: false });
    }
  } catch {
    res.json({ available: false });
  }
});

// List cached sandbox images
router.get("/images", async (_req, res) => {
  try {
    const available = await isDockerAvailable();
    if (!available) return res.json({ images: [] });
    const docker = getDocker();
    const images = await docker.listImages({ filters: { reference: ["multiclaw-sandbox*"] } });
    res.json({ images: images.map(i => ({ id: i.Id, tags: i.RepoTags, size: i.Size, created: i.Created })) });
  } catch (err) {
    console.error("Failed to list images:", err);
    res.status(500).json({ error: "Failed to list images" });
  }
});

export { router as sandboxRouter };
