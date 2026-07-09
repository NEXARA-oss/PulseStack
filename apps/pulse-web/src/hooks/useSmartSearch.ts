import { useMemo } from 'react';
import type { LogEntry } from '../hooks/useLogs';

export type SmartSearchOptions = {
  query: string;
  mode: 'text' | 'regex';
  enabled: boolean;
};

type ParsedQuery = {
  exactPhrases: string[];
  excludeTerms: string[];
  orTerms: string[][];
  fieldFilters: Array<{ field: string; value: string }>;
  plainTerms: string[];
};

/**
 * Parses a search query with support for:
 * - "exact phrase" matching
 * - -exclusion terms
 * - OR | grouping
 * - field:value filters (e.g., traceId:abc, level:error)
 */
function parseQuery(query: string): ParsedQuery {
  const exactPhrases: string[] = [];
  const excludeTerms: string[] = [];
  const orTerms: string[][] = [];
  const fieldFilters: Array<{ field: string; value: string }> = [];
  const plainTerms: string[] = [];

  // Extract exact phrases first
  let remaining = query;
  const phraseRegex = /"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = phraseRegex.exec(remaining)) !== null) {
    exactPhrases.push(match[1].toLowerCase());
  }
  remaining = remaining.replace(/"([^"]+)"/g, '').trim();

  // Tokenize remaining
  const tokens = remaining
    .split(/\s+/)
    .filter(Boolean);

  for (const token of tokens) {
    // Field:value filter
    if (token.includes(':') && !token.startsWith('-')) {
      const colonIdx = token.indexOf(':');
      const field = token.slice(0, colonIdx).toLowerCase();
      const value = token.slice(colonIdx + 1);
      if (['level', 'source', 'service', 'traceid', 'trace', 'executionid', 'execution', 'workflowid', 'correlationid'].includes(field)) {
        fieldFilters.push({ field, value: value.toLowerCase() });
        continue;
      }
    }

    // Exclusion
    if (token.startsWith('-')) {
      excludeTerms.push(token.slice(1).toLowerCase());
      continue;
    }

    // OR grouping (term1|term2)
    if (token.includes('|')) {
      orTerms.push(token.split('|').map((t) => t.toLowerCase().trim()).filter(Boolean));
      continue;
    }

    plainTerms.push(token.toLowerCase());
  }

  return { exactPhrases, excludeTerms, orTerms, fieldFilters, plainTerms };
}

/**
 * Applies smart text-based search filtering to a list of log entries.
 */
function applyTextSearch(logs: LogEntry[], parsed: ParsedQuery, searchFields: string[]): LogEntry[] {
  return logs.filter((log) => {
    // Build searchable text from log entry
    const searchable = searchFields.map((field) => {
      const value = (log as any)[field];
      return value ? String(value).toLowerCase() : '';
    }).join(' ');

    // Field filters
    for (const ff of parsed.fieldFilters) {
      const logField = ff.field === 'trace' ? 'traceId'
        : ff.field === 'execution' ? 'executionId'
        : ff.field === 'traceid' ? 'traceId'
        : ff.field === 'executionid' ? 'executionId'
        : ff.field === 'workflowid' ? 'workflowId'
        : ff.field === 'correlationid' ? 'correlationId'
        : ff.field;
      const logValue = String((log as any)[logField] ?? '').toLowerCase();
      if (!logValue.includes(ff.value)) return false;
    }

    // Exact phrases must all match
    for (const phrase of parsed.exactPhrases) {
      if (!searchable.includes(phrase)) return false;
    }

    // Exclude terms
    for (const term of parsed.excludeTerms) {
      if (searchable.includes(term)) return false;
    }

    // OR groups - at least one term from each group must match
    for (const group of parsed.orTerms) {
      const matchesAny = group.some((term) => searchable.includes(term));
      if (!matchesAny) return false;
    }

    // Plain terms must all match
    for (const term of parsed.plainTerms) {
      if (!searchable.includes(term)) return false;
    }

    return true;
  });
}

/**
 * Applies regex-based search filtering.
 */
function applyRegexSearch(logs: LogEntry[], pattern: string, searchFields: string[]): LogEntry[] {
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, 'i');
  } catch {
    // Invalid regex - return no matches
    return [];
  }

  return logs.filter((log) => {
    const searchable = searchFields.map((field) => {
      const value = (log as any)[field];
      return value ? String(value) : '';
    }).join('\n');
    return regex.test(searchable);
  });
}

/**
 * Smart search hook that provides advanced filtering of log entries.
 * Supports text search with syntax or regex mode.
 */
export function useSmartSearch(logs: LogEntry[], options: SmartSearchOptions) {
  const searchFields = ['id', 'message', 'source', 'service', 'traceId', 'executionId', 'workflowId', 'correlationId'];

  const filteredLogs = useMemo(() => {
    if (!options.enabled || !options.query.trim()) return logs;

    if (options.mode === 'regex') {
      return applyRegexSearch(logs, options.query, searchFields);
    }

    const parsed = parseQuery(options.query);
    return applyTextSearch(logs, parsed, searchFields);
  }, [logs, options.query, options.mode, options.enabled]);

  return { filteredLogs };
}

/**
 * Extracts unique values for a given field across log entries.
 */
export function useLogFieldValues(logs: LogEntry[], field: keyof LogEntry): string[] {
  return useMemo(() => {
    const values = new Set<string>();
    for (const log of logs) {
      const val = log[field];
      if (val && typeof val === 'string') values.add(val);
    }
    return Array.from(values).sort();
  }, [logs, field]);
}

/**
 * Groups logs by a time bucket and returns counts for heatmap/visualization.
 */
export function useLogTimeDistribution(logs: LogEntry[], bucketSizeMs: number = 60000) {
  return useMemo(() => {
    if (logs.length === 0) return [];

    const buckets = new Map<number, number>();
    let minTime = Infinity;
    let maxTime = -Infinity;

    for (const log of logs) {
      const time = new Date(log.timestamp).getTime();
      const bucket = Math.floor(time / bucketSizeMs) * bucketSizeMs;
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
      if (time < minTime) minTime = time;
      if (time > maxTime) maxTime = time;
    }

    // Fill gaps with empty buckets
    const sortedBuckets: Array<{ time: number; count: number }> = [];
    const startBucket = Math.floor(minTime / bucketSizeMs) * bucketSizeMs;
    const endBucket = Math.floor(maxTime / bucketSizeMs) * bucketSizeMs;

    for (let t = startBucket; t <= endBucket; t += bucketSizeMs) {
      sortedBuckets.push({ time: t, count: buckets.get(t) ?? 0 });
    }

    return sortedBuckets;
  }, [logs, bucketSizeMs]);
}