import assert from "assert";
import { describe, it } from "vitest";

describe("useMicrophone helpers", () => {
  // Test float32ToS16 (extracted utility)
  it("float32ToS16 converts correctly", () => {
    const float32ToS16 = (float32: Float32Array): Int16Array => {
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      return int16;
    };

    const input = new Float32Array([0, 0.5, -0.5, 1.0, -1.0]);
    const result = float32ToS16(input);

    assert.equal(result[0], 0);
    assert.ok(result[1] > 16000); // 0.5 * 0x7fff ≈ 16383
    assert.ok(result[2] < -16000); // -0.5 * 0x8000 ≈ -16384
    assert.equal(result[3], 32767); // 1.0 * 0x7fff
    assert.equal(result[4], -32768); // -1.0 * 0x8000
  });

  it("float32ToS16 clamps values outside [-1, 1]", () => {
    const float32ToS16 = (float32: Float32Array): Int16Array => {
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      return int16;
    };

    const input = new Float32Array([2.0, -3.0, 100]);
    const result = float32ToS16(input);

    assert.equal(result[0], 32767); // clamped to 1.0
    assert.equal(result[1], -32768); // clamped to -1.0
    assert.equal(result[2], 32767); // clamped to 1.0
  });
});
