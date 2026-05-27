import ReactFlow, { Background, Controls, Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { WorkflowEvent } from '../hooks/useWorkflowReplay';

const initialEdges: Edge[] = [
  { id: 'e1-2', source: 'node-auth', target: 'node-fetch-data', animated: true },
  { id: 'e2-3', source: 'node-fetch-data', target: 'node-process', animated: true },
  { id: 'e3-4', source: 'node-process', target: 'node-save', animated: true },
];

interface WorkflowGraphProps {
  events: WorkflowEvent[];
  currentIndex: number;
}

export function WorkflowGraph({ events, currentIndex }: WorkflowGraphProps) {
  // Graph ke nodes ko dynamically style assign karna
  const nodes: Node[] = events.map((event, index) => {
    const isPastOrCurrent = index <= currentIndex;
    const isCurrent = index === currentIndex;
    
    let bgColor = '#ffffff';
    let borderColor = '#e5e7eb';

    if (isPastOrCurrent) {
      if (event.status === 'success') { bgColor = '#dcfce7'; borderColor = '#22c55e'; } // Green
      else if (event.status === 'failed') { bgColor = '#fee2e2'; borderColor = '#ef4444'; } // Red
      else if (event.status === 'running') { bgColor = '#dbeafe'; borderColor = '#3b82f6'; } // Blue
      else { bgColor = '#fef9c3'; borderColor = '#eab308'; } // Yellow
    }

    return {
      id: event.nodeId,
      position: { x: 250 + index * 200, y: 150 }, // Horizontal layout
      data: { label: event.nodeId },
      style: {
        background: bgColor,
        border: `2px solid ${isCurrent ? '#000000' : borderColor}`,
        borderRadius: '8px',
        padding: '10px',
        width: 150,
        textAlign: 'center',
        fontWeight: isCurrent ? 'bold' : 'normal',
        boxShadow: isCurrent ? '0 4px 10px rgba(0,0,0,0.1)' : 'none',
        transition: 'all 0.3s ease',
      }
    };
  });

  return (
    <div className="w-full h-[300px] border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
      <ReactFlow nodes={nodes} edges={initialEdges} fitView>
        <Background color="#ccc" gap={16} />
        <Controls />
      </ReactFlow>
    </div>
  );
}