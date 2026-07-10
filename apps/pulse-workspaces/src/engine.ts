/**
 * Team Workspace & Role Management Engine
 *
 * Supports organizing users into collaborative workspaces with
 * configurable roles, permissions, and activity logging.
 */

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
  status: 'pending' | 'completed' | 'cancelled';
};

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ['read', 'write', 'admin', 'manage_members', 'transfer_ownership'],
  admin: ['read', 'write', 'admin', 'manage_members'],
  editor: ['read', 'write'],
  viewer: ['read'],
};

const DEFAULT_WORKSPACES: Workspace[] = [
  {
    id: 'ws-001',
    name: 'Platform Engineering',
    description: 'Monitoring for platform services.',
    ownerId: 'user-alice',
    members: [
      { id: 'user-alice', name: 'Alice', email: 'alice@company.com', role: 'owner', joinedAt: new Date(Date.now() - 86400000 * 60).toISOString(), lastActiveAt: new Date(Date.now() - 3600000).toISOString() },
      { id: 'user-bob', name: 'Bob', email: 'bob@company.com', role: 'admin', joinedAt: new Date(Date.now() - 86400000 * 30).toISOString(), lastActiveAt: new Date(Date.now() - 7200000).toISOString() },
      { id: 'user-charlie', name: 'Charlie', email: 'charlie@company.com', role: 'editor', joinedAt: new Date(Date.now() - 86400000 * 15).toISOString(), lastActiveAt: new Date(Date.now() - 86400000).toISOString() },
    ],
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'ws-002',
    name: 'Security Operations',
    description: 'Security event monitoring and incident response.',
    ownerId: 'user-diana',
    members: [
      { id: 'user-diana', name: 'Diana', email: 'diana@company.com', role: 'owner', joinedAt: new Date(Date.now() - 86400000 * 45).toISOString(), lastActiveAt: new Date(Date.now() - 1800000).toISOString() },
      { id: 'user-eve', name: 'Eve', email: 'eve@company.com', role: 'editor', joinedAt: new Date(Date.now() - 86400000 * 20).toISOString(), lastActiveAt: new Date(Date.now() - 5400000).toISOString() },
    ],
    createdAt: new Date(Date.now() - 86400000 * 45).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
];

const DEFAULT_HISTORY: ActivityLog[] = [
  { id: 'act-001', workspaceId: 'ws-001', userId: 'user-alice', action: 'workspace.created', timestamp: DEFAULT_WORKSPACES[0].createdAt, details: 'Created workspace Platform Engineering' },
  { id: 'act-002', workspaceId: 'ws-001', userId: 'user-alice', action: 'member.added', timestamp: new Date(Date.now() - 86400000 * 29).toISOString(), details: 'Added Bob as admin' },
  { id: 'act-003', workspaceId: 'ws-001', userId: 'user-alice', action: 'member.role_changed', timestamp: new Date(Date.now() - 86400000 * 10).toISOString(), details: 'Changed Charlie role to editor' },
];

export class WorkspaceEngine {
  private workspaces: Workspace[] = [...DEFAULT_WORKSPACES];
  private history: ActivityLog[] = [...DEFAULT_HISTORY];
  private transfers: OwnershipTransfer[] = [];

  getWorkspaces(): Workspace[] {
    return [...this.workspaces];
  }

  getWorkspace(id: string): Workspace | undefined {
    return this.workspaces.find((w) => w.id === id);
  }

  createWorkspace(name: string, description: string, ownerId: string): Workspace {
    const workspace: Workspace = {
      id: `ws-${Date.now()}`,
      name,
      description,
      ownerId,
      members: [{ id: ownerId, name: ownerId, email: `${ownerId}@company.com`, role: 'owner', joinedAt: new Date().toISOString(), lastActiveAt: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.workspaces.push(workspace);
    this.recordHistory(workspace.id, ownerId, 'workspace.created', `Created workspace ${name}`);
    return workspace;
  }

  addMember(workspaceId: string, member: Omit<TeamMember, 'joinedAt' | 'lastActiveAt'>): TeamMember | null {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) return null;
    const newMember: TeamMember = {
      ...member,
      joinedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
    workspace.members.push(newMember);
    workspace.updatedAt = new Date().toISOString();
    this.recordHistory(workspaceId, member.id, 'member.added', `Added ${member.name} as ${member.role}`);
    return newMember;
  }

  updateMemberRole(workspaceId: string, userId: string, role: Role): TeamMember | null {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) return null;
    const member = workspace.members.find((m) => m.id === userId);
    if (!member) return null;
    member.role = role;
    workspace.updatedAt = new Date().toISOString();
    this.recordHistory(workspaceId, userId, 'member.role_changed', `Changed role to ${role}`);
    return member;
  }

  removeMember(workspaceId: string, userId: string): boolean {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) return false;
    const idx = workspace.members.findIndex((m) => m.id === userId);
    if (idx < 0) return false;
    const member = workspace.members[idx];
    workspace.members.splice(idx, 1);
    workspace.updatedAt = new Date().toISOString();
    this.recordHistory(workspaceId, userId, 'member.removed', `Removed ${member.name}`);
    return true;
  }

  transferOwnership(workspaceId: string, fromUserId: string, toUserId: string): OwnershipTransfer | null {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace || workspace.ownerId !== fromUserId) return null;
    workspace.ownerId = toUserId;
    this.updateMemberRole(workspaceId, fromUserId, 'admin');
    this.updateMemberRole(workspaceId, toUserId, 'owner');
    const transfer: OwnershipTransfer = {
      workspaceId,
      fromUserId,
      toUserId,
      timestamp: new Date().toISOString(),
      status: 'completed',
    };
    this.transfers.push(transfer);
    this.recordHistory(workspaceId, toUserId, 'ownership.transferred', `Transferred ownership from ${fromUserId} to ${toUserId}`);
    return transfer;
  }

  getHistory(workspaceId?: string): ActivityLog[] {
    const history = workspaceId
      ? this.history.filter((h) => h.workspaceId === workspaceId)
      : [...this.history];
    return history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  getPermissions(role: Role): Permission[] {
    return [...(ROLE_PERMISSIONS[role] ?? [])];
  }

  private recordHistory(workspaceId: string, userId: string, action: string, details: string) {
    this.history.push({
      id: `act-${Date.now()}`,
      workspaceId,
      userId,
      action,
      timestamp: new Date().toISOString(),
      details,
    });
  }
}
