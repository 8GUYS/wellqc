import { ParsedLAS } from "@/lib/las/parser";

export function downsampleParsedLASForStorage(parsed: ParsedLAS, maxPoints: number = 300): ParsedLAS {
  if (!parsed || !parsed.data || !parsed.data.depth) return parsed;
  const total = parsed.data.depth.length;
  if (total <= maxPoints) {
    return parsed;
  }

  const step = Math.ceil(total / maxPoints);
  const sampledDepth: number[] = [];
  const sampledCurves: Record<string, number[]> = {};

  for (const mnem of Object.keys(parsed.data.curves)) {
    sampledCurves[mnem] = [];
  }

  for (let i = 0; i < total; i += step) {
    sampledDepth.push(parsed.data.depth[i]);
    for (const [mnem, values] of Object.entries(parsed.data.curves)) {
      sampledCurves[mnem].push(values[i] ?? parsed.wellInfo.nullValue);
    }
  }

  return {
    ...parsed,
    data: {
      depth: sampledDepth,
      curves: sampledCurves,
    },
  };
}

export function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
