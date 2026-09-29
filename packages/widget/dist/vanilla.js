"use strict";var X=Object.defineProperty;var xe=Object.getOwnPropertyDescriptor;var me=Object.getOwnPropertyNames;var ye=Object.prototype.hasOwnProperty;var be=(o,e)=>{for(var r in e)X(o,r,{get:e[r],enumerable:!0})},ke=(o,e,r,c)=>{if(e&&typeof e=="object"||typeof e=="function")for(let d of me(e))!ye.call(o,d)&&d!==r&&X(o,d,{get:()=>e[d],enumerable:!(c=xe(e,d))||c.enumerable});return o};var we=o=>ke(X({},"__esModule",{value:!0}),o);var _e={};be(_e,{initOmniDeskWidget:()=>ee});module.exports=we(_e);var D=24e3,ve="wss://agents.assemblyai.com/v1/ws",Ce=`
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${D};
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
`,Te=`
  class PlaybackProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ring = new Float32Array(sampleRate * 30);
      this._writePos = 0;
      this._readPos = 0;
      this._available = 0;
      this._step = ${D} / sampleRate;
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
`;async function ce(o,e,r){let c=URL.createObjectURL(new Blob([e],{type:"application/javascript"}));try{await o.audioWorklet.addModule(c)}finally{URL.revokeObjectURL(c)}return new AudioWorkletNode(o,r)}var J=class{constructor(e){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.isThinking=!1;this.callbacks=e}setThinking(e){this.isThinking!==e&&(this.isThinking=e,this.callbacks.onThinkingChange?.(e))}async start(e,r,c){try{this.callbacks.onStatusChange?.("connecting");let d=window.AudioContext||window.webkitAudioContext;this.captureCtx=new d({sampleRate:D}),this.playbackCtx=new d({sampleRate:D}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await ce(this.playbackCtx,Te,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await ce(this.captureCtx,Ce,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let M=new URL(ve);M.searchParams.set("token",e),this.ws=new WebSocket(M.toString()),this.captureNode.port.onmessage=({data:h})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let t=new Uint8Array(h),w="";for(let v=0;v<t.length;v+=32768)w+=String.fromCharCode.apply(null,Array.from(t.subarray(v,v+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(w)}));let T=new Int16Array(h),S=0;for(let v=0;v<T.length;v+=16)S+=Math.abs(T[v]);this.userLevel=Math.min(1,S/(T.length/16)/8e3)},this.ws.onopen=()=>{let h={};r&&r.trim()?h.agent_id=r.trim():c&&c.trim()&&(h.output={voice:c.trim()}),Object.keys(h).length>0&&this.ws?.send(JSON.stringify({type:"session.update",session:h}))};let m="",C="";this.ws.onmessage=({data:h})=>{try{let t=JSON.parse(h);switch(t.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0,C="",this.setThinking(!1);break;case"transcript.user.delta":t.text&&(C=t.text,this.callbacks.onTranscript?.({who:"user",text:t.text,isFinal:!1}));break;case"transcript.user":t.text&&(C=t.text,this.callbacks.onTranscript?.({who:"user",text:t.text,isFinal:!0}),this.setThinking(!0));break;case"reply.started":m="";break;case"transcript.agent.delta":t.delta&&(this.setThinking(!1),m&&!m.endsWith(" ")&&!/^[.,!?;:%)]/.test(t.delta)?m+=" "+t.delta:m+=t.delta,this.callbacks.onTranscript?.({who:"agent",text:m,isFinal:!1}));break;case"transcript.agent":t.text&&(this.setThinking(!1),m=t.text,this.callbacks.onTranscript?.({who:"agent",text:t.text,isFinal:!0}));break;case"reply.audio":if(t.data&&this.playbackNode){let w=atob(t.data),T=new Uint8Array(w.length);for(let S=0;S<w.length;S++)T[S]=w.charCodeAt(S);this.playbackNode.port.postMessage(T.buffer,[T.buffer]),this.agentLevel=.8}break;case"reply.done":t.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:t.name||t.tool,args:t.arguments||t.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:t.name||t.tool,result:t.result});break;case"session.error":this.setThinking(!1),this.callbacks.onError?.(t.message||t.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.setThinking(!1),this.stop();break}}catch(t){console.warn("Message parsing error:",t)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(d){this.callbacks.onError?.(d.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(e){this.isMuted=e,e&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(e,r){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:e})),r&&this.ws.send(JSON.stringify({type:"reply.create",instructions:r})),!0}catch(c){return console.error("Failed to send message to agent:",c),!1}}sendEmailInput(e){return this.sendUserMessage(`My email address is ${e}`,`The caller entered their verified email address: ${e}. Acknowledge this email, verify it using verify_customer_email if needed, and complete the booking.`)}stop(){if(this.setThinking(!1),this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(e=>e.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let e=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(e)};this.animFrameId=requestAnimationFrame(e)}};var Se={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function ee(o={}){if(typeof window>"u")return;let{host:e,businessId:r="biz_demo_dental",agentId:c,theme:d="light",position:M="bottom-right",label:m="Talk to Receptionist",accent:C="emerald",accentColor:h,businessName:t,greeting:w,onCallStart:T,onCallEnd:S,onTranscript:v}=o,te=h||Se[C]||C||"#10b981",se=document.getElementById("omnidesk-voice-widget-root");se&&se.remove();let E=document.createElement("div");E.id="omnidesk-voice-widget-root",E.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let a=d==="dark"||d==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,_=null,H="idle",A=0,P=null,ie=!1,ne=!1,de=0,pe=0,$=!1,z=null,F=null,I=!1,O=M==="bottom-left",K=document.createElement("div");K.style.cssText=`
    position: fixed; bottom: 20px; ${O?"left: 20px;":"right: 20px;"};
    z-index: 999999;
  `;let U=document.createElement("button");U.style.cssText=`
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${a?"#18181b":"#ffffff"}; color: ${a?"#fafafa":"#09090b"};
    border: 1px solid ${a?"#27272a":"#e4e4e7"};
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `,U.innerHTML=`
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${te};box-shadow:0 0 8px ${te};display:inline-block;"></span>
    <span>${m}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,K.appendChild(U);let V=document.createElement("div");V.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,V.onclick=()=>Z(!1);let n=document.createElement("div");n.style.cssText=`
    position: fixed; bottom: 80px; ${O?"left: 20px;":"right: 20px;"};
    width: 390px; max-width: calc(100vw - 32px); height: 560px; max-height: calc(100vh - 100px);
    background: #ffffff; border: 1px solid #e4e4e7;
    border-radius: 20px; box-shadow: 0 24px 48px -12px rgba(0,0,0,0.22);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  `;let L=document.createElement("div");L.style.cssText=`
    background: ${a?"#18181b":"#ffffff"}; color: ${a?"#ffffff":"#09090b"};
    border-bottom: 1px solid ${a?"#27272a":"#e4e4e7"};
    padding: 13px 18px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; user-select: none; flex-shrink: 0;
  `,L.innerHTML=`
    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
      <div style="color: ${a?"rgba(255,255,255,0.6)":"#71717a"}; display: grid; place-items: center; flex-shrink: 0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle>
        </svg>
      </div>
      <div style="width: 28px; height: 28px; border-radius: 50%; background: ${a?"rgba(255,255,255,0.15)":"#f4f4f5"}; display: grid; place-items: center; flex-shrink: 0; color: ${a?"#ffffff":"#09090b"};">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
        </svg>
      </div>
      <div style="display: flex; flex-direction: column; min-width: 0;">
        <div id="omnidesk-biz-title" style="font-size: 13.5px; font-weight: 600; color: ${a?"#ffffff":"#09090b"}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${t||"OmniDesk Hair Salon & Studio"}
        </div>
        <div style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: ${a?"rgba(255,255,255,0.75)":"#71717a"}; white-space: nowrap;">
          <span id="omnidesk-status-dot" style="width: 6px; height: 6px; border-radius: 50%; background: ${a?"rgba(255,255,255,0.4)":"#a1a1aa"}; display: inline-block;"></span>
          <span id="omnidesk-status-text">Idle \xB7 Ready</span>
        </div>
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 8px;">
      <button id="omnidesk-expand-btn" style="background: ${a?"rgba(255,255,255,0.1)":"#f4f4f5"}; border: 1px solid ${a?"rgba(255,255,255,0.15)":"#e4e4e7"}; border-radius: 7px; color: ${a?"#ffffff":"#52525b"}; width: 30px; height: 30px; cursor: pointer; display: grid; place-items: center;" title="Open Full">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
      </button>
      <button id="omnidesk-close-btn" style="background: ${a?"rgba(255,255,255,0.1)":"#f4f4f5"}; border: 1px solid ${a?"rgba(255,255,255,0.15)":"#e4e4e7"}; border-radius: 7px; color: ${a?"#ffffff":"#52525b"}; width: 30px; height: 30px; cursor: pointer; display: grid; place-items: center;" title="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `;let oe=document.createElement("style");oe.textContent=`
    @keyframes omnidesk-typing-dot {
      0%, 80%, 100% { transform: translateY(0) scale(0.85); opacity: 0.35; }
      40% { transform: translateY(-6px) scale(1.15); opacity: 1; }
    }
    .omnidesk-motion-dot {
      display: inline-block;
      width: 6.5px;
      height: 6.5px;
      border-radius: 50%;
      background-color: currentColor;
      animation: omnidesk-typing-dot 1.25s infinite ease-in-out both;
      will-change: transform, opacity;
    }
    .omnidesk-dot-1 { animation-delay: 0s; }
    .omnidesk-dot-2 { animation-delay: 0.18s; }
    .omnidesk-dot-3 { animation-delay: 0.36s; }
  `,E.appendChild(oe);let y=document.createElement("div");y.style.cssText=`
    flex: 1; min-height: 0; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 12px; background: #ffffff;
  `;let N=document.createElement("div");N.id="omnidesk-placeholder-banner",N.style.cssText=`
    margin: auto; text-align: center; padding: 10px 18px;
    background: #f4f4f5; border: 1px solid #e4e4e7; color: #52525b;
    border-radius: 12px; font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px; align-self: center;
  `,N.innerHTML=`
    <span style="width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block;"></span>
    <span>Start a call to talk to our receptionist</span>
  `,y.appendChild(N);let u=document.createElement("div");u.id="omnidesk-thinking-bubble",u.style.cssText=`
    display: none; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;
  `,u.innerHTML=`
    <div style="display: flex; align-items: flex-start; gap: 8px;">
      <div style="width: 24px; height: 24px; border-radius: 50%; background: #18181b; display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        </svg>
      </div>
      <div style="padding: 10px 14px; border-radius: 14px 14px 14px 2px; font-size: 13px; line-height: 1.45; background: ${a?"#18181b":"#f4f4f5"}; color: ${a?"#a1a1aa":"#71717a"}; border: ${a?"1px solid #27272a":"none"}; boxShadow: 0 1px 2px rgba(0,0,0,0.04); display: inline-flex; align-items: center; gap: 5px; min-height: 38px;" title="Agent is thinking and processing...">
        <span class="omnidesk-motion-dot omnidesk-dot-1"></span>
        <span class="omnidesk-motion-dot omnidesk-dot-2"></span>
        <span class="omnidesk-motion-dot omnidesk-dot-3"></span>
      </div>
    </div>
  `,y.appendChild(u);let l=document.createElement("div");l.id="omnidesk-email-bar",l.style.cssText=`
    padding: 11px 16px; background: #f0fdf4; border-top: 1px solid #bbf7d0;
    display: none; flex-direction: column; gap: 7px; flex-shrink: 0;
  `,l.innerHTML=`
    <div style="display: flex; align-items: center; justify-content: space-between;">
      <span style="font-size: 11px; font-weight: 700; color: #15803d; text-transform: uppercase; letter-spacing: 0.04em; display: inline-flex; align-items: center; gap: 6px;">
        <span style="width: 6px; height: 6px; border-radius: 50%; background: #22c55e; display: inline-block;"></span>
        Email Requested by Agent \u2022 Auto Verification
      </span>
      <button id="omnidesk-email-close-btn" type="button" style="background: none; border: none; color: #15803d; cursor: pointer; font-size: 12px; font-weight: 700; padding: 1px 4px;">\u2715</button>
    </div>
    <form id="omnidesk-email-form" style="display: flex; gap: 8px; margin: 0;">
      <input id="omnidesk-email-input" type="email" placeholder="Enter your real email (e.g. name@gmail.com)" required style="flex: 1; font-size: 12.5px; padding: 7px 11px; border-radius: 7px; border: 1px solid #86efac; background: #ffffff; color: #09090b; outline: none;" />
      <button id="omnidesk-email-submit" type="submit" style="background: #16a34a; color: #ffffff; border: none; padding: 7px 14px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer;">Verify & Send</button>
    </form>
  `;let j=document.createElement("div");j.style.cssText=`
    padding: 12px 16px; border-top: 1px solid #e4e4e7;
    background: #fafafa; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  `;let f=document.createElement("button");f.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: #000000; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s ease;
  `,f.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let Y=document.createElement("div");Y.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let b=document.createElement("span");b.id="omnidesk-timer",b.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,b.innerText="0:00",Y.appendChild(b),j.appendChild(f),j.appendChild(Y),n.appendChild(L),n.appendChild(y),n.appendChild(l),n.appendChild(j),E.appendChild(K),E.appendChild(V),E.appendChild(n),document.body.appendChild(E);function ue(){A=Date.now(),b.innerText="0:00",b.style.background="#000000",b.style.color="#ffffff",P&&clearInterval(P),P=setInterval(()=>{let p=Date.now()-A,x=Math.floor(p/1e3),k=Math.floor(x/60),g=x%60;b.innerText=`${k}:${String(g).padStart(2,"0")}`},250)}function R(){P&&(clearInterval(P),P=null),b.style.background="#f4f4f5",b.style.color="#71717a",b.innerText="0:00"}function ae(p){ie=p,n.style.display=p?"flex":"none"}function Z(p){ne=p,V.style.display=p?"block":"none",p?(n.style.top="50%",n.style.left="50%",n.style.bottom="auto",n.style.right="auto",n.style.transform="translate(-50%, -50%)",n.style.width="calc(100vw - 40px)",n.style.maxWidth="1140px",n.style.height="calc(100vh - 40px)",n.style.maxHeight="900px"):(n.style.top="auto",n.style.left=O?"20px":"auto",n.style.right=O?"auto":"20px",n.style.bottom="80px",n.style.transform="none",n.style.width="390px",n.style.maxWidth="calc(100vw - 32px)",n.style.height="560px",n.style.maxHeight="calc(100vh - 100px)")}U.onclick=()=>ae(!ie),L.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{ae(!1),Z(!1)}),L.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{Z(!ne)});let he=l.querySelector("#omnidesk-email-form"),G=l.querySelector("#omnidesk-email-input");l.querySelector("#omnidesk-email-close-btn").addEventListener("click",()=>{l.style.display="none"}),he.addEventListener("submit",p=>{p.preventDefault();let x=G.value.trim();if(!x||!x.includes("@"))return;_&&_.sendEmailInput(x),$=!0,l.style.display="none",G.value="",N.style.display="none";let k=document.createElement("div");k.style.cssText=`
      display: flex; flex-direction: column; gap: 4px; max-width: 88%;
      align-self: flex-end;
    `;let g=document.createElement("div");g.style.cssText=`
      padding: 10px 14px; border-radius: 14px 14px 2px 14px;
      font-size: 13px; line-height: 1.45;
      background: #18181b; color: #ffffff;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    `,g.innerText=`My email is ${x}`,k.appendChild(g),y.insertBefore(k,u),u.style.display="flex",y.scrollTop=y.scrollHeight,z="user",F=g,I=!0});async function re(){$=!1,l.style.display="none",u.style.display="none",z=null,F=null,I=!1;let p=L.querySelector("#omnidesk-status-text"),x=L.querySelector("#omnidesk-status-dot"),k=f.querySelector("#omnidesk-btn-text");p.innerText="Connecting...",x.style.background="#eab308",k.innerText="Connecting...",f.disabled=!0,ue();try{let g=e;if(!g&&typeof document<"u"){let i=document.querySelector("script[src*='widget.js']");if(i&&i.src&&i.src.startsWith("http"))try{g=new URL(i.src).origin}catch{}}!g&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(g=window.location.origin);let fe=(g||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),Q=await fetch(`${fe}/api/token?businessId=${encodeURIComponent(r)}`);if(!Q.ok)throw new Error(`Failed to get session token (${Q.status})`);let W=await Q.json();if(W.business_name&&!t){let i=L.querySelector("#omnidesk-biz-title");i&&(i.innerText=W.business_name)}let ge=c||W.agent_id||"";_=new J({onStatusChange:i=>{if(H=i,i==="connected")p.innerText="Live \xB7 Speaking",x.style.background="#22c55e",k.innerText="End Voice Call",f.style.background="#dc2626",f.disabled=!1,A=Date.now(),T?.();else if(i==="idle"&&(p.innerText="Idle \xB7 Ready",x.style.background=a?"rgba(255,255,255,0.4)":"#a1a1aa",k.innerText="Start Voice Call",f.style.background="#000000",f.disabled=!1,l.style.display="none",u.style.display="none",R(),A>0)){let s=Math.round((Date.now()-A)/1e3);A=0,S?.(s)}},onThinkingChange:i=>{i&&(u.style.display="flex",y.scrollTop=y.scrollHeight)},onTranscript:i=>{if(N.style.display="none",i.who==="user")i.isFinal&&(u.style.display="flex"),(i.text.includes("@")||i.text.toLowerCase().includes(" at ")&&i.text.toLowerCase().includes(" dot "))&&($=!0,l.style.display="none");else if(i.who==="agent"){i.text&&i.text.trim().length>0&&(u.style.display="none");let s=i.text.toLowerCase();s.includes("what is your email")||s.includes("what's your email")||s.includes("may i have your email")||s.includes("provide your email")||s.includes("can i have your email")||s.includes("could i get your email")||s.includes("could you provide your email")||s.includes("enter your email")||s.includes("spell your email")||s.includes("where can i send your confirmation")||s.includes("where should i send your confirmation")||s.includes("where can i send your calendar invite")||s.includes("where should i send your calendar invite")||s.includes("email")&&(s.includes("what")||s.includes("have")||s.includes("provide")||s.includes("give")||s.includes("tell")||s.includes("share")||s.includes("address"))?($=!1,l.style.display="flex",setTimeout(()=>G.focus(),60)):s.includes("verified your email")||s.includes("thank you for your email")||s.includes("thank you for providing your email")||s.includes("sent a calendar invite")||s.includes("sent your confirmation")||s.includes("confirmation code is")||s.includes("i have sent")?($=!0,l.style.display="none"):$&&(l.style.display="none")}if(z===i.who&&F&&!I)F.innerText=i.text,I=!!i.isFinal;else{let s=document.createElement("div"),B=i.who==="user";s.style.cssText=`
              display: flex; flex-direction: column; gap: 4px; max-width: 88%;
              align-self: ${B?"flex-end":"flex-start"};
            `;let q=document.createElement("div");q.style.cssText=`
              padding: 10px 14px; border-radius: ${B?"14px 14px 2px 14px":"14px 14px 14px 2px"};
              font-size: 13px; line-height: 1.45;
              background: ${B?"#18181b":"#f4f4f5"};
              color: ${B?"#ffffff":"#09090b"};
              box-shadow: 0 1px 2px rgba(0,0,0,0.04);
            `,q.innerText=i.text,s.appendChild(q),y.insertBefore(s,u),z=i.who,F=q,I=!!i.isFinal}y.scrollTop=y.scrollHeight,v?.(i)},onAudioLevel:(i,s)=>{de=i,pe=s},onError:()=>{p.innerText="Error",x.style.background="#ef4444",k.innerText="Start Voice Call",f.style.background="#000000",f.disabled=!1,l.style.display="none",u.style.display="none",R()}}),await _.start(W.token,ge,W.voice)}catch(g){console.error("[OmniDesk Voice Widget Error]:",g),p.innerText="Error",x.style.background="#ef4444",k.innerText="Start Voice Call",f.style.background="#000000",f.disabled=!1,l.style.display="none",u.style.display="none",R()}}function le(){_&&(_.stop(),_=null),H="idle",l.style.display="none",u.style.display="none",R()}return f.onclick=()=>{H==="connected"?le():H==="idle"&&re()},{destroy:()=>{R(),_&&_.stop(),E.remove()},startCall:re,endCall:le}}if(typeof document<"u"){let o=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(o){let e,r=o.src||"";if(r&&r.startsWith("http"))try{e=new URL(r).origin}catch{}let c=o.getAttribute("data-business-id")||void 0,d=o.getAttribute("data-agent")||void 0,M=o.getAttribute("data-theme")||"dark",m=o.getAttribute("data-accent")||"emerald",C=o.getAttribute("data-position")||"bottom-right",h=o.getAttribute("data-label")||void 0,t=o.getAttribute("data-host")||e||"https://omni-desk-rho.vercel.app",w=o.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{ee({businessId:c,agentId:d,theme:M,accent:m,position:C,label:h,host:t,greeting:w})}):ee({businessId:c,agentId:d,theme:M,accent:m,position:C,label:h,host:t,greeting:w})}}0&&(module.exports={initOmniDeskWidget});
//# sourceMappingURL=vanilla.js.map