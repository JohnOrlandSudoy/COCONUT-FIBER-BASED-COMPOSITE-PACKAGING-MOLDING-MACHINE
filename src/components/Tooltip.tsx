import { X } from 'lucide-react';

interface TooltipProps {
  open: boolean;
  x: number;
  y: number;
  name: string;
  description: string;
  onClose: () => void;
}

export default function Tooltip({ open, x, y, name, description, onClose }: TooltipProps) {
  if (!open) return null;

  const left = Math.min(window.innerWidth - 16, Math.max(16, x));
  const top = Math.min(window.innerHeight - 16, Math.max(16, y));

  return (
    <div
      className="fixed z-30"
      style={{
        left,
        top,
        transform: 'translate(12px, 12px)',
        pointerEvents: 'auto',
      }}
    >
      <div className="w-80 bg-[#0a0a0f]/95 backdrop-blur-md border border-[#00ff88]/25 rounded-xl shadow-2xl shadow-[#00ff88]/10 overflow-hidden font-mono">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#00ff88]/5">
          <div className="min-w-0">
            <div className="text-[11px] text-gray-500 uppercase tracking-wider">Part</div>
            <div className="text-sm text-white truncate">{name}</div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-800 text-gray-500 hover:text-gray-200 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        <div className="px-4 py-3">
          <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Description</div>
          <div className="text-sm text-gray-200 leading-relaxed">{description}</div>
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[#00ff88] via-[#00ff88]/50 to-transparent" />
      </div>
    </div>
  );
}
