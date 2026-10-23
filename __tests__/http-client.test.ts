import { safeReadJson } from "@/lib/http-client";

describe("HTTP Client Resilience (safeReadJson)", () => {
  it("parses valid JSON response successfully", async () => {
    const mockResponse = new Response(JSON.stringify({ status: "ok", count: 42 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    const result = await safeReadJson<{ status: string; count: number }>(mockResponse);
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ status: "ok", count: 42 });
    expect(result.error).toBeUndefined();
  });

  it("handles empty response body without crashing", async () => {
    const mockResponse = new Response(null, { status: 204 });

    const result = await safeReadJson(mockResponse);
    expect(result.ok).toBe(true);
    expect(result.status).toBe(204);
    expect(result.data).toBeNull();
    expect(result.error).toBeUndefined();
  });

  it("extracts structured error message from FastAPI detail key", async () => {
    const mockResponse = new Response(
      JSON.stringify({ detail: "Your email address has not been verified yet." }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );

    const result = await safeReadJson(mockResponse);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe("Your email address has not been verified yet.");
  });

  it("handles non-JSON HTML error pages (e.g., 502/504 proxy errors) gracefully", async () => {
    const htmlPayload = "<html><body><h1>502 Bad Gateway</h1><p>Nginx proxy failed</p></body></html>";
    const mockResponse = new Response(htmlPayload, {
      status: 502,
      statusText: "Bad Gateway",
      headers: { "Content-Type": "text/html" },
    });

    const result = await safeReadJson(mockResponse);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(502);
    expect(result.data).toBeNull();
    expect(result.error).toContain("Server returned HTTP 502");
    expect(result.error).toContain("502 Bad Gateway");
  });

  it("handles response.text() rejection gracefully", async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: "Internal Error",
      text: jest.fn().mockRejectedValue(new Error("Socket connection dropped")),
    } as unknown as Response;

    const result = await safeReadJson(mockResponse);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toBe("Socket connection dropped");
  });

  it("appends fallbackMessage when receiving plain-text Internal Server Error (e.g. backend down proxy error)", async () => {
    const mockResponse = new Response("Internal Server Error", {
      status: 500,
      statusText: "Internal Server Error",
      headers: { "Content-Type": "text/plain" },
    });

    const result = await safeReadJson(
      mockResponse,
      "Unable to communicate with the authentication server. Please ensure the backend is running."
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toBe(
      "Server returned HTTP 500: Internal Server Error. Unable to communicate with the authentication server. Please ensure the backend is running."
    );
  });
});
