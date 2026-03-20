import { useState } from "react";

const toc = [
  { id: "getting-started", label: "Getting Started" },
  { id: "managing-agents", label: "Managing Agents" },
  { id: "agent-identity", label: "Agent Identity" },
  { id: "agent-logs", label: "Agent Logs" },
  { id: "skills", label: "Skills" },
  { id: "plugins", label: "Plugins" },
  { id: "cron-jobs", label: "Cron Jobs" },
  { id: "templates", label: "Templates" },
  { id: "workflows", label: "Workflows" },
  { id: "delegation", label: "Delegation" },
  { id: "memory", label: "Memory" },
  { id: "audit-log", label: "Audit Log" },
  { id: "sandbox", label: "Sandbox" },
  { id: "realtime", label: "Real-Time Updates" },
  { id: "api-keys", label: "API Keys" },
  { id: "users-roles", label: "Users & Roles" },
  { id: "settings", label: "Settings" },
  { id: "tls-https", label: "TLS / HTTPS" },
  { id: "cli-management", label: "CLI Management" },
  { id: "faq", label: "FAQ" },
  { id: "troubleshooting", label: "Troubleshooting" },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="bg-gray-900 border border-gray-800 rounded-xl p-6 scroll-mt-20">
      <h2 className="text-xl font-semibold mb-4 text-white">{title}</h2>
      <div className="text-gray-300 text-sm space-y-3 leading-relaxed">{children}</div>
    </div>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 text-xs font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap">
      {children}
    </pre>
  );
}

function Badge({ children, color = "blue" }: { children: React.ReactNode; color?: "blue" | "green" | "yellow" | "red" | "purple" }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-900/40 text-blue-300 border-blue-800",
    green: "bg-green-900/40 text-green-300 border-green-800",
    yellow: "bg-yellow-900/40 text-yellow-300 border-yellow-800",
    red: "bg-red-900/40 text-red-300 border-red-800",
    purple: "bg-purple-900/40 text-purple-300 border-purple-800",
  };
  return (
    <span className={`inline-block border rounded px-2 py-0.5 text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}

function FaqItem({ question, children }: { question: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-white hover:bg-gray-800/50 transition"
      >
        <span>{question}</span>
        <span className="ml-4 flex-shrink-0 text-gray-400 text-lg leading-none">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 text-gray-300 text-sm space-y-2 leading-relaxed border-t border-gray-800">
          {children}
        </div>
      )}
    </div>
  );
}

export function Help() {
  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Help &amp; Documentation</h1>
        <p className="text-gray-400">
          Everything you need to know about running and managing MultiClaw — a distributed AI agent hub.
        </p>
      </div>

      {/* Table of Contents */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h2 className="text-base font-semibold text-white mb-3">Table of Contents</h2>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
          {toc.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="text-sm text-blue-400 hover:text-blue-300 transition py-0.5"
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {/* Getting Started */}
        <Section id="getting-started" title="Getting Started">
          <p>
            MultiClaw is a distributed AI agent hub. A central dashboard (this web UI) communicates with one or more
            agents — each agent is a Python process that can execute tasks, run skills, and respond to cron jobs.
          </p>
          <SubSection title="First steps after login">
            <ol className="list-decimal list-inside space-y-1.5 text-gray-300">
              <li>Go to <strong className="text-white">Settings</strong> and add at least one AI provider API key (Anthropic, OpenAI, etc.).</li>
              <li>Go to <strong className="text-white">Agents</strong> and either <Badge color="blue">+ Add Agent</Badge> (connect a remote agent) or <Badge color="green">Spawn</Badge> (create a local agent).</li>
              <li>Once an agent shows status <Badge color="green">online</Badge>, you can send it tasks, install skills, and schedule cron jobs.</li>
              <li>Optionally, add <strong className="text-white">Plugins</strong> from the registry to extend agent capabilities.</li>
            </ol>
          </SubSection>
        </Section>

        {/* Managing Agents */}
        <Section id="managing-agents" title="Managing Agents">
          <p>
            Agents are the workers in MultiClaw. Each agent runs independently with its own port, virtual environment, and skills directory.
          </p>

          <SubSection title="Registering a remote agent">
            <p>
              Use <Badge color="blue">+ Add Agent</Badge> to register an agent that is already running on another host (or
              the same host on a different port). You will need the agent's URL and its API key. The API key is found in
              the agent's <code className="bg-gray-800 px-1 rounded">.env</code> file as <code className="bg-gray-800 px-1 rounded">API_KEY</code>.
            </p>
            <p>
              Once registered, MultiClaw will poll the agent and display its status in the agent list.
            </p>
          </SubSection>

          <SubSection title="Spawning a local agent">
            <p>
              Use <Badge color="green">Spawn</Badge> to have the dashboard create a brand-new agent process on the local
              host. Each spawned agent gets:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
              <li>An isolated directory under <code className="bg-gray-800 px-1 rounded">~/.multiclaw/agents/&lt;name&gt;/</code></li>
              <li>Its own Python virtual environment</li>
              <li>Its own port (auto-assigned or specified)</li>
              <li>Its own skills folder</li>
              <li>A generated API key stored in its <code className="bg-gray-800 px-1 rounded">.env</code></li>
            </ul>
          </SubSection>

          <SubSection title="Agent overview">
            <p>Click an agent card to open its detail panel. From there you can:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
              <li>View real-time status (<Badge color="green">online</Badge> / <Badge color="red">error</Badge> / <Badge color="yellow">offline</Badge>) and system info (CPU, memory, disk)</li>
              <li>Send a one-off task prompt to the agent</li>
              <li>Update the agent's code to the latest version</li>
              <li>Restart the agent process</li>
              <li>View installed skills and install/remove them</li>
              <li>Configure the agent's identity and personality via the <strong className="text-white">Identity</strong> tab</li>
              <li>Stream live logs via the <strong className="text-white">Logs</strong> tab</li>
            </ul>
          </SubSection>

          <SubSection title="Stopping and starting spawned agents">
            <p>
              Spawned agents can be stopped and restarted from the agent detail panel using the <strong className="text-white">Stop</strong> and{" "}
              <strong className="text-white">Start</strong> buttons. The agent's directory and configuration are preserved when stopped.
            </p>
          </SubSection>

          <SubSection title="Deleting agents">
            <p>
              Deleting a <Badge color="green">spawned</Badge> agent will kill its process <em>and</em> permanently remove
              its directory (including its virtual environment and skills). Deleting a <Badge color="blue">registered</Badge>{" "}
              agent only removes the registration from the dashboard — the remote agent process is unaffected.
            </p>
          </SubSection>
        </Section>

        {/* Agent Identity */}
        <Section id="agent-identity" title="Agent Identity">
          <p>
            Each agent can have a custom identity — a system prompt that shapes its personality, capabilities, and
            behaviour when handling tasks. Identities are configured per-agent from the{" "}
            <strong className="text-white">Identity</strong> tab on the agent detail page.
          </p>

          <SubSection title="Editing the identity">
            <p>
              The Identity tab provides a full-height textarea editor where you can write a free-form system prompt in
              plain text or Markdown. The prompt is sent to the agent's AI model as the system message, so it influences
              every task the agent performs.
            </p>
            <p>
              After editing, click <Badge color="blue">Save Identity</Badge> to persist the changes. The agent picks up
              the new identity immediately for subsequent tasks — no restart is required.
            </p>
          </SubSection>

          <SubSection title="Uploading a Markdown file">
            <p>
              You can load an identity from a <code className="bg-gray-800 px-1 rounded">.md</code> file using the{" "}
              <strong className="text-white">Upload .md</strong> button. The file contents are inserted into the editor,
              where you can review and adjust them before saving. This makes it easy to version-control identities in a
              repository and apply them across agents.
            </p>
          </SubSection>

          <SubSection title="Identity as a system prompt">
            <p>
              The identity text becomes the agent's system prompt for every task it receives — including tasks sent
              manually from the dashboard, cron job prompts, delegated sub-tasks, and workflow steps. A well-written
              identity can:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
              <li>Restrict the agent to a specific domain (e.g., "You are a security-focused code reviewer")</li>
              <li>Set a communication style or output format</li>
              <li>Provide background context the agent should always be aware of</li>
              <li>Define escalation rules for ambiguous tasks</li>
            </ul>
          </SubSection>
        </Section>

        {/* Agent Logs */}
        <Section id="agent-logs" title="Agent Logs">
          <p>
            The <strong className="text-white">Logs</strong> tab on an agent's detail page provides a real-time log
            viewer that streams output directly from the agent process without needing shell access.
          </p>

          <SubSection title="Real-time streaming">
            <p>
              Logs are streamed live as the agent writes them. The viewer automatically scrolls to new entries as they
              arrive. Real-time delivery is powered by Server-Sent Events (SSE) so it works across firewalls and proxies
              that might block WebSocket connections.
            </p>
          </SubSection>

          <SubSection title="Level filter">
            <p>
              Use the <strong className="text-white">Level</strong> dropdown to filter log entries by severity:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
              <li><Badge color="blue">DEBUG</Badge> — verbose diagnostic output</li>
              <li><Badge color="green">INFO</Badge> — normal operational messages</li>
              <li><Badge color="yellow">WARNING</Badge> — non-critical issues worth noting</li>
              <li><Badge color="red">ERROR</Badge> — failures that need attention</li>
            </ul>
            <p>Selecting a level shows entries at that level and above.</p>
          </SubSection>

          <SubSection title="Text search">
            <p>
              Type in the <strong className="text-white">Search</strong> field to filter log lines by any substring.
              Filtering is applied client-side so it is instant and does not interrupt the live stream.
            </p>
          </SubSection>

          <SubSection title="Auto-refresh and manual control">
            <p>
              Auto-refresh is on by default and keeps the log view current. Toggle it off to freeze the display while
              inspecting a specific entry without the view jumping. Click <strong className="text-white">Clear</strong> to
              wipe the current log buffer in the viewer (this does not delete log files on disk).
            </p>
          </SubSection>
        </Section>

        {/* Skills */}
        <Section id="skills" title="Skills">
          <p>
            Skills are small, self-contained capability packages that extend what an agent can do. A skill is typically a
            directory containing a prompt file or script that the agent loads at startup.
          </p>
          <SubSection title="Installing and removing skills">
            <p>
              From an agent's detail page, open the <strong className="text-white">Skills</strong> tab. You can install
              skills by name from available providers, or remove skills that are no longer needed. Changes take effect
              after the agent is restarted (or immediately if the agent supports hot-reload).
            </p>
          </SubSection>
          <SubSection title="Skill providers">
            <p>
              Skills can come from several sources:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
              <li><Badge color="blue">Local</Badge> — skills already present in the agent's skills directory</li>
              <li><Badge color="purple">Registry</Badge> — skills from the configured plugin/skill registry</li>
              <li><Badge color="green">SSH</Badge> — skills fetched from a remote host over SSH</li>
              <li><Badge color="yellow">Git</Badge> — skills cloned from a git repository URL</li>
            </ul>
          </SubSection>
          <SubSection title="Global skills page">
            <p>
              The top-level <strong className="text-white">Skills</strong> page shows skills across all agents and lets
              you install a skill to multiple agents at once.
            </p>
          </SubSection>
        </Section>

        {/* Plugins */}
        <Section id="plugins" title="Plugins">
          <p>
            Plugins extend the dashboard itself. They are distributed via a git-based registry and can add new pages,
            API routes, or background services to MultiClaw.
          </p>
          <SubSection title="Installing plugins from the registry">
            <ol className="list-decimal list-inside space-y-1.5 text-gray-300">
              <li>Navigate to the <strong className="text-white">Plugins</strong> page.</li>
              <li>Click <Badge color="blue">Browse Registry</Badge> to see available plugins.</li>
              <li>Click <strong className="text-white">Install</strong> next to a plugin. The dashboard pulls the plugin via git.</li>
              <li>After installation, enable the plugin with the toggle switch.</li>
              <li>Some plugins require a dashboard restart to fully activate.</li>
            </ol>
          </SubSection>
          <SubSection title="Enabling and disabling plugins">
            <p>
              Each installed plugin has an enable/disable toggle. Disabling a plugin prevents it from loading without
              uninstalling it. To permanently remove a plugin, click <strong className="text-white">Uninstall</strong>.
            </p>
          </SubSection>
        </Section>

        {/* Cron Jobs */}
        <Section id="cron-jobs" title="Cron Jobs">
          <p>
            Cron jobs let you schedule recurring tasks that are automatically sent to agents on a time-based schedule
            using standard cron expression syntax.
          </p>
          <SubSection title="Creating a cron job">
            <ol className="list-decimal list-inside space-y-1.5 text-gray-300">
              <li>Go to the <strong className="text-white">Crons</strong> page and click <Badge color="blue">+ New Cron</Badge>.</li>
              <li>Enter a name, select the target agent, and write the task prompt.</li>
              <li>
                Set the schedule using a cron expression, for example:
                <CodeBlock>{`0 * * * *    # Every hour
*/15 * * * * # Every 15 minutes
0 9 * * 1    # Every Monday at 9 AM`}</CodeBlock>
              </li>
              <li>Save and enable the cron job.</li>
            </ol>
          </SubSection>
          <SubSection title="Viewing run history">
            <p>
              Each cron job keeps a history of recent runs, including the timestamp, output, and whether the run
              succeeded or failed. Click a cron job row to expand its history.
            </p>
          </SubSection>
          <SubSection title="Enabling and disabling">
            <p>
              Use the toggle on each cron job to pause or resume scheduling without deleting the job. Disabled cron jobs
              are skipped even if their schedule would otherwise fire.
            </p>
          </SubSection>
        </Section>

        {/* Templates */}
        <Section id="templates" title="Templates">
          <p>
            Templates are pre-configured agent profiles that let you spin up a new agent with a ready-made identity,
            skill set, model selection, and cron schedule — without having to configure each setting manually.
          </p>

          <SubSection title="Browsing templates">
            <p>
              Navigate to the <strong className="text-white">Templates</strong> page to see all available templates.
              Each template card shows a name, description, and the set of skills and configuration it will apply.
            </p>
          </SubSection>

          <SubSection title="Applying a template">
            <p>
              Click <Badge color="blue">Use Template</Badge> on a template card. You can choose to:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
              <li>Spawn a brand-new agent pre-configured with the template settings</li>
              <li>Apply the template to an existing agent, overwriting its identity and skill list</li>
            </ul>
            <p>
              Review any changes before confirming — applying a template to an existing agent will replace its current
              identity and may install or remove skills.
            </p>
          </SubSection>

          <SubSection title="Creating custom templates">
            <p>
              Any agent's current configuration (identity, skills, model, crons) can be saved as a new template using
              the <strong className="text-white">Save as Template</strong> option on the agent detail page. Give it a
              name and description so it is easy to discover later.
            </p>
          </SubSection>
        </Section>

        {/* Workflows */}
        <Section id="workflows" title="Workflows">
          <p>
            Workflows let you chain agent tasks together into multi-step automated pipelines. Each step can be
            assigned to a different agent and can pass its output as input to the next step.
          </p>

          <SubSection title="Workflow builder">
            <p>
              Open the <strong className="text-white">Workflows</strong> page and click <Badge color="blue">+ New Workflow</Badge>{" "}
              to launch the visual workflow builder. The builder provides a node-based canvas where each node represents
              a task step:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
              <li>Drag nodes onto the canvas and connect them in sequence</li>
              <li>Assign each node to a specific agent and write its task prompt</li>
              <li>Use <code className="bg-gray-800 px-1 rounded">{"{{output}}"}</code> in a prompt to reference the previous step's result</li>
              <li>Add conditional branches to route execution based on step outcomes</li>
            </ul>
          </SubSection>

          <SubSection title="Running a workflow">
            <p>
              Workflows can be triggered manually with <Badge color="green">Run</Badge>, on a cron schedule, or via the
              API. During a run, the dashboard shows live progress across all steps, with per-step status indicators and
              output previews.
            </p>
          </SubSection>

          <SubSection title="Workflow history">
            <p>
              Every workflow run is recorded. Open a workflow and click the <strong className="text-white">History</strong>{" "}
              tab to review past runs, inspect per-step outputs, and identify where a run failed.
            </p>
          </SubSection>
        </Section>

        {/* Delegation */}
        <Section id="delegation" title="Delegation">
          <p>
            Delegation allows one agent to assign sub-tasks to other agents, enabling collaborative processing of
            complex tasks that benefit from specialisation or parallelism.
          </p>

          <SubSection title="How delegation works">
            <p>
              When an agent encounters a task that is better handled by a different agent (e.g., a coding task routed to
              a code-specialist agent, or a large task split across multiple agents), it can delegate via the MultiClaw
              hub. The delegating agent sends a sub-task prompt to the target agent and waits for its response before
              continuing.
            </p>
          </SubSection>

          <SubSection title="Configuring delegation">
            <p>
              Delegation permissions are controlled per-agent. From the agent detail page, open the{" "}
              <strong className="text-white">Settings</strong> tab and configure:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
              <li>Which agents this agent is allowed to delegate to</li>
              <li>Whether this agent can receive delegated tasks from others</li>
              <li>Maximum delegation depth (to prevent runaway delegation chains)</li>
            </ul>
          </SubSection>

          <SubSection title="Monitoring delegated tasks">
            <p>
              Delegated tasks appear in the task history of both the delegating and receiving agents. The dashboard
              links parent and child tasks so you can trace the full delegation tree for any given task.
            </p>
          </SubSection>
        </Section>

        {/* Memory */}
        <Section id="memory" title="Memory">
          <p>
            The Memory system provides a shared knowledge base and state store that agents can read from and write to,
            enabling persistent context and coordination across tasks and agent boundaries.
          </p>

          <SubSection title="Shared state">
            <p>
              Agents can store key-value pairs in the shared memory store. Any other agent in the hub can read these
              values. This is useful for passing information between agents in a workflow, maintaining global counters,
              or storing results that multiple agents need to reference.
            </p>
          </SubSection>

          <SubSection title="Knowledge base">
            <p>
              Beyond simple key-value pairs, Memory supports longer-form documents — markdown notes, summaries, or
              structured data — that agents can retrieve and include in their context window when handling tasks.
              Documents are indexed and can be searched by agents at runtime.
            </p>
          </SubSection>

          <SubSection title="Managing memory">
            <p>
              Navigate to the <strong className="text-white">Memory</strong> page to:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
              <li>Browse all stored keys and documents</li>
              <li>Create, edit, or delete memory entries manually</li>
              <li>See which agent last wrote to each entry and when</li>
              <li>Search across all stored content</li>
            </ul>
          </SubSection>

          <SubSection title="Memory scoping">
            <p>
              Memory entries can be scoped globally (accessible by all agents) or restricted to a specific agent.
              Agent-scoped memory is private to that agent and not visible to others.
            </p>
          </SubSection>
        </Section>

        {/* Audit Log */}
        <Section id="audit-log" title="Audit Log">
          <p>
            The Audit Log provides a complete, tamper-evident trail of all actions performed within MultiClaw — by
            users, agents, and automated processes. It is the primary tool for security review, compliance, and
            incident investigation.
          </p>

          <SubSection title="What is logged">
            <p>The audit log captures:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
              <li>User logins and logouts (including failed login attempts)</li>
              <li>Agent registrations, spawns, restarts, updates, and deletions</li>
              <li>Task submissions and completions</li>
              <li>Skill installs and removals</li>
              <li>Plugin installs, enables, disables, and uninstalls</li>
              <li>API key creations and revocations</li>
              <li>Settings changes</li>
              <li>Workflow runs and delegation events</li>
              <li>Memory reads and writes (for sensitive entries)</li>
            </ul>
          </SubSection>

          <SubSection title="Viewing the audit log">
            <p>
              Navigate to the <strong className="text-white">Audit Log</strong> page. Entries are displayed in reverse
              chronological order. Use the filters to narrow by:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
              <li>Date range</li>
              <li>Actor (specific user or agent)</li>
              <li>Action type</li>
              <li>Resource (e.g., a specific agent or plugin)</li>
            </ul>
          </SubSection>

          <SubSection title="Exporting">
            <p>
              The audit log can be exported as CSV or JSON for ingestion into external SIEM tools or long-term archival.
              Use the <Badge color="blue">Export</Badge> button on the Audit Log page and select the desired format and
              date range.
            </p>
          </SubSection>
        </Section>

        {/* Sandbox */}
        <Section id="sandbox" title="Sandbox">
          <p>
            The Sandbox provides an isolated execution environment for running agent tasks, testing skills, and
            evaluating prompts without any risk to production agents or external systems.
          </p>

          <SubSection title="What the sandbox isolates">
            <p>
              Tasks run in the sandbox are executed in an ephemeral, network-restricted container or process. The sandbox
              prevents:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
              <li>Outbound network calls to production services</li>
              <li>Writes to persistent agent directories or the memory store</li>
              <li>Cron job triggers and delegation to live agents</li>
              <li>Skill side-effects that could affect real environments</li>
            </ul>
          </SubSection>

          <SubSection title="Using the sandbox">
            <p>
              From any agent detail page, click <Badge color="yellow">Run in Sandbox</Badge> before submitting a task.
              The task runs against the agent's current identity and skill set, but in complete isolation. Sandbox
              results are shown inline and are not stored in the agent's task history.
            </p>
            <p>
              The top-level <strong className="text-white">Sandbox</strong> page also lets you run free-form prompts
              against any agent's configuration without touching the live agent.
            </p>
          </SubSection>

          <SubSection title="Sandbox limitations">
            <p>
              Because the sandbox is isolated, tasks that depend on external APIs, file system state, or other agents
              will behave differently than in production. Use the sandbox for prompt testing and skill development, not
              for validating end-to-end integrations.
            </p>
          </SubSection>
        </Section>

        {/* Real-Time Updates */}
        <Section id="realtime" title="Real-Time Updates">
          <p>
            MultiClaw uses two complementary real-time transport mechanisms to keep the dashboard in sync with agents
            and background processes without requiring manual page refreshes.
          </p>

          <SubSection title="Server-Sent Events (SSE)">
            <p>
              Most live-streaming features — agent log tailing, task output streaming, and system status updates — are
              delivered over SSE. SSE is a one-way, HTTP-based push channel that works reliably through most firewalls,
              reverse proxies, and CDN configurations.
            </p>
          </SubSection>

          <SubSection title="WebSocket">
            <p>
              Bidirectional real-time communication — such as live workflow progress, delegation handshakes, and
              interactive task sessions — uses WebSocket connections. WebSocket provides lower latency for scenarios
              where the client also needs to send data mid-stream.
            </p>
            <p>
              If WebSocket is unavailable in your network environment (e.g., blocked by a proxy), the dashboard falls
              back to SSE polling for affected features. No configuration is required — the fallback is automatic.
            </p>
          </SubSection>

          <SubSection title="Connection status indicator">
            <p>
              A small indicator in the navigation bar shows the current real-time connection state:{" "}
              <Badge color="green">connected</Badge>, <Badge color="yellow">reconnecting</Badge>, or{" "}
              <Badge color="red">disconnected</Badge>. If the connection drops, the dashboard automatically attempts to
              reconnect with exponential back-off.
            </p>
          </SubSection>
        </Section>

        {/* API Keys */}
        <Section id="api-keys" title="API Keys">
          <p>
            API keys authenticate requests to the MultiClaw dashboard API. They are used by agents and external tools
            to communicate with the hub.
          </p>
          <SubSection title="Creating an API key">
            <ol className="list-decimal list-inside space-y-1.5 text-gray-300">
              <li>Go to the <strong className="text-white">Keys</strong> page and click <Badge color="blue">+ New Key</Badge>.</li>
              <li>Give the key a descriptive name (e.g., "agent-production" or "ci-pipeline").</li>
              <li>Copy the key immediately — it will not be shown again.</li>
            </ol>
          </SubSection>
          <SubSection title="Using API keys">
            <p>
              Include the key in the <code className="bg-gray-800 px-1 rounded">Authorization</code> header for API requests:
            </p>
            <CodeBlock>Authorization: Bearer &lt;your-api-key&gt;</CodeBlock>
            <p>
              When registering a remote agent, paste its API key (from the agent's <code className="bg-gray-800 px-1 rounded">.env</code>{" "}
              file) into the connection form so the dashboard can authenticate with it.
            </p>
          </SubSection>
          <SubSection title="Revoking keys">
            <p>
              Delete a key from the Keys page to immediately revoke it. Any agent or service using that key will
              lose access until reconfigured with a new key.
            </p>
          </SubSection>
        </Section>

        {/* Users & Roles */}
        <Section id="users-roles" title="Users & Roles">
          <p>
            MultiClaw supports multiple user accounts with role-based access control. Roles determine what actions
            each user can perform.
          </p>
          <SubSection title="Available roles">
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <Badge color="red">admin</Badge>
                <span>Full access — manage users, all agents, settings, plugins, and API keys.</span>
              </div>
              <div className="flex items-start gap-3">
                <Badge color="yellow">operator</Badge>
                <span>Can manage agents, skills, crons, and plugins, but cannot manage users or API keys.</span>
              </div>
              <div className="flex items-start gap-3">
                <Badge color="blue">viewer</Badge>
                <span>Read-only access — can view agent status, logs, and cron history but cannot make changes.</span>
              </div>
            </div>
          </SubSection>
          <SubSection title="Managing users">
            <p>
              Admins can add, edit, and delete users from the <strong className="text-white">Users</strong> page.
              When creating a user, assign a role and set an initial password. Users can change their own password
              from the Settings page.
            </p>
          </SubSection>
        </Section>

        {/* Settings */}
        <Section id="settings" title="Settings">
          <p>
            The Settings page configures global options for the MultiClaw hub.
          </p>
          <SubSection title="AI provider keys">
            <p>
              Enter API keys for AI providers (Anthropic, OpenAI, Google Gemini, OpenRouter, DeepSeek). Keys saved
              here are automatically pushed to all connected agents. If an agent has its own key in its local{" "}
              <code className="bg-gray-800 px-1 rounded">.env</code> file, the agent's local key takes priority.
            </p>
          </SubSection>
          <SubSection title="Config sync">
            <p>
              Whenever a setting is saved, MultiClaw broadcasts it to all online agents. Offline agents receive the
              updated configuration the next time they reconnect.
            </p>
          </SubSection>
        </Section>

        {/* TLS / HTTPS */}
        <Section id="tls-https" title="TLS / HTTPS">
          <p>
            MultiClaw supports HTTPS for both the dashboard and agents. TLS can be configured during installation via
            the interactive installer (<code className="bg-gray-800 px-1 rounded">install.sh</code>) or set up manually
            at any time.
          </p>
          <SubSection title="Installer TLS wizard">
            <p>
              When you run <code className="bg-gray-800 px-1 rounded">install.sh</code>, the installer offers an
              optional TLS setup step. You will be presented with three options:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
              <li><Badge color="yellow">Skip</Badge> — continue without TLS (HTTP only). You can enable HTTPS later by editing the <code className="bg-gray-800 px-1 rounded">.env</code> file.</li>
              <li><Badge color="blue">Existing certs</Badge> — provide paths to certificate and key files you already have. The installer writes them to the <code className="bg-gray-800 px-1 rounded">.env</code> automatically.</li>
              <li><Badge color="green">Certbot (Let's Encrypt)</Badge> — the installer auto-installs certbot, obtains a free certificate for your domain, and configures auto-renewal.</li>
            </ul>
          </SubSection>
          <SubSection title="Certbot auto-renewal">
            <p>
              When the certbot option is chosen, the installer registers a daily cron job that runs at{" "}
              <strong className="text-white">3 AM</strong> to automatically renew certificates before they expire.
              No manual intervention is required as long as the host can reach the Let's Encrypt servers.
            </p>
          </SubSection>
          <SubSection title="Manual TLS configuration">
            <p>
              To configure TLS without the installer, set the following environment variables in the respective{" "}
              <code className="bg-gray-800 px-1 rounded">.env</code> files and restart the services:
            </p>
            <p className="font-medium text-white">Dashboard (<code className="bg-gray-800 px-1 rounded font-normal">multi-claw-dashboard/.env</code>):</p>
            <CodeBlock>{`TLS_CERT=/path/to/fullchain.pem
TLS_KEY=/path/to/privkey.pem`}</CodeBlock>
            <p className="font-medium text-white">Agent (<code className="bg-gray-800 px-1 rounded font-normal">~/.multiclaw/agents/&lt;name&gt;/.env</code>):</p>
            <CodeBlock>{`MULTICLAW_TLS_CERT=/path/to/fullchain.pem
MULTICLAW_TLS_KEY=/path/to/privkey.pem`}</CodeBlock>
            <p>
              Both services will automatically switch to HTTPS when these variables are present and the referenced
              files are readable.
            </p>
          </SubSection>
        </Section>

        {/* CLI Management */}
        <Section id="cli-management" title="CLI Management">
          <p>
            MultiClaw ships with a <code className="bg-gray-800 px-1 rounded">manage.py</code> script for managing the
            hub and agents from the command line. The <code className="bg-gray-800 px-1 rounded">install.sh</code>{" "}
            installer is the recommended way to perform initial setup, including optional TLS configuration.
          </p>
          <SubSection title="manage.py commands">
            <CodeBlock>{`python manage.py status           # Show hub and agent status
python manage.py start            # Start the dashboard server
python manage.py stop             # Stop the dashboard server
python manage.py restart          # Restart the dashboard server
python manage.py agents           # List all registered agents
python manage.py restart-agent <name>  # Restart a specific agent
python manage.py logs [--tail N]  # Stream dashboard logs
python manage.py install          # Install/update dependencies
python manage.py uninstall        # Remove MultiClaw and all data
python manage.py update           # Pull latest code and restart
python manage.py tui              # Open the terminal UI dashboard`}</CodeBlock>
          </SubSection>
          <SubSection title="TUI dashboard">
            <p>
              Run <code className="bg-gray-800 px-1 rounded">python manage.py tui</code> to open an interactive
              terminal UI. The TUI shows:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
              <li>Live agent status and metrics (CPU, memory, uptime)</li>
              <li>Recent task history per agent</li>
              <li>Cron job status and last run time</li>
              <li>Log tail panel with filtering</li>
            </ul>
            <p>
              Use arrow keys to navigate, <kbd className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs">Enter</kbd> to
              select, and <kbd className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs">q</kbd> to quit.
            </p>
          </SubSection>
        </Section>

        {/* FAQ */}
        <Section id="faq" title="FAQ">
          <div className="space-y-2">
            <FaqItem question="How do I add a new agent?">
              <p>
                Go to the <strong className="text-white">Agents</strong> page. Use <strong className="text-white">+ Add Agent</strong> to
                register an existing agent by URL and API key, or use <strong className="text-white">Spawn</strong> to create a
                brand-new local agent automatically.
              </p>
            </FaqItem>

            <FaqItem question="How do I set an agent's identity / personality?">
              <p>
                Open the agent's detail page and select the <strong className="text-white">Identity</strong> tab. Write
                or paste a system prompt into the textarea editor — this becomes the agent's personality and instructions
                for every task it handles. You can also click <strong className="text-white">Upload .md</strong> to load
                an identity from a Markdown file. Click <Badge color="blue">Save Identity</Badge> to apply the changes
                immediately, with no restart required.
              </p>
            </FaqItem>

            <FaqItem question="How do I view agent logs?">
              <p>
                Open the agent's detail page and click the <strong className="text-white">Logs</strong> tab. Logs stream
                in real time as the agent writes them. Use the <strong className="text-white">Level</strong> dropdown to
                filter by severity (DEBUG, INFO, WARNING, ERROR) and the <strong className="text-white">Search</strong>{" "}
                field to filter by text. Toggle <strong className="text-white">Auto-refresh</strong> off to pause the
                stream while inspecting entries, and use <strong className="text-white">Clear</strong> to reset the
                viewer buffer.
              </p>
            </FaqItem>

            <FaqItem question="What are agent templates?">
              <p>
                Templates are pre-configured agent profiles that bundle an identity, skill set, model choice, and
                optional cron schedule into a reusable blueprint. Browse available templates on the{" "}
                <strong className="text-white">Templates</strong> page and click{" "}
                <Badge color="blue">Use Template</Badge> to either spawn a new agent with those settings or apply the
                template to an existing agent. You can save any agent's current configuration as a new template from its
                detail page.
              </p>
            </FaqItem>

            <FaqItem question="How do I create a workflow?">
              <p>
                Navigate to the <strong className="text-white">Workflows</strong> page and click{" "}
                <Badge color="blue">+ New Workflow</Badge> to open the visual workflow builder. Add nodes to the canvas,
                assign each node to an agent and a task prompt, then connect them in order. Use{" "}
                <code className="bg-gray-800 px-1 rounded">{"{{output}}"}</code> in a prompt to pass the previous
                step's result forward. Save the workflow and click <Badge color="green">Run</Badge> to execute it
                manually, or add it to a cron schedule for automatic runs.
              </p>
            </FaqItem>

            <FaqItem question="What is the audit log?">
              <p>
                The audit log is a complete, chronological record of every action performed in MultiClaw — user logins,
                agent operations, task submissions, skill and plugin changes, API key events, settings modifications, and
                more. It is the primary tool for security review, compliance reporting, and incident investigation. Find
                it on the <strong className="text-white">Audit Log</strong> page, where you can filter by actor, action
                type, resource, and date range, and export the results as CSV or JSON.
              </p>
            </FaqItem>

            <FaqItem question="How do I spawn multiple agents on the same host?">
              <p>
                Click <strong className="text-white">Spawn</strong> multiple times, giving each agent a unique name. Each
                spawned agent automatically gets its own isolated directory, virtual environment, and port, so they do
                not interfere with each other.
              </p>
            </FaqItem>

            <FaqItem question="What's the difference between Add and Spawn?">
              <p>
                <strong className="text-white">Add</strong> registers an agent that is already running somewhere — you
                provide its URL and API key. MultiClaw does not manage its lifecycle.
              </p>
              <p>
                <strong className="text-white">Spawn</strong> creates a new agent from scratch on the local host.
                MultiClaw fully manages the agent's process, including start, stop, restart, and deletion (including
                directory cleanup).
              </p>
            </FaqItem>

            <FaqItem question="How do I connect a remote agent?">
              <p>
                On the remote host, start the agent process. Find its API key in{" "}
                <code className="bg-gray-800 px-1 rounded">~/.multiclaw/agents/&lt;name&gt;/.env</code> (or wherever it was
                installed). Back in the dashboard, go to Agents &rarr; <strong className="text-white">+ Add Agent</strong>,
                enter the agent's public URL (e.g., <code className="bg-gray-800 px-1 rounded">http://192.168.1.50:8765</code>) and
                paste the API key.
              </p>
            </FaqItem>

            <FaqItem question="How do I change an agent's AI model?">
              <p>
                Open the agent's detail page and look for the <strong className="text-white">Model</strong> or{" "}
                <strong className="text-white">Settings</strong> tab. Select the desired model from the dropdown. The
                change is sent to the agent immediately. Make sure the corresponding provider API key is configured in
                Settings.
              </p>
            </FaqItem>

            <FaqItem question="Why does my agent show as 'error'?">
              <p>Common causes:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>The agent process crashed — try restarting it from the agent detail page.</li>
                <li>The agent is unreachable (wrong URL, firewall, or the host is down).</li>
                <li>The API key stored in the dashboard no longer matches the agent's actual key.</li>
                <li>The agent's port is in use by another process.</li>
              </ul>
              <p>
                Check agent logs via <code className="bg-gray-800 px-1 rounded">python manage.py logs</code> or the Logs
                tab on the agent detail page.
              </p>
            </FaqItem>

            <FaqItem question="How do I update MultiClaw?">
              <p>
                Run <code className="bg-gray-800 px-1 rounded">python manage.py update</code> on the host. This pulls the
                latest code, installs updated dependencies, and restarts the dashboard. Individual agents can also be
                updated from their detail page using the <strong className="text-white">Update</strong> button, which
                updates the agent's code and restarts it.
              </p>
            </FaqItem>

            <FaqItem question="What ports do agents use?">
              <p>
                By default, the dashboard runs on port <strong className="text-white">8080</strong>. Spawned agents are
                assigned ports starting from <strong className="text-white">8765</strong> and incrementing for each new
                agent. You can specify a custom port when spawning. Make sure the chosen ports are open in your
                firewall if agents need to be accessed remotely.
              </p>
            </FaqItem>

            <FaqItem question="How do I secure my deployment?">
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Run the dashboard behind a reverse proxy (nginx, Caddy) with HTTPS.</li>
                <li>Use strong, unique API keys and rotate them periodically.</li>
                <li>Restrict agent ports to internal network interfaces if not needed externally.</li>
                <li>Use role-based access — assign <Badge color="blue">viewer</Badge> or <Badge color="yellow">operator</Badge> roles instead of <Badge color="red">admin</Badge> where possible.</li>
                <li>Consider using Tailscale (the dashboard has built-in Tailscale status support) to keep traffic on a private network.</li>
                <li>Review the <a href="#audit-log" className="text-blue-400 hover:text-blue-300 transition">Audit Log</a> regularly to detect unexpected activity.</li>
              </ul>
            </FaqItem>

            <FaqItem question="How do I enable HTTPS?">
              <p>
                The easiest way is to re-run (or run for the first time){" "}
                <code className="bg-gray-800 px-1 rounded">install.sh</code> and choose the TLS wizard option.
                The wizard lets you either provide existing certificate files or use{" "}
                <strong className="text-white">certbot</strong> to obtain free Let's Encrypt certificates automatically.
              </p>
              <p>
                To configure TLS manually, set{" "}
                <code className="bg-gray-800 px-1 rounded">TLS_CERT</code> and{" "}
                <code className="bg-gray-800 px-1 rounded">TLS_KEY</code> in the dashboard's{" "}
                <code className="bg-gray-800 px-1 rounded">.env</code> file, and{" "}
                <code className="bg-gray-800 px-1 rounded">MULTICLAW_TLS_CERT</code> /{" "}
                <code className="bg-gray-800 px-1 rounded">MULTICLAW_TLS_KEY</code> in each agent's{" "}
                <code className="bg-gray-800 px-1 rounded">.env</code>, then restart the respective services. See the{" "}
                <a href="#tls-https" className="text-blue-400 hover:text-blue-300 transition">TLS / HTTPS</a> section for details.
              </p>
            </FaqItem>

            <FaqItem question="How do I renew TLS certificates?">
              <p>
                If you used the installer's certbot option, certificate renewal is fully automatic — a cron job runs
                daily at 3 AM and renews any certificates that are approaching expiry. No manual steps are required.
              </p>
              <p>
                If you manage certificates yourself, renew them with:
              </p>
              <CodeBlock>sudo certbot renew</CodeBlock>
              <p>
                After renewal, restart the dashboard and any agents that use the updated certificate files so they
                load the new certs.
              </p>
            </FaqItem>
          </div>
        </Section>

        {/* Troubleshooting */}
        <Section id="troubleshooting" title="Troubleshooting">
          <div className="space-y-4">
            <div className="border border-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-1">Dashboard won't start</h3>
              <p className="text-gray-400">
                Check that Node.js and npm are installed and that dependencies are up to date
                (<code className="bg-gray-800 px-1 rounded">npm install</code> in the <code className="bg-gray-800 px-1 rounded">multi-claw-dashboard</code> directory).
                Ensure port 8080 (or your configured port) is not in use. Review logs with{" "}
                <code className="bg-gray-800 px-1 rounded">python manage.py logs</code>.
              </p>
            </div>

            <div className="border border-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-1">Agent shows as offline immediately after spawning</h3>
              <p className="text-gray-400">
                Wait 5–10 seconds for the agent's virtual environment to initialize. If it remains offline, check that
                Python 3.10+ is installed and that the agent's port is not in use. View the agent's startup log in its
                directory: <code className="bg-gray-800 px-1 rounded">~/.multiclaw/agents/&lt;name&gt;/agent.log</code>.
              </p>
            </div>

            <div className="border border-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-1">Tasks fail with "no provider configured"</h3>
              <p className="text-gray-400">
                Go to <strong className="text-white">Settings</strong> and add an AI provider API key. If the key is
                already set, verify it is valid and has not expired. Restart the agent after saving a new key.
              </p>
            </div>

            <div className="border border-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-1">Plugin installation fails</h3>
              <p className="text-gray-400">
                Ensure git is installed on the dashboard host. Check network access to the registry URL. If the plugin
                is from a private repository, configure git credentials or SSH keys on the host. Review the dashboard
                logs for the specific error.
              </p>
            </div>

            <div className="border border-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-1">Cron job never runs</h3>
              <p className="text-gray-400">
                Verify the cron job is enabled (toggle is on). Check that the cron expression is valid — use a tool like
                crontab.guru to test your expression. Confirm the target agent is online. Check the cron history tab for
                error messages.
              </p>
            </div>

            <div className="border border-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-1">Real-time updates not working</h3>
              <p className="text-gray-400">
                Check the connection status indicator in the navigation bar. If it shows{" "}
                <strong className="text-white">disconnected</strong>, the SSE or WebSocket connection to the dashboard
                has been interrupted. This can be caused by a reverse proxy that times out idle connections — configure
                your proxy to increase its read timeout or enable WebSocket proxying. The dashboard will attempt to
                reconnect automatically.
              </p>
            </div>

            <div className="border border-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-1">Login loop / session not persisting</h3>
              <p className="text-gray-400">
                Clear your browser cookies and local storage for the dashboard domain. Ensure the dashboard's{" "}
                <code className="bg-gray-800 px-1 rounded">SESSION_SECRET</code> environment variable is set and not
                changing between restarts. If behind a reverse proxy, ensure it passes cookies and the{" "}
                <code className="bg-gray-800 px-1 rounded">Host</code> header correctly.
              </p>
            </div>

            <div className="border border-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-1">Database errors after update</h3>
              <p className="text-gray-400">
                Run <code className="bg-gray-800 px-1 rounded">npm run db:migrate</code> in the{" "}
                <code className="bg-gray-800 px-1 rounded">multi-claw-dashboard</code> directory to apply pending
                database migrations. Back up your database before running major updates.
              </p>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
