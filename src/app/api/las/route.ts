import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseLASContent } from "@/lib/las/parser";
import { analyzeWellLogQuality } from "@/lib/las/quality-engine";
import { generateAIAnalysis } from "@/lib/las/ai-analyzer";
import { standardiseMnemonic } from "@/lib/las/standardiser";
import { getCurrentUser } from "@/lib/auth";
import { buildCleanedDataExport } from "@/lib/las/exporter";

interface CommitLASRequest {
  fileName?: string;
  content?: string;
  lasText?: string;
}

class FreemiumLimitError extends Error {
  constructor(public freeChecksUsed: number) {
    super("Free limit reached. You have used your 2 free LAS log file checks. Upgrade to Pro for unlimited log checks.");
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    const body = (await request.json()) as CommitLASRequest;
    const content = (body.content || body.lasText)?.trim();
    const fileName = body.fileName?.trim() || "uploaded-well-log.las";

    if (!content) {
      return NextResponse.json({ error: "LAS file content is required." }, { status: 400 });
    }

    const parsed = parseLASContent(content);
    const qa = analyzeWellLogQuality(parsed);
    const ai = generateAIAnalysis(parsed, qa);

    // ── Pre-check mode: return in-memory QA & AI analysis without DB write ──
    if (action === "precheck") {
      const curveMappings = parsed.curves.map((c) => {
        const std = standardiseMnemonic(c.mnemonic, c.unit);
        return {
          rawMnemonic: c.mnemonic,
          standardMnemonic: std.standardMnemonic,
          confidence: std.confidence,
          unit: c.unit,
          unitMismatch: std.unitMismatch,
        };
      });

      const anomalies = qa.anomalies.map((a) => ({
        curveMnemonic: a.curveMnemonic,
        depthStart: a.depthStart,
        depthEnd: a.depthEnd,
        anomalyType: a.anomalyType,
        severity: a.severity,
        description: a.description,
        suggestedCorrection: a.suggestedCorrection,
      }));

      return NextResponse.json(
        {
          wellName: parsed.wellInfo.wellName,
          company: parsed.wellInfo.company,
          field: parsed.wellInfo.field,
          apiUwi: parsed.wellInfo.apiUwi,
          startDepth: parsed.wellInfo.startDepth,
          stopDepth: parsed.wellInfo.stopDepth,
          step: parsed.wellInfo.step,
          depthUnit: parsed.wellInfo.depthUnit,
          totalPoints: parsed.totalPoints,
          curveCount: parsed.curves.length,
          overallScore: qa.overallScore,
          qualityGrade: qa.qualityGrade,
          completenessScore: qa.completenessScore,
          consistencyScore: qa.consistencyScore,
          anomalyCount: qa.anomalyCount,
          criticalCount: qa.criticalCount,
          warningCount: qa.warningCount,
          curveMappings,
          anomalies,
          aiSummary: ai.summary,
          recommendations: ai.recommendations,
          curveSummaries: qa.curveSummaries,
        },
        { status: 200 },
      );
    }

    // ── Commit mode: Requires authentication & DB transaction ───────────────
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });

    // Check freemium check limit (Commented out for free testing - uncomment when payment option is implemented)
    /*
    const userTier = user.tier || "FREE";

    // Cheap early check — good UX, avoids wasting CPU on parsing for an obviously-over-limit user.
    // NOT the authoritative check — that happens atomically inside the transaction below.
    const checksUsedEarly = user.freeChecksUsed ?? 0;
    if (userTier === "FREE" && checksUsedEarly >= 2) {
      return NextResponse.json(
        {
          error: "Free limit reached. You have used your 2 free LAS log file checks. Upgrade to Pro for unlimited log checks.",
          limitReached: true,
          freeChecksUsed: checksUsedEarly,
          tier: userTier,
        },
        { status: 402 },
      );
    }
    */

    const cleaned = buildCleanedDataExport(parsed, qa);
    const cleanedCurves = new Map(cleaned.curves.map((curve) => [curve.originalMnemonic, curve]));
    const operatorName = fallback(parsed.wellInfo.company, "Unknown Operator");
    const fieldName = fallback(parsed.wellInfo.field, "Uploaded Field");
    const country = fallback(parsed.wellInfo.country, "Unknown");
    const basin = inferBasin(parsed.wellInfo.location, fieldName);
    const apiNo = fallback(parsed.wellInfo.apiUwi, `UPLOADED-${Date.now()}`);
    const wellName = fallback(parsed.wellInfo.wellName, fileName.replace(/\.[^/.]+$/, ""));
    const depthUnit = fallback(parsed.wellInfo.depthUnit, "FT");

    const curveRows = qa.curveSummaries.map((summary) => {
      const curveMeta = parsed.curves.find((curve) => curve.mnemonic === summary.mnemonic);
      const standard = standardiseMnemonic(summary.mnemonic, summary.unit);
      const cleanedCurve = cleanedCurves.get(summary.mnemonic);
      const values = cleanedCurve?.values || parsed.data.curves[summary.mnemonic] || [];

      return {
        originalMnemonic: summary.mnemonic,
        standardMnemonic: cleanedCurve?.exportMnemonic || summary.standardMnemonic,
        unit: cleanedCurve?.unit || summary.unit,
        description: curveMeta?.description || standard.matchedName,
        nullCount: summary.nullCount,
        totalPoints: summary.totalPoints,
        nullPercentage: summary.nullPercentage,
        confidence: standard.confidence,
        minVal: summary.minVal,
        maxVal: summary.maxVal,
        meanVal: summary.meanVal,
        status: summary.status === "EXCELLENT" ? "VALID" : summary.status === "GOOD" ? "STANDARDISED" : "WARNING",
        dataJson: JSON.stringify(
          parsed.data.depth.map((depth, index) => ({
            depth,
            value: values[index] ?? parsed.wellInfo.nullValue,
          })),
        ),
      };
    });

    const saved = await db.$transaction(async (tx) => {
      // Atomic freemium check-and-increment — the actual enforcement.
      // A single conditional UPDATE closes the race two concurrent requests
      // could otherwise exploit by both reading "under limit" before either writes.
      if (userTier === "FREE") {
        const consumed = await tx.user.updateMany({
          where: { id: user.id, tier: "FREE", freeChecksUsed: { lt: 2 } },
          data: { freeChecksUsed: { increment: 1 } },
        });
        if (consumed.count === 0) {
          throw new FreemiumLimitError(2);
        }
      }

      await tx.operator.upsert({
        where: { name: operatorName },
        update: {},
        create: { name: operatorName },
      });

      await tx.field.upsert({
        where: { name: fieldName },
        update: {
          basin,
          country,
        },
        create: {
          name: fieldName,
          basin,
          country,
          region: parsed.wellInfo.location || null,
        },
      });

      const existingWell = await tx.well.findUnique({ where: { apiNo }, select: { id: true, ownerId: true } });
      if (existingWell && existingWell.ownerId !== user.id) {
        throw new Error("This API/UWI is already assigned to another workspace.");
      }

      const well = await tx.well.upsert({
        where: { apiNo },
        update: {
          name: wellName,
          operatorName,
          fieldName,
          basin,
          country,
          latitude: parsed.wellInfo.latitude ?? 0,
          longitude: parsed.wellInfo.longitude ?? 0,
          tdFt: convertDepthToFeet(parsed.wellInfo.stopDepth, depthUnit),
          depthUnit,
          qualityScore: qa.overallScore,
          qualityGrade: qa.qualityGrade,
          status: "ACTIVE",
          ownerId: user.id,
        },
        create: {
          apiNo,
          name: wellName,
          operatorName,
          fieldName,
          basin,
          country,
          latitude: parsed.wellInfo.latitude ?? 0,
          longitude: parsed.wellInfo.longitude ?? 0,
          tdFt: convertDepthToFeet(parsed.wellInfo.stopDepth, depthUnit),
          depthUnit,
          qualityScore: qa.overallScore,
          qualityGrade: qa.qualityGrade,
          status: "ACTIVE",
          ownerId: user.id,
        },
      });

      const lasFile = await tx.lASFile.create({
        data: {
          wellId: well.id,
          originalName: fileName,
          fileSizeKb: Buffer.byteLength(content, "utf8") / 1024,
          lasVersion: parsed.version,
          startDepth: parsed.wellInfo.startDepth,
          stopDepth: parsed.wellInfo.stopDepth,
          stepDepth: parsed.wellInfo.step,
          nullValue: parsed.wellInfo.nullValue,
          depthUnit,
          rawHeader: parsed.rawHeader,
          curveCount: parsed.curves.length,
          pointCount: parsed.totalPoints,
          status: "PROCESSED",
          uploadedById: user.id,
          ownerId: user.id,
        },
      });

      await tx.curve.createMany({
        data: curveRows.map((curve) => ({ ...curve, lasFileId: lasFile.id, ownerId: user.id })),
      });

      const savedCurves = await tx.curve.findMany({
        where: { lasFileId: lasFile.id },
        select: { id: true, originalMnemonic: true },
      });
      const curveIdByMnemonic = new Map(savedCurves.map((curve) => [curve.originalMnemonic, curve.id]));

      const report = await tx.qualityReport.create({
        data: {
          wellId: well.id,
          lasFileId: lasFile.id,
          overallScore: qa.overallScore,
          qualityGrade: qa.qualityGrade,
          completenessScore: qa.completenessScore,
          consistencyScore: qa.consistencyScore,
          anomalyCount: qa.anomalyCount,
          aiSummary: ai.summary,
          recommendations: JSON.stringify(ai.recommendations),
          reportJson: JSON.stringify(qa),
          ownerId: user.id,
        },
      });

      if (qa.anomalies.length > 0) {
        await tx.anomaly.createMany({
          data: qa.anomalies.map((anomaly) => ({
            qualityReportId: report.id,
            curveId: curveIdByMnemonic.get(anomaly.curveMnemonic),
            curveMnemonic: anomaly.curveMnemonic,
            depthStart: anomaly.depthStart,
            depthEnd: anomaly.depthEnd,
            anomalyType: anomaly.anomalyType,
            severity: anomaly.severity,
            description: anomaly.description,
            suggestedCorrection: anomaly.suggestedCorrection,
            ownerId: user.id,
          })),
        });
      }

      await tx.activityLog.create({
        data: {
          userName: "Upload Workspace",
          userRole: user.role,
          userId: user.id,
          action: "UPLOAD_LAS",
          targetType: "WELL",
          targetId: well.id,
          details: `Committed ${fileName} for ${well.name}. Quality score: ${qa.overallScore}/100 (${qa.qualityGrade}).`,
        },
      });

      // Increment usage count for free tier users (Commented out for free testing)
      /*
      if ((user.tier || "FREE") === "FREE") {
        await tx.user.update({
          where: { id: user.id },
          data: { freeChecksUsed: { increment: 1 } },
        });
      }
      */

      return { well, lasFile, report };
    }, { maxWait: 10_000, timeout: 30_000 });

    return NextResponse.json({
      message: "Well committed to database.",
      well: {
        id: saved.well.id,
        name: saved.well.name,
        apiNo: saved.well.apiNo,
        qualityScore: saved.well.qualityScore,
        qualityGrade: saved.well.qualityGrade,
      },
      lasFileId: saved.lasFile.id,
      reportId: saved.report.id,
    });
  } catch (error) {
    if (error instanceof FreemiumLimitError) {
      return NextResponse.json(
        {
          error: error.message,
          limitReached: true,
          freeChecksUsed: error.freeChecksUsed,
          tier: "FREE",
        },
        { status: 402 },
      );
    }
    console.error("Failed to commit LAS file", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to commit LAS file." },
      { status: 500 },
    );
  }
}

function fallback(value: string | undefined, defaultValue: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed !== "UNKNOWN" ? trimmed : defaultValue;
}

function inferBasin(location: string, fieldName: string) {
  const source = `${location} ${fieldName}`.toLowerCase();

  if (source.includes("permian") || source.includes("wolfcamp") || source.includes("delaware")) return "Permian Basin";
  if (source.includes("mississippi") || source.includes("gulf") || source.includes("gom")) return "Gulf of Mexico";
  if (source.includes("forties") || source.includes("north sea")) return "North Sea Basin";
  if (source.includes("niger")) return "Niger Delta Basin";

  return "Uploaded Wells";
}

function convertDepthToFeet(depth: number, unit: string) {
  return unit.trim().toUpperCase() === "M" ? depth * 3.280839895 : depth;
}