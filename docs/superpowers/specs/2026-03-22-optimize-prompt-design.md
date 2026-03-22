# Optimize Prompt — Design Spec

## Overview

Add an "Optimize Prompt" button to the Agent Identity tab that uses the Anthropic API to transform rough identity text into a professional, structured system prompt. Users choose an optimization intensity (Light/Medium/Heavy) and review results in a side-by-side diff modal before accepting.

## Decisions

- **LLM backend**: Anthropic API called from dashboard server using the global Anthropic API key (from `settings` table, key `"anthropic_api_key"`)
- **SDK**: Use `@anthropic-ai/sdk` (already a project dependency)
- **Presentation**: Side-by-side diff modal (original vs optimized) with Accept/Discard/Re-optimize
- **Intensity levels**: User-selectable Light/Medium/Heavy dropdown
- **Context isolation**: Optimizer has no MultiClaw-specific knowledge — identity is purely about who the agent is
- **Model**: `claude-sonnet-4-6` for optimization calls
- **Button placement**: After Clear, before Save Identity
- **Streaming**: Non-streaming — the modal shows the complete result, so streaming adds complexity without UX benefit
- **Audit logging**: Not logged — this is a read-only preview action with no side effects. API usage is tracked by Anthropic's own billing.

## UI Flow

1. User writes or uploads rough identity text in the textarea
2. User selects intensity from dropdown (defaults to Medium)
3. User clicks "Optimize Prompt" (purple gradient button with sparkle icon)
4. Button shows spinner + "Optimizing...", other buttons disabled
5. Side-by-side modal appears: original (left, red header) vs optimized (right, green header)
6. Modal footer: Discard | Re-optimize | Accept
   - **Discard**: closes modal, no changes
   - **Re-optimize**: calls API again with same intensity, replaces right side (debounced — button disabled for 3 seconds after each call to prevent rapid repeated clicks)
   - **Accept**: writes optimized text into textarea, closes modal, marks dirty state so Save is enabled
7. User clicks Save Identity to persist (existing flow)

## API

### `POST /api/agents/:id/optimize-identity`

Uses POST despite being side-effect-free because the request has a body and is non-idempotent (each call may return different results).

**Auth**: Requires `canManageAgents` role (same as save identity)

**Request body**:
```json
{
  "identity": "You are an SEO expert that analyzes websites",
  "intensity": "medium"
}
```

**Response**:
```json
{
  "optimized": "Role: You are an expert SEO analyst specializing in..."
}
```

**Error responses**:
- `400` — missing identity text, invalid intensity, or identity exceeds 50,000 characters
- `401` — unauthorized
- `422` — no Anthropic API key configured in dashboard settings
- `500` — Anthropic API error (with message)

**Implementation**:
1. Validate input (identity is non-empty string, ≤50,000 chars, intensity is one of light/medium/heavy)
2. Read global Anthropic API key from `settings` table (`key = "anthropic_api_key"`)
3. Call Anthropic API via `@anthropic-ai/sdk` with meta-prompt + user's identity text
4. Return optimized text — no side effects, nothing saved

### Meta-Prompt Strategy

The server constructs a system prompt for the optimization call based on intensity:

| Intensity | Behavior |
|-----------|----------|
| **Light** | Polish grammar, improve clarity, add specificity. Keep the user's structure and voice intact. |
| **Medium** | Restructure into clear sections (Role, Capabilities, Communication Style, Constraints). Expand on the user's intent while preserving their core ideas. |
| **Heavy** | Full professional rewrite. Generate a comprehensive system prompt with detailed sections, edge cases, behavioral guidelines, and output formatting instructions. |

All intensities share these rules:
- Output only the optimized prompt text, no explanations or meta-commentary
- Never reference the MultiClaw platform, tools, or plugins
- Focus on role definition, personality, capabilities, communication style, and constraints
- Never fabricate capabilities — expand on what the user described

## Frontend Components

### Modified: `AgentIdentityTab.tsx`

Changes to existing component:
- Add "Optimize Prompt" button (purple gradient) after Clear button
- Add intensity `<select>` dropdown (Light/Medium/Heavy, default Medium) adjacent to Optimize button
- Add loading state: spinner on button, disable all buttons during optimization
- Add state for modal visibility and optimized text
- Only show Optimize button for users with `canManage` role
- Optimize button always visible when `canManage` is true, but disabled when textarea is empty
- Client-side validation: identity must be ≤50,000 characters

### New: `OptimizeModal.tsx`

Side-by-side diff modal component:

**Props**:
- `isOpen: boolean`
- `original: string` — current identity text
- `optimized: string` — LLM-generated text
- `intensity: string` — display which intensity was used
- `onAccept: (text: string) => void` — writes optimized text to textarea
- `onDiscard: () => void` — closes modal
- `onReoptimize: () => void` — triggers another API call
- `isReoptimizing: boolean` — loading state for re-optimize button

**Layout**:
- Modal overlay with centered card (max-width ~800px)
- Header: "Optimized Prompt Preview" + intensity label + close button
- Body: two-column grid, left = original (red "ORIGINAL" label), right = optimized (green "OPTIMIZED" label)
- Both columns: monospace font, scrollable, pre-wrap whitespace
- Footer: Discard (secondary), Re-optimize (purple, 3s debounce), Accept (green)

## Server-Side Files

### New: `server/agents/optimize.ts`

Contains:
- `optimizeIdentity(identity: string, intensity: string, apiKey: string): Promise<string>` — builds meta-prompt, calls Anthropic API via SDK, returns optimized text
- Meta-prompt templates per intensity level
- Error handling for API failures
- 30-second timeout on API call

### Modified: `server/agents/routes.ts`

Add new route:
- `POST /agents/:id/optimize-identity` — validates input, reads global API key from `settings` table, calls `optimizeIdentity`, returns result

## Data Flow

```
User clicks Optimize
  → Frontend POST /api/agents/:id/optimize-identity { identity, intensity }
    → Server validates input (non-empty, ≤50k chars, valid intensity)
    → Server reads global Anthropic API key from settings table
    → Server calls Anthropic API (claude-sonnet-4-6) via @anthropic-ai/sdk
    → Server returns { optimized: string }
  → Frontend opens modal with original vs optimized
  → User clicks Accept
  → Frontend writes optimized text to textarea, marks dirty
  → User clicks Save Identity (existing flow)
    → PATCH /agents/:id/identity
    → Pushed to agent via /api/config
```

## Edge Cases

- **Empty textarea**: Optimize button disabled when no text to optimize
- **API key missing**: Return 422 with message "No Anthropic API key configured in dashboard settings"
- **API timeout**: 30-second timeout on the Anthropic call, surface error in UI
- **Very long identity**: Client-side limit of 50,000 characters with validation message; server rejects >50k with 400
- **Re-optimize**: Same flow as initial optimize, replaces right side of modal. Button debounced (3s cooldown) to prevent rapid repeated API calls
- **Modal close**: Clicking overlay or X = same as Discard
