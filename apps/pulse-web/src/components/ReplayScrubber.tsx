import { motion } from 'framer-motion';
import { WorkflowEvent } from '../hooks/useWorkflowReplay';

interface ReplayScrubberProps {
  events: WorkflowEvent[];
  replayState: any; // Taking engine state from parent
}

export function ReplayScrubber({ events, replayState }: ReplayScrubberProps) {
  const { currentStepIndex, isPlaying, play, pause, reset, stepForward, stepBackward } = replayState;

  // Render an empty-state placeholder when there are no events so the component
  // does not crash with TypeError accessing events[0].nodeId on an empty array.
  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center p-5 border border-gray-200 rounded-xl bg-white shadow-sm w-full mx-auto text-sm text-gray-400">
        No execution events to display.
      </div>
    );
  }

  const progress = events.length > 1 ? (currentStepIndex / (events.length - 1)) * 100 : 0;
  const activeNodeId = events[currentStepIndex]?.nodeId ?? 'none';

  return (
    <div className="flex flex-col gap-4 p-5 border border-gray-200 rounded-xl bg-white shadow-sm w-full mx-auto">
      <div className="flex justify-between items-center text-sm font-medium text-gray-700">
        <span>Execution Timeline</span>
        <span className="bg-gray-100 px-2 py-1 rounded font-mono text-xs">
          Step {currentStepIndex + 1} of {events.length}
        </span>
      </div>

      <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className="absolute top-0 left-0 h-full bg-blue-600 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        />
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-3">
          <button onClick={reset} className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition">Reset</button>
          <button onClick={stepBackward} disabled={currentStepIndex === 0} className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-40 transition">◀ Prev</button>
          <button onClick={isPlaying ? pause : play} className="px-6 py-1.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition">
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button onClick={stepForward} disabled={currentStepIndex === events.length - 1} className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-40 transition">Next ▶</button>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Active Node:</span>
          <span className="font-mono text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700">
            {activeNodeId}
          </span>
        </div>
      </div>
    </div>
  );
}