"use strict";var we=Object.defineProperty;var Me=Object.getOwnPropertyDescriptor;var Ee=Object.getOwnPropertyNames;var Le=Object.prototype.hasOwnProperty;var $e=(x,o)=>{for(var b in o)we(x,b,{get:o[b],enumerable:!0})},_e=(x,o,b,v)=>{if(o&&typeof o=="object"||typeof o=="function")for(let M of Ee(o))!Le.call(x,M)&&M!==b&&we(x,M,{get:()=>o[M],enumerable:!(v=Me(o,M))||v.enumerable});return x};var Ie=x=>_e(we({},"__esModule",{value:!0}),x);var Fe={};$e(Fe,{AssemblyAIVoiceClient:()=>ie,OmniDeskWidget:()=>Ce,VoiceWidget:()=>Te,initOmniDeskWidget:()=>be});module.exports=Ie(Fe);var c=require("react");var ye=24e3,Ae="wss://agents.assemblyai.com/v1/ws",Re=`
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${ye};
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
`,We=`
  class PlaybackProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ring = new Float32Array(sampleRate * 30);
      this._writePos = 0;
      this._readPos = 0;
      this._available = 0;
      this._step = ${ye} / sampleRate;
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
`;async function Se(x,o,b){let v=URL.createObjectURL(new Blob([o],{type:"application/javascript"}));try{await x.audioWorklet.addModule(v)}finally{URL.revokeObjectURL(v)}return new AudioWorkletNode(x,b)}var ie=class{constructor(o){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.isThinking=!1;this.callbacks=o}setThinking(o){this.isThinking!==o&&(this.isThinking=o,this.callbacks.onThinkingChange?.(o))}async start(o,b,v){try{this.callbacks.onStatusChange?.("connecting");let M=window.AudioContext||window.webkitAudioContext;this.captureCtx=new M({sampleRate:ye}),this.playbackCtx=new M({sampleRate:ye}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await Se(this.playbackCtx,We,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0}}),this.captureNode=await Se(this.captureCtx,Re,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let Z=new URL(Ae);Z.searchParams.set("token",o),this.ws=new WebSocket(Z.toString()),this.captureNode.port.onmessage=({data:E})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let l=new Uint8Array(E),$="";for(let R=0;R<l.length;R+=32768)$+=String.fromCharCode.apply(null,Array.from(l.subarray(R,R+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa($)}));let F=new Int16Array(E),_=0;for(let R=0;R<F.length;R+=16)_+=Math.abs(F[R]);this.userLevel=Math.min(1,_/(F.length/16)/8e3)},this.ws.onopen=()=>{let E={};b&&b.trim()?E.agent_id=b.trim():v&&v.trim()&&(E.output={voice:v.trim()}),Object.keys(E).length>0&&this.ws?.send(JSON.stringify({type:"session.update",session:E}))};let L="",A="";this.ws.onmessage=({data:E})=>{try{let l=JSON.parse(E);switch(l.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0,A="",this.setThinking(!1);break;case"transcript.user.delta":l.text&&(A=l.text,this.callbacks.onTranscript?.({who:"user",text:l.text,isFinal:!1}));break;case"transcript.user":l.text&&(A=l.text,this.callbacks.onTranscript?.({who:"user",text:l.text,isFinal:!0}),this.setThinking(!0));break;case"reply.started":L="";break;case"transcript.agent.delta":l.delta&&(this.setThinking(!1),L&&!L.endsWith(" ")&&!/^[.,!?;:%)]/.test(l.delta)?L+=" "+l.delta:L+=l.delta,this.callbacks.onTranscript?.({who:"agent",text:L,isFinal:!1}));break;case"transcript.agent":l.text&&(this.setThinking(!1),L=l.text,this.callbacks.onTranscript?.({who:"agent",text:l.text,isFinal:!0}));break;case"reply.audio":if(l.data&&this.playbackNode){let $=atob(l.data),F=new Uint8Array($.length);for(let _=0;_<$.length;_++)F[_]=$.charCodeAt(_);this.playbackNode.port.postMessage(F.buffer,[F.buffer]),this.agentLevel=.8}break;case"reply.done":l.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:l.name||l.tool,args:l.arguments||l.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:l.name||l.tool,result:l.result});break;case"session.error":this.setThinking(!1),this.callbacks.onError?.(l.message||l.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.setThinking(!1),this.stop();break}}catch(l){console.warn("Message parsing error:",l)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(M){this.callbacks.onError?.(M.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(o){this.isMuted=o,o&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(o,b){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:o})),b&&this.ws.send(JSON.stringify({type:"reply.create",instructions:b})),!0}catch(v){return console.error("Failed to send message to agent:",v),!1}}sendEmailInput(o){return this.sendUserMessage(`My email address is ${o}`,`The caller entered their verified email address: ${o}. Acknowledge this email, verify it using verify_customer_email if needed, and complete the booking.`)}stop(){if(this.setThinking(!1),this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(o=>o.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let o=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(o)};this.animFrameId=requestAnimationFrame(o)}};var e=require("react/jsx-runtime"),Pe={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function Ce({host:x="",businessId:o="biz_demo_dental",agentId:b,theme:v="light",position:M="bottom-right",label:Z="Talk to Receptionist",accent:L="emerald",accentColor:A,businessName:E,greeting:l,className:$,onCallStart:F,onCallEnd:_,onTranscript:R}){let[g,ue]=(0,c.useState)(!1),[m,a]=(0,c.useState)(!1),[w,H]=(0,c.useState)("idle"),[O,J]=(0,c.useState)([]),[xe,fe]=(0,c.useState)(0),[ke,ge]=(0,c.useState)(0),[ne,ee]=(0,c.useState)("0:00"),[Y,te]=(0,c.useState)(E||"OmniDesk Hair Salon & Studio"),[ae,j]=(0,c.useState)(!1),[G,se]=(0,c.useState)(""),[u,I]=(0,c.useState)(!1),[re,C]=(0,c.useState)(""),[U,k]=(0,c.useState)(""),[y,V]=(0,c.useState)(!1),p=(0,c.useRef)(null),K=(0,c.useRef)(null),S=(0,c.useRef)(0),Q=(0,c.useRef)(null),le=(0,c.useRef)(0),T=(0,c.useRef)(!1),W=(0,c.useMemo)(()=>A||Pe[L]||L||"#10b981",[L,A]),s=(0,c.useMemo)(()=>v==="dark"?!0:v==="auto"&&typeof window<"u"?window.matchMedia("(prefers-color-scheme: dark)").matches:!1,[v]);(0,c.useEffect)(()=>{K.current&&(K.current.scrollTop=K.current.scrollHeight)},[O,y]);let X=(0,c.useMemo)(()=>x?x.replace(/\/$/,""):typeof window<"u"&&window.location.origin?window.location.origin:"",[x]),de=(0,c.useCallback)(()=>{le.current=Date.now(),ee("0:00"),Q.current&&clearInterval(Q.current),Q.current=setInterval(()=>{let n=Date.now()-le.current,f=Math.floor(n/1e3),d=Math.floor(f/60),P=f%60;ee(`${d}:${String(P).padStart(2,"0")}`)},250)},[]),N=(0,c.useCallback)(()=>{Q.current&&(clearInterval(Q.current),Q.current=null)},[]),he=(0,c.useCallback)(async()=>{try{H("connecting"),T.current=!1,j(!1),de();let f=`${X?X.replace(/\/$/,""):""}/api/token?businessId=${encodeURIComponent(o)}`,d=await fetch(f);if(!d.ok)throw new Error("Failed to initialize voice session");let P=await d.json();if(P.business_name&&!E&&te(P.business_name),!P.token)throw new Error("Invalid session token payload received from host");let q=b||P.agent_id||"",B=new ie({onStatusChange:h=>{if(H(h),h==="connected")S.current=Date.now(),F?.();else if(h==="idle"){if(V(!1),N(),S.current>0){let t=Math.round((Date.now()-S.current)/1e3);S.current=0,_?.(t)}}else h==="error"&&(V(!1),N())},onThinkingChange:h=>{h&&V(!0)},onTranscript:h=>{if(h.who==="user"?V(!0):h.who==="agent"&&h.text&&h.text.trim().length>0&&V(!1),J(t=>{let i=t[t.length-1];if(i&&i.who===h.who&&!i.isFinal){let z=[...t];return z[z.length-1]={...i,text:h.text,isFinal:h.isFinal??!1},z}return[...t,{id:h.id||`${Date.now()}-${Math.random()}`,who:h.who,text:h.text,isFinal:h.isFinal??!1}]}),R?.(h),h.who==="user"){let t=h.text.toLowerCase();(h.text.includes("@")||t.includes(" at ")&&t.includes(" dot ")||t.includes("gmail")||t.includes("yahoo")||t.includes("outlook")||t.includes("hotmail")||t.includes("icloud"))&&(T.current=!0,j(!1))}else if(h.who==="agent"){let t=h.text.toLowerCase();(t.includes("verified your email")||t.includes("email is verified")||t.includes("verified that email")||t.includes("sent a calendar")||t.includes("sent your confirmation")||t.includes("calendar invite")||t.includes("confirmation code is")||t.includes("booking is confirmed")||t.includes("all set, your appointment")||t.includes("scheduled your appointment"))&&(T.current=!0);let z=!T.current&&(t.includes("what is your email")||t.includes("what's your email")||t.includes("may i have your email")||t.includes("can i have your email")||t.includes("could i get your email")||t.includes("could you provide your email")||t.includes("provide your email")||t.includes("enter your email")||t.includes("spell your email")||t.includes("share your email")||t.includes("need your email")||t.includes("what email")||t.includes("which email")||t.includes("where can i send your confirmation")||t.includes("where should i send your confirmation")||t.includes("where can i send your calendar")||t.includes("where should i send your calendar")||t.includes("email")&&(t.includes("what is")||t.includes("what's")||t.includes("may i have")||t.includes("can you provide")||t.includes("could you provide")||t.includes("give me your")||t.includes("tell me your")));j(!!z)}},onAudioLevel:(h,t)=>{fe(h),ge(t)},onError:()=>{H("error"),N()}});p.current=B,await B.start(P.token,q,P.voice)}catch{H("error"),N()}},[X,o,b,E,F,_,R,de,N]),ve=(0,c.useCallback)(()=>{if(p.current&&(p.current.stop(),p.current=null),H("idle"),V(!1),fe(0),ge(0),N(),j(!1),C(""),k(""),S.current>0){let n=Math.round((Date.now()-S.current)/1e3);S.current=0,_?.(n)}},[_,N]),me=(0,c.useCallback)(async n=>{n.preventDefault();let f=G.trim();if(f){I(!0),C(""),k("");try{let d=X?X.replace(/\/$/,""):"",P=await fetch(`${d}/api/tools/${encodeURIComponent(o)}/verify_customer_email`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:f})}),q=await P.json();if(!P.ok||!q.valid||!q.email){C(q.message||"Invalid email or domain has no active mail server."),I(!1);return}let B=q.email;k(`Verified: ${B}. Sent to agent.`),J(h=>[...h,{who:"user",text:`My email is ${B}`}]),p.current&&p.current.sendEmailInput(B),V(!0),T.current=!0,se(""),j(!1),k("")}catch(d){C(d.message||"Failed to verify email with mail server.")}finally{I(!1)}}},[G,X,o]);(0,c.useEffect)(()=>()=>{N(),p.current&&p.current.stop()},[N]);let oe=M==="bottom-left",r=w==="connected";return(0,e.jsxs)("div",{className:$,style:{position:"relative",zIndex:99999},children:[(0,e.jsx)("div",{style:{position:"fixed",bottom:"20px",left:oe?"20px":"auto",right:oe?"auto":"20px",zIndex:99999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:(0,e.jsxs)("button",{type:"button",onClick:()=>ue(!g),style:{display:"inline-flex",alignItems:"center",gap:"10px",background:s?"#18181b":"#ffffff",color:s?"#fafafa":"#09090b",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,padding:"10px 18px",borderRadius:"9999px",cursor:"pointer",fontSize:"13px",fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.18)",transition:"transform 0.15s ease, background 0.15s ease"},onMouseEnter:n=>{n.currentTarget.style.transform="scale(1.02)"},onMouseLeave:n=>{n.currentTarget.style.transform="scale(1)"},children:[(0,e.jsx)("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:r?"#ef4444":W,boxShadow:`0 0 8px ${r?"#ef4444":W}`}}),(0,e.jsx)("span",{children:Z}),(0,e.jsx)("span",{style:{fontSize:"11px",opacity:.6},children:"\u25B2"})]})}),g&&(0,e.jsxs)(e.Fragment,{children:[m&&(0,e.jsx)("div",{onClick:()=>a(!1),style:{position:"fixed",inset:0,background:"rgba(0, 0, 0, 0.7)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",zIndex:999998}}),(0,e.jsxs)("div",{style:{position:"fixed",bottom:m?"auto":"80px",left:m?"50%":oe?"20px":"auto",right:m||oe?"auto":"20px",top:m?"50%":"auto",transform:m?"translate(-50%, -50%)":"none",width:m?"calc(100vw - 40px)":"390px",maxWidth:m?"1140px":"calc(100vw - 32px)",height:m?"calc(100vh - 40px)":"560px",maxHeight:m?"900px":"calc(100vh - 100px)",background:s?"#09090b":"#ffffff",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,borderRadius:"20px",boxShadow:m?"0 32px 64px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)":"0 24px 48px -12px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:999999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",transition:"all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"},children:[(0,e.jsx)("style",{children:`
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
            `}),(0,e.jsxs)("div",{style:{background:s?"#18181b":"#ffffff",color:s?"#ffffff":"#09090b",borderBottom:`1px solid ${s?"#27272a":"#e4e4e7"}`,padding:m?"16px 22px":"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",userSelect:"none",flexShrink:0},children:[(0,e.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"10px",minWidth:0},children:[(0,e.jsx)("div",{style:{color:s?"rgba(255,255,255,0.6)":"#71717a",display:"grid",placeItems:"center",flexShrink:0},children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("circle",{cx:"12",cy:"12",r:"1"}),(0,e.jsx)("circle",{cx:"12",cy:"5",r:"1"}),(0,e.jsx)("circle",{cx:"12",cy:"19",r:"1"})]})}),(0,e.jsx)("div",{style:{width:"28px",height:"28px",borderRadius:"50%",background:s?"rgba(255,255,255,0.15)":W==="#18181b"?"rgba(24,24,27,0.08)":`${W}18`,display:"grid",placeItems:"center",flexShrink:0,color:s?"#ffffff":W==="#18181b"?"#09090b":W},children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,e.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),(0,e.jsx)("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]})}),(0,e.jsxs)("div",{style:{display:"flex",flexDirection:"column",minWidth:0},children:[(0,e.jsx)("div",{style:{fontSize:"13.5px",fontWeight:600,color:s?"#ffffff":"#09090b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},children:Y}),(0,e.jsxs)("div",{style:{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"11px",color:s?"rgba(255,255,255,0.75)":"#71717a"},children:[(0,e.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:r?y?"#f59e0b":"#22c55e":w==="connecting"?"#eab308":s?"rgba(255,255,255,0.4)":"#a1a1aa",animation:y?"omnidesk-pulse-amber 1.5s infinite":"none"}}),(0,e.jsx)("span",{children:r?y?"Thinking \xB7 Checking tools...":"Live \xB7 Speaking":w==="connecting"?"Connecting...":w==="error"?"Error":"Idle \xB7 Ready"})]})]})]}),(0,e.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[(0,e.jsx)("button",{type:"button",onClick:()=>a(!m),title:m?"Exit Fullscreen":"Open Full",style:{background:s?"rgba(255,255,255,0.1)":"#f4f4f5",border:s?"1px solid rgba(255,255,255,0.15)":"1px solid #e4e4e7",borderRadius:"7px",color:s?"#ffffff":"#52525b",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:n=>n.currentTarget.style.background=s?"rgba(255,255,255,0.2)":"#e4e4e7",onMouseLeave:n=>n.currentTarget.style.background=s?"rgba(255,255,255,0.1)":"#f4f4f5",children:m?(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("polyline",{points:"4 14 10 14 10 20"}),(0,e.jsx)("polyline",{points:"20 10 14 10 14 4"}),(0,e.jsx)("line",{x1:"14",y1:"10",x2:"21",y2:"3"}),(0,e.jsx)("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]}):(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("polyline",{points:"15 3 21 3 21 9"}),(0,e.jsx)("polyline",{points:"9 21 3 21 3 15"}),(0,e.jsx)("line",{x1:"21",y1:"3",x2:"14",y2:"10"}),(0,e.jsx)("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]})}),(0,e.jsx)("button",{type:"button",onClick:()=>{r&&ve(),ue(!1)},title:"Close Widget",style:{background:s?"rgba(255,255,255,0.1)":"#f4f4f5",border:s?"1px solid rgba(255,255,255,0.15)":"1px solid #e4e4e7",borderRadius:"7px",color:s?"#ffffff":"#52525b",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:n=>n.currentTarget.style.background=s?"rgba(255,255,255,0.2)":"#e4e4e7",onMouseLeave:n=>n.currentTarget.style.background=s?"rgba(255,255,255,0.1)":"#f4f4f5",children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("line",{x1:"18",y1:"6",x2:"6",y2:"18"}),(0,e.jsx)("line",{x1:"6",y1:"6",x2:"18",y2:"18"})]})})]})]}),(0,e.jsxs)("div",{ref:K,style:{flex:1,minHeight:0,padding:"16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"12px",background:s?"#09090b":"#ffffff"},children:[O.length===0&&(0,e.jsxs)("div",{style:{margin:"auto",textAlign:"center",padding:"10px 18px",background:s?"#18181b":"#f4f4f5",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,color:s?"#a1a1aa":"#52525b",borderRadius:"12px",fontSize:"12.5px",fontWeight:500,display:"inline-flex",alignItems:"center",gap:"8px",alignSelf:"center"},children:[(0,e.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:r?"#22c55e":w==="connecting"?"#eab308":"#a1a1aa",display:"inline-block"}}),(0,e.jsx)("span",{children:r?"Connected \xB7 Speak to our receptionist":w==="connecting"?"Connecting to receptionist...":"Start a call to talk to our receptionist"})]}),O.map((n,f)=>{let d=n.who==="user";return(0,e.jsx)("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:d?"flex-end":"flex-start"},children:(0,e.jsxs)("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[!d&&(0,e.jsx)("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,e.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),(0,e.jsx)("div",{style:{padding:"10px 14px",borderRadius:d?"14px 14px 2px 14px":"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:d?W:s?"#18181b":"#f4f4f5",color:d?"#ffffff":s?"#fafafa":"#09090b",border:!d&&s?"1px solid #27272a":"none",boxShadow:d?`0 2px 8px ${W}35`:"0 1px 2px rgba(0,0,0,0.04)"},children:n.text})]})},f)}),y&&(0,e.jsx)("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:"flex-start"},children:(0,e.jsxs)("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[(0,e.jsx)("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,e.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),(0,e.jsxs)("div",{style:{padding:"10px 14px",borderRadius:"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:s?"#18181b":"#f4f4f5",color:s?"#a1a1aa":"#71717a",border:s?"1px solid #27272a":"none",boxShadow:"0 1px 2px rgba(0,0,0,0.04)",display:"inline-flex",alignItems:"center",gap:"5px",minHeight:"38px"},title:"Agent is thinking and processing...",children:[(0,e.jsx)("span",{className:"omnidesk-motion-dot omnidesk-dot-1"}),(0,e.jsx)("span",{className:"omnidesk-motion-dot omnidesk-dot-2"}),(0,e.jsx)("span",{className:"omnidesk-motion-dot omnidesk-dot-3"})]})]})})]}),ae&&r&&(0,e.jsxs)("div",{style:{padding:"11px 16px",background:"#f0fdf4",borderTop:"1px solid #bbf7d0",display:"flex",flexDirection:"column",gap:"7px",flexShrink:0},children:[(0,e.jsxs)("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"},children:[(0,e.jsxs)("span",{style:{fontSize:"11px",fontWeight:700,color:"#15803d",textTransform:"uppercase",letterSpacing:"0.04em",display:"inline-flex",alignItems:"center",gap:"6px"},children:[(0,e.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:"#22c55e",display:"inline-block"}}),"Email Requested by Agent \u2022 Auto Verification"]}),(0,e.jsx)("button",{type:"button",onClick:()=>j(!1),style:{background:"none",border:"none",color:"#15803d",cursor:"pointer",fontSize:"12px",fontWeight:700,padding:"1px 4px"},children:"\u2715"})]}),(0,e.jsxs)("form",{onSubmit:me,style:{display:"flex",gap:"6px"},children:[(0,e.jsx)("input",{type:"email",autoFocus:!0,value:G,onChange:n=>{se(n.target.value),C("")},placeholder:"Enter your real email (e.g. name@gmail.com)",disabled:u,required:!0,style:{flex:1,fontSize:"12.5px",padding:"7px 11px",borderRadius:"7px",border:re?"1.5px solid #ef4444":"1px solid #86efac",background:"#ffffff",color:"#09090b",outline:"none"}}),(0,e.jsx)("button",{type:"submit",disabled:u||!G.trim(),style:{background:"#16a34a",color:"#ffffff",border:"none",padding:"7px 14px",borderRadius:"7px",fontSize:"12px",fontWeight:600,cursor:u?"wait":"pointer",opacity:u?.7:1},children:u?"...":"Verify & Send"})]}),re&&(0,e.jsxs)("div",{style:{fontSize:"11px",color:"#ef4444",fontWeight:500},children:["\u26A0\uFE0F ",re]}),U&&(0,e.jsxs)("div",{style:{fontSize:"11px",color:"#15803d",fontWeight:600},children:["\u2713 ",U]})]}),(0,e.jsxs)("div",{style:{padding:"12px 16px",borderTop:`1px solid ${s?"#27272a":"#e4e4e7"}`,background:s?"#121214":"#fafafa",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0},children:[(0,e.jsxs)("button",{type:"button",onClick:r?ve:he,disabled:w==="connecting",style:{display:"inline-flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:r?"#dc2626":w==="connecting"?"#64748b":W,color:"#ffffff",borderRadius:"10px",border:"none",fontSize:"13px",fontWeight:600,boxShadow:r?"0 4px 14px rgba(220, 38, 38, 0.35)":`0 4px 14px ${W}40`,cursor:w==="connecting"?"not-allowed":"pointer",transition:"all 0.15s ease"},children:[(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,e.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),(0,e.jsx)("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]}),(0,e.jsx)("span",{children:r?"End Voice Call":w==="connecting"?"Connecting...":"Start Voice Call"})]}),(0,e.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[r&&(0,e.jsx)("div",{style:{display:"flex",alignItems:"center",gap:"2.5px",height:"14px"},children:[12,8,14,6,10].map((n,f)=>(0,e.jsx)("span",{style:{width:"2.5px",height:`${Math.max(4,Math.min(14,Math.round(n*(.35+Math.max(xe,ke)*1.5))))}px`,background:W,borderRadius:"1px",transition:"height 0.12s ease"}},f))}),(0,e.jsx)("span",{style:{fontFamily:"var(--mono, monospace)",fontSize:"12px",fontWeight:600,padding:"3px 8px",borderRadius:"6px",background:s?"#18181b":r?"#000000":"#f4f4f5",color:s||r?"#ffffff":"#71717a",border:s?"1px solid #27272a":"none"},children:ne})]})]})]})]})]})}var Te=Ce;var ze={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function be(x={}){if(typeof window>"u")return;let{host:o,businessId:b="biz_demo_dental",agentId:v,theme:M="light",position:Z="bottom-right",label:L="Talk to Receptionist",accent:A="emerald",accentColor:E,businessName:l,greeting:$,onCallStart:F,onCallEnd:_,onTranscript:R}=x,g=E||ze[A]||A||"#10b981",ue=document.getElementById("omnidesk-voice-widget-root");ue&&ue.remove();let m=document.createElement("div");m.id="omnidesk-voice-widget-root",m.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let a=M==="dark"||M==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,w=null,H="idle",O=0,J=null,xe=!1,fe=!1,ke=0,ge=0,ne=!1,ee=null,Y=null,te=!1,ae=Z==="bottom-left",j=document.createElement("div");j.style.cssText=`
    position: fixed; bottom: 20px; ${ae?"left: 20px;":"right: 20px;"};
    z-index: 999999;
  `;let G=document.createElement("button");G.style.cssText=`
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${a?"#18181b":"#ffffff"}; color: ${a?"#fafafa":"#09090b"};
    border: 1px solid ${a?"#27272a":"#e4e4e7"};
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `,G.innerHTML=`
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${g};box-shadow:0 0 8px ${g};display:inline-block;"></span>
    <span>${L}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,j.appendChild(G);let se=document.createElement("div");se.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,se.onclick=()=>de(!1);let u=document.createElement("div");u.style.cssText=`
    position: fixed; bottom: 80px; ${ae?"left: 20px;":"right: 20px;"};
    width: 390px; max-width: calc(100vw - 32px); height: 560px; max-height: calc(100vh - 100px);
    background: ${a?"#09090b":"#ffffff"}; border: 1px solid ${a?"#27272a":"#e4e4e7"};
    border-radius: 20px; box-shadow: 0 24px 48px -12px rgba(0,0,0,0.22);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  `;let I=document.createElement("div");I.style.cssText=`
    background: ${a?"#18181b":"#ffffff"}; color: ${a?"#ffffff":"#09090b"};
    border-bottom: 1px solid ${a?"#27272a":"#e4e4e7"};
    padding: 13px 18px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; user-select: none; flex-shrink: 0;
  `,I.innerHTML=`
    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
      <div style="color: ${a?"rgba(255,255,255,0.6)":"#71717a"}; display: grid; place-items: center; flex-shrink: 0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle>
        </svg>
      </div>
      <div style="width: 28px; height: 28px; border-radius: 50%; background: ${a?"rgba(255,255,255,0.15)":g==="#18181b"?"rgba(24,24,27,0.08)":`${g}18`}; display: grid; place-items: center; flex-shrink: 0; color: ${a?"#ffffff":g==="#18181b"?"#09090b":g};">
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
  `;let re=document.createElement("style");re.textContent=`
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
  `,m.appendChild(re);let C=document.createElement("div");C.style.cssText=`
    flex: 1; min-height: 0; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 12px; background: ${a?"#09090b":"#ffffff"};
  `;let U=document.createElement("div");U.id="omnidesk-placeholder-banner",U.style.cssText=`
    margin: auto; text-align: center; padding: 10px 18px;
    background: ${a?"#18181b":"#f4f4f5"}; border: 1px solid ${a?"#27272a":"#e4e4e7"}; color: ${a?"#a1a1aa":"#52525b"};
    border-radius: 12px; font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px; align-self: center;
  `,U.innerHTML=`
    <span id="omnidesk-placeholder-dot" style="width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block;"></span>
    <span>Start a call to talk to our receptionist</span>
  `,C.appendChild(U);let k=document.createElement("div");if(k.id="omnidesk-thinking-bubble",k.style.cssText=`
    display: none; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;
  `,k.innerHTML=`
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
  `,C.appendChild(k),$){U.style.display="none";let r=document.createElement("div");r.style.cssText="display: flex; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;";let n=document.createElement("div");n.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let f=document.createElement("div");f.style.cssText="width: 24px; height: 24px; border-radius: 50%; background: #18181b; display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;",f.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let d=document.createElement("div");d.style.cssText=`padding: 10px 14px; border-radius: 14px 14px 14px 2px; font-size: 13px; line-height: 1.45; background: ${a?"#18181b":"#f4f4f5"}; color: ${a?"#fafafa":"#09090b"}; border: ${a?"1px solid #27272a":"none"}; box-shadow: 0 1px 2px rgba(0,0,0,0.04);`,d.innerText=$,n.appendChild(f),n.appendChild(d),r.appendChild(n),C.insertBefore(r,k),ee="agent",Y=d,te=!0}let y=document.createElement("div");y.id="omnidesk-email-bar",y.style.cssText=`
    padding: 11px 16px; background: #f0fdf4; border-top: 1px solid #bbf7d0;
    display: none; flex-direction: column; gap: 7px; flex-shrink: 0;
  `,y.innerHTML=`
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
  `;let V=document.createElement("div");V.style.cssText=`
    padding: 12px 16px; border-top: 1px solid ${a?"#27272a":"#e4e4e7"};
    background: ${a?"#121214":"#fafafa"}; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  `;let p=document.createElement("button");p.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: ${g}; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    box-shadow: 0 4px 14px ${g}40;
    cursor: pointer; transition: all 0.15s ease;
  `,p.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let K=document.createElement("div");K.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let S=document.createElement("div");S.id="omnidesk-waveform",S.style.cssText="display: none; align-items: center; gap: 2.5px; height: 14px;";let Q=[12,8,14,6,10],le=[];Q.forEach(r=>{let n=document.createElement("span");n.style.cssText=`width: 2.5px; height: ${Math.round(r*.35)}px; background: ${g}; border-radius: 1px; transition: height 0.12s ease;`,S.appendChild(n),le.push(n)}),K.appendChild(S);let T=document.createElement("span");T.id="omnidesk-timer",T.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,T.innerText="0:00",K.appendChild(T),V.appendChild(p),V.appendChild(K),u.appendChild(I),u.appendChild(C),u.appendChild(y),u.appendChild(V),m.appendChild(j),m.appendChild(se),m.appendChild(u),document.body.appendChild(m);function W(){O=Date.now(),T.innerText="0:00",T.style.background=a?"#18181b":"#000000",T.style.color="#ffffff",T.style.border=a?"1px solid #27272a":"none",J&&clearInterval(J),J=setInterval(()=>{let r=Date.now()-O,n=Math.floor(r/1e3),f=Math.floor(n/60),d=n%60;T.innerText=`${f}:${String(d).padStart(2,"0")}`},250)}function s(){J&&(clearInterval(J),J=null),T.style.background="#f4f4f5",T.style.color="#71717a",T.style.border="none",T.innerText="0:00",S.style.display="none"}function X(r){xe=r,u.style.display=r?"flex":"none"}function de(r){fe=r,se.style.display=r?"block":"none",r?(u.style.top="50%",u.style.left="50%",u.style.bottom="auto",u.style.right="auto",u.style.transform="translate(-50%, -50%)",u.style.width="calc(100vw - 40px)",u.style.maxWidth="1140px",u.style.height="calc(100vh - 40px)",u.style.maxHeight="900px"):(u.style.top="auto",u.style.left=ae?"20px":"auto",u.style.right=ae?"auto":"20px",u.style.bottom="80px",u.style.transform="none",u.style.width="390px",u.style.maxWidth="calc(100vw - 32px)",u.style.height="560px",u.style.maxHeight="calc(100vh - 100px)")}G.onclick=()=>X(!xe),I.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{X(!1),de(!1)}),I.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{de(!fe)});let N=y.querySelector("#omnidesk-email-form"),he=y.querySelector("#omnidesk-email-input");y.querySelector("#omnidesk-email-close-btn").addEventListener("click",()=>{y.style.display="none"}),N.addEventListener("submit",r=>{r.preventDefault();let n=he.value.trim();if(!n||!n.includes("@"))return;w&&w.sendEmailInput(n),ne=!0,y.style.display="none",he.value="",U.style.display="none";let f=document.createElement("div");f.style.cssText=`
      display: flex; flex-direction: column; gap: 4px; max-width: 88%;
      align-self: flex-end;
    `;let d=document.createElement("div");d.style.cssText=`
      padding: 10px 14px; border-radius: 14px 14px 2px 14px;
      font-size: 13px; line-height: 1.45;
      background: ${g}; color: #ffffff;
      box-shadow: 0 2px 8px ${g}35;
    `,d.innerText=`My email is ${n}`,f.appendChild(d),C.insertBefore(f,k),k.style.display="flex",C.scrollTop=C.scrollHeight,ee="user",Y=d,te=!0});async function me(){ne=!1,y.style.display="none",k.style.display="none",ee=null,Y=null,te=!1;let r=I.querySelector("#omnidesk-status-text"),n=I.querySelector("#omnidesk-status-dot"),f=p.querySelector("#omnidesk-btn-text");r.innerText="Connecting...",n.style.background="#eab308",f.innerText="Connecting...",p.style.background="#64748b",p.style.boxShadow="none",p.disabled=!0,W();try{let d=o;if(!d&&typeof document<"u"){let t=document.querySelector("script[src*='widget.js']");if(t&&t.src&&t.src.startsWith("http"))try{d=new URL(t.src).origin}catch{}}!d&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(d=window.location.origin);let P=(d||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),q=await fetch(`${P}/api/token?businessId=${encodeURIComponent(b)}`);if(!q.ok)throw new Error(`Failed to get session token (${q.status})`);let B=await q.json();if(B.business_name&&!l){let t=I.querySelector("#omnidesk-biz-title");t&&(t.innerText=B.business_name)}let h=v||B.agent_id||"";w=new ie({onStatusChange:t=>{if(H=t,t==="connected")r.innerText="Live \xB7 Speaking",n.style.background="#22c55e",f.innerText="End Voice Call",p.style.background="#dc2626",p.style.boxShadow="0 4px 14px rgba(220, 38, 38, 0.35)",p.disabled=!1,S.style.display="flex",O=Date.now(),F?.();else if(t==="idle"&&(r.innerText="Idle \xB7 Ready",n.style.background=a?"rgba(255,255,255,0.4)":"#a1a1aa",f.innerText="Start Voice Call",p.style.background=g,p.style.boxShadow=`0 4px 14px ${g}40`,p.disabled=!1,S.style.display="none",y.style.display="none",k.style.display="none",s(),O>0)){let i=Math.round((Date.now()-O)/1e3);O=0,_?.(i)}},onThinkingChange:t=>{t&&(k.style.display="flex",C.scrollTop=C.scrollHeight)},onTranscript:t=>{if(U.style.display="none",t.who==="user"){t.isFinal&&(k.style.display="flex");let i=t.text.toLowerCase();(t.text.includes("@")||i.includes(" at ")&&i.includes(" dot ")||i.includes("gmail")||i.includes("yahoo")||i.includes("outlook")||i.includes("hotmail")||i.includes("icloud"))&&(ne=!0,y.style.display="none")}else if(t.who==="agent"){t.text&&t.text.trim().length>0&&(k.style.display="none");let i=t.text.toLowerCase();(i.includes("verified your email")||i.includes("email is verified")||i.includes("verified that email")||i.includes("sent a calendar")||i.includes("sent your confirmation")||i.includes("calendar invite")||i.includes("confirmation code is")||i.includes("booking is confirmed")||i.includes("all set, your appointment")||i.includes("scheduled your appointment"))&&(ne=!0),!ne&&(i.includes("what is your email")||i.includes("what's your email")||i.includes("may i have your email")||i.includes("can i have your email")||i.includes("could i get your email")||i.includes("could you provide your email")||i.includes("provide your email")||i.includes("enter your email")||i.includes("spell your email")||i.includes("share your email")||i.includes("need your email")||i.includes("what email")||i.includes("which email")||i.includes("where can i send your confirmation")||i.includes("where should i send your confirmation")||i.includes("where can i send your calendar")||i.includes("where should i send your calendar")||i.includes("email")&&(i.includes("what is")||i.includes("what's")||i.includes("may i have")||i.includes("can you provide")||i.includes("could you provide")||i.includes("give me your")||i.includes("tell me your")))?(y.style.display="flex",setTimeout(()=>he.focus(),60)):y.style.display="none"}if(ee===t.who&&Y&&!te)Y.innerText=t.text,te=!!t.isFinal;else{let i=t.who==="user",z=document.createElement("div");if(z.style.cssText=`
              display: flex; flex-direction: column; gap: 4px; max-width: 88%;
              align-self: ${i?"flex-end":"flex-start"};
            `,i){let D=document.createElement("div");D.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 2px 14px;
                font-size: 13px; line-height: 1.45;
                background: ${g};
                color: #ffffff;
                box-shadow: 0 2px 8px ${g}35;
              `,D.innerText=t.text,z.appendChild(D),Y=D}else{let D=document.createElement("div");D.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let ce=document.createElement("div");ce.style.cssText=`
                width: 24px; height: 24px; border-radius: 50%; background: #18181b;
                display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;
              `,ce.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let pe=document.createElement("div");pe.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 14px 2px;
                font-size: 13px; line-height: 1.45;
                background: ${a?"#18181b":"#f4f4f5"};
                color: ${a?"#fafafa":"#09090b"};
                border: ${a?"1px solid #27272a":"none"};
                box-shadow: 0 1px 2px rgba(0,0,0,0.04);
              `,pe.innerText=t.text,D.appendChild(ce),D.appendChild(pe),z.appendChild(D),Y=pe}C.insertBefore(z,k),ee=t.who,te=!!t.isFinal}C.scrollTop=C.scrollHeight,R?.(t)},onAudioLevel:(t,i)=>{if(ke=t,ge=i,H==="connected"){S.style.display="flex";let z=Math.max(t,i);Q.forEach((D,ce)=>{let pe=Math.max(4,Math.min(14,Math.round(D*(.35+z*1.5))));le[ce]&&(le[ce].style.height=`${pe}px`)})}},onError:()=>{r.innerText="Error",n.style.background="#ef4444",f.innerText="Start Voice Call",p.style.background=g,p.style.boxShadow=`0 4px 14px ${g}40`,p.disabled=!1,S.style.display="none",y.style.display="none",k.style.display="none",s()}}),await w.start(B.token,h,B.voice)}catch(d){console.error("[OmniDesk Voice Widget Error]:",d),r.innerText="Error",n.style.background="#ef4444",f.innerText="Start Voice Call",p.style.background=g,p.style.boxShadow=`0 4px 14px ${g}40`,p.disabled=!1,S.style.display="none",y.style.display="none",k.style.display="none",s()}}function oe(){w&&(w.stop(),w=null),H="idle";let r=I.querySelector("#omnidesk-status-text"),n=I.querySelector("#omnidesk-status-dot"),f=p.querySelector("#omnidesk-btn-text");r&&(r.innerText="Idle \xB7 Ready"),n&&(n.style.background=a?"rgba(255,255,255,0.4)":"#a1a1aa"),f&&(f.innerText="Start Voice Call"),p.style.background=g,p.style.boxShadow=`0 4px 14px ${g}40`,p.disabled=!1,S.style.display="none",y.style.display="none",k.style.display="none",s()}return p.onclick=()=>{H==="connected"?oe():H==="idle"&&me()},{destroy:()=>{s(),w&&w.stop(),m.remove()},startCall:me,endCall:oe}}if(typeof document<"u"){let x=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(x){let o,b=x.src||"";if(b&&b.startsWith("http"))try{o=new URL(b).origin}catch{}let v=x.getAttribute("data-business-id")||void 0,M=x.getAttribute("data-agent")||void 0,Z=x.getAttribute("data-theme")||"dark",L=x.getAttribute("data-accent")||"emerald",A=x.getAttribute("data-position")||"bottom-right",E=x.getAttribute("data-label")||void 0,l=x.getAttribute("data-host")||o||"https://omni-desk-rho.vercel.app",$=x.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{be({businessId:v,agentId:M,theme:Z,accent:L,position:A,label:E,host:l,greeting:$})}):be({businessId:v,agentId:M,theme:Z,accent:L,position:A,label:E,host:l,greeting:$})}}0&&(module.exports={AssemblyAIVoiceClient,OmniDeskWidget,VoiceWidget,initOmniDeskWidget});
//# sourceMappingURL=index.js.map