import jwt from "jsonwebtoken";
import { config } from "../config.js";

/**
 * Issue a short-lived JWT for direct agent-to-agent communication.
 * Token is scoped to a specific agent pair and expires in 5 minutes.
 */
export function issuePeerToken(fromAgentId: string, toAgentId: string): string {
  return jwt.sign(
    { type: "peer", from: fromAgentId, to: toAgentId },
    config.jwtSecret,
    { expiresIn: "5m" }
  );
}

export function verifyPeerToken(token: string): { from: string; to: string } | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as any;
    if (payload.type !== "peer") return null;
    return { from: payload.from, to: payload.to };
  } catch {
    return null;
  }
}
