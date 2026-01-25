import assert from "assert";
import { NURSE_ACK } from "../components/chat-interface";

test("Nurse ack phrase is correct", () => {
  assert.equal(NURSE_ACK, "Let me check that Doc...");
});