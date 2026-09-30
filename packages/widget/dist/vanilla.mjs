var X=24e3,ve="wss://agents.assemblyai.com/v1/ws",Te=`
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${X};
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
      this._step = ${X} / sampleRate;
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
`;async function he(h,n,f){let m=URL.createObjectURL(new Blob([n],{type:"application/javascript"}));try{await h.audioWorklet.addModule(m)}finally{URL.revokeObjectURL(m)}return new AudioWorkletNode(h,f)}var ee=class{constructor(n){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.isThinking=!1;this.callbacks=n}setThinking(n){this.isThinking!==n&&(this.isThinking=n,this.callbacks.onThinkingChange?.(n))}async start(n,f,m){try{this.callbacks.onStatusChange?.("connecting");let C=window.AudioContext||window.webkitAudioContext;this.captureCtx=new C({sampleRate:X}),this.playbackCtx=new C({sampleRate:X}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await he(this.playbackCtx,Ce,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0}}),this.captureNode=await he(this.captureCtx,Te,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let F=new URL(ve);F.searchParams.set("token",n),this.ws=new WebSocket(F.toString()),this.captureNode.port.onmessage=({data:g})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let s=new Uint8Array(g),v="";for(let S=0;S<s.length;S+=32768)v+=String.fromCharCode.apply(null,Array.from(s.subarray(S,S+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(v)}));let _=new Int16Array(g),$=0;for(let S=0;S<_.length;S+=16)$+=Math.abs(_[S]);this.userLevel=Math.min(1,$/(_.length/16)/8e3)},this.ws.onopen=()=>{let g={};f&&f.trim()?g.agent_id=f.trim():m&&m.trim()&&(g.output={voice:m.trim()}),Object.keys(g).length>0&&this.ws?.send(JSON.stringify({type:"session.update",session:g}))};let w="",L="";this.ws.onmessage=({data:g})=>{try{let s=JSON.parse(g);switch(s.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0,L="",this.setThinking(!1);break;case"transcript.user.delta":s.text&&(L=s.text,this.callbacks.onTranscript?.({who:"user",text:s.text,isFinal:!1}));break;case"transcript.user":s.text&&(L=s.text,this.callbacks.onTranscript?.({who:"user",text:s.text,isFinal:!0}),this.setThinking(!0));break;case"reply.started":w="";break;case"transcript.agent.delta":s.delta&&(this.setThinking(!1),w&&!w.endsWith(" ")&&!/^[.,!?;:%)]/.test(s.delta)?w+=" "+s.delta:w+=s.delta,this.callbacks.onTranscript?.({who:"agent",text:w,isFinal:!1}));break;case"transcript.agent":s.text&&(this.setThinking(!1),w=s.text,this.callbacks.onTranscript?.({who:"agent",text:s.text,isFinal:!0}));break;case"reply.audio":if(s.data&&this.playbackNode){let v=atob(s.data),_=new Uint8Array(v.length);for(let $=0;$<v.length;$++)_[$]=v.charCodeAt($);this.playbackNode.port.postMessage(_.buffer,[_.buffer]),this.agentLevel=.8}break;case"reply.done":s.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:s.name||s.tool,args:s.arguments||s.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:s.name||s.tool,result:s.result});break;case"session.error":this.setThinking(!1),this.callbacks.onError?.(s.message||s.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.setThinking(!1),this.stop();break}}catch(s){console.warn("Message parsing error:",s)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(C){this.callbacks.onError?.(C.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(n){this.isMuted=n,n&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(n,f){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:n})),f&&this.ws.send(JSON.stringify({type:"reply.create",instructions:f})),!0}catch(m){return console.error("Failed to send message to agent:",m),!1}}sendEmailInput(n){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:`My email is ${n}`})),this.ws.send(JSON.stringify({type:"reply.create",instructions:`The caller has entered and verified their email address: ${n}. Do not ask for their email again. Immediately speak: "I have verified your email as ${n}. Can you please confirm with yes or no?" Then stop speaking and wait for their yes or no answer.`})),!0}catch(f){return console.error("Failed to send email to agent:",f),!1}}stop(){if(this.setThinking(!1),this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(n=>n.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let n=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(n)};this.animFrameId=requestAnimationFrame(n)}};var Se={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function fe(h={}){if(typeof window>"u")return;let{host:n,businessId:f="biz_demo_dental",agentId:m,theme:C="light",position:F="bottom-right",label:w="Talk to Receptionist",accent:L="emerald",accentColor:g,businessName:s,greeting:v,onCallStart:_,onCallEnd:$,onTranscript:S}=h,c=g||Se[L]||L||"#10b981",oe=document.getElementById("omnidesk-voice-widget-root");oe&&oe.remove();let P=document.createElement("div");P.id="omnidesk-voice-widget-root",P.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let t=C==="dark"||C==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,A=null,V="idle",W=0,R=null,ae=!1,re=!1,xe=0,ge=0,me=!1,D=!1,E=!1,U=null,I=null,z=!1,J=F==="bottom-left",te=document.createElement("div");te.style.cssText=`
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
  `,te.appendChild(Y);let Z=document.createElement("div");Z.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,Z.onclick=()=>ie(!1);let o=document.createElement("div");o.style.cssText=`
    position: fixed; bottom: 80px; ${J?"left: 20px;":"right: 20px;"};
    width: 390px; max-width: calc(100vw - 32px); height: 560px; max-height: calc(100vh - 100px);
    background: ${t?"#09090b":"#ffffff"}; border: 1px solid ${t?"#27272a":"#e4e4e7"};
    border-radius: 20px; box-shadow: 0 24px 48px -12px rgba(0,0,0,0.22);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  `;let M=document.createElement("div");M.style.cssText=`
    background: ${t?"#18181b":"#ffffff"}; color: ${t?"#ffffff":"#09090b"};
    border-bottom: 1px solid ${t?"#27272a":"#e4e4e7"};
    padding: 13px 18px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; user-select: none; flex-shrink: 0;
  `,M.innerHTML=`
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
  `,P.appendChild(le);let y=document.createElement("div");y.style.cssText=`
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
  `,y.appendChild(x),v){B.style.display="none";let a=document.createElement("div");a.style.cssText="display: flex; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;";let r=document.createElement("div");r.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let u=document.createElement("div");u.style.cssText="width: 24px; height: 24px; border-radius: 50%; background: #18181b; display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;",u.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let p=document.createElement("div");p.style.cssText=`padding: 10px 14px; border-radius: 14px 14px 14px 2px; font-size: 13px; line-height: 1.45; background: ${t?"#18181b":"#f4f4f5"}; color: ${t?"#fafafa":"#09090b"}; border: ${t?"1px solid #27272a":"none"}; box-shadow: 0 1px 2px rgba(0,0,0,0.04);`,p.innerText=v,r.appendChild(u),r.appendChild(p),a.appendChild(r),y.insertBefore(a,x),U="agent",I=p,z=!0}let d=document.createElement("div");d.id="omnidesk-email-bar",d.style.cssText=`
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
  `;let l=document.createElement("button");l.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: ${c}; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    box-shadow: 0 4px 14px ${c}40;
    cursor: pointer; transition: all 0.15s ease;
  `,l.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let G=document.createElement("div");G.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let T=document.createElement("div");T.id="omnidesk-waveform",T.style.cssText="display: none; align-items: center; gap: 2.5px; height: 14px;";let de=[12,8,14,6,10],se=[];de.forEach(a=>{let r=document.createElement("span");r.style.cssText=`width: 2.5px; height: ${Math.round(a*.35)}px; background: ${c}; border-radius: 1px; transition: height 0.12s ease;`,T.appendChild(r),se.push(r)}),G.appendChild(T);let b=document.createElement("span");b.id="omnidesk-timer",b.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,b.innerText="0:00",G.appendChild(b),K.appendChild(l),K.appendChild(G),o.appendChild(M),o.appendChild(y),o.appendChild(d),o.appendChild(K),P.appendChild(te),P.appendChild(Z),P.appendChild(o),document.body.appendChild(P);function ye(){W=Date.now(),b.innerText="0:00",b.style.background=t?"#18181b":"#000000",b.style.color="#ffffff",b.style.border=t?"1px solid #27272a":"none",R&&clearInterval(R),R=setInterval(()=>{let a=Date.now()-W,r=Math.floor(a/1e3),u=Math.floor(r/60),p=r%60;b.innerText=`${u}:${String(p).padStart(2,"0")}`},250)}function j(){R&&(clearInterval(R),R=null),b.style.background="#f4f4f5",b.style.color="#71717a",b.style.border="none",b.innerText="0:00",T.style.display="none"}function ce(a){ae=a,o.style.display=a?"flex":"none"}function ie(a){re=a,Z.style.display=a?"block":"none",a?(o.style.top="50%",o.style.left="50%",o.style.bottom="auto",o.style.right="auto",o.style.transform="translate(-50%, -50%)",o.style.width="calc(100vw - 40px)",o.style.maxWidth="1140px",o.style.height="calc(100vh - 40px)",o.style.maxHeight="900px"):(o.style.top="auto",o.style.left=J?"20px":"auto",o.style.right=J?"auto":"20px",o.style.bottom="80px",o.style.transform="none",o.style.width="390px",o.style.maxWidth="calc(100vw - 32px)",o.style.height="560px",o.style.maxHeight="calc(100vh - 100px)")}Y.onclick=()=>ce(!ae),M.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{ce(!1),ie(!1)}),M.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{ie(!re)});let be=d.querySelector("#omnidesk-email-form"),Q=d.querySelector("#omnidesk-email-input");d.querySelector("#omnidesk-email-close-btn").addEventListener("click",()=>{d.style.display="none"}),be.addEventListener("submit",a=>{a.preventDefault();let r=Q.value.trim();if(!r||!r.includes("@"))return;A&&A.sendEmailInput(r),E=!0,d.style.display="none",Q.value="",B.style.display="none";let u=document.createElement("div");u.style.cssText=`
      display: flex; flex-direction: column; gap: 4px; max-width: 88%;
      align-self: flex-end;
    `;let p=document.createElement("div");p.style.cssText=`
      padding: 10px 14px; border-radius: 14px 14px 2px 14px;
      font-size: 13px; line-height: 1.45;
      background: ${c}; color: #ffffff;
      box-shadow: 0 2px 8px ${c}35;
    `,p.innerText=`My email is ${r}`,u.appendChild(p),y.insertBefore(u,x),x.style.display="flex",y.scrollTop=y.scrollHeight,U="user",I=p,z=!0});async function pe(){me=!1,D=!1,E=!1,d.style.display="none",x.style.display="none",U=null,I=null,z=!1;let a=M.querySelector("#omnidesk-status-text"),r=M.querySelector("#omnidesk-status-dot"),u=l.querySelector("#omnidesk-btn-text");a.innerText="Connecting...",r.style.background="#eab308",u.innerText="Connecting...",l.style.background="#64748b",l.style.boxShadow="none",l.disabled=!0,ye();try{let p=n;if(!p&&typeof document<"u"){let i=document.querySelector("script[src*='widget.js']");if(i&&i.src&&i.src.startsWith("http"))try{p=new URL(i.src).origin}catch{}}!p&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(p=window.location.origin);let ke=(p||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),ne=await fetch(`${ke}/api/token?businessId=${encodeURIComponent(f)}`);if(!ne.ok)throw new Error(`Failed to get session token (${ne.status})`);let q=await ne.json();if(q.business_name&&!s){let i=M.querySelector("#omnidesk-biz-title");i&&(i.innerText=q.business_name)}let we=m||q.agent_id||"";A=new ee({onStatusChange:i=>{if(V=i,i==="connected")a.innerText="Live \xB7 Speaking",r.style.background="#22c55e",u.innerText="End Voice Call",l.style.background="#dc2626",l.style.boxShadow="0 4px 14px rgba(220, 38, 38, 0.35)",l.disabled=!1,T.style.display="flex",W=Date.now(),_?.();else if(i==="idle"&&(a.innerText="Idle \xB7 Ready",r.style.background=t?"rgba(255,255,255,0.4)":"#a1a1aa",u.innerText="Start Voice Call",l.style.background=c,l.style.boxShadow=`0 4px 14px ${c}40`,l.disabled=!1,T.style.display="none",d.style.display="none",x.style.display="none",j(),W>0)){let e=Math.round((Date.now()-W)/1e3);W=0,$?.(e)}},onThinkingChange:i=>{i&&(x.style.display="flex",y.scrollTop=y.scrollHeight)},onTranscript:i=>{if(B.style.display="none",i.who==="user"){i.isFinal&&(x.style.display="flex");let e=i.text.toLowerCase().trim();(e==="no"||e.startsWith("no ")||e.includes("no,")||e.includes("wrong")||e.includes("incorrect")||e.includes("change my email")||e.includes("different email")||e.includes("that's not right")||e.includes("thats not right")||e.includes("not right")||e.includes("not my email"))&&(E=!1,d.style.display="flex",setTimeout(()=>Q.focus(),60)),(e==="yes"||e.startsWith("yes ")||e.includes("yes,")||e==="yeah"||e.startsWith("yeah ")||e==="yep"||e==="correct"||e.includes("that's right")||e.includes("thats right")||e.includes("sounds good")||e==="confirm"||e==="sure")&&E&&(E=!1,d.style.display="none"),(i.text.includes("@")||e.includes(" at ")&&e.includes(" dot ")||e.includes("gmail.com")||e.includes("yahoo.com")||e.includes("outlook.com")||e.includes("hotmail.com")||e.includes("icloud.com"))&&(d.style.display="none",E=!0)}else if(i.who==="agent"){i.text&&i.text.trim().length>0&&(x.style.display="none");let e=i.text.toLowerCase();if(e.includes("confirmation code is")||e.includes("booking is confirmed")||e.includes("scheduled your appointment")||e.includes("all set, your appointment")||e.includes("sent your confirmation")&&(e.includes("code")||e.includes("calendar invite"))||e.includes("sent a calendar invite")&&(e.includes("code")||e.includes("all set"))){D=!0,E=!1,d.style.display="none";return}if(D){d.style.display="none";return}if(e.includes("confirm with yes or no")||e.includes("yes or no")||e.includes("is that correct")||e.includes("is that right")||e.includes("verified your email")||e.includes("checking that email")||e.includes("let me check that email")){E=!0,d.style.display="none";return}!E&&(e.includes("what is your email")||e.includes("what's your email")||e.includes("whats your email")||e.includes("may i have your email")||e.includes("can i have your email")||e.includes("could i have your email")||e.includes("could i get your email")||e.includes("could you provide your email")||e.includes("can you provide your email")||e.includes("provide your email")||e.includes("enter your email")||e.includes("share your email")||e.includes("need your email")||e.includes("what is your correct email")||e.includes("provide your correct email")||e.includes("where can i send your confirmation")||e.includes("where should i send your confirmation")||e.includes("where can i send your calendar")||e.includes("where should i send your calendar")||e.includes("email address")&&(e.includes("what is")||e.includes("what's")||e.includes("whats")||e.includes("may i have")||e.includes("can i have")||e.includes("could i have")||e.includes("could you provide")||e.includes("can you provide")||e.includes("provide")||e.includes("share")||e.includes("so i can send")||e.includes("to send your")))?(d.style.display="flex",setTimeout(()=>Q.focus(),60)):i.isFinal&&(d.style.display="none")}if(U===i.who&&I&&!z)I.innerText=i.text,z=!!i.isFinal;else{let e=i.who==="user",N=document.createElement("div");if(N.style.cssText=`
              display: flex; flex-direction: column; gap: 4px; max-width: 88%;
              align-self: ${e?"flex-end":"flex-start"};
            `,e){let k=document.createElement("div");k.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 2px 14px;
                font-size: 13px; line-height: 1.45;
                background: ${c};
                color: #ffffff;
                box-shadow: 0 2px 8px ${c}35;
              `,k.innerText=i.text,N.appendChild(k),I=k}else{let k=document.createElement("div");k.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let H=document.createElement("div");H.style.cssText=`
                width: 24px; height: 24px; border-radius: 50%; background: #18181b;
                display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;
              `,H.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let O=document.createElement("div");O.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 14px 2px;
                font-size: 13px; line-height: 1.45;
                background: ${t?"#18181b":"#f4f4f5"};
                color: ${t?"#fafafa":"#09090b"};
                border: ${t?"1px solid #27272a":"none"};
                box-shadow: 0 1px 2px rgba(0,0,0,0.04);
              `,O.innerText=i.text,k.appendChild(H),k.appendChild(O),N.appendChild(k),I=O}y.insertBefore(N,x),U=i.who,z=!!i.isFinal}y.scrollTop=y.scrollHeight,S?.(i)},onAudioLevel:(i,e)=>{if(xe=i,ge=e,V==="connected"){T.style.display="flex";let N=Math.max(i,e);de.forEach((k,H)=>{let O=Math.max(4,Math.min(14,Math.round(k*(.35+N*1.5))));se[H]&&(se[H].style.height=`${O}px`)})}},onError:()=>{a.innerText="Error",r.style.background="#ef4444",u.innerText="Start Voice Call",l.style.background=c,l.style.boxShadow=`0 4px 14px ${c}40`,l.disabled=!1,T.style.display="none",d.style.display="none",x.style.display="none",j()}}),await A.start(q.token,we,q.voice)}catch(p){console.error("[OmniDesk Voice Widget Error]:",p),a.innerText="Error",r.style.background="#ef4444",u.innerText="Start Voice Call",l.style.background=c,l.style.boxShadow=`0 4px 14px ${c}40`,l.disabled=!1,T.style.display="none",d.style.display="none",x.style.display="none",j()}}function ue(){A&&(A.stop(),A=null),V="idle";let a=M.querySelector("#omnidesk-status-text"),r=M.querySelector("#omnidesk-status-dot"),u=l.querySelector("#omnidesk-btn-text");a&&(a.innerText="Idle \xB7 Ready"),r&&(r.style.background=t?"rgba(255,255,255,0.4)":"#a1a1aa"),u&&(u.innerText="Start Voice Call"),l.style.background=c,l.style.boxShadow=`0 4px 14px ${c}40`,l.disabled=!1,T.style.display="none",d.style.display="none",x.style.display="none",D=!1,E=!1,j()}return l.onclick=()=>{V==="connected"?ue():V==="idle"&&pe()},{destroy:()=>{j(),A&&A.stop(),P.remove()},startCall:pe,endCall:ue}}if(typeof document<"u"){let h=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(h){let n,f=h.src||"";if(f&&f.startsWith("http"))try{n=new URL(f).origin}catch{}let m=h.getAttribute("data-business-id")||void 0,C=h.getAttribute("data-agent")||void 0,F=h.getAttribute("data-theme")||"dark",w=h.getAttribute("data-accent")||"emerald",L=h.getAttribute("data-position")||"bottom-right",g=h.getAttribute("data-label")||void 0,s=h.getAttribute("data-host")||n||"https://omni-desk-rho.vercel.app",v=h.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{fe({businessId:m,agentId:C,theme:F,accent:w,position:L,label:g,host:s,greeting:v})}):fe({businessId:m,agentId:C,theme:F,accent:w,position:L,label:g,host:s,greeting:v})}}export{fe as initOmniDeskWidget};
//# sourceMappingURL=vanilla.mjs.map