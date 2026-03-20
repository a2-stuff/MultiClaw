export interface SkillSearchResult {
  slug: string;
  name: string;
  description: string;
  version: string | null;
  author: string | null;
  stats?: { stars?: number; downloads?: number; installs?: number };
}

export interface SkillProvider {
  type: string;
  search(query: string): Promise<SkillSearchResult[]>;
  download(slug: string): Promise<Buffer>;
  parseUrl(url: string): { slug: string } | null;
}
