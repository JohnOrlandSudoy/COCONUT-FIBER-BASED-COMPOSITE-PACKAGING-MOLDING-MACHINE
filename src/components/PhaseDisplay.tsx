interface PhaseDisplayProps {
  phase: string;
}

const PHASE_LABELS: Record<string, string> = {
  IDLE: '⏸️ IDLE...',
  FEEDING: '🪣 FEEDING...',
  FILLING: '🧵 FILLING...',
  READY: '✅ READY...',
  PRESSING: '⚙️ PRESSING...',
  HOLDING: '🧱 HOLDING...',
  RELEASING: '⬆️ RELEASING...',
  EJECTING: '📤 EJECTING...',
  OUTPUT: '🚪 OUTPUT...',
  CONVEYING: '📦 CONVEYING...',   
};

export default function PhaseDisplay({ phase }: PhaseDisplayProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-20 flex justify-center pt-6 pointer-events-none">
      <div className="px-5 py-2.5 rounded-full bg-[#0a0a0f]/80 backdrop-blur-md border border-gray-800">
        <span className="text-white font-bold text-sm tracking-widest uppercase font-mono">
          {PHASE_LABELS[phase] ?? phase}
        </span>
      </div>
    </div>
  );
}
