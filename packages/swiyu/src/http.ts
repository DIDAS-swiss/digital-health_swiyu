/** Minimal JSON-over-HTTP helper shared by the management API clients. */

export class SwiyuApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly method: string,
    readonly url: string,
    readonly body: string,
  ) {
    super(message);
    this.name = 'SwiyuApiError';
  }
}

export interface HttpOptions {
  /** Base URL of the management API, e.g. `http://localhost:8080`. */
  baseUrl: string;
  /**
   * Extra headers. The management APIs of the generic components are *not*
   * authenticated themselves — they are expected to sit behind the operator's
   * own access control, so this is where that goes (mTLS aside).
   */
  headers?: Record<string, string>;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly doFetch: typeof globalThis.fetch;

  constructor(options: HttpOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.headers = options.headers ?? {};
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.doFetch = options.fetch ?? globalThis.fetch;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.doFetch(url, {
        method,
        headers: {
          accept: 'application/json',
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...this.headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
    } catch (cause) {
      throw new SwiyuApiError(
        `${method} ${url} failed: ${(cause as Error).message}`,
        0,
        method,
        url,
        '',
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    if (!response.ok) {
      throw new SwiyuApiError(
        `${method} ${url} returned ${response.status}: ${text.slice(0, 500)}`,
        response.status,
        method,
        url,
        text,
      );
    }
    if (text.length === 0) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      // A few management endpoints answer `*/*` with a bare string.
      return text as unknown as T;
    }
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }
  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }
  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }
}
