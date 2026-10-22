"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeId =
  | "slate"
  | "light"
  | "obsidian"
  | "navy"
  | "charcoal"
  | "aurora"
  | "sunset"
  | "ocean"
  | "cyberpunk"
  | "emerald"
  | "custom";

export interface CustomThemeSettings {
  name: string;
  isGradient: boolean;
  bgStart: string;
  bgEnd: string;
  bgAngle: string;
  panel: string;
  card: string;
  border: string;
  accent: string;
  isLight: boolean;
}

export const DEFAULT_CUSTOM_THEME: CustomThemeSettings = {
  name: "Custom Studio Theme",
  isGradient: true,
  bgStart: "#0a0a1a",
  bgEnd: "#1a0b2e",
  bgAngle: "135deg",
  panel: "#120f24",
  card: "#191533",
  border: "rgba(168, 85, 247, 0.25)",
  accent: "#8b5cf6",
  isLight: false,
};

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  tagline: string;
  isLight?: boolean;
  isGradient?: boolean;
  group: "standard" | "gradient" | "custom";
  colors: {
    bg: string;
    panel: string;
    border: string;
    accent: string;
  };
}

export const THEMES: ThemeConfig[] = [
  // Standard Professional Themes
  {
    id: "slate",
    name: "Deep Slate",
    tagline: "Workstation Default",
    group: "standard",
    colors: {
      bg: "#090d16",
      panel: "#0f172a",
      border: "#1e293b",
      accent: "#0284c7",
    },
  },
  {
    id: "light",
    name: "Apple Studio Light",
    tagline: "Warm Creamy Canvas & Dynamic Blue",
    isLight: true,
    group: "standard",
    colors: {
      bg: "#f7f4ec",
      panel: "#ffffff",
      border: "rgba(60, 50, 40, 0.08)",
      accent: "#0071e3",
    },
  },
  {
    id: "obsidian",
    name: "OLED Obsidian",
    tagline: "Ultra-High Contrast Pitch Black",
    group: "standard",
    colors: {
      bg: "#000000",
      panel: "#0a0a0a",
      border: "#262626",
      accent: "#3b82f6",
    },
  },
  {
    id: "navy",
    name: "Midnight Navy",
    tagline: "Technical Subsurface Blue",
    group: "standard",
    colors: {
      bg: "#040814",
      panel: "#0a1329",
      border: "#1e2e4f",
      accent: "#38bdf8",
    },
  },
  {
    id: "charcoal",
    name: "Graphite Charcoal",
    tagline: "Neutral Industrial Monolith",
    group: "standard",
    colors: {
      bg: "#111113",
      panel: "#18181b",
      border: "#2e2e33",
      accent: "#10b981",
    },
  },

  // Radiant Gradient Themes
  {
    id: "aurora",
    name: "Cosmic Aurora",
    tagline: "Iridescent Deep Space Gradient",
    isGradient: true,
    group: "gradient",
    colors: {
      bg: "linear-gradient(135deg, #05141c 0%, #06111e 65%, #050b14 100%)",
      panel: "#091a27",
      border: "rgba(6, 182, 212, 0.25)",
      accent: "#06b6d4",
    },
  },
  {
    id: "sunset",
    name: "Neon Sunset",
    tagline: "Velvet Dusk & Violet-Rose Gradient",
    isGradient: true,
    group: "gradient",
    colors: {
      bg: "linear-gradient(135deg, #2a0e28 0%, #15091c 60%, #0d0412 100%)",
      panel: "#1e0d29",
      border: "rgba(244, 63, 94, 0.25)",
      accent: "#f43f5e",
    },
  },
  {
    id: "ocean",
    name: "Deep Oceanic",
    tagline: "Abyssal Trench & Sapphire Glow",
    isGradient: true,
    group: "gradient",
    colors: {
      bg: "linear-gradient(140deg, #03253b 0%, #02121f 55%, #01080e 100%)",
      panel: "#04192b",
      border: "rgba(56, 189, 248, 0.22)",
      accent: "#0ea5e9",
    },
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk Matrix",
    tagline: "Electric Violet & Lime Glow",
    isGradient: true,
    group: "gradient",
    colors: {
      bg: "linear-gradient(135deg, #1a082c 0%, #0c0617 60%, #05020a 100%)",
      panel: "#160b29",
      border: "rgba(168, 85, 247, 0.25)",
      accent: "#a855f7",
    },
  },
  {
    id: "emerald",
    name: "Subsurface Emerald",
    tagline: "Bioluminescent Moss & Malachite",
    isGradient: true,
    group: "gradient",
    colors: {
      bg: "linear-gradient(135deg, #062b1e 0%, #03140e 60%, #010a07 100%)",
      panel: "#052016",
      border: "rgba(16, 185, 129, 0.25)",
      accent: "#10b981",
    },
  },

  // User Custom Dynamic Palette
  {
    id: "custom",
    name: "Custom Studio Theme",
    tagline: "User-Defined Color Palette & Gradient",
    isGradient: true,
    group: "custom",
    colors: {
      bg: "linear-gradient(135deg, #0a0a1a 0%, #1a0b2e 100%)",
      panel: "#120f24",
      border: "rgba(168, 85, 247, 0.25)",
      accent: "#8b5cf6",
    },
  },
];

export function getStoredCustomTheme(): CustomThemeSettings {
  if (typeof window === "undefined") return DEFAULT_CUSTOM_THEME;
  try {
    const raw = localStorage.getItem("wellqc_custom_theme");
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CUSTOM_THEME, ...parsed };
    }
  } catch {}
  return DEFAULT_CUSTOM_THEME;
}

export function applyThemeToDOM(themeId: ThemeId, customConfig?: CustomThemeSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", themeId);

  if (themeId === "custom") {
    const custom = customConfig || getStoredCustomTheme();
    if (custom.isLight) {
      root.classList.remove("dark");
      root.style.setProperty("--wellqc-text", "#1c1917");
      root.style.setProperty("--wellqc-muted", "#78716c");
    } else {
      root.classList.add("dark");
      root.style.setProperty("--wellqc-text", "#f8fafc");
      root.style.setProperty("--wellqc-muted", "#94a3b8");
    }

    if (custom.isGradient) {
      root.style.setProperty(
        "--wellqc-dark",
        `linear-gradient(${custom.bgAngle || "135deg"}, ${custom.bgStart}, ${custom.bgEnd})`
      );
      root.style.setProperty("--background", custom.bgStart);
    } else {
      root.style.setProperty("--wellqc-dark", custom.bgStart);
      root.style.setProperty("--background", custom.bgStart);
    }

    root.style.setProperty("--wellqc-panel", custom.panel);
    root.style.setProperty("--wellqc-card", custom.card);
    root.style.setProperty("--wellqc-border", custom.border);
    root.style.setProperty("--wellqc-accent", custom.accent);
    root.style.setProperty("--wellqc-cyan", custom.accent);
  } else {
    // Clear inline custom overrides so stylesheet data-theme takes over cleanly
    root.style.removeProperty("--wellqc-dark");
    root.style.removeProperty("--background");
    root.style.removeProperty("--wellqc-panel");
    root.style.removeProperty("--wellqc-card");
    root.style.removeProperty("--wellqc-border");
    root.style.removeProperty("--wellqc-accent");
    root.style.removeProperty("--wellqc-cyan");
    root.style.removeProperty("--wellqc-text");
    root.style.removeProperty("--wellqc-muted");

    if (themeId === "light") {
      root.classList.remove("dark");
    } else {
      root.classList.add("dark");
    }
  }
}

interface ThemeContextType {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  customTheme: CustomThemeSettings;
  setCustomTheme: (settings: CustomThemeSettings) => void;
  themes: ThemeConfig[];
  currentTheme: ThemeConfig;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "slate",
  setTheme: () => {},
  customTheme: DEFAULT_CUSTOM_THEME,
  setCustomTheme: () => {},
  themes: THEMES,
  currentTheme: THEMES[0],
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [customTheme, setCustomThemeState] = useState<CustomThemeSettings>(() => getStoredCustomTheme());
  const [theme, setThemeState] = useState<ThemeId>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("wellqc_theme") as ThemeId;
        if (saved && (saved === "custom" || THEMES.some((t) => t.id === saved))) {
          return saved;
        }
      } catch {}
    }
    return "slate";
  });

  useEffect(() => {
    applyThemeToDOM(theme, customTheme);
  }, [theme, customTheme]);

  const setTheme = (newTheme: ThemeId) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem("wellqc_theme", newTheme);
    } catch {}
    applyThemeToDOM(newTheme, customTheme);
  };

  const setCustomTheme = (newSettings: CustomThemeSettings) => {
    setCustomThemeState(newSettings);
    try {
      localStorage.setItem("wellqc_custom_theme", JSON.stringify(newSettings));
      localStorage.setItem("wellqc_theme", "custom");
    } catch {}
    setThemeState("custom");
    applyThemeToDOM("custom", newSettings);
  };

  const currentTheme =
    theme === "custom"
      ? {
          id: "custom" as ThemeId,
          name: customTheme.name || "Custom Studio Theme",
          tagline: customTheme.isGradient ? "Custom Gradient Canvas" : "Custom Solid Canvas",
          isLight: customTheme.isLight,
          isGradient: customTheme.isGradient,
          group: "custom" as const,
          colors: {
            bg: customTheme.isGradient
              ? `linear-gradient(${customTheme.bgAngle || "135deg"}, ${customTheme.bgStart}, ${customTheme.bgEnd})`
              : customTheme.bgStart,
            panel: customTheme.panel,
            border: customTheme.border,
            accent: customTheme.accent,
          },
        }
      : THEMES.find((t) => t.id === theme) || THEMES[0];

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        customTheme,
        setCustomTheme,
        themes: THEMES,
        currentTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
