import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || "http://127.0.0.1:8000";
    const authHeader = req.headers.get("authorization");

    try {
      const response = await fetch(`${pythonBackendUrl}/api/leads`, {
        headers: {
          ...(authHeader ? { authorization: authHeader } : {}),
        },
        cache: "no-store",
      });

      const data = await response.json().catch(() => null);
      if (response.ok) {
        return NextResponse.json(data || { leads: [] });
      }

      return NextResponse.json(
        data || { detail: "Failed to fetch leads." },
        { status: response.status }
      );
    } catch {
      return NextResponse.json({ leads: [] });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ detail: errorMsg }, { status: 500 });
  }
}
