# Optimize Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Optimize Prompt" button to the Agent Identity tab that calls the Anthropic API to transform rough identity text into a professional system prompt, with user-selectable intensity and a side-by-side diff modal.

**Architecture:** New server-side module `optimize.ts` handles Anthropic SDK calls with intensity-specific meta-prompts. New route in `routes.ts` exposes it as `POST /agents/:id/optimize-identity`. Frontend adds the button to `AgentIdentityTab.tsx` and a new `OptimizeModal.tsx` for side-by-side comparison.

**Tech Stack:** TypeScript, React, Express, `@anthropic-ai/sdk` (already installed), axios, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-22-optimize-prompt-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `server/agents/optimize.ts` | Meta-prompt templates + Anthropic SDK call |
| Modify | `server/agents/routes.ts` | New `POST /:id/optimize-identity` route |
| Create | `client/src/components/agents/OptimizeModal.tsx` | Side-by-side diff modal |
| Modify | `client/src/components/agents/AgentIdentityTab.tsx` | Optimize button + intensity dropdown + modal state |

All paths relative to `multi-claw-dashboard/`.

---

### Task 1: Server — Optimize Module

**Files:**
- Create: `multi-claw-dashboard/server/agents/optimize.ts`

- [ ] **Step 1: Create the optimize module with meta-prompt templates**

Create `server/agents/optimize.ts`:

```typescript
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
```

- [ ] **Step 2: Verify the module compiles**

Run from `multi-claw-dashboard/`:
```bash
npx tsc --noEmit server/agents/optimize.ts
```
If the project doesn't support single-file tsc, just verify the server builds:
```bash
npm run build
```
Expected: no errors related to optimize.ts

- [ ] **Step 3: Commit**

```bash
git add multi-claw-dashboard/server/agents/optimize.ts
git commit -m "feat: add identity optimization module with intensity-based meta-prompts"
```

---

### Task 2: Server — Route

**Files:**
- Modify: `multi-claw-dashboard/server/agents/routes.ts` (add route after line 227, after the existing `PATCH /:id/identity` route)

- [ ] **Step 1: Add the optimize-identity route**

Add this route in `routes.ts` after the `PATCH /:id/identity` handler (after line 227), before the `DELETE /:id` route:

```typescript
import { optimizeIdentity } from "./optimize.js";
```
Add this import at the top of the file with the other imports.

Also add `settings` to the existing schema import at line 6. Change:
```typescript
import { agents, agentSkills, agentPlugins, agentRegistryPlugins, agentTasks, skills, plugins, pluginRegistry, apiKeys } from "../db/schema.js";
```
to:
```typescript
import { agents, agentSkills, agentPlugins, agentRegistryPlugins, agentTasks, skills, plugins, pluginRegistry, apiKeys, settings } from "../db/schema.js";
```

Then add the route:

```typescript
router.post("/:id/optimize-identity", requireRole("canManageAgents"), async (req, res) => {
  try {
    const { identity, intensity } = req.body;
    if (!identity || typeof identity !== "string" || identity.trim().length === 0) {
      return res.status(400).json({ error: "identity text is required" });
    }
    if (identity.length > 50000) {
      return res.status(400).json({ error: "identity must be 50,000 characters or fewer" });
    }
    const validIntensities = ["light", "medium", "heavy"];
    if (!intensity || !validIntensities.includes(intensity)) {
      return res.status(400).json({ error: "intensity must be one of: light, medium, heavy" });
    }

    // Read global Anthropic API key from settings table
    const row = db.select().from(settings).where(eq(settings.key, "anthropic_api_key")).get();
    if (!row?.value) {
      return res.status(422).json({ error: "No Anthropic API key configured in dashboard settings" });
    }

    const optimized = await optimizeIdentity(identity, intensity, row.value);
    res.json({ optimized });
  } catch (err: any) {
    console.error("Optimize identity error:", err?.message || err);
    res.status(500).json({ error: err?.message || "Failed to optimize identity" });
  }
});
```

- [ ] **Step 2: Verify server builds**

```bash
cd multi-claw-dashboard && npm run build
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add multi-claw-dashboard/server/agents/routes.ts
git commit -m "feat: add POST /agents/:id/optimize-identity route"
```

---

### Task 3: Frontend — OptimizeModal Component

**Files:**
- Create: `multi-claw-dashboard/client/src/components/agents/OptimizeModal.tsx`

- [ ] **Step 1: Create the modal component**

Follow the existing modal pattern from `EnvVarPromptModal.tsx`: fixed overlay with backdrop blur, `bg-gray-900 border border-gray-700 rounded-xl`, click-outside-to-close.

Create `client/src/components/agents/OptimizeModal.tsx`:

```tsx
interface OptimizeModalProps {
  isOpen: boolean;
  original: string;
  optimized: string;
  intensity: string;
  onAccept: (text: string) => void;
  onDiscard: () => void;
  onReoptimize: () => void;
  isReoptimizing: boolean;
}

export function OptimizeModal({
  isOpen,
  original,
  optimized,
  intensity,
  onAccept,
  onDiscard,
  onReoptimize,
  isReoptimizing,
}: OptimizeModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm"
      onClick={onDiscard}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div>
            <h3 className="text-white font-semibold">Optimized Prompt Preview</h3>
            <span className="text-gray-500 text-xs">
              {intensity.charAt(0).toUpperCase() + intensity.slice(1)} optimization
            </span>
          </div>
          <button
            onClick={onDiscard}
            className="text-gray-400 hover:text-white text-xl transition"
          >
            &times;
          </button>
        </div>

        {/* Side-by-side body */}
        <div className="grid grid-cols-2 flex-1 overflow-hidden min-h-0">
          {/* Original */}
          <div className="border-r border-gray-700 flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-800">
              <span className="text-red-400 text-xs font-semibold uppercase tracking-wider">
                Original
              </span>
            </div>
            <div className="px-4 py-3 overflow-y-auto flex-1">
              <pre className="text-gray-400 text-sm font-mono whitespace-pre-wrap break-words">
                {original}
              </pre>
            </div>
          </div>

          {/* Optimized */}
          <div className="flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-800">
              <span className="text-green-400 text-xs font-semibold uppercase tracking-wider">
                Optimized
              </span>
            </div>
            <div className="px-4 py-3 overflow-y-auto flex-1 bg-gray-950/50">
              {isReoptimizing ? (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  Optimizing...
                </div>
              ) : (
                <pre className="text-gray-200 text-sm font-mono whitespace-pre-wrap break-words">
                  {optimized}
                </pre>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-700">
          <button
            onClick={onDiscard}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 text-sm transition"
          >
            Discard
          </button>
          <button
            onClick={onReoptimize}
            disabled={isReoptimizing}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-white text-sm font-medium transition"
          >
            {isReoptimizing ? "Optimizing..." : "Re-optimize"}
          </button>
          <button
            onClick={() => onAccept(optimized)}
            disabled={isReoptimizing}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-white text-sm font-medium transition"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd multi-claw-dashboard && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add multi-claw-dashboard/client/src/components/agents/OptimizeModal.tsx
git commit -m "feat: add OptimizeModal component for side-by-side prompt comparison"
```

---

### Task 4: Frontend — Wire Up AgentIdentityTab

**Files:**
- Modify: `multi-claw-dashboard/client/src/components/agents/AgentIdentityTab.tsx`

- [ ] **Step 1: Add imports and state**

At the top of `AgentIdentityTab.tsx`, add:

```typescript
import { OptimizeModal } from "./OptimizeModal";
```

Inside the component function, after the existing state declarations (after line 10), add:

```typescript
const [intensity, setIntensity] = useState<"light" | "medium" | "heavy">("medium");
const [optimizing, setOptimizing] = useState(false);
const [showOptimizeModal, setShowOptimizeModal] = useState(false);
const [optimizedText, setOptimizedText] = useState("");
const [originalSnapshot, setOriginalSnapshot] = useState("");
const [reoptimizing, setReoptimizing] = useState(false);
const [optimizeCooldown, setOptimizeCooldown] = useState(false);
```

- [ ] **Step 2: Add the optimize handler function**

After the `clear` function (after line 47), add:

```typescript
const optimize = async () => {
  if (identity.length > 50000) {
    setMsg({ text: "Identity must be 50,000 characters or fewer", ok: false });
    setTimeout(() => setMsg(null), 6000);
    return;
  }
  setOptimizing(true);
  setMsg(null);
  try {
    const res = await api.post(`/agents/${agent.id}/optimize-identity`, {
      identity,
      intensity,
    });
    setOriginalSnapshot(identity);
    setOptimizedText(res.data.optimized);
    setShowOptimizeModal(true);
  } catch (err: any) {
    setMsg({
      text: err.response?.data?.error || "Failed to optimize",
      ok: false,
    });
    setTimeout(() => setMsg(null), 6000);
  } finally {
    setOptimizing(false);
  }
};

const handleReoptimize = async () => {
  setReoptimizing(true);
  setOptimizeCooldown(true);
  try {
    const res = await api.post(`/agents/${agent.id}/optimize-identity`, {
      identity: originalSnapshot,
      intensity,
    });
    setOptimizedText(res.data.optimized);
  } catch (err: any) {
    setMsg({
      text: err.response?.data?.error || "Re-optimize failed",
      ok: false,
    });
    setTimeout(() => setMsg(null), 6000);
  } finally {
    setReoptimizing(false);
    setTimeout(() => setOptimizeCooldown(false), 3000);
  }
};

const handleAccept = (text: string) => {
  setIdentity(text);
  setDirty(true);
  setShowOptimizeModal(false);
};
```

- [ ] **Step 3: Add the Optimize button and intensity dropdown to the button row**

In the JSX, inside the `{canManage && (...)}` block, after the Clear button (after line 71) and before the Save Identity button (line 72), add:

```tsx
<button
  onClick={optimize}
  disabled={optimizing || !identity.trim()}
  className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:bg-gray-700 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 rounded-lg text-white text-xs font-medium transition"
>
  {optimizing ? "Optimizing..." : "✨ Optimize Prompt"}
</button>
<select
  value={intensity}
  onChange={(e) => setIntensity(e.target.value as "light" | "medium" | "heavy")}
  className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-gray-300 text-xs focus:outline-none"
>
  <option value="light">Light</option>
  <option value="medium">Medium</option>
  <option value="heavy">Heavy</option>
</select>
```

- [ ] **Step 4: Add the modal at the end of the component's return JSX**

Just before the closing `</div>` of the root element (before line 101), add:

```tsx
<OptimizeModal
  isOpen={showOptimizeModal}
  original={originalSnapshot}
  optimized={optimizedText}
  intensity={intensity}
  onAccept={handleAccept}
  onDiscard={() => setShowOptimizeModal(false)}
  onReoptimize={handleReoptimize}
  isReoptimizing={reoptimizing || optimizeCooldown}
/>
```

- [ ] **Step 5: Verify it compiles**

```bash
cd multi-claw-dashboard && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add multi-claw-dashboard/client/src/components/agents/AgentIdentityTab.tsx
git commit -m "feat: wire optimize prompt button and modal into identity tab"
```

---

### Task 5: Manual Verification

- [ ] **Step 1: Restart the dashboard server**

```bash
cd multi-claw-dashboard && npm run dev
```
(Or however the project starts — check `package.json` scripts)

- [ ] **Step 2: Test the happy path**

1. Open the dashboard, navigate to any agent's Identity tab
2. Type a rough identity like: "You are an SEO expert that analyzes websites"
3. Select "Medium" intensity (should be default)
4. Click "Optimize Prompt"
5. Verify: button shows "Optimizing..." and other buttons are disabled
6. Verify: modal opens with original on left, optimized on right
7. Click "Accept"
8. Verify: textarea now contains the optimized text, Save Identity button is enabled
9. Click "Save Identity" to confirm the full flow works

- [ ] **Step 3: Test edge cases**

1. Empty textarea → Optimize button should be disabled
2. Click "Re-optimize" in the modal → should fetch a new result, button disabled during call
3. Click "Discard" → modal closes, original text unchanged
4. Click overlay outside modal → same as Discard
5. Test all three intensities (Light, Medium, Heavy) with the same input
6. Remove the Anthropic API key from Settings → should get a clear error message

- [ ] **Step 4: Test as non-manager user**

1. Log in as a viewer/non-manager
2. Navigate to Identity tab
3. Verify: Optimize button and intensity dropdown are NOT visible

- [ ] **Step 5: Final commit if any adjustments needed**

```bash
git add -A && git commit -m "fix: adjustments from manual testing"
```
