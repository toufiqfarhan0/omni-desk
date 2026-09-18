var R=24e3,J="wss://agents.assemblyai.com/v1/ws",K=`
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${R};
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
`,G=`
  class PlaybackProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ring = new Float32Array(sampleRate * 30);
      this._writePos = 0;
      this._readPos = 0;
      this._available = 0;
      this._step = ${R} / sampleRate;
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
`;async function V(a,n,d){let o=URL.createObjectURL(new Blob([n],{type:"application/javascript"}));try{await a.audioWorklet.addModule(o)}finally{URL.revokeObjectURL(o)}return new AudioWorkletNode(a,d)}var I=class{constructor(n){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.callbacks=n}async start(n,d){try{this.callbacks.onStatusChange?.("connecting");let o=window.AudioContext||window.webkitAudioContext;this.captureCtx=new o({sampleRate:R}),this.playbackCtx=new o({sampleRate:R}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await V(this.playbackCtx,G,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await V(this.captureCtx,K,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let f=new URL(J);f.searchParams.set("token",n),this.ws=new WebSocket(f.toString()),this.captureNode.port.onmessage=({data:u})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let t=new Uint8Array(u),r="";for(let p=0;p<t.length;p+=32768)r+=String.fromCharCode.apply(null,Array.from(t.subarray(p,p+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(r)}));let h=new Int16Array(u),g=0;for(let p=0;p<h.length;p+=16)g+=Math.abs(h[p]);this.userLevel=Math.min(1,g/(h.length/16)/8e3)},this.ws.onopen=()=>{d&&d.trim()&&this.ws?.send(JSON.stringify({type:"session.update",session:{agent_id:d.trim()}}))},this.ws.onmessage=({data:u})=>{try{let t=JSON.parse(u);switch(t.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0;break;case"transcript.user":t.text&&this.callbacks.onTranscript?.({who:"user",text:t.text});break;case"transcript.agent":t.text&&this.callbacks.onTranscript?.({who:"agent",text:t.text});break;case"reply.audio":if(t.data&&this.playbackNode){let r=atob(t.data),h=new Uint8Array(r.length);for(let g=0;g<r.length;g++)h[g]=r.charCodeAt(g);this.playbackNode.port.postMessage(h.buffer,[h.buffer]),this.agentLevel=.8}break;case"reply.done":t.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:t.name||t.tool,args:t.arguments||t.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:t.name||t.tool,result:t.result});break;case"session.error":this.callbacks.onError?.(t.message||t.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.stop();break}}catch(t){console.warn("Message parsing error:",t)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(o){this.callbacks.onError?.(o.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(n){this.isMuted=n,n&&(this.userLevel=0)}getMuted(){return this.isMuted}stop(){if(this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(n=>n.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let n=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(n)};this.animFrameId=requestAnimationFrame(n)}};var Y={slate:"#18181b",purple:"#7c3aed",blue:"#2563eb",emerald:"#059669"};function B(a={}){if(typeof window>"u")return;let{host:n,businessId:d="biz_demo_dental",agentId:o,theme:f="dark",position:u="bottom-right",label:t="Talk to Receptionist",accent:r="slate",accentColor:h,suggestions:g,onCallStart:p,onCallEnd:q,onTranscript:D}=a,k=h||Y[r]||r||"#18181b",H=document.getElementById("omnidesk-voice-widget-root");H&&H.remove();let m=document.createElement("div");m.id="omnidesk-voice-widget-root",m.style.fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let v=f==="dark"||f==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,i={bg:v?"#09090b":"#ffffff",cardBg:v?"#121215":"#f4f4f5",border:v?"#27272a":"#e4e4e7",text:v?"#fafafa":"#09090b",textMuted:v?"#a1a1aa":"#71717a",bubbleAgent:v?"#18181b":"#f4f4f5",bubbleUser:k,userText:"#ffffff"},b=null,T="idle",w=!1,L=0,z=!1,A=u==="bottom-left",_=document.createElement("div");_.style.cssText=`
    position: fixed; bottom: 24px; ${A?"left: 24px;":"right: 24px;"}
    z-index: 999999;
  `;let E=document.createElement("button");E.style.cssText=`
    display: flex; align-items: center; gap: 10px;
    padding: 12px 20px; border-radius: 9999px;
    background: ${i.bg}; color: ${i.text};
    border: 1px solid ${i.border};
    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.2);
    cursor: pointer; font-weight: 600; font-size: 14px;
    transition: all 0.2s ease;
  `,E.innerHTML=`
    <span style="width:10px;height:10px;border-radius:50%;background:#71717a;display:inline-block;"></span>
    <span>${t}</span>
  `,_.appendChild(E);let C=document.createElement("div");C.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.65);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    z-index: 999998; display: none;
  `;let e=document.createElement("div");e.style.cssText=`
    position: fixed; bottom: 24px; ${A?"left: 24px;":"right: 24px;"}
    width: 370px; height: 560px; max-height: 85vh;
    background: ${i.bg}; border: 1px solid ${i.border};
    border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  `;let x=document.createElement("div");x.style.cssText=`
    padding: 14px 18px; border-bottom: 1px solid ${i.border};
    display: flex; align-items: center; justify-content: space-between;
    background: ${i.cardBg};
  `,x.innerHTML=`
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="width: 34px; height: 34px; border-radius: 50%; background: ${k}; color: #fff; display: grid; place-items: center; font-size: 14px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
      </div>
      <div>
        <div style="font-weight:700;font-size:14px;color:${i.text};" id="omnidesk-biz-title">AI Receptionist</div>
        <div style="font-size:11px;color:${i.textMuted};margin-top:2px;display:flex;align-items:center;gap:6px;" id="omnidesk-status-text">
          <span style="width:7px;height:7px;border-radius:50%;background:#71717a;display:inline-block;"></span> Ready
        </div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;">
      <button id="omnidesk-expand-btn" style="background:transparent;border:none;color:${i.textMuted};cursor:pointer;padding:6px;font-size:15px;" title="Expand">\u2922</button>
      <button id="omnidesk-close-btn" style="background:transparent;border:none;color:${i.textMuted};cursor:pointer;padding:6px;font-size:15px;" title="Close">\u2715</button>
    </div>
  `;let S=document.createElement("div");S.style.cssText=`
    flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px;
  `;let P=document.createElement("div");P.style.cssText=`
    padding: 14px 16px; border-top: 1px solid ${i.border};
    background: ${i.cardBg}; display: flex; gap: 10px;
  `;let c=document.createElement("button");c.style.cssText=`
    display: none; flex: 1; padding: 10px; border-radius: 10px; border: 1px solid ${i.border};
    background: ${i.bg}; color: ${i.text}; font-size: 12.5px; font-weight: 600; cursor: pointer;
  `,c.innerText="Mute Mic";let s=document.createElement("button");s.style.cssText=`
    width: 100%; padding: 11px; border-radius: 10px; border: none;
    background: ${k}; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
    transition: all 0.15s ease;
  `,s.innerText="Start Call",P.appendChild(c),P.appendChild(s),e.appendChild(x),e.appendChild(S),e.appendChild(P),m.appendChild(C),m.appendChild(_),m.appendChild(e),document.body.appendChild(m);function W(y){z=y,y?(C.style.display="block",e.style.top="50%",e.style.left="50%",e.style.bottom="auto",e.style.right="auto",e.style.transform="translate(-50%, -50%)",e.style.width="min(640px, 92vw)",e.style.height="min(720px, 86vh)",e.style.maxHeight="800px",e.style.borderRadius="24px",x.querySelector("#omnidesk-expand-btn").innerHTML="\u2199"):(C.style.display="none",e.style.top="auto",e.style.left=A?"24px":"auto",e.style.bottom="24px",e.style.right=A?"auto":"24px",e.style.transform="none",e.style.width="370px",e.style.height="560px",e.style.maxHeight="85vh",e.style.borderRadius="20px",x.querySelector("#omnidesk-expand-btn").innerHTML="\u2922")}E.onclick=()=>{_.style.display="none",e.style.display="flex",T==="idle"&&U()},x.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{e.style.display="none",C.style.display="none",_.style.display="block",W(!1)}),x.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{W(!z)}),C.addEventListener("click",()=>{W(!1)}),c.onclick=()=>{b&&(w=!w,b.setMuted(w),c.innerText=w?"Unmute Mic":"Mute Mic",c.style.background=w?"#ef4444":i.bg,c.style.color=w?"#fff":i.text)};async function U(){let y=x.querySelector("#omnidesk-status-text");y.innerHTML='<span style="width:7px;height:7px;border-radius:50%;background:#f59e0b;display:inline-block;"></span> Connecting...',s.innerText="Connecting...",s.disabled=!0;try{let F=n?n.replace(/\/$/,""):typeof window<"u"?window.location.origin:"",O=await fetch(`${F}/api/token?businessId=${encodeURIComponent(d)}`);if(!O.ok)throw new Error("Failed to get session token");let $=await O.json();if($.business_name){let l=x.querySelector("#omnidesk-biz-title");l&&(l.innerText=$.business_name)}let j=o||$.agent_id||"";b=new I({onStatusChange:l=>{if(T=l,l==="connected")y.innerHTML='<span style="width:7px;height:7px;border-radius:50%;background:#10b981;display:inline-block;"></span> Live Receptionist',s.innerText="End Call",s.style.background="#ef4444",s.style.width="auto",s.style.flex="1",s.disabled=!1,c.style.display="block",L=Date.now(),p?.();else if(l==="idle"&&(y.innerHTML='<span style="width:7px;height:7px;border-radius:50%;background:#71717a;display:inline-block;"></span> Call Ended',s.innerText="Start Call",s.style.background=k,s.style.width="100%",s.disabled=!1,c.style.display="none",L>0)){let M=Math.round((Date.now()-L)/1e3);L=0,q?.(M)}},onTranscript:l=>{let M=document.createElement("div"),N=l.who==="user";M.style.cssText=`
            display: flex; justify-content: ${N?"flex-end":"flex-start"};
          `,M.innerHTML=`
            <div style="max-width:${z?"70%":"82%"};padding:9px 13px;border-radius:${N?"14px 14px 2px 14px":"14px 14px 14px 2px"};background:${N?i.bubbleUser:i.bubbleAgent};color:${N?i.userText:i.text};font-size:13px;line-height:1.45;">
              ${l.text}
            </div>
          `,S.appendChild(M),S.scrollTop=S.scrollHeight,D?.(l)},onError:l=>{y.innerHTML=`<span style="width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block;"></span> Error: ${l}`,s.innerText="Start Call",s.style.background=k,s.style.width="100%",s.disabled=!1,c.style.display="none"}}),await b.start($.token,j)}catch(F){y.innerHTML=`<span style="width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block;"></span> ${F.message||"Connection failed"}`,s.innerText="Start Call",s.style.background=k,s.style.width="100%",s.disabled=!1,c.style.display="none"}}return s.onclick=()=>{T==="connected"&&b?(b.stop(),b=null):T==="idle"&&U()},{destroy:()=>{b&&b.stop(),m.remove()},startCall:U}}if(typeof document<"u"){let a=document.currentScript||document.querySelector("script[data-agent], script[data-business-id]");if(a){let n=a.getAttribute("data-business-id")||void 0,d=a.getAttribute("data-agent")||void 0,o=a.getAttribute("data-theme")||"dark",f=a.getAttribute("data-accent")||"slate",u=a.getAttribute("data-position")||"bottom-right",t=a.getAttribute("data-label")||void 0,r=a.getAttribute("data-host")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{B({businessId:n,agentId:d,theme:o,accent:f,position:u,label:t,host:r})}):B({businessId:n,agentId:d,theme:o,accent:f,position:u,label:t,host:r})}}export{B as initOmniDeskWidget};
//# sourceMappingURL=vanilla.mjs.map