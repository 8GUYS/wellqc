import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseLASContent, ParsedLAS } from "@/lib/las/parser";
import { analyzeWellLogQuality } from "@/lib/las/quality-engine";
import { cleanLASLogData, CleaningOptions } from "@/lib/las/cleaner";

export interface ApprovedFixPayload {
  anomalyId: string;
  anomalyType: string;
  curveMnemonic: string;
  depthStart: number;
  depthEnd: number;
  optionId: string;
  optionLabel: string;
  description?: string;
}

interface ApplyFixesRequest {
  wellId: string;
  approvedFixes: ApprovedFixPayload[];
  rawLasContent?: string;
  rawLas?: ParsedLAS;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    const body = (await request.json()) as ApplyFixesRequest;
    const { wellId, approvedFixes = [], rawLasContent, rawLas } = body;

    if (!wellId) {
      return NextResponse.json({ error: "Target wellId is required." }, { status: 400 });
    }

    if (approvedFixes.length === 0) {
      return NextResponse.json({ error: "No approved fixes were provided." }, { status: 400 });
    }

    // Determine target LAS data
    let targetLas: ParsedLAS | null = null;

    if (rawLas && rawLas.curves && rawLas.data) {
      targetLas = rawLas;
    } else if (rawLasContent && rawLasContent.trim().length > 0) {
      targetLas = parseLASContent(rawLasContent);
    } else if (wellId !== "upload-session" && wellId !== "benchmark-01") {
      // Try to load from database
      const dbWell = await db.well.findUnique({
        where: { id: wellId },
        include: {
          lasFiles: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { curves: true },
          },
        },
      });

      if (dbWell && dbWell.lasFiles[0]?.rawHeader) {
        // If rawHeader or curves are stored
        try {
          targetLas = parseLASContent(dbWell.lasFiles[0].rawHeader);
        } catch {
          // Fallback if rawHeader was truncated
        }
      }
    }

    // Derive cleaning options based on which anomaly types were approved
    const approvedTypes = new Set(approvedFixes.map((f) => f.anomalyType.toUpperCase()));
    const options: CleaningOptions = {
      duplicateDepthPruning: approvedTypes.has("DUPLICATE_DEPTH"),
      depthGapInterpolation: approvedTypes.has("DEPTH_GAP"),
      despiking: approvedTypes.has("EXTREME_SPIKE"),
      outlierClipping: approvedTypes.has("OUTLIER_VALUE") || approvedTypes.has("IMPOSSIBLE_VALUE"),
      flatlineHandling: approvedTypes.has("FLATLINE"),
      unitStandardization: approvedTypes.has("UNIT_MISMATCH") || approvedTypes.has("NON_STANDARD_MNEMONIC"),
      imputationStrategy: approvedTypes.has("NULL_CLUSTER") ? "KNN" : "NONE",
    };

    // If specific imputation strategy is chosen in any approved fix
    approvedFixes.forEach((fix) => {
      if (fix.optionId === "LINEAR_INTERPOLATION" || fix.optionId === "LINEAR_IMPUTATION") {
        options.imputationStrategy = "LINEAR";
      } else if (fix.optionId === "MEDIAN_IMPUTATION" || fix.optionId === "MEDIAN_FILL") {
        options.imputationStrategy = "MEDIAN";
      } else if (fix.optionId === "KNN_IMPUTATION") {
        options.imputationStrategy = "KNN";
      }
    });

    // Generate individual audit log entries for each approved fix
    const timestamp = new Date().toISOString();
    const auditEntries = approvedFixes.map((fix) => ({
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp,
      wellId,
      anomalyId: fix.anomalyId,
      anomalyType: fix.anomalyType,
      curveMnemonic: fix.curveMnemonic,
      depthRange: `${fix.depthStart.toFixed(1)} - ${fix.depthEnd.toFixed(1)}`,
      optionId: fix.optionId,
      optionLabel: fix.optionLabel,
      action: "APPLY_APPROVED_FIX",
      approvedBy: user.name,
      userRole: user.role || "PETROPHYSICIST",
      status: "APPLIED",
      summary: `Approved and applied fix '${fix.optionLabel}' (${fix.optionId}) for ${fix.anomalyType} on ${fix.curveMnemonic} at depth ${fix.depthStart.toFixed(1)} - ${fix.depthEnd.toFixed(1)}`,
    }));

    // Record to database ActivityLog in the background (individual entries for transparency)
    try {
      await Promise.all(
        auditEntries.map((entry) =>
          db.activityLog.create({
            data: {
              userId: user.id,
              userName: user.name,
              userRole: user.role || "PETROPHYSICIST",
              action: "APPLY_ANOMALY_FIX",
              targetType: "ANOMALY",
              targetId: entry.anomalyId,
              details: entry.summary,
            },
          }),
        ),
      );

      // Update anomaly statuses in DB if matching IDs exist
      const anomalyDbIds = approvedFixes.map((f) => f.anomalyId).filter((id) => id && id.length > 20);
      if (anomalyDbIds.length > 0) {
        await db.anomaly.updateMany({
          where: { id: { in: anomalyDbIds } },
          data: { status: "RESOLVED" },
        });
      }
    } catch (dbErr) {
      console.warn("Could not persist activity log to database:", dbErr);
    }

    // Execute cleaning if targetLas is present
    let cleanedResult = null;
    if (targetLas) {
      const initialQa = analyzeWellLogQuality(targetLas);
      cleanedResult = cleanLASLogData(targetLas, initialQa, options);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully applied ${approvedFixes.length} approved petrophysical corrections.`,
      appliedCount: approvedFixes.length,
      auditEntries,
      cleanedLas: cleanedResult?.cleanedLas || null,
      cleanedLasText: cleanedResult?.cleanedLasText || "",
      cleanedCsvText: cleanedResult?.cleanedCsvText || "",
      cleanedQa: cleanedResult?.cleanedQa || null,
      verificationReport: cleanedResult?.verificationReport || null,
    });
  } catch (error) {
    console.error("Apply fixes API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to apply approved fixes." },
      { status: 500 },
    );
  }
}
