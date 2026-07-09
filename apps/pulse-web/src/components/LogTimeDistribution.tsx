import { useMemo } from 'react';
import { motion } from 'framer-motion';

type LogTimeBucket = {
  time: number;
  count: number;
};

type LogTimeDistributionProps = {
  buckets: LogTimeBucket[];
  maxCount: number;
  onBucketClick?: (time: number) => void;
};

export function LogTimeDistribution({ buckets, maxCount, onBucketClick }: LogTimeDistributionProps) {
  if (buckets.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">Time Distribution</div>
        <div className="h-16 flex items-center justify-center text-[10px] font-mono text-white/30">No data</div>
      </div>
    );
  }

  // Group buckets into bars (max ~60 bars for display)
  const displayBuckets = useMemo(() => {
    if (buckets.length <= 60) return buckets;
    // Aggregate smaller buckets into larger groups
    const groupSize = Math.ceil(buckets.length / 60);
    const groups: LogTimeBucket[] = [];
    for (let i = 0; i < buckets.length; i += groupSize) {
      const chunk = buckets.slice(i, i + groupSize);
      const totalCount = chunk.reduce((sum, b) => sum + b.count, 0);
      groups.push({ time: chunk[0].time, count: totalCount });
    }
    return groups;
  }, [buckets]);

  const effectiveMax = Math.max(maxCount, 1);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">Time Distribution</div>
      <div className="h-16 flex items-end gap-[2px]">
        {displayBuckets.map((bucket, i) => {
          const heightPercent = (bucket.count / effectiveMax) * 100;
          const isActive = bucket.count > 0;
          return (
            <motion.button
              key={`${bucket.time}-${i}`}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(heightPercent, bucket.count > 0 ? 8 : 3)}%` }}
              transition={{ duration: 0.3, delay: i * 0.005 }}
              onClick={() => onBucketClick?.(bucket.time)}
              className="flex-1 rounded-sm transition-all hover:bg-cyan/40"
              style={{
                backgroundColor: isActive
                  ? `rgba(96, 165, 250, ${0.2 + (bucket.count / effectiveMax) * 0.6})`
                  : 'rgba(255,255,255,0.03)',
                minHeight: bucket.count > 0 ? '4px' : '2px',
              }}
              title={`${new Date(bucket.time).toLocaleTimeString()}: ${bucket.count} logs`}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1 text-[8px] font-mono text-white/30">
        <span>{buckets.length > 0 ? new Date(buckets[0].time).toLocaleTimeString() : ''}</span>
        <span>{buckets.length > 0 ? new Date(buckets[buckets.length - 1].time).toLocaleTimeString() : ''}</span>
      </div>
    </div>
  );
}