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
    fiberMass: 500,
    molderTemperature: 180,
    binderTankTemperature: 60,
    pressingTime: 8,
    mixingTime: 12,
    moistureLossScale: 1,
  });

  type ParamKey = keyof typeof params;

  const processData = useMemo(() => {
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    const classify = (v: number, recMin: number, recMax: number) => {
      if (v < recMin) return 'LOW / PROBLEM';
      if (v > recMax) return 'HIGH / PROBLEM';
      return 'RECOMMENDED';
    };
    const classifyColor = (status: string) => {
      if (status === 'RECOMMENDED' || status === 'ACCEPTABLE' || status === 'EXCELLENT') return 'ok';
      if (status === 'LOW / PROBLEM' || status === 'DEFECTIVE') return 'low';
      return 'high';
    };

    const {
      binderViscosity,
      binderVolume,
      fiberMass,
      molderTemperature,
      binderTankTemperature,
      pressingTime,
      mixingTime,
      moistureLossScale,
    } = params;

    const isActive = phase !== 'IDLE' && phase !== 'READY';

    const safeTankTemp = clamp(binderTankTemperature, -50, 200);
    const viscosityTempFactor = clamp(1 - (safeTankTemp - 25) * 0.006, 0.35, 1.4);
    const mu = Math.max(0, binderViscosity * viscosityTempFactor);

    const U = clamp(0.35 + mixingTime / 20 - mu / 1200 + (safeTankTemp - 25) * 0.002, 0, 1);

    const Q0 = 3.2;
    const k = 220;
    const Q = Q0 / (1 + mu / k);
    const binderFlowRate = isActive ? Q.toFixed(2) : '0.00';

    const V_L = Math.max(0, binderVolume) / 1000;
    const mixingTimeCalcSec = isActive ? ((V_L / Math.max(0.01, Q)) * 60 * (1 / Math.max(0.05, U))).toFixed(1) : '0.0';

    const A0 = 5;
    const k1 = 35;
    const k2 = 0.18;
    const k3 = 0.06;
    const absorptionPct = isActive ? clamp(A0 + k1 * U + k2 * molderTemperature + k3 * Math.max(0, binderVolume), 0, 100) : 0;
    const binderAbsorption = absorptionPct.toFixed(1);

    const stickiness = Math.max(0, mu).toFixed(0);

    const pressSec = Math.max(0, pressingTime) * 5;
    const P = clamp((pressSec - 30) / 20, 0, 1);
    const Tn = clamp((molderTemperature - 80) / 30, 0, 1);
    const Sn = clamp(mu / 350, 0, 1);
    const An = clamp(absorptionPct / 100, 0, 1);

    const bondingStrengthN = clamp(0.35 * Sn + 0.25 * An + 0.20 * Tn + 0.20 * P, 0, 1);
    const bondingStrength = (bondingStrengthN * 100).toFixed(1);

    const binderMassG = Math.max(0, binderVolume) * 0.85;
    const Mf = clamp(0.22 - (molderTemperature - 80) * 0.0012 + Math.max(0, binderVolume) * 0.0001, 0.02, 0.22);
    const wetMassG = Math.max(0, fiberMass) + binderMassG;
    const waterLossG = wetMassG * Mf * clamp(moistureLossScale, 0, 3);
    const finalWeightG = Math.max(0, fiberMass) + binderMassG - waterLossG;

    const potWeight = finalWeightG.toFixed(1);
    const potHeight = clamp(9.1 - 0.6 * P + 0.25 * (U - 0.6) + Math.max(0, binderVolume) / 400, 8.0, 10.2).toFixed(2);
    const potThicknessCm = clamp(1.45 + 0.25 * (1 - U) + 0.20 * (1 - bondingStrengthN) + 0.02, 1.0, 2.3);
    const potThickness = potThicknessCm.toFixed(2);

    const viscosityTarget = 250;
    const viscosityError = clamp(Math.abs(mu - viscosityTarget) / viscosityTarget, 0, 1);
    const defectRiskN = clamp((1 - U) + (1 - bondingStrengthN) + Mf + viscosityError, 0, 3);
    const defectRisk = ((defectRiskN / 3) * 100).toFixed(1);

    const qualityScoreN = clamp(0.30 * U + 0.35 * bondingStrengthN + 0.20 * Tn + 0.15 * P, 0, 1);
    const qualityScoreNum = qualityScoreN * 100;
    const qualityScore = qualityScoreNum.toFixed(1);
    const qualityLabel = qualityScoreNum < 60 ? 'DEFECTIVE' : qualityScoreNum < 85 ? 'ACCEPTABLE' : 'EXCELLENT / GOOD POT';
    const qualityMeaning =
      qualityScoreNum < 60
        ? 'Poor forming conditions. Product may have weak bonding, uneven walls, excess moisture, or deformation.'
        : qualityScoreNum < 85
          ? 'Usable product with moderate quality. Some process improvement may still be needed.'
          : 'Strong and uniform pot. Parameters are within the recommended forming range.';

    const fiberMassA = Math.max(0, fiberMass);
    const binderVolumeA = Math.max(0, binderVolume);
    const molderTempA = clamp(molderTemperature, -50, 300);
    const pressingTimeA = Math.max(0, pressingTime);
    const wallThicknessA = potThicknessCm;
    const potHeightA = Number(potHeight);

    const thresholdsA = [
      {
        id: 'P1',
        parameter: 'Fiber Mass',
        value: fiberMassA,
        unit: 'g',
        status: classify(fiberMassA, 237.5, 262.5),
        effect: 'Affects final weight, density, wall filling, and compression load.',
      },
      {
        id: 'P2',
        parameter: 'Binder Volume',
        value: binderVolumeA,
        unit: 'mL',
        status: classify(binderVolumeA, 237.5, 262.5),
        effect: 'Controls bonding, moisture absorption, and defect risk.',
      },
      {
        id: 'P3',
        parameter: 'Binder Viscosity',
        value: mu,
        unit: 'cP',
        status: classify(mu, 150, 350),
        effect: 'Controls flow rate, stickiness, penetration, and mixing quality.',
      },
      {
        id: 'P4',
        parameter: 'Molder Temperature',
        value: molderTempA,
        unit: '°C',
        status: classify(molderTempA, 90, 100),
        effect: 'Controls moisture removal, binder curing, and bonding quality.',
      },
      {
        id: 'P5',
        parameter: 'Pressing Time',
        value: pressingTimeA,
        unit: 's',
        status: classify(pressingTimeA, 30, 50),
        effect: 'Controls compaction, wall formation, and curing duration.',
      },
      {
        id: 'P6',
        parameter: 'Fiber Uniformity',
        value: U,
        unit: '0–1',
        status: classify(U, 0.6, 0.8),
        effect: 'Controls wall thickness stability and defect risk.',
      },
      {
        id: 'P10',
        parameter: 'Wall Thickness',
        value: wallThicknessA,
        unit: 'cm',
        status: classify(wallThicknessA, 1.3, 1.7),
        effect: 'Shows wall formation quality and material distribution.',
      },
      {
        id: 'P11',
        parameter: 'Pot Height',
        value: potHeightA,
        unit: 'cm',
        status: classify(potHeightA, 8.8, 9.2),
        effect: 'Shows dimensional accuracy after pressing.',
      },
      {
        id: 'P12',
        parameter: 'Quality Score',
        value: qualityScoreNum,
        unit: '%',
        status: qualityScoreNum < 60 ? 'DEFECTIVE' : qualityScoreNum < 85 ? 'ACCEPTABLE' : 'EXCELLENT',
        effect: 'Overall weighted evaluation of process success.',
      },
    ].map((x) => ({ ...x, tone: classifyColor(x.status) }));

    return {
      binderFlowRate,
      mixingTimeCalcSec,
      potHeight,
      potWeight,
      potThickness,
      binderAbsorption,
      stickiness,
      bondingStrength,
      defectRisk,
      qualityScore,
      qualityLabel,
      qualityMeaning,
      thresholdsA,
      wetMass: wetMassG.toFixed(1),
      binderMass: binderMassG.toFixed(1),
      waterLoss: waterLossG.toFixed(1),
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
          mixingTime={params.mixingTime}
          fiberMass={params.fiberMass}
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
