/**
 * Low-level fetch wrapper. It NEVER throws: network errors, timeouts, non-2xx responses and
 * invalid JSON all come back as `{ ok: false, error }`. Callers decide what an error means
 * (usually: show an empty/offline state, keep running).
 *
 * Do not call this from components — add a typed function to endpoints.ts instead.
 */
import { REQUEST_TIMEOUT_MS } from "@/lib/constants";

export type ApiResult<T> =
  | { ok: true; data: T; status: number; ms: number }
  | { ok: false; error: string; status: number | null; ms: number };

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
}

export function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/** FastAPI puts error text in `detail`; surface it when present. */
function errorDetail(data: unknown): string {
  if (data && typeof data === "object" && "detail" in data) {
    const d = (data as { detail: unknown }).detail;
    if (typeof d === "string") return `: ${d}`;
  }
  return "";
}

export async function request(baseUrl: string, path: string, opts: RequestOptions = {}): Promise<ApiResult<unknown>> {
  const { method = "GET", body, timeoutMs = REQUEST_TIMEOUT_MS } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = performance.now();
  const elapsed = () => Math.round(performance.now() - t0);

  try {
    const res = await fetch(joinUrl(baseUrl, path), {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text; // plain-text body; normalisers will reject it if they need JSON
      }
    }

    if (!res.ok) {
      return { ok: false, error: `${method} ${path} → HTTP ${res.status}${errorDetail(data)}`, status: res.status, ms: elapsed() };
    }
    return { ok: true, data, status: res.status, ms: elapsed() };
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    return {
      ok: false,
      error: aborted ? `${method} ${path} → timed out after ${timeoutMs}ms` : `${method} ${path} → backend unreachable`,
      status: null,
      ms: elapsed(),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Transform the data of a successful result; errors pass through untouched. */
export function mapResult<T, U>(result: ApiResult<T>, fn: (data: T) => U): ApiResult<U> {
  return result.ok ? { ...result, data: fn(result.data) } : result;
}
