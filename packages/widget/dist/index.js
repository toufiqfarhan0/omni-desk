"use strict";var ee=Object.defineProperty;var ie=Object.getOwnPropertyDescriptor;var ae=Object.getOwnPropertyNames;var re=Object.prototype.hasOwnProperty;var le=(s,e)=>{for(var d in e)ee(s,d,{get:e[d],enumerable:!0})},ce=(s,e,d,r)=>{if(e&&typeof e=="object"||typeof e=="function")for(let p of ae(e))!re.call(s,p)&&p!==d&&ee(s,p,{get:()=>e[p],enumerable:!(r=ie(e,p))||r.enumerable});return s};var de=s=>ce(ee({},"__esModule",{value:!0}),s);var me={};le(me,{AssemblyAIVoiceClient:()=>I,OmniDeskWidget:()=>te,VoiceWidget:()=>ne,initOmniDeskWidget:()=>Q});module.exports=de(me);var i=require("react");var G=24e3,pe="wss://agents.assemblyai.com/v1/ws",ue=`
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${G};
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
`,he=`
  class PlaybackProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ring = new Float32Array(sampleRate * 30);
      this._writePos = 0;
      this._readPos = 0;
      this._available = 0;
      this._step = ${G} / sampleRate;
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
`;async function se(s,e,d){let r=URL.createObjectURL(new Blob([e],{type:"application/javascript"}));try{await s.audioWorklet.addModule(r)}finally{URL.revokeObjectURL(r)}return new AudioWorkletNode(s,d)}var I=class{constructor(e){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.callbacks=e}async start(e,d){try{this.callbacks.onStatusChange?.("connecting");let r=window.AudioContext||window.webkitAudioContext;this.captureCtx=new r({sampleRate:G}),this.playbackCtx=new r({sampleRate:G}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await se(this.playbackCtx,he,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await se(this.captureCtx,ue,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let p=new URL(pe);p.searchParams.set("token",e),this.ws=new WebSocket(p.toString()),this.captureNode.port.onmessage=({data:v})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let t=new Uint8Array(v),u="";for(let _=0;_<t.length;_+=32768)u+=String.fromCharCode.apply(null,Array.from(t.subarray(_,_+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(u)}));let h=new Int16Array(v),y=0;for(let _=0;_<h.length;_+=16)y+=Math.abs(h[_]);this.userLevel=Math.min(1,y/(h.length/16)/8e3)},this.ws.onopen=()=>{d&&d.trim()&&this.ws?.send(JSON.stringify({type:"session.update",session:{agent_id:d.trim()}}))},this.ws.onmessage=({data:v})=>{try{let t=JSON.parse(v);switch(t.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0;break;case"transcript.user":t.text&&this.callbacks.onTranscript?.({who:"user",text:t.text});break;case"transcript.agent":t.text&&this.callbacks.onTranscript?.({who:"agent",text:t.text});break;case"reply.audio":if(t.data&&this.playbackNode){let u=atob(t.data),h=new Uint8Array(u.length);for(let y=0;y<u.length;y++)h[y]=u.charCodeAt(y);this.playbackNode.port.postMessage(h.buffer,[h.buffer]),this.agentLevel=.8}break;case"reply.done":t.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:t.name||t.tool,args:t.arguments||t.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:t.name||t.tool,result:t.result});break;case"session.error":this.callbacks.onError?.(t.message||t.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.stop();break}}catch(t){console.warn("Message parsing error:",t)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(r){this.callbacks.onError?.(r.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(e){this.isMuted=e,e&&(this.userLevel=0)}getMuted(){return this.isMuted}stop(){if(this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(e=>e.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let e=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(e)};this.animFrameId=requestAnimationFrame(e)}};var o=require("react/jsx-runtime"),fe={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"},be=[8,14,18,11,16,20,12,6,15];function te({host:s="",businessId:e="biz_demo_dental",agentId:d,theme:r="dark",position:p="bottom-right",label:v="Talk to Receptionist",accent:t="emerald",accentColor:u,businessName:h,greeting:y,className:_,onCallStart:q,onCallEnd:O,onTranscript:j}){let[m,V]=(0,i.useState)(!1),[w,C]=(0,i.useState)("idle"),[l,L]=(0,i.useState)([]),[W,N]=(0,i.useState)(0),[H,J]=(0,i.useState)(0),[Y,K]=(0,i.useState)(h||"OmniDesk AI Receptionist"),E=(0,i.useRef)(null),z=(0,i.useRef)(null),T=(0,i.useRef)(0),x=(0,i.useMemo)(()=>u||fe[t]||t||"#10b981",[t,u]),a=(0,i.useMemo)(()=>r==="light"?!1:r==="auto"&&typeof window<"u"?window.matchMedia("(prefers-color-scheme: dark)").matches:!0,[r]),P=(0,i.useMemo)(()=>y||(e==="biz_demo_dental"&&v.toLowerCase().includes("appointment")?"Hello! Welcome to Luxe & Mane Hair Studio. Would you like to check availability or book an appointment?":"Hello! Welcome to OmniDesk. Would you like to check availability or book a consultation?"),[y,e,v]);(0,i.useEffect)(()=>{z.current?.scrollIntoView({behavior:"smooth"})},[l]);let D=(0,i.useMemo)(()=>s?s.replace(/\/$/,""):typeof window<"u"&&window.location.origin?window.location.origin:"",[s]),F=(0,i.useCallback)(async()=>{try{C("connecting"),L([]);let b=D?`${D}/api/token?businessId=${encodeURIComponent(e)}`:`/api/token?businessId=${encodeURIComponent(e)}`,R=await fetch(b);if(!R.ok)throw new Error(`Failed to fetch session token (${R.status})`);let k=await R.json();if(k.business_name&&!h&&K(`${k.business_name} AI Receptionist`),!k.token)throw new Error("Invalid session token payload received from host");let c=d||k.agent_id||"",A=new I({onStatusChange:S=>{if(C(S),S==="connected")T.current=Date.now(),q?.();else if(S==="idle"&&T.current>0){let M=Math.round((Date.now()-T.current)/1e3);T.current=0,O?.(M)}},onTranscript:S=>{L(M=>[...M,S]),j?.(S)},onAudioLevel:(S,M)=>{N(S),J(M)},onError:S=>{C("error")}});E.current=A,await A.start(k.token,c)}catch{C("error")}},[D,e,d,h,q,O,j]),B=(0,i.useCallback)(()=>{if(E.current&&(E.current.stop(),E.current=null),C("idle"),N(0),J(0),T.current>0){let b=Math.round((Date.now()-T.current)/1e3);T.current=0,O?.(b)}},[O]);(0,i.useEffect)(()=>()=>{E.current&&E.current.stop()},[]);let n=p==="bottom-left",f=w==="connected";return(0,o.jsxs)("div",{className:_,style:{position:"relative",zIndex:99999},children:[(0,o.jsx)("div",{style:{position:"fixed",bottom:"20px",left:n?"20px":"auto",right:n?"auto":"20px",zIndex:99999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:(0,o.jsxs)("button",{type:"button",onClick:()=>V(!m),style:{display:"inline-flex",alignItems:"center",gap:"10px",background:a?"#18181b":"#ffffff",color:a?"#fafafa":"#09090b",border:`1px solid ${a?"#27272a":"#e4e4e7"}`,padding:"10px 18px",borderRadius:"9999px",cursor:"pointer",fontSize:"13px",fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.25)",transition:"transform 0.15s ease, background 0.15s ease"},onMouseEnter:b=>{b.currentTarget.style.transform="scale(1.02)"},onMouseLeave:b=>{b.currentTarget.style.transform="scale(1)"},children:[(0,o.jsx)("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:f?"#ef4444":x,boxShadow:`0 0 8px ${f?"#ef4444":x}`}}),(0,o.jsx)("span",{children:v}),(0,o.jsx)("span",{style:{fontSize:"11px",opacity:.6},children:"\u25B2"})]})}),m&&(0,o.jsxs)("div",{style:{position:"fixed",bottom:"70px",left:n?"20px":"auto",right:n?"auto":"20px",width:"320px",height:"280px",background:a?"#18181b":"#ffffff",border:`1px solid ${a?"#27272a":"#e4e4e7"}`,borderRadius:"18px",boxShadow:"0 20px 30px -10px rgba(0,0,0,0.4)",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:99999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:[(0,o.jsxs)("div",{style:{padding:"12px 16px",borderBottom:`1px solid ${a?"#27272a":"#e4e4e7"}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:a?"#09090b":"#f4f4f5"},children:[(0,o.jsxs)("div",{children:[(0,o.jsx)("div",{style:{fontSize:"13px",fontWeight:700,color:a?"#fafafa":"#09090b"},children:Y}),(0,o.jsx)("div",{style:{fontSize:"10.5px",color:x,fontWeight:600},children:f?"Live Voice Call (24kHz)":w==="connecting"?"Connecting...":"Ready to connect"})]}),(0,o.jsx)("button",{type:"button",onClick:()=>V(!1),style:{background:"transparent",border:"none",fontSize:"14px",color:"#71717a",cursor:"pointer",padding:"4px",display:"grid",placeItems:"center"},title:"Close",children:"\u2715"})]}),(0,o.jsxs)("div",{style:{flex:1,padding:"12px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"8px"},children:[(0,o.jsx)("div",{style:{alignSelf:"flex-start",background:a?"#27272a":"#f4f4f5",color:a?"#f4f4f5":"#09090b",padding:"8px 12px",borderRadius:"12px",fontSize:"12px",maxWidth:"85%",lineHeight:1.4},children:P}),l.map((b,R)=>{let k=b.who==="user";return(0,o.jsx)("div",{style:{alignSelf:k?"flex-end":"flex-start",background:k?x:a?"#27272a":"#f4f4f5",color:k?"#ffffff":a?"#f4f4f5":"#09090b",padding:"8px 12px",borderRadius:"12px",fontSize:"12px",maxWidth:"85%",lineHeight:1.4},children:b.text},R)}),(0,o.jsx)("div",{ref:z})]}),(0,o.jsxs)("div",{style:{padding:"10px 14px",borderTop:`1px solid ${a?"#27272a":"#e4e4e7"}`,display:"flex",alignItems:"center",justifyContent:"space-between"},children:[(0,o.jsx)("div",{style:{display:"flex",alignItems:"center",gap:"3px",height:"18px"},children:be.map((b,R)=>{let k=Math.max(W,H),c=f?Math.max(5,Math.min(18,Math.round(b*(.35+k*1.5)))):4;return(0,o.jsx)("div",{style:{width:"3px",height:`${c}px`,borderRadius:"2px",background:f?H>.05?x:"#3b82f6":x,opacity:f?1:.7,transition:"height 0.15s ease"}},R)})}),(0,o.jsx)("button",{type:"button",onClick:f?B:F,disabled:w==="connecting",style:{background:f?"#ef4444":x,color:"#ffffff",border:"none",padding:"7px 16px",borderRadius:"9999px",fontSize:"12px",fontWeight:700,cursor:w==="connecting"?"not-allowed":"pointer",opacity:w==="connecting"?.7:1,boxShadow:`0 2px 8px ${f?"rgba(239,68,68,0.3)":"rgba(16,185,129,0.3)"}`,transition:"all 0.15s ease"},children:f?"End Call":w==="connecting"?"Connecting...":"Start Call"})]})]})]})}var ne=te;var ge={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"},oe=[8,14,18,11,16,20,12,6,15];function Q(s={}){if(typeof window>"u")return;let{host:e,businessId:d="biz_demo_dental",agentId:r,theme:p="dark",position:v="bottom-right",label:t="Talk to Receptionist",accent:u="emerald",accentColor:h,businessName:y,greeting:_,onCallStart:q,onCallEnd:O,onTranscript:j}=s,m=h||ge[u]||u||"#10b981",V=document.getElementById("omnidesk-voice-widget-root");V&&V.remove();let w=document.createElement("div");w.id="omnidesk-voice-widget-root",w.style.fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let C=p==="dark"||p==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,l={bg:C?"#18181b":"#ffffff",headerBg:C?"#09090b":"#f4f4f5",border:C?"#27272a":"#e4e4e7",text:C?"#fafafa":"#09090b",textMuted:C?"#a1a1aa":"#71717a",bubbleAgent:C?"#27272a":"#f4f4f5",bubbleUser:m,userText:"#ffffff",agentText:C?"#f4f4f5":"#09090b"},L=null,W="idle",N=0,H=!1,J=0,Y=0,K=v==="bottom-left",E=_||"Hello! Welcome to OmniDesk. Would you like to check availability or book a consultation?",z=document.createElement("div");z.style.cssText=`
    position: fixed; bottom: 20px; ${K?"left: 20px;":"right: 20px;"};
    z-index: 999999;
  `;let T=document.createElement("button");T.style.cssText=`
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${l.bg}; color: ${l.text};
    border: 1px solid ${l.border};
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `,T.innerHTML=`
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${m};box-shadow:0 0 8px ${m};display:inline-block;"></span>
    <span>${t}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,z.appendChild(T);let x=document.createElement("div");x.style.cssText=`
    position: fixed; bottom: 70px; ${K?"left: 20px;":"right: 20px;"};
    width: 320px; height: 280px;
    background: ${l.bg}; border: 1px solid ${l.border};
    border-radius: 18px; box-shadow: 0 20px 30px -10px rgba(0,0,0,0.4);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;let a=document.createElement("div");a.style.cssText=`
    padding: 12px 16px; border-bottom: 1px solid ${l.border};
    display: flex; align-items: center; justify-content: space-between;
    background: ${l.headerBg};
  `,a.innerHTML=`
    <div>
      <div style="font-size:13px;font-weight:700;color:${l.text};" id="omnidesk-biz-title">${y||"OmniDesk AI Receptionist"}</div>
      <div style="font-size:10.5px;color:${m};font-weight:600;" id="omnidesk-status-text">Ready to connect</div>
    </div>
    <button id="omnidesk-close-btn" style="background:transparent;border:none;color:${l.textMuted};cursor:pointer;padding:4px;font-size:14px;" title="Close">\u2715</button>
  `;let P=document.createElement("div");P.style.cssText=`
    flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px;
  `;let D=document.createElement("div");D.style.cssText=`
    align-self: flex-start; background: ${l.bubbleAgent}; color: ${l.agentText};
    padding: 8px 12px; border-radius: 12px; font-size: 12px; max-width: 85%; line-height: 1.4;
  `,D.innerText=E,P.appendChild(D);let F=document.createElement("div");F.style.cssText=`
    padding: 10px 14px; border-top: 1px solid ${l.border};
    display: flex; align-items: center; justify-content: space-between;
  `;let B=document.createElement("div");B.style.cssText=`
    display: flex; align-items: center; gap: 3px; height: 18px;
  `,oe.forEach(()=>{let c=document.createElement("div");c.className="omnidesk-freq-bar",c.style.cssText=`
      width: 3px; height: 4px; border-radius: 2px;
      background: ${m}; opacity: 0.7; transition: height 0.15s ease;
    `,B.appendChild(c)});let n=document.createElement("button");n.style.cssText=`
    padding: 7px 16px; border-radius: 9999px; border: none;
    background: ${m}; color: #ffffff; font-size: 12px; font-weight: 700; cursor: pointer;
    box-shadow: 0 2px 8px rgba(16,185,129,0.3); transition: all 0.15s ease;
  `,n.innerText="Start Call",F.appendChild(B),F.appendChild(n),x.appendChild(a),x.appendChild(P),x.appendChild(F),w.appendChild(z),w.appendChild(x),document.body.appendChild(w);function f(c,A){x.querySelectorAll(".omnidesk-freq-bar").forEach((M,U)=>{let X=oe[U],g=c?Math.max(5,Math.min(18,Math.round(X*(.35+A*1.5)))):4;M.style.height=`${g}px`,M.style.opacity=c?"1":"0.7"})}function b(c){H=c,x.style.display=c?"flex":"none"}T.onclick=()=>{b(!H)},a.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{b(!1)});async function R(){let c=a.querySelector("#omnidesk-status-text"),A=z.querySelector("#omnidesk-trigger-dot");c.innerText="Connecting...",n.innerText="Connecting...",n.disabled=!0;try{let S=e?e.replace(/\/$/,""):typeof window<"u"?window.location.origin:"",M=await fetch(`${S}/api/token?businessId=${encodeURIComponent(d)}`);if(!M.ok)throw new Error("Failed to get session token");let U=await M.json();if(U.business_name&&!y){let g=a.querySelector("#omnidesk-biz-title");g&&(g.innerText=`${U.business_name} AI Receptionist`)}let X=r||U.agent_id||"";L=new I({onStatusChange:g=>{if(W=g,g==="connected")c.innerText="Live Voice Call (24kHz)",n.innerText="End Call",n.style.background="#ef4444",n.style.boxShadow="0 2px 8px rgba(239,68,68,0.3)",n.disabled=!1,A&&(A.style.background="#ef4444",A.style.boxShadow="0 0 8px #ef4444"),N=Date.now(),q?.();else if(g==="idle"&&(c.innerText="Ready to connect",n.innerText="Start Call",n.style.background=m,n.style.boxShadow="0 2px 8px rgba(16,185,129,0.3)",n.disabled=!1,A&&(A.style.background=m,A.style.boxShadow=`0 0 8px ${m}`),f(!1,0),N>0)){let $=Math.round((Date.now()-N)/1e3);N=0,O?.($)}},onTranscript:g=>{let $=document.createElement("div"),Z=g.who==="user";$.style.cssText=`
            align-self: ${Z?"flex-end":"flex-start"};
            background: ${Z?l.bubbleUser:l.bubbleAgent};
            color: ${Z?l.userText:l.agentText};
            padding: 8px 12px; border-radius: 12px; font-size: 12px; max-width: 85%; line-height: 1.4;
          `,$.innerText=g.text,P.appendChild($),P.scrollTop=P.scrollHeight,j?.(g)},onAudioLevel:(g,$)=>{J=g,Y=$,f(W==="connected",Math.max(g,$))},onError:g=>{c.innerText="Connection error",n.innerText="Start Call",n.style.background=m,n.disabled=!1,f(!1,0)}}),await L.start(U.token,X)}catch{c.innerText="Connection failed",n.innerText="Start Call",n.style.background=m,n.disabled=!1,f(!1,0)}}function k(){L&&(L.stop(),L=null),W="idle",f(!1,0)}return n.onclick=()=>{W==="connected"?k():W==="idle"&&R()},{destroy:()=>{L&&L.stop(),w.remove()},startCall:R,endCall:k}}if(typeof document<"u"){let s=document.currentScript||document.querySelector("script[data-agent], script[data-business-id]");if(s){let e=s.getAttribute("data-business-id")||void 0,d=s.getAttribute("data-agent")||void 0,r=s.getAttribute("data-theme")||"dark",p=s.getAttribute("data-accent")||"emerald",v=s.getAttribute("data-position")||"bottom-right",t=s.getAttribute("data-label")||void 0,u=s.getAttribute("data-host")||void 0,h=s.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{Q({businessId:e,agentId:d,theme:r,accent:p,position:v,label:t,host:u,greeting:h})}):Q({businessId:e,agentId:d,theme:r,accent:p,position:v,label:t,host:u,greeting:h})}}0&&(module.exports={AssemblyAIVoiceClient,OmniDeskWidget,VoiceWidget,initOmniDeskWidget});
//# sourceMappingURL=index.js.map