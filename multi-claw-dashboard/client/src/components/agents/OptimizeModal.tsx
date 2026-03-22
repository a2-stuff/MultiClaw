interface OptimizeModalProps {
  isOpen: boolean;
  original: string;
  optimized: string;
  intensity: "light" | "medium" | "heavy";
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
            className="text-gray-400 hover:text-white text-xl leading-none transition"
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
