import { v4 as uuid } from "uuid";
import { db } from "./index.js";
import { pluginRegistry, skillProviders } from "./schema.js";
import { sql } from "drizzle-orm";

export function seedPluginRegistry() {
  const existing = db
    .select()
    .from(pluginRegistry)
    .where(sql`${pluginRegistry.slug} = 'superpowers'`)
    .get();
  if (!existing) {
    db.insert(pluginRegistry).values({
      id: uuid(),
      name: "Superpowers",
      slug: "superpowers",
      description: "Complete development workflow skills for AI coding agents. Includes TDD, systematic debugging, brainstorming, code review, parallel agents, and more.",
      version: "5.0.5",
      author: "Jesse Vincent",
      repoUrl: "https://github.com/obra/superpowers",
      type: "git-plugin",
    }).run();
  }

  // Seed Shannon plugin
  const shannon = db
    .select()
    .from(pluginRegistry)
    .where(sql`${pluginRegistry.slug} = 'shannon'`)
    .get();
  if (!shannon) {
    db.insert(pluginRegistry).values({
      id: uuid(),
      name: "Shannon",
      slug: "shannon",
      description: "Autonomous white-box AI pentester for web applications and APIs. Analyzes source code, identifies attack vectors, and executes real exploits to prove vulnerabilities before production.",
      version: "1.0.0",
      author: "KeygraphHQ",
      repoUrl: "https://github.com/KeygraphHQ/shannon",
      type: "git-plugin",
    }).run();
  }

  // Seed AgentPay SDK plugin
  const agentpay = db
    .select()
    .from(pluginRegistry)
    .where(sql`${pluginRegistry.slug} = 'agentpay-sdk'`)
    .get();
  if (!agentpay) {
    db.insert(pluginRegistry).values({
      id: uuid(),
      name: "AgentPay SDK",
      slug: "agentpay-sdk",
      description: "Open SDK for agentic payments. Let AI agents hold, transfer, and manage USD1 with operator-defined spending policies and self-custodial wallets on EVM-compatible networks.",
      version: "1.0.0",
      author: "World Liberty Financial",
      repoUrl: "https://github.com/worldliberty/agentpay-sdk",
      type: "git-plugin",
    }).run();
  }

  // Seed AgentPay Skill Pack
  const agentpaySkills = db
    .select()
    .from(pluginRegistry)
    .where(sql`${pluginRegistry.slug} = 'agentpay-skill-pack'`)
    .get();
  if (!agentpaySkills) {
    db.insert(pluginRegistry).values({
      id: uuid(),
      name: "AgentPay Skill Pack",
      slug: "agentpay-skill-pack",
      description: "AI agent skill pack for wallet setup, funding, transfers, approvals, and policy configuration with AgentPay SDK. Enables agents to manage USD1 payment workflows.",
      version: "1.0.0",
      author: "World Liberty Financial",
      repoUrl: "https://github.com/worldliberty/agentpay-sdk",
      type: "git-plugin",
    }).run();
  }

  // Seed Bankr Agent plugin
  const bankr = db
    .select()
    .from(pluginRegistry)
    .where(sql`${pluginRegistry.slug} = 'bankr-agent'`)
    .get();
  if (!bankr) {
    db.insert(pluginRegistry).values({
      id: uuid(),
      name: "Bankr Agent",
      slug: "bankr-agent",
      description: "Crypto trading, market analysis, and Polymarket prediction betting via the Bankr API. Supports Base, Ethereum, Solana, and more.",
      version: "1.0.0",
      author: "BankrBot",
      repoUrl: "https://github.com/BankrBot/claude-plugins",
      type: "git-plugin",
    }).run();
  }

  // Seed Browser Control plugin
  const browserControl = db
    .select()
    .from(pluginRegistry)
    .where(sql`${pluginRegistry.slug} = 'browser-control'`)
    .get();
  if (!browserControl) {
    db.insert(pluginRegistry).values({
      id: uuid(),
      name: "Browser Control",
      slug: "browser-control",
      description: "Browser automation via Playwright. Navigate pages, fill forms, click elements, extract content, take screenshots, and manage tabs — all from agent tasks. Supports Chromium, Firefox, and WebKit with configurable headless/visible mode.",
      version: "1.0.0",
      author: "MultiClaw",
      repoUrl: "https://github.com/a2-stuff/MultiClaw",
      type: "built-in",
    }).run();
  }

  // Seed skills.sh provider
  const skillssh = db
    .select()
    .from(skillProviders)
    .where(sql`${skillProviders.type} = 'skillssh'`)
    .get();
  if (!skillssh) {
    db.insert(skillProviders).values({
      id: uuid(),
      name: "skills.sh",
      type: "skillssh",
      apiBaseUrl: "https://skills.sh/api",
      enabled: true,
    }).run();
  }
}
