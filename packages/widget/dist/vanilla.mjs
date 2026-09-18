var L=24e3,R="wss://agents.assemblyai.com/v1/ws",W=`
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
`,I=`
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
`;async function $(x,i,g){let r=URL.createObjectURL(new Blob([i],{type:"application/javascript"}));try{await x.audioWorklet.addModule(r)}finally{URL.revokeObjectURL(r)}return new AudioWorkletNode(x,g)}var M=class{constructor(i){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.callbacks=i}async start(i,g){try{this.callbacks.onStatusChange?.("connecting");let r=window.AudioContext||window.webkitAudioContext;this.captureCtx=new r({sampleRate:L}),this.playbackCtx=new r({sampleRate:L}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await $(this.playbackCtx,I,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await $(this.captureCtx,W,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let w=new URL(R);w.searchParams.set("token",i),this.ws=new WebSocket(w.toString()),this.captureNode.port.onmessage=({data:u})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let t=new Uint8Array(u),d="";for(let o=0;o<t.length;o+=32768)d+=String.fromCharCode.apply(null,Array.from(t.subarray(o,o+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(d)}));let l=new Int16Array(u),c=0;for(let o=0;o<l.length;o+=16)c+=Math.abs(l[o]);this.userLevel=Math.min(1,c/(l.length/16)/8e3)},this.ws.onopen=()=>{this.ws?.send(JSON.stringify({type:"session.update",session:{agent_id:g}}))},this.ws.onmessage=({data:u})=>{try{let t=JSON.parse(u);switch(t.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0;break;case"transcript.user":t.text&&this.callbacks.onTranscript?.({who:"user",text:t.text});break;case"transcript.agent":t.text&&this.callbacks.onTranscript?.({who:"agent",text:t.text});break;case"reply.audio":if(t.data&&this.playbackNode){let d=atob(t.data),l=new Uint8Array(d.length);for(let c=0;c<d.length;c++)l[c]=d.charCodeAt(c);this.playbackNode.port.postMessage(l.buffer,[l.buffer]),this.agentLevel=.8}break;case"reply.done":t.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:t.name||t.tool,args:t.arguments||t.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:t.name||t.tool,result:t.result});break;case"session.error":this.callbacks.onError?.(t.message||t.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.stop();break}}catch(t){console.warn("Message parsing error:",t)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(r){this.callbacks.onError?.(r.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(i){this.isMuted=i,i&&(this.userLevel=0)}getMuted(){return this.isMuted}stop(){if(this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(i=>i.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let i=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(i)};this.animFrameId=requestAnimationFrame(i)}};function z(x){if(typeof window>"u")return;let{host:i,businessId:g="biz_demo_dental",theme:r="dark",position:w="bottom-right",label:u="Talk to Receptionist",accentColor:t="#10b981",onCallStart:d,onCallEnd:l,onTranscript:c}=x,o=document.getElementById("omnidesk-voice-widget-root");o&&o.remove();let n=document.createElement("div");n.id="omnidesk-voice-widget-root",n.style.position="fixed",n.style.bottom="24px",w==="bottom-left"?n.style.left="24px":n.style.right="24px",n.style.zIndex="999999",n.style.fontFamily="system-ui, -apple-system, sans-serif";let b=r==="dark"||r==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,s={bg:b?"#09090b":"#ffffff",cardBg:b?"#18181b":"#f4f4f5",border:b?"#27272a":"#e4e4e7",text:b?"#fafafa":"#09090b",textMuted:b?"#a1a1aa":"#71717a",bubbleAgent:b?"#27272a":"#f4f4f5",bubbleUser:t,userText:"#ffffff"},p=null,C="idle",F=!1,_=0,f=document.createElement("button");f.style.cssText=`
    display: flex; align-items: center; gap: 10px;
    padding: 12px 20px; border-radius: 9999px;
    background: ${s.bg}; color: ${s.text};
    border: 1px solid ${s.border};
    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
    cursor: pointer; font-weight: 600; font-size: 14px;
    transition: all 0.2s ease;
  `,f.innerHTML=`
    <span style="width:10px;height:10px;border-radius:50%;background:#71717a;display:inline-block;"></span>
    <span>${u}</span>
  `;let h=document.createElement("div");h.style.cssText=`
    width: 360px; height: 520px;
    background: ${s.bg}; border: 1px solid ${s.border};
    border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35);
    display: none; flex-direction: column; overflow: hidden;
  `;let m=document.createElement("div");m.style.cssText=`
    padding: 16px 20px; border-bottom: 1px solid ${s.border};
    display: flex; align-items: center; justify-content: space-between;
    background: ${s.cardBg};
  `,m.innerHTML=`
    <div>
      <div style="font-weight:700;font-size:14px;color:${s.text};" id="omnidesk-biz-title">AI Receptionist</div>
      <div style="font-size:11px;color:${s.textMuted};margin-top:2px;" id="omnidesk-status-text">Ready</div>
    </div>
    <button id="omnidesk-close-btn" style="background:transparent;border:none;color:${s.textMuted};cursor:pointer;font-size:16px;">\u2715</button>
  `;let y=document.createElement("div");y.style.cssText=`
    flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px;
  `;let P=document.createElement("div");P.style.cssText=`
    padding: 14px 16px; border-top: 1px solid ${s.border};
    background: ${s.cardBg}; display: flex; gap: 10px;
  `;let e=document.createElement("button");e.style.cssText=`
    width: 100%; padding: 11px; border-radius: 10px; border: none;
    background: ${t}; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
  `,e.innerText="Start Call",P.appendChild(e),h.appendChild(m),h.appendChild(y),h.appendChild(P),n.appendChild(f),n.appendChild(h),document.body.appendChild(n),f.onclick=()=>{f.style.display="none",h.style.display="flex",C==="idle"&&A()},m.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{h.style.display="none",f.style.display="flex"});async function A(){let k=m.querySelector("#omnidesk-status-text");k.innerText="Connecting...",e.innerText="Connecting...",e.disabled=!0;try{let E=i.replace(/\/$/,""),N=await fetch(`${E}/api/token?businessId=${encodeURIComponent(g)}`);if(!N.ok)throw new Error("Failed to get session token");let S=await N.json();if(S.business_name){let a=m.querySelector("#omnidesk-biz-title");a&&(a.innerText=S.business_name)}p=new M({onStatusChange:a=>{if(C=a,a==="connected")k.innerText="Live Receptionist",e.innerText="End Call",e.style.background="#ef4444",e.disabled=!1,_=Date.now(),d?.();else if(a==="idle"&&(k.innerText="Call Ended",e.innerText="Start Call",e.style.background=t,e.disabled=!1,_>0)){let v=Math.round((Date.now()-_)/1e3);_=0,l?.(v)}},onTranscript:a=>{let v=document.createElement("div"),T=a.who==="user";v.style.cssText=`
            display: flex; justify-content: ${T?"flex-end":"flex-start"};
          `,v.innerHTML=`
            <div style="max-width:80%;padding:9px 13px;border-radius:${T?"14px 14px 2px 14px":"14px 14px 14px 2px"};background:${T?s.bubbleUser:s.bubbleAgent};color:${T?s.userText:s.text};font-size:13px;line-height:1.4;">
              ${a.text}
            </div>
          `,y.appendChild(v),y.scrollTop=y.scrollHeight,c?.(a)},onError:a=>{k.innerText=`Error: ${a}`,e.innerText="Start Call",e.style.background=t,e.disabled=!1}}),await p.start(S.token,S.agent_id)}catch(E){k.innerText=E.message||"Connection failed",e.innerText="Start Call",e.style.background=t,e.disabled=!1}}return e.onclick=()=>{C==="connected"&&p?(p.stop(),p=null):C==="idle"&&A()},{destroy:()=>{p&&p.stop(),n.remove()},startCall:A}}export{z as initOmniDeskWidget};
//# sourceMappingURL=vanilla.mjs.map