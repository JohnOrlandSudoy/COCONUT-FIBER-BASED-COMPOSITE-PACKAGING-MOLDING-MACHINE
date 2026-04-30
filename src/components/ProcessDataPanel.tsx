import React from 'react';
import { Activity, Droplets, Thermometer, Timer, Ruler, Weight, Layers, ShieldCheck, RotateCcw } from 'lucide-react';

interface ProcessDataPanelProps {
  data: {
    sprayerFlow: string;
    sprayCycle: string;
    potHeight: string;
    potWeight: string;
    potThickness: string;
    binderAbsorption: string;
    stickiness: string;
    bondingStrength: string;
  };
}

export default function ProcessDataPanel({ data }: ProcessDataPanelProps) {
  return (
    <div className="fixed top-24 right-6 w-72 z-10 space-y-3">
      <div className="bg-[#0a0a0f]/80 backdrop-blur-lg border border-gray-800 rounded-xl overflow-hidden">
        <div className="bg-gray-800/50 px-4 py-2 border-b border-gray-700 flex items-center gap-2">
          <Activity size={16} className="text-[#00ff88]" />
          <span className="text-xs font-bold uppercase tracking-widest text-gray-300">Supporting Process Data</span>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Sprayer Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 flex items-center gap-1">
                <Droplets size={12} /> Sprayer Flow
              </span>
              <span className="text-[#00ff88] font-mono">{data.sprayerFlow} L/min</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 flex items-center gap-1">
                <RotateCcw size={12} /> Spray Cycle
              </span>
              <span className="text-[#00ff88] font-mono">{data.sprayCycle} cycles</span>
            </div>
          </div>

          <div className="h-px bg-gray-800" />

          {/* Pot Dimensions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 flex items-center gap-1">
                <Ruler size={12} /> Pot Height
              </span>
              <span className="text-white font-mono">{data.potHeight} cm</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 flex items-center gap-1">
                <Weight size={12} /> Pot Weight
              </span>
              <span className="text-white font-mono">{data.potWeight} g</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 flex items-center gap-1">
                <Layers size={12} /> Thickness
              </span>
              <span className="text-white font-mono">{data.potThickness} mm</span>
            </div>
          </div>

          <div className="h-px bg-gray-800" />

          {/* Material Properties */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 flex items-center gap-1">
                <Droplets size={12} /> Absorption
              </span>
              <span className="text-blue-400 font-mono">{data.binderAbsorption}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 flex items-center gap-1">
                <ShieldCheck size={12} /> Stickiness (cP)
              </span>
              <span className="text-orange-400 font-mono font-bold">{data.stickiness} cP</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 flex items-center gap-1">
                <Activity size={12} /> Bonding Strength
              </span>
              <div className="flex items-center gap-2 flex-1 justify-end ml-4">
                <div className="h-1.5 flex-1 bg-gray-800 rounded-full overflow-hidden max-w-[60px]">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${data.bondingStrength}%` }}
                  />
                </div>
                <span className="text-blue-400 font-mono">{data.bondingStrength}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
