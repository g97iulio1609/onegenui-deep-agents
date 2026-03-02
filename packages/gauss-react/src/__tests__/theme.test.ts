import { describe, expect, it } from "vitest";
import { defaultTheme, themeToVars } from "../theme.js";

describe("theme", () => {
  describe("defaultTheme", () => {
    it("should have all required properties", () => {
      expect(defaultTheme.primaryColor).toBeDefined();
      expect(defaultTheme.backgroundColor).toBeDefined();
      expect(defaultTheme.userBubbleColor).toBeDefined();
      expect(defaultTheme.assistantBubbleColor).toBeDefined();
      expect(defaultTheme.textColor).toBeDefined();
      expect(defaultTheme.borderRadius).toBeDefined();
      expect(defaultTheme.fontFamily).toBeDefined();
    });
  });

  describe("themeToVars", () => {
    it("should convert theme to CSS custom properties", () => {
      const vars = themeToVars({});
      expect(vars["--gauss-primary"]).toBe(defaultTheme.primaryColor);
      expect(vars["--gauss-bg"]).toBe(defaultTheme.backgroundColor);
      expect(vars["--gauss-text"]).toBe(defaultTheme.textColor);
    });

    it("should override defaults with custom values", () => {
      const vars = themeToVars({ primaryColor: "#ff0000" });
      expect(vars["--gauss-primary"]).toBe("#ff0000");
      expect(vars["--gauss-bg"]).toBe(defaultTheme.backgroundColor);
    });

    it("should produce 7 CSS variables", () => {
      const vars = themeToVars({});
      expect(Object.keys(vars)).toHaveLength(7);
    });
  });
});
