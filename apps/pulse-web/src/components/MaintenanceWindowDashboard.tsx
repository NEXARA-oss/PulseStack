import { useState } from 'react';
import { useMaintenanceScheduler } from '../hooks/useMaintenanceScheduler';

export function MaintenanceWindowDashboard() {
  const {
    windows,
    history,
    indicators,
    services,
    serviceFilter,
    isLoading,
    isError,
    setServiceFilter,
    createWindow,
    deleteWindow,
    RECURRENCE_LABELS,
  } = useMaintenanceScheduler();

  const [newName, setNewName] = useState('');
  const [newService, setNewService] = useState('pulse-runtime');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');

  if (isError) {
    return (
      <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-6 text-center text-rose-200">
        Failed to load maintenance windows.
      </div>
    );
  }

  const inMaintenanceServices = indicators.filter((i) => i.inMaintenance).map((i) => i.inMaintenance ? 'Unknown' : 'Unknown');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          Maintenance Windows
        </h3>
        <span className="bg-cyan/15 text-cyan border border-cyan/30 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
          Alert Suppression
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white focus:border-cyan focus:outline-none"
        >
          <option value="all">All Services</option>
          {services.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {indicators.some((i) => i.inMaintenance) && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">
          Some services are currently under maintenance. Alerts are suppressed for these services.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-sm text-white/40">Loading windows...</div>
          ) : (
            windows.map((w) => (
              <div key={w.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">{w.name}</div>
                    <div className="text-xs text-white/50">{w.service}</div>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded border border-amber-400/30 bg-amber-400/10 text-amber-300">
                    {w.alertPaused ? 'Alerts Paused' : 'Alerts Active'}
                  </span>
                </div>
                <div className="mt-1 text-xs text-white/50">{w.description}</div>
                <div className="mt-2 flex items-center justify-between text-xs text-white/40">
                  <span>{new Date(w.startAt).toLocaleString()}</span>
                  <span>→</span>
                  <span>{new Date(w.endAt).toLocaleString()}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-white/40">
                  <span>{RECURRENCE_LABELS[w.recurrence]}</span>
                  <button
                    onClick={() => deleteWindow(w.id)}
                    className="rounded border border-rose-400/30 px-2 py-1 text-[10px] text-rose-300 hover:bg-rose-500/10 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <h4 className="text-sm font-semibold text-white mb-3">Create Maintenance Window</h4>
            <div className="grid gap-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Window name"
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-cyan focus:outline-none"
              />
              <select
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white focus:border-cyan focus:outline-none"
              >
                {services.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="datetime-local"
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                  className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white focus:border-cyan focus:outline-none"
                />
                <input
                  type="datetime-local"
                  value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)}
                  className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white focus:border-cyan focus:outline-none"
                />
              </div>
              <button
                onClick={() => {
                  if (!newName || !newStart || !newEnd) return;
                  createWindow({
                    name: newName,
                    description: 'Scheduled maintenance',
                    service: newService,
                    startAt: new Date(newStart).toISOString(),
                    endAt: new Date(newEnd).toISOString(),
                    recurrence: 'none',
                    alertPaused: true,
                    createdBy: 'current-user',
                  });
                  setNewName('');
                  setNewStart('');
                  setNewEnd('');
                }}
                className="rounded-lg border border-cyan/30 bg-cyan/10 px-3 py-1.5 text-xs font-semibold text-cyan hover:bg-cyan/20 transition"
              >
                Schedule Maintenance
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <h4 className="text-sm font-semibold text-white mb-3">Maintenance History</h4>
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs">
                  <span className="text-white/70">{h.message}</span>
                  <span className="text-white/40 font-mono">{new Date(h.timestamp).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
