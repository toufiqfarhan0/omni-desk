"use strict";var H=Object.defineProperty;var K=Object.getOwnPropertyDescriptor;var G=Object.getOwnPropertyNames;var Y=Object.prototype.hasOwnProperty;var Z=(n,t)=>{for(var o in t)H(n,o,{get:t[o],enumerable:!0})},Q=(n,t,o,r)=>{if(t&&typeof t=="object"||typeof t=="function")for(let l of G(t))!Y.call(n,l)&&l!==o&&H(n,l,{get:()=>t[l],enumerable:!(r=K(t,l))||r.enumerable});return n};var X=n=>Q(H({},"__esModule",{value:!0}),n);var nt={};Z(nt,{initOmniDeskWidget:()=>O});module.exports=X(nt);var R=24e3,tt="wss://agents.assemblyai.com/v1/ws",et=`
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
`,st=`
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
`;async function q(n,t,o){let r=URL.createObjectURL(new Blob([t],{type:"application/javascript"}));try{await n.audioWorklet.addModule(r)}finally{URL.revokeObjectURL(r)}return new AudioWorkletNode(n,o)}var I=class{constructor(t){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.callbacks=t}async start(t,o){try{this.callbacks.onStatusChange?.("connecting");let r=window.AudioContext||window.webkitAudioContext;this.captureCtx=new r({sampleRate:R}),this.playbackCtx=new r({sampleRate:R}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await q(this.playbackCtx,st,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await q(this.captureCtx,et,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let l=new URL(tt);l.searchParams.set("token",t),this.ws=new WebSocket(l.toString()),this.captureNode.port.onmessage=({data:h})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let e=new Uint8Array(h),c="";for(let u=0;u<e.length;u+=32768)c+=String.fromCharCode.apply(null,Array.from(e.subarray(u,u+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(c)}));let b=new Int16Array(h),g=0;for(let u=0;u<b.length;u+=16)g+=Math.abs(b[u]);this.userLevel=Math.min(1,g/(b.length/16)/8e3)},this.ws.onopen=()=>{o&&o.trim()&&this.ws?.send(JSON.stringify({type:"session.update",session:{agent_id:o.trim()}}))},this.ws.onmessage=({data:h})=>{try{let e=JSON.parse(h);switch(e.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0;break;case"transcript.user":e.text&&this.callbacks.onTranscript?.({who:"user",text:e.text});break;case"transcript.agent":e.text&&this.callbacks.onTranscript?.({who:"agent",text:e.text});break;case"reply.audio":if(e.data&&this.playbackNode){let c=atob(e.data),b=new Uint8Array(c.length);for(let g=0;g<c.length;g++)b[g]=c.charCodeAt(g);this.playbackNode.port.postMessage(b.buffer,[b.buffer]),this.agentLevel=.8}break;case"reply.done":e.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:e.name||e.tool,args:e.arguments||e.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:e.name||e.tool,result:e.result});break;case"session.error":this.callbacks.onError?.(e.message||e.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.stop();break}}catch(e){console.warn("Message parsing error:",e)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(r){this.callbacks.onError?.(r.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(t){this.isMuted=t,t&&(this.userLevel=0)}getMuted(){return this.isMuted}stop(){if(this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(t=>t.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let t=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(t)};this.animFrameId=requestAnimationFrame(t)}};var it={slate:"#18181b",purple:"#7c3aed",blue:"#2563eb",emerald:"#059669"};function O(n={}){if(typeof window>"u")return;let{host:t,businessId:o="biz_demo_dental",agentId:r,theme:l="dark",position:h="bottom-right",label:e="Talk to Receptionist",accent:c="slate",accentColor:b,suggestions:g,onCallStart:u,onCallEnd:D,onTranscript:j}=n,k=b||it[c]||c||"#18181b",V=document.getElementById("omnidesk-voice-widget-root");V&&V.remove();let m=document.createElement("div");m.id="omnidesk-voice-widget-root",m.style.fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let v=l==="dark"||l==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,a={bg:v?"#09090b":"#ffffff",cardBg:v?"#121215":"#f4f4f5",border:v?"#27272a":"#e4e4e7",text:v?"#fafafa":"#09090b",textMuted:v?"#a1a1aa":"#71717a",bubbleAgent:v?"#18181b":"#f4f4f5",bubbleUser:k,userText:"#ffffff"},x=null,T="idle",w=!1,L=0,z=!1,A=h==="bottom-left",_=document.createElement("div");_.style.cssText=`
    position: fixed; bottom: 24px; ${A?"left: 24px;":"right: 24px;"}
    z-index: 999999;
  `;let E=document.createElement("button");E.style.cssText=`
    display: flex; align-items: center; gap: 10px;
    padding: 12px 20px; border-radius: 9999px;
    background: ${a.bg}; color: ${a.text};
    border: 1px solid ${a.border};
    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.2);
    cursor: pointer; font-weight: 600; font-size: 14px;
    transition: all 0.2s ease;
  `,E.innerHTML=`
    <span style="width:10px;height:10px;border-radius:50%;background:#71717a;display:inline-block;"></span>
    <span>${e}</span>
  `,_.appendChild(E);let C=document.createElement("div");C.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.65);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    z-index: 999998; display: none;
  `;let s=document.createElement("div");s.style.cssText=`
    position: fixed; bottom: 24px; ${A?"left: 24px;":"right: 24px;"}
    width: 370px; height: 560px; max-height: 85vh;
    background: ${a.bg}; border: 1px solid ${a.border};
    border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  `;let f=document.createElement("div");f.style.cssText=`
    padding: 14px 18px; border-bottom: 1px solid ${a.border};
    display: flex; align-items: center; justify-content: space-between;
    background: ${a.cardBg};
  `,f.innerHTML=`
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="width: 34px; height: 34px; border-radius: 50%; background: ${k}; color: #fff; display: grid; place-items: center; font-size: 14px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
      </div>
      <div>
        <div style="font-weight:700;font-size:14px;color:${a.text};" id="omnidesk-biz-title">AI Receptionist</div>
        <div style="font-size:11px;color:${a.textMuted};margin-top:2px;display:flex;align-items:center;gap:6px;" id="omnidesk-status-text">
          <span style="width:7px;height:7px;border-radius:50%;background:#71717a;display:inline-block;"></span> Ready
        </div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;">
      <button id="omnidesk-expand-btn" style="background:transparent;border:none;color:${a.textMuted};cursor:pointer;padding:6px;font-size:15px;" title="Expand">\u2922</button>
      <button id="omnidesk-close-btn" style="background:transparent;border:none;color:${a.textMuted};cursor:pointer;padding:6px;font-size:15px;" title="Close">\u2715</button>
    </div>
  `;let S=document.createElement("div");S.style.cssText=`
    flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px;
  `;let P=document.createElement("div");P.style.cssText=`
    padding: 14px 16px; border-top: 1px solid ${a.border};
    background: ${a.cardBg}; display: flex; gap: 10px;
  `;let p=document.createElement("button");p.style.cssText=`
    display: none; flex: 1; padding: 10px; border-radius: 10px; border: 1px solid ${a.border};
    background: ${a.bg}; color: ${a.text}; font-size: 12.5px; font-weight: 600; cursor: pointer;
  `,p.innerText="Mute Mic";let i=document.createElement("button");i.style.cssText=`
    width: 100%; padding: 11px; border-radius: 10px; border: none;
    background: ${k}; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
    transition: all 0.15s ease;
  `,i.innerText="Start Call",P.appendChild(p),P.appendChild(i),s.appendChild(f),s.appendChild(S),s.appendChild(P),m.appendChild(C),m.appendChild(_),m.appendChild(s),document.body.appendChild(m);function W(y){z=y,y?(C.style.display="block",s.style.top="50%",s.style.left="50%",s.style.bottom="auto",s.style.right="auto",s.style.transform="translate(-50%, -50%)",s.style.width="min(640px, 92vw)",s.style.height="min(720px, 86vh)",s.style.maxHeight="800px",s.style.borderRadius="24px",f.querySelector("#omnidesk-expand-btn").innerHTML="\u2199"):(C.style.display="none",s.style.top="auto",s.style.left=A?"24px":"auto",s.style.bottom="24px",s.style.right=A?"auto":"24px",s.style.transform="none",s.style.width="370px",s.style.height="560px",s.style.maxHeight="85vh",s.style.borderRadius="20px",f.querySelector("#omnidesk-expand-btn").innerHTML="\u2922")}E.onclick=()=>{_.style.display="none",s.style.display="flex",T==="idle"&&U()},f.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{s.style.display="none",C.style.display="none",_.style.display="block",W(!1)}),f.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{W(!z)}),C.addEventListener("click",()=>{W(!1)}),p.onclick=()=>{x&&(w=!w,x.setMuted(w),p.innerText=w?"Unmute Mic":"Mute Mic",p.style.background=w?"#ef4444":a.bg,p.style.color=w?"#fff":a.text)};async function U(){let y=f.querySelector("#omnidesk-status-text");y.innerHTML='<span style="width:7px;height:7px;border-radius:50%;background:#f59e0b;display:inline-block;"></span> Connecting...',i.innerText="Connecting...",i.disabled=!0;try{let F=t?t.replace(/\/$/,""):typeof window<"u"?window.location.origin:"",B=await fetch(`${F}/api/token?businessId=${encodeURIComponent(o)}`);if(!B.ok)throw new Error("Failed to get session token");let $=await B.json();if($.business_name){let d=f.querySelector("#omnidesk-biz-title");d&&(d.innerText=$.business_name)}let J=r||$.agent_id||"";x=new I({onStatusChange:d=>{if(T=d,d==="connected")y.innerHTML='<span style="width:7px;height:7px;border-radius:50%;background:#10b981;display:inline-block;"></span> Live Receptionist',i.innerText="End Call",i.style.background="#ef4444",i.style.width="auto",i.style.flex="1",i.disabled=!1,p.style.display="block",L=Date.now(),u?.();else if(d==="idle"&&(y.innerHTML='<span style="width:7px;height:7px;border-radius:50%;background:#71717a;display:inline-block;"></span> Call Ended',i.innerText="Start Call",i.style.background=k,i.style.width="100%",i.disabled=!1,p.style.display="none",L>0)){let M=Math.round((Date.now()-L)/1e3);L=0,D?.(M)}},onTranscript:d=>{let M=document.createElement("div"),N=d.who==="user";M.style.cssText=`
            display: flex; justify-content: ${N?"flex-end":"flex-start"};
          `,M.innerHTML=`
            <div style="max-width:${z?"70%":"82%"};padding:9px 13px;border-radius:${N?"14px 14px 2px 14px":"14px 14px 14px 2px"};background:${N?a.bubbleUser:a.bubbleAgent};color:${N?a.userText:a.text};font-size:13px;line-height:1.45;">
              ${d.text}
            </div>
          `,S.appendChild(M),S.scrollTop=S.scrollHeight,j?.(d)},onError:d=>{y.innerHTML=`<span style="width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block;"></span> Error: ${d}`,i.innerText="Start Call",i.style.background=k,i.style.width="100%",i.disabled=!1,p.style.display="none"}}),await x.start($.token,J)}catch(F){y.innerHTML=`<span style="width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block;"></span> ${F.message||"Connection failed"}`,i.innerText="Start Call",i.style.background=k,i.style.width="100%",i.disabled=!1,p.style.display="none"}}return i.onclick=()=>{T==="connected"&&x?(x.stop(),x=null):T==="idle"&&U()},{destroy:()=>{x&&x.stop(),m.remove()},startCall:U}}if(typeof document<"u"){let n=document.currentScript||document.querySelector("script[data-agent], script[data-business-id]");if(n){let t=n.getAttribute("data-business-id")||void 0,o=n.getAttribute("data-agent")||void 0,r=n.getAttribute("data-theme")||"dark",l=n.getAttribute("data-accent")||"slate",h=n.getAttribute("data-position")||"bottom-right",e=n.getAttribute("data-label")||void 0,c=n.getAttribute("data-host")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{O({businessId:t,agentId:o,theme:r,accent:l,position:h,label:e,host:c})}):O({businessId:t,agentId:o,theme:r,accent:l,position:h,label:e,host:c})}}0&&(module.exports={initOmniDeskWidget});
//# sourceMappingURL=vanilla.js.map