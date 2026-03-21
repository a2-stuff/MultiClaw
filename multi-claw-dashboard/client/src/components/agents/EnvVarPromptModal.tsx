import { useState, useMemo } from "react";
import type { PluginManifest, PluginEnvVar, PluginDependency, AgentPluginStatus, RegistryPlugin } from "../../lib/types";

interface Props {
  open: boolean;
  plugin: RegistryPlugin;
  agentId: string;
  agentName: string;
  /** All registry plugins to check dependency status */
  allPlugins: RegistryPlugin[];
  onClose: () => void;
  onDeploy: (envVars: Record<string, string>) => void;
  deploying: boolean;
}

export function EnvVarPromptModal({
  open,
  plugin,
  agentId,
  agentName,
  allPlugins,
  onClose,
  onDeploy,
  deploying,
}: Props) {
  const manifest = plugin.manifest as PluginManifest | null | undefined;
  const [values, setValues] = useState<Record<string, string>>({});
  const [autoGenerate, setAutoGenerate] = useState<Record<string, boolean>>({});
  const [showOptional, setShowOptional] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Initialize default values
  const envVars = useMemo(() => manifest?.envVars ?? [], [manifest]);
  const dependencies = useMemo(() => manifest?.dependencies ?? [], [manifest]);
  const sysReqs = useMemo(() => manifest?.systemRequirements ?? [], [manifest]);

  const requiredVars = envVars.filter((v) => v.required);
  const optionalVars = envVars.filter((v) => !v.required);

  // Check dependency status on this agent
  const depStatus = useMemo(() => {
    return dependencies.map((dep) => {
      const depPlugin = allPlugins.find((p) => p.slug === dep.slug);
      if (!depPlugin) return { ...dep, installed: false, pluginName: dep.slug };
      const agentStatus = depPlugin.agents?.find((a: AgentPluginStatus) => a.agentId === agentId);
      return {
        ...dep,
        installed: agentStatus?.status === "installed",
        pluginName: depPlugin.name,
      };
    });
  }, [dependencies, allPlugins, agentId]);

  const hasUnmetDeps = depStatus.some((d) => !d.installed);

  function setValue(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
    // Clear validation error on change
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  function toggleAutoGenerate(name: string) {
    setAutoGenerate((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    for (const v of requiredVars) {
      if (autoGenerate[v.name]) continue; // will be generated during install
      const val = values[v.name]?.trim();
      if (!val) {
        errors[v.name] = "Required";
        continue;
      }
      if (v.validationRegex) {
        try {
          if (!new RegExp(v.validationRegex).test(val)) {
            errors[v.name] = `Must match pattern: ${v.validationRegex}`;
          }
        } catch {}
      }
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleDeploy() {
    if (!validate()) return;
    // Build env vars map, including defaults
    const envMap: Record<string, string> = {};
    for (const v of envVars) {
      if (autoGenerate[v.name]) {
        envMap[`__AUTO_GENERATE_${v.name}`] = v.autoGenerate || "true";
        continue;
      }
      const val = values[v.name]?.trim();
      if (val) {
        envMap[v.name] = val;
      } else if (v.defaultValue) {
        envMap[v.name] = v.defaultValue;
      }
    }
    onDeploy(envMap);
  }

  if (!open) return null;

  const inputClass =
    "w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 transition";

  function renderEnvVar(v: PluginEnvVar) {
    const isAuto = autoGenerate[v.name];
    const error = validationErrors[v.name];

    return (
      <div key={v.name} className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="block text-xs text-gray-400">
            {v.name}
            {v.required && <span className="text-red-400 ml-0.5">*</span>}
          </label>
          {v.autoGenerate && (
            <button
              type="button"
              onClick={() => toggleAutoGenerate(v.name)}
              className={`text-xs px-2 py-0.5 rounded-full transition ${
                isAuto
                  ? "bg-emerald-900/50 text-emerald-400 border border-emerald-800"
                  : "bg-gray-800 text-gray-500 border border-gray-700 hover:text-gray-300"
              }`}
            >
              {isAuto ? "Auto-generating" : "Auto-generate"}
            </button>
          )}
        </div>
        {isAuto ? (
          <div className="px-3 py-2 bg-emerald-950/30 border border-emerald-900/50 rounded-lg text-emerald-400/80 text-xs">
            Will be generated during installation
          </div>
        ) : (
          <input
            type={v.secret ? "password" : "text"}
            placeholder={v.defaultValue ? `Default: ${v.defaultValue}` : `Enter ${v.name}`}
            value={values[v.name] || ""}
            onChange={(e) => setValue(v.name, e.target.value)}
            className={`${inputClass} ${error ? "border-red-500/50" : ""}`}
          />
        )}
        {v.description && !isAuto && (
          <p className="text-xs text-gray-600">{v.description}</p>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Configure {plugin.name}</h3>
              <p className="text-gray-500 text-xs mt-0.5">
                Deploying to <span className="text-gray-300">{agentName}</span>
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">
              &times;
            </button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Dependencies */}
          {dependencies.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Dependencies</h4>
              <div className="space-y-1.5">
                {depStatus.map((dep) => (
                  <div
                    key={dep.slug}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                      dep.installed
                        ? "bg-green-950/20 border border-green-900/30"
                        : "bg-red-950/20 border border-red-900/30"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dep.installed ? "bg-green-400" : "bg-red-400"}`} />
                    <span className={dep.installed ? "text-green-400" : "text-red-400"}>
                      {dep.pluginName}
                    </span>
                    <span className="text-gray-600 text-xs ml-auto">
                      {dep.installed ? "Installed" : "Not installed"}
                    </span>
                  </div>
                ))}
              </div>
              {hasUnmetDeps && (
                <p className="text-red-400 text-xs mt-2">
                  Install missing dependencies first before deploying this plugin.
                </p>
              )}
            </div>
          )}

          {/* System Requirements */}
          {sysReqs.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">System Requirements</h4>
              <div className="flex flex-wrap gap-1.5">
                {sysReqs.map((req) => (
                  <span
                    key={req}
                    className="text-xs px-2 py-1 rounded-md bg-gray-800 border border-gray-700 text-gray-300"
                  >
                    {req}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Required Environment Variables */}
          {requiredVars.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Required Configuration
              </h4>
              <div className="space-y-3">
                {requiredVars.map(renderEnvVar)}
              </div>
            </div>
          )}

          {/* Optional Environment Variables */}
          {optionalVars.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowOptional(!showOptional)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition"
              >
                <span className={`transition-transform ${showOptional ? "rotate-90" : ""}`}>&#9654;</span>
                {optionalVars.length} optional variable{optionalVars.length !== 1 ? "s" : ""}
              </button>
              {showOptional && (
                <div className="space-y-3 mt-2">
                  {optionalVars.map(renderEnvVar)}
                </div>
              )}
            </div>
          )}

          {/* No config needed */}
          {envVars.length === 0 && dependencies.length === 0 && sysReqs.length === 0 && (
            <div className="text-center py-4">
              <p className="text-gray-400 text-sm">No configuration needed.</p>
              <p className="text-gray-600 text-xs mt-1">This plugin can be deployed immediately.</p>
            </div>
          )}

          {/* Post-install steps preview */}
          {manifest?.postInstallSteps && manifest.postInstallSteps.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Post-Deploy Steps
              </h4>
              <div className="space-y-1">
                {manifest.postInstallSteps.map((step, i) => (
                  <div key={step.id} className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-4 h-4 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-[10px] text-gray-500 flex-shrink-0">
                      {i + 1}
                    </span>
                    {step.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-800 flex justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleDeploy}
            disabled={deploying || hasUnmetDeps}
            className="px-5 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-white text-sm font-medium transition"
          >
            {deploying ? "Deploying..." : "Deploy"}
          </button>
        </div>
      </div>
    </div>
  );
}
