"use strict";var OmniDeskVoice=(()=>{var ae=Object.defineProperty;var Te=Object.getOwnPropertyDescriptor;var Ce=Object.getOwnPropertyNames;var Se=Object.prototype.hasOwnProperty;var Ee=(d,s)=>{for(var u in s)ae(d,u,{get:s[u],enumerable:!0})},Me=(d,s,u,x)=>{if(s&&typeof s=="object"||typeof s=="function")for(let y of Ce(s))!Se.call(d,y)&&y!==u&&ae(d,y,{get:()=>s[y],enumerable:!(x=Te(s,y))||x.enumerable});return d};var _e=d=>Me(ae({},"__esModule",{value:!0}),d);var Ne={};Ee(Ne,{initOmniDeskWidget:()=>re});var ee=24e3,Le="wss://agents.us.assemblyai.com/v1/ws",$e=`
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${ee};
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
      this._step = ${ee} / sampleRate;
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
`;async function xe(d,s,u){let x=URL.createObjectURL(new Blob([s],{type:"application/javascript"}));try{await d.audioWorklet.addModule(x)}finally{URL.revokeObjectURL(x)}return new AudioWorkletNode(d,u)}var te=class{constructor(s){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.isThinking=!1;this.callbacks=s}setThinking(s){this.isThinking!==s&&(this.isThinking=s,this.callbacks.onThinkingChange?.(s))}async start(s,u,x,y){try{this.callbacks.onStatusChange?.("connecting");let M=window.AudioContext||window.webkitAudioContext;this.captureCtx=new M({sampleRate:ee}),this.playbackCtx=new M({sampleRate:ee}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await xe(this.playbackCtx,Ae,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0}}),this.captureNode=await xe(this.captureCtx,$e,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let W=y&&y.trim()||Le,A=new URL(W);A.searchParams.set("token",s),this.ws=new WebSocket(A.toString()),this.captureNode.port.onmessage=({data:m})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let i=new Uint8Array(m),P="";for(let T=0;T<i.length;T+=32768)P+=String.fromCharCode.apply(null,Array.from(i.subarray(T,T+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(P)}));let L=new Int16Array(m),o=0;for(let T=0;T<L.length;T+=16)o+=Math.abs(L[T]);this.userLevel=Math.min(1,o/(L.length/16)/8e3)},this.ws.onopen=()=>{let m={};u&&u.trim()?m.agent_id=u.trim():x&&x.trim()&&(m.output={voice:x.trim()}),Object.keys(m).length>0&&this.ws?.send(JSON.stringify({type:"session.update",session:m}))};let v="",_="";this.ws.onmessage=({data:m})=>{try{let i=JSON.parse(m);switch(i.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0,_="",this.setThinking(!1);break;case"transcript.user.delta":i.text&&(_=i.text,this.callbacks.onTranscript?.({who:"user",text:i.text,isFinal:!1}));break;case"transcript.user":i.text&&(_=i.text,this.callbacks.onTranscript?.({who:"user",text:i.text,isFinal:!0}),this.setThinking(!0));break;case"reply.started":v="";break;case"transcript.agent.delta":i.delta&&(this.setThinking(!1),v&&!v.endsWith(" ")&&!/^[.,!?;:%)]/.test(i.delta)?v+=" "+i.delta:v+=i.delta,this.callbacks.onTranscript?.({who:"agent",text:v,isFinal:!1}));break;case"transcript.agent":i.text&&(this.setThinking(!1),v=i.text,this.callbacks.onTranscript?.({who:"agent",text:i.text,isFinal:!0}));break;case"reply.audio":if(i.data&&this.playbackNode){let P=atob(i.data),L=new Uint8Array(P.length);for(let o=0;o<P.length;o++)L[o]=P.charCodeAt(o);this.playbackNode.port.postMessage(L.buffer,[L.buffer]),this.agentLevel=.8}break;case"reply.done":i.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:i.name||i.tool,args:i.arguments||i.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:i.name||i.tool,result:i.result});break;case"reply.error":this.setThinking(!1),this.callbacks.onError?.(i.message||i.code||"Reply generation error");break;case"error":case"session.error":this.setThinking(!1),this.callbacks.onError?.(i.message||i.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.setThinking(!1),this.stop();break}}catch(i){console.warn("Message parsing error:",i)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(M){this.callbacks.onError?.(M.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(s){this.isMuted=s,s&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(s,u){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:s})),u&&this.ws.send(JSON.stringify({type:"reply.create",instructions:u})),!0}catch(x){return console.error("Failed to send message to agent:",x),!1}}sendEmailInput(s){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:`My email is ${s}`})),this.ws.send(JSON.stringify({type:"reply.create",instructions:`The caller has entered and verified their email address: ${s}. Do not ask for their email again. Immediately speak: "I have verified your email as ${s}. Can you please confirm with yes or no?" Then stop speaking and wait for their yes or no answer.`})),!0}catch(u){return console.error("Failed to send email to agent:",u),!1}}stop(){if(this.setThinking(!1),this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(s=>s.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let s=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(s)};this.animFrameId=requestAnimationFrame(s)}};var Pe={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function re(d={}){if(typeof window>"u")return;let{host:s,businessId:u="biz_demo_dental",agentId:x,theme:y="light",position:M="bottom-right",label:W="Talk to Receptionist",accent:A="emerald",accentColor:v,businessName:_,greeting:m,onCallStart:i,onCallEnd:P,onTranscript:L}=d,o=v||Pe[A]||A||"#10b981",T=document.getElementById("omnidesk-voice-widget-root");T&&T.remove();let N=document.createElement("div");N.id="omnidesk-voice-widget-root",N.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let t=y==="dark"||y==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,$=null,j="idle",R=0,z=null,le=!1,de=!1,ge=0,me=0,ye=!1,J=!1,S=!1,q=null,I=null,O=!1,Y=M==="bottom-left",se=document.createElement("div");se.style.cssText=`
    position: fixed; bottom: 20px; ${Y?"left: 20px;":"right: 20px;"};
    z-index: 999999;
  `;let Z=document.createElement("button");Z.style.cssText=`
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${t?"#18181b":"#ffffff"}; color: ${t?"#fafafa":"#09090b"};
    border: 1px solid ${t?"#27272a":"#e4e4e7"};
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `,Z.innerHTML=`
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${o};box-shadow:0 0 8px ${o};display:inline-block;"></span>
    <span>${W}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,se.appendChild(Z);let K=document.createElement("div");K.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,K.onclick=()=>ne(!1);let a=document.createElement("div");a.style.cssText=`
    position: fixed; bottom: 80px; ${Y?"left: 20px;":"right: 20px;"};
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
      <div style="width: 28px; height: 28px; border-radius: 50%; background: ${t?"rgba(255,255,255,0.15)":o==="#18181b"?"rgba(24,24,27,0.08)":`${o}18`}; display: grid; place-items: center; flex-shrink: 0; color: ${t?"#ffffff":o==="#18181b"?"#09090b":o};">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
        </svg>
      </div>
      <div style="display: flex; flex-direction: column; min-width: 0;">
        <div id="omnidesk-biz-title" style="font-size: 13.5px; font-weight: 600; color: ${t?"#ffffff":"#09090b"}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${_||"OmniDesk Hair Salon & Studio"}
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
  `,N.appendChild(ce);let b=document.createElement("div");b.style.cssText=`
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
  `,b.appendChild(B);let g=document.createElement("div");if(g.id="omnidesk-thinking-bubble",g.style.cssText=`
    display: none; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;
  `,g.innerHTML=`
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
  `,b.appendChild(g),m){B.style.display="none";let r=document.createElement("div");r.style.cssText="display: flex; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;";let l=document.createElement("div");l.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let f=document.createElement("div");f.style.cssText="width: 24px; height: 24px; border-radius: 50%; background: #18181b; display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;",f.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let h=document.createElement("div");h.style.cssText=`padding: 10px 14px; border-radius: 14px 14px 14px 2px; font-size: 13px; line-height: 1.45; background: ${t?"#18181b":"#f4f4f5"}; color: ${t?"#fafafa":"#09090b"}; border: ${t?"1px solid #27272a":"none"}; box-shadow: 0 1px 2px rgba(0,0,0,0.04);`,h.innerText=m,l.appendChild(f),l.appendChild(h),r.appendChild(l),b.insertBefore(r,g),q="agent",I=h,O=!0}let p=document.createElement("div");p.id="omnidesk-email-bar",p.style.cssText=`
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
  `;let G=document.createElement("div");G.style.cssText=`
    padding: 12px 16px; border-top: 1px solid ${t?"#27272a":"#e4e4e7"};
    background: ${t?"#121214":"#fafafa"}; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  `;let c=document.createElement("button");c.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: ${o}; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    box-shadow: 0 4px 14px ${o}40;
    cursor: pointer; transition: all 0.15s ease;
  `,c.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let Q=document.createElement("div");Q.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let C=document.createElement("div");C.id="omnidesk-waveform",C.style.cssText="display: none; align-items: center; gap: 2.5px; height: 14px;";let pe=[12,8,14,6,10],ie=[];pe.forEach(r=>{let l=document.createElement("span");l.style.cssText=`width: 2.5px; height: ${Math.round(r*.35)}px; background: ${o}; border-radius: 1px; transition: height 0.12s ease;`,C.appendChild(l),ie.push(l)}),Q.appendChild(C);let k=document.createElement("span");k.id="omnidesk-timer",k.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,k.innerText="0:00",Q.appendChild(k),G.appendChild(c),G.appendChild(Q),a.appendChild(E),a.appendChild(b),a.appendChild(p),a.appendChild(G),N.appendChild(se),N.appendChild(K),N.appendChild(a),document.body.appendChild(N);function be(){R=Date.now(),k.innerText="0:00",k.style.background=t?"#18181b":"#000000",k.style.color="#ffffff",k.style.border=t?"1px solid #27272a":"none",z&&clearInterval(z),z=setInterval(()=>{let r=Date.now()-R,l=Math.floor(r/1e3),f=Math.floor(l/60),h=l%60;k.innerText=`${f}:${String(h).padStart(2,"0")}`},250)}function D(){z&&(clearInterval(z),z=null),k.style.background="#f4f4f5",k.style.color="#71717a",k.style.border="none",k.innerText="0:00",C.style.display="none"}function ue(r){le=r,a.style.display=r?"flex":"none"}function ne(r){de=r,K.style.display=r?"block":"none",r?(a.style.top="50%",a.style.left="50%",a.style.bottom="auto",a.style.right="auto",a.style.transform="translate(-50%, -50%)",a.style.width="calc(100vw - 40px)",a.style.maxWidth="1140px",a.style.height="calc(100vh - 40px)",a.style.maxHeight="900px"):(a.style.top="auto",a.style.left=Y?"20px":"auto",a.style.right=Y?"auto":"20px",a.style.bottom="80px",a.style.transform="none",a.style.width="390px",a.style.maxWidth="calc(100vw - 32px)",a.style.height="560px",a.style.maxHeight="calc(100vh - 100px)")}Z.onclick=()=>ue(!le),E.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{ue(!1),ne(!1)}),E.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{ne(!de)});let ke=p.querySelector("#omnidesk-email-form"),X=p.querySelector("#omnidesk-email-input");p.querySelector("#omnidesk-email-close-btn").addEventListener("click",()=>{p.style.display="none"}),ke.addEventListener("submit",r=>{r.preventDefault();let l=X.value.trim();if(!l||!l.includes("@"))return;$&&$.sendEmailInput(l),S=!0,p.style.display="none",X.value="",B.style.display="none";let f=document.createElement("div");f.style.cssText=`
      display: flex; flex-direction: column; gap: 4px; max-width: 88%;
      align-self: flex-end;
    `;let h=document.createElement("div");h.style.cssText=`
      padding: 10px 14px; border-radius: 14px 14px 2px 14px;
      font-size: 13px; line-height: 1.45;
      background: ${o}; color: #ffffff;
      box-shadow: 0 2px 8px ${o}35;
    `,h.innerText=`My email is ${l}`,f.appendChild(h),b.insertBefore(f,g),g.style.display="flex",b.scrollTop=b.scrollHeight,q="user",I=h,O=!0});async function he(){ye=!1,J=!1,S=!1,p.style.display="none",g.style.display="none",q=null,I=null,O=!1;let r=E.querySelector("#omnidesk-status-text"),l=E.querySelector("#omnidesk-status-dot"),f=c.querySelector("#omnidesk-btn-text");r.innerText="Connecting...",l.style.background="#eab308",f.innerText="Connecting...",c.style.background="#64748b",c.style.boxShadow="none",c.disabled=!0,be();try{let h=s;if(!h&&typeof document<"u"){let n=document.querySelector("script[src*='widget.js']");if(n&&n.src&&n.src.startsWith("http"))try{h=new URL(n.src).origin}catch{}}!h&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(h=window.location.origin);let we=(h||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),oe=await fetch(`${we}/api/token?businessId=${encodeURIComponent(u)}`);if(!oe.ok)throw new Error(`Failed to get session token (${oe.status})`);let V=await oe.json();if(V.business_name&&!_){let n=E.querySelector("#omnidesk-biz-title");n&&(n.innerText=V.business_name)}let ve=x||V.agent_id||"";$=new te({onStatusChange:n=>{if(j=n,n==="connected")r.innerText="Live \xB7 Speaking",l.style.background="#22c55e",f.innerText="End Voice Call",c.style.background="#dc2626",c.style.boxShadow="0 4px 14px rgba(220, 38, 38, 0.35)",c.disabled=!1,C.style.display="flex",R=Date.now(),i?.();else if(n==="idle"&&(r.innerText="Idle \xB7 Ready",l.style.background=t?"rgba(255,255,255,0.4)":"#a1a1aa",f.innerText="Start Voice Call",c.style.background=o,c.style.boxShadow=`0 4px 14px ${o}40`,c.disabled=!1,C.style.display="none",p.style.display="none",g.style.display="none",D(),R>0)){let e=Math.round((Date.now()-R)/1e3);R=0,P?.(e)}},onThinkingChange:n=>{n&&(g.style.display="flex",b.scrollTop=b.scrollHeight)},onTranscript:n=>{if(B.style.display="none",n.who==="user"){n.isFinal&&(g.style.display="flex");let e=n.text.toLowerCase().trim();(e==="no"||e.startsWith("no ")||e.includes("no,")||e.includes("wrong")||e.includes("incorrect")||e.includes("change my email")||e.includes("different email")||e.includes("that's not right")||e.includes("thats not right")||e.includes("not right")||e.includes("not my email"))&&(S=!1,p.style.display="flex",setTimeout(()=>X.focus(),60)),(e==="yes"||e.startsWith("yes ")||e.includes("yes,")||e==="yeah"||e.startsWith("yeah ")||e==="yep"||e==="correct"||e.includes("that's right")||e.includes("thats right")||e.includes("sounds good")||e==="confirm"||e==="sure")&&S&&(S=!1,p.style.display="none"),(n.text.includes("@")||e.includes(" at ")&&e.includes(" dot ")||e.includes("gmail.com")||e.includes("yahoo.com")||e.includes("outlook.com")||e.includes("hotmail.com")||e.includes("icloud.com"))&&(p.style.display="none",S=!0)}else if(n.who==="agent"){n.text&&n.text.trim().length>0&&(g.style.display="none");let e=n.text.toLowerCase();if(e.includes("confirmation code is")||e.includes("booking is confirmed")||e.includes("scheduled your appointment")||e.includes("all set, your appointment")||e.includes("sent your confirmation")&&(e.includes("code")||e.includes("calendar invite"))||e.includes("sent a calendar invite")&&(e.includes("code")||e.includes("all set"))){J=!0,S=!1,p.style.display="none";return}if(J){p.style.display="none";return}if(e.includes("confirm with yes or no")||e.includes("yes or no")||e.includes("is that correct")||e.includes("is that right")||e.includes("verified your email")||e.includes("checking that email")||e.includes("let me check that email")){S=!0,p.style.display="none";return}!S&&(e.includes("what is your email")||e.includes("what's your email")||e.includes("whats your email")||e.includes("may i have your email")||e.includes("can i have your email")||e.includes("could i have your email")||e.includes("could i get your email")||e.includes("could you provide your email")||e.includes("can you provide your email")||e.includes("provide your email")||e.includes("enter your email")||e.includes("share your email")||e.includes("need your email")||e.includes("what is your correct email")||e.includes("provide your correct email")||e.includes("where can i send your confirmation")||e.includes("where should i send your confirmation")||e.includes("where can i send your calendar")||e.includes("where should i send your calendar")||e.includes("email address")&&(e.includes("what is")||e.includes("what's")||e.includes("whats")||e.includes("may i have")||e.includes("can i have")||e.includes("could i have")||e.includes("could you provide")||e.includes("can you provide")||e.includes("provide")||e.includes("share")||e.includes("so i can send")||e.includes("to send your")))?(p.style.display="flex",setTimeout(()=>X.focus(),60)):n.isFinal&&(p.style.display="none")}if(q===n.who&&I&&!O)I.innerText=n.text,O=!!n.isFinal;else{let e=n.who==="user",F=document.createElement("div");if(F.style.cssText=`
              display: flex; flex-direction: column; gap: 4px; max-width: 88%;
              align-self: ${e?"flex-end":"flex-start"};
            `,e){let w=document.createElement("div");w.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 2px 14px;
                font-size: 13px; line-height: 1.45;
                background: ${o};
                color: #ffffff;
                box-shadow: 0 2px 8px ${o}35;
              `,w.innerText=n.text,F.appendChild(w),I=w}else{let w=document.createElement("div");w.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let H=document.createElement("div");H.style.cssText=`
                width: 24px; height: 24px; border-radius: 50%; background: #18181b;
                display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;
              `,H.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let U=document.createElement("div");U.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 14px 2px;
                font-size: 13px; line-height: 1.45;
                background: ${t?"#18181b":"#f4f4f5"};
                color: ${t?"#fafafa":"#09090b"};
                border: ${t?"1px solid #27272a":"none"};
                box-shadow: 0 1px 2px rgba(0,0,0,0.04);
              `,U.innerText=n.text,w.appendChild(H),w.appendChild(U),F.appendChild(w),I=U}b.insertBefore(F,g),q=n.who,O=!!n.isFinal}b.scrollTop=b.scrollHeight,L?.(n)},onAudioLevel:(n,e)=>{if(ge=n,me=e,j==="connected"){C.style.display="flex";let F=Math.max(n,e);pe.forEach((w,H)=>{let U=Math.max(4,Math.min(14,Math.round(w*(.35+F*1.5))));ie[H]&&(ie[H].style.height=`${U}px`)})}},onError:()=>{r.innerText="Error",l.style.background="#ef4444",f.innerText="Start Voice Call",c.style.background=o,c.style.boxShadow=`0 4px 14px ${o}40`,c.disabled=!1,C.style.display="none",p.style.display="none",g.style.display="none",D()}}),await $.start(V.token,ve,V.voice,V.ws_url)}catch(h){console.error("[OmniDesk Voice Widget Error]:",h),r.innerText="Error",l.style.background="#ef4444",f.innerText="Start Voice Call",c.style.background=o,c.style.boxShadow=`0 4px 14px ${o}40`,c.disabled=!1,C.style.display="none",p.style.display="none",g.style.display="none",D()}}function fe(){$&&($.stop(),$=null),j="idle";let r=E.querySelector("#omnidesk-status-text"),l=E.querySelector("#omnidesk-status-dot"),f=c.querySelector("#omnidesk-btn-text");r&&(r.innerText="Idle \xB7 Ready"),l&&(l.style.background=t?"rgba(255,255,255,0.4)":"#a1a1aa"),f&&(f.innerText="Start Voice Call"),c.style.background=o,c.style.boxShadow=`0 4px 14px ${o}40`,c.disabled=!1,C.style.display="none",p.style.display="none",g.style.display="none",J=!1,S=!1,D()}return c.onclick=()=>{j==="connected"?fe():j==="idle"&&he()},{destroy:()=>{D(),$&&$.stop(),N.remove()},startCall:he,endCall:fe}}if(typeof document<"u"){let d=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(d){let s,u=d.src||"";if(u&&u.startsWith("http"))try{s=new URL(u).origin}catch{}let x=d.getAttribute("data-business-id")||void 0,y=d.getAttribute("data-agent")||void 0,M=d.getAttribute("data-theme")||"dark",W=d.getAttribute("data-accent")||"emerald",A=d.getAttribute("data-position")||"bottom-right",v=d.getAttribute("data-label")||void 0,_=d.getAttribute("data-host")||s||"https://omni-desk-rho.vercel.app",m=d.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{re({businessId:x,agentId:y,theme:M,accent:W,position:A,label:v,host:_,greeting:m})}):re({businessId:x,agentId:y,theme:M,accent:W,position:A,label:v,host:_,greeting:m})}}return _e(Ne);})();
