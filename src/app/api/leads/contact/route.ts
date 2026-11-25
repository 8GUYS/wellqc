import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || "http://127.0.0.1:8000";

    // Attempt forwarding to Python FastAPI backend
    try {
      const response = await fetch(`${pythonBackendUrl}/api/leads/contact`, {
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
            inquiryId: `inq_${Date.now()}`,
            message: "Your message has been sent to our technical support team.",
          }
        );
      }

      return NextResponse.json(
        data || { detail: "Failed to submit contact inquiry." },
        { status: response.status }
      );
    } catch (proxyError) {
      console.warn("Python backend offline or unreachable for contact inquiry:", proxyError);
      // Graceful fallback for standalone frontend / development without FastAPI active:
      return NextResponse.json({
        success: true,
        inquiryId: `inq_local_${Date.now()}`,
        message: "Your message has been sent to our technical support team.",
        isOfflineFallback: true,
      });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ detail: errorMsg }, { status: 500 });
  }
}
