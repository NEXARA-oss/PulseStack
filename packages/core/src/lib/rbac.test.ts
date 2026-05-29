import { describe, expect, it } from 'vitest';
import { can } from './rbac.js';

describe('rbac', () => {
  it('allows admins to use every protected capability', () => {
    expect(can({ role: 'admin' }, 'execution:write')).toBe(true);
    expect(can({ role: 'admin' }, 'replay:write')).toBe(true);
  });

  it('keeps viewers read-only', () => {
    expect(can({ role: 'viewer' }, 'metric:read')).toBe(true);
    expect(can({ role: 'viewer' }, 'execution:write')).toBe(false);
  });

  it('rejects denied or missing principals', () => {
    expect(can({ role: 'admin', denied: true }, 'metric:read')).toBe(false);
    expect(can(null, 'metric:read')).toBe(false);
  });
});
