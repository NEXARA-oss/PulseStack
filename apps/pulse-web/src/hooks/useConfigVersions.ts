import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson, postJson } from '../lib/api';

export type ConfigVersion = {
  id: string;
  version: number;
  name: string;
  description: string;
  author: string;
  config: Record<string, unknown>;
  createdAt: string;
  tags?: string[];
};

export type VersionDiff = {
  a: ConfigVersion;
  b: ConfigVersion;
  added: string[];
  removed: string[];
  modified: Array<{ key: string; oldValue: unknown; newValue: unknown }>;
};

export type RestoreResult = {
  success: boolean;
  restoredVersion: ConfigVersion;
  message: string;
};

export function useConfigVersions() {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [compareWithId, setCompareWithId] = useState('');
  const queryClient = useQueryClient();

  const versionsQuery = useQuery({
    queryKey: ['config-versions'],
    queryFn: () => fetchJson<ConfigVersion[]>('/api/config/versions'),
    retry: 2,
    retryDelay: 1000,
  });

  const diffQuery = useQuery({
    queryKey: ['config-diff', selectedVersionId, compareWithId],
    queryFn: () => fetchJson<VersionDiff>(`/api/config/versions/${selectedVersionId}/diff?other=${compareWithId}`),
    enabled: Boolean(selectedVersionId && compareWithId),
    retry: 2,
    retryDelay: 1000,
  });

  const historyQuery = useQuery({
    queryKey: ['config-history'],
    queryFn: () => fetchJson<any[]>('/api/config/history'),
    retry: 2,
    retryDelay: 1000,
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => postJson(`/api/config/versions/${id}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-versions'] });
      queryClient.invalidateQueries({ queryKey: ['config-diff'] });
    },
  });

  const versions = versionsQuery.data ?? [];
  const selectedVersion = selectedVersionId ? versions.find((v) => v.id === selectedVersionId) : null;
  const compareVersion = compareWithId ? versions.find((v) => v.id === compareWithId) : null;

  return {
    versions,
    selectedVersion,
    compareVersion,
    diff: diffQuery.data,
    history: historyQuery.data ?? [],
    selectedVersionId,
    compareWithId,
    isLoading: versionsQuery.isLoading,
    isError: versionsQuery.isError,
    setSelectedVersionId,
    setCompareWithId,
    restoreVersion: restoreMutation.mutate,
  };
}
