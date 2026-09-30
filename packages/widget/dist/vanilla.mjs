var ee=24e3,ve="wss://agents.us.assemblyai.com/v1/ws",Te=`
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
`,Ce=`
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
`;async function he(h,o,f){let m=URL.createObjectURL(new Blob([o],{type:"application/javascript"}));try{await h.audioWorklet.addModule(m)}finally{URL.revokeObjectURL(m)}return new AudioWorkletNode(h,f)}var te=class{constructor(o){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.isThinking=!1;this.callbacks=o}setThinking(o){this.isThinking!==o&&(this.isThinking=o,this.callbacks.onThinkingChange?.(o))}async start(o,f,m,$){try{this.callbacks.onStatusChange?.("connecting");let E=window.AudioContext||window.webkitAudioContext;this.captureCtx=new E({sampleRate:ee}),this.playbackCtx=new E({sampleRate:ee}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await he(this.playbackCtx,Ce,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0}}),this.captureNode=await he(this.captureCtx,Te,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let W=$&&$.trim()||ve,A=new URL(W);A.searchParams.set("token",o),this.ws=new WebSocket(A.toString()),this.captureNode.port.onmessage=({data:g})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let s=new Uint8Array(g),P="";for(let v=0;v<s.length;v+=32768)P+=String.fromCharCode.apply(null,Array.from(s.subarray(v,v+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(P)}));let _=new Int16Array(g),n=0;for(let v=0;v<_.length;v+=16)n+=Math.abs(_[v]);this.userLevel=Math.min(1,n/(_.length/16)/8e3)},this.ws.onopen=()=>{let g={};f&&f.trim()?g.agent_id=f.trim():m&&m.trim()&&(g.output={voice:m.trim()}),Object.keys(g).length>0&&this.ws?.send(JSON.stringify({type:"session.update",session:g}))};let w="",M="";this.ws.onmessage=({data:g})=>{try{let s=JSON.parse(g);switch(s.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0,M="",this.setThinking(!1);break;case"transcript.user.delta":s.text&&(M=s.text,this.callbacks.onTranscript?.({who:"user",text:s.text,isFinal:!1}));break;case"transcript.user":s.text&&(M=s.text,this.callbacks.onTranscript?.({who:"user",text:s.text,isFinal:!0}),this.setThinking(!0));break;case"reply.started":w="";break;case"transcript.agent.delta":s.delta&&(this.setThinking(!1),w&&!w.endsWith(" ")&&!/^[.,!?;:%)]/.test(s.delta)?w+=" "+s.delta:w+=s.delta,this.callbacks.onTranscript?.({who:"agent",text:w,isFinal:!1}));break;case"transcript.agent":s.text&&(this.setThinking(!1),w=s.text,this.callbacks.onTranscript?.({who:"agent",text:s.text,isFinal:!0}));break;case"reply.audio":if(s.data&&this.playbackNode){let P=atob(s.data),_=new Uint8Array(P.length);for(let n=0;n<P.length;n++)_[n]=P.charCodeAt(n);this.playbackNode.port.postMessage(_.buffer,[_.buffer]),this.agentLevel=.8}break;case"reply.done":s.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:s.name||s.tool,args:s.arguments||s.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:s.name||s.tool,result:s.result});break;case"reply.error":this.setThinking(!1),this.callbacks.onError?.(s.message||s.code||"Reply generation error");break;case"error":case"session.error":this.setThinking(!1),this.callbacks.onError?.(s.message||s.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.setThinking(!1),this.stop();break}}catch(s){console.warn("Message parsing error:",s)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(E){this.callbacks.onError?.(E.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(o){this.isMuted=o,o&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(o,f){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:o})),f&&this.ws.send(JSON.stringify({type:"reply.create",instructions:f})),!0}catch(m){return console.error("Failed to send message to agent:",m),!1}}sendEmailInput(o){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:`My email is ${o}`})),this.ws.send(JSON.stringify({type:"reply.create",instructions:`The caller has entered and verified their email address: ${o}. Do not ask for their email again. Immediately speak: "I have verified your email as ${o}. Can you please confirm with yes or no?" Then stop speaking and wait for their yes or no answer.`})),!0}catch(f){return console.error("Failed to send email to agent:",f),!1}}stop(){if(this.setThinking(!1),this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(o=>o.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let o=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(o)};this.animFrameId=requestAnimationFrame(o)}};var Se={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function fe(h={}){if(typeof window>"u")return;let{host:o,businessId:f="biz_demo_dental",agentId:m,theme:$="light",position:E="bottom-right",label:W="Talk to Receptionist",accent:A="emerald",accentColor:w,businessName:M,greeting:g,onCallStart:s,onCallEnd:P,onTranscript:_}=h,n=w||Se[A]||A||"#10b981",v=document.getElementById("omnidesk-voice-widget-root");v&&v.remove();let N=document.createElement("div");N.id="omnidesk-voice-widget-root",N.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let t=$==="dark"||$==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,L=null,j="idle",R=0,z=null,ae=!1,re=!1,xe=0,ge=0,me=!1,J=!1,C=!1,q=null,I=null,O=!1,Y=E==="bottom-left",se=document.createElement("div");se.style.cssText=`
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
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${n};box-shadow:0 0 8px ${n};display:inline-block;"></span>
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
  `;let S=document.createElement("div");S.style.cssText=`
    background: ${t?"#18181b":"#ffffff"}; color: ${t?"#ffffff":"#09090b"};
    border-bottom: 1px solid ${t?"#27272a":"#e4e4e7"};
    padding: 13px 18px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; user-select: none; flex-shrink: 0;
  `,S.innerHTML=`
    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
      <div style="color: ${t?"rgba(255,255,255,0.6)":"#71717a"}; display: grid; place-items: center; flex-shrink: 0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle>
        </svg>
      </div>
      <div style="width: 28px; height: 28px; border-radius: 50%; background: ${t?"rgba(255,255,255,0.15)":n==="#18181b"?"rgba(24,24,27,0.08)":`${n}18`}; display: grid; place-items: center; flex-shrink: 0; color: ${t?"#ffffff":n==="#18181b"?"#09090b":n};">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
        </svg>
      </div>
      <div style="display: flex; flex-direction: column; min-width: 0;">
        <div id="omnidesk-biz-title" style="font-size: 13.5px; font-weight: 600; color: ${t?"#ffffff":"#09090b"}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${M||"OmniDesk Hair Salon & Studio"}
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
  `,N.appendChild(le);let y=document.createElement("div");y.style.cssText=`
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
  `,y.appendChild(B);let x=document.createElement("div");if(x.id="omnidesk-thinking-bubble",x.style.cssText=`
    display: none; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;
  `,x.innerHTML=`
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
  `,y.appendChild(x),g){B.style.display="none";let r=document.createElement("div");r.style.cssText="display: flex; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;";let l=document.createElement("div");l.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let u=document.createElement("div");u.style.cssText="width: 24px; height: 24px; border-radius: 50%; background: #18181b; display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;",u.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let p=document.createElement("div");p.style.cssText=`padding: 10px 14px; border-radius: 14px 14px 14px 2px; font-size: 13px; line-height: 1.45; background: ${t?"#18181b":"#f4f4f5"}; color: ${t?"#fafafa":"#09090b"}; border: ${t?"1px solid #27272a":"none"}; box-shadow: 0 1px 2px rgba(0,0,0,0.04);`,p.innerText=g,l.appendChild(u),l.appendChild(p),r.appendChild(l),y.insertBefore(r,x),q="agent",I=p,O=!0}let c=document.createElement("div");c.id="omnidesk-email-bar",c.style.cssText=`
    padding: 11px 16px; background: #f0fdf4; border-top: 1px solid #bbf7d0;
    display: none; flex-direction: column; gap: 7px; flex-shrink: 0;
  `,c.innerHTML=`
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
  `;let d=document.createElement("button");d.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: ${n}; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    box-shadow: 0 4px 14px ${n}40;
    cursor: pointer; transition: all 0.15s ease;
  `,d.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let Q=document.createElement("div");Q.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let T=document.createElement("div");T.id="omnidesk-waveform",T.style.cssText="display: none; align-items: center; gap: 2.5px; height: 14px;";let de=[12,8,14,6,10],ie=[];de.forEach(r=>{let l=document.createElement("span");l.style.cssText=`width: 2.5px; height: ${Math.round(r*.35)}px; background: ${n}; border-radius: 1px; transition: height 0.12s ease;`,T.appendChild(l),ie.push(l)}),Q.appendChild(T);let b=document.createElement("span");b.id="omnidesk-timer",b.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,b.innerText="0:00",Q.appendChild(b),G.appendChild(d),G.appendChild(Q),a.appendChild(S),a.appendChild(y),a.appendChild(c),a.appendChild(G),N.appendChild(se),N.appendChild(K),N.appendChild(a),document.body.appendChild(N);function ye(){R=Date.now(),b.innerText="0:00",b.style.background=t?"#18181b":"#000000",b.style.color="#ffffff",b.style.border=t?"1px solid #27272a":"none",z&&clearInterval(z),z=setInterval(()=>{let r=Date.now()-R,l=Math.floor(r/1e3),u=Math.floor(l/60),p=l%60;b.innerText=`${u}:${String(p).padStart(2,"0")}`},250)}function D(){z&&(clearInterval(z),z=null),b.style.background="#f4f4f5",b.style.color="#71717a",b.style.border="none",b.innerText="0:00",T.style.display="none"}function ce(r){ae=r,a.style.display=r?"flex":"none"}function ne(r){re=r,K.style.display=r?"block":"none",r?(a.style.top="50%",a.style.left="50%",a.style.bottom="auto",a.style.right="auto",a.style.transform="translate(-50%, -50%)",a.style.width="calc(100vw - 40px)",a.style.maxWidth="1140px",a.style.height="calc(100vh - 40px)",a.style.maxHeight="900px"):(a.style.top="auto",a.style.left=Y?"20px":"auto",a.style.right=Y?"auto":"20px",a.style.bottom="80px",a.style.transform="none",a.style.width="390px",a.style.maxWidth="calc(100vw - 32px)",a.style.height="560px",a.style.maxHeight="calc(100vh - 100px)")}Z.onclick=()=>ce(!ae),S.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{ce(!1),ne(!1)}),S.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{ne(!re)});let be=c.querySelector("#omnidesk-email-form"),X=c.querySelector("#omnidesk-email-input");c.querySelector("#omnidesk-email-close-btn").addEventListener("click",()=>{c.style.display="none"}),be.addEventListener("submit",r=>{r.preventDefault();let l=X.value.trim();if(!l||!l.includes("@"))return;L&&L.sendEmailInput(l),C=!0,c.style.display="none",X.value="",B.style.display="none";let u=document.createElement("div");u.style.cssText=`
      display: flex; flex-direction: column; gap: 4px; max-width: 88%;
      align-self: flex-end;
    `;let p=document.createElement("div");p.style.cssText=`
      padding: 10px 14px; border-radius: 14px 14px 2px 14px;
      font-size: 13px; line-height: 1.45;
      background: ${n}; color: #ffffff;
      box-shadow: 0 2px 8px ${n}35;
    `,p.innerText=`My email is ${l}`,u.appendChild(p),y.insertBefore(u,x),x.style.display="flex",y.scrollTop=y.scrollHeight,q="user",I=p,O=!0});async function pe(){me=!1,J=!1,C=!1,c.style.display="none",x.style.display="none",q=null,I=null,O=!1;let r=S.querySelector("#omnidesk-status-text"),l=S.querySelector("#omnidesk-status-dot"),u=d.querySelector("#omnidesk-btn-text");r.innerText="Connecting...",l.style.background="#eab308",u.innerText="Connecting...",d.style.background="#64748b",d.style.boxShadow="none",d.disabled=!0,ye();try{let p=o;if(!p&&typeof document<"u"){let i=document.querySelector("script[src*='widget.js']");if(i&&i.src&&i.src.startsWith("http"))try{p=new URL(i.src).origin}catch{}}!p&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(p=window.location.origin);let ke=(p||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),oe=await fetch(`${ke}/api/token?businessId=${encodeURIComponent(f)}`);if(!oe.ok)throw new Error(`Failed to get session token (${oe.status})`);let V=await oe.json();if(V.business_name&&!M){let i=S.querySelector("#omnidesk-biz-title");i&&(i.innerText=V.business_name)}let we=m||V.agent_id||"";L=new te({onStatusChange:i=>{if(j=i,i==="connected")r.innerText="Live \xB7 Speaking",l.style.background="#22c55e",u.innerText="End Voice Call",d.style.background="#dc2626",d.style.boxShadow="0 4px 14px rgba(220, 38, 38, 0.35)",d.disabled=!1,T.style.display="flex",R=Date.now(),s?.();else if(i==="idle"&&(r.innerText="Idle \xB7 Ready",l.style.background=t?"rgba(255,255,255,0.4)":"#a1a1aa",u.innerText="Start Voice Call",d.style.background=n,d.style.boxShadow=`0 4px 14px ${n}40`,d.disabled=!1,T.style.display="none",c.style.display="none",x.style.display="none",D(),R>0)){let e=Math.round((Date.now()-R)/1e3);R=0,P?.(e)}},onThinkingChange:i=>{i&&(x.style.display="flex",y.scrollTop=y.scrollHeight)},onTranscript:i=>{if(B.style.display="none",i.who==="user"){i.isFinal&&(x.style.display="flex");let e=i.text.toLowerCase().trim();(e==="no"||e.startsWith("no ")||e.includes("no,")||e.includes("wrong")||e.includes("incorrect")||e.includes("change my email")||e.includes("different email")||e.includes("that's not right")||e.includes("thats not right")||e.includes("not right")||e.includes("not my email"))&&(C=!1,c.style.display="flex",setTimeout(()=>X.focus(),60)),(e==="yes"||e.startsWith("yes ")||e.includes("yes,")||e==="yeah"||e.startsWith("yeah ")||e==="yep"||e==="correct"||e.includes("that's right")||e.includes("thats right")||e.includes("sounds good")||e==="confirm"||e==="sure")&&C&&(C=!1,c.style.display="none"),(i.text.includes("@")||e.includes(" at ")&&e.includes(" dot ")||e.includes("gmail.com")||e.includes("yahoo.com")||e.includes("outlook.com")||e.includes("hotmail.com")||e.includes("icloud.com"))&&(c.style.display="none",C=!0)}else if(i.who==="agent"){i.text&&i.text.trim().length>0&&(x.style.display="none");let e=i.text.toLowerCase();if(e.includes("confirmation code is")||e.includes("booking is confirmed")||e.includes("scheduled your appointment")||e.includes("all set, your appointment")||e.includes("sent your confirmation")&&(e.includes("code")||e.includes("calendar invite"))||e.includes("sent a calendar invite")&&(e.includes("code")||e.includes("all set"))){J=!0,C=!1,c.style.display="none";return}if(J){c.style.display="none";return}if(e.includes("confirm with yes or no")||e.includes("yes or no")||e.includes("is that correct")||e.includes("is that right")||e.includes("verified your email")||e.includes("checking that email")||e.includes("let me check that email")){C=!0,c.style.display="none";return}!C&&(e.includes("what is your email")||e.includes("what's your email")||e.includes("whats your email")||e.includes("may i have your email")||e.includes("can i have your email")||e.includes("could i have your email")||e.includes("could i get your email")||e.includes("could you provide your email")||e.includes("can you provide your email")||e.includes("provide your email")||e.includes("enter your email")||e.includes("share your email")||e.includes("need your email")||e.includes("what is your correct email")||e.includes("provide your correct email")||e.includes("where can i send your confirmation")||e.includes("where should i send your confirmation")||e.includes("where can i send your calendar")||e.includes("where should i send your calendar")||e.includes("email address")&&(e.includes("what is")||e.includes("what's")||e.includes("whats")||e.includes("may i have")||e.includes("can i have")||e.includes("could i have")||e.includes("could you provide")||e.includes("can you provide")||e.includes("provide")||e.includes("share")||e.includes("so i can send")||e.includes("to send your")))?(c.style.display="flex",setTimeout(()=>X.focus(),60)):i.isFinal&&(c.style.display="none")}if(q===i.who&&I&&!O)I.innerText=i.text,O=!!i.isFinal;else{let e=i.who==="user",F=document.createElement("div");if(F.style.cssText=`
              display: flex; flex-direction: column; gap: 4px; max-width: 88%;
              align-self: ${e?"flex-end":"flex-start"};
            `,e){let k=document.createElement("div");k.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 2px 14px;
                font-size: 13px; line-height: 1.45;
                background: ${n};
                color: #ffffff;
                box-shadow: 0 2px 8px ${n}35;
              `,k.innerText=i.text,F.appendChild(k),I=k}else{let k=document.createElement("div");k.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let H=document.createElement("div");H.style.cssText=`
                width: 24px; height: 24px; border-radius: 50%; background: #18181b;
                display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;
              `,H.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let U=document.createElement("div");U.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 14px 2px;
                font-size: 13px; line-height: 1.45;
                background: ${t?"#18181b":"#f4f4f5"};
                color: ${t?"#fafafa":"#09090b"};
                border: ${t?"1px solid #27272a":"none"};
                box-shadow: 0 1px 2px rgba(0,0,0,0.04);
              `,U.innerText=i.text,k.appendChild(H),k.appendChild(U),F.appendChild(k),I=U}y.insertBefore(F,x),q=i.who,O=!!i.isFinal}y.scrollTop=y.scrollHeight,_?.(i)},onAudioLevel:(i,e)=>{if(xe=i,ge=e,j==="connected"){T.style.display="flex";let F=Math.max(i,e);de.forEach((k,H)=>{let U=Math.max(4,Math.min(14,Math.round(k*(.35+F*1.5))));ie[H]&&(ie[H].style.height=`${U}px`)})}},onError:()=>{r.innerText="Error",l.style.background="#ef4444",u.innerText="Start Voice Call",d.style.background=n,d.style.boxShadow=`0 4px 14px ${n}40`,d.disabled=!1,T.style.display="none",c.style.display="none",x.style.display="none",D()}}),await L.start(V.token,we,V.voice,V.ws_url)}catch(p){console.error("[OmniDesk Voice Widget Error]:",p),r.innerText="Error",l.style.background="#ef4444",u.innerText="Start Voice Call",d.style.background=n,d.style.boxShadow=`0 4px 14px ${n}40`,d.disabled=!1,T.style.display="none",c.style.display="none",x.style.display="none",D()}}function ue(){L&&(L.stop(),L=null),j="idle";let r=S.querySelector("#omnidesk-status-text"),l=S.querySelector("#omnidesk-status-dot"),u=d.querySelector("#omnidesk-btn-text");r&&(r.innerText="Idle \xB7 Ready"),l&&(l.style.background=t?"rgba(255,255,255,0.4)":"#a1a1aa"),u&&(u.innerText="Start Voice Call"),d.style.background=n,d.style.boxShadow=`0 4px 14px ${n}40`,d.disabled=!1,T.style.display="none",c.style.display="none",x.style.display="none",J=!1,C=!1,D()}return d.onclick=()=>{j==="connected"?ue():j==="idle"&&pe()},{destroy:()=>{D(),L&&L.stop(),N.remove()},startCall:pe,endCall:ue}}if(typeof document<"u"){let h=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(h){let o,f=h.src||"";if(f&&f.startsWith("http"))try{o=new URL(f).origin}catch{}let m=h.getAttribute("data-business-id")||void 0,$=h.getAttribute("data-agent")||void 0,E=h.getAttribute("data-theme")||"dark",W=h.getAttribute("data-accent")||"emerald",A=h.getAttribute("data-position")||"bottom-right",w=h.getAttribute("data-label")||void 0,M=h.getAttribute("data-host")||o||"https://omni-desk-rho.vercel.app",g=h.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{fe({businessId:m,agentId:$,theme:E,accent:W,position:A,label:w,host:M,greeting:g})}):fe({businessId:m,agentId:$,theme:E,accent:W,position:A,label:w,host:M,greeting:g})}}export{fe as initOmniDeskWidget};
//# sourceMappingURL=vanilla.mjs.map