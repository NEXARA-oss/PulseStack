import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson, postJson } from '../lib/api';

export type Role = 'owner' | 'admin' | 'editor' | 'viewer';
export type Permission = 'read' | 'write' | 'admin' | 'manage_members' | 'transfer_ownership';

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: Role;
  joinedAt: string;
  lastActiveAt: string;
};

export type Workspace = {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: TeamMember[];
  createdAt: string;
  updatedAt: string;
};

export type ActivityLog = {
  id: string;
  workspaceId: string;
  userId: string;
  action: string;
  timestamp: string;
  details: string;
};

export type OwnershipTransfer = {
  workspaceId: string;
  fromUserId: string;
  toUserId: string;
  timestamp: string;
  status: string;
};

const ROLE_COLORS: Record<Role, { bg: string; text: string; border: string }> = {
  owner: { bg: 'rgba(168,85,247,0.12)', text: '#a855f7', border: 'rgba(168,85,247,0.3)' },
  admin: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  editor: { bg: 'rgba(96,165,250,0.12)', text: '#60a5fa', border: 'rgba(96,165,250,0.3)' },
  viewer: { bg: 'rgba(148,163,184,0.12)', text: '#94a3b8', border: 'rgba(148,163,184,0.3)' },
};

const ACTION_LABELS: Record<string, string> = {
  'workspace.created': 'Created Workspace',
  'member.added': 'Added Member',
  'member.removed': 'Removed Member',
  'member.role_changed': 'Changed Role',
  'ownership.transferred': 'Transferred Ownership',
};

export function useWorkspaces() {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const workspacesQuery = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => fetchJson<Workspace[]>('/api/workspaces'),
    refetchInterval: 30000,
    retry: 2,
    retryDelay: 1000,
  });

  const activityQuery = useQuery({
    queryKey: ['workspace-activity', selectedWorkspaceId],
    queryFn: () => fetchJson<ActivityLog[]>(`/api/workspaces/${selectedWorkspaceId}/activity`),
    enabled: Boolean(selectedWorkspaceId),
    refetchInterval: 30000,
    retry: 2,
    retryDelay: 1000,
  });

  const createMutation = useMutation({
    mutationFn: (vars: { name: string; description: string; ownerId: string }) => postJson('/api/workspaces', vars),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
  });

  const addMemberMutation = useMutation({
    mutationFn: (vars: { workspaceId: string; member: any }) => postJson(`/api/workspaces/${vars.workspaceId}/members`, vars.member),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-activity'] });
    },
  });

  const transferMutation = useMutation({
    mutationFn: (vars: { workspaceId: string; fromUserId: string; toUserId: string }) =>
      postJson(`/api/workspaces/${vars.workspaceId}/transfer`, vars),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-activity'] });
    },
  });

  const selectedWorkspace = selectedWorkspaceId
    ? workspacesQuery.data?.find((w) => w.id === selectedWorkspaceId)
    : null;

  return {
    workspaces: workspacesQuery.data ?? [],
    selectedWorkspace,
    activity: activityQuery.data ?? [],
    selectedWorkspaceId,
    isLoading: workspacesQuery.isLoading,
    isError: workspacesQuery.isError,
    setSelectedWorkspaceId,
    createWorkspace: createMutation.mutate,
    addMember: addMemberMutation.mutate,
    transferOwnership: transferMutation.mutate,
    ROLE_COLORS,
    ACTION_LABELS,
  };
}
