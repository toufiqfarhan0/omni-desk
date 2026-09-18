var N=24e3,ee="wss://agents.assemblyai.com/v1/ws",te=`
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${N};
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
`,se=`
  class PlaybackProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ring = new Float32Array(sampleRate * 30);
      this._writePos = 0;
      this._readPos = 0;
      this._available = 0;
      this._step = ${N} / sampleRate;
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
`;async function q(o,s,p){let r=URL.createObjectURL(new Blob([s],{type:"application/javascript"}));try{await o.audioWorklet.addModule(r)}finally{URL.revokeObjectURL(r)}return new AudioWorkletNode(o,p)}var $=class{constructor(s){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.callbacks=s}async start(s,p){try{this.callbacks.onStatusChange?.("connecting");let r=window.AudioContext||window.webkitAudioContext;this.captureCtx=new r({sampleRate:N}),this.playbackCtx=new r({sampleRate:N}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await q(this.playbackCtx,se,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await q(this.captureCtx,te,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let f=new URL(ee);f.searchParams.set("token",s),this.ws=new WebSocket(f.toString()),this.captureNode.port.onmessage=({data:b})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let e=new Uint8Array(b),l="";for(let h=0;h<e.length;h+=32768)l+=String.fromCharCode.apply(null,Array.from(e.subarray(h,h+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(l)}));let c=new Int16Array(b),u=0;for(let h=0;h<c.length;h+=16)u+=Math.abs(c[h]);this.userLevel=Math.min(1,u/(c.length/16)/8e3)},this.ws.onopen=()=>{p&&p.trim()&&this.ws?.send(JSON.stringify({type:"session.update",session:{agent_id:p.trim()}}))},this.ws.onmessage=({data:b})=>{try{let e=JSON.parse(b);switch(e.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0;break;case"transcript.user":e.text&&this.callbacks.onTranscript?.({who:"user",text:e.text});break;case"transcript.agent":e.text&&this.callbacks.onTranscript?.({who:"agent",text:e.text});break;case"reply.audio":if(e.data&&this.playbackNode){let l=atob(e.data),c=new Uint8Array(l.length);for(let u=0;u<l.length;u++)c[u]=l.charCodeAt(u);this.playbackNode.port.postMessage(c.buffer,[c.buffer]),this.agentLevel=.8}break;case"reply.done":e.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:e.name||e.tool,args:e.arguments||e.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:e.name||e.tool,result:e.result});break;case"session.error":this.callbacks.onError?.(e.message||e.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.stop();break}}catch(e){console.warn("Message parsing error:",e)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(r){this.callbacks.onError?.(r.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(s){this.isMuted=s,s&&(this.userLevel=0)}getMuted(){return this.isMuted}stop(){if(this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(s=>s.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let s=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(s)};this.animFrameId=requestAnimationFrame(s)}};var ie={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"},j=[8,14,18,11,16,20,12,6,15];function J(o={}){if(typeof window>"u")return;let{host:s,businessId:p="biz_demo_dental",agentId:r,theme:f="dark",position:b="bottom-right",label:e="Talk to Receptionist",accent:l="emerald",accentColor:c,businessName:u,greeting:h,onCallStart:G,onCallEnd:K,onTranscript:Q}=o,d=c||ie[l]||l||"#10b981",U=document.getElementById("omnidesk-voice-widget-root");U&&U.remove();let v=document.createElement("div");v.id="omnidesk-voice-widget-root",v.style.fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let x=f==="dark"||f==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,i={bg:x?"#18181b":"#ffffff",headerBg:x?"#09090b":"#f4f4f5",border:x?"#27272a":"#e4e4e7",text:x?"#fafafa":"#09090b",textMuted:x?"#a1a1aa":"#71717a",bubbleAgent:x?"#27272a":"#f4f4f5",bubbleUser:d,userText:"#ffffff",agentText:x?"#f4f4f5":"#09090b"},y=null,S="idle",L=0,z=!1,Y=0,X=0,B=b==="bottom-left",Z=h||"Hello! Welcome to OmniDesk. Would you like to check availability or book a consultation?",M=document.createElement("div");M.style.cssText=`
    position: fixed; bottom: 20px; ${B?"left: 20px;":"right: 20px;"};
    z-index: 999999;
  `;let E=document.createElement("button");E.style.cssText=`
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${i.bg}; color: ${i.text};
    border: 1px solid ${i.border};
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `,E.innerHTML=`
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${d};box-shadow:0 0 8px ${d};display:inline-block;"></span>
    <span>${e}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,M.appendChild(E);let k=document.createElement("div");k.style.cssText=`
    position: fixed; bottom: 70px; ${B?"left: 20px;":"right: 20px;"};
    width: 320px; height: 280px;
    background: ${i.bg}; border: 1px solid ${i.border};
    border-radius: 18px; box-shadow: 0 20px 30px -10px rgba(0,0,0,0.4);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;let w=document.createElement("div");w.style.cssText=`
    padding: 12px 16px; border-bottom: 1px solid ${i.border};
    display: flex; align-items: center; justify-content: space-between;
    background: ${i.headerBg};
  `,w.innerHTML=`
    <div>
      <div style="font-size:13px;font-weight:700;color:${i.text};" id="omnidesk-biz-title">${u||"OmniDesk AI Receptionist"}</div>
      <div style="font-size:10.5px;color:${d};font-weight:600;" id="omnidesk-status-text">Ready to connect</div>
    </div>
    <button id="omnidesk-close-btn" style="background:transparent;border:none;color:${i.textMuted};cursor:pointer;padding:4px;font-size:14px;" title="Close">\u2715</button>
  `;let C=document.createElement("div");C.style.cssText=`
    flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px;
  `;let R=document.createElement("div");R.style.cssText=`
    align-self: flex-start; background: ${i.bubbleAgent}; color: ${i.agentText};
    padding: 8px 12px; border-radius: 12px; font-size: 12px; max-width: 85%; line-height: 1.4;
  `,R.innerText=Z,C.appendChild(R);let P=document.createElement("div");P.style.cssText=`
    padding: 10px 14px; border-top: 1px solid ${i.border};
    display: flex; align-items: center; justify-content: space-between;
  `;let I=document.createElement("div");I.style.cssText=`
    display: flex; align-items: center; gap: 3px; height: 18px;
  `,j.forEach(()=>{let a=document.createElement("div");a.className="omnidesk-freq-bar",a.style.cssText=`
      width: 3px; height: 4px; border-radius: 2px;
      background: ${d}; opacity: 0.7; transition: height 0.15s ease;
    `,I.appendChild(a)});let t=document.createElement("button");t.style.cssText=`
    padding: 7px 16px; border-radius: 9999px; border: none;
    background: ${d}; color: #ffffff; font-size: 12px; font-weight: 700; cursor: pointer;
    box-shadow: 0 2px 8px rgba(16,185,129,0.3); transition: all 0.15s ease;
  `,t.innerText="Start Call",P.appendChild(I),P.appendChild(t),k.appendChild(w),k.appendChild(C),k.appendChild(P),v.appendChild(M),v.appendChild(k),document.body.appendChild(v);function T(a,g){k.querySelectorAll(".omnidesk-freq-bar").forEach((A,_)=>{let F=j[_],n=a?Math.max(5,Math.min(18,Math.round(F*(.35+g*1.5)))):4;A.style.height=`${n}px`,A.style.opacity=a?"1":"0.7"})}function D(a){z=a,k.style.display=a?"flex":"none"}E.onclick=()=>{D(!z)},w.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{D(!1)});async function H(){let a=w.querySelector("#omnidesk-status-text"),g=M.querySelector("#omnidesk-trigger-dot");a.innerText="Connecting...",t.innerText="Connecting...",t.disabled=!0;try{let W=s?s.replace(/\/$/,""):typeof window<"u"?window.location.origin:"",A=await fetch(`${W}/api/token?businessId=${encodeURIComponent(p)}`);if(!A.ok)throw new Error("Failed to get session token");let _=await A.json();if(_.business_name&&!u){let n=w.querySelector("#omnidesk-biz-title");n&&(n.innerText=`${_.business_name} AI Receptionist`)}let F=r||_.agent_id||"";y=new $({onStatusChange:n=>{if(S=n,n==="connected")a.innerText="Live Voice Call (24kHz)",t.innerText="End Call",t.style.background="#ef4444",t.style.boxShadow="0 2px 8px rgba(239,68,68,0.3)",t.disabled=!1,g&&(g.style.background="#ef4444",g.style.boxShadow="0 0 8px #ef4444"),L=Date.now(),G?.();else if(n==="idle"&&(a.innerText="Ready to connect",t.innerText="Start Call",t.style.background=d,t.style.boxShadow="0 2px 8px rgba(16,185,129,0.3)",t.disabled=!1,g&&(g.style.background=d,g.style.boxShadow=`0 0 8px ${d}`),T(!1,0),L>0)){let m=Math.round((Date.now()-L)/1e3);L=0,K?.(m)}},onTranscript:n=>{let m=document.createElement("div"),O=n.who==="user";m.style.cssText=`
            align-self: ${O?"flex-end":"flex-start"};
            background: ${O?i.bubbleUser:i.bubbleAgent};
            color: ${O?i.userText:i.agentText};
            padding: 8px 12px; border-radius: 12px; font-size: 12px; max-width: 85%; line-height: 1.4;
          `,m.innerText=n.text,C.appendChild(m),C.scrollTop=C.scrollHeight,Q?.(n)},onAudioLevel:(n,m)=>{Y=n,X=m,T(S==="connected",Math.max(n,m))},onError:n=>{a.innerText="Connection error",t.innerText="Start Call",t.style.background=d,t.disabled=!1,T(!1,0)}}),await y.start(_.token,F)}catch{a.innerText="Connection failed",t.innerText="Start Call",t.style.background=d,t.disabled=!1,T(!1,0)}}function V(){y&&(y.stop(),y=null),S="idle",T(!1,0)}return t.onclick=()=>{S==="connected"?V():S==="idle"&&H()},{destroy:()=>{y&&y.stop(),v.remove()},startCall:H,endCall:V}}if(typeof document<"u"){let o=document.currentScript||document.querySelector("script[data-agent], script[data-business-id]");if(o){let s=o.getAttribute("data-business-id")||void 0,p=o.getAttribute("data-agent")||void 0,r=o.getAttribute("data-theme")||"dark",f=o.getAttribute("data-accent")||"emerald",b=o.getAttribute("data-position")||"bottom-right",e=o.getAttribute("data-label")||void 0,l=o.getAttribute("data-host")||void 0,c=o.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{J({businessId:s,agentId:p,theme:r,accent:f,position:b,label:e,host:l,greeting:c})}):J({businessId:s,agentId:p,theme:r,accent:f,position:b,label:e,host:l,greeting:c})}}export{J as initOmniDeskWidget};
//# sourceMappingURL=vanilla.mjs.map