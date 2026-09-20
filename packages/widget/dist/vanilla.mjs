var W=24e3,ae="wss://agents.assemblyai.com/v1/ws",re=`
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
`,le=`
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
`;async function Z(n,s,o){let a=URL.createObjectURL(new Blob([s],{type:"application/javascript"}));try{await n.audioWorklet.addModule(a)}finally{URL.revokeObjectURL(a)}return new AudioWorkletNode(n,o)}var $=class{constructor(s){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.callbacks=s}async start(s,o){try{this.callbacks.onStatusChange?.("connecting");let a=window.AudioContext||window.webkitAudioContext;this.captureCtx=new a({sampleRate:W}),this.playbackCtx=new a({sampleRate:W}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await Z(this.playbackCtx,le,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await Z(this.captureCtx,re,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let b=new URL(ae);b.searchParams.set("token",s),this.ws=new WebSocket(b.toString()),this.captureNode.port.onmessage=({data:f})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let e=new Uint8Array(f),d="";for(let h=0;h<e.length;h+=32768)d+=String.fromCharCode.apply(null,Array.from(e.subarray(h,h+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(d)}));let p=new Int16Array(f),c=0;for(let h=0;h<p.length;h+=16)c+=Math.abs(p[h]);this.userLevel=Math.min(1,c/(p.length/16)/8e3)},this.ws.onopen=()=>{o&&o.trim()&&this.ws?.send(JSON.stringify({type:"session.update",session:{agent_id:o.trim()}}))},this.ws.onmessage=({data:f})=>{try{let e=JSON.parse(f);switch(e.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0;break;case"transcript.user":e.text&&this.callbacks.onTranscript?.({who:"user",text:e.text});break;case"transcript.agent":e.text&&this.callbacks.onTranscript?.({who:"agent",text:e.text});break;case"reply.audio":if(e.data&&this.playbackNode){let d=atob(e.data),p=new Uint8Array(d.length);for(let c=0;c<d.length;c++)p[c]=d.charCodeAt(c);this.playbackNode.port.postMessage(p.buffer,[p.buffer]),this.agentLevel=.8}break;case"reply.done":e.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:e.name||e.tool,args:e.arguments||e.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:e.name||e.tool,result:e.result});break;case"session.error":this.callbacks.onError?.(e.message||e.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.stop();break}}catch(e){console.warn("Message parsing error:",e)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(a){this.callbacks.onError?.(a.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(s){this.isMuted=s,s&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(s,o){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:s})),o&&this.ws.send(JSON.stringify({type:"reply.create",instructions:o})),!0}catch(a){return console.error("Failed to send message to agent:",a),!1}}sendEmailInput(s){return this.sendUserMessage(`My email address is ${s}`,`The caller entered their verified email address: ${s}. Acknowledge this email, verify it using verify_customer_email if needed, and complete the booking.`)}stop(){if(this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(s=>s.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let s=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(s)};this.animFrameId=requestAnimationFrame(s)}};var ce={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function Y(n={}){if(typeof window>"u")return;let{host:s,businessId:o="biz_demo_dental",agentId:a,theme:b="dark",position:f="bottom-right",label:e="Talk to Receptionist",accent:d="emerald",accentColor:p,businessName:c,greeting:h,onCallStart:Q,onCallEnd:X,onTranscript:ee}=n,B=p||ce[d]||d||"#10b981",D=document.getElementById("omnidesk-voice-widget-root");D&&D.remove();let y=document.createElement("div");y.id="omnidesk-voice-widget-root",y.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let O=b==="dark"||b==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,k=null,M="idle",C=0,S=null,j=!1,q=!1,te=0,se=0,E=f==="bottom-left",U=document.createElement("div");U.style.cssText=`
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
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${B};box-shadow:0 0 8px ${B};display:inline-block;"></span>
    <span>${e}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,U.appendChild(A);let P=document.createElement("div");P.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,P.onclick=()=>V(!1);let t=document.createElement("div");t.style.cssText=`
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
          ${c||"OmniDesk Hair Salon & Studio"}
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
  `;let r=document.createElement("button");r.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: #000000; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s ease;
  `,r.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let F=document.createElement("div");F.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let u=document.createElement("span");u.id="omnidesk-timer",u.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,u.innerText="0:00",F.appendChild(u),N.appendChild(r),N.appendChild(F),t.appendChild(x),t.appendChild(_),t.appendChild(N),y.appendChild(U),y.appendChild(P),y.appendChild(t),document.body.appendChild(y);function ie(){C=Date.now(),u.innerText="0:00",u.style.background="#000000",u.style.color="#ffffff",S&&clearInterval(S),S=setInterval(()=>{let l=Date.now()-C,m=Math.floor(l/1e3),w=Math.floor(m/60),g=m%60;u.innerText=`${w}:${String(g).padStart(2,"0")}`},250)}function L(){S&&(clearInterval(S),S=null),u.style.background="#f4f4f5",u.style.color="#71717a",u.innerText="0:00"}function J(l){j=l,t.style.display=l?"flex":"none"}function V(l){q=l,P.style.display=l?"block":"none",l?(t.style.top="50%",t.style.left="50%",t.style.bottom="auto",t.style.right="auto",t.style.transform="translate(-50%, -50%)",t.style.width="calc(100vw - 40px)",t.style.maxWidth="1140px",t.style.height="calc(100vh - 40px)",t.style.maxHeight="900px"):(t.style.top="auto",t.style.left=E?"20px":"auto",t.style.right=E?"auto":"20px",t.style.bottom="80px",t.style.transform="none",t.style.width="390px",t.style.maxWidth="calc(100vw - 32px)",t.style.height="560px",t.style.maxHeight="calc(100vh - 100px)")}A.onclick=()=>J(!j),x.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{J(!1),V(!1)}),x.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{V(!q)});async function K(){let l=x.querySelector("#omnidesk-status-text"),m=x.querySelector("#omnidesk-status-dot"),w=r.querySelector("#omnidesk-btn-text");l.innerText="Connecting...",m.style.background="#eab308",w.innerText="Connecting...",r.disabled=!0,ie();try{let g=s;if(!g&&typeof document<"u"){let i=document.querySelector("script[src*='widget.js']");if(i&&i.src&&i.src.startsWith("http"))try{g=new URL(i.src).origin}catch{}}!g&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(g=window.location.origin);let ne=(g||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),z=await fetch(`${ne}/api/token?businessId=${encodeURIComponent(o)}`);if(!z.ok)throw new Error(`Failed to get session token (${z.status})`);let I=await z.json();if(I.business_name&&!c){let i=x.querySelector("#omnidesk-biz-title");i&&(i.innerText=I.business_name)}let oe=a||I.agent_id||"";k=new $({onStatusChange:i=>{if(M=i,i==="connected")l.innerText="Live \xB7 Speaking",m.style.background="#22c55e",w.innerText="End Voice Call",r.style.background="#dc2626",r.disabled=!1,C=Date.now(),Q?.();else if(i==="idle"&&(l.innerText="Idle \xB7 Ready",m.style.background="rgba(255,255,255,0.4)",w.innerText="Start Voice Call",r.style.background="#000000",r.disabled=!1,L(),C>0)){let v=Math.round((Date.now()-C)/1e3);C=0,X?.(v)}},onTranscript:i=>{T.style.display="none";let v=document.createElement("div"),R=i.who==="user";v.style.cssText=`
            display: flex; flex-direction: column; gap: 4px; max-width: 88%;
            align-self: ${R?"flex-end":"flex-start"};
          `;let H=document.createElement("div");H.style.cssText=`
            padding: 10px 14px; border-radius: ${R?"14px 14px 2px 14px":"14px 14px 14px 2px"};
            font-size: 13px; line-height: 1.45;
            background: ${R?"#18181b":"#f4f4f5"};
            color: ${R?"#ffffff":"#09090b"};
            box-shadow: 0 1px 2px rgba(0,0,0,0.04);
          `,H.innerText=i.text,v.appendChild(H),_.appendChild(v),_.scrollTop=_.scrollHeight,ee?.(i)},onAudioLevel:(i,v)=>{te=i,se=v},onError:()=>{l.innerText="Error",m.style.background="#ef4444",w.innerText="Start Voice Call",r.style.background="#000000",r.disabled=!1,L()}}),await k.start(I.token,oe)}catch(g){console.error("[OmniDesk Voice Widget Error]:",g),l.innerText="Error",m.style.background="#ef4444",w.innerText="Start Voice Call",r.style.background="#000000",r.disabled=!1,L()}}function G(){k&&(k.stop(),k=null),M="idle",L()}return r.onclick=()=>{M==="connected"?G():M==="idle"&&K()},{destroy:()=>{L(),k&&k.stop(),y.remove()},startCall:K,endCall:G}}if(typeof document<"u"){let n=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(n){let s,o=n.src||"";if(o&&o.startsWith("http"))try{s=new URL(o).origin}catch{}let a=n.getAttribute("data-business-id")||void 0,b=n.getAttribute("data-agent")||void 0,f=n.getAttribute("data-theme")||"dark",e=n.getAttribute("data-accent")||"emerald",d=n.getAttribute("data-position")||"bottom-right",p=n.getAttribute("data-label")||void 0,c=n.getAttribute("data-host")||s||"https://omni-desk-rho.vercel.app",h=n.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{Y({businessId:a,agentId:b,theme:f,accent:e,position:d,label:p,host:c,greeting:h})}):Y({businessId:a,agentId:b,theme:f,accent:e,position:d,label:p,host:c,greeting:h})}}export{Y as initOmniDeskWidget};
//# sourceMappingURL=vanilla.mjs.map