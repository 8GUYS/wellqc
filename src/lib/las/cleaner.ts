/**
 * LAS Data Cleaning & Verification Types.
 * All cleaning operations are executed centrally via the Python FastAPI microservice
 * (backend/app/services/cleaner.py). Types are centralized in src/lib/api-types.ts.
 */

export type {
  CleaningOptions,
  VerificationReport,
  CleanedLogResult,
} from "@/lib/api-types";
