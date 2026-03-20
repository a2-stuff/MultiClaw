/**
 * Simple expression evaluator for workflow conditions.
 * Supports: dot-notation access, comparisons (> < >= <= == !=), boolean (&&, ||, !), literals.
 * Example: "summarize.output.confidence > 0.8 && research.output.found == true"
 */

export function evaluateCondition(expression: string, context: Record<string, any>): boolean {
  try {
    // Replace step references with actual values
    const resolved = expression.replace(/([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*)/g, (match) => {
      // Skip literal keywords
      if (["true", "false", "null", "undefined"].includes(match)) return match;
      // Skip numbers
      if (/^\d/.test(match)) return match;

      const parts = match.split(".");
      let value: any = context;
      for (const part of parts) {
        if (value == null) return "null";
        value = value[part];
      }
      if (value === undefined || value === null) return "null";
      if (typeof value === "string") return JSON.stringify(value);
      return String(value);
    });

    // Safe evaluation — only allow comparisons and booleans
    // Replace operators with JS equivalents
    const sanitized = resolved
      .replace(/==/g, "===")
      .replace(/!=/g, "!==");

    // Validate: only allow safe characters
    if (!/^[\s\d\w."'<>=!&|()null+\-]+$/.test(sanitized)) {
      console.error("Unsafe expression:", expression);
      return false;
    }

    return Boolean(new Function(`return (${sanitized})`)());
  } catch (err) {
    console.error("Expression evaluation failed:", expression, err);
    return false; // Failed conditions skip the step
  }
}
