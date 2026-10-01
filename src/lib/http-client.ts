/**
 * Safe HTTP and JSON client utilities.
 * Prevents "Unexpected token 'I', 'Internal S'... is not valid JSON" crashes
 * by safely reading responses and handling non-JSON error payloads gracefully.
 */

export interface SafeJsonResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function safeReadJson<T = any>(
  response: Response,
  fallbackMessage = "Unexpected server response"
): Promise<SafeJsonResult<T>> {
  const status = response.status;
  try {
    const text = await response.text();
    if (!text || !text.trim()) {
      return {
        ok: response.ok,
        status,
        data: null,
        error: response.ok ? undefined : `HTTP ${status}: ${response.statusText || fallbackMessage}`,
      };
    }

    try {
      const data = JSON.parse(text) as T;
      const body = data as { error?: unknown; detail?: unknown; message?: unknown } | null;
      const errorMsg = body?.error || body?.detail || body?.message;

      return {
        ok: response.ok && !body?.error,
        status,
        data,
        error: !response.ok
          ? (typeof errorMsg === "string" ? errorMsg : `HTTP ${status}: ${response.statusText || fallbackMessage}`)
          : undefined,
      };
    } catch {
      // Body is not valid JSON (e.g. plain text "Internal Server Error" or proxy HTML)
      const cleanSnippet = text.slice(0, 100).trim();
      return {
        ok: false,
        status,
        data: null,
        error: `Server returned HTTP ${status}: ${cleanSnippet || response.statusText || fallbackMessage}`,
      };
    }
  } catch (readErr) {
    return {
      ok: false,
      status,
      data: null,
      error: readErr instanceof Error ? readErr.message : `HTTP ${status}: ${fallbackMessage}`,
    };
  }
}
