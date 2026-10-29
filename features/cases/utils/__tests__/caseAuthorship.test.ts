import { describe, expect, it } from "vitest";
import { getCaseCreatorUserId, prepareCaseSettings } from "../caseAuthorship";

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
