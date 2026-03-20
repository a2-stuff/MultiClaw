import Docker from "dockerode";

const docker = new Docker();
let dockerAvailable: boolean | null = null;

export async function isDockerAvailable(): Promise<boolean> {
  if (dockerAvailable !== null) return dockerAvailable;
  try {
    await docker.ping();
    dockerAvailable = true;
  } catch {
    dockerAvailable = false;
  }
  return dockerAvailable;
}

export async function ensureBaseImage(): Promise<boolean> {
  if (!await isDockerAvailable()) return false;
  try {
    await docker.getImage("multiclaw-sandbox:latest").inspect();
    return true;
  } catch {
    // Build base image
    // For now, pull a minimal Python image as the sandbox base
    try {
      await new Promise<void>((resolve, reject) => {
        docker.pull("python:3.11-slim", {}, (err: any, stream: any) => {
          if (err) return reject(err);
          docker.modem.followProgress(stream, (err2: any) => {
            if (err2) return reject(err2);
            resolve();
          });
        });
      });
      // Tag it as our sandbox base
      const image = docker.getImage("python:3.11-slim");
      await image.tag({ repo: "multiclaw-sandbox", tag: "latest" });
      return true;
    } catch (err) {
      console.error("Failed to prepare sandbox base image:", err);
      return false;
    }
  }
}

export function getDocker(): Docker {
  return docker;
}
