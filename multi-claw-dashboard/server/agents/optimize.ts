import Anthropic from "@anthropic-ai/sdk";

const SHARED_RULES = `Rules you MUST follow:
- Output ONLY the optimized prompt text. No explanations, no meta-commentary, no markdown code fences.
- Never reference any platform, framework, tools, or plugins.
- Focus on: role definition, personality, capabilities, communication style, and constraints.
- Never fabricate capabilities — only expand on what the user described.
- Do not include greetings or sign-offs in the prompt.`;

const INTENSITY_PROMPTS: Record<string, string> = {
  light: `You are a prompt editor. Polish the following system prompt for an AI agent.
Improve grammar, clarity, and specificity. Keep the user's structure and voice intact.
Make minimal changes — this is a light edit, not a rewrite.

${SHARED_RULES}`,

  medium: `You are a prompt engineer. Restructure the following system prompt for an AI agent into clear sections.
Use these sections where appropriate: Role, Capabilities, Communication Style, Constraints.
Expand on the user's intent while preserving their core ideas. Add specificity where the original is vague.

${SHARED_RULES}`,

  heavy: `You are an expert prompt engineer. Generate a comprehensive, professional system prompt for an AI agent based on the following rough description.
Create detailed sections including: Role & Expertise, Core Capabilities, Communication Style, Output Format, Constraints & Boundaries, and Edge Case Handling.
Be thorough — turn even a brief description into a complete behavioral specification.

${SHARED_RULES}`,
};

export async function optimizeIdentity(
  identity: string,
  intensity: string,
  apiKey: string,
): Promise<string> {
  const systemPrompt = INTENSITY_PROMPTS[intensity];
  if (!systemPrompt) throw new Error(`Invalid intensity: ${intensity}`);

  const client = new Anthropic({ apiKey, timeout: 30000 });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: identity }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  return text;
}
