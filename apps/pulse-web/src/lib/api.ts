const API_BASE = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:4000';
const TENANT_ID = import.meta.env.VITE_TENANT_ID;

export async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: tenantHeaders(),
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

export async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...tenantHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

function tenantHeaders(): Record<string, string> {
  return typeof TENANT_ID === 'string' && TENANT_ID.trim()
    ? { 'x-tenant-id': TENANT_ID.trim() }
    : {};
}
