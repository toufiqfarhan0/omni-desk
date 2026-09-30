var Q=24e3,ve="wss://agents.assemblyai.com/v1/ws",Ce=`
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
`,Te=`
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
`;async function he(p,n,u){let m=URL.createObjectURL(new Blob([n],{type:"application/javascript"}));try{await p.audioWorklet.addModule(m)}finally{URL.revokeObjectURL(m)}return new AudioWorkletNode(p,u)}var X=class{constructor(n){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.isThinking=!1;this.callbacks=n}setThinking(n){this.isThinking!==n&&(this.isThinking=n,this.callbacks.onThinkingChange?.(n))}async start(n,u,m){try{this.callbacks.onStatusChange?.("connecting");let T=window.AudioContext||window.webkitAudioContext;this.captureCtx=new T({sampleRate:Q}),this.playbackCtx=new T({sampleRate:Q}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await he(this.playbackCtx,Te,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0}}),this.captureNode=await he(this.captureCtx,Ce,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let N=new URL(ve);N.searchParams.set("token",n),this.ws=new WebSocket(N.toString()),this.captureNode.port.onmessage=({data:f})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let s=new Uint8Array(f),k="";for(let S=0;S<s.length;S+=32768)k+=String.fromCharCode.apply(null,Array.from(s.subarray(S,S+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(k)}));let L=new Int16Array(f),_=0;for(let S=0;S<L.length;S+=16)_+=Math.abs(L[S]);this.userLevel=Math.min(1,_/(L.length/16)/8e3)},this.ws.onopen=()=>{let f={};u&&u.trim()?f.agent_id=u.trim():m&&m.trim()&&(f.output={voice:m.trim()}),Object.keys(f).length>0&&this.ws?.send(JSON.stringify({type:"session.update",session:f}))};let b="",M="";this.ws.onmessage=({data:f})=>{try{let s=JSON.parse(f);switch(s.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0,M="",this.setThinking(!1);break;case"transcript.user.delta":s.text&&(M=s.text,this.callbacks.onTranscript?.({who:"user",text:s.text,isFinal:!1}));break;case"transcript.user":s.text&&(M=s.text,this.callbacks.onTranscript?.({who:"user",text:s.text,isFinal:!0}),this.setThinking(!0));break;case"reply.started":b="";break;case"transcript.agent.delta":s.delta&&(this.setThinking(!1),b&&!b.endsWith(" ")&&!/^[.,!?;:%)]/.test(s.delta)?b+=" "+s.delta:b+=s.delta,this.callbacks.onTranscript?.({who:"agent",text:b,isFinal:!1}));break;case"transcript.agent":s.text&&(this.setThinking(!1),b=s.text,this.callbacks.onTranscript?.({who:"agent",text:s.text,isFinal:!0}));break;case"reply.audio":if(s.data&&this.playbackNode){let k=atob(s.data),L=new Uint8Array(k.length);for(let _=0;_<k.length;_++)L[_]=k.charCodeAt(_);this.playbackNode.port.postMessage(L.buffer,[L.buffer]),this.agentLevel=.8}break;case"reply.done":s.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:s.name||s.tool,args:s.arguments||s.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:s.name||s.tool,result:s.result});break;case"session.error":this.setThinking(!1),this.callbacks.onError?.(s.message||s.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.setThinking(!1),this.stop();break}}catch(s){console.warn("Message parsing error:",s)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(T){this.callbacks.onError?.(T.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(n){this.isMuted=n,n&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(n,u){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:n})),u&&this.ws.send(JSON.stringify({type:"reply.create",instructions:u})),!0}catch(m){return console.error("Failed to send message to agent:",m),!1}}sendEmailInput(n){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:`My email address is ${n}`})),!0}catch(u){return console.error("Failed to send email to agent:",u),!1}}stop(){if(this.setThinking(!1),this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(n=>n.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let n=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(n)};this.animFrameId=requestAnimationFrame(n)}};var Se={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function fe(p={}){if(typeof window>"u")return;let{host:n,businessId:u="biz_demo_dental",agentId:m,theme:T="light",position:N="bottom-right",label:b="Talk to Receptionist",accent:M="emerald",accentColor:f,businessName:s,greeting:k,onCallStart:L,onCallEnd:_,onTranscript:S}=p,c=f||Se[M]||M||"#10b981",oe=document.getElementById("omnidesk-voice-widget-root");oe&&oe.remove();let P=document.createElement("div");P.id="omnidesk-voice-widget-root",P.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let t=T==="dark"||T==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,$=null,O="idle",I=0,B=null,ae=!1,re=!1,xe=0,ge=0,me=!1,V=!1,A=!1,D=null,R=null,U=!1,J=N==="bottom-left",ee=document.createElement("div");ee.style.cssText=`
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
    <span>${b}</span>
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
          ${s||"OmniDesk Hair Salon & Studio"}
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
  `;let le=document.createElement("style");le.textContent=`
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
  `,P.appendChild(le);let w=document.createElement("div");w.style.cssText=`
    flex: 1; min-height: 0; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 12px; background: ${t?"#09090b":"#ffffff"};
  `;let W=document.createElement("div");W.id="omnidesk-placeholder-banner",W.style.cssText=`
    margin: auto; text-align: center; padding: 10px 18px;
    background: ${t?"#18181b":"#f4f4f5"}; border: 1px solid ${t?"#27272a":"#e4e4e7"}; color: ${t?"#a1a1aa":"#52525b"};
    border-radius: 12px; font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px; align-self: center;
  `,W.innerHTML=`
    <span id="omnidesk-placeholder-dot" style="width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block;"></span>
    <span>Start a call to talk to our receptionist</span>
  `,w.appendChild(W);let h=document.createElement("div");if(h.id="omnidesk-thinking-bubble",h.style.cssText=`
    display: none; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;
  `,h.innerHTML=`
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
  `,w.appendChild(h),k){W.style.display="none";let a=document.createElement("div");a.style.cssText="display: flex; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;";let l=document.createElement("div");l.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let x=document.createElement("div");x.style.cssText="width: 24px; height: 24px; border-radius: 50%; background: #18181b; display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;",x.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let g=document.createElement("div");g.style.cssText=`padding: 10px 14px; border-radius: 14px 14px 14px 2px; font-size: 13px; line-height: 1.45; background: ${t?"#18181b":"#f4f4f5"}; color: ${t?"#fafafa":"#09090b"}; border: ${t?"1px solid #27272a":"none"}; box-shadow: 0 1px 2px rgba(0,0,0,0.04);`,g.innerText=k,l.appendChild(x),l.appendChild(g),a.appendChild(l),w.insertBefore(a,h),D="agent",R=g,U=!0}let d=document.createElement("div");d.id="omnidesk-email-bar",d.style.cssText=`
    padding: 11px 16px; background: #f0fdf4; border-top: 1px solid #bbf7d0;
    display: none; flex-direction: column; gap: 7px; flex-shrink: 0;
  `,d.innerHTML=`
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
  `;let r=document.createElement("button");r.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: ${c}; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    box-shadow: 0 4px 14px ${c}40;
    cursor: pointer; transition: all 0.15s ease;
  `,r.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let G=document.createElement("div");G.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let C=document.createElement("div");C.id="omnidesk-waveform",C.style.cssText="display: none; align-items: center; gap: 2.5px; height: 14px;";let de=[12,8,14,6,10],te=[];de.forEach(a=>{let l=document.createElement("span");l.style.cssText=`width: 2.5px; height: ${Math.round(a*.35)}px; background: ${c}; border-radius: 1px; transition: height 0.12s ease;`,C.appendChild(l),te.push(l)}),G.appendChild(C);let y=document.createElement("span");y.id="omnidesk-timer",y.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,y.innerText="0:00",G.appendChild(y),K.appendChild(r),K.appendChild(G),o.appendChild(E),o.appendChild(w),o.appendChild(d),o.appendChild(K),P.appendChild(ee),P.appendChild(Z),P.appendChild(o),document.body.appendChild(P);function ye(){I=Date.now(),y.innerText="0:00",y.style.background=t?"#18181b":"#000000",y.style.color="#ffffff",y.style.border=t?"1px solid #27272a":"none",B&&clearInterval(B),B=setInterval(()=>{let a=Date.now()-I,l=Math.floor(a/1e3),x=Math.floor(l/60),g=l%60;y.innerText=`${x}:${String(g).padStart(2,"0")}`},250)}function j(){B&&(clearInterval(B),B=null),y.style.background="#f4f4f5",y.style.color="#71717a",y.style.border="none",y.innerText="0:00",C.style.display="none"}function ce(a){ae=a,o.style.display=a?"flex":"none"}function se(a){re=a,Z.style.display=a?"block":"none",a?(o.style.top="50%",o.style.left="50%",o.style.bottom="auto",o.style.right="auto",o.style.transform="translate(-50%, -50%)",o.style.width="calc(100vw - 40px)",o.style.maxWidth="1140px",o.style.height="calc(100vh - 40px)",o.style.maxHeight="900px"):(o.style.top="auto",o.style.left=J?"20px":"auto",o.style.right=J?"auto":"20px",o.style.bottom="80px",o.style.transform="none",o.style.width="390px",o.style.maxWidth="calc(100vw - 32px)",o.style.height="560px",o.style.maxHeight="calc(100vh - 100px)")}Y.onclick=()=>ce(!ae),E.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{ce(!1),se(!1)}),E.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{se(!re)});let be=d.querySelector("#omnidesk-email-form"),ie=d.querySelector("#omnidesk-email-input");d.querySelector("#omnidesk-email-close-btn").addEventListener("click",()=>{d.style.display="none"}),be.addEventListener("submit",a=>{a.preventDefault();let l=ie.value.trim();!l||!l.includes("@")||($&&$.sendEmailInput(l),A=!0,d.style.display="none",ie.value="",h.style.display="flex",w.scrollTop=w.scrollHeight)});async function pe(){me=!1,V=!1,A=!1,d.style.display="none",h.style.display="none",D=null,R=null,U=!1;let a=E.querySelector("#omnidesk-status-text"),l=E.querySelector("#omnidesk-status-dot"),x=r.querySelector("#omnidesk-btn-text");a.innerText="Connecting...",l.style.background="#eab308",x.innerText="Connecting...",r.style.background="#64748b",r.style.boxShadow="none",r.disabled=!0,ye();try{let g=n;if(!g&&typeof document<"u"){let i=document.querySelector("script[src*='widget.js']");if(i&&i.src&&i.src.startsWith("http"))try{g=new URL(i.src).origin}catch{}}!g&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(g=window.location.origin);let ke=(g||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),ne=await fetch(`${ke}/api/token?businessId=${encodeURIComponent(u)}`);if(!ne.ok)throw new Error(`Failed to get session token (${ne.status})`);let q=await ne.json();if(q.business_name&&!s){let i=E.querySelector("#omnidesk-biz-title");i&&(i.innerText=q.business_name)}let we=m||q.agent_id||"";$=new X({onStatusChange:i=>{if(O=i,i==="connected")a.innerText="Live \xB7 Speaking",l.style.background="#22c55e",x.innerText="End Voice Call",r.style.background="#dc2626",r.style.boxShadow="0 4px 14px rgba(220, 38, 38, 0.35)",r.disabled=!1,C.style.display="flex",I=Date.now(),L?.();else if(i==="idle"&&(a.innerText="Idle \xB7 Ready",l.style.background=t?"rgba(255,255,255,0.4)":"#a1a1aa",x.innerText="Start Voice Call",r.style.background=c,r.style.boxShadow=`0 4px 14px ${c}40`,r.disabled=!1,C.style.display="none",d.style.display="none",h.style.display="none",j(),I>0)){let e=Math.round((Date.now()-I)/1e3);I=0,_?.(e)}},onThinkingChange:i=>{i&&(h.style.display="flex",w.scrollTop=w.scrollHeight)},onTranscript:i=>{if(W.style.display="none",i.who==="user"){i.isFinal&&(h.style.display="flex");let e=i.text.toLowerCase();(e==="no"||e.startsWith("no ")||e.includes("no,")||e.includes("wrong")||e.includes("incorrect")||e.includes("change my email")||e.includes("different email"))&&(A=!1),(i.text.includes("@")||e.includes(" at ")&&e.includes(" dot ")||e.includes("gmail.com")||e.includes("yahoo.com")||e.includes("outlook.com")||e.includes("hotmail.com")||e.includes("icloud.com"))&&(d.style.display="none",A=!0)}else if(i.who==="agent"){i.text&&i.text.trim().length>0&&(h.style.display="none");let e=i.text.toLowerCase();if(i.isFinal){if(e.includes("confirmation code is")||e.includes("booking is confirmed")||e.includes("scheduled your appointment")||e.includes("all set, your appointment")||e.includes("sent your confirmation")&&(e.includes("code")||e.includes("calendar invite"))||e.includes("sent a calendar invite")&&(e.includes("code")||e.includes("all set"))){V=!0,A=!1,d.style.display="none";return}if(V){d.style.display="none";return}if(e.includes("confirm with yes or no")||e.includes("yes or no")||e.includes("is that correct")||e.includes("is that right")){A=!0,d.style.display="none";return}e.includes("what is your email")||e.includes("what's your email")||e.includes("may i have your email")||e.includes("can i have your email")||e.includes("could i get your email")||e.includes("could you provide your email")||e.includes("provide your email")||e.includes("enter your email")||e.includes("spell your email")||e.includes("share your email")||e.includes("need your email")||e.includes("what email")||e.includes("which email")||e.includes("where can i send your confirmation")||e.includes("where should i send your confirmation")||e.includes("where can i send your calendar")||e.includes("where should i send your calendar")||e.includes("email")&&(e.includes("what is")||e.includes("what's")||e.includes("may i have")||e.includes("can i have")||e.includes("provide")||e.includes("give me")||e.includes("tell me")||e.includes("send your calendar invite")||e.includes("send your confirmation"))?(A=!1,d.style.display="flex",setTimeout(()=>ie.focus(),60)):!V&&!A&&(d.style.display="none")}}if(D===i.who&&R&&!U)R.innerText=i.text,U=!!i.isFinal;else{let e=i.who==="user",F=document.createElement("div");if(F.style.cssText=`
              display: flex; flex-direction: column; gap: 4px; max-width: 88%;
              align-self: ${e?"flex-end":"flex-start"};
            `,e){let v=document.createElement("div");v.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 2px 14px;
                font-size: 13px; line-height: 1.45;
                background: ${c};
                color: #ffffff;
                box-shadow: 0 2px 8px ${c}35;
              `,v.innerText=i.text,F.appendChild(v),R=v}else{let v=document.createElement("div");v.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let H=document.createElement("div");H.style.cssText=`
                width: 24px; height: 24px; border-radius: 50%; background: #18181b;
                display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;
              `,H.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let z=document.createElement("div");z.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 14px 2px;
                font-size: 13px; line-height: 1.45;
                background: ${t?"#18181b":"#f4f4f5"};
                color: ${t?"#fafafa":"#09090b"};
                border: ${t?"1px solid #27272a":"none"};
                box-shadow: 0 1px 2px rgba(0,0,0,0.04);
              `,z.innerText=i.text,v.appendChild(H),v.appendChild(z),F.appendChild(v),R=z}w.insertBefore(F,h),D=i.who,U=!!i.isFinal}w.scrollTop=w.scrollHeight,S?.(i)},onAudioLevel:(i,e)=>{if(xe=i,ge=e,O==="connected"){C.style.display="flex";let F=Math.max(i,e);de.forEach((v,H)=>{let z=Math.max(4,Math.min(14,Math.round(v*(.35+F*1.5))));te[H]&&(te[H].style.height=`${z}px`)})}},onError:()=>{a.innerText="Error",l.style.background="#ef4444",x.innerText="Start Voice Call",r.style.background=c,r.style.boxShadow=`0 4px 14px ${c}40`,r.disabled=!1,C.style.display="none",d.style.display="none",h.style.display="none",j()}}),await $.start(q.token,we,q.voice)}catch(g){console.error("[OmniDesk Voice Widget Error]:",g),a.innerText="Error",l.style.background="#ef4444",x.innerText="Start Voice Call",r.style.background=c,r.style.boxShadow=`0 4px 14px ${c}40`,r.disabled=!1,C.style.display="none",d.style.display="none",h.style.display="none",j()}}function ue(){$&&($.stop(),$=null),O="idle";let a=E.querySelector("#omnidesk-status-text"),l=E.querySelector("#omnidesk-status-dot"),x=r.querySelector("#omnidesk-btn-text");a&&(a.innerText="Idle \xB7 Ready"),l&&(l.style.background=t?"rgba(255,255,255,0.4)":"#a1a1aa"),x&&(x.innerText="Start Voice Call"),r.style.background=c,r.style.boxShadow=`0 4px 14px ${c}40`,r.disabled=!1,C.style.display="none",d.style.display="none",h.style.display="none",V=!1,A=!1,j()}return r.onclick=()=>{O==="connected"?ue():O==="idle"&&pe()},{destroy:()=>{j(),$&&$.stop(),P.remove()},startCall:pe,endCall:ue}}if(typeof document<"u"){let p=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(p){let n,u=p.src||"";if(u&&u.startsWith("http"))try{n=new URL(u).origin}catch{}let m=p.getAttribute("data-business-id")||void 0,T=p.getAttribute("data-agent")||void 0,N=p.getAttribute("data-theme")||"dark",b=p.getAttribute("data-accent")||"emerald",M=p.getAttribute("data-position")||"bottom-right",f=p.getAttribute("data-label")||void 0,s=p.getAttribute("data-host")||n||"https://omni-desk-rho.vercel.app",k=p.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{fe({businessId:m,agentId:T,theme:N,accent:b,position:M,label:f,host:s,greeting:k})}):fe({businessId:m,agentId:T,theme:N,accent:b,position:M,label:f,host:s,greeting:k})}}export{fe as initOmniDeskWidget};
//# sourceMappingURL=vanilla.mjs.map