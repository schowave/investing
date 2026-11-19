import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // Alle Module mit Logik, auch ungetestete; die Seiten (.tsx) prüft der Build, nicht die Unit-Tests.
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/test/**", "src/app/server.ts", "src/app/brand.ts"],
      reporter: ["text-summary", "html"],
      // Knapp unter dem Stand bei Einführung: sinkt die Abdeckung, bricht `mise run check`.
      thresholds: { statements: 94, branches: 84, functions: 95, lines: 96 },
    },
  },
});
