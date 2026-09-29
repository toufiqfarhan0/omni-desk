var D=24e3,ge="wss://agents.assemblyai.com/v1/ws",xe=`
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
`,me=`
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
`;async function re(r,i,d){let f=URL.createObjectURL(new Blob([i],{type:"application/javascript"}));try{await r.audioWorklet.addModule(f)}finally{URL.revokeObjectURL(f)}return new AudioWorkletNode(r,d)}var J=class{constructor(i){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.isThinking=!1;this.callbacks=i}setThinking(i){this.isThinking!==i&&(this.isThinking=i,this.callbacks.onThinkingChange?.(i))}async start(i,d,f){try{this.callbacks.onStatusChange?.("connecting");let k=window.AudioContext||window.webkitAudioContext;this.captureCtx=new k({sampleRate:D}),this.playbackCtx=new k({sampleRate:D}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await re(this.playbackCtx,me,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await re(this.captureCtx,xe,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let M=new URL(ge);M.searchParams.set("token",i),this.ws=new WebSocket(M.toString()),this.captureNode.port.onmessage=({data:p})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let e=new Uint8Array(p),w="";for(let v=0;v<e.length;v+=32768)w+=String.fromCharCode.apply(null,Array.from(e.subarray(v,v+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(w)}));let T=new Int16Array(p),S=0;for(let v=0;v<T.length;v+=16)S+=Math.abs(T[v]);this.userLevel=Math.min(1,S/(T.length/16)/8e3)},this.ws.onopen=()=>{let p={};d&&d.trim()?p.agent_id=d.trim():f&&f.trim()&&(p.output={voice:f.trim()}),Object.keys(p).length>0&&this.ws?.send(JSON.stringify({type:"session.update",session:p}))};let x="",C="";this.ws.onmessage=({data:p})=>{try{let e=JSON.parse(p);switch(e.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0,C="",this.setThinking(!1);break;case"transcript.user.delta":e.text&&(C=e.text,this.callbacks.onTranscript?.({who:"user",text:e.text,isFinal:!1}));break;case"transcript.user":e.text&&(C=e.text,this.callbacks.onTranscript?.({who:"user",text:e.text,isFinal:!0}),this.setThinking(!0));break;case"reply.started":x="";break;case"transcript.agent.delta":e.delta&&(this.setThinking(!1),x&&!x.endsWith(" ")&&!/^[.,!?;:%)]/.test(e.delta)?x+=" "+e.delta:x+=e.delta,this.callbacks.onTranscript?.({who:"agent",text:x,isFinal:!1}));break;case"transcript.agent":e.text&&(this.setThinking(!1),x=e.text,this.callbacks.onTranscript?.({who:"agent",text:e.text,isFinal:!0}));break;case"reply.audio":if(e.data&&this.playbackNode){let w=atob(e.data),T=new Uint8Array(w.length);for(let S=0;S<w.length;S++)T[S]=w.charCodeAt(S);this.playbackNode.port.postMessage(T.buffer,[T.buffer]),this.agentLevel=.8}break;case"reply.done":e.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:e.name||e.tool,args:e.arguments||e.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:e.name||e.tool,result:e.result});break;case"session.error":this.setThinking(!1),this.callbacks.onError?.(e.message||e.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.setThinking(!1),this.stop();break}}catch(e){console.warn("Message parsing error:",e)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(k){this.callbacks.onError?.(k.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(i){this.isMuted=i,i&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(i,d){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:i})),d&&this.ws.send(JSON.stringify({type:"reply.create",instructions:d})),!0}catch(f){return console.error("Failed to send message to agent:",f),!1}}sendEmailInput(i){return this.sendUserMessage(`My email address is ${i}`,`The caller entered their verified email address: ${i}. Acknowledge this email, verify it using verify_customer_email if needed, and complete the booking.`)}stop(){if(this.setThinking(!1),this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(i=>i.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let i=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(i)};this.animFrameId=requestAnimationFrame(i)}};var ye={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function le(r={}){if(typeof window>"u")return;let{host:i,businessId:d="biz_demo_dental",agentId:f,theme:k="light",position:M="bottom-right",label:x="Talk to Receptionist",accent:C="emerald",accentColor:p,businessName:e,greeting:w,onCallStart:T,onCallEnd:S,onTranscript:v}=r,X=p||ye[C]||C||"#10b981",ee=document.getElementById("omnidesk-voice-widget-root");ee&&ee.remove();let E=document.createElement("div");E.id="omnidesk-voice-widget-root",E.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let o=k==="dark"||k==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,_=null,H="idle",A=0,P=null,te=!1,se=!1,ce=0,de=0,$=!1,z=null,F=null,I=!1,O=M==="bottom-left",K=document.createElement("div");K.style.cssText=`
    position: fixed; bottom: 20px; ${O?"left: 20px;":"right: 20px;"};
    z-index: 999999;
  `;let U=document.createElement("button");U.style.cssText=`
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${o?"#18181b":"#ffffff"}; color: ${o?"#fafafa":"#09090b"};
    border: 1px solid ${o?"#27272a":"#e4e4e7"};
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `,U.innerHTML=`
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${X};box-shadow:0 0 8px ${X};display:inline-block;"></span>
    <span>${x}</span>
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
    background: ${o?"#18181b":"#ffffff"}; color: ${o?"#ffffff":"#09090b"};
    border-bottom: 1px solid ${o?"#27272a":"#e4e4e7"};
    padding: 13px 18px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; user-select: none; flex-shrink: 0;
  `,L.innerHTML=`
    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
      <div style="color: ${o?"rgba(255,255,255,0.6)":"#71717a"}; display: grid; place-items: center; flex-shrink: 0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle>
        </svg>
      </div>
      <div style="width: 28px; height: 28px; border-radius: 50%; background: ${o?"rgba(255,255,255,0.15)":"#f4f4f5"}; display: grid; place-items: center; flex-shrink: 0; color: ${o?"#ffffff":"#09090b"};">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
        </svg>
      </div>
      <div style="display: flex; flex-direction: column; min-width: 0;">
        <div id="omnidesk-biz-title" style="font-size: 13.5px; font-weight: 600; color: ${o?"#ffffff":"#09090b"}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${e||"OmniDesk Hair Salon & Studio"}
        </div>
        <div style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: ${o?"rgba(255,255,255,0.75)":"#71717a"}; white-space: nowrap;">
          <span id="omnidesk-status-dot" style="width: 6px; height: 6px; border-radius: 50%; background: ${o?"rgba(255,255,255,0.4)":"#a1a1aa"}; display: inline-block;"></span>
          <span id="omnidesk-status-text">Idle \xB7 Ready</span>
        </div>
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 8px;">
      <button id="omnidesk-expand-btn" style="background: ${o?"rgba(255,255,255,0.1)":"#f4f4f5"}; border: 1px solid ${o?"rgba(255,255,255,0.15)":"#e4e4e7"}; border-radius: 7px; color: ${o?"#ffffff":"#52525b"}; width: 30px; height: 30px; cursor: pointer; display: grid; place-items: center;" title="Open Full">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
      </button>
      <button id="omnidesk-close-btn" style="background: ${o?"rgba(255,255,255,0.1)":"#f4f4f5"}; border: 1px solid ${o?"rgba(255,255,255,0.15)":"#e4e4e7"}; border-radius: 7px; color: ${o?"#ffffff":"#52525b"}; width: 30px; height: 30px; cursor: pointer; display: grid; place-items: center;" title="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `;let ie=document.createElement("style");ie.textContent=`
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
  `,E.appendChild(ie);let m=document.createElement("div");m.style.cssText=`
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
  `,m.appendChild(N);let c=document.createElement("div");c.id="omnidesk-thinking-bubble",c.style.cssText=`
    display: none; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;
  `,c.innerHTML=`
    <div style="display: flex; align-items: flex-start; gap: 8px;">
      <div style="width: 24px; height: 24px; border-radius: 50%; background: #18181b; display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        </svg>
      </div>
      <div style="padding: 10px 14px; border-radius: 14px 14px 14px 2px; font-size: 13px; line-height: 1.45; background: ${o?"#18181b":"#f4f4f5"}; color: ${o?"#a1a1aa":"#71717a"}; border: ${o?"1px solid #27272a":"none"}; boxShadow: 0 1px 2px rgba(0,0,0,0.04); display: inline-flex; align-items: center; gap: 5px; min-height: 38px;" title="Agent is thinking and processing...">
        <span class="omnidesk-motion-dot omnidesk-dot-1"></span>
        <span class="omnidesk-motion-dot omnidesk-dot-2"></span>
        <span class="omnidesk-motion-dot omnidesk-dot-3"></span>
      </div>
    </div>
  `,m.appendChild(c);let a=document.createElement("div");a.id="omnidesk-email-bar",a.style.cssText=`
    padding: 11px 16px; background: #f0fdf4; border-top: 1px solid #bbf7d0;
    display: none; flex-direction: column; gap: 7px; flex-shrink: 0;
  `,a.innerHTML=`
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
  `;let u=document.createElement("button");u.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: #000000; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s ease;
  `,u.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let Y=document.createElement("div");Y.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let y=document.createElement("span");y.id="omnidesk-timer",y.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,y.innerText="0:00",Y.appendChild(y),j.appendChild(u),j.appendChild(Y),n.appendChild(L),n.appendChild(m),n.appendChild(a),n.appendChild(j),E.appendChild(K),E.appendChild(V),E.appendChild(n),document.body.appendChild(E);function pe(){A=Date.now(),y.innerText="0:00",y.style.background="#000000",y.style.color="#ffffff",P&&clearInterval(P),P=setInterval(()=>{let l=Date.now()-A,g=Math.floor(l/1e3),b=Math.floor(g/60),h=g%60;y.innerText=`${b}:${String(h).padStart(2,"0")}`},250)}function R(){P&&(clearInterval(P),P=null),y.style.background="#f4f4f5",y.style.color="#71717a",y.innerText="0:00"}function ne(l){te=l,n.style.display=l?"flex":"none"}function Z(l){se=l,V.style.display=l?"block":"none",l?(n.style.top="50%",n.style.left="50%",n.style.bottom="auto",n.style.right="auto",n.style.transform="translate(-50%, -50%)",n.style.width="calc(100vw - 40px)",n.style.maxWidth="1140px",n.style.height="calc(100vh - 40px)",n.style.maxHeight="900px"):(n.style.top="auto",n.style.left=O?"20px":"auto",n.style.right=O?"auto":"20px",n.style.bottom="80px",n.style.transform="none",n.style.width="390px",n.style.maxWidth="calc(100vw - 32px)",n.style.height="560px",n.style.maxHeight="calc(100vh - 100px)")}U.onclick=()=>ne(!te),L.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{ne(!1),Z(!1)}),L.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{Z(!se)});let ue=a.querySelector("#omnidesk-email-form"),G=a.querySelector("#omnidesk-email-input");a.querySelector("#omnidesk-email-close-btn").addEventListener("click",()=>{a.style.display="none"}),ue.addEventListener("submit",l=>{l.preventDefault();let g=G.value.trim();if(!g||!g.includes("@"))return;_&&_.sendEmailInput(g),$=!0,a.style.display="none",G.value="",N.style.display="none";let b=document.createElement("div");b.style.cssText=`
      display: flex; flex-direction: column; gap: 4px; max-width: 88%;
      align-self: flex-end;
    `;let h=document.createElement("div");h.style.cssText=`
      padding: 10px 14px; border-radius: 14px 14px 2px 14px;
      font-size: 13px; line-height: 1.45;
      background: #18181b; color: #ffffff;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    `,h.innerText=`My email is ${g}`,b.appendChild(h),m.insertBefore(b,c),c.style.display="flex",m.scrollTop=m.scrollHeight,z="user",F=h,I=!0});async function oe(){$=!1,a.style.display="none",c.style.display="none",z=null,F=null,I=!1;let l=L.querySelector("#omnidesk-status-text"),g=L.querySelector("#omnidesk-status-dot"),b=u.querySelector("#omnidesk-btn-text");l.innerText="Connecting...",g.style.background="#eab308",b.innerText="Connecting...",u.disabled=!0,pe();try{let h=i;if(!h&&typeof document<"u"){let s=document.querySelector("script[src*='widget.js']");if(s&&s.src&&s.src.startsWith("http"))try{h=new URL(s.src).origin}catch{}}!h&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(h=window.location.origin);let he=(h||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),Q=await fetch(`${he}/api/token?businessId=${encodeURIComponent(d)}`);if(!Q.ok)throw new Error(`Failed to get session token (${Q.status})`);let W=await Q.json();if(W.business_name&&!e){let s=L.querySelector("#omnidesk-biz-title");s&&(s.innerText=W.business_name)}let fe=f||W.agent_id||"";_=new J({onStatusChange:s=>{if(H=s,s==="connected")l.innerText="Live \xB7 Speaking",g.style.background="#22c55e",b.innerText="End Voice Call",u.style.background="#dc2626",u.disabled=!1,A=Date.now(),T?.();else if(s==="idle"&&(l.innerText="Idle \xB7 Ready",g.style.background=o?"rgba(255,255,255,0.4)":"#a1a1aa",b.innerText="Start Voice Call",u.style.background="#000000",u.disabled=!1,a.style.display="none",c.style.display="none",R(),A>0)){let t=Math.round((Date.now()-A)/1e3);A=0,S?.(t)}},onThinkingChange:s=>{s&&(c.style.display="flex",m.scrollTop=m.scrollHeight)},onTranscript:s=>{if(N.style.display="none",s.who==="user")s.isFinal&&(c.style.display="flex"),(s.text.includes("@")||s.text.toLowerCase().includes(" at ")&&s.text.toLowerCase().includes(" dot "))&&($=!0,a.style.display="none");else if(s.who==="agent"){s.text&&s.text.trim().length>0&&(c.style.display="none");let t=s.text.toLowerCase();t.includes("what is your email")||t.includes("what's your email")||t.includes("may i have your email")||t.includes("provide your email")||t.includes("can i have your email")||t.includes("could i get your email")||t.includes("could you provide your email")||t.includes("enter your email")||t.includes("spell your email")||t.includes("where can i send your confirmation")||t.includes("where should i send your confirmation")||t.includes("where can i send your calendar invite")||t.includes("where should i send your calendar invite")||t.includes("email")&&(t.includes("what")||t.includes("have")||t.includes("provide")||t.includes("give")||t.includes("tell")||t.includes("share")||t.includes("address"))?($=!1,a.style.display="flex",setTimeout(()=>G.focus(),60)):t.includes("verified your email")||t.includes("thank you for your email")||t.includes("thank you for providing your email")||t.includes("sent a calendar invite")||t.includes("sent your confirmation")||t.includes("confirmation code is")||t.includes("i have sent")?($=!0,a.style.display="none"):$&&(a.style.display="none")}if(z===s.who&&F&&!I)F.innerText=s.text,I=!!s.isFinal;else{let t=document.createElement("div"),B=s.who==="user";t.style.cssText=`
              display: flex; flex-direction: column; gap: 4px; max-width: 88%;
              align-self: ${B?"flex-end":"flex-start"};
            `;let q=document.createElement("div");q.style.cssText=`
              padding: 10px 14px; border-radius: ${B?"14px 14px 2px 14px":"14px 14px 14px 2px"};
              font-size: 13px; line-height: 1.45;
              background: ${B?"#18181b":"#f4f4f5"};
              color: ${B?"#ffffff":"#09090b"};
              box-shadow: 0 1px 2px rgba(0,0,0,0.04);
            `,q.innerText=s.text,t.appendChild(q),m.insertBefore(t,c),z=s.who,F=q,I=!!s.isFinal}m.scrollTop=m.scrollHeight,v?.(s)},onAudioLevel:(s,t)=>{ce=s,de=t},onError:()=>{l.innerText="Error",g.style.background="#ef4444",b.innerText="Start Voice Call",u.style.background="#000000",u.disabled=!1,a.style.display="none",c.style.display="none",R()}}),await _.start(W.token,fe,W.voice)}catch(h){console.error("[OmniDesk Voice Widget Error]:",h),l.innerText="Error",g.style.background="#ef4444",b.innerText="Start Voice Call",u.style.background="#000000",u.disabled=!1,a.style.display="none",c.style.display="none",R()}}function ae(){_&&(_.stop(),_=null),H="idle",a.style.display="none",c.style.display="none",R()}return u.onclick=()=>{H==="connected"?ae():H==="idle"&&oe()},{destroy:()=>{R(),_&&_.stop(),E.remove()},startCall:oe,endCall:ae}}if(typeof document<"u"){let r=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(r){let i,d=r.src||"";if(d&&d.startsWith("http"))try{i=new URL(d).origin}catch{}let f=r.getAttribute("data-business-id")||void 0,k=r.getAttribute("data-agent")||void 0,M=r.getAttribute("data-theme")||"dark",x=r.getAttribute("data-accent")||"emerald",C=r.getAttribute("data-position")||"bottom-right",p=r.getAttribute("data-label")||void 0,e=r.getAttribute("data-host")||i||"https://omni-desk-rho.vercel.app",w=r.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{le({businessId:f,agentId:k,theme:M,accent:x,position:C,label:p,host:e,greeting:w})}):le({businessId:f,agentId:k,theme:M,accent:x,position:C,label:p,host:e,greeting:w})}}export{le as initOmniDeskWidget};
//# sourceMappingURL=vanilla.mjs.map