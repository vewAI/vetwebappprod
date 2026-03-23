import { describe, expect, it } from "vitest";
import { parseLabResults } from "../services/labResultsParser";

describe("parseLabResults", () => {
  it("returns null for empty input", () => {
    expect(parseLabResults("")).toBeNull();
    expect(parseLabResults("   ")).toBeNull();
  });

  it("parses explicit JSON panel payload", () => {
    const input = JSON.stringify({
      panels: [
        {
          title: "Haematology",
          subtitle: "13/01/2026 IDEXX VetLab",
          rows: [
            { name: "Neutrophils", value: "0.82", unit: "x10^9/L", refRange: "2.0-12.0", flag: "low" },
            { name: "Lymphocytes", value: "1.32", unit: "x10^9/L", flag: "low" },
          ],
        },
      ],
    });

    const result = parseLabResults(input);
    expect(result).not.toBeNull();
    expect(result?.panels).toHaveLength(1);
    expect(result?.panels[0].title).toBe("Haematology");
    expect(result?.panels[0].rows[0].flag).toBe("low");
  });

  it("parses nested JSON panel object", () => {
    const input = JSON.stringify({
      haematology: {
        neutrophils: { value: 0.82, unit: "x10^9/L", flag: "low" },
        monocytes: { value: 0.1, unit: "x10^9/L", flag: "low" },
      },
    });

    const result = parseLabResults(input);
    expect(result).not.toBeNull();
    expect(result?.panels).toHaveLength(1);
    expect(result?.panels[0].rows).toHaveLength(2);
  });

  it("parses line-based diagnostics text", () => {
    const input = `Available diagnostics when requested:\n- CBC: mild neutrophilia (14.8 x10^9/L)\n- Fibrinogen: 5.5 g/L\n- Blood glucose: 62 mg/dL`;

    const result = parseLabResults(input);
    expect(result).not.toBeNull();
    const rows = result?.panels.flatMap((panel) => panel.rows) ?? [];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.some((r) => /fibrinogen/i.test(r.name))).toBe(true);
  });

  it("returns null for narrative-only text", () => {
    const input = "Within normal limits. Pending confirmation.";
    expect(parseLabResults(input)).toBeNull();
  });
});
