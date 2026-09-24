// prisma/seed.ts
//
// Fully synthetic data — no real well, operator, or customer data. Safe to
// commit and run on every laptop. Wired up via prisma7.config.ts's
// migrations.seed field and run automatically by
// frontend/docker-entrypoint.sh on first container start.
//
// Reuses your existing configured client (src/lib/db.ts) rather than a
// second PrismaClient instance, so it goes through the same neon-proxy
// adapter setup as the running app — one source of truth.

import { db } from "../src/lib/db";

async function main() {
  const operator = await db.operator.upsert({
    where: { name: "Aurora Resources" },
    update: {},
    create: {
      name: "Aurora Resources",
      code: "AUR",
      contactEmail: "ops@aurora-resources.example.test",
    },
  });

  const field = await db.field.upsert({
    where: { name: "Kestrel Basin Field" },
    update: {},
    create: {
      name: "Kestrel Basin Field",
      basin: "Kestrel Basin",
      country: "USA",
      region: "Permian-analog (synthetic)",
    },
  });

  const admin = await db.user.upsert({
    where: { email: "admin@wellqc.example.test" },
    update: {},
    create: {
      email: "admin@wellqc.example.test",
      name: "Dana Whitfield",
      // Placeholder only — not a working credential. If you need to log in
      // locally, replace with a real hash from src/lib/auth.ts's hashing
      // function, e.g. `await hashPassword("devpassword123")`.
      passwordHash: "dev-placeholder-hash",
      role: "ADMIN",
      department: "Subsurface Analytics",
      tier: "ENTERPRISE",
    },
  });

  const petro = await db.user.upsert({
    where: { email: "petro@wellqc.example.test" },
    update: {},
    create: {
      email: "petro@wellqc.example.test",
      name: "Renee Castillo",
      passwordHash: "dev-placeholder-hash",
      role: "PETROPHYSICIST",
      department: "Subsurface Analytics",
      tier: "PRO",
    },
  });

  const well = await db.well.upsert({
    where: { apiNo: "42-999-00001" },
    update: {},
    create: {
      apiNo: "42-999-00001",
      name: "Kestrel Federal 1H",
      operatorName: operator.name,
      fieldName: field.name,
      basin: "Kestrel Basin",
      country: "USA",
      latitude: 31.8457,
      longitude: -102.3676,
      elevFt: 2810,
      tdFt: 11250,
      depthUnit: "FT",
      status: "COMPLETED",
      qualityScore: 78,
      qualityGrade: "GOOD",
      ownerId: petro.id,
    },
  });

  const lasFile = await db.lASFile.create({
    data: {
      wellId: well.id,
      originalName: "kestrel_federal_1h.las",
      fileSizeKb: 412.5,
      lasVersion: "2.0",
      startDepth: 6000,
      stopDepth: 6500,
      stepDepth: 0.5,
      nullValue: -999.25,
      depthUnit: "FT",
      rawHeader: "~VERSION INFORMATION\nVERS. 2.0 : CWLS log ASCII Standard\n(synthetic seed header)",
      curveCount: 4,
      pointCount: 1000,
      status: "PROCESSED",
      uploadedById: petro.id,
      ownerId: petro.id,
    },
  });

  const curveDefs = [
    { mnemonic: "GR", standard: "GR", unit: "GAPI", min: 12.4, max: 148.9, mean: 62.1 },
    { mnemonic: "RHOB", standard: "RHOB", unit: "G/C3", min: 2.02, max: 2.71, mean: 2.44 },
    { mnemonic: "NPHI", standard: "NPHI", unit: "V/V", min: 0.02, max: 0.38, mean: 0.19 },
    { mnemonic: "RT", standard: "RT", unit: "OHMM", min: 0.8, max: 420.3, mean: 34.6 },
  ];

  for (const c of curveDefs) {
    await db.curve.create({
      data: {
        lasFileId: lasFile.id,
        originalMnemonic: c.mnemonic,
        standardMnemonic: c.standard,
        unit: c.unit,
        nullCount: 6,
        totalPoints: 1000,
        nullPercentage: 0.6,
        confidence: 0.94,
        minVal: c.min,
        maxVal: c.max,
        meanVal: c.mean,
        status: "STANDARDISED",
        ownerId: petro.id,
      },
    });
  }

  const report = await db.qualityReport.create({
    data: {
      wellId: well.id,
      lasFileId: lasFile.id,
      overallScore: 78,
      qualityGrade: "GOOD",
      completenessScore: 92,
      consistencyScore: 81,
      anomalyCount: 2,
      aiSummary: "Synthetic seed report — RHOB shows a brief flatline; one RT spike flagged as possible tool artifact.",
      recommendations: "Review RHOB 6120-6124 ft interval; confirm RT spike at 6301 ft against caliper.",
      ownerId: petro.id,
    },
  });

  await db.anomaly.createMany({
    data: [
      {
        qualityReportId: report.id,
        curveMnemonic: "RHOB",
        depthStart: 6120,
        depthEnd: 6124,
        anomalyType: "FLATLINE",
        severity: "WARNING",
        description: "RHOB reads a constant value over a 4 ft interval — likely tool sticking.",
        suggestedCorrection: "Flag interval for manual review; do not impute without confirming tool state.",
        status: "OPEN",
        ownerId: petro.id,
      },
      {
        qualityReportId: report.id,
        curveMnemonic: "RT",
        depthStart: 6301,
        depthEnd: 6301.5,
        anomalyType: "EXTREME_SPIKE",
        severity: "CRITICAL",
        description: "RT spikes to 420 ohm-m against a local mean of ~35 ohm-m.",
        suggestedCorrection: "Cross-check against caliper; likely a borehole washout artifact.",
        status: "OPEN",
        ownerId: petro.id,
      },
    ],
  });

  await db.activityLog.create({
    data: {
      userId: petro.id,
      userName: petro.name,
      userRole: petro.role,
      action: "UPLOAD_LAS",
      targetType: "LAS_FILE",
      targetId: lasFile.id,
      details: "Seeded synthetic LAS upload for local development.",
    },
  });

  console.log("Seed complete:", {
    operator: operator.name,
    field: field.name,
    well: well.name,
    users: [admin.email, petro.email],
    lasFile: lasFile.originalName,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
