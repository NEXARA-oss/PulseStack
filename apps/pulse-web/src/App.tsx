import { ReplayScrubber } from './components/ReplayScrubber';
import { WorkflowGraph } from './components/WorkflowGraph';
import { useWorkflowReplay, WorkflowEvent } from './hooks/useWorkflowReplay';

// Humara mock execution data
const MOCK_EVENTS: WorkflowEvent[] = [
  { id: '1', nodeId: 'node-auth', status: 'success', timestamp: 1000 },
  { id: '2', nodeId: 'node-fetch-data', status: 'success', timestamp: 2000 },
  { id: '3', nodeId: 'node-process', status: 'running', timestamp: 3000 },
  { id: '4', nodeId: 'node-save', status: 'failed', timestamp: 4000 },
];

function App() {
  // Engine ab App level par chalega!
  const replayState = useWorkflowReplay(MOCK_EVENTS);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-800">PulseStack Replay Viewer 🎬</h1>
          <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-bold">Advanced Tier</span>
        </div>
        
        {/* Graph Component */}
        <WorkflowGraph events={MOCK_EVENTS} currentIndex={replayState.currentStepIndex} />

        {/* Timeline UI Component */}
        <ReplayScrubber events={MOCK_EVENTS} replayState={replayState} />
      </div>
    </div>
  );
}

export default App;