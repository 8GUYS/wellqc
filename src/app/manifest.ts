import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WellQC Petrophysical Studio",
    short_name: "WellQC",
    description: "Enterprise AI-Powered Well Log Quality Assurance & Standardisation Platform",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#090d16",
    theme_color: "#0071e3",
    orientation: "any",
    categories: ["productivity", "utilities", "business"],
    icons: [
      {
        src: "/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/brand/wellqc-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
    shortcuts: [
      {
        name: "Asset Dashboard",
        short_name: "Dashboard",
        description: "View corporate well inventory & quality scores",
        url: "/dashboard",
        icons: [{ src: "/brand/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "AI Quality Engine",
        short_name: "QA Engine",
        description: "Petrophysical anomaly detection & diagnostic reports",
        url: "/qa-engine",
        icons: [{ src: "/brand/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Curve Standardisation",
        short_name: "Standardisation",
        description: "Subsurface curve standardisation & tool aliasing",
        url: "/standardisation",
        icons: [{ src: "/brand/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Ingest LAS Log",
        short_name: "Upload",
        description: "Fast multi-well log batch parser & ingestion",
        url: "/upload",
        icons: [{ src: "/brand/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
