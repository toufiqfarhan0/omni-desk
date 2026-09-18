import{useState as A,useRef as H,useEffect as Y,useCallback as j}from"react";var B=24e3,G="wss://agents.assemblyai.com/v1/ws",Q=`
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${B};
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
`,X=`
  class PlaybackProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ring = new Float32Array(sampleRate * 30);
      this._writePos = 0;
      this._readPos = 0;
      this._available = 0;
      this._step = ${B} / sampleRate;
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
`;async function K(_,o,M){let u=URL.createObjectURL(new Blob([o],{type:"application/javascript"}));try{await _.audioWorklet.addModule(u)}finally{URL.revokeObjectURL(u)}return new AudioWorkletNode(_,M)}var $=class{constructor(o){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.callbacks=o}async start(o,M){try{this.callbacks.onStatusChange?.("connecting");let u=window.AudioContext||window.webkitAudioContext;this.captureCtx=new u({sampleRate:B}),this.playbackCtx=new u({sampleRate:B}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await K(this.playbackCtx,X,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await K(this.captureCtx,Q,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let I=new URL(G);I.searchParams.set("token",o),this.ws=new WebSocket(I.toString()),this.captureNode.port.onmessage=({data:p})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let e=new Uint8Array(p),m="";for(let r=0;r<e.length;r+=32768)m+=String.fromCharCode.apply(null,Array.from(e.subarray(r,r+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(m)}));let h=new Int16Array(p),b=0;for(let r=0;r<h.length;r+=16)b+=Math.abs(h[r]);this.userLevel=Math.min(1,b/(h.length/16)/8e3)},this.ws.onopen=()=>{this.ws?.send(JSON.stringify({type:"session.update",session:{agent_id:M}}))},this.ws.onmessage=({data:p})=>{try{let e=JSON.parse(p);switch(e.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0;break;case"transcript.user":e.text&&this.callbacks.onTranscript?.({who:"user",text:e.text});break;case"transcript.agent":e.text&&this.callbacks.onTranscript?.({who:"agent",text:e.text});break;case"reply.audio":if(e.data&&this.playbackNode){let m=atob(e.data),h=new Uint8Array(m.length);for(let b=0;b<m.length;b++)h[b]=m.charCodeAt(b);this.playbackNode.port.postMessage(h.buffer,[h.buffer]),this.agentLevel=.8}break;case"reply.done":e.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:e.name||e.tool,args:e.arguments||e.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:e.name||e.tool,result:e.result});break;case"session.error":this.callbacks.onError?.(e.message||e.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.stop();break}}catch(e){console.warn("Message parsing error:",e)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(u){this.callbacks.onError?.(u.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(o){this.isMuted=o,o&&(this.userLevel=0)}getMuted(){return this.isMuted}stop(){if(this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(o=>o.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let o=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(o)};this.animFrameId=requestAnimationFrame(o)}};import{Fragment as ee,jsx as d,jsxs as L}from"react/jsx-runtime";function Z({host:_,businessId:o="biz_demo_dental",theme:M="dark",position:u="bottom-right",label:I="Talk to Receptionist",accentColor:p="#10b981",className:e,onCallStart:m,onCallEnd:h,onTranscript:b}){let[r,l]=A(!1),[s,i]=A("idle"),[y,R]=A([]),[q,N]=A(0),[v,w]=A(0),[f,T]=A(!1),[O,n]=A("AI Voice Receptionist"),[U,C]=A(""),x=H(null),D=H(null),S=H(0);Y(()=>{D.current?.scrollIntoView({behavior:"smooth"})},[y]);let a=j(async()=>{try{i("connecting"),C(""),R([]);let k=_.replace(/\/$/,""),E=await fetch(`${k}/api/token?businessId=${encodeURIComponent(o)}`);if(!E.ok)throw new Error(`Failed to fetch session token (${E.status})`);let c=await E.json();if(c.business_name&&n(c.business_name),!c.token||!c.agent_id)throw new Error("Invalid session token payload received from host");let F=new $({onStatusChange:g=>{if(i(g),g==="connected")S.current=Date.now(),m?.();else if(g==="idle"&&S.current>0){let V=Math.round((Date.now()-S.current)/1e3);S.current=0,h?.(V)}},onTranscript:g=>{R(V=>[...V,g]),b?.(g)},onAudioLevel:(g,V)=>{N(g),w(V)},onError:g=>{C(g),i("error")}});x.current=F,await F.start(c.token,c.agent_id)}catch(k){C(k.message||"Failed to start call"),i("error")}},[_,o,m,h,b]),P=j(()=>{x.current&&(x.current.stop(),x.current=null),i("idle"),T(!1)},[]),W=j(()=>{if(x.current){let k=!f;x.current.setMuted(k),T(k)}},[f]);Y(()=>()=>{x.current&&x.current.stop()},[]);let z=M==="dark"||M==="auto"&&typeof window<"u"&&window.matchMedia("(prefers-color-scheme: dark)").matches,t={bg:z?"#09090b":"#ffffff",cardBg:z?"#18181b":"#f4f4f5",border:z?"#27272a":"#e4e4e7",text:z?"#fafafa":"#09090b",textMuted:z?"#a1a1aa":"#71717a",bubbleAgent:z?"#27272a":"#f4f4f5",bubbleUser:p,userText:"#ffffff"},J=u==="bottom-left";return L("div",{className:e,style:{position:"fixed",bottom:"24px",left:J?"24px":"auto",right:J?"auto":"24px",zIndex:999999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:[!r&&L("button",{onClick:()=>{l(!0),s==="idle"&&a()},style:{display:"flex",alignItems:"center",gap:"10px",padding:"12px 20px",borderRadius:"9999px",background:t.bg,color:t.text,border:`1px solid ${t.border}`,boxShadow:"0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.2)",cursor:"pointer",fontWeight:600,fontSize:"14px",transition:"all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"},children:[d("span",{style:{width:"10px",height:"10px",borderRadius:"50%",background:s==="connected"?p:"#71717a",boxShadow:s==="connected"?`0 0 10px ${p}`:"none"}}),I]}),r&&L("div",{style:{width:"360px",maxHeight:"560px",height:"520px",background:t.bg,border:`1px solid ${t.border}`,borderRadius:"20px",boxShadow:"0 25px 50px -12px rgba(0, 0, 0, 0.35)",display:"flex",flexDirection:"column",overflow:"hidden",transition:"all 0.3s cubic-bezier(0.16, 1, 0.3, 1)"},children:[L("div",{style:{padding:"16px 20px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:t.cardBg},children:[L("div",{children:[d("div",{style:{fontWeight:700,fontSize:"14px",color:t.text},children:O}),L("div",{style:{fontSize:"11px",color:t.textMuted,display:"flex",alignItems:"center",gap:"6px",marginTop:"2px"},children:[d("span",{style:{width:"7px",height:"7px",borderRadius:"50%",background:s==="connected"?p:s==="connecting"?"#f59e0b":"#71717a"}}),s==="connected"?"Live Receptionist":s==="connecting"?"Connecting...":"Call Ended"]})]}),d("button",{onClick:()=>l(!1),style:{background:"transparent",border:"none",color:t.textMuted,cursor:"pointer",padding:"6px",borderRadius:"8px",fontSize:"16px",lineHeight:1},children:"\u2715"})]}),d("div",{style:{padding:"16px 20px",background:t.bg,borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"center",gap:"5px",height:"64px"},children:[40,70,90,60,100,75,45,85,60,30].map((k,E)=>{let c=s==="connected",F=c?Math.max(q,v):0,g=Math.max(8,Math.min(48,k*(.3+F*1.5)));return d("div",{style:{width:"4px",height:`${g}px`,borderRadius:"4px",background:c&&v>.1?p:t.border,transition:"height 0.1s ease, background 0.2s ease"}},E)})}),L("div",{style:{flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:"10px"},children:[y.length===0&&d("div",{style:{margin:"auto",textAlign:"center",color:t.textMuted,fontSize:"13px",lineHeight:1.5,padding:"0 20px"},children:s==="connecting"?"Connecting to AI Receptionist...":s==="connected"?"Receptionist is listening. Say hello or ask to book an appointment!":U||"Click Start Call to speak with the receptionist."}),y.map((k,E)=>{let c=k.who==="user";return d("div",{style:{display:"flex",justifyContent:c?"flex-end":"flex-start"},children:d("div",{style:{maxWidth:"80%",padding:"9px 13px",borderRadius:c?"14px 14px 2px 14px":"14px 14px 14px 2px",background:c?t.bubbleUser:t.bubbleAgent,color:c?t.userText:t.text,fontSize:"13px",lineHeight:1.4,wordBreak:"break-word"},children:k.text})},E)}),d("div",{ref:D})]}),d("div",{style:{padding:"14px 16px",borderTop:`1px solid ${t.border}`,background:t.cardBg,display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px"},children:s==="connected"?L(ee,{children:[d("button",{onClick:W,style:{flex:1,padding:"10px",borderRadius:"10px",border:`1px solid ${t.border}`,background:f?"#ef4444":t.bg,color:f?"#ffffff":t.text,fontSize:"12.5px",fontWeight:600,cursor:"pointer",transition:"all 0.15s ease"},children:f?"Unmute Mic":"Mute Mic"}),d("button",{onClick:P,style:{flex:1,padding:"10px",borderRadius:"10px",border:"none",background:"#ef4444",color:"#ffffff",fontSize:"12.5px",fontWeight:600,cursor:"pointer",transition:"all 0.15s ease"},children:"End Call"})]}):d("button",{onClick:a,disabled:s==="connecting",style:{width:"100%",padding:"11px",borderRadius:"10px",border:"none",background:p,color:"#ffffff",fontSize:"13px",fontWeight:600,cursor:s==="connecting"?"not-allowed":"pointer",opacity:s==="connecting"?.7:1,transition:"all 0.15s ease"},children:s==="connecting"?"Connecting...":"Start Call"})})]})]})}function te(_){if(typeof window>"u")return;let{host:o,businessId:M="biz_demo_dental",theme:u="dark",position:I="bottom-right",label:p="Talk to Receptionist",accentColor:e="#10b981",onCallStart:m,onCallEnd:h,onTranscript:b}=_,r=document.getElementById("omnidesk-voice-widget-root");r&&r.remove();let l=document.createElement("div");l.id="omnidesk-voice-widget-root",l.style.position="fixed",l.style.bottom="24px",I==="bottom-left"?l.style.left="24px":l.style.right="24px",l.style.zIndex="999999",l.style.fontFamily="system-ui, -apple-system, sans-serif";let s=u==="dark"||u==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,i={bg:s?"#09090b":"#ffffff",cardBg:s?"#18181b":"#f4f4f5",border:s?"#27272a":"#e4e4e7",text:s?"#fafafa":"#09090b",textMuted:s?"#a1a1aa":"#71717a",bubbleAgent:s?"#27272a":"#f4f4f5",bubbleUser:e,userText:"#ffffff"},y=null,R="idle",q=!1,N=0,v=document.createElement("button");v.style.cssText=`
    display: flex; align-items: center; gap: 10px;
    padding: 12px 20px; border-radius: 9999px;
    background: ${i.bg}; color: ${i.text};
    border: 1px solid ${i.border};
    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
    cursor: pointer; font-weight: 600; font-size: 14px;
    transition: all 0.2s ease;
  `,v.innerHTML=`
    <span style="width:10px;height:10px;border-radius:50%;background:#71717a;display:inline-block;"></span>
    <span>${p}</span>
  `;let w=document.createElement("div");w.style.cssText=`
    width: 360px; height: 520px;
    background: ${i.bg}; border: 1px solid ${i.border};
    border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35);
    display: none; flex-direction: column; overflow: hidden;
  `;let f=document.createElement("div");f.style.cssText=`
    padding: 16px 20px; border-bottom: 1px solid ${i.border};
    display: flex; align-items: center; justify-content: space-between;
    background: ${i.cardBg};
  `,f.innerHTML=`
    <div>
      <div style="font-weight:700;font-size:14px;color:${i.text};" id="omnidesk-biz-title">AI Receptionist</div>
      <div style="font-size:11px;color:${i.textMuted};margin-top:2px;" id="omnidesk-status-text">Ready</div>
    </div>
    <button id="omnidesk-close-btn" style="background:transparent;border:none;color:${i.textMuted};cursor:pointer;font-size:16px;">\u2715</button>
  `;let T=document.createElement("div");T.style.cssText=`
    flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px;
  `;let O=document.createElement("div");O.style.cssText=`
    padding: 14px 16px; border-top: 1px solid ${i.border};
    background: ${i.cardBg}; display: flex; gap: 10px;
  `;let n=document.createElement("button");n.style.cssText=`
    width: 100%; padding: 11px; border-radius: 10px; border: none;
    background: ${e}; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
  `,n.innerText="Start Call",O.appendChild(n),w.appendChild(f),w.appendChild(T),w.appendChild(O),l.appendChild(v),l.appendChild(w),document.body.appendChild(l),v.onclick=()=>{v.style.display="none",w.style.display="flex",R==="idle"&&U()},f.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{w.style.display="none",v.style.display="flex"});async function U(){let C=f.querySelector("#omnidesk-status-text");C.innerText="Connecting...",n.innerText="Connecting...",n.disabled=!0;try{let x=o.replace(/\/$/,""),D=await fetch(`${x}/api/token?businessId=${encodeURIComponent(M)}`);if(!D.ok)throw new Error("Failed to get session token");let S=await D.json();if(S.business_name){let a=f.querySelector("#omnidesk-biz-title");a&&(a.innerText=S.business_name)}y=new $({onStatusChange:a=>{if(R=a,a==="connected")C.innerText="Live Receptionist",n.innerText="End Call",n.style.background="#ef4444",n.disabled=!1,N=Date.now(),m?.();else if(a==="idle"&&(C.innerText="Call Ended",n.innerText="Start Call",n.style.background=e,n.disabled=!1,N>0)){let P=Math.round((Date.now()-N)/1e3);N=0,h?.(P)}},onTranscript:a=>{let P=document.createElement("div"),W=a.who==="user";P.style.cssText=`
            display: flex; justify-content: ${W?"flex-end":"flex-start"};
          `,P.innerHTML=`
            <div style="max-width:80%;padding:9px 13px;border-radius:${W?"14px 14px 2px 14px":"14px 14px 14px 2px"};background:${W?i.bubbleUser:i.bubbleAgent};color:${W?i.userText:i.text};font-size:13px;line-height:1.4;">
              ${a.text}
            </div>
          `,T.appendChild(P),T.scrollTop=T.scrollHeight,b?.(a)},onError:a=>{C.innerText=`Error: ${a}`,n.innerText="Start Call",n.style.background=e,n.disabled=!1}}),await y.start(S.token,S.agent_id)}catch(x){C.innerText=x.message||"Connection failed",n.innerText="Start Call",n.style.background=e,n.disabled=!1}}return n.onclick=()=>{R==="connected"&&y?(y.stop(),y=null):R==="idle"&&U()},{destroy:()=>{y&&y.stop(),l.remove()},startCall:U}}export{$ as AssemblyAIVoiceClient,Z as OmniDeskWidget,te as initOmniDeskWidget};
//# sourceMappingURL=index.mjs.map