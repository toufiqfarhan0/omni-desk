"use strict";var Se=Object.defineProperty;var Le=Object.getOwnPropertyDescriptor;var $e=Object.getOwnPropertyNames;var _e=Object.prototype.hasOwnProperty;var Ae=(g,o)=>{for(var k in o)Se(g,k,{get:o[k],enumerable:!0})},Ie=(g,o,k,v)=>{if(o&&typeof o=="object"||typeof o=="function")for(let S of $e(o))!_e.call(g,S)&&S!==k&&Se(g,S,{get:()=>o[S],enumerable:!(v=Le(o,S))||v.enumerable});return g};var Re=g=>Ie(Se({},"__esModule",{value:!0}),g);var Ne={};Ae(Ne,{AssemblyAIVoiceClient:()=>ne,OmniDeskWidget:()=>Te,VoiceWidget:()=>Me,initOmniDeskWidget:()=>ke});module.exports=Re(Ne);var d=require("react");var be=24e3,We="wss://agents.assemblyai.com/v1/ws",ze=`
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${be};
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
`,Fe=`
  class PlaybackProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ring = new Float32Array(sampleRate * 30);
      this._writePos = 0;
      this._readPos = 0;
      this._available = 0;
      this._step = ${be} / sampleRate;
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
`;async function Ee(g,o,k){let v=URL.createObjectURL(new Blob([o],{type:"application/javascript"}));try{await g.audioWorklet.addModule(v)}finally{URL.revokeObjectURL(v)}return new AudioWorkletNode(g,k)}var ne=class{constructor(o){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.isThinking=!1;this.callbacks=o}setThinking(o){this.isThinking!==o&&(this.isThinking=o,this.callbacks.onThinkingChange?.(o))}async start(o,k,v){try{this.callbacks.onStatusChange?.("connecting");let S=window.AudioContext||window.webkitAudioContext;this.captureCtx=new S({sampleRate:be}),this.playbackCtx=new S({sampleRate:be}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await Ee(this.playbackCtx,Fe,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0}}),this.captureNode=await Ee(this.captureCtx,ze,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let J=new URL(We);J.searchParams.set("token",o),this.ws=new WebSocket(J.toString()),this.captureNode.port.onmessage=({data:T})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let l=new Uint8Array(T),_="";for(let W=0;W<l.length;W+=32768)_+=String.fromCharCode.apply(null,Array.from(l.subarray(W,W+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(_)}));let N=new Int16Array(T),A=0;for(let W=0;W<N.length;W+=16)A+=Math.abs(N[W]);this.userLevel=Math.min(1,A/(N.length/16)/8e3)},this.ws.onopen=()=>{let T={};k&&k.trim()?T.agent_id=k.trim():v&&v.trim()&&(T.output={voice:v.trim()}),Object.keys(T).length>0&&this.ws?.send(JSON.stringify({type:"session.update",session:T}))};let L="",R="";this.ws.onmessage=({data:T})=>{try{let l=JSON.parse(T);switch(l.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0,R="",this.setThinking(!1);break;case"transcript.user.delta":l.text&&(R=l.text,this.callbacks.onTranscript?.({who:"user",text:l.text,isFinal:!1}));break;case"transcript.user":l.text&&(R=l.text,this.callbacks.onTranscript?.({who:"user",text:l.text,isFinal:!0}),this.setThinking(!0));break;case"reply.started":L="";break;case"transcript.agent.delta":l.delta&&(this.setThinking(!1),L&&!L.endsWith(" ")&&!/^[.,!?;:%)]/.test(l.delta)?L+=" "+l.delta:L+=l.delta,this.callbacks.onTranscript?.({who:"agent",text:L,isFinal:!1}));break;case"transcript.agent":l.text&&(this.setThinking(!1),L=l.text,this.callbacks.onTranscript?.({who:"agent",text:l.text,isFinal:!0}));break;case"reply.audio":if(l.data&&this.playbackNode){let _=atob(l.data),N=new Uint8Array(_.length);for(let A=0;A<_.length;A++)N[A]=_.charCodeAt(A);this.playbackNode.port.postMessage(N.buffer,[N.buffer]),this.agentLevel=.8}break;case"reply.done":l.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:l.name||l.tool,args:l.arguments||l.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:l.name||l.tool,result:l.result});break;case"session.error":this.setThinking(!1),this.callbacks.onError?.(l.message||l.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.setThinking(!1),this.stop();break}}catch(l){console.warn("Message parsing error:",l)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(S){this.callbacks.onError?.(S.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(o){this.isMuted=o,o&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(o,k){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:o})),k&&this.ws.send(JSON.stringify({type:"reply.create",instructions:k})),!0}catch(v){return console.error("Failed to send message to agent:",v),!1}}sendEmailInput(o){return this.sendUserMessage(`My email address is ${o}`,`The caller entered their email address: ${o}. Call verify_customer_email to validate it, then ask the caller: "I have verified your email as ${o}. Can you please confirm with yes or no?" Do not book until they confirm with yes. If they say no, ask for their email again.`)}stop(){if(this.setThinking(!1),this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(o=>o.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let o=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(o)};this.animFrameId=requestAnimationFrame(o)}};var t=require("react/jsx-runtime"),Pe={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function Te({host:g="",businessId:o="biz_demo_dental",agentId:k,theme:v="light",position:S="bottom-right",label:J="Talk to Receptionist",accent:L="emerald",accentColor:R,businessName:T,greeting:l,className:_,onCallStart:N,onCallEnd:A,onTranscript:W}){let[m,pe]=(0,d.useState)(!1),[y,a]=(0,d.useState)(!1),[C,D]=(0,d.useState)("idle"),[U,G]=(0,d.useState)([]),[xe,ue]=(0,d.useState)(0),[we,ge]=(0,d.useState)(0),[ve,se]=(0,d.useState)("0:00"),[q,oe]=(0,d.useState)(T||"OmniDesk Hair Salon & Studio"),[K,M]=(0,d.useState)(!1),[Q,le]=(0,d.useState)(""),[Y,te]=(0,d.useState)(!1),[h,$]=(0,d.useState)(""),[fe,E]=(0,d.useState)(""),[z,b]=(0,d.useState)(!1),x=(0,d.useRef)(null),X=(0,d.useRef)(null),p=(0,d.useRef)(0),O=(0,d.useRef)(null),I=(0,d.useRef)(0),me=(0,d.useRef)(!1),ie=(0,d.useRef)(!1),w=(0,d.useRef)(!1),F=(0,d.useMemo)(()=>R||Pe[L]||L||"#10b981",[L,R]),s=(0,d.useMemo)(()=>v==="dark"?!0:v==="auto"&&typeof window<"u"?window.matchMedia("(prefers-color-scheme: dark)").matches:!1,[v]);(0,d.useEffect)(()=>{X.current&&(X.current.scrollTop=X.current.scrollHeight)},[U,z]);let ee=(0,d.useMemo)(()=>g?g.replace(/\/$/,""):typeof window<"u"&&window.location.origin?window.location.origin:"",[g]),de=(0,d.useCallback)(()=>{I.current=Date.now(),se("0:00"),O.current&&clearInterval(O.current),O.current=setInterval(()=>{let n=Date.now()-I.current,u=Math.floor(n/1e3),c=Math.floor(u/60),P=u%60;se(`${c}:${String(P).padStart(2,"0")}`)},250)},[]),j=(0,d.useCallback)(()=>{O.current&&(clearInterval(O.current),O.current=null)},[]),he=(0,d.useCallback)(async()=>{try{D("connecting"),me.current=!1,ie.current=!1,w.current=!1,M(!1),de();let u=`${ee?ee.replace(/\/$/,""):""}/api/token?businessId=${encodeURIComponent(o)}`,c=await fetch(u);if(!c.ok)throw new Error("Failed to initialize voice session");let P=await c.json();if(P.business_name&&!T&&oe(P.business_name),!P.token)throw new Error("Invalid session token payload received from host");let Z=k||P.agent_id||"",V=new ne({onStatusChange:f=>{if(D(f),f==="connected")p.current=Date.now(),N?.();else if(f==="idle"){if(b(!1),j(),p.current>0){let e=Math.round((Date.now()-p.current)/1e3);p.current=0,A?.(e)}}else f==="error"&&(b(!1),j())},onThinkingChange:f=>{f&&b(!0)},onTranscript:f=>{if(f.who==="user"?b(!0):f.who==="agent"&&f.text&&f.text.trim().length>0&&b(!1),G(e=>{let i=e[e.length-1];if(i&&i.who===f.who&&!i.isFinal){let H=[...e];return H[H.length-1]={...i,text:f.text,isFinal:f.isFinal??!1},H}return[...e,{id:f.id||`${Date.now()}-${Math.random()}`,who:f.who,text:f.text,isFinal:f.isFinal??!1}]}),W?.(f),f.who==="user"){let e=f.text.toLowerCase();(e==="no"||e.startsWith("no ")||e.includes("no,")||e.includes("wrong")||e.includes("incorrect")||e.includes("change my email")||e.includes("different email"))&&(w.current=!1),(f.text.includes("@")||e.includes(" at ")&&e.includes(" dot ")||e.includes("gmail.com")||e.includes("yahoo.com")||e.includes("outlook.com")||e.includes("hotmail.com")||e.includes("icloud.com"))&&(M(!1),w.current=!0)}else if(f.who==="agent"){let e=f.text.toLowerCase();if(e.includes("confirmation code is")||e.includes("booking is confirmed")||e.includes("scheduled your appointment")||e.includes("all set, your appointment")||e.includes("sent your confirmation")&&(e.includes("code")||e.includes("calendar invite"))||e.includes("sent a calendar invite")&&(e.includes("code")||e.includes("all set"))){ie.current=!0,w.current=!1,M(!1);return}if(ie.current){M(!1);return}if(e.includes("confirm with yes or no")||e.includes("yes or no")||e.includes("is that correct")||e.includes("is that right")){w.current=!0,M(!1);return}e.includes("what is your email")||e.includes("what's your email")||e.includes("may i have your email")||e.includes("can i have your email")||e.includes("could i get your email")||e.includes("could you provide your email")||e.includes("provide your email")||e.includes("enter your email")||e.includes("spell your email")||e.includes("share your email")||e.includes("need your email")||e.includes("what email")||e.includes("which email")||e.includes("where can i send your confirmation")||e.includes("where should i send your confirmation")||e.includes("where can i send your calendar")||e.includes("where should i send your calendar")||e.includes("email")&&(e.includes("what is")||e.includes("what's")||e.includes("may i have")||e.includes("can i have")||e.includes("provide")||e.includes("give me")||e.includes("tell me")||e.includes("send your calendar invite")||e.includes("send your confirmation"))?(w.current=!1,M(!0)):M(!1)}},onAudioLevel:(f,e)=>{ue(f),ge(e)},onError:()=>{D("error"),j()}});x.current=V,await V.start(P.token,Z,P.voice)}catch{D("error"),j()}},[ee,o,k,T,N,A,W,de,j]),Ce=(0,d.useCallback)(()=>{if(x.current&&(x.current.stop(),x.current=null),D("idle"),b(!1),ue(0),ge(0),j(),ie.current=!1,w.current=!1,M(!1),$(""),E(""),p.current>0){let n=Math.round((Date.now()-p.current)/1e3);p.current=0,A?.(n)}},[A,j]),ye=(0,d.useCallback)(async n=>{n.preventDefault();let u=Q.trim();if(u){te(!0),$(""),E("");try{let c=ee?ee.replace(/\/$/,""):"",P=await fetch(`${c}/api/tools/${encodeURIComponent(o)}/verify_customer_email`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:u})}),Z=await P.json();if(!P.ok||!Z.valid||!Z.email){$(Z.message||"Invalid email or domain has no active mail server."),te(!1);return}let V=Z.email;E(`Verified: ${V}. Sent to agent.`),G(f=>[...f,{who:"user",text:`My email is ${V}`}]),x.current&&x.current.sendEmailInput(V),b(!0),w.current=!0,le(""),M(!1),E("")}catch(c){$(c.message||"Failed to verify email with mail server.")}finally{te(!1)}}},[Q,ee,o]);(0,d.useEffect)(()=>()=>{j(),x.current&&x.current.stop()},[j]);let ae=S==="bottom-left",r=C==="connected";return(0,t.jsxs)("div",{className:_,style:{position:"relative",zIndex:99999},children:[(0,t.jsx)("div",{style:{position:"fixed",bottom:"20px",left:ae?"20px":"auto",right:ae?"auto":"20px",zIndex:99999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:(0,t.jsxs)("button",{type:"button",onClick:()=>pe(!m),style:{display:"inline-flex",alignItems:"center",gap:"10px",background:s?"#18181b":"#ffffff",color:s?"#fafafa":"#09090b",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,padding:"10px 18px",borderRadius:"9999px",cursor:"pointer",fontSize:"13px",fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.18)",transition:"transform 0.15s ease, background 0.15s ease"},onMouseEnter:n=>{n.currentTarget.style.transform="scale(1.02)"},onMouseLeave:n=>{n.currentTarget.style.transform="scale(1)"},children:[(0,t.jsx)("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:r?"#ef4444":F,boxShadow:`0 0 8px ${r?"#ef4444":F}`}}),(0,t.jsx)("span",{children:J}),(0,t.jsx)("span",{style:{fontSize:"11px",opacity:.6},children:"\u25B2"})]})}),m&&(0,t.jsxs)(t.Fragment,{children:[y&&(0,t.jsx)("div",{onClick:()=>a(!1),style:{position:"fixed",inset:0,background:"rgba(0, 0, 0, 0.7)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",zIndex:999998}}),(0,t.jsxs)("div",{style:{position:"fixed",bottom:y?"auto":"80px",left:y?"50%":ae?"20px":"auto",right:y||ae?"auto":"20px",top:y?"50%":"auto",transform:y?"translate(-50%, -50%)":"none",width:y?"calc(100vw - 40px)":"390px",maxWidth:y?"1140px":"calc(100vw - 32px)",height:y?"calc(100vh - 40px)":"560px",maxHeight:y?"900px":"calc(100vh - 100px)",background:s?"#09090b":"#ffffff",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,borderRadius:"20px",boxShadow:y?"0 32px 64px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)":"0 24px 48px -12px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:999999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",transition:"all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"},children:[(0,t.jsx)("style",{children:`
              @keyframes omnidesk-typing-dot {
                0%, 80%, 100% { transform: translateY(0) scale(0.85); opacity: 0.35; }
                40% { transform: translateY(-6px) scale(1.15); opacity: 1; }
              }
              @keyframes omnidesk-pulse-amber {
                0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.45); }
                70% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
                100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
              }
              .omnidesk-motion-dot {
                display: inline-block;
                width: 6.5px;
                height: 6.5px;
                border-radius: 50%;
                background-color: currentColor;
                animation: omnidesk-typing-dot 1.25s infinite ease-in-out both;
                will-change: transform, opacity;
              }
              .omnidesk-dot-1 { animation-delay: 0s; }
              .omnidesk-dot-2 { animation-delay: 0.18s; }
              .omnidesk-dot-3 { animation-delay: 0.36s; }
            `}),(0,t.jsxs)("div",{style:{background:s?"#18181b":"#ffffff",color:s?"#ffffff":"#09090b",borderBottom:`1px solid ${s?"#27272a":"#e4e4e7"}`,padding:y?"16px 22px":"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",userSelect:"none",flexShrink:0},children:[(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"10px",minWidth:0},children:[(0,t.jsx)("div",{style:{color:s?"rgba(255,255,255,0.6)":"#71717a",display:"grid",placeItems:"center",flexShrink:0},children:(0,t.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,t.jsx)("circle",{cx:"12",cy:"12",r:"1"}),(0,t.jsx)("circle",{cx:"12",cy:"5",r:"1"}),(0,t.jsx)("circle",{cx:"12",cy:"19",r:"1"})]})}),(0,t.jsx)("div",{style:{width:"28px",height:"28px",borderRadius:"50%",background:s?"rgba(255,255,255,0.15)":F==="#18181b"?"rgba(24,24,27,0.08)":`${F}18`,display:"grid",placeItems:"center",flexShrink:0,color:s?"#ffffff":F==="#18181b"?"#09090b":F},children:(0,t.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,t.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,t.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),(0,t.jsx)("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]})}),(0,t.jsxs)("div",{style:{display:"flex",flexDirection:"column",minWidth:0},children:[(0,t.jsx)("div",{style:{fontSize:"13.5px",fontWeight:600,color:s?"#ffffff":"#09090b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},children:q}),(0,t.jsxs)("div",{style:{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"11px",color:s?"rgba(255,255,255,0.75)":"#71717a"},children:[(0,t.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:r?z?"#f59e0b":"#22c55e":C==="connecting"?"#eab308":s?"rgba(255,255,255,0.4)":"#a1a1aa",animation:z?"omnidesk-pulse-amber 1.5s infinite":"none"}}),(0,t.jsx)("span",{children:r?z?"Thinking \xB7 Checking tools...":"Live \xB7 Speaking":C==="connecting"?"Connecting...":C==="error"?"Error":"Idle \xB7 Ready"})]})]})]}),(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[(0,t.jsx)("button",{type:"button",onClick:()=>a(!y),title:y?"Exit Fullscreen":"Open Full",style:{background:s?"rgba(255,255,255,0.1)":"#f4f4f5",border:s?"1px solid rgba(255,255,255,0.15)":"1px solid #e4e4e7",borderRadius:"7px",color:s?"#ffffff":"#52525b",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:n=>n.currentTarget.style.background=s?"rgba(255,255,255,0.2)":"#e4e4e7",onMouseLeave:n=>n.currentTarget.style.background=s?"rgba(255,255,255,0.1)":"#f4f4f5",children:y?(0,t.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,t.jsx)("polyline",{points:"4 14 10 14 10 20"}),(0,t.jsx)("polyline",{points:"20 10 14 10 14 4"}),(0,t.jsx)("line",{x1:"14",y1:"10",x2:"21",y2:"3"}),(0,t.jsx)("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]}):(0,t.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,t.jsx)("polyline",{points:"15 3 21 3 21 9"}),(0,t.jsx)("polyline",{points:"9 21 3 21 3 15"}),(0,t.jsx)("line",{x1:"21",y1:"3",x2:"14",y2:"10"}),(0,t.jsx)("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]})}),(0,t.jsx)("button",{type:"button",onClick:()=>{r&&Ce(),pe(!1)},title:"Close Widget",style:{background:s?"rgba(255,255,255,0.1)":"#f4f4f5",border:s?"1px solid rgba(255,255,255,0.15)":"1px solid #e4e4e7",borderRadius:"7px",color:s?"#ffffff":"#52525b",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:n=>n.currentTarget.style.background=s?"rgba(255,255,255,0.2)":"#e4e4e7",onMouseLeave:n=>n.currentTarget.style.background=s?"rgba(255,255,255,0.1)":"#f4f4f5",children:(0,t.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,t.jsx)("line",{x1:"18",y1:"6",x2:"6",y2:"18"}),(0,t.jsx)("line",{x1:"6",y1:"6",x2:"18",y2:"18"})]})})]})]}),(0,t.jsxs)("div",{ref:X,style:{flex:1,minHeight:0,padding:"16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"12px",background:s?"#09090b":"#ffffff"},children:[U.length===0&&(0,t.jsxs)("div",{style:{margin:"auto",textAlign:"center",padding:"10px 18px",background:s?"#18181b":"#f4f4f5",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,color:s?"#a1a1aa":"#52525b",borderRadius:"12px",fontSize:"12.5px",fontWeight:500,display:"inline-flex",alignItems:"center",gap:"8px",alignSelf:"center"},children:[(0,t.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:r?"#22c55e":C==="connecting"?"#eab308":"#a1a1aa",display:"inline-block"}}),(0,t.jsx)("span",{children:r?"Connected \xB7 Speak to our receptionist":C==="connecting"?"Connecting to receptionist...":"Start a call to talk to our receptionist"})]}),U.map((n,u)=>{let c=n.who==="user";return(0,t.jsx)("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:c?"flex-end":"flex-start"},children:(0,t.jsxs)("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[!c&&(0,t.jsx)("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:(0,t.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,t.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,t.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),(0,t.jsx)("div",{style:{padding:"10px 14px",borderRadius:c?"14px 14px 2px 14px":"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:c?F:s?"#18181b":"#f4f4f5",color:c?"#ffffff":s?"#fafafa":"#09090b",border:!c&&s?"1px solid #27272a":"none",boxShadow:c?`0 2px 8px ${F}35`:"0 1px 2px rgba(0,0,0,0.04)"},children:n.text})]})},u)}),z&&(0,t.jsx)("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:"flex-start"},children:(0,t.jsxs)("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[(0,t.jsx)("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:(0,t.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,t.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,t.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),(0,t.jsxs)("div",{style:{padding:"10px 14px",borderRadius:"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:s?"#18181b":"#f4f4f5",color:s?"#a1a1aa":"#71717a",border:s?"1px solid #27272a":"none",boxShadow:"0 1px 2px rgba(0,0,0,0.04)",display:"inline-flex",alignItems:"center",gap:"5px",minHeight:"38px"},title:"Agent is thinking and processing...",children:[(0,t.jsx)("span",{className:"omnidesk-motion-dot omnidesk-dot-1"}),(0,t.jsx)("span",{className:"omnidesk-motion-dot omnidesk-dot-2"}),(0,t.jsx)("span",{className:"omnidesk-motion-dot omnidesk-dot-3"})]})]})})]}),K&&r&&(0,t.jsxs)("div",{style:{padding:"11px 16px",background:"#f0fdf4",borderTop:"1px solid #bbf7d0",display:"flex",flexDirection:"column",gap:"7px",flexShrink:0},children:[(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"},children:[(0,t.jsxs)("span",{style:{fontSize:"11px",fontWeight:700,color:"#15803d",textTransform:"uppercase",letterSpacing:"0.04em",display:"inline-flex",alignItems:"center",gap:"6px"},children:[(0,t.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:"#22c55e",display:"inline-block"}}),"Email Requested by Agent \u2022 Auto Verification"]}),(0,t.jsx)("button",{type:"button",onClick:()=>M(!1),style:{background:"none",border:"none",color:"#15803d",cursor:"pointer",fontSize:"12px",fontWeight:700,padding:"1px 4px"},children:"\u2715"})]}),(0,t.jsxs)("form",{onSubmit:ye,style:{display:"flex",gap:"6px"},children:[(0,t.jsx)("input",{type:"email",autoFocus:!0,value:Q,onChange:n=>{le(n.target.value),$("")},placeholder:"Enter your real email (e.g. name@gmail.com)",disabled:Y,required:!0,style:{flex:1,fontSize:"12.5px",padding:"7px 11px",borderRadius:"7px",border:h?"1.5px solid #ef4444":"1px solid #86efac",background:"#ffffff",color:"#09090b",outline:"none"}}),(0,t.jsx)("button",{type:"submit",disabled:Y||!Q.trim(),style:{background:"#16a34a",color:"#ffffff",border:"none",padding:"7px 14px",borderRadius:"7px",fontSize:"12px",fontWeight:600,cursor:Y?"wait":"pointer",opacity:Y?.7:1},children:Y?"...":"Verify & Send"})]}),h&&(0,t.jsxs)("div",{style:{fontSize:"11px",color:"#ef4444",fontWeight:500},children:["\u26A0\uFE0F ",h]}),fe&&(0,t.jsxs)("div",{style:{fontSize:"11px",color:"#15803d",fontWeight:600},children:["\u2713 ",fe]})]}),(0,t.jsxs)("div",{style:{padding:"12px 16px",borderTop:`1px solid ${s?"#27272a":"#e4e4e7"}`,background:s?"#121214":"#fafafa",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0},children:[(0,t.jsxs)("button",{type:"button",onClick:r?Ce:he,disabled:C==="connecting",style:{display:"inline-flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:r?"#dc2626":C==="connecting"?"#64748b":F,color:"#ffffff",borderRadius:"10px",border:"none",fontSize:"13px",fontWeight:600,boxShadow:r?"0 4px 14px rgba(220, 38, 38, 0.35)":`0 4px 14px ${F}40`,cursor:C==="connecting"?"not-allowed":"pointer",transition:"all 0.15s ease"},children:[(0,t.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,t.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,t.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),(0,t.jsx)("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]}),(0,t.jsx)("span",{children:r?"End Voice Call":C==="connecting"?"Connecting...":"Start Voice Call"})]}),(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[r&&(0,t.jsx)("div",{style:{display:"flex",alignItems:"center",gap:"2.5px",height:"14px"},children:[12,8,14,6,10].map((n,u)=>(0,t.jsx)("span",{style:{width:"2.5px",height:`${Math.max(4,Math.min(14,Math.round(n*(.35+Math.max(xe,we)*1.5))))}px`,background:F,borderRadius:"1px",transition:"height 0.12s ease"}},u))}),(0,t.jsx)("span",{style:{fontFamily:"var(--mono, monospace)",fontSize:"12px",fontWeight:600,padding:"3px 8px",borderRadius:"6px",background:s?"#18181b":r?"#000000":"#f4f4f5",color:s||r?"#ffffff":"#71717a",border:s?"1px solid #27272a":"none"},children:ve})]})]})]})]})]})}var Me=Te;var Be={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function ke(g={}){if(typeof window>"u")return;let{host:o,businessId:k="biz_demo_dental",agentId:v,theme:S="light",position:J="bottom-right",label:L="Talk to Receptionist",accent:R="emerald",accentColor:T,businessName:l,greeting:_,onCallStart:N,onCallEnd:A,onTranscript:W}=g,m=T||Be[R]||R||"#10b981",pe=document.getElementById("omnidesk-voice-widget-root");pe&&pe.remove();let y=document.createElement("div");y.id="omnidesk-voice-widget-root",y.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let a=S==="dark"||S==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,C=null,D="idle",U=0,G=null,xe=!1,ue=!1,we=0,ge=0,ve=!1,se=!1,q=!1,oe=null,K=null,M=!1,Q=J==="bottom-left",le=document.createElement("div");le.style.cssText=`
    position: fixed; bottom: 20px; ${Q?"left: 20px;":"right: 20px;"};
    z-index: 999999;
  `;let Y=document.createElement("button");Y.style.cssText=`
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${a?"#18181b":"#ffffff"}; color: ${a?"#fafafa":"#09090b"};
    border: 1px solid ${a?"#27272a":"#e4e4e7"};
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `,Y.innerHTML=`
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${m};box-shadow:0 0 8px ${m};display:inline-block;"></span>
    <span>${L}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,le.appendChild(Y);let te=document.createElement("div");te.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,te.onclick=()=>de(!1);let h=document.createElement("div");h.style.cssText=`
    position: fixed; bottom: 80px; ${Q?"left: 20px;":"right: 20px;"};
    width: 390px; max-width: calc(100vw - 32px); height: 560px; max-height: calc(100vh - 100px);
    background: ${a?"#09090b":"#ffffff"}; border: 1px solid ${a?"#27272a":"#e4e4e7"};
    border-radius: 20px; box-shadow: 0 24px 48px -12px rgba(0,0,0,0.22);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  `;let $=document.createElement("div");$.style.cssText=`
    background: ${a?"#18181b":"#ffffff"}; color: ${a?"#ffffff":"#09090b"};
    border-bottom: 1px solid ${a?"#27272a":"#e4e4e7"};
    padding: 13px 18px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; user-select: none; flex-shrink: 0;
  `,$.innerHTML=`
    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
      <div style="color: ${a?"rgba(255,255,255,0.6)":"#71717a"}; display: grid; place-items: center; flex-shrink: 0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle>
        </svg>
      </div>
      <div style="width: 28px; height: 28px; border-radius: 50%; background: ${a?"rgba(255,255,255,0.15)":m==="#18181b"?"rgba(24,24,27,0.08)":`${m}18`}; display: grid; place-items: center; flex-shrink: 0; color: ${a?"#ffffff":m==="#18181b"?"#09090b":m};">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
        </svg>
      </div>
      <div style="display: flex; flex-direction: column; min-width: 0;">
        <div id="omnidesk-biz-title" style="font-size: 13.5px; font-weight: 600; color: ${a?"#ffffff":"#09090b"}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${l||"OmniDesk Hair Salon & Studio"}
        </div>
        <div style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: ${a?"rgba(255,255,255,0.75)":"#71717a"}; white-space: nowrap;">
          <span id="omnidesk-status-dot" style="width: 6px; height: 6px; border-radius: 50%; background: ${a?"rgba(255,255,255,0.4)":"#a1a1aa"}; display: inline-block;"></span>
          <span id="omnidesk-status-text">Idle \xB7 Ready</span>
        </div>
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 8px;">
      <button id="omnidesk-expand-btn" style="background: ${a?"rgba(255,255,255,0.1)":"#f4f4f5"}; border: 1px solid ${a?"rgba(255,255,255,0.15)":"#e4e4e7"}; border-radius: 7px; color: ${a?"#ffffff":"#52525b"}; width: 30px; height: 30px; cursor: pointer; display: grid; place-items: center;" title="Open Full">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
      </button>
      <button id="omnidesk-close-btn" style="background: ${a?"rgba(255,255,255,0.1)":"#f4f4f5"}; border: 1px solid ${a?"rgba(255,255,255,0.15)":"#e4e4e7"}; border-radius: 7px; color: ${a?"#ffffff":"#52525b"}; width: 30px; height: 30px; cursor: pointer; display: grid; place-items: center;" title="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `;let fe=document.createElement("style");fe.textContent=`
    @keyframes omnidesk-typing-dot {
      0%, 80%, 100% { transform: translateY(0) scale(0.85); opacity: 0.35; }
      40% { transform: translateY(-6px) scale(1.15); opacity: 1; }
    }
    .omnidesk-motion-dot {
      display: inline-block;
      width: 6.5px;
      height: 6.5px;
      border-radius: 50%;
      background-color: currentColor;
      animation: omnidesk-typing-dot 1.25s infinite ease-in-out both;
      will-change: transform, opacity;
    }
    .omnidesk-dot-1 { animation-delay: 0s; }
    .omnidesk-dot-2 { animation-delay: 0.18s; }
    .omnidesk-dot-3 { animation-delay: 0.36s; }
  `,y.appendChild(fe);let E=document.createElement("div");E.style.cssText=`
    flex: 1; min-height: 0; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 12px; background: ${a?"#09090b":"#ffffff"};
  `;let z=document.createElement("div");z.id="omnidesk-placeholder-banner",z.style.cssText=`
    margin: auto; text-align: center; padding: 10px 18px;
    background: ${a?"#18181b":"#f4f4f5"}; border: 1px solid ${a?"#27272a":"#e4e4e7"}; color: ${a?"#a1a1aa":"#52525b"};
    border-radius: 12px; font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px; align-self: center;
  `,z.innerHTML=`
    <span id="omnidesk-placeholder-dot" style="width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block;"></span>
    <span>Start a call to talk to our receptionist</span>
  `,E.appendChild(z);let b=document.createElement("div");if(b.id="omnidesk-thinking-bubble",b.style.cssText=`
    display: none; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;
  `,b.innerHTML=`
    <div style="display: flex; align-items: flex-start; gap: 8px;">
      <div style="width: 24px; height: 24px; border-radius: 50%; background: #18181b; display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        </svg>
      </div>
      <div style="padding: 10px 14px; border-radius: 14px 14px 14px 2px; font-size: 13px; line-height: 1.45; background: ${a?"#18181b":"#f4f4f5"}; color: ${a?"#a1a1aa":"#71717a"}; border: ${a?"1px solid #27272a":"none"}; boxShadow: 0 1px 2px rgba(0,0,0,0.04); display: inline-flex; align-items: center; gap: 5px; min-height: 38px;" title="Agent is thinking and processing...">
        <span class="omnidesk-motion-dot omnidesk-dot-1"></span>
        <span class="omnidesk-motion-dot omnidesk-dot-2"></span>
        <span class="omnidesk-motion-dot omnidesk-dot-3"></span>
      </div>
    </div>
  `,E.appendChild(b),_){z.style.display="none";let r=document.createElement("div");r.style.cssText="display: flex; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;";let n=document.createElement("div");n.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let u=document.createElement("div");u.style.cssText="width: 24px; height: 24px; border-radius: 50%; background: #18181b; display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;",u.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let c=document.createElement("div");c.style.cssText=`padding: 10px 14px; border-radius: 14px 14px 14px 2px; font-size: 13px; line-height: 1.45; background: ${a?"#18181b":"#f4f4f5"}; color: ${a?"#fafafa":"#09090b"}; border: ${a?"1px solid #27272a":"none"}; box-shadow: 0 1px 2px rgba(0,0,0,0.04);`,c.innerText=_,n.appendChild(u),n.appendChild(c),r.appendChild(n),E.insertBefore(r,b),oe="agent",K=c,M=!0}let x=document.createElement("div");x.id="omnidesk-email-bar",x.style.cssText=`
    padding: 11px 16px; background: #f0fdf4; border-top: 1px solid #bbf7d0;
    display: none; flex-direction: column; gap: 7px; flex-shrink: 0;
  `,x.innerHTML=`
    <div style="display: flex; align-items: center; justify-content: space-between;">
      <span style="font-size: 11px; font-weight: 700; color: #15803d; text-transform: uppercase; letter-spacing: 0.04em; display: inline-flex; align-items: center; gap: 6px;">
        <span style="width: 6px; height: 6px; border-radius: 50%; background: #22c55e; display: inline-block;"></span>
        Email Requested by Agent \u2022 Auto Verification
      </span>
      <button id="omnidesk-email-close-btn" type="button" style="background: none; border: none; color: #15803d; cursor: pointer; font-size: 12px; font-weight: 700; padding: 1px 4px;">\u2715</button>
    </div>
    <form id="omnidesk-email-form" style="display: flex; gap: 8px; margin: 0;">
      <input id="omnidesk-email-input" type="email" placeholder="Enter your real email (e.g. name@gmail.com)" required style="flex: 1; font-size: 12.5px; padding: 7px 11px; border-radius: 7px; border: 1px solid #86efac; background: #ffffff; color: #09090b; outline: none;" />
      <button id="omnidesk-email-submit" type="submit" style="background: #16a34a; color: #ffffff; border: none; padding: 7px 14px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer;">Verify & Send</button>
    </form>
  `;let X=document.createElement("div");X.style.cssText=`
    padding: 12px 16px; border-top: 1px solid ${a?"#27272a":"#e4e4e7"};
    background: ${a?"#121214":"#fafafa"}; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  `;let p=document.createElement("button");p.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: ${m}; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    box-shadow: 0 4px 14px ${m}40;
    cursor: pointer; transition: all 0.15s ease;
  `,p.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let O=document.createElement("div");O.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let I=document.createElement("div");I.id="omnidesk-waveform",I.style.cssText="display: none; align-items: center; gap: 2.5px; height: 14px;";let me=[12,8,14,6,10],ie=[];me.forEach(r=>{let n=document.createElement("span");n.style.cssText=`width: 2.5px; height: ${Math.round(r*.35)}px; background: ${m}; border-radius: 1px; transition: height 0.12s ease;`,I.appendChild(n),ie.push(n)}),O.appendChild(I);let w=document.createElement("span");w.id="omnidesk-timer",w.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,w.innerText="0:00",O.appendChild(w),X.appendChild(p),X.appendChild(O),h.appendChild($),h.appendChild(E),h.appendChild(x),h.appendChild(X),y.appendChild(le),y.appendChild(te),y.appendChild(h),document.body.appendChild(y);function F(){U=Date.now(),w.innerText="0:00",w.style.background=a?"#18181b":"#000000",w.style.color="#ffffff",w.style.border=a?"1px solid #27272a":"none",G&&clearInterval(G),G=setInterval(()=>{let r=Date.now()-U,n=Math.floor(r/1e3),u=Math.floor(n/60),c=n%60;w.innerText=`${u}:${String(c).padStart(2,"0")}`},250)}function s(){G&&(clearInterval(G),G=null),w.style.background="#f4f4f5",w.style.color="#71717a",w.style.border="none",w.innerText="0:00",I.style.display="none"}function ee(r){xe=r,h.style.display=r?"flex":"none"}function de(r){ue=r,te.style.display=r?"block":"none",r?(h.style.top="50%",h.style.left="50%",h.style.bottom="auto",h.style.right="auto",h.style.transform="translate(-50%, -50%)",h.style.width="calc(100vw - 40px)",h.style.maxWidth="1140px",h.style.height="calc(100vh - 40px)",h.style.maxHeight="900px"):(h.style.top="auto",h.style.left=Q?"20px":"auto",h.style.right=Q?"auto":"20px",h.style.bottom="80px",h.style.transform="none",h.style.width="390px",h.style.maxWidth="calc(100vw - 32px)",h.style.height="560px",h.style.maxHeight="calc(100vh - 100px)")}Y.onclick=()=>ee(!xe),$.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{ee(!1),de(!1)}),$.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{de(!ue)});let j=x.querySelector("#omnidesk-email-form"),he=x.querySelector("#omnidesk-email-input");x.querySelector("#omnidesk-email-close-btn").addEventListener("click",()=>{x.style.display="none"}),j.addEventListener("submit",r=>{r.preventDefault();let n=he.value.trim();if(!n||!n.includes("@"))return;C&&C.sendEmailInput(n),q=!0,x.style.display="none",he.value="",z.style.display="none";let u=document.createElement("div");u.style.cssText=`
      display: flex; flex-direction: column; gap: 4px; max-width: 88%;
      align-self: flex-end;
    `;let c=document.createElement("div");c.style.cssText=`
      padding: 10px 14px; border-radius: 14px 14px 2px 14px;
      font-size: 13px; line-height: 1.45;
      background: ${m}; color: #ffffff;
      box-shadow: 0 2px 8px ${m}35;
    `,c.innerText=`My email is ${n}`,u.appendChild(c),E.insertBefore(u,b),b.style.display="flex",E.scrollTop=E.scrollHeight,oe="user",K=c,M=!0});async function ye(){ve=!1,se=!1,q=!1,x.style.display="none",b.style.display="none",oe=null,K=null,M=!1;let r=$.querySelector("#omnidesk-status-text"),n=$.querySelector("#omnidesk-status-dot"),u=p.querySelector("#omnidesk-btn-text");r.innerText="Connecting...",n.style.background="#eab308",u.innerText="Connecting...",p.style.background="#64748b",p.style.boxShadow="none",p.disabled=!0,F();try{let c=o;if(!c&&typeof document<"u"){let e=document.querySelector("script[src*='widget.js']");if(e&&e.src&&e.src.startsWith("http"))try{c=new URL(e.src).origin}catch{}}!c&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(c=window.location.origin);let P=(c||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),Z=await fetch(`${P}/api/token?businessId=${encodeURIComponent(k)}`);if(!Z.ok)throw new Error(`Failed to get session token (${Z.status})`);let V=await Z.json();if(V.business_name&&!l){let e=$.querySelector("#omnidesk-biz-title");e&&(e.innerText=V.business_name)}let f=v||V.agent_id||"";C=new ne({onStatusChange:e=>{if(D=e,e==="connected")r.innerText="Live \xB7 Speaking",n.style.background="#22c55e",u.innerText="End Voice Call",p.style.background="#dc2626",p.style.boxShadow="0 4px 14px rgba(220, 38, 38, 0.35)",p.disabled=!1,I.style.display="flex",U=Date.now(),N?.();else if(e==="idle"&&(r.innerText="Idle \xB7 Ready",n.style.background=a?"rgba(255,255,255,0.4)":"#a1a1aa",u.innerText="Start Voice Call",p.style.background=m,p.style.boxShadow=`0 4px 14px ${m}40`,p.disabled=!1,I.style.display="none",x.style.display="none",b.style.display="none",s(),U>0)){let i=Math.round((Date.now()-U)/1e3);U=0,A?.(i)}},onThinkingChange:e=>{e&&(b.style.display="flex",E.scrollTop=E.scrollHeight)},onTranscript:e=>{if(z.style.display="none",e.who==="user"){e.isFinal&&(b.style.display="flex");let i=e.text.toLowerCase();(i==="no"||i.startsWith("no ")||i.includes("no,")||i.includes("wrong")||i.includes("incorrect")||i.includes("change my email")||i.includes("different email"))&&(q=!1),(e.text.includes("@")||i.includes(" at ")&&i.includes(" dot ")||i.includes("gmail.com")||i.includes("yahoo.com")||i.includes("outlook.com")||i.includes("hotmail.com")||i.includes("icloud.com"))&&(x.style.display="none",q=!0)}else if(e.who==="agent"){e.text&&e.text.trim().length>0&&(b.style.display="none");let i=e.text.toLowerCase();if(i.includes("confirmation code is")||i.includes("booking is confirmed")||i.includes("scheduled your appointment")||i.includes("all set, your appointment")||i.includes("sent your confirmation")&&(i.includes("code")||i.includes("calendar invite"))||i.includes("sent a calendar invite")&&(i.includes("code")||i.includes("all set"))){se=!0,q=!1,x.style.display="none";return}if(se){x.style.display="none";return}if(i.includes("confirm with yes or no")||i.includes("yes or no")||i.includes("is that correct")||i.includes("is that right")){q=!0,x.style.display="none";return}i.includes("what is your email")||i.includes("what's your email")||i.includes("may i have your email")||i.includes("can i have your email")||i.includes("could i get your email")||i.includes("could you provide your email")||i.includes("provide your email")||i.includes("enter your email")||i.includes("spell your email")||i.includes("share your email")||i.includes("need your email")||i.includes("what email")||i.includes("which email")||i.includes("where can i send your confirmation")||i.includes("where should i send your confirmation")||i.includes("where can i send your calendar")||i.includes("where should i send your calendar")||i.includes("email")&&(i.includes("what is")||i.includes("what's")||i.includes("may i have")||i.includes("can i have")||i.includes("provide")||i.includes("give me")||i.includes("tell me")||i.includes("send your calendar invite")||i.includes("send your confirmation"))?(q=!1,x.style.display="flex",setTimeout(()=>he.focus(),60)):x.style.display="none"}if(oe===e.who&&K&&!M)K.innerText=e.text,M=!!e.isFinal;else{let i=e.who==="user",H=document.createElement("div");if(H.style.cssText=`
              display: flex; flex-direction: column; gap: 4px; max-width: 88%;
              align-self: ${i?"flex-end":"flex-start"};
            `,i){let B=document.createElement("div");B.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 2px 14px;
                font-size: 13px; line-height: 1.45;
                background: ${m};
                color: #ffffff;
                box-shadow: 0 2px 8px ${m}35;
              `,B.innerText=e.text,H.appendChild(B),K=B}else{let B=document.createElement("div");B.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let re=document.createElement("div");re.style.cssText=`
                width: 24px; height: 24px; border-radius: 50%; background: #18181b;
                display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;
              `,re.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let ce=document.createElement("div");ce.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 14px 2px;
                font-size: 13px; line-height: 1.45;
                background: ${a?"#18181b":"#f4f4f5"};
                color: ${a?"#fafafa":"#09090b"};
                border: ${a?"1px solid #27272a":"none"};
                box-shadow: 0 1px 2px rgba(0,0,0,0.04);
              `,ce.innerText=e.text,B.appendChild(re),B.appendChild(ce),H.appendChild(B),K=ce}E.insertBefore(H,b),oe=e.who,M=!!e.isFinal}E.scrollTop=E.scrollHeight,W?.(e)},onAudioLevel:(e,i)=>{if(we=e,ge=i,D==="connected"){I.style.display="flex";let H=Math.max(e,i);me.forEach((B,re)=>{let ce=Math.max(4,Math.min(14,Math.round(B*(.35+H*1.5))));ie[re]&&(ie[re].style.height=`${ce}px`)})}},onError:()=>{r.innerText="Error",n.style.background="#ef4444",u.innerText="Start Voice Call",p.style.background=m,p.style.boxShadow=`0 4px 14px ${m}40`,p.disabled=!1,I.style.display="none",x.style.display="none",b.style.display="none",s()}}),await C.start(V.token,f,V.voice)}catch(c){console.error("[OmniDesk Voice Widget Error]:",c),r.innerText="Error",n.style.background="#ef4444",u.innerText="Start Voice Call",p.style.background=m,p.style.boxShadow=`0 4px 14px ${m}40`,p.disabled=!1,I.style.display="none",x.style.display="none",b.style.display="none",s()}}function ae(){C&&(C.stop(),C=null),D="idle";let r=$.querySelector("#omnidesk-status-text"),n=$.querySelector("#omnidesk-status-dot"),u=p.querySelector("#omnidesk-btn-text");r&&(r.innerText="Idle \xB7 Ready"),n&&(n.style.background=a?"rgba(255,255,255,0.4)":"#a1a1aa"),u&&(u.innerText="Start Voice Call"),p.style.background=m,p.style.boxShadow=`0 4px 14px ${m}40`,p.disabled=!1,I.style.display="none",x.style.display="none",b.style.display="none",se=!1,q=!1,s()}return p.onclick=()=>{D==="connected"?ae():D==="idle"&&ye()},{destroy:()=>{s(),C&&C.stop(),y.remove()},startCall:ye,endCall:ae}}if(typeof document<"u"){let g=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(g){let o,k=g.src||"";if(k&&k.startsWith("http"))try{o=new URL(k).origin}catch{}let v=g.getAttribute("data-business-id")||void 0,S=g.getAttribute("data-agent")||void 0,J=g.getAttribute("data-theme")||"dark",L=g.getAttribute("data-accent")||"emerald",R=g.getAttribute("data-position")||"bottom-right",T=g.getAttribute("data-label")||void 0,l=g.getAttribute("data-host")||o||"https://omni-desk-rho.vercel.app",_=g.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{ke({businessId:v,agentId:S,theme:J,accent:L,position:R,label:T,host:l,greeting:_})}):ke({businessId:v,agentId:S,theme:J,accent:L,position:R,label:T,host:l,greeting:_})}}0&&(module.exports={AssemblyAIVoiceClient,OmniDeskWidget,VoiceWidget,initOmniDeskWidget});
//# sourceMappingURL=index.js.map