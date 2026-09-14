import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { WellListItem } from "@/lib/api-types";
import { getCurrentUser } from "@/lib/auth";
import { CurveHealthSummary } from "@/lib/las/quality-engine";

interface CreateWellRequest {
  name?: string;
  apiNo?: string;
  operatorName?: string;
  fieldName?: string;
  basin?: string;
  country?: string;
  tdFt?: number;
  latitude?: number;
  longitude?: number;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    const wells = await db.well.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        lasFiles: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            curves: {
              select: {
                id: true,
                originalMnemonic: true,
                standardMnemonic: true,
                unit: true,
                nullCount: true,
                totalPoints: true,
                nullPercentage: true,
                minVal: true,
                maxVal: true,
                meanVal: true,
                status: true,
              },
            },
            reports: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: {
                _count: { select: { anomalies: true } },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ wells: wells.map(toWellListItem) });
  } catch (error) {
    console.error("Failed to list wells", error);
    return NextResponse.json({ wells: [], error: "Database is not available yet." });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    const body = (await request.json()) as CreateWellRequest;
    const name = body.name?.trim();
    const apiNo = body.apiNo?.trim();

    if (!name || !apiNo) {
      return NextResponse.json({ error: "Well name and API/UWI are required." }, { status: 400 });
    }

    const operatorName = body.operatorName?.trim() || "Unknown Operator";
    const fieldName = body.fieldName?.trim() || "Unassigned Field";
    const basin = body.basin?.trim() || "Uploaded Wells";
    const country = body.country?.trim() || "Unknown";

    const well = await db.$transaction(async (tx) => {
      await tx.operator.upsert({
        where: { name: operatorName },
        update: {},
        create: { name: operatorName },
      });

      await tx.field.upsert({
        where: { name: fieldName },
        update: { basin, country },
        create: { name: fieldName, basin, country },
      });

      const savedWell = await tx.well.upsert({
        where: { apiNo },
        update: {
          name,
          operatorName,
          fieldName,
          basin,
          country,
          latitude: body.latitude ?? 0,
          longitude: body.longitude ?? 0,
          tdFt: body.tdFt ?? 0,
        },
        create: {
          apiNo,
          name,
          operatorName,
          fieldName,
          basin,
          country,
          latitude: body.latitude ?? 0,
          longitude: body.longitude ?? 0,
          tdFt: body.tdFt ?? 0,
          qualityScore: 0,
          qualityGrade: "UNVALIDATED",
          ownerId: user.id,
        },
      });

      await tx.activityLog.create({
        data: {
          userName: "Well Management",
          userRole: user.role,
          userId: user.id,
          action: "CREATE_WELL",
          targetType: "WELL",
          targetId: savedWell.id,
          details: `Created or updated well asset ${savedWell.name} (${savedWell.apiNo}).`,
        },
      });

      return savedWell;
    });

    return NextResponse.json({ well });
  } catch (error) {
    console.error("Failed to create well", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create well." },
      { status: 500 },
    );
  }
}

function extractCurveSummaries(
  latestReport: { reportJson?: string } | undefined,
  latestLasFile:
    | {
        curves?: Array<{
          id: string;
          originalMnemonic: string;
          standardMnemonic: string;
          unit: string;
          nullCount: number;
          totalPoints: number;
          nullPercentage: number;
          minVal: number | null;
          maxVal: number | null;
          meanVal: number | null;
          status: string;
        }>;
      }
    | undefined,
): CurveHealthSummary[] {
  if (latestReport?.reportJson) {
    try {
      const parsedQa = JSON.parse(latestReport.reportJson);
      if (Array.isArray(parsedQa.curveSummaries) && parsedQa.curveSummaries.length > 0) {
        return parsedQa.curveSummaries;
      }
    } catch {
      // Fallback
    }
  }

  if (!latestLasFile?.curves || latestLasFile.curves.length === 0) {
    return [];
  }

  return latestLasFile.curves.map((curve) => {
    let healthScore = 100;
    if (curve.nullPercentage > 50) healthScore -= 40;
    else if (curve.nullPercentage > 20) healthScore -= 20;
    else if (curve.nullPercentage > 5) healthScore -= 10;
    healthScore = Math.max(0, Math.min(100, healthScore));

    return {
      mnemonic: curve.originalMnemonic,
      standardMnemonic: curve.standardMnemonic || "UNKNOWN",
      unit: curve.unit || "",
      nullCount: curve.nullCount || 0,
      totalPoints: curve.totalPoints || 0,
      nullPercentage: curve.nullPercentage || 0,
      minVal: curve.minVal,
      maxVal: curve.maxVal,
      meanVal: curve.meanVal,
      healthScore,
      status: (curve.status === "VALID" ? "EXCELLENT" : curve.status === "STANDARDISED" ? "GOOD" : "POOR") as any,
      anomalies: [],
    };
  });
}

function toWellListItem(well: {
  id: string;
  apiNo: string;
  name: string;
  operatorName: string;
  fieldName: string;
  basin: string;
  country: string;
  latitude: number;
  longitude: number;
  elevFt: number;
  tdFt: number;
  depthUnit: string;
  status: string;
  qualityScore: number;
  qualityGrade: string;
  createdAt: Date;
  updatedAt: Date;
  lasFiles: Array<{
    id: string;
    originalName: string;
    curveCount: number;
    pointCount: number;
    curves?: Array<{
      id: string;
      originalMnemonic: string;
      standardMnemonic: string;
      unit: string;
      nullCount: number;
      totalPoints: number;
      nullPercentage: number;
      minVal: number | null;
      maxVal: number | null;
      meanVal: number | null;
      status: string;
    }>;
    reports: Array<{
      id: string;
      reportJson?: string;
      anomalyCount: number;
      _count: { anomalies: number };
    }>;
  }>;
}): WellListItem {
  const latestLasFile = well.lasFiles[0];
  const latestReport = latestLasFile?.reports[0];
  const curveSummaries = extractCurveSummaries(latestReport, latestLasFile);

  return {
    id: well.id,
    apiNo: well.apiNo,
    name: well.name,
    operatorName: well.operatorName,
    fieldName: well.fieldName,
    basin: well.basin,
    country: well.country,
    latitude: well.latitude,
    longitude: well.longitude,
    elevFt: well.elevFt,
    tdFt: well.tdFt,
    depthUnit: well.depthUnit,
    status: well.status,
    qualityScore: well.qualityScore,
    qualityGrade: well.qualityGrade,
    latestLasFileName: latestLasFile?.originalName ?? null,
    latestLasFileId: latestLasFile?.id ?? null,
    latestReportId: latestReport?.id ?? null,
    curveCount: latestLasFile?.curveCount ?? 0,
    pointCount: latestLasFile?.pointCount ?? 0,
    anomalyCount: latestReport?._count.anomalies ?? latestReport?.anomalyCount ?? 0,
    curveSummaries,
    createdAt: well.createdAt.toISOString(),
    updatedAt: well.updatedAt.toISOString(),
  };
}
