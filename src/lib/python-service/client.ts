/**
 * WellQC Python Microservice Client
 * ----------------------------------
 * Thin HTTP wrapper around the FastAPI service in `services/python_parser`.
 *
 * STATUS (as of 2026-09-29): built and available, but NOT yet called from
 * any screen or route. The imputation UI still uses the TypeScript engine
 * (`src/lib/las/imputation-engine.ts`). Wiring this in is a deliberate,
 * separate task — see the architecture doc's Verification Register and
 * "Key Engineering Decisions" for why (KNN results differ from the TS
 * port, and R² is not floored the same way in Python).
 *
 * Request/response shapes below are inferred from the service's endpoint
 * list and the architecture doc, NOT verified line-by-line against
 * `services/python_parser/models.py`. Before wiring this into a real
 * screen, diff these types against `models.py`'s Pydantic models and
 * correct any mismatch.
 */

const BASE_URL =
    process.env.PYTHON_SERVICE_URL?.replace(/\/+$/, "") || "http://localhost:8000";

class PythonServiceError extends Error {
    constructor(
        public status: number,
        public body: unknown,
        endpoint: string,
    ) {
        super(`Python service request to ${endpoint} failed with status ${status}`);
        this.name = "PythonServiceError";
    }
}

async function request<TResponse>(
    path: string,
    init?: RequestInit,
): Promise<TResponse> {
    const res = await fetch(`${BASE_URL}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
        },
    });

    if (!res.ok) {
        let body: unknown;
        try {
            body = await res.json();
        } catch {
            body = await res.text().catch(() => null);
        }
        throw new PythonServiceError(res.status, body, path);
    }

    return res.json() as Promise<TResponse>;
}

// ---- /health -----------------------------------------------------------

export interface HealthResponse {
    status: string;
}

export function checkHealth(): Promise<HealthResponse> {
    return request<HealthResponse>("/health");
}

// ---- /diagnose -----------------------------------------------------------
// TODO: verify shape against DiagnoseRequest in models.py before wiring.

export interface DiagnoseRequest {
    curves: unknown[];
    wellInfo?: unknown;
}

export interface DiagnoseResponse {
    diagnostics: unknown[];
}

export function diagnose(payload: DiagnoseRequest): Promise<DiagnoseResponse> {
    return request<DiagnoseResponse>("/diagnose", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

// ---- /impute ---------------------------------------------------------------
// TODO: verify shape against models.py. Strategy is expected to be one of
// KNN / Mean / Median / Linear / Spline, per the architecture doc.

export interface ImputeRequest {
    curve: number[];
    strategy: "KNN" | "Mean" | "Median" | "Linear" | "Spline";
    [key: string]: unknown;
}

export interface ImputeResponse {
    values: number[];
    [key: string]: unknown;
}

export function impute(payload: ImputeRequest): Promise<ImputeResponse> {
    return request<ImputeResponse>("/impute", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

// ---- /benchmark --------------------------------------------------------
// TODO: verify shape against BenchmarkRequest / the benchmark result model.
// NOTE: R² here is NOT floored at 0 (unlike the TS engine) — it can be
// negative. Do not display it interchangeably with the TS engine's R²
// without accounting for this.

export interface BenchmarkRequest {
    curve: number[];
    [key: string]: unknown;
}

export interface BenchmarkMetric {
    strategy: string;
    rSquared: number;
    [key: string]: unknown;
}

export interface BenchmarkResponse {
    metrics: BenchmarkMetric[];
    bestStrategy: string;
    recommendationReason: string;
}

export function benchmark(payload: BenchmarkRequest): Promise<BenchmarkResponse> {
    return request<BenchmarkResponse>("/benchmark", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

// ---- /drop-rows ----------------------------------------------------------
// TODO: verify shape against DropRowsRequest / DropRowsResponse in models.py.

export interface DropRowsRequest {
    curves: unknown[];
    [key: string]: unknown;
}

export interface DropRowsResponse {
    rowsDropped: number;
    [key: string]: unknown;
}

export function dropRows(payload: DropRowsRequest): Promise<DropRowsResponse> {
    return request<DropRowsResponse>("/drop-rows", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

// ---- /parse-las ----------------------------------------------------------
// Secondary/optional entry point per main.py's own docstring: lets the
// service parse a raw .las file directly (via lasio), for batch jobs or as
// an independent cross-check against the TS parser. NOT on the primary
// upload path — src/lib/las/parser.ts remains the source of truth there.

export interface ParseLasResponse {
    [key: string]: unknown;
}

export function parseLas(file: File | Blob): Promise<ParseLasResponse> {
    const form = new FormData();
    form.append("file", file);
    return request<ParseLasResponse>("/parse-las", {
        method: "POST",
        // Don't set Content-Type manually here — the browser needs to set the
        // multipart boundary itself.
        headers: {},
        body: form,
    });
}

export { PythonServiceError };