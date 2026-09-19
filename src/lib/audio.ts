"use client";

export interface AudioVisualizerCallback {
  (userLevel: number, agentLevel: number): void;
}

export interface VoiceSessionCallbacks {
  onStatusChange?: (status: "idle" | "connecting" | "connected" | "error") => void;
  onTranscript?: (event: { who: "user" | "agent"; text: string; isFinal?: boolean }) => void;
  onToolEvent?: (event: { type: "call" | "result"; tool: string; args?: any; result?: any }) => void;
  onError?: (err: string) => void;
  onAudioLevel?: AudioVisualizerCallback;
}

const WIRE_RATE = 24000;
const WS_URL = "wss://agents.assemblyai.com/v1/ws";

// Capture worklet from AssemblyAI official starter: resamples input mic stream to exactly 24kHz PCM16
const CAPTURE_WORKLET = `
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${WIRE_RATE};
      this._pos = 0;
      this._prev = 0;
      this._src = null;
      this._out = null;
    }
    _toPcm(samples, len) {
      const pcm = new Int16Array(len);
      for (let i = 0; i < len; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      return pcm;
    }
    process(inputs) {
      const ch = inputs[0]?.[0];
      if (!ch) return true;
      if (this._ratio === 1) {
        const pcm = this._toPcm(ch, ch.length);
        this.port.postMessage(pcm.buffer, [pcm.buffer]);
        return true;
      }
      const n = ch.length;
      if (!this._src || this._src.length < n + 1) {
        this._src = new Float32Array(n + 1);
        this._out = new Float32Array(Math.ceil((n + 1) / this._ratio) + 2);
      }
      const src = this._src;
      const out = this._out;
      src[0] = this._prev;
      src.set(ch, 1);
      let outLen = 0;
      let pos = this._pos;
      while (pos < n) {
        const i = Math.floor(pos);
        const frac = pos - i;
        out[outLen++] = src[i] + (src[i + 1] - src[i]) * frac;
        pos += this._ratio;
      }
      this._pos = pos - n;
      this._prev = ch[n - 1];
      if (outLen) {
        const pcm = this._toPcm(out, outLen);
        this.port.postMessage(pcm.buffer, [pcm.buffer]);
      }
      return true;
    }
  }
  registerProcessor('capture', CaptureProcessor);
`;

// Playback worklet from AssemblyAI official starter: ring buffer with seamless resampling and instant barge-in cut
const PLAYBACK_WORKLET = `
  class PlaybackProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ring = new Float32Array(sampleRate * 30);
      this._writePos = 0;
      this._readPos = 0;
      this._available = 0;
      this._step = ${WIRE_RATE} / sampleRate;
      this._rsPos = 0;
      this._rsPrev = 0;
      this._drained = false;
      this.port.onmessage = (e) => {
        if (e.data === 'stop') {
          this._writePos = this._readPos = this._available = 0;
          this._rsPos = this._rsPrev = 0;
          return;
        }
        const int16 = new Int16Array(e.data);
        if (!int16.length) return;
        if (this._drained) {
          this._rsPrev = 0;
          this._rsPos = 0;
          this._drained = false;
        }
        if (this._step === 1) {
          for (let i = 0; i < int16.length; i++) this._push(int16[i] / 32768);
          return;
        }
        const n = int16.length;
        let pos = this._rsPos;
        while (pos < n) {
          const i = Math.floor(pos);
          const frac = pos - i;
          const a = i === 0 ? this._rsPrev : int16[i - 1] / 32768;
          const b = int16[i] / 32768;
          this._push(a + (b - a) * frac);
          pos += this._step;
        }
        this._rsPos = pos - n;
        this._rsPrev = int16[n - 1] / 32768;
      };
    }
    _push(v) {
      if (this._available < this._ring.length) {
        this._ring[this._writePos] = v;
        this._writePos = (this._writePos + 1) % this._ring.length;
        this._available++;
      }
    }
    process(inputs, outputs) {
      const output = outputs[0];
      const out = output[0];
      const cap = this._ring.length;
      for (let i = 0; i < out.length; i++) {
        if (this._available > 0) {
          out[i] = this._ring[this._readPos];
          this._readPos = (this._readPos + 1) % cap;
          this._available--;
        } else {
          out[i] = 0;
          this._drained = true;
        }
      }
      for (let ch = 1; ch < output.length; ch++) output[ch].set(out);
      return true;
    }
  }
  registerProcessor('playback', PlaybackProcessor);
`;

async function addWorklet(ctx: AudioContext, code: string, name: string): Promise<AudioWorkletNode> {
  const url = URL.createObjectURL(new Blob([code], { type: "application/javascript" }));
  try {
    await ctx.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  return new AudioWorkletNode(ctx, name);
}

export class AssemblyAIVoiceClient {
  private ws: WebSocket | null = null;
  private captureCtx: AudioContext | null = null;
  private playbackCtx: AudioContext | null = null;
  private playbackNode: AudioWorkletNode | null = null;
  private captureNode: AudioWorkletNode | null = null;
  private micStream: MediaStream | null = null;
  private isConnected = false;
  private callbacks: VoiceSessionCallbacks;
  private userLevel = 0;
  private agentLevel = 0;
  private animFrameId: number | null = null;

  constructor(callbacks: VoiceSessionCallbacks) {
    this.callbacks = callbacks;
  }

  async start(token: string, agentId: string) {
    try {
      this.callbacks.onStatusChange?.("connecting");

      // Audio contexts at WIRE_RATE
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.captureCtx = new AudioCtxClass({ sampleRate: WIRE_RATE });
      this.playbackCtx = new AudioCtxClass({ sampleRate: WIRE_RATE });
      await Promise.all([this.captureCtx.resume(), this.playbackCtx.resume()]);

      // Add playback worklet ring buffer
      this.playbackNode = await addWorklet(this.playbackCtx, PLAYBACK_WORKLET, "playback");
      this.playbackNode.connect(this.playbackCtx.destination);

      // Microphone stream
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });

      // Capture worklet
      this.captureNode = await addWorklet(this.captureCtx, CAPTURE_WORKLET, "capture");
      this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);

      // WebSocket to AssemblyAI
      const wsUrl = new URL(WS_URL);
      wsUrl.searchParams.set("token", token);
      this.ws = new WebSocket(wsUrl.toString());

      this.captureNode.port.onmessage = ({ data }) => {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const bytes = new Uint8Array(data);
        let binary = "";
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
        }
        this.ws.send(JSON.stringify({ type: "input.audio", audio: btoa(binary) }));

        // Visualizer level
        const int16 = new Int16Array(data);
        let sum = 0;
        for (let i = 0; i < int16.length; i += 16) {
          sum += Math.abs(int16[i]);
        }
        this.userLevel = Math.min(1, sum / (int16.length / 16) / 8000);
      };

      this.ws.onopen = () => {
        if (agentId && agentId.trim()) {
          this.ws?.send(
            JSON.stringify({
              type: "session.update",
              session: { agent_id: agentId.trim() },
            })
          );
        }
      };

      this.ws.onmessage = ({ data }) => {
        try {
          const msg = JSON.parse(data);
          switch (msg.type) {
            case "session.ready":
              this.isConnected = true;
              this.callbacks.onStatusChange?.("connected");
              break;

            case "input.speech.started":
              // Instantaneous barge-in cut
              this.playbackNode?.port.postMessage("stop");
              this.agentLevel = 0;
              break;

            case "transcript.user":
              if (msg.text) {
                this.callbacks.onTranscript?.({ who: "user", text: msg.text, isFinal: true });
              }
              break;

            case "transcript.agent":
              if (msg.text) {
                this.callbacks.onTranscript?.({ who: "agent", text: msg.text, isFinal: true });
              }
              break;

            case "reply.audio":
              if (msg.data && this.playbackNode) {
                const raw = atob(msg.data);
                const bytes = new Uint8Array(raw.length);
                for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
                this.playbackNode.port.postMessage(bytes.buffer, [bytes.buffer]);
                this.agentLevel = 0.8;
              }
              break;

            case "reply.done":
              if (msg.status === "interrupted") {
                this.playbackNode?.port.postMessage("stop");
                this.agentLevel = 0;
              }
              break;

            case "session.error":
              this.callbacks.onError?.(msg.message || msg.code || "Session error");
              this.callbacks.onStatusChange?.("error");
              break;

            case "session.ended":
              this.stop();
              break;
          }
        } catch (e) {
          console.warn("Message parsing error:", e);
        }
      };

      this.ws.onerror = () => {
        this.callbacks.onError?.("WebSocket connection error");
        this.callbacks.onStatusChange?.("error");
      };

      this.ws.onclose = () => {
        this.stop();
      };

      this.startVisualizerLoop();
    } catch (err: any) {
      this.stop();
      this.callbacks.onError?.(err.message || "Failed to start call");
      this.callbacks.onStatusChange?.("error");
    }
  }

  private startVisualizerLoop() {
    const loop = () => {
      this.callbacks.onAudioLevel?.(this.userLevel, this.agentLevel);
      this.userLevel = Math.max(0, this.userLevel - 0.05);
      this.agentLevel = Math.max(0, this.agentLevel - 0.04);
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  sendUserMessage(text: string, instructions?: string): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    try {
      this.ws.send(
        JSON.stringify({
          type: "conversation.message",
          role: "user",
          content: text,
        })
      );
      if (instructions) {
        this.ws.send(
          JSON.stringify({
            type: "reply.create",
            instructions,
          })
        );
      }
      return true;
    } catch (e) {
      console.error("Failed to send message to agent:", e);
      return false;
    }
  }

  sendEmailInput(email: string): boolean {
    return this.sendUserMessage(
      `My email address is ${email}`,
      `The caller entered their verified email address: ${email}. Acknowledge this email, verify it using verify_customer_email if needed, and complete the booking.`
    );
  }

  stop() {
    this.isConnected = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.playbackNode) {
      try {
        this.playbackNode.port.postMessage("stop");
        this.playbackNode.disconnect();
      } catch (_) {}
      this.playbackNode = null;
    }

    if (this.captureNode) {
      try {
        this.captureNode.disconnect();
      } catch (_) {}
      this.captureNode = null;
    }

    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: "session.end" }));
        } catch (_) {}
      }
      try {
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }

    if (this.captureCtx && this.captureCtx.state !== "closed") {
      try {
        this.captureCtx.close();
      } catch (_) {}
      this.captureCtx = null;
    }

    if (this.playbackCtx && this.playbackCtx.state !== "closed") {
      try {
        this.playbackCtx.close();
      } catch (_) {}
      this.playbackCtx = null;
    }

    this.callbacks.onStatusChange?.("idle");
  }
}
