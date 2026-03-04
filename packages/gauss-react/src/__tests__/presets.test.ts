import { describe, expect, it } from "vitest";
import {
  lightTheme,
  darkTheme,
  minimalTheme,
  glassTheme,
  themePresets,
} from "../presets.js";
import type { GaussTheme } from "../theme.js";

const REQUIRED_KEYS: (keyof GaussTheme)[] = [
  "primaryColor",
  "backgroundColor",
  "userBubbleColor",
  "assistantBubbleColor",
  "textColor",
  "borderRadius",
  "fontFamily",
];

function assertCompleteTheme(theme: GaussTheme, name: string) {
  for (const key of REQUIRED_KEYS) {
    expect(theme[key], `${name}.${key} should be defined`).toBeDefined();
    expect(typeof theme[key], `${name}.${key} should be a string`).toBe("string");
  }
}

describe("Theme Presets", () => {
  it("lightTheme has all required properties", () => {
    assertCompleteTheme(lightTheme, "lightTheme");
  });

  it("darkTheme has all required properties", () => {
    assertCompleteTheme(darkTheme, "darkTheme");
  });

  it("minimalTheme has all required properties", () => {
    assertCompleteTheme(minimalTheme, "minimalTheme");
  });

  it("glassTheme has all required properties", () => {
    assertCompleteTheme(glassTheme, "glassTheme");
  });

  it("darkTheme has a dark background", () => {
    expect(darkTheme.backgroundColor).toBe("#111827");
  });

  it("minimalTheme uses monospace font", () => {
    expect(minimalTheme.fontFamily).toContain("monospace");
  });

  it("glassTheme uses translucent backgrounds", () => {
    expect(glassTheme.backgroundColor).toContain("rgba");
    expect(glassTheme.assistantBubbleColor).toContain("rgba");
  });

  it("themePresets contains all 4 presets", () => {
    expect(Object.keys(themePresets)).toEqual(["light", "dark", "minimal", "glass"]);
    expect(themePresets.light).toBe(lightTheme);
    expect(themePresets.dark).toBe(darkTheme);
    expect(themePresets.minimal).toBe(minimalTheme);
    expect(themePresets.glass).toBe(glassTheme);
  });

  it("all presets have distinct primary colors", () => {
    const primaries = new Set([
      lightTheme.primaryColor,
      darkTheme.primaryColor,
      minimalTheme.primaryColor,
      glassTheme.primaryColor,
    ]);
    expect(primaries.size).toBe(4);
  });
});
