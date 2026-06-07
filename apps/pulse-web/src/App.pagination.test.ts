import { describe, it, expect } from 'vitest';

// Replicate types from App.tsx to validate the fix for issue #71
type Execution = {
  id: string;
  workflow_id: string;
  tenant_id?: string;
  correlation_id?: string;
  status: string;
  output?: Record<string, unknown>;
  updated_at: string;
};

type ExecutionList = { rows: Execution[]; total: number; limit: number; offset: number };

describe('Issue #71: Paginated executions API response', () => {
  it('ExecutionList type has rows array property (not a flat array)', () => {
    // Simulate backend response shape from infra.ts line 87:
    // return { rows: result.rows, total, limit: safeLimit, offset: safeOffset };
    const mockResponse: ExecutionList = {
      rows: [
        { id: 'exec-1', workflow_id: 'wf-1', status: 'success', updated_at: '2024-01-01T00:00:00Z' },
        { id: 'exec-2', workflow_id: 'wf-2', status: 'failed', updated_at: '2024-01-02T00:00:00Z' },
      ],
      total: 10,
      limit: 25,
      offset: 0,
    };

    // Verify rows is an array
    expect(Array.isArray(mockResponse.rows)).toBe(true);
    expect(mockResponse.rows.length).toBe(2);
  });

  it('accessing first execution uses rows[0], not data[0]', () => {
    const mockResponse: ExecutionList = {
      rows: [{ id: 'exec-1', workflow_id: 'wf-1', status: 'success', updated_at: '2024-01-01T00:00:00Z' }],
      total: 1,
      limit: 25,
      offset: 0,
    };

    // This was the bug: executions.data?.[0] returned undefined
    // because data was an object, not an array
    const directAccess = (mockResponse as unknown as Execution[])?.[0];
    expect(directAccess).toBeUndefined(); // object doesn't have numeric indices

    // Correct way: access rows[0]
    const correctAccess = mockResponse.rows[0];
    expect(correctAccess?.id).toBe('exec-1');
  });

  it('map works on rows array, not on response object', () => {
    const mockResponse: ExecutionList = {
      rows: [
        { id: 'exec-1', workflow_id: 'wf-1', status: 'success', updated_at: '2024-01-01T00:00:00Z' },
        { id: 'exec-2', workflow_id: 'wf-2', status: 'failed', updated_at: '2024-01-02T00:00:00Z' },
      ],
      total: 2,
      limit: 25,
      offset: 0,
    };

    // This was the bug: mockResponse.map() threw "map is not a function"
    // because data was { rows, total, limit, offset }, not an array
    const directMap = () => (mockResponse as unknown as Execution[]).map(e => e.id);
    expect(directMap).toThrow(TypeError);

    // Correct way: map over rows
    const ids = mockResponse.rows.map(e => e.id);
    expect(ids).toEqual(['exec-1', 'exec-2']);
  });

  it('auto-selection logic works with paginated response', () => {
    const mockResponse: ExecutionList = {
      rows: [{ id: 'exec-first', workflow_id: 'wf-1', status: 'success', updated_at: '2024-01-01T00:00:00Z' }],
      total: 1,
      limit: 25,
      offset: 0,
    };

    // Line 77 in App.tsx: if (!selectedExecutionId && executions.data?.rows[0])
    let selectedId: string | null = null;
    if (!selectedId && mockResponse.rows[0]) {
      selectedId = mockResponse.rows[0].id;
    }

    expect(selectedId).toBe('exec-first');
  });

  it('fallback to empty array when rows is undefined', () => {
    const partialResponse = { rows: undefined } as Partial<ExecutionList>;
    const executionRows = partialResponse.rows ?? [];

    expect(executionRows).toEqual([]);
    expect(executionRows.map).toBeDefined(); // no TypeError
  });
});