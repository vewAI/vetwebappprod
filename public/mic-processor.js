/**
 * AudioWorklet processor for microphone capture.
 * Receives Float32 audio at the device's native sample rate,
 * downsamples to 16 kHz, and converts to Int16 PCM.
 *
 * Placed in public/ so Next.js serves it as a static file.
 * Loaded via: audioWorklet.addModule("/mic-processor.js")
 */
class MicProcessor extends AudioWorkletProcessor {
  private targetRate = 16000;
  private resampleRatio: number;
  private buffer: Float32Array;
  private bufferPos = 0;

  constructor() {
    super();
    // sampleRate is the AudioContext sample rate (device native)
    this.resampleRatio = sampleRate / this.targetRate;
    // Buffer enough samples for one output frame at target rate
    this.buffer = new Float32Array(Math.ceil(128 * this.resampleRatio) + 1);
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    const channel = input[0]; // mono
    const inputLen = channel.length;

    // Collect input samples into buffer
    for (let i = 0; i < inputLen; i++) {
      if (this.bufferPos >= this.buffer.length) {
        // Flush and downsample
        this.flushAndDownsample();
        this.bufferPos = 0;
      }
      this.buffer[this.bufferPos++] = channel[i];
    }

    return true;
  }

  private flushAndDownsample(): void {
    const outputLen = Math.floor((this.bufferPos - 1) / this.resampleRatio) + 1;
    const int16 = new Int16Array(outputLen);

    for (let i = 0; i < outputLen; i++) {
      const srcIdx = Math.floor(i * this.resampleRatio);
      const srcIdxNext = Math.min(srcIdx + 1, this.bufferPos - 1);
      const frac = i * this.resampleRatio - srcIdx;

      // Linear interpolation
      const sample = this.buffer[srcIdx] * (1 - frac) + this.buffer[srcIdxNext] * frac;

      // Clamp and convert to int16
      const s = Math.max(-1, Math.min(1, sample));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    this.port.postMessage(int16.buffer, [int16.buffer]);
  }
}

registerProcessor("mic-processor", MicProcessor);
