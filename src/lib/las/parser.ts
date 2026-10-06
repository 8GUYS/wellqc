/**
 * LAS Parser Domain Types.
 * All CWLS LAS 2.0 / 3.0 parsing is executed via the Python FastAPI microservice
 * (backend/app/services/parser.py). Domain types are centralized in src/lib/api-types.ts.
 */

export type {
  LASHeaderItem,
  LASCurveMeta,
  LASWellInfo,
  ParsedLAS,
} from "@/lib/api-types";
