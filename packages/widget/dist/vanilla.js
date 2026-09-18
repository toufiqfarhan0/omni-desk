"use strict";var N=Object.defineProperty;var W=Object.getOwnPropertyDescriptor;var I=Object.getOwnPropertyNames;var F=Object.prototype.hasOwnProperty;var U=(a,e)=>{for(var c in e)N(a,c,{get:e[c],enumerable:!0})},O=(a,e,c,o)=>{if(e&&typeof e=="object"||typeof e=="function")for(let d of I(e))!F.call(a,d)&&d!==c&&N(a,d,{get:()=>e[d],enumerable:!(o=W(e,d))||o.enumerable});return a};var z=a=>O(N({},"__esModule",{value:!0}),a);var j={};U(j,{initOmniDeskWidget:()=>H});module.exports=z(j);var L=24e3,V="wss://agents.assemblyai.com/v1/ws",B=`
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${L};
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
`,D=`
  class PlaybackProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ring = new Float32Array(sampleRate * 30);
      this._writePos = 0;
      this._readPos = 0;
      this._available = 0;
      this._step = ${L} / sampleRate;
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
`;async function R(a,e,c){let o=URL.createObjectURL(new Blob([e],{type:"application/javascript"}));try{await a.audioWorklet.addModule(o)}finally{URL.revokeObjectURL(o)}return new AudioWorkletNode(a,c)}var M=class{constructor(e){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.callbacks=e}async start(e,c){try{this.callbacks.onStatusChange?.("connecting");let o=window.AudioContext||window.webkitAudioContext;this.captureCtx=new o({sampleRate:L}),this.playbackCtx=new o({sampleRate:L}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await R(this.playbackCtx,D,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await R(this.captureCtx,B,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let d=new URL(V);d.searchParams.set("token",e),this.ws=new WebSocket(d.toString()),this.captureNode.port.onmessage=({data:m})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let t=new Uint8Array(m),u="";for(let r=0;r<t.length;r+=32768)u+=String.fromCharCode.apply(null,Array.from(t.subarray(r,r+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(u)}));let p=new Int16Array(m),h=0;for(let r=0;r<p.length;r+=16)h+=Math.abs(p[r]);this.userLevel=Math.min(1,h/(p.length/16)/8e3)},this.ws.onopen=()=>{this.ws?.send(JSON.stringify({type:"session.update",session:{agent_id:c}}))},this.ws.onmessage=({data:m})=>{try{let t=JSON.parse(m);switch(t.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0;break;case"transcript.user":t.text&&this.callbacks.onTranscript?.({who:"user",text:t.text});break;case"transcript.agent":t.text&&this.callbacks.onTranscript?.({who:"agent",text:t.text});break;case"reply.audio":if(t.data&&this.playbackNode){let u=atob(t.data),p=new Uint8Array(u.length);for(let h=0;h<u.length;h++)p[h]=u.charCodeAt(h);this.playbackNode.port.postMessage(p.buffer,[p.buffer]),this.agentLevel=.8}break;case"reply.done":t.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:t.name||t.tool,args:t.arguments||t.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:t.name||t.tool,result:t.result});break;case"session.error":this.callbacks.onError?.(t.message||t.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.stop();break}}catch(t){console.warn("Message parsing error:",t)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(o){this.callbacks.onError?.(o.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(e){this.isMuted=e,e&&(this.userLevel=0)}getMuted(){return this.isMuted}stop(){if(this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(e=>e.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let e=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(e)};this.animFrameId=requestAnimationFrame(e)}};function H(a){if(typeof window>"u")return;let{host:e,businessId:c="biz_demo_dental",theme:o="dark",position:d="bottom-right",label:m="Talk to Receptionist",accentColor:t="#10b981",onCallStart:u,onCallEnd:p,onTranscript:h}=a,r=document.getElementById("omnidesk-voice-widget-root");r&&r.remove();let l=document.createElement("div");l.id="omnidesk-voice-widget-root",l.style.position="fixed",l.style.bottom="24px",d==="bottom-left"?l.style.left="24px":l.style.right="24px",l.style.zIndex="999999",l.style.fontFamily="system-ui, -apple-system, sans-serif";let x=o==="dark"||o==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,i={bg:x?"#09090b":"#ffffff",cardBg:x?"#18181b":"#f4f4f5",border:x?"#27272a":"#e4e4e7",text:x?"#fafafa":"#09090b",textMuted:x?"#a1a1aa":"#71717a",bubbleAgent:x?"#27272a":"#f4f4f5",bubbleUser:t,userText:"#ffffff"},b=null,C="idle",q=!1,_=0,g=document.createElement("button");g.style.cssText=`
    display: flex; align-items: center; gap: 10px;
    padding: 12px 20px; border-radius: 9999px;
    background: ${i.bg}; color: ${i.text};
    border: 1px solid ${i.border};
    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
    cursor: pointer; font-weight: 600; font-size: 14px;
    transition: all 0.2s ease;
  `,g.innerHTML=`
    <span style="width:10px;height:10px;border-radius:50%;background:#71717a;display:inline-block;"></span>
    <span>${m}</span>
  `;let f=document.createElement("div");f.style.cssText=`
    width: 360px; height: 520px;
    background: ${i.bg}; border: 1px solid ${i.border};
    border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35);
    display: none; flex-direction: column; overflow: hidden;
  `;let y=document.createElement("div");y.style.cssText=`
    padding: 16px 20px; border-bottom: 1px solid ${i.border};
    display: flex; align-items: center; justify-content: space-between;
    background: ${i.cardBg};
  `,y.innerHTML=`
    <div>
      <div style="font-weight:700;font-size:14px;color:${i.text};" id="omnidesk-biz-title">AI Receptionist</div>
      <div style="font-size:11px;color:${i.textMuted};margin-top:2px;" id="omnidesk-status-text">Ready</div>
    </div>
    <button id="omnidesk-close-btn" style="background:transparent;border:none;color:${i.textMuted};cursor:pointer;font-size:16px;">\u2715</button>
  `;let k=document.createElement("div");k.style.cssText=`
    flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px;
  `;let P=document.createElement("div");P.style.cssText=`
    padding: 14px 16px; border-top: 1px solid ${i.border};
    background: ${i.cardBg}; display: flex; gap: 10px;
  `;let s=document.createElement("button");s.style.cssText=`
    width: 100%; padding: 11px; border-radius: 10px; border: none;
    background: ${t}; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
  `,s.innerText="Start Call",P.appendChild(s),f.appendChild(y),f.appendChild(k),f.appendChild(P),l.appendChild(g),l.appendChild(f),document.body.appendChild(l),g.onclick=()=>{g.style.display="none",f.style.display="flex",C==="idle"&&A()},y.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{f.style.display="none",g.style.display="flex"});async function A(){let v=y.querySelector("#omnidesk-status-text");v.innerText="Connecting...",s.innerText="Connecting...",s.disabled=!0;try{let E=e.replace(/\/$/,""),$=await fetch(`${E}/api/token?businessId=${encodeURIComponent(c)}`);if(!$.ok)throw new Error("Failed to get session token");let S=await $.json();if(S.business_name){let n=y.querySelector("#omnidesk-biz-title");n&&(n.innerText=S.business_name)}b=new M({onStatusChange:n=>{if(C=n,n==="connected")v.innerText="Live Receptionist",s.innerText="End Call",s.style.background="#ef4444",s.disabled=!1,_=Date.now(),u?.();else if(n==="idle"&&(v.innerText="Call Ended",s.innerText="Start Call",s.style.background=t,s.disabled=!1,_>0)){let w=Math.round((Date.now()-_)/1e3);_=0,p?.(w)}},onTranscript:n=>{let w=document.createElement("div"),T=n.who==="user";w.style.cssText=`
            display: flex; justify-content: ${T?"flex-end":"flex-start"};
          `,w.innerHTML=`
            <div style="max-width:80%;padding:9px 13px;border-radius:${T?"14px 14px 2px 14px":"14px 14px 14px 2px"};background:${T?i.bubbleUser:i.bubbleAgent};color:${T?i.userText:i.text};font-size:13px;line-height:1.4;">
              ${n.text}
            </div>
          `,k.appendChild(w),k.scrollTop=k.scrollHeight,h?.(n)},onError:n=>{v.innerText=`Error: ${n}`,s.innerText="Start Call",s.style.background=t,s.disabled=!1}}),await b.start(S.token,S.agent_id)}catch(E){v.innerText=E.message||"Connection failed",s.innerText="Start Call",s.style.background=t,s.disabled=!1}}return s.onclick=()=>{C==="connected"&&b?(b.stop(),b=null):C==="idle"&&A()},{destroy:()=>{b&&b.stop(),l.remove()},startCall:A}}0&&(module.exports={initOmniDeskWidget});
//# sourceMappingURL=vanilla.js.map