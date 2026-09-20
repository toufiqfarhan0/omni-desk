"use strict";var OmniDeskVoice=(()=>{var B=Object.defineProperty;var re=Object.getOwnPropertyDescriptor;var le=Object.getOwnPropertyNames;var ce=Object.prototype.hasOwnProperty;var de=(s,e)=>{for(var n in e)B(s,n,{get:e[n],enumerable:!0})},pe=(s,e,n,o)=>{if(e&&typeof e=="object"||typeof e=="function")for(let r of le(e))!ce.call(s,r)&&r!==n&&B(s,r,{get:()=>e[r],enumerable:!(o=re(e,r))||o.enumerable});return s};var he=s=>pe(B({},"__esModule",{value:!0}),s);var xe={};de(xe,{initOmniDeskWidget:()=>D});var W=24e3,ue="wss://agents.assemblyai.com/v1/ws",fe=`
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${W};
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
`,ge=`
  class PlaybackProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ring = new Float32Array(sampleRate * 30);
      this._writePos = 0;
      this._readPos = 0;
      this._available = 0;
      this._step = ${W} / sampleRate;
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
`;async function Q(s,e,n){let o=URL.createObjectURL(new Blob([e],{type:"application/javascript"}));try{await s.audioWorklet.addModule(o)}finally{URL.revokeObjectURL(o)}return new AudioWorkletNode(s,n)}var $=class{constructor(e){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.callbacks=e}async start(e,n){try{this.callbacks.onStatusChange?.("connecting");let o=window.AudioContext||window.webkitAudioContext;this.captureCtx=new o({sampleRate:W}),this.playbackCtx=new o({sampleRate:W}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await Q(this.playbackCtx,ge,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await Q(this.captureCtx,fe,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let r=new URL(ue);r.searchParams.set("token",e),this.ws=new WebSocket(r.toString()),this.captureNode.port.onmessage=({data:g})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let t=new Uint8Array(g),p="";for(let u=0;u<t.length;u+=32768)p+=String.fromCharCode.apply(null,Array.from(t.subarray(u,u+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(p)}));let h=new Int16Array(g),d=0;for(let u=0;u<h.length;u+=16)d+=Math.abs(h[u]);this.userLevel=Math.min(1,d/(h.length/16)/8e3)},this.ws.onopen=()=>{n&&n.trim()&&this.ws?.send(JSON.stringify({type:"session.update",session:{agent_id:n.trim()}}))},this.ws.onmessage=({data:g})=>{try{let t=JSON.parse(g);switch(t.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0;break;case"transcript.user":t.text&&this.callbacks.onTranscript?.({who:"user",text:t.text});break;case"transcript.agent":t.text&&this.callbacks.onTranscript?.({who:"agent",text:t.text});break;case"reply.audio":if(t.data&&this.playbackNode){let p=atob(t.data),h=new Uint8Array(p.length);for(let d=0;d<p.length;d++)h[d]=p.charCodeAt(d);this.playbackNode.port.postMessage(h.buffer,[h.buffer]),this.agentLevel=.8}break;case"reply.done":t.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:t.name||t.tool,args:t.arguments||t.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:t.name||t.tool,result:t.result});break;case"session.error":this.callbacks.onError?.(t.message||t.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.stop();break}}catch(t){console.warn("Message parsing error:",t)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(o){this.callbacks.onError?.(o.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(e){this.isMuted=e,e&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(e,n){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:e})),n&&this.ws.send(JSON.stringify({type:"reply.create",instructions:n})),!0}catch(o){return console.error("Failed to send message to agent:",o),!1}}sendEmailInput(e){return this.sendUserMessage(`My email address is ${e}`,`The caller entered their verified email address: ${e}. Acknowledge this email, verify it using verify_customer_email if needed, and complete the booking.`)}stop(){if(this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(e=>e.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let e=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(e)};this.animFrameId=requestAnimationFrame(e)}};var be={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function D(s={}){if(typeof window>"u")return;let{host:e,businessId:n="biz_demo_dental",agentId:o,theme:r="dark",position:g="bottom-right",label:t="Talk to Receptionist",accent:p="emerald",accentColor:h,businessName:d,greeting:u,onCallStart:X,onCallEnd:ee,onTranscript:te}=s,j=h||be[p]||p||"#10b981",q=document.getElementById("omnidesk-voice-widget-root");q&&q.remove();let y=document.createElement("div");y.id="omnidesk-voice-widget-root",y.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let O=r==="dark"||r==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,k=null,M="idle",C=0,S=null,J=!1,K=!1,se=0,ie=0,E=g==="bottom-left",U=document.createElement("div");U.style.cssText=`
    position: fixed; bottom: 20px; ${E?"left: 20px;":"right: 20px;"};
    z-index: 999999;
  `;let A=document.createElement("button");A.style.cssText=`
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${O?"#18181b":"#ffffff"}; color: ${O?"#fafafa":"#09090b"};
    border: 1px solid ${O?"#27272a":"#e4e4e7"};
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `,A.innerHTML=`
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${j};box-shadow:0 0 8px ${j};display:inline-block;"></span>
    <span>${t}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,U.appendChild(A);let P=document.createElement("div");P.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,P.onclick=()=>V(!1);let i=document.createElement("div");i.style.cssText=`
    position: fixed; bottom: 80px; ${E?"left: 20px;":"right: 20px;"};
    width: 390px; max-width: calc(100vw - 32px); height: 560px; max-height: calc(100vh - 100px);
    background: #ffffff; border: 1px solid #e4e4e7;
    border-radius: 20px; box-shadow: 0 24px 48px -12px rgba(0,0,0,0.22);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  `;let x=document.createElement("div");x.style.cssText=`
    background: #18181b; color: #ffffff; padding: 13px 18px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; user-select: none; flex-shrink: 0;
  `,x.innerHTML=`
    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
      <div style="color: rgba(255,255,255,0.6); display: grid; place-items: center; flex-shrink: 0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle>
        </svg>
      </div>
      <div style="width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.15); display: grid; place-items: center; flex-shrink: 0; color: #ffffff;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
        </svg>
      </div>
      <div style="display: flex; flexDirection: column; min-width: 0;">
        <div id="omnidesk-biz-title" style="font-size: 13.5px; font-weight: 600; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${d||"OmniDesk Hair Salon & Studio"}
        </div>
        <div style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: rgba(255,255,255,0.75);">
          <span id="omnidesk-status-dot" style="width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.4); display: inline-block;"></span>
          <span id="omnidesk-status-text">Idle \xB7 Ready</span>
        </div>
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 8px;">
      <button id="omnidesk-expand-btn" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); border-radius: 7px; color: #ffffff; width: 30px; height: 30px; cursor: pointer; display: grid; place-items: center;" title="Open Full">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
      </button>
      <button id="omnidesk-close-btn" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); border-radius: 7px; color: #ffffff; width: 30px; height: 30px; cursor: pointer; display: grid; place-items: center;" title="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `;let _=document.createElement("div");_.style.cssText=`
    flex: 1; min-height: 0; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 12px; background: #ffffff;
  `;let T=document.createElement("div");T.id="omnidesk-placeholder-banner",T.style.cssText=`
    margin: auto; text-align: center; padding: 10px 18px;
    background: #f4f4f5; border: 1px solid #e4e4e7; color: #52525b;
    border-radius: 12px; font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px; align-self: center;
  `,T.innerHTML=`
    <span style="width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block;"></span>
    <span>Start a call to talk to our receptionist</span>
  `,_.appendChild(T);let N=document.createElement("div");N.style.cssText=`
    padding: 12px 16px; border-top: 1px solid #e4e4e7;
    background: #fafafa; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  `;let l=document.createElement("button");l.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: #000000; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s ease;
  `,l.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let F=document.createElement("div");F.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let f=document.createElement("span");f.id="omnidesk-timer",f.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,f.innerText="0:00",F.appendChild(f),N.appendChild(l),N.appendChild(F),i.appendChild(x),i.appendChild(_),i.appendChild(N),y.appendChild(U),y.appendChild(P),y.appendChild(i),document.body.appendChild(y);function ne(){C=Date.now(),f.innerText="0:00",f.style.background="#000000",f.style.color="#ffffff",S&&clearInterval(S),S=setInterval(()=>{let c=Date.now()-C,m=Math.floor(c/1e3),w=Math.floor(m/60),b=m%60;f.innerText=`${w}:${String(b).padStart(2,"0")}`},250)}function L(){S&&(clearInterval(S),S=null),f.style.background="#f4f4f5",f.style.color="#71717a",f.innerText="0:00"}function G(c){J=c,i.style.display=c?"flex":"none"}function V(c){K=c,P.style.display=c?"block":"none",c?(i.style.top="50%",i.style.left="50%",i.style.bottom="auto",i.style.right="auto",i.style.transform="translate(-50%, -50%)",i.style.width="calc(100vw - 40px)",i.style.maxWidth="1140px",i.style.height="calc(100vh - 40px)",i.style.maxHeight="900px"):(i.style.top="auto",i.style.left=E?"20px":"auto",i.style.right=E?"auto":"20px",i.style.bottom="80px",i.style.transform="none",i.style.width="390px",i.style.maxWidth="calc(100vw - 32px)",i.style.height="560px",i.style.maxHeight="calc(100vh - 100px)")}A.onclick=()=>G(!J),x.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{G(!1),V(!1)}),x.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{V(!K)});async function Z(){let c=x.querySelector("#omnidesk-status-text"),m=x.querySelector("#omnidesk-status-dot"),w=l.querySelector("#omnidesk-btn-text");c.innerText="Connecting...",m.style.background="#eab308",w.innerText="Connecting...",l.disabled=!0,ne();try{let b=e;if(!b&&typeof document<"u"){let a=document.querySelector("script[src*='widget.js']");if(a&&a.src&&a.src.startsWith("http"))try{b=new URL(a.src).origin}catch{}}!b&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(b=window.location.origin);let oe=(b||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),z=await fetch(`${oe}/api/token?businessId=${encodeURIComponent(n)}`);if(!z.ok)throw new Error(`Failed to get session token (${z.status})`);let I=await z.json();if(I.business_name&&!d){let a=x.querySelector("#omnidesk-biz-title");a&&(a.innerText=I.business_name)}let ae=o||I.agent_id||"";k=new $({onStatusChange:a=>{if(M=a,a==="connected")c.innerText="Live \xB7 Speaking",m.style.background="#22c55e",w.innerText="End Voice Call",l.style.background="#dc2626",l.disabled=!1,C=Date.now(),X?.();else if(a==="idle"&&(c.innerText="Idle \xB7 Ready",m.style.background="rgba(255,255,255,0.4)",w.innerText="Start Voice Call",l.style.background="#000000",l.disabled=!1,L(),C>0)){let v=Math.round((Date.now()-C)/1e3);C=0,ee?.(v)}},onTranscript:a=>{T.style.display="none";let v=document.createElement("div"),R=a.who==="user";v.style.cssText=`
            display: flex; flex-direction: column; gap: 4px; max-width: 88%;
            align-self: ${R?"flex-end":"flex-start"};
          `;let H=document.createElement("div");H.style.cssText=`
            padding: 10px 14px; border-radius: ${R?"14px 14px 2px 14px":"14px 14px 14px 2px"};
            font-size: 13px; line-height: 1.45;
            background: ${R?"#18181b":"#f4f4f5"};
            color: ${R?"#ffffff":"#09090b"};
            box-shadow: 0 1px 2px rgba(0,0,0,0.04);
          `,H.innerText=a.text,v.appendChild(H),_.appendChild(v),_.scrollTop=_.scrollHeight,te?.(a)},onAudioLevel:(a,v)=>{se=a,ie=v},onError:()=>{c.innerText="Error",m.style.background="#ef4444",w.innerText="Start Voice Call",l.style.background="#000000",l.disabled=!1,L()}}),await k.start(I.token,ae)}catch(b){console.error("[OmniDesk Voice Widget Error]:",b),c.innerText="Error",m.style.background="#ef4444",w.innerText="Start Voice Call",l.style.background="#000000",l.disabled=!1,L()}}function Y(){k&&(k.stop(),k=null),M="idle",L()}return l.onclick=()=>{M==="connected"?Y():M==="idle"&&Z()},{destroy:()=>{L(),k&&k.stop(),y.remove()},startCall:Z,endCall:Y}}if(typeof document<"u"){let s=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(s){let e,n=s.src||"";if(n&&n.startsWith("http"))try{e=new URL(n).origin}catch{}let o=s.getAttribute("data-business-id")||void 0,r=s.getAttribute("data-agent")||void 0,g=s.getAttribute("data-theme")||"dark",t=s.getAttribute("data-accent")||"emerald",p=s.getAttribute("data-position")||"bottom-right",h=s.getAttribute("data-label")||void 0,d=s.getAttribute("data-host")||e||"https://omni-desk-rho.vercel.app",u=s.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{D({businessId:o,agentId:r,theme:g,accent:t,position:p,label:h,host:d,greeting:u})}):D({businessId:o,agentId:r,theme:g,accent:t,position:p,label:h,host:d,greeting:u})}}return he(xe);})();
