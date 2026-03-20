import type { SkillProvider, SkillSearchResult } from "./types.js";

export class ClawHubProvider implements SkillProvider {
  type = "clawhub";

  constructor(private apiBaseUrl: string = "https://wry-manatee-359.convex.site/api/v1") {}

  async search(query: string): Promise<SkillSearchResult[]> {
    const res = await fetch(`${this.apiBaseUrl}/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`ClawHub search failed: ${res.status}`);
    const data = await res.json() as { results: Array<{
      slug: string; displayName: string; summary: string;
      version: string | null; updatedAt: number; score: number;
    }> };
    return data.results.map((r) => ({
      slug: r.slug,
      name: r.displayName,
      description: r.summary,
      version: r.version,
      author: null,
      stats: undefined,
    }));
  }

  async download(slug: string): Promise<Buffer> {
    const res = await fetch(`${this.apiBaseUrl}/download?slug=${encodeURIComponent(slug)}`);
    if (!res.ok) throw new Error(`ClawHub download failed: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  parseUrl(url: string): { slug: string } | null {
    const match = url.match(/clawhub\.ai\/[^/]+\/([^/?#]+)/);
    return match ? { slug: match[1] } : null;
  }
}
