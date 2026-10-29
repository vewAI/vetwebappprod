import { describe, expect, it } from "vitest";
import { getCaseAuthorDetails, getCaseCreatorUserId, moveCaseAuthorFields, prepareCaseSettings } from "../caseAuthorship";

const creator = "11111111-1111-4111-8111-111111111111";
const editor = "22222222-2222-4222-8222-222222222222";

describe("case creator attribution", () => {
  it("records the authenticated creator when a new case is saved", () => {
    expect(prepareCaseSettings({ archived: false, createdByUserId: editor }, null, creator, true)).toEqual({
      archived: false,
      createdByUserId: creator,
    });
  });

  it("preserves the original creator when someone edits the case", () => {
    expect(prepareCaseSettings({ createdByUserId: editor, archived: true }, { createdByUserId: creator }, editor, false)).toEqual({
      archived: true,
      createdByUserId: creator,
    });
  });

  it("does not mislabel an older case when its creator is unknown", () => {
    const settings = prepareCaseSettings({ createdByUserId: editor }, { archived: false }, editor, false);
    expect(getCaseCreatorUserId(settings)).toBeNull();
  });
});

describe("clinical case author and institution", () => {
  it("stores author credit separately from the creator account", () => {
    const body = moveCaseAuthorFields({ author_name: " Marco Duz ", author_institution: " University of Nottingham ", title: "Case" });
    expect(body).toEqual({
      title: "Case",
      settings: { authorName: "Marco Duz", institutionName: "University of Nottingham" },
    });
    expect(getCaseAuthorDetails(body.settings)).toEqual({ authorName: "Marco Duz", institutionName: "University of Nottingham" });
  });

  it("reads only explicit source attribution in older cases", () => {
    expect(getCaseAuthorDetails({}, "Author: Marco Duz\nInstitution: University of Nottingham\nPatient: horse")).toEqual({
      authorName: "Marco Duz", institutionName: "University of Nottingham",
    });
    expect(getCaseAuthorDetails({}, "Author\n\nDate / version\n\nClinical reviewer\n\nMarco Duz\n\n2026\n\nPending").authorName).toBe("Marco Duz");
    expect(getCaseAuthorDetails({}, "Author\n\nDate / version\n\nClinical reviewer\n\n[Enter]\n\n2026\n\nPending").authorName).toBe("");
    expect(getCaseAuthorDetails({}, "1.1  Author name and institution\n\nMarco Duz; University of Nottingham.\n\n1.2 Case title")).toEqual({
      authorName: "Marco Duz", institutionName: "University of Nottingham.",
    });
  });
});
