import { authHeaders } from './session';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    ...authHeaders(),
    ...(init.body ? { 'content-type': 'application/json' } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'No connection');
  }
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, json.error ?? `Request failed (${res.status})`);
  return json as T;
}

export const apiGet = <T>(path: string) => api<T>(path);
export const apiPost = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
export const apiPatch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const apiDelete = (path: string) => api<void>(path, { method: 'DELETE' });
