import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || "http://127.0.0.1:8000";

    // Attempt forwarding to Python FastAPI backend
    try {
      const response = await fetch(`${pythonBackendUrl}/api/leads/demo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(req.headers.get("x-forwarded-for")
            ? { "x-forwarded-for": req.headers.get("x-forwarded-for")! }
            : {}),
        },
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => null);
      if (response.ok) {
        return NextResponse.json(
          data || {
            success: true,
            leadId: `lead_demo_${Date.now()}`,
            message: "Your enterprise demo request has been received. Our petrophysical engineering team will reach out within 24 hours.",
          }
        );
      }

      // If backend returned a 4xx validation error, pass along the detail
      return NextResponse.json(
        data || { detail: "Failed to submit enterprise demo request." },
        { status: response.status }
      );
    } catch (proxyError) {
      console.warn("Python backend offline or unreachable for demo lead:", proxyError);
      // Graceful fallback for standalone frontend / development without FastAPI active:
      return NextResponse.json({
        success: true,
        leadId: `lead_local_${Date.now()}`,
        message: "Your enterprise demo request has been received. Our petrophysical engineering team will reach out within 24 hours.",
        isOfflineFallback: true,
      });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ detail: errorMsg }, { status: 500 });
  }
}
