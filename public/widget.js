"use strict";var OmniDeskVoice=(()=>{var oe=Object.defineProperty;var Ce=Object.getOwnPropertyDescriptor;var Te=Object.getOwnPropertyNames;var Se=Object.prototype.hasOwnProperty;var Ee=(l,s)=>{for(var u in s)oe(l,u,{get:s[u],enumerable:!0})},Me=(l,s,u,x)=>{if(s&&typeof s=="object"||typeof s=="function")for(let g of Te(s))!Se.call(l,g)&&g!==u&&oe(l,g,{get:()=>s[g],enumerable:!(x=Ce(s,g))||x.enumerable});return l};var _e=l=>Me(oe({},"__esModule",{value:!0}),l);var Ne={};Ee(Ne,{initOmniDeskWidget:()=>ae});var Q=24e3,Le="wss://agents.assemblyai.com/v1/ws",$e=`
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${Q};
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
`,Ae=`
  class PlaybackProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ring = new Float32Array(sampleRate * 30);
      this._writePos = 0;
      this._readPos = 0;
      this._available = 0;
      this._step = ${Q} / sampleRate;
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
`;async function xe(l,s,u){let x=URL.createObjectURL(new Blob([s],{type:"application/javascript"}));try{await l.audioWorklet.addModule(x)}finally{URL.revokeObjectURL(x)}return new AudioWorkletNode(l,u)}var X=class{constructor(s){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.isThinking=!1;this.callbacks=s}setThinking(s){this.isThinking!==s&&(this.isThinking=s,this.callbacks.onThinkingChange?.(s))}async start(s,u,x){try{this.callbacks.onStatusChange?.("connecting");let g=window.AudioContext||window.webkitAudioContext;this.captureCtx=new g({sampleRate:Q}),this.playbackCtx=new g({sampleRate:Q}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await xe(this.playbackCtx,Ae,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0}}),this.captureNode=await xe(this.captureCtx,$e,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let N=new URL(Le);N.searchParams.set("token",s),this.ws=new WebSocket(N.toString()),this.captureNode.port.onmessage=({data:y})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let i=new Uint8Array(y),v="";for(let S=0;S<i.length;S+=32768)v+=String.fromCharCode.apply(null,Array.from(i.subarray(S,S+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(v)}));let _=new Int16Array(y),L=0;for(let S=0;S<_.length;S+=16)L+=Math.abs(_[S]);this.userLevel=Math.min(1,L/(_.length/16)/8e3)},this.ws.onopen=()=>{let y={};u&&u.trim()?y.agent_id=u.trim():x&&x.trim()&&(y.output={voice:x.trim()}),Object.keys(y).length>0&&this.ws?.send(JSON.stringify({type:"session.update",session:y}))};let w="",M="";this.ws.onmessage=({data:y})=>{try{let i=JSON.parse(y);switch(i.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0,M="",this.setThinking(!1);break;case"transcript.user.delta":i.text&&(M=i.text,this.callbacks.onTranscript?.({who:"user",text:i.text,isFinal:!1}));break;case"transcript.user":i.text&&(M=i.text,this.callbacks.onTranscript?.({who:"user",text:i.text,isFinal:!0}),this.setThinking(!0));break;case"reply.started":w="";break;case"transcript.agent.delta":i.delta&&(this.setThinking(!1),w&&!w.endsWith(" ")&&!/^[.,!?;:%)]/.test(i.delta)?w+=" "+i.delta:w+=i.delta,this.callbacks.onTranscript?.({who:"agent",text:w,isFinal:!1}));break;case"transcript.agent":i.text&&(this.setThinking(!1),w=i.text,this.callbacks.onTranscript?.({who:"agent",text:i.text,isFinal:!0}));break;case"reply.audio":if(i.data&&this.playbackNode){let v=atob(i.data),_=new Uint8Array(v.length);for(let L=0;L<v.length;L++)_[L]=v.charCodeAt(L);this.playbackNode.port.postMessage(_.buffer,[_.buffer]),this.agentLevel=.8}break;case"reply.done":i.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:i.name||i.tool,args:i.arguments||i.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:i.name||i.tool,result:i.result});break;case"session.error":this.setThinking(!1),this.callbacks.onError?.(i.message||i.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.setThinking(!1),this.stop();break}}catch(i){console.warn("Message parsing error:",i)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(g){this.callbacks.onError?.(g.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(s){this.isMuted=s,s&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(s,u){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:s})),u&&this.ws.send(JSON.stringify({type:"reply.create",instructions:u})),!0}catch(x){return console.error("Failed to send message to agent:",x),!1}}sendEmailInput(s){return this.sendUserMessage(`My email address is ${s}`,`The caller entered their email address: ${s}. Call verify_customer_email to validate it, then ask the caller: "I have verified your email as ${s}. Can you please confirm with yes or no?" Do not book until they confirm with yes. If they say no, ask for their email again.`)}stop(){if(this.setThinking(!1),this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(s=>s.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let s=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(s)};this.animFrameId=requestAnimationFrame(s)}};var Pe={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function ae(l={}){if(typeof window>"u")return;let{host:s,businessId:u="biz_demo_dental",agentId:x,theme:g="light",position:N="bottom-right",label:w="Talk to Receptionist",accent:M="emerald",accentColor:y,businessName:i,greeting:v,onCallStart:_,onCallEnd:L,onTranscript:S}=l,c=y||Pe[M]||M||"#10b981",re=document.getElementById("omnidesk-voice-widget-root");re&&re.remove();let A=document.createElement("div");A.id="omnidesk-voice-widget-root",A.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let t=g==="dark"||g==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,$=null,O="idle",R=0,W=null,le=!1,de=!1,ge=0,me=0,ye=!1,D=!1,P=!1,U=null,I=null,z=!1,J=N==="bottom-left",ee=document.createElement("div");ee.style.cssText=`
    position: fixed; bottom: 20px; ${J?"left: 20px;":"right: 20px;"};
    z-index: 999999;
  `;let Y=document.createElement("button");Y.style.cssText=`
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${t?"#18181b":"#ffffff"}; color: ${t?"#fafafa":"#09090b"};
    border: 1px solid ${t?"#27272a":"#e4e4e7"};
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `,Y.innerHTML=`
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${c};box-shadow:0 0 8px ${c};display:inline-block;"></span>
    <span>${w}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,ee.appendChild(Y);let Z=document.createElement("div");Z.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,Z.onclick=()=>se(!1);let o=document.createElement("div");o.style.cssText=`
    position: fixed; bottom: 80px; ${J?"left: 20px;":"right: 20px;"};
    width: 390px; max-width: calc(100vw - 32px); height: 560px; max-height: calc(100vh - 100px);
    background: ${t?"#09090b":"#ffffff"}; border: 1px solid ${t?"#27272a":"#e4e4e7"};
    border-radius: 20px; box-shadow: 0 24px 48px -12px rgba(0,0,0,0.22);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  `;let E=document.createElement("div");E.style.cssText=`
    background: ${t?"#18181b":"#ffffff"}; color: ${t?"#ffffff":"#09090b"};
    border-bottom: 1px solid ${t?"#27272a":"#e4e4e7"};
    padding: 13px 18px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; user-select: none; flex-shrink: 0;
  `,E.innerHTML=`
    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
      <div style="color: ${t?"rgba(255,255,255,0.6)":"#71717a"}; display: grid; place-items: center; flex-shrink: 0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle>
        </svg>
      </div>
      <div style="width: 28px; height: 28px; border-radius: 50%; background: ${t?"rgba(255,255,255,0.15)":c==="#18181b"?"rgba(24,24,27,0.08)":`${c}18`}; display: grid; place-items: center; flex-shrink: 0; color: ${t?"#ffffff":c==="#18181b"?"#09090b":c};">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
        </svg>
      </div>
      <div style="display: flex; flex-direction: column; min-width: 0;">
        <div id="omnidesk-biz-title" style="font-size: 13.5px; font-weight: 600; color: ${t?"#ffffff":"#09090b"}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${i||"OmniDesk Hair Salon & Studio"}
        </div>
        <div style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: ${t?"rgba(255,255,255,0.75)":"#71717a"}; white-space: nowrap;">
          <span id="omnidesk-status-dot" style="width: 6px; height: 6px; border-radius: 50%; background: ${t?"rgba(255,255,255,0.4)":"#a1a1aa"}; display: inline-block;"></span>
          <span id="omnidesk-status-text">Idle \xB7 Ready</span>
        </div>
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 8px;">
      <button id="omnidesk-expand-btn" style="background: ${t?"rgba(255,255,255,0.1)":"#f4f4f5"}; border: 1px solid ${t?"rgba(255,255,255,0.15)":"#e4e4e7"}; border-radius: 7px; color: ${t?"#ffffff":"#52525b"}; width: 30px; height: 30px; cursor: pointer; display: grid; place-items: center;" title="Open Full">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
      </button>
      <button id="omnidesk-close-btn" style="background: ${t?"rgba(255,255,255,0.1)":"#f4f4f5"}; border: 1px solid ${t?"rgba(255,255,255,0.15)":"#e4e4e7"}; border-radius: 7px; color: ${t?"#ffffff":"#52525b"}; width: 30px; height: 30px; cursor: pointer; display: grid; place-items: center;" title="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `;let ce=document.createElement("style");ce.textContent=`
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
  `,A.appendChild(ce);let b=document.createElement("div");b.style.cssText=`
    flex: 1; min-height: 0; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 12px; background: ${t?"#09090b":"#ffffff"};
  `;let B=document.createElement("div");B.id="omnidesk-placeholder-banner",B.style.cssText=`
    margin: auto; text-align: center; padding: 10px 18px;
    background: ${t?"#18181b":"#f4f4f5"}; border: 1px solid ${t?"#27272a":"#e4e4e7"}; color: ${t?"#a1a1aa":"#52525b"};
    border-radius: 12px; font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px; align-self: center;
  `,B.innerHTML=`
    <span id="omnidesk-placeholder-dot" style="width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block;"></span>
    <span>Start a call to talk to our receptionist</span>
  `,b.appendChild(B);let m=document.createElement("div");if(m.id="omnidesk-thinking-bubble",m.style.cssText=`
    display: none; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;
  `,m.innerHTML=`
    <div style="display: flex; align-items: flex-start; gap: 8px;">
      <div style="width: 24px; height: 24px; border-radius: 50%; background: #18181b; display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        </svg>
      </div>
      <div style="padding: 10px 14px; border-radius: 14px 14px 14px 2px; font-size: 13px; line-height: 1.45; background: ${t?"#18181b":"#f4f4f5"}; color: ${t?"#a1a1aa":"#71717a"}; border: ${t?"1px solid #27272a":"none"}; boxShadow: 0 1px 2px rgba(0,0,0,0.04); display: inline-flex; align-items: center; gap: 5px; min-height: 38px;" title="Agent is thinking and processing...">
        <span class="omnidesk-motion-dot omnidesk-dot-1"></span>
        <span class="omnidesk-motion-dot omnidesk-dot-2"></span>
        <span class="omnidesk-motion-dot omnidesk-dot-3"></span>
      </div>
    </div>
  `,b.appendChild(m),v){B.style.display="none";let a=document.createElement("div");a.style.cssText="display: flex; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;";let r=document.createElement("div");r.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let f=document.createElement("div");f.style.cssText="width: 24px; height: 24px; border-radius: 50%; background: #18181b; display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;",f.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let h=document.createElement("div");h.style.cssText=`padding: 10px 14px; border-radius: 14px 14px 14px 2px; font-size: 13px; line-height: 1.45; background: ${t?"#18181b":"#f4f4f5"}; color: ${t?"#fafafa":"#09090b"}; border: ${t?"1px solid #27272a":"none"}; box-shadow: 0 1px 2px rgba(0,0,0,0.04);`,h.innerText=v,r.appendChild(f),r.appendChild(h),a.appendChild(r),b.insertBefore(a,m),U="agent",I=h,z=!0}let p=document.createElement("div");p.id="omnidesk-email-bar",p.style.cssText=`
    padding: 11px 16px; background: #f0fdf4; border-top: 1px solid #bbf7d0;
    display: none; flex-direction: column; gap: 7px; flex-shrink: 0;
  `,p.innerHTML=`
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
  `;let K=document.createElement("div");K.style.cssText=`
    padding: 12px 16px; border-top: 1px solid ${t?"#27272a":"#e4e4e7"};
    background: ${t?"#121214":"#fafafa"}; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  `;let d=document.createElement("button");d.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: ${c}; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    box-shadow: 0 4px 14px ${c}40;
    cursor: pointer; transition: all 0.15s ease;
  `,d.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let G=document.createElement("div");G.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let T=document.createElement("div");T.id="omnidesk-waveform",T.style.cssText="display: none; align-items: center; gap: 2.5px; height: 14px;";let pe=[12,8,14,6,10],te=[];pe.forEach(a=>{let r=document.createElement("span");r.style.cssText=`width: 2.5px; height: ${Math.round(a*.35)}px; background: ${c}; border-radius: 1px; transition: height 0.12s ease;`,T.appendChild(r),te.push(r)}),G.appendChild(T);let k=document.createElement("span");k.id="omnidesk-timer",k.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,k.innerText="0:00",G.appendChild(k),K.appendChild(d),K.appendChild(G),o.appendChild(E),o.appendChild(b),o.appendChild(p),o.appendChild(K),A.appendChild(ee),A.appendChild(Z),A.appendChild(o),document.body.appendChild(A);function be(){R=Date.now(),k.innerText="0:00",k.style.background=t?"#18181b":"#000000",k.style.color="#ffffff",k.style.border=t?"1px solid #27272a":"none",W&&clearInterval(W),W=setInterval(()=>{let a=Date.now()-R,r=Math.floor(a/1e3),f=Math.floor(r/60),h=r%60;k.innerText=`${f}:${String(h).padStart(2,"0")}`},250)}function j(){W&&(clearInterval(W),W=null),k.style.background="#f4f4f5",k.style.color="#71717a",k.style.border="none",k.innerText="0:00",T.style.display="none"}function ue(a){le=a,o.style.display=a?"flex":"none"}function se(a){de=a,Z.style.display=a?"block":"none",a?(o.style.top="50%",o.style.left="50%",o.style.bottom="auto",o.style.right="auto",o.style.transform="translate(-50%, -50%)",o.style.width="calc(100vw - 40px)",o.style.maxWidth="1140px",o.style.height="calc(100vh - 40px)",o.style.maxHeight="900px"):(o.style.top="auto",o.style.left=J?"20px":"auto",o.style.right=J?"auto":"20px",o.style.bottom="80px",o.style.transform="none",o.style.width="390px",o.style.maxWidth="calc(100vw - 32px)",o.style.height="560px",o.style.maxHeight="calc(100vh - 100px)")}Y.onclick=()=>ue(!le),E.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{ue(!1),se(!1)}),E.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{se(!de)});let ke=p.querySelector("#omnidesk-email-form"),ie=p.querySelector("#omnidesk-email-input");p.querySelector("#omnidesk-email-close-btn").addEventListener("click",()=>{p.style.display="none"}),ke.addEventListener("submit",a=>{a.preventDefault();let r=ie.value.trim();if(!r||!r.includes("@"))return;$&&$.sendEmailInput(r),P=!0,p.style.display="none",ie.value="",B.style.display="none";let f=document.createElement("div");f.style.cssText=`
      display: flex; flex-direction: column; gap: 4px; max-width: 88%;
      align-self: flex-end;
    `;let h=document.createElement("div");h.style.cssText=`
      padding: 10px 14px; border-radius: 14px 14px 2px 14px;
      font-size: 13px; line-height: 1.45;
      background: ${c}; color: #ffffff;
      box-shadow: 0 2px 8px ${c}35;
    `,h.innerText=`My email is ${r}`,f.appendChild(h),b.insertBefore(f,m),m.style.display="flex",b.scrollTop=b.scrollHeight,U="user",I=h,z=!0});async function he(){ye=!1,D=!1,P=!1,p.style.display="none",m.style.display="none",U=null,I=null,z=!1;let a=E.querySelector("#omnidesk-status-text"),r=E.querySelector("#omnidesk-status-dot"),f=d.querySelector("#omnidesk-btn-text");a.innerText="Connecting...",r.style.background="#eab308",f.innerText="Connecting...",d.style.background="#64748b",d.style.boxShadow="none",d.disabled=!0,be();try{let h=s;if(!h&&typeof document<"u"){let n=document.querySelector("script[src*='widget.js']");if(n&&n.src&&n.src.startsWith("http"))try{h=new URL(n.src).origin}catch{}}!h&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(h=window.location.origin);let we=(h||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),ne=await fetch(`${we}/api/token?businessId=${encodeURIComponent(u)}`);if(!ne.ok)throw new Error(`Failed to get session token (${ne.status})`);let q=await ne.json();if(q.business_name&&!i){let n=E.querySelector("#omnidesk-biz-title");n&&(n.innerText=q.business_name)}let ve=x||q.agent_id||"";$=new X({onStatusChange:n=>{if(O=n,n==="connected")a.innerText="Live \xB7 Speaking",r.style.background="#22c55e",f.innerText="End Voice Call",d.style.background="#dc2626",d.style.boxShadow="0 4px 14px rgba(220, 38, 38, 0.35)",d.disabled=!1,T.style.display="flex",R=Date.now(),_?.();else if(n==="idle"&&(a.innerText="Idle \xB7 Ready",r.style.background=t?"rgba(255,255,255,0.4)":"#a1a1aa",f.innerText="Start Voice Call",d.style.background=c,d.style.boxShadow=`0 4px 14px ${c}40`,d.disabled=!1,T.style.display="none",p.style.display="none",m.style.display="none",j(),R>0)){let e=Math.round((Date.now()-R)/1e3);R=0,L?.(e)}},onThinkingChange:n=>{n&&(m.style.display="flex",b.scrollTop=b.scrollHeight)},onTranscript:n=>{if(B.style.display="none",n.who==="user"){n.isFinal&&(m.style.display="flex");let e=n.text.toLowerCase();(e==="no"||e.startsWith("no ")||e.includes("no,")||e.includes("wrong")||e.includes("incorrect")||e.includes("change my email")||e.includes("different email"))&&(P=!1),(n.text.includes("@")||e.includes(" at ")&&e.includes(" dot ")||e.includes("gmail.com")||e.includes("yahoo.com")||e.includes("outlook.com")||e.includes("hotmail.com")||e.includes("icloud.com"))&&(p.style.display="none",P=!0)}else if(n.who==="agent"){n.text&&n.text.trim().length>0&&(m.style.display="none");let e=n.text.toLowerCase();if(e.includes("confirmation code is")||e.includes("booking is confirmed")||e.includes("scheduled your appointment")||e.includes("all set, your appointment")||e.includes("sent your confirmation")&&(e.includes("code")||e.includes("calendar invite"))||e.includes("sent a calendar invite")&&(e.includes("code")||e.includes("all set"))){D=!0,P=!1,p.style.display="none";return}if(D){p.style.display="none";return}if(e.includes("confirm with yes or no")||e.includes("yes or no")||e.includes("is that correct")||e.includes("is that right")){P=!0,p.style.display="none";return}e.includes("what is your email")||e.includes("what's your email")||e.includes("may i have your email")||e.includes("can i have your email")||e.includes("could i get your email")||e.includes("could you provide your email")||e.includes("provide your email")||e.includes("enter your email")||e.includes("spell your email")||e.includes("share your email")||e.includes("need your email")||e.includes("what email")||e.includes("which email")||e.includes("where can i send your confirmation")||e.includes("where should i send your confirmation")||e.includes("where can i send your calendar")||e.includes("where should i send your calendar")||e.includes("email")&&(e.includes("what is")||e.includes("what's")||e.includes("may i have")||e.includes("can i have")||e.includes("provide")||e.includes("give me")||e.includes("tell me")||e.includes("send your calendar invite")||e.includes("send your confirmation"))?(P=!1,p.style.display="flex",setTimeout(()=>ie.focus(),60)):p.style.display="none"}if(U===n.who&&I&&!z)I.innerText=n.text,z=!!n.isFinal;else{let e=n.who==="user",F=document.createElement("div");if(F.style.cssText=`
              display: flex; flex-direction: column; gap: 4px; max-width: 88%;
              align-self: ${e?"flex-end":"flex-start"};
            `,e){let C=document.createElement("div");C.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 2px 14px;
                font-size: 13px; line-height: 1.45;
                background: ${c};
                color: #ffffff;
                box-shadow: 0 2px 8px ${c}35;
              `,C.innerText=n.text,F.appendChild(C),I=C}else{let C=document.createElement("div");C.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let H=document.createElement("div");H.style.cssText=`
                width: 24px; height: 24px; border-radius: 50%; background: #18181b;
                display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;
              `,H.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let V=document.createElement("div");V.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 14px 2px;
                font-size: 13px; line-height: 1.45;
                background: ${t?"#18181b":"#f4f4f5"};
                color: ${t?"#fafafa":"#09090b"};
                border: ${t?"1px solid #27272a":"none"};
                box-shadow: 0 1px 2px rgba(0,0,0,0.04);
              `,V.innerText=n.text,C.appendChild(H),C.appendChild(V),F.appendChild(C),I=V}b.insertBefore(F,m),U=n.who,z=!!n.isFinal}b.scrollTop=b.scrollHeight,S?.(n)},onAudioLevel:(n,e)=>{if(ge=n,me=e,O==="connected"){T.style.display="flex";let F=Math.max(n,e);pe.forEach((C,H)=>{let V=Math.max(4,Math.min(14,Math.round(C*(.35+F*1.5))));te[H]&&(te[H].style.height=`${V}px`)})}},onError:()=>{a.innerText="Error",r.style.background="#ef4444",f.innerText="Start Voice Call",d.style.background=c,d.style.boxShadow=`0 4px 14px ${c}40`,d.disabled=!1,T.style.display="none",p.style.display="none",m.style.display="none",j()}}),await $.start(q.token,ve,q.voice)}catch(h){console.error("[OmniDesk Voice Widget Error]:",h),a.innerText="Error",r.style.background="#ef4444",f.innerText="Start Voice Call",d.style.background=c,d.style.boxShadow=`0 4px 14px ${c}40`,d.disabled=!1,T.style.display="none",p.style.display="none",m.style.display="none",j()}}function fe(){$&&($.stop(),$=null),O="idle";let a=E.querySelector("#omnidesk-status-text"),r=E.querySelector("#omnidesk-status-dot"),f=d.querySelector("#omnidesk-btn-text");a&&(a.innerText="Idle \xB7 Ready"),r&&(r.style.background=t?"rgba(255,255,255,0.4)":"#a1a1aa"),f&&(f.innerText="Start Voice Call"),d.style.background=c,d.style.boxShadow=`0 4px 14px ${c}40`,d.disabled=!1,T.style.display="none",p.style.display="none",m.style.display="none",D=!1,P=!1,j()}return d.onclick=()=>{O==="connected"?fe():O==="idle"&&he()},{destroy:()=>{j(),$&&$.stop(),A.remove()},startCall:he,endCall:fe}}if(typeof document<"u"){let l=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(l){let s,u=l.src||"";if(u&&u.startsWith("http"))try{s=new URL(u).origin}catch{}let x=l.getAttribute("data-business-id")||void 0,g=l.getAttribute("data-agent")||void 0,N=l.getAttribute("data-theme")||"dark",w=l.getAttribute("data-accent")||"emerald",M=l.getAttribute("data-position")||"bottom-right",y=l.getAttribute("data-label")||void 0,i=l.getAttribute("data-host")||s||"https://omni-desk-rho.vercel.app",v=l.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{ae({businessId:x,agentId:g,theme:N,accent:w,position:M,label:y,host:i,greeting:v})}):ae({businessId:x,agentId:g,theme:N,accent:w,position:M,label:y,host:i,greeting:v})}}return _e(Ne);})();
