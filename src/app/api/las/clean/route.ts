import { NextResponse } from "next/server";
import { parseLASContent } from "@/lib/las/parser";
import { analyzeWellLogQuality } from "@/lib/las/quality-engine";
import { cleanLASLogData, CleaningOptions } from "@/lib/las/cleaner";
import { getCurrentUser } from "@/lib/auth";

interface CleanRequest {
  content?: string;
  options?: CleaningOptions;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    const body = (await request.json()) as CleanRequest;
    const content = body.content?.trim();

    if (!content) {
      return NextResponse.json({ error: "LAS file content is required for cleaning." }, { status: 400 });
    }

    const parsed = parseLASContent(content);
    const initialQa = analyzeWellLogQuality(parsed);
    const result = cleanLASLogData(parsed, initialQa, body.options || {});

    return NextResponse.json({
      success: true,
      cleanedLas: result.cleanedLas,
      cleanedQa: result.cleanedQa,
      verificationReport: result.verificationReport,
      cleanedLasText: result.cleanedLasText,
      cleanedCsvText: result.cleanedCsvText,
    });
  } catch (error) {
    console.error("Data Cleaning API Failure:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to clean LAS log data." },
      { status: 500 },
    );
  }
}
