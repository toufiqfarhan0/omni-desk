var R=24e3,oe="wss://agents.assemblyai.com/v1/ws",ae=`
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
`,re=`
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
`;async function Z(i,t,r){let n=URL.createObjectURL(new Blob([t],{type:"application/javascript"}));try{await i.audioWorklet.addModule(n)}finally{URL.revokeObjectURL(n)}return new AudioWorkletNode(i,r)}var W=class{constructor(t){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.callbacks=t}async start(t,r){try{this.callbacks.onStatusChange?.("connecting");let n=window.AudioContext||window.webkitAudioContext;this.captureCtx=new n({sampleRate:R}),this.playbackCtx=new n({sampleRate:R}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await Z(this.playbackCtx,re,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await Z(this.captureCtx,ae,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let g=new URL(oe);g.searchParams.set("token",t),this.ws=new WebSocket(g.toString()),this.captureNode.port.onmessage=({data:u})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let e=new Uint8Array(u),l="";for(let f=0;f<e.length;f+=32768)l+=String.fromCharCode.apply(null,Array.from(e.subarray(f,f+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(l)}));let c=new Int16Array(u),h=0;for(let f=0;f<c.length;f+=16)h+=Math.abs(c[f]);this.userLevel=Math.min(1,h/(c.length/16)/8e3)},this.ws.onopen=()=>{r&&r.trim()&&this.ws?.send(JSON.stringify({type:"session.update",session:{agent_id:r.trim()}}))},this.ws.onmessage=({data:u})=>{try{let e=JSON.parse(u);switch(e.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0;break;case"transcript.user":e.text&&this.callbacks.onTranscript?.({who:"user",text:e.text});break;case"transcript.agent":e.text&&this.callbacks.onTranscript?.({who:"agent",text:e.text});break;case"reply.audio":if(e.data&&this.playbackNode){let l=atob(e.data),c=new Uint8Array(l.length);for(let h=0;h<l.length;h++)c[h]=l.charCodeAt(h);this.playbackNode.port.postMessage(c.buffer,[c.buffer]),this.agentLevel=.8}break;case"reply.done":e.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:e.name||e.tool,args:e.arguments||e.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:e.name||e.tool,result:e.result});break;case"session.error":this.callbacks.onError?.(e.message||e.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.stop();break}}catch(e){console.warn("Message parsing error:",e)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(n){this.callbacks.onError?.(n.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(t){this.isMuted=t,t&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(t,r){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:t})),r&&this.ws.send(JSON.stringify({type:"reply.create",instructions:r})),!0}catch(n){return console.error("Failed to send message to agent:",n),!1}}sendEmailInput(t){return this.sendUserMessage(`My email address is ${t}`,`The caller entered their verified email address: ${t}. Acknowledge this email, verify it using verify_customer_email if needed, and complete the booking.`)}stop(){if(this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(t=>t.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let t=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(t)};this.animFrameId=requestAnimationFrame(t)}};var le={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function Y(i={}){if(typeof window>"u")return;let{host:t,businessId:r="biz_demo_dental",agentId:n,theme:g="dark",position:u="bottom-right",label:e="Talk to Receptionist",accent:l="emerald",accentColor:c,businessName:h,greeting:f,onCallStart:Q,onCallEnd:X,onTranscript:ee}=i,B=c||le[l]||l||"#10b981",D=document.getElementById("omnidesk-voice-widget-root");D&&D.remove();let m=document.createElement("div");m.id="omnidesk-voice-widget-root",m.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let $=g==="dark"||g==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,y=null,M="idle",v=0,C=null,H=!1,j=!1,te=0,se=0,L=u==="bottom-left",O=document.createElement("div");O.style.cssText=`
    position: fixed; bottom: 20px; ${L?"left: 20px;":"right: 20px;"};
    z-index: 999999;
  `;let A=document.createElement("button");A.style.cssText=`
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${$?"#18181b":"#ffffff"}; color: ${$?"#fafafa":"#09090b"};
    border: 1px solid ${$?"#27272a":"#e4e4e7"};
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `,A.innerHTML=`
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${B};box-shadow:0 0 8px ${B};display:inline-block;"></span>
    <span>${e}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,O.appendChild(A);let E=document.createElement("div");E.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,E.onclick=()=>z(!1);let s=document.createElement("div");s.style.cssText=`
    position: fixed; bottom: 80px; ${L?"left: 20px;":"right: 20px;"};
    width: 390px; max-width: calc(100vw - 32px); height: 560px; max-height: calc(100vh - 100px);
    background: #ffffff; border: 1px solid #e4e4e7;
    border-radius: 20px; box-shadow: 0 24px 48px -12px rgba(0,0,0,0.22);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  `;let b=document.createElement("div");b.style.cssText=`
    background: #18181b; color: #ffffff; padding: 13px 18px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; user-select: none; flex-shrink: 0;
  `,b.innerHTML=`
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
          ${h||"OmniDesk Hair Salon & Studio"}
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
  `;let S=document.createElement("div");S.id="omnidesk-placeholder-banner",S.style.cssText=`
    margin: auto; text-align: center; padding: 10px 18px;
    background: #f4f4f5; border: 1px solid #e4e4e7; color: #52525b;
    border-radius: 12px; font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px; align-self: center;
  `,S.innerHTML=`
    <span style="width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block;"></span>
    <span>Start a call to talk to our receptionist</span>
  `,_.appendChild(S);let P=document.createElement("div");P.style.cssText=`
    padding: 12px 16px; border-top: 1px solid #e4e4e7;
    background: #fafafa; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  `;let o=document.createElement("button");o.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: #000000; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s ease;
  `,o.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let F=document.createElement("div");F.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let p=document.createElement("span");p.id="omnidesk-timer",p.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,p.innerText="0:00",F.appendChild(p),P.appendChild(o),P.appendChild(F),s.appendChild(b),s.appendChild(_),s.appendChild(P),m.appendChild(O),m.appendChild(E),m.appendChild(s),document.body.appendChild(m);function ie(){v=Date.now(),p.innerText="0:00",p.style.background="#000000",p.style.color="#ffffff",C&&clearInterval(C),C=setInterval(()=>{let a=Date.now()-v,x=Math.floor(a/1e3),k=Math.floor(x/60),U=x%60;p.innerText=`${k}:${String(U).padStart(2,"0")}`},250)}function T(){C&&(clearInterval(C),C=null),p.style.background="#f4f4f5",p.style.color="#71717a",p.innerText="0:00"}function q(a){H=a,s.style.display=a?"flex":"none"}function z(a){j=a,E.style.display=a?"block":"none",a?(s.style.top="50%",s.style.left="50%",s.style.bottom="auto",s.style.right="auto",s.style.transform="translate(-50%, -50%)",s.style.width="calc(100vw - 40px)",s.style.maxWidth="1140px",s.style.height="calc(100vh - 40px)",s.style.maxHeight="900px"):(s.style.top="auto",s.style.left=L?"20px":"auto",s.style.right=L?"auto":"20px",s.style.bottom="80px",s.style.transform="none",s.style.width="390px",s.style.maxWidth="calc(100vw - 32px)",s.style.height="560px",s.style.maxHeight="calc(100vh - 100px)")}A.onclick=()=>q(!H),b.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{q(!1),z(!1)}),b.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{z(!j)});async function J(){let a=b.querySelector("#omnidesk-status-text"),x=b.querySelector("#omnidesk-status-dot"),k=o.querySelector("#omnidesk-btn-text");a.innerText="Connecting...",x.style.background="#eab308",k.innerText="Connecting...",o.disabled=!0,ie();try{let U=t?t.replace(/\/$/,""):typeof window<"u"?window.location.origin:"",G=await fetch(`${U}/api/token?businessId=${encodeURIComponent(r)}`);if(!G.ok)throw new Error("Failed to get session token");let N=await G.json();if(N.business_name&&!h){let d=b.querySelector("#omnidesk-biz-title");d&&(d.innerText=N.business_name)}let ne=n||N.agent_id||"";y=new W({onStatusChange:d=>{if(M=d,d==="connected")a.innerText="Live \xB7 Speaking",x.style.background="#22c55e",k.innerText="End Voice Call",o.style.background="#dc2626",o.disabled=!1,v=Date.now(),Q?.();else if(d==="idle"&&(a.innerText="Idle \xB7 Ready",x.style.background="rgba(255,255,255,0.4)",k.innerText="Start Voice Call",o.style.background="#000000",o.disabled=!1,T(),v>0)){let w=Math.round((Date.now()-v)/1e3);v=0,X?.(w)}},onTranscript:d=>{S.style.display="none";let w=document.createElement("div"),I=d.who==="user";w.style.cssText=`
            display: flex; flex-direction: column; gap: 4px; max-width: 88%;
            align-self: ${I?"flex-end":"flex-start"};
          `;let V=document.createElement("div");V.style.cssText=`
            padding: 10px 14px; border-radius: ${I?"14px 14px 2px 14px":"14px 14px 14px 2px"};
            font-size: 13px; line-height: 1.45;
            background: ${I?"#18181b":"#f4f4f5"};
            color: ${I?"#ffffff":"#09090b"};
            box-shadow: 0 1px 2px rgba(0,0,0,0.04);
          `,V.innerText=d.text,w.appendChild(V),_.appendChild(w),_.scrollTop=_.scrollHeight,ee?.(d)},onAudioLevel:(d,w)=>{te=d,se=w},onError:()=>{a.innerText="Error",x.style.background="#ef4444",k.innerText="Start Voice Call",o.style.background="#000000",o.disabled=!1,T()}}),await y.start(N.token,ne)}catch{a.innerText="Error",x.style.background="#ef4444",k.innerText="Start Voice Call",o.style.background="#000000",o.disabled=!1,T()}}function K(){y&&(y.stop(),y=null),M="idle",T()}return o.onclick=()=>{M==="connected"?K():M==="idle"&&J()},{destroy:()=>{T(),y&&y.stop(),m.remove()},startCall:J,endCall:K}}if(typeof document<"u"){let i=document.currentScript||document.querySelector("script[data-agent], script[data-business-id]");if(i){let t=i.getAttribute("data-business-id")||void 0,r=i.getAttribute("data-agent")||void 0,n=i.getAttribute("data-theme")||"dark",g=i.getAttribute("data-accent")||"emerald",u=i.getAttribute("data-position")||"bottom-right",e=i.getAttribute("data-label")||void 0,l=i.getAttribute("data-host")||void 0,c=i.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{Y({businessId:t,agentId:r,theme:n,accent:g,position:u,label:e,host:l,greeting:c})}):Y({businessId:t,agentId:r,theme:n,accent:g,position:u,label:e,host:l,greeting:c})}}export{Y as initOmniDeskWidget};
//# sourceMappingURL=vanilla.mjs.map