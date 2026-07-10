/**
 * Maintenance Window Scheduler Engine
 *
 * Manages scheduled maintenance periods to suppress alert notifications
 * during planned infrastructure work.
 */

export type RecurrenceRule = 'none' | 'daily' | 'weekly' | 'monthly';

export type MaintenanceWindow = {
  id: string;
  name: string;
  description: string;
  service: string;
  startAt: string;
  endAt: string;
  recurrence: RecurrenceRule;
  alertPaused: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type MaintenanceHistory = {
  id: string;
  windowId: string;
  event: 'created' | 'activated' | 'completed' | 'cancelled';
  timestamp: string;
  message: string;
};

const DEFAULT_WINDOWS: MaintenanceWindow[] = [
  {
    id: 'maint-001',
    name: 'Database Maintenance',
    description: 'Index rebuild and vacuum on PostgreSQL cluster.',
    service: 'pulse-runtime',
    startAt: new Date(Date.now() + 86400000).toISOString(),
    endAt: new Date(Date.now() + 86400000 + 7200000).toISOString(),
    recurrence: 'weekly',
    alertPaused: true,
    createdBy: 'ops-team',
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'maint-002',
    name: 'Gateway Rolling Restart',
    description: 'Rolling restart for gateway nodes.',
    service: 'pulse-gateway',
    startAt: new Date(Date.now() - 86400000).toISOString(),
    endAt: new Date(Date.now() - 86400000 + 1800000).toISOString(),
    recurrence: 'none',
    alertPaused: true,
    createdBy: 'platform',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

const DEFAULT_HISTORY: MaintenanceHistory[] = [
  { id: 'hist-001', windowId: 'maint-001', event: 'created', timestamp: DEFAULT_WINDOWS[0].createdAt, message: 'Maintenance window created' },
  { id: 'hist-002', windowId: 'maint-001', event: 'activated', timestamp: new Date(Date.now() - 86400000 * 6).toISOString(), message: 'Alerts paused for window' },
  { id: 'hist-003', windowId: 'maint-001', event: 'completed', timestamp: new Date(Date.now() - 86400000 * 6 + 7200000).toISOString(), message: 'Maintenance completed' },
  { id: 'hist-004', windowId: 'maint-002', event: 'completed', timestamp: DEFAULT_WINDOWS[1].endAt, message: 'Rolling restart finished' },
];

export class MaintenanceSchedulerEngine {
  private windows: MaintenanceWindow[] = [...DEFAULT_WINDOWS];
  private history: MaintenanceHistory[] = [...DEFAULT_HISTORY];

  getWindows(service?: string, activeOnly = false): MaintenanceWindow[] {
    return this.windows.filter((w) => {
      if (service && w.service !== service) return false;
      if (activeOnly) {
        const now = Date.now();
        const start = new Date(w.startAt).getTime();
        const end = new Date(w.endAt).getTime();
        if (now < start || now > end) return false;
      }
      return true;
    });
  }

  getWindow(id: string): MaintenanceWindow | undefined {
    return this.windows.find((w) => w.id === id);
  }

  createWindow(window: Omit<MaintenanceWindow, 'id' | 'createdAt' | 'updatedAt'>): MaintenanceWindow {
    const newWindow: MaintenanceWindow = {
      ...window,
      id: `maint-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.windows.push(newWindow);
    this.recordHistory(newWindow.id, 'created', 'Maintenance window created');
    return newWindow;
  }

  updateWindow(id: string, updates: Partial<MaintenanceWindow>): MaintenanceWindow | null {
    const idx = this.windows.findIndex((w) => w.id === id);
    if (idx < 0) return null;
    this.windows[idx] = { ...this.windows[idx], ...updates, updatedAt: new Date().toISOString() };
    return this.windows[idx];
  }

  deleteWindow(id: string): boolean {
    const len = this.windows.length;
    this.windows = this.windows.filter((w) => w.id !== id);
    return this.windows.length < len;
  }

  getHistory(windowId?: string): MaintenanceHistory[] {
    const history = windowId
      ? this.history.filter((h) => h.windowId === windowId)
      : [...this.history];
    return history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  getCurrentIndicator(service: string): { inMaintenance: boolean; nextWindow?: MaintenanceWindow } {
    const now = Date.now();
    const current = this.windows.find((w) => {
      if (w.service !== service) return false;
      const start = new Date(w.startAt).getTime();
      const end = new Date(w.endAt).getTime();
      return now >= start && now <= end;
    });

    const upcoming = this.windows
      .filter((w) => {
        if (w.service !== service) return false;
        return new Date(w.startAt).getTime() > now;
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0];

    return {
      inMaintenance: Boolean(current),
      nextWindow: upcoming,
    };
  }

  getServices(): string[] {
    return [...new Set(this.windows.map((w) => w.service))];
  }

  private recordHistory(windowId: string, event: MaintenanceHistory['event'], message: string) {
    this.history.push({
      id: `hist-${Date.now()}`,
      windowId,
      event,
      timestamp: new Date().toISOString(),
      message,
    });
  }
}
