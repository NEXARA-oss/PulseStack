import { useState, useEffect, useCallback } from 'react';

// Type definition for a workflow execution event
export type WorkflowEvent = {
  id: string;
  nodeId: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  timestamp: number;
  logs?: string;
};

export function useWorkflowReplay(events: WorkflowEvent[]) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1000); // Default speed: 1 second per step

  // Controls
  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  
  const reset = useCallback(() => {
    setIsPlaying(false);
    setCurrentStepIndex(0);
  }, []);

  const stepForward = useCallback(() => {
    setCurrentStepIndex((prev) => Math.min(prev + 1, Math.max(0, events.length - 1)));
  }, [events.length]);

  const stepBackward = useCallback(() => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  // The Playback Engine (Runs when isPlaying is true)
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    
    if (isPlaying && currentStepIndex < events.length - 1) {
      timer = setInterval(() => {
        stepForward();
      }, playbackSpeed);
    } else if (currentStepIndex >= events.length - 1) {
      // Auto-pause when we reach the end of the execution timeline
      setIsPlaying(false); 
    }
    
    return () => clearInterval(timer);
  }, [isPlaying, currentStepIndex, events.length, playbackSpeed, stepForward]);

  return {
    currentStepIndex,
    currentEvent: events[currentStepIndex],
    isPlaying,
    playbackSpeed,
    play,
    pause,
    reset,
    stepForward,
    stepBackward,
    setPlaybackSpeed,
  };
}