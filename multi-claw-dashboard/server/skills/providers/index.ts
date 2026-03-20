import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { skillProviders } from "../../db/schema.js";
import type { SkillProvider } from "./types.js";
import { ClawHubProvider } from "./clawhub.js";
import { SkillsShProvider } from "./skillssh.js";

const providerImpls: Record<string, (apiBaseUrl: string) => SkillProvider> = {
  clawhub: (url) => new ClawHubProvider(url),
  skillssh: () => new SkillsShProvider(),
};

export function getProviderByType(type: string, apiBaseUrl?: string): SkillProvider | null {
  const factory = providerImpls[type];
  return factory ? factory(apiBaseUrl || "") : null;
}

export function getProviderForUrl(url: string): { provider: SkillProvider; slug: string; providerType: string } | null {
  for (const [type, factory] of Object.entries(providerImpls)) {
    const provider = factory("");
    const parsed = provider.parseUrl(url);
    if (parsed) {
      const dbProvider = db.select().from(skillProviders).where(eq(skillProviders.type, type)).get();
      const realProvider = factory(dbProvider?.apiBaseUrl || "");
      return { provider: realProvider, slug: parsed.slug, providerType: type };
    }
  }
  return null;
}

export type { SkillProvider, SkillSearchResult } from "./types.js";
