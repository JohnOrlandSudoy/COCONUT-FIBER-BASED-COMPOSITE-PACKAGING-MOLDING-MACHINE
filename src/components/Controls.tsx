import { Play, Pause, RotateCcw, Gauge } from 'lucide-react';

interface ControlsProps {
  playing: boolean;
  speed: number;
  progress: number;
  onPlayPause: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
}

const SPEEDS = [0.5, 1, 2];

export default function Controls({
  playing,
  speed,
  progress,
  onPlayPause,
  onReset,
  onSpeedChange,
}: ControlsProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20">
      {/* Progress bar */}
      <div className="h-1 w-full bg-gray-800">
        <div
          className="h-full bg-[#00ff88] transition-all duration-100 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="bg-[#0a0a0f]/90 backdrop-blur-md border-t border-gray-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          {/* Play/Pause + Reset */}
          <div className="flex items-center gap-3">
            <button
              onClick={onPlayPause}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88] hover:bg-[#00ff88]/20 transition-all duration-200"
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
              <span className="text-sm font-medium">{playing ? 'Pause' : 'Play'}</span>
            </button>

            <button
              onClick={onReset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 text-gray-300 hover:bg-gray-700/50 hover:text-white transition-all duration-200"
            >
              <RotateCcw size={16} />
              <span className="text-sm font-medium">Reset</span>
            </button>
          </div>

          {/* Speed control */}
          <div className="flex items-center gap-2">
            <Gauge size={16} className="text-gray-500" />
            <div className="flex gap-1">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => onSpeedChange(s)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                    speed === s
                      ? 'bg-[#00ff88] text-[#0a0a0f]'
                      : 'bg-gray-800/50 text-gray-400 hover:text-gray-200 border border-gray-700'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Cycle progress text */}
          <div className="text-sm text-gray-500 font-mono">
            {Math.round(progress * 15)}s / 15s
          </div>
        </div>
      </div>
    </div>
  );
}
