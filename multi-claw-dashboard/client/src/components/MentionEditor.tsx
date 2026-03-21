import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getRoot, $getSelection, $isRangeSelection, TextNode,
  KEY_ENTER_COMMAND, KEY_ARROW_UP_COMMAND, KEY_ARROW_DOWN_COMMAND, KEY_ESCAPE_COMMAND,
  COMMAND_PRIORITY_HIGH, COMMAND_PRIORITY_NORMAL,
} from "lexical";
import type { EditorState, LexicalEditor } from "lexical";
import { MentionNode, $createMentionNode, $isMentionNode } from "./MentionNode";
import type { Agent } from "../lib/types";

export interface MentionEditorHandle {
  clear: () => void;
}

interface Props {
  agents: Agent[];
  onMentionsChange: (agentIds: string[]) => void;
  onTextChange: (text: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
}

function MentionPlugin({ agents, onMentionsChange }: { agents: Agent[]; onMentionsChange: (ids: string[]) => void }) {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filteredAgents = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return agents
      .filter(a => a.name.toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.status === "online" && b.status !== "online") return -1;
        if (a.status !== "online" && b.status === "online") return 1;
        return a.name.localeCompare(b.name);
      });
  }, [agents, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredAgents.length]);

  // Listen for @ trigger
  useEffect(() => {
    return editor.registerTextContentListener(() => {
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) { setQuery(null); return; }
        const anchor = selection.anchor;
        const node = anchor.getNode();
        if (!(node instanceof TextNode)) { setQuery(null); return; }
        const textContent = node.getTextContent();
        const offset = anchor.offset;
        const beforeCursor = textContent.slice(0, offset);
        const atIndex = beforeCursor.lastIndexOf("@");
        if (atIndex === -1 || (atIndex > 0 && !/\s/.test(beforeCursor[atIndex - 1]))) {
          setQuery(null);
          return;
        }
        const q = beforeCursor.slice(atIndex + 1);
        if (q.includes(" ")) { setQuery(null); return; }
        setQuery(q);

        const domSelection = window.getSelection();
        if (domSelection && domSelection.rangeCount > 0) {
          const range = domSelection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const editorRect = editor.getRootElement()?.getBoundingClientRect();
          if (editorRect) {
            setMenuPosition({
              top: rect.bottom - editorRect.top + 4,
              left: rect.left - editorRect.left,
            });
          }
        }
      });
    });
  }, [editor]);

  // Handle Enter to select agent from dropdown
  useEffect(() => {
    if (query === null || filteredAgents.length === 0) return;

    const unregisterEnter = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        event?.preventDefault();
        selectAgent(filteredAgents[selectedIndex]);
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );

    // Arrow up
    const unregisterUp = editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      (event) => {
        event?.preventDefault();
        setSelectedIndex(i => (i > 0 ? i - 1 : filteredAgents.length - 1));
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );

    // Arrow down
    const unregisterDown = editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      (event) => {
        event?.preventDefault();
        setSelectedIndex(i => (i < filteredAgents.length - 1 ? i + 1 : 0));
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );

    // Escape to dismiss
    const unregisterEscape = editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      (event) => {
        event?.preventDefault();
        setQuery(null);
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );

    return () => {
      unregisterEnter();
      unregisterUp();
      unregisterDown();
      unregisterEscape();
    };
  }, [editor, query, filteredAgents, selectedIndex]);

  const selectAgent = useCallback((agent: Agent) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const anchor = selection.anchor;
      const node = anchor.getNode();
      if (!(node instanceof TextNode)) return;

      const textContent = node.getTextContent();
      const offset = anchor.offset;
      const beforeCursor = textContent.slice(0, offset);
      const atIndex = beforeCursor.lastIndexOf("@");
      if (atIndex === -1) return;

      const beforeAt = textContent.slice(0, atIndex);
      const afterCursor = textContent.slice(offset);

      node.setTextContent(beforeAt);
      const mentionNode = $createMentionNode(agent.id, agent.name);
      node.insertAfter(mentionNode);

      if (afterCursor) {
        const afterNode = new TextNode(" " + afterCursor);
        mentionNode.insertAfter(afterNode);
        afterNode.select(1, 1);
      } else {
        const spaceNode = new TextNode(" ");
        mentionNode.insertAfter(spaceNode);
        spaceNode.select(1, 1);
      }

      // Collect mentions
      const root = $getRoot();
      const mentions: string[] = [];
      function collectMentions(n: any) {
        if ($isMentionNode(n)) mentions.push(n.getAgentId());
        if (n.getChildren) n.getChildren().forEach(collectMentions);
      }
      collectMentions(root);
      onMentionsChange([...new Set(mentions)]);
    });
    setQuery(null);
  }, [editor, onMentionsChange]);

  if (query === null || filteredAgents.length === 0 || !menuPosition) return null;

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-gray-800 border border-blue-500 rounded-lg shadow-lg py-1 w-56"
      style={{ top: menuPosition.top, left: menuPosition.left }}
    >
      {filteredAgents.map((agent, i) => (
        <button
          key={agent.id}
          className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
            i === selectedIndex ? "bg-blue-600/20 text-blue-300" : "text-gray-300 hover:bg-gray-700"
          }`}
          onMouseDown={(e) => { e.preventDefault(); selectAgent(agent); }}
          onMouseEnter={() => setSelectedIndex(i)}
        >
          <span className={`w-2 h-2 rounded-full ${
            agent.status === "online" ? "bg-green-500" :
            agent.status === "busy" ? "bg-yellow-500" :
            agent.status === "error" ? "bg-red-500" : "bg-gray-500"
          }`} />
          <span>{agent.name}</span>
          <span className="text-xs text-gray-500 ml-auto">{agent.status}</span>
        </button>
      ))}
    </div>
  );
}

/** Exposes editor clear + Cmd+Enter submit */
function EditorControlPlugin({ onSubmit, disabled, editorRef }: {
  onSubmit: () => void; disabled?: boolean;
  editorRef: React.MutableRefObject<LexicalEditor | null>;
}) {
  const [editor] = useLexicalComposerContext();
  editorRef.current = editor;

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        if (event && (event as KeyboardEvent).metaKey && !disabled) {
          event.preventDefault();
          onSubmit();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_NORMAL // Lower than MentionPlugin so dropdown Enter takes precedence
    );
  }, [editor, onSubmit, disabled]);
  return null;
}

export const MentionEditor = forwardRef<MentionEditorHandle, Props>(
  function MentionEditor({ agents, onMentionsChange, onTextChange, onSubmit, disabled, placeholder }, ref) {
    const editorRef = useRef<LexicalEditor | null>(null);

    useImperativeHandle(ref, () => ({
      clear() {
        editorRef.current?.update(() => {
          $getRoot().clear();
        });
      },
    }));

    const initialConfig = {
      namespace: "TaskDispatch",
      nodes: [MentionNode],
      onError: (error: Error) => console.error("Lexical error:", error),
      theme: {
        root: "w-full min-h-[100px] px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none",
      },
    };

    const onChange = useCallback((editorState: EditorState) => {
      editorState.read(() => {
        const root = $getRoot();
        const text = root.getTextContent();
        onTextChange(text);

        const mentions: string[] = [];
        function walk(node: any) {
          if ($isMentionNode(node)) mentions.push(node.getAgentId());
          if (node.getChildren) node.getChildren().forEach(walk);
        }
        walk(root);
        onMentionsChange([...new Set(mentions)]);
      });
    }, [onMentionsChange, onTextChange]);

    return (
      <div className="relative">
        <LexicalComposer initialConfig={initialConfig}>
          <PlainTextPlugin
            contentEditable={<ContentEditable className={initialConfig.theme.root} />}
            placeholder={
              <div className="absolute top-3 left-4 text-gray-500 pointer-events-none">
                {placeholder || "Type @ to mention agents, or ask the dashboard directly..."}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <OnChangePlugin onChange={onChange} />
          <MentionPlugin agents={agents} onMentionsChange={onMentionsChange} />
          <EditorControlPlugin onSubmit={onSubmit} disabled={disabled} editorRef={editorRef} />
        </LexicalComposer>
      </div>
    );
  }
);
