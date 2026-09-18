"use strict";var B=Object.defineProperty;var Y=Object.getOwnPropertyDescriptor;var G=Object.getOwnPropertyNames;var Q=Object.prototype.hasOwnProperty;var X=(l,t)=>{for(var b in t)B(l,b,{get:t[b],enumerable:!0})},Z=(l,t,b,c)=>{if(t&&typeof t=="object"||typeof t=="function")for(let x of G(t))!Q.call(l,x)&&x!==b&&B(l,x,{get:()=>t[x],enumerable:!(c=Y(t,x))||c.enumerable});return l};var ee=l=>Z(B({},"__esModule",{value:!0}),l);var ne={};X(ne,{AssemblyAIVoiceClient:()=>R,OmniDeskWidget:()=>J,initOmniDeskWidget:()=>K});module.exports=ee(ne);var r=require("react");var F=24e3,te="wss://agents.assemblyai.com/v1/ws",se=`
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${F};
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
`,ie=`
  class PlaybackProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ring = new Float32Array(sampleRate * 30);
      this._writePos = 0;
      this._readPos = 0;
      this._available = 0;
      this._step = ${F} / sampleRate;
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
`;async function q(l,t,b){let c=URL.createObjectURL(new Blob([t],{type:"application/javascript"}));try{await l.audioWorklet.addModule(c)}finally{URL.revokeObjectURL(c)}return new AudioWorkletNode(l,b)}var R=class{constructor(t){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.callbacks=t}async start(t,b){try{this.callbacks.onStatusChange?.("connecting");let c=window.AudioContext||window.webkitAudioContext;this.captureCtx=new c({sampleRate:F}),this.playbackCtx=new c({sampleRate:F}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await q(this.playbackCtx,ie,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await q(this.captureCtx,se,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let x=new URL(te);x.searchParams.set("token",t),this.ws=new WebSocket(x.toString()),this.captureNode.port.onmessage=({data:f})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let e=new Uint8Array(f),w="";for(let p=0;p<e.length;p+=32768)w+=String.fromCharCode.apply(null,Array.from(e.subarray(p,p+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(w)}));let g=new Int16Array(f),m=0;for(let p=0;p<g.length;p+=16)m+=Math.abs(g[p]);this.userLevel=Math.min(1,m/(g.length/16)/8e3)},this.ws.onopen=()=>{this.ws?.send(JSON.stringify({type:"session.update",session:{agent_id:b}}))},this.ws.onmessage=({data:f})=>{try{let e=JSON.parse(f);switch(e.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0;break;case"transcript.user":e.text&&this.callbacks.onTranscript?.({who:"user",text:e.text});break;case"transcript.agent":e.text&&this.callbacks.onTranscript?.({who:"agent",text:e.text});break;case"reply.audio":if(e.data&&this.playbackNode){let w=atob(e.data),g=new Uint8Array(w.length);for(let m=0;m<w.length;m++)g[m]=w.charCodeAt(m);this.playbackNode.port.postMessage(g.buffer,[g.buffer]),this.agentLevel=.8}break;case"reply.done":e.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:e.name||e.tool,args:e.arguments||e.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:e.name||e.tool,result:e.result});break;case"session.error":this.callbacks.onError?.(e.message||e.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.stop();break}}catch(e){console.warn("Message parsing error:",e)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(c){this.callbacks.onError?.(c.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(t){this.isMuted=t,t&&(this.userLevel=0)}getMuted(){return this.isMuted}stop(){if(this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(t=>t.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let t=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(t)};this.animFrameId=requestAnimationFrame(t)}};var s=require("react/jsx-runtime");function J({host:l,businessId:t="biz_demo_dental",theme:b="dark",position:c="bottom-right",label:x="Talk to Receptionist",accentColor:f="#10b981",className:e,onCallStart:w,onCallEnd:g,onTranscript:m}){let[p,u]=(0,r.useState)(!1),[n,o]=(0,r.useState)("idle"),[C,P]=(0,r.useState)([]),[H,I]=(0,r.useState)(0),[_,M]=(0,r.useState)(0),[y,L]=(0,r.useState)(!1),[z,a]=(0,r.useState)("AI Voice Receptionist"),[O,T]=(0,r.useState)(""),k=(0,r.useRef)(null),U=(0,r.useRef)(null),A=(0,r.useRef)(0);(0,r.useEffect)(()=>{U.current?.scrollIntoView({behavior:"smooth"})},[C]);let d=(0,r.useCallback)(async()=>{try{o("connecting"),T(""),P([]);let S=l.replace(/\/$/,""),$=await fetch(`${S}/api/token?businessId=${encodeURIComponent(t)}`);if(!$.ok)throw new Error(`Failed to fetch session token (${$.status})`);let h=await $.json();if(h.business_name&&a(h.business_name),!h.token||!h.agent_id)throw new Error("Invalid session token payload received from host");let V=new R({onStatusChange:v=>{if(o(v),v==="connected")A.current=Date.now(),w?.();else if(v==="idle"&&A.current>0){let D=Math.round((Date.now()-A.current)/1e3);A.current=0,g?.(D)}},onTranscript:v=>{P(D=>[...D,v]),m?.(v)},onAudioLevel:(v,D)=>{I(v),M(D)},onError:v=>{T(v),o("error")}});k.current=V,await V.start(h.token,h.agent_id)}catch(S){T(S.message||"Failed to start call"),o("error")}},[l,t,w,g,m]),E=(0,r.useCallback)(()=>{k.current&&(k.current.stop(),k.current=null),o("idle"),L(!1)},[]),N=(0,r.useCallback)(()=>{if(k.current){let S=!y;k.current.setMuted(S),L(S)}},[y]);(0,r.useEffect)(()=>()=>{k.current&&k.current.stop()},[]);let W=b==="dark"||b==="auto"&&typeof window<"u"&&window.matchMedia("(prefers-color-scheme: dark)").matches,i={bg:W?"#09090b":"#ffffff",cardBg:W?"#18181b":"#f4f4f5",border:W?"#27272a":"#e4e4e7",text:W?"#fafafa":"#09090b",textMuted:W?"#a1a1aa":"#71717a",bubbleAgent:W?"#27272a":"#f4f4f5",bubbleUser:f,userText:"#ffffff"},j=c==="bottom-left";return(0,s.jsxs)("div",{className:e,style:{position:"fixed",bottom:"24px",left:j?"24px":"auto",right:j?"auto":"24px",zIndex:999999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:[!p&&(0,s.jsxs)("button",{onClick:()=>{u(!0),n==="idle"&&d()},style:{display:"flex",alignItems:"center",gap:"10px",padding:"12px 20px",borderRadius:"9999px",background:i.bg,color:i.text,border:`1px solid ${i.border}`,boxShadow:"0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.2)",cursor:"pointer",fontWeight:600,fontSize:"14px",transition:"all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"},children:[(0,s.jsx)("span",{style:{width:"10px",height:"10px",borderRadius:"50%",background:n==="connected"?f:"#71717a",boxShadow:n==="connected"?`0 0 10px ${f}`:"none"}}),x]}),p&&(0,s.jsxs)("div",{style:{width:"360px",maxHeight:"560px",height:"520px",background:i.bg,border:`1px solid ${i.border}`,borderRadius:"20px",boxShadow:"0 25px 50px -12px rgba(0, 0, 0, 0.35)",display:"flex",flexDirection:"column",overflow:"hidden",transition:"all 0.3s cubic-bezier(0.16, 1, 0.3, 1)"},children:[(0,s.jsxs)("div",{style:{padding:"16px 20px",borderBottom:`1px solid ${i.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:i.cardBg},children:[(0,s.jsxs)("div",{children:[(0,s.jsx)("div",{style:{fontWeight:700,fontSize:"14px",color:i.text},children:z}),(0,s.jsxs)("div",{style:{fontSize:"11px",color:i.textMuted,display:"flex",alignItems:"center",gap:"6px",marginTop:"2px"},children:[(0,s.jsx)("span",{style:{width:"7px",height:"7px",borderRadius:"50%",background:n==="connected"?f:n==="connecting"?"#f59e0b":"#71717a"}}),n==="connected"?"Live Receptionist":n==="connecting"?"Connecting...":"Call Ended"]})]}),(0,s.jsx)("button",{onClick:()=>u(!1),style:{background:"transparent",border:"none",color:i.textMuted,cursor:"pointer",padding:"6px",borderRadius:"8px",fontSize:"16px",lineHeight:1},children:"\u2715"})]}),(0,s.jsx)("div",{style:{padding:"16px 20px",background:i.bg,borderBottom:`1px solid ${i.border}`,display:"flex",alignItems:"center",justifyContent:"center",gap:"5px",height:"64px"},children:[40,70,90,60,100,75,45,85,60,30].map((S,$)=>{let h=n==="connected",V=h?Math.max(H,_):0,v=Math.max(8,Math.min(48,S*(.3+V*1.5)));return(0,s.jsx)("div",{style:{width:"4px",height:`${v}px`,borderRadius:"4px",background:h&&_>.1?f:i.border,transition:"height 0.1s ease, background 0.2s ease"}},$)})}),(0,s.jsxs)("div",{style:{flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:"10px"},children:[C.length===0&&(0,s.jsx)("div",{style:{margin:"auto",textAlign:"center",color:i.textMuted,fontSize:"13px",lineHeight:1.5,padding:"0 20px"},children:n==="connecting"?"Connecting to AI Receptionist...":n==="connected"?"Receptionist is listening. Say hello or ask to book an appointment!":O||"Click Start Call to speak with the receptionist."}),C.map((S,$)=>{let h=S.who==="user";return(0,s.jsx)("div",{style:{display:"flex",justifyContent:h?"flex-end":"flex-start"},children:(0,s.jsx)("div",{style:{maxWidth:"80%",padding:"9px 13px",borderRadius:h?"14px 14px 2px 14px":"14px 14px 14px 2px",background:h?i.bubbleUser:i.bubbleAgent,color:h?i.userText:i.text,fontSize:"13px",lineHeight:1.4,wordBreak:"break-word"},children:S.text})},$)}),(0,s.jsx)("div",{ref:U})]}),(0,s.jsx)("div",{style:{padding:"14px 16px",borderTop:`1px solid ${i.border}`,background:i.cardBg,display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px"},children:n==="connected"?(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)("button",{onClick:N,style:{flex:1,padding:"10px",borderRadius:"10px",border:`1px solid ${i.border}`,background:y?"#ef4444":i.bg,color:y?"#ffffff":i.text,fontSize:"12.5px",fontWeight:600,cursor:"pointer",transition:"all 0.15s ease"},children:y?"Unmute Mic":"Mute Mic"}),(0,s.jsx)("button",{onClick:E,style:{flex:1,padding:"10px",borderRadius:"10px",border:"none",background:"#ef4444",color:"#ffffff",fontSize:"12.5px",fontWeight:600,cursor:"pointer",transition:"all 0.15s ease"},children:"End Call"})]}):(0,s.jsx)("button",{onClick:d,disabled:n==="connecting",style:{width:"100%",padding:"11px",borderRadius:"10px",border:"none",background:f,color:"#ffffff",fontSize:"13px",fontWeight:600,cursor:n==="connecting"?"not-allowed":"pointer",opacity:n==="connecting"?.7:1,transition:"all 0.15s ease"},children:n==="connecting"?"Connecting...":"Start Call"})})]})]})}function K(l){if(typeof window>"u")return;let{host:t,businessId:b="biz_demo_dental",theme:c="dark",position:x="bottom-right",label:f="Talk to Receptionist",accentColor:e="#10b981",onCallStart:w,onCallEnd:g,onTranscript:m}=l,p=document.getElementById("omnidesk-voice-widget-root");p&&p.remove();let u=document.createElement("div");u.id="omnidesk-voice-widget-root",u.style.position="fixed",u.style.bottom="24px",x==="bottom-left"?u.style.left="24px":u.style.right="24px",u.style.zIndex="999999",u.style.fontFamily="system-ui, -apple-system, sans-serif";let n=c==="dark"||c==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,o={bg:n?"#09090b":"#ffffff",cardBg:n?"#18181b":"#f4f4f5",border:n?"#27272a":"#e4e4e7",text:n?"#fafafa":"#09090b",textMuted:n?"#a1a1aa":"#71717a",bubbleAgent:n?"#27272a":"#f4f4f5",bubbleUser:e,userText:"#ffffff"},C=null,P="idle",H=!1,I=0,_=document.createElement("button");_.style.cssText=`
    display: flex; align-items: center; gap: 10px;
    padding: 12px 20px; border-radius: 9999px;
    background: ${o.bg}; color: ${o.text};
    border: 1px solid ${o.border};
    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
    cursor: pointer; font-weight: 600; font-size: 14px;
    transition: all 0.2s ease;
  `,_.innerHTML=`
    <span style="width:10px;height:10px;border-radius:50%;background:#71717a;display:inline-block;"></span>
    <span>${f}</span>
  `;let M=document.createElement("div");M.style.cssText=`
    width: 360px; height: 520px;
    background: ${o.bg}; border: 1px solid ${o.border};
    border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35);
    display: none; flex-direction: column; overflow: hidden;
  `;let y=document.createElement("div");y.style.cssText=`
    padding: 16px 20px; border-bottom: 1px solid ${o.border};
    display: flex; align-items: center; justify-content: space-between;
    background: ${o.cardBg};
  `,y.innerHTML=`
    <div>
      <div style="font-weight:700;font-size:14px;color:${o.text};" id="omnidesk-biz-title">AI Receptionist</div>
      <div style="font-size:11px;color:${o.textMuted};margin-top:2px;" id="omnidesk-status-text">Ready</div>
    </div>
    <button id="omnidesk-close-btn" style="background:transparent;border:none;color:${o.textMuted};cursor:pointer;font-size:16px;">\u2715</button>
  `;let L=document.createElement("div");L.style.cssText=`
    flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px;
  `;let z=document.createElement("div");z.style.cssText=`
    padding: 14px 16px; border-top: 1px solid ${o.border};
    background: ${o.cardBg}; display: flex; gap: 10px;
  `;let a=document.createElement("button");a.style.cssText=`
    width: 100%; padding: 11px; border-radius: 10px; border: none;
    background: ${e}; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
  `,a.innerText="Start Call",z.appendChild(a),M.appendChild(y),M.appendChild(L),M.appendChild(z),u.appendChild(_),u.appendChild(M),document.body.appendChild(u),_.onclick=()=>{_.style.display="none",M.style.display="flex",P==="idle"&&O()},y.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{M.style.display="none",_.style.display="flex"});async function O(){let T=y.querySelector("#omnidesk-status-text");T.innerText="Connecting...",a.innerText="Connecting...",a.disabled=!0;try{let k=t.replace(/\/$/,""),U=await fetch(`${k}/api/token?businessId=${encodeURIComponent(b)}`);if(!U.ok)throw new Error("Failed to get session token");let A=await U.json();if(A.business_name){let d=y.querySelector("#omnidesk-biz-title");d&&(d.innerText=A.business_name)}C=new R({onStatusChange:d=>{if(P=d,d==="connected")T.innerText="Live Receptionist",a.innerText="End Call",a.style.background="#ef4444",a.disabled=!1,I=Date.now(),w?.();else if(d==="idle"&&(T.innerText="Call Ended",a.innerText="Start Call",a.style.background=e,a.disabled=!1,I>0)){let E=Math.round((Date.now()-I)/1e3);I=0,g?.(E)}},onTranscript:d=>{let E=document.createElement("div"),N=d.who==="user";E.style.cssText=`
            display: flex; justify-content: ${N?"flex-end":"flex-start"};
          `,E.innerHTML=`
            <div style="max-width:80%;padding:9px 13px;border-radius:${N?"14px 14px 2px 14px":"14px 14px 14px 2px"};background:${N?o.bubbleUser:o.bubbleAgent};color:${N?o.userText:o.text};font-size:13px;line-height:1.4;">
              ${d.text}
            </div>
          `,L.appendChild(E),L.scrollTop=L.scrollHeight,m?.(d)},onError:d=>{T.innerText=`Error: ${d}`,a.innerText="Start Call",a.style.background=e,a.disabled=!1}}),await C.start(A.token,A.agent_id)}catch(k){T.innerText=k.message||"Connection failed",a.innerText="Start Call",a.style.background=e,a.disabled=!1}}return a.onclick=()=>{P==="connected"&&C?(C.stop(),C=null):P==="idle"&&O()},{destroy:()=>{C&&C.stop(),u.remove()},startCall:O}}0&&(module.exports={AssemblyAIVoiceClient,OmniDeskWidget,initOmniDeskWidget});
//# sourceMappingURL=index.js.map