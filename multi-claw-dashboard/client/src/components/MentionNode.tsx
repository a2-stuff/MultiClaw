import { DecoratorNode, type LexicalNode, type NodeKey, type SerializedLexicalNode } from "lexical";

export interface SerializedMentionNode extends SerializedLexicalNode {
  agentId: string;
  agentName: string;
}

export class MentionNode extends DecoratorNode<JSX.Element> {
  __agentId: string;
  __agentName: string;

  static getType(): string {
    return "mention";
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(node.__agentId, node.__agentName, node.__key);
  }

  constructor(agentId: string, agentName: string, key?: NodeKey) {
    super(key);
    this.__agentId = agentId;
    this.__agentName = agentName;
  }

  createDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "mention-pill";
    span.style.cssText =
      "background: #3b82f6; color: white; padding: 2px 8px; border-radius: 12px; font-size: 13px; user-select: none; display: inline-block; margin: 0 2px;";
    span.textContent = `@${this.__agentName}`;
    span.contentEditable = "false";
    return span;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(): JSX.Element {
    return <span />;
  }

  getAgentId(): string {
    return this.__agentId;
  }

  getAgentName(): string {
    return this.__agentName;
  }

  getTextContent(): string {
    return `@${this.__agentName}`;
  }

  static importJSON(serialized: SerializedMentionNode): MentionNode {
    return new MentionNode(serialized.agentId, serialized.agentName);
  }

  exportJSON(): SerializedMentionNode {
    return {
      ...super.exportJSON(),
      type: "mention",
      agentId: this.__agentId,
      agentName: this.__agentName,
      version: 1,
    };
  }

  isInline(): boolean {
    return true;
  }
}

export function $createMentionNode(agentId: string, agentName: string): MentionNode {
  return new MentionNode(agentId, agentName);
}

export function $isMentionNode(node: LexicalNode | null | undefined): node is MentionNode {
  return node instanceof MentionNode;
}
