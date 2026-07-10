import { useState } from 'react';
import { useWorkspaces } from '../hooks/useWorkspaces';

export function WorkspacesDashboard() {
  const {
    workspaces,
    selectedWorkspace,
    activity,
    selectedWorkspaceId,
    isLoading,
    isError,
    setSelectedWorkspaceId,
    createWorkspace,
    addMember,
    transferOwnership,
    ROLE_COLORS,
    ACTION_LABELS,
  } = useWorkspaces();

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<Role>('viewer');

  if (isError) {
    return (
      <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-6 text-center text-rose-200">
        Failed to load workspaces.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          Team Workspaces
        </h3>
        <span className="bg-cyan/15 text-cyan border border-cyan/30 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
          Role Management
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-sm text-white/40">Loading workspaces...</div>
          ) : (
            workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => setSelectedWorkspaceId(ws.id)}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  selectedWorkspaceId === ws.id ? 'border-cyan bg-cyan/10' : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <div className="font-semibold text-white">{ws.name}</div>
                <div className="text-xs text-white/50">{ws.description}</div>
                <div className="mt-1 text-xs text-white/40">{ws.members.length} members · Owner: {ws.ownerId}</div>
              </button>
            ))
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          {selectedWorkspace ? (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-white">{selectedWorkspace.name}</h4>
                <p className="text-xs text-white/50">{selectedWorkspace.description}</p>
              </div>

              <div>
                <h5 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">Members</h5>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {selectedWorkspace.members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                      <div>
                        <div className="text-white/70">{m.name}</div>
                        <div className="text-xs text-white/40">{m.email}</div>
                      </div>
                      <span
                        className="text-[10px] uppercase font-mono px-2 py-0.5 rounded border"
                        style={{ background: ROLE_COLORS[m.role].bg, color: ROLE_COLORS[m.role].text, borderColor: ROLE_COLORS[m.role].border }}
                      >
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="member@email.com"
                  className="col-span-2 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-cyan focus:outline-none"
                />
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as Role)}
                  className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white focus:border-cyan focus:outline-none"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                onClick={() => {
                  if (!memberEmail) return;
                  addMember({ workspaceId: selectedWorkspace.id, member: { id: memberEmail, name: memberEmail.split('@')[0], email: memberEmail, role: memberRole } });
                  setMemberEmail('');
                }}
                className="w-full rounded-lg border border-cyan/30 bg-cyan/10 px-3 py-1.5 text-xs font-semibold text-cyan hover:bg-cyan/20 transition"
              >
                Invite Member
              </button>

              <button
                onClick={() => {
                  if (!selectedWorkspace || selectedWorkspace.members.length < 2) return;
                  const newOwner = selectedWorkspace.members.find((m) => m.id !== selectedWorkspace.ownerId);
                  if (!newOwner) return;
                  transferOwnership({ workspaceId: selectedWorkspace.id, fromUserId: selectedWorkspace.ownerId, toUserId: newOwner.id });
                }}
                className="w-full rounded-lg border border-purple-400/30 bg-purple-400/10 px-3 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-400/20 transition"
              >
                Transfer Ownership
              </button>
            </div>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-white/40 text-sm">
              Select a workspace to manage members.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">Activity Log</div>
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {activity
            .filter((a) => !selectedWorkspaceId || a.workspaceId === selectedWorkspaceId)
            .slice(0, 20)
            .map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs">
                <div>
                  <span className="text-white/70">{ACTION_LABELS[a.action] ?? a.action}</span>
                  <span className="text-white/40"> · {a.details}</span>
                </div>
                <span className="text-white/30 font-mono whitespace-nowrap">{new Date(a.timestamp).toLocaleString()}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
