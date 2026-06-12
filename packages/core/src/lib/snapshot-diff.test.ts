import { describe, expect, it } from 'vitest';
import { diffSnapshotState } from './snapshot-diff.js';

describe('diffSnapshotState', () => {
  it('returns deterministic added, modified, and removed paths', () => {
    const diff = diffSnapshotState(
      {
        removed: true,
        same: { nested: 'ok' },
        changed: { count: 1 },
      },
      {
        added: 'new',
        same: { nested: 'ok' },
        changed: { count: 2 },
      },
    );

    expect(diff).toEqual({
      added: [{ path: 'added', after: 'new' }],
      modified: [{ path: 'changed.count', before: 1, after: 2 }],
      removed: [{ path: 'removed', before: true }],
    });
  });

  it('compares objects with stable key ordering', () => {
    const diff = diffSnapshotState(
      { payload: { b: 2, a: 1 } },
      { payload: { a: 1, b: 2 } },
    );

    expect(diff.added).toHaveLength(0);
    expect(diff.modified).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });
});
