-- AlterTable
ALTER TABLE "Anomaly" ADD COLUMN     "ownerId" TEXT;

-- AlterTable
ALTER TABLE "Curve" ADD COLUMN     "ownerId" TEXT;

-- AlterTable
ALTER TABLE "LASFile" ADD COLUMN     "ownerId" TEXT;

-- AlterTable
ALTER TABLE "QualityReport" ADD COLUMN     "ownerId" TEXT;

-- CreateIndex
CREATE INDEX "Anomaly_ownerId_idx" ON "Anomaly"("ownerId");

-- CreateIndex
CREATE INDEX "Curve_ownerId_idx" ON "Curve"("ownerId");

-- CreateIndex
CREATE INDEX "LASFile_ownerId_idx" ON "LASFile"("ownerId");

-- CreateIndex
CREATE INDEX "QualityReport_ownerId_idx" ON "QualityReport"("ownerId");

-- AddForeignKey
ALTER TABLE "LASFile" ADD CONSTRAINT "LASFile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curve" ADD CONSTRAINT "Curve_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityReport" ADD CONSTRAINT "QualityReport_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anomaly" ADD CONSTRAINT "Anomaly_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
