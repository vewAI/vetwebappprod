import assert from "assert";
import { describe, it } from "vitest";
import {
  parseSessionViewFrom,
  professorSessionBreadcrumbItems,
  professorSessionHref,
} from "../sessionViewHref";

describe("parseSessionViewFrom", () => {
  it("treats case as a case origin", () => {
    assert.equal(parseSessionViewFrom("case"), "case");
  });

  it("defaults to sessions", () => {
    assert.equal(parseSessionViewFrom(null), "sessions");
    assert.equal(parseSessionViewFrom("session"), "sessions");
  });
});

describe("professorSessionHref", () => {
  it("adds from=case when opened from a case", () => {
    assert.equal(professorSessionHref("abc", "case"), "/professor/sessions/abc?from=case");
  });

  it("omits the query for the sessions list", () => {
    assert.equal(professorSessionHref("abc"), "/professor/sessions/abc");
  });
});

describe("professorSessionBreadcrumbItems", () => {
  it("includes the case when visited from a case page", () => {
    assert.deepEqual(
      professorSessionBreadcrumbItems({
        from: "case",
        currentLabel: "Week 3 lab",
        caseId: "case-1",
        caseTitle: "Colic in a horse",
      }),
      [
        { label: "Home", href: "/dashboard" },
        { label: "Cases", href: "/cases" },
        { label: "Colic in a horse", href: "/cases/case-1" },
        { label: "Week 3 lab" },
      ],
    );
  });

  it("keeps the sessions trail otherwise", () => {
    assert.deepEqual(
      professorSessionBreadcrumbItems({
        from: "sessions",
        currentLabel: "Week 3 lab",
      }),
      [
        { label: "Home", href: "/dashboard" },
        { label: "Case Sessions", href: "/professor/sessions" },
        { label: "Week 3 lab" },
      ],
    );
  });
});
