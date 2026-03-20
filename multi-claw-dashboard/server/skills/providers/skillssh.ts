import yazl from "yazl";
import type { SkillProvider, SkillSearchResult } from "./types.js";

const SKILLS_SH_API = "https://skills.sh/api";

export class SkillsShProvider implements SkillProvider {
  type = "skillssh";

  async search(query: string): Promise<SkillSearchResult[]> {
    const res = await fetch(`${SKILLS_SH_API}/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`skills.sh search failed: ${res.status}`);
    const data = (await res.json()) as {
      skills: Array<{
        id: string;
        skillId: string;
        name: string;
        installs: number;
        source: string;
      }>;
    };
    return data.skills.slice(0, 50).map((s) => ({
      slug: s.id,
      name: s.name,
      description: `${s.source} — ${s.installs.toLocaleString()} installs`,
      version: null,
      author: s.source.split("/")[0],
      stats: { installs: s.installs },
    }));
  }

  async download(slug: string): Promise<Buffer> {
    // slug is the full id like "vercel-labs/skills/find-skills"
    const parts = slug.split("/");
    if (parts.length < 3) throw new Error(`Invalid skills.sh slug: ${slug}`);

    const owner = parts[0];
    const repo = parts[1];
    const skillName = parts.slice(2).join("/");

    // Fetch raw SKILL.md from GitHub
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/skills/${skillName}/SKILL.md`;
    const res = await fetch(rawUrl);
    if (!res.ok) {
      // Try alternate structure: skill file at root level
      const altUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${skillName}.md`;
      const altRes = await fetch(altUrl);
      if (!altRes.ok) throw new Error(`Could not fetch skill from GitHub (tried skills/${skillName}/SKILL.md and ${skillName}.md)`);
      const content = Buffer.from(await altRes.arrayBuffer());
      return this.createZip(`${skillName}.md`, content);
    }

    const content = Buffer.from(await res.arrayBuffer());
    return this.createZip("SKILL.md", content);
  }

  parseUrl(url: string): { slug: string } | null {
    // Match: skills.sh/{owner}/{repo}/{skill-name}
    const match = url.match(/skills\.sh\/([^/]+\/[^/]+\/[^/?#]+)/);
    return match ? { slug: match[1] } : null;
  }

  private createZip(filename: string, content: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const zipfile = new yazl.ZipFile();
      zipfile.addBuffer(content, filename);
      zipfile.end();

      const chunks: Buffer[] = [];
      zipfile.outputStream.on("data", (chunk: Buffer) => chunks.push(chunk));
      zipfile.outputStream.on("end", () => resolve(Buffer.concat(chunks)));
      zipfile.outputStream.on("error", reject);
    });
  }
}
