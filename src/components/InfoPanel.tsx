import { X, Cpu } from 'lucide-react';

interface InfoPanelProps {
  partName: string | null;
  partInfo: string | null;
  onClose: () => void;
}

export default function InfoPanel({ partName, partInfo, onClose }: InfoPanelProps) {
  if (!partName || !partInfo) return null;

  return (
    <div className="fixed top-20 right-6 z-30 w-80 animate-in slide-in-from-right-5 duration-300">
      <div className="bg-[#0a0a0f]/95 backdrop-blur-md border border-[#00ff88]/20 rounded-xl shadow-2xl shadow-[#00ff88]/5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#00ff88]/5">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-[#00ff88]" />
            <span className="text-sm font-semibold text-[#00ff88]">Component Info</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-4 space-y-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Part Name</p>
            <p className="text-white font-mono text-sm">{partName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Function</p>
            <p className="text-gray-300 text-sm leading-relaxed">{partInfo}</p>
          </div>
        </div>

        {/* Accent line */}
        <div className="h-0.5 bg-gradient-to-r from-[#00ff88] via-[#00ff88]/50 to-transparent" />
      </div>
    </div>
  );
}
