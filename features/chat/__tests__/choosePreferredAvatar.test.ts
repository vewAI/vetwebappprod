import test from "node:test";
import assert from "node:assert";
import { choosePreferredAvatar } from "@/features/chat/utils/avatar";

const sampleProfiles = [
  { roleKey: "owner", displayName: "Pet Owner" },
  { roleKey: "veterinary-nurse", displayName: "Martin Lambert", assetUrl: "https://example.com/martin.jpg" },
  { roleKey: "assistant", displayName: "Virtual Assistant" },
];

test("prefers exact name match (Martin Lambert)", () => {
  const pick = choosePreferredAvatar(sampleProfiles, "Martin Lambert");
  assert.strictEqual(pick?.displayName, "Martin Lambert");
});

test("prefers nurse role when name not present", () => {
  const list = [
    { roleKey: "owner", displayName: "Owner" },
    { roleKey: "veterinary-nurse", displayName: "Nurse A" },
  ];
  const pick = choosePreferredAvatar(list);
  assert.strictEqual(pick?.roleKey, "veterinary-nurse");
});

test("falls back to assistant role if present", () => {
  const list = [
    { roleKey: "owner", displayName: "Owner" },
    { roleKey: "assistant", displayName: "Assistant" },
  ];
  const pick = choosePreferredAvatar(list);
  assert.strictEqual(pick?.roleKey, "assistant");
});

test("falls back to first profile if none match", () => {
  const list = [{ roleKey: "owner", displayName: "Owner" }, { roleKey: "lab", displayName: "Lab" }];
  const pick = choosePreferredAvatar(list);
  assert.strictEqual(pick, list[0]);
});
