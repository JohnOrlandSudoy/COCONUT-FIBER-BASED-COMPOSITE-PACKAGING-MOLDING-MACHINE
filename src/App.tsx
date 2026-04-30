import { useState, useCallback, useMemo } from 'react';
import MoldingMachine from './components/MoldingMachine';
import Controls from './components/Controls';
import Tooltip from './components/Tooltip';
import PhaseDisplay from './components/PhaseDisplay';
import ProcessDataPanel from './components/ProcessDataPanel';
import ProcessControls from './components/ProcessControls';

import { Activity } from 'lucide-react';

function App() {
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [phase, setPhase] = useState('IDLE');
  const [progress, setProgress] = useState(0);
  const [selectedPart, setSelectedPart] = useState<{
    name: string;
    info: string;
    x: number;
    y: number;
  } | null>(null);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [showData, setShowData] = useState(false);

  const [params, setParams] = useState({
    binderViscosity: 250,
    binderVolume: 15,
    molderTemperature: 180,
    pressingTime: 8,
    mixingTime: 12,
  });

  type ParamKey = keyof typeof params;

  const processData = useMemo(() => {
    const { binderViscosity, binderVolume, molderTemperature, pressingTime } = params;

    const isActive = phase !== 'IDLE' && phase !== 'READY';

    const sprayerFlow = isActive ? (binderVolume / 2.5).toFixed(1) : '0.0';
    const sprayCycle = isActive ? (binderViscosity / 100).toFixed(1) : '0.0';
    const potHeight = (10 + binderVolume / 10).toFixed(1);
    const potWeight = (binderVolume * 0.85 + 5).toFixed(1);
    const potThickness = (2 + binderViscosity / 500).toFixed(1);

    const binderAbsorption = isActive ? Math.min(95, binderViscosity / 10 + binderVolume * 2).toFixed(1) : '0.0';
    const stickiness = Math.max(0, binderViscosity).toFixed(0);
    const bondingStrength = isActive
      ? Math.min(100, molderTemperature / 2 + pressingTime * 2).toFixed(1)
      : '0.0';

    return {
      sprayerFlow,
      sprayCycle,
      potHeight,
      potWeight,
      potThickness,
      binderAbsorption,
      stickiness,
      bondingStrength,
    };
  }, [params, phase]);

  const handleParamChange = useCallback((key: ParamKey, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handlePlayPause = useCallback(() => {
    setPlaying((p) => !p);
  }, []);

  const handleReset = useCallback(() => {
    setResetTrigger((t) => t + 1);
    setPlaying(false);
    setTimeout(() => setPlaying(true), 100);
  }, []);

  const handleSpeedChange = useCallback((s: number) => {
    setSpeed(s);
  }, []);

  const handlePhaseChange = useCallback((p: string) => {
    setPhase(p);
  }, []);

  const handleProgress = useCallback((p: number) => {
    setProgress(p);
  }, []);

  const handlePartClick = useCallback((name: string, info: string, x: number, y: number) => {
    setSelectedPart({ name, info, x, y });
  }, []);

  const handleMissClick = useCallback(() => {
    setSelectedPart(null);
  }, []);

  const toggleShowData = useCallback(() => {
    setShowData((prev) => !prev);
  }, []);

  return (
    <div className="h-screen w-screen bg-[#0a0a0f] overflow-hidden relative font-mono">
      <PhaseDisplay phase={phase} />

      {/* Title */}
      <div className="fixed top-16 left-6 z-10 pointer-events-none">
        <h1 className="text-white/80 text-lg font-semibold tracking-tight">
          Coconut Fiber Composite
        </h1>
        <p className="text-gray-500 text-xs tracking-wider uppercase mt-0.5">
          Packaging Molding Machine
        </p>
      </div>

      <div className="absolute inset-0">
        <MoldingMachine
          playing={playing}
          speed={speed}
          pressingTime={params.pressingTime}
          onPhaseChange={handlePhaseChange}
          onProgress={handleProgress}
          onPartClick={handlePartClick}
          resetTrigger={resetTrigger}
          onMissClick={handleMissClick}
        />
      </div>

      <Tooltip
        open={!!selectedPart}
        x={selectedPart?.x ?? 0}
        y={selectedPart?.y ?? 0}
        name={selectedPart?.name ?? ''}
        description={selectedPart?.info ?? ''}
        onClose={handleMissClick}
      />

      {/* Overlays */}
      <div className="fixed top-6 right-6 z-30">
        <button
          onClick={toggleShowData}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 ${
            showData 
              ? 'bg-[#00ff88]/20 border-[#00ff88]/50 text-[#00ff88]' 
              : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:text-white'
          }`}
        >
          <Activity size={18} />
          <span className="text-sm font-bold uppercase tracking-wider">
            {showData ? 'Hide Process Data' : 'Show Process Data'}
          </span>
        </button>
      </div>

      <ProcessControls params={params} onParamChange={handleParamChange} />

      <PhaseDisplay phase={phase} />
      {showData && <ProcessDataPanel data={processData} />}
      <Controls
        playing={playing}
        speed={speed}
        progress={progress}
        onPlayPause={handlePlayPause}
        onReset={handleReset}
        onSpeedChange={handleSpeedChange}
      />
    </div>
  );
}

export default App;
