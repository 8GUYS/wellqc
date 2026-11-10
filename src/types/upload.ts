import {
  ParsedLAS,
  QualityAnalysisResult,
  AIAnalysisOutput,
} from "@/lib/api-types";
import { UploadStatus } from "@/types/enums";

export type { UploadStatus } from "@/types/enums";

export interface QueuedLASFile {
  id: string;
  name: string;
  content: string;
  parsed: ParsedLAS;
  qa: QualityAnalysisResult;
  ai: AIAnalysisOutput;
  status: UploadStatus;
  error?: string;
  savedWell?: { id: string; name: string; qualityScore: number };
}

export interface UploadWorkspaceState {
  fileName: string;
  rawText: string;
  parsedLAS: ParsedLAS | null;
  qaResult: QualityAnalysisResult | null;
  aiOutput: AIAnalysisOutput | null;
  savedSuccess: boolean;
  savedWell: { id: string; name: string; qualityScore: number } | null;
  uploadQueue: QueuedLASFile[];
  restoredFromStorage: boolean;
}

export interface CleaningOptionsState {
  despike: boolean;
  outlierClipping: boolean;
  standardiseUnits: boolean;
  pruneDuplicateDepths: boolean;
  handleFlatlines: boolean;
  interpolateDepthGaps: boolean;
  imputationStrategy: "KNN" | "LINEAR" | "SPLINE" | "NONE";
}
