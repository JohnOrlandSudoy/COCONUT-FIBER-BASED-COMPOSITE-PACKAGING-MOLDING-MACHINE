import React from 'react';
import { Activity, Droplets, Thermometer, Timer, Ruler, Weight, Layers, ShieldCheck, RotateCcw } from 'lucide-react';

interface ProcessDataPanelProps {
  data: {
    binderFlowRate: string;
    mixingTimeCalcSec: string;
    potHeight: string;
    potWeight: string;
    potThickness: string;
    binderAbsorption: string;
    stickiness: string;
    bondingStrength: string;
    defectRisk: string;
    qualityScore: string;
    qualityLabel: string;
    qualityMeaning: string;
    thresholdsA: {
      id: string;
      parameter: string;
      value: number;
      unit: string;
      status: string;
      tone: 'ok' | 'low' | 'high';
      effect: string;
    }[];
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
          {/* Flow + Mix */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 flex items-center gap-1">
                <Droplets size={12} /> Binder Flow Rate
              </span>
              <span className="text-[#00ff88] font-mono">{data.binderFlowRate} L/min</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 flex items-center gap-1">
                <RotateCcw size={12} /> Mixing Time (calc)
              </span>
              <span className="text-[#00ff88] font-mono">{data.mixingTimeCalcSec} s</span>
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
                <Weight size={12} /> Final Weight
              </span>
              <span className="text-white font-mono">{data.potWeight} g</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 flex items-center gap-1">
                <Layers size={12} /> Wall Thickness
              </span>
              <span className="text-white font-mono">{data.potThickness} cm</span>
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
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 flex items-center gap-1">
                <Thermometer size={12} /> Defect Risk
              </span>
              <span className="text-red-300 font-mono">{data.defectRisk}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 flex items-center gap-1">
                <Timer size={12} /> Quality Score
              </span>
              <span className="text-emerald-300 font-mono">{data.qualityScore}%</span>
            </div>
            <div className="flex items-start justify-between text-xs gap-3">
              <span className="text-gray-500 flex items-center gap-1 whitespace-nowrap">
                <ShieldCheck size={12} /> Result
              </span>
              <div className="text-right">
                <div
                  className={`font-bold ${
                    data.qualityLabel === 'DEFECTIVE'
                      ? 'text-red-300'
                      : data.qualityLabel === 'ACCEPTABLE'
                        ? 'text-yellow-300'
                        : 'text-emerald-300'
                  }`}
                >
                  {data.qualityLabel}
                </div>
                <div className="text-[10px] leading-snug text-gray-400 max-w-[180px]">{data.qualityMeaning}</div>
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-800" />

          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
              A. Parameter Thresholds
            </div>
            <div className="space-y-2">
              {data.thresholdsA.map((row) => (
                <div key={row.id} className="flex items-start justify-between text-xs gap-3">
                  <div className="min-w-0">
                    <div className="text-gray-300 truncate">
                      <span className="text-gray-500">{row.id}:</span> {row.parameter}
                    </div>
                    <div className="text-[10px] leading-snug text-gray-500">{row.effect}</div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <div className="text-white font-mono">
                      {row.value.toFixed(row.unit === '0–1' ? 2 : 1)} {row.unit}
                    </div>
                    <div
                      className={`text-[10px] font-bold ${
                        row.tone === 'ok' ? 'text-emerald-300' : row.tone === 'low' ? 'text-yellow-300' : 'text-red-300'
                      }`}
                    >
                      {row.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
