import { Beaker, Droplets, Thermometer, Timer } from 'lucide-react';

type ParamKey = 'binderViscosity' | 'binderVolume' | 'molderTemperature' | 'pressingTime' | 'mixingTime';

interface ProcessControlsProps {
  params: {
    binderViscosity: number;
    binderVolume: number;
    molderTemperature: number;
    pressingTime: number;
    mixingTime: number;
  };
  onParamChange: (key: ParamKey, value: number) => void;
}

export default function ProcessControls({ params, onParamChange }: ProcessControlsProps) {
  return (
    <div className="fixed top-24 left-6 w-72 z-10 space-y-3">
      <div className="bg-[#0a0a0f]/80 backdrop-blur-lg border border-gray-800 rounded-xl overflow-hidden">
        <div className="bg-gray-800/50 px-4 py-2 border-b border-gray-700 flex items-center gap-2">
          <Beaker size={16} className="text-[#00ff88]" />
          <span className="text-xs font-bold uppercase tracking-widest text-gray-300">Input Parameters</span>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold flex items-center gap-1">
              <Droplets size={12} /> Binder Viscosity (cP)
            </label>
            <input
              type="number"
              value={params.binderViscosity}
              onChange={(e) => onParamChange('binderViscosity', Number(e.target.value))}
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-[#00ff88] focus:border-[#00ff88] outline-none transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold flex items-center gap-1">
              <Droplets size={12} /> Binder Volume (mL)
            </label>
            <input
              type="number"
              value={params.binderVolume}
              onChange={(e) => onParamChange('binderVolume', Number(e.target.value))}
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-[#00ff88] focus:border-[#00ff88] outline-none transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold flex items-center gap-1">
              <Thermometer size={12} /> Molder Temperature (°C)
            </label>
            <input
              type="number"
              value={params.molderTemperature}
              onChange={(e) => onParamChange('molderTemperature', Number(e.target.value))}
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-[#00ff88] focus:border-[#00ff88] outline-none transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold flex items-center gap-1">
              <Timer size={12} /> Pressing Time (s)
            </label>
            <input
              type="number"
              value={params.pressingTime}
              onChange={(e) => onParamChange('pressingTime', Number(e.target.value))}
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-[#00ff88] focus:border-[#00ff88] outline-none transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold flex items-center gap-1">
              <Timer size={12} /> Mixing Time (s)
            </label>
            <input
              type="number"
              value={params.mixingTime}
              onChange={(e) => onParamChange('mixingTime', Number(e.target.value))}
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-[#00ff88] focus:border-[#00ff88] outline-none transition-colors"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
