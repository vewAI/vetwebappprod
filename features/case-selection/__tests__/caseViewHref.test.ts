import assert from "assert";
import { describe, it } from "vitest";
import { caseAttemptHref, caseHref, professorCaseHref, studentCaseHref } from "../caseViewHref";

describe("caseViewHref", () => {
  it("puts the professor case page under /cases", () => {
    assert.equal(professorCaseHref("case-1"), "/cases/case-1");
    assert.equal(caseHref("case-1", true), "/cases/case-1");
  });

  it("puts the student case page under Start", () => {
    assert.equal(studentCaseHref("case-1"), "/start/case/case-1");
    assert.equal(caseHref("case-1", false), "/start/case/case-1");
  });

  it("puts live attempts under /live", () => {
    assert.equal(caseAttemptHref("case-1"), "/live/case-1");
    assert.equal(
      caseAttemptHref("case-1", { attempt: "a1", session: "s1" }),
      "/live/case-1?attempt=a1&session=s1",
    );
  });
});
