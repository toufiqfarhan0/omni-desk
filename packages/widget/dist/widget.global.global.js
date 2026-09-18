"use strict";var OmniDeskVoice=(()=>{var U=Object.defineProperty;var te=Object.getOwnPropertyDescriptor;var se=Object.getOwnPropertyNames;var ie=Object.prototype.hasOwnProperty;var ne=(s,e)=>{for(var a in e)U(s,a,{get:e[a],enumerable:!0})},oe=(s,e,a,r)=>{if(e&&typeof e=="object"||typeof e=="function")for(let c of se(e))!ie.call(s,c)&&c!==a&&U(s,c,{get:()=>e[c],enumerable:!(r=te(e,c))||r.enumerable});return s};var ae=s=>oe(U({},"__esModule",{value:!0}),s);var pe={};ne(pe,{initOmniDeskWidget:()=>z});var N=24e3,re="wss://agents.assemblyai.com/v1/ws",le=`
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
`,ce=`
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
`;async function J(s,e,a){let r=URL.createObjectURL(new Blob([e],{type:"application/javascript"}));try{await s.audioWorklet.addModule(r)}finally{URL.revokeObjectURL(r)}return new AudioWorkletNode(s,a)}var $=class{constructor(e){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.callbacks=e}async start(e,a){try{this.callbacks.onStatusChange?.("connecting");let r=window.AudioContext||window.webkitAudioContext;this.captureCtx=new r({sampleRate:N}),this.playbackCtx=new r({sampleRate:N}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await J(this.playbackCtx,ce,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await J(this.captureCtx,le,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let c=new URL(re);c.searchParams.set("token",e),this.ws=new WebSocket(c.toString()),this.captureNode.port.onmessage=({data:f})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let t=new Uint8Array(f),d="";for(let b=0;b<t.length;b+=32768)d+=String.fromCharCode.apply(null,Array.from(t.subarray(b,b+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(d)}));let p=new Int16Array(f),h=0;for(let b=0;b<p.length;b+=16)h+=Math.abs(p[b]);this.userLevel=Math.min(1,h/(p.length/16)/8e3)},this.ws.onopen=()=>{a&&a.trim()&&this.ws?.send(JSON.stringify({type:"session.update",session:{agent_id:a.trim()}}))},this.ws.onmessage=({data:f})=>{try{let t=JSON.parse(f);switch(t.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0;break;case"transcript.user":t.text&&this.callbacks.onTranscript?.({who:"user",text:t.text});break;case"transcript.agent":t.text&&this.callbacks.onTranscript?.({who:"agent",text:t.text});break;case"reply.audio":if(t.data&&this.playbackNode){let d=atob(t.data),p=new Uint8Array(d.length);for(let h=0;h<d.length;h++)p[h]=d.charCodeAt(h);this.playbackNode.port.postMessage(p.buffer,[p.buffer]),this.agentLevel=.8}break;case"reply.done":t.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:t.name||t.tool,args:t.arguments||t.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:t.name||t.tool,result:t.result});break;case"session.error":this.callbacks.onError?.(t.message||t.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.stop();break}}catch(t){console.warn("Message parsing error:",t)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(r){this.callbacks.onError?.(r.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(e){this.isMuted=e,e&&(this.userLevel=0)}getMuted(){return this.isMuted}stop(){if(this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(e=>e.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let e=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(e)};this.animFrameId=requestAnimationFrame(e)}};var de={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"},G=[8,14,18,11,16,20,12,6,15];function z(s={}){if(typeof window>"u")return;let{host:e,businessId:a="biz_demo_dental",agentId:r,theme:c="dark",position:f="bottom-right",label:t="Talk to Receptionist",accent:d="emerald",accentColor:p,businessName:h,greeting:b,onCallStart:K,onCallEnd:Q,onTranscript:Y}=s,u=p||de[d]||d||"#10b981",B=document.getElementById("omnidesk-voice-widget-root");B&&B.remove();let v=document.createElement("div");v.id="omnidesk-voice-widget-root",v.style.fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let x=c==="dark"||c==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,n={bg:x?"#18181b":"#ffffff",headerBg:x?"#09090b":"#f4f4f5",border:x?"#27272a":"#e4e4e7",text:x?"#fafafa":"#09090b",textMuted:x?"#a1a1aa":"#71717a",bubbleAgent:x?"#27272a":"#f4f4f5",bubbleUser:u,userText:"#ffffff",agentText:x?"#f4f4f5":"#09090b"},y=null,S="idle",L=0,D=!1,X=0,Z=0,H=f==="bottom-left",ee=b||"Hello! Welcome to OmniDesk. Would you like to check availability or book a consultation?",M=document.createElement("div");M.style.cssText=`
    position: fixed; bottom: 20px; ${H?"left: 20px;":"right: 20px;"};
    z-index: 999999;
  `;let E=document.createElement("button");E.style.cssText=`
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${n.bg}; color: ${n.text};
    border: 1px solid ${n.border};
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `,E.innerHTML=`
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${u};box-shadow:0 0 8px ${u};display:inline-block;"></span>
    <span>${t}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,M.appendChild(E);let k=document.createElement("div");k.style.cssText=`
    position: fixed; bottom: 70px; ${H?"left: 20px;":"right: 20px;"};
    width: 320px; height: 280px;
    background: ${n.bg}; border: 1px solid ${n.border};
    border-radius: 18px; box-shadow: 0 20px 30px -10px rgba(0,0,0,0.4);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;let w=document.createElement("div");w.style.cssText=`
    padding: 12px 16px; border-bottom: 1px solid ${n.border};
    display: flex; align-items: center; justify-content: space-between;
    background: ${n.headerBg};
  `,w.innerHTML=`
    <div>
      <div style="font-size:13px;font-weight:700;color:${n.text};" id="omnidesk-biz-title">${h||"OmniDesk AI Receptionist"}</div>
      <div style="font-size:10.5px;color:${u};font-weight:600;" id="omnidesk-status-text">Ready to connect</div>
    </div>
    <button id="omnidesk-close-btn" style="background:transparent;border:none;color:${n.textMuted};cursor:pointer;padding:4px;font-size:14px;" title="Close">\u2715</button>
  `;let C=document.createElement("div");C.style.cssText=`
    flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px;
  `;let R=document.createElement("div");R.style.cssText=`
    align-self: flex-start; background: ${n.bubbleAgent}; color: ${n.agentText};
    padding: 8px 12px; border-radius: 12px; font-size: 12px; max-width: 85%; line-height: 1.4;
  `,R.innerText=ee,C.appendChild(R);let P=document.createElement("div");P.style.cssText=`
    padding: 10px 14px; border-top: 1px solid ${n.border};
    display: flex; align-items: center; justify-content: space-between;
  `;let I=document.createElement("div");I.style.cssText=`
    display: flex; align-items: center; gap: 3px; height: 18px;
  `,G.forEach(()=>{let l=document.createElement("div");l.className="omnidesk-freq-bar",l.style.cssText=`
      width: 3px; height: 4px; border-radius: 2px;
      background: ${u}; opacity: 0.7; transition: height 0.15s ease;
    `,I.appendChild(l)});let i=document.createElement("button");i.style.cssText=`
    padding: 7px 16px; border-radius: 9999px; border: none;
    background: ${u}; color: #ffffff; font-size: 12px; font-weight: 700; cursor: pointer;
    box-shadow: 0 2px 8px rgba(16,185,129,0.3); transition: all 0.15s ease;
  `,i.innerText="Start Call",P.appendChild(I),P.appendChild(i),k.appendChild(w),k.appendChild(C),k.appendChild(P),v.appendChild(M),v.appendChild(k),document.body.appendChild(v);function T(l,g){k.querySelectorAll(".omnidesk-freq-bar").forEach((A,_)=>{let F=G[_],o=l?Math.max(5,Math.min(18,Math.round(F*(.35+g*1.5)))):4;A.style.height=`${o}px`,A.style.opacity=l?"1":"0.7"})}function V(l){D=l,k.style.display=l?"flex":"none"}E.onclick=()=>{V(!D)},w.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{V(!1)});async function q(){let l=w.querySelector("#omnidesk-status-text"),g=M.querySelector("#omnidesk-trigger-dot");l.innerText="Connecting...",i.innerText="Connecting...",i.disabled=!0;try{let W=e?e.replace(/\/$/,""):typeof window<"u"?window.location.origin:"",A=await fetch(`${W}/api/token?businessId=${encodeURIComponent(a)}`);if(!A.ok)throw new Error("Failed to get session token");let _=await A.json();if(_.business_name&&!h){let o=w.querySelector("#omnidesk-biz-title");o&&(o.innerText=`${_.business_name} AI Receptionist`)}let F=r||_.agent_id||"";y=new $({onStatusChange:o=>{if(S=o,o==="connected")l.innerText="Live Voice Call (24kHz)",i.innerText="End Call",i.style.background="#ef4444",i.style.boxShadow="0 2px 8px rgba(239,68,68,0.3)",i.disabled=!1,g&&(g.style.background="#ef4444",g.style.boxShadow="0 0 8px #ef4444"),L=Date.now(),K?.();else if(o==="idle"&&(l.innerText="Ready to connect",i.innerText="Start Call",i.style.background=u,i.style.boxShadow="0 2px 8px rgba(16,185,129,0.3)",i.disabled=!1,g&&(g.style.background=u,g.style.boxShadow=`0 0 8px ${u}`),T(!1,0),L>0)){let m=Math.round((Date.now()-L)/1e3);L=0,Q?.(m)}},onTranscript:o=>{let m=document.createElement("div"),O=o.who==="user";m.style.cssText=`
            align-self: ${O?"flex-end":"flex-start"};
            background: ${O?n.bubbleUser:n.bubbleAgent};
            color: ${O?n.userText:n.agentText};
            padding: 8px 12px; border-radius: 12px; font-size: 12px; max-width: 85%; line-height: 1.4;
          `,m.innerText=o.text,C.appendChild(m),C.scrollTop=C.scrollHeight,Y?.(o)},onAudioLevel:(o,m)=>{X=o,Z=m,T(S==="connected",Math.max(o,m))},onError:o=>{l.innerText="Connection error",i.innerText="Start Call",i.style.background=u,i.disabled=!1,T(!1,0)}}),await y.start(_.token,F)}catch{l.innerText="Connection failed",i.innerText="Start Call",i.style.background=u,i.disabled=!1,T(!1,0)}}function j(){y&&(y.stop(),y=null),S="idle",T(!1,0)}return i.onclick=()=>{S==="connected"?j():S==="idle"&&q()},{destroy:()=>{y&&y.stop(),v.remove()},startCall:q,endCall:j}}if(typeof document<"u"){let s=document.currentScript||document.querySelector("script[data-agent], script[data-business-id]");if(s){let e=s.getAttribute("data-business-id")||void 0,a=s.getAttribute("data-agent")||void 0,r=s.getAttribute("data-theme")||"dark",c=s.getAttribute("data-accent")||"emerald",f=s.getAttribute("data-position")||"bottom-right",t=s.getAttribute("data-label")||void 0,d=s.getAttribute("data-host")||void 0,p=s.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{z({businessId:e,agentId:a,theme:r,accent:c,position:f,label:t,host:d,greeting:p})}):z({businessId:e,agentId:a,theme:r,accent:c,position:f,label:t,host:d,greeting:p})}}return ae(pe);})();
