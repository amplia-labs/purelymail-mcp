const DEFAULT_BASE_URL = "https://purelymail.com";
const DEFAULT_TIMEOUT_MS = 30_000;

/** An error reported by the Purelymail API itself, e.g. `invalidToken`. */
export class PurelymailApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PurelymailApiError";
    this.code = code;
  }
}

export interface PurelymailClientOptions {
  token: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export class PurelymailClient {
  readonly #token: string;
  readonly #baseUrl: string;
  readonly #timeoutMs: number;

  constructor(options: PurelymailClientOptions) {
    this.#token = options.token;
    this.#baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** POSTs to an API path and returns the unwrapped `result` payload. */
  async call(path: string, body: object): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(new URL(path, this.#baseUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Purelymail-Api-Token": this.#token,
        },
        body: JSON.stringify(body),
        // Never replay the token (or a write) against another location.
        redirect: "error",
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error(
          `Request to ${path} timed out after ${this.#timeoutMs}ms. ` +
            "A write may or may not have been applied; check before retrying.",
          { cause: error },
        );
      }
      throw new Error(`Request to ${path} failed: ${String(error)}`, {
        cause: error,
      });
    }

    const text = await response.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(
        `Non-JSON response from ${path} (HTTP ${response.status}): ${text.slice(0, 200)}`,
      );
    }

    // The API reports failures as HTTP 200 with `type: "error"` in the body,
    // so the status code alone says nothing about success.
    if (isRecord(payload)) {
      if (payload.type === "error") {
        throw new PurelymailApiError(
          typeof payload.code === "string" ? payload.code : "unknown",
          typeof payload.message === "string" ? payload.message : "Unknown error",
        );
      }
      if (response.ok && "result" in payload) {
        return payload.result;
      }
    }
    throw new Error(
      `Unexpected response from ${path} (HTTP ${response.status}): ${text.slice(0, 200)}`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
