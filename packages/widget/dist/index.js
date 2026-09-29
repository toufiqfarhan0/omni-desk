"use strict";var me=Object.defineProperty;var ve=Object.getOwnPropertyDescriptor;var we=Object.getOwnPropertyNames;var Se=Object.prototype.hasOwnProperty;var Ce=(o,t)=>{for(var d in t)me(o,d,{get:t[d],enumerable:!0})},Te=(o,t,d,f)=>{if(t&&typeof t=="object"||typeof t=="function")for(let h of we(t))!Se.call(o,h)&&h!==d&&me(o,h,{get:()=>t[h],enumerable:!(f=ve(t,h))||f.enumerable});return o};var Me=o=>Te(me({},"__esModule",{value:!0}),o);var Re={};Ce(Re,{AssemblyAIVoiceClient:()=>H,OmniDeskWidget:()=>be,VoiceWidget:()=>ke,initOmniDeskWidget:()=>ge});module.exports=Me(Re);var i=require("react");var he=24e3,Le="wss://agents.assemblyai.com/v1/ws",_e=`
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${he};
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
`,Ee=`
  class PlaybackProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ring = new Float32Array(sampleRate * 30);
      this._writePos = 0;
      this._readPos = 0;
      this._available = 0;
      this._step = ${he} / sampleRate;
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
`;async function ye(o,t,d){let f=URL.createObjectURL(new Blob([t],{type:"application/javascript"}));try{await o.audioWorklet.addModule(f)}finally{URL.revokeObjectURL(f)}return new AudioWorkletNode(o,d)}var H=class{constructor(t){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.isThinking=!1;this.callbacks=t}setThinking(t){this.isThinking!==t&&(this.isThinking=t,this.callbacks.onThinkingChange?.(t))}async start(t,d,f){try{this.callbacks.onStatusChange?.("connecting");let h=window.AudioContext||window.webkitAudioContext;this.captureCtx=new h({sampleRate:he}),this.playbackCtx=new h({sampleRate:he}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await ye(this.playbackCtx,Ee,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await ye(this.captureCtx,_e,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let $=new URL(Le);$.searchParams.set("token",t),this.ws=new WebSocket($.toString()),this.captureNode.port.onmessage=({data:g})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let n=new Uint8Array(g),k="";for(let L=0;L<n.length;L+=32768)k+=String.fromCharCode.apply(null,Array.from(n.subarray(L,L+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(k)}));let S=new Int16Array(g),M=0;for(let L=0;L<S.length;L+=16)M+=Math.abs(S[L]);this.userLevel=Math.min(1,M/(S.length/16)/8e3)},this.ws.onopen=()=>{let g={};d&&d.trim()?g.agent_id=d.trim():f&&f.trim()&&(g.output={voice:f.trim()}),Object.keys(g).length>0&&this.ws?.send(JSON.stringify({type:"session.update",session:g}))},this.ws.onmessage=({data:g})=>{try{let n=JSON.parse(g);switch(n.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0,this.setThinking(!1);break;case"transcript.user":n.text&&(this.callbacks.onTranscript?.({who:"user",text:n.text}),this.setThinking(!0));break;case"transcript.agent":this.setThinking(!1),n.text&&this.callbacks.onTranscript?.({who:"agent",text:n.text});break;case"reply.audio":if(this.setThinking(!1),n.data&&this.playbackNode){let k=atob(n.data),S=new Uint8Array(k.length);for(let M=0;M<k.length;M++)S[M]=k.charCodeAt(M);this.playbackNode.port.postMessage(S.buffer,[S.buffer]),this.agentLevel=.8}break;case"reply.done":n.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:n.name||n.tool,args:n.arguments||n.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:n.name||n.tool,result:n.result});break;case"session.error":this.setThinking(!1),this.callbacks.onError?.(n.message||n.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.setThinking(!1),this.stop();break}}catch(n){console.warn("Message parsing error:",n)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(h){this.callbacks.onError?.(h.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(t){this.isMuted=t,t&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(t,d){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:t})),d&&this.ws.send(JSON.stringify({type:"reply.create",instructions:d})),!0}catch(f){return console.error("Failed to send message to agent:",f),!1}}sendEmailInput(t){return this.sendUserMessage(`My email address is ${t}`,`The caller entered their verified email address: ${t}. Acknowledge this email, verify it using verify_customer_email if needed, and complete the booking.`)}stop(){if(this.setThinking(!1),this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(t=>t.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let t=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(t)};this.animFrameId=requestAnimationFrame(t)}};var e=require("react/jsx-runtime"),Ie={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function be({host:o="",businessId:t="biz_demo_dental",agentId:d,theme:f="light",position:h="bottom-right",label:$="Talk to Receptionist",accent:g="emerald",accentColor:n,businessName:k,greeting:S,className:M,onCallStart:L,onCallEnd:Z,onTranscript:ae}){let[Y,ne]=(0,i.useState)(!1),[c,G]=(0,i.useState)(!1),[y,P]=(0,i.useState)("idle"),[N,O]=(0,i.useState)([]),[le,se]=(0,i.useState)(0),[xe,ce]=(0,i.useState)(0),[K,Q]=(0,i.useState)("0:00"),[X,ee]=(0,i.useState)(k||"OmniDesk Hair Salon & Studio"),[a,m]=(0,i.useState)(!1),[E,U]=(0,i.useState)(""),[V,x]=(0,i.useState)(!1),[B,b]=(0,i.useState)(""),[de,z]=(0,i.useState)(""),[j,I]=(0,i.useState)(!1),A=(0,i.useRef)(null),oe=(0,i.useRef)(null),p=(0,i.useRef)(0),v=(0,i.useRef)(null),D=(0,i.useRef)(0),w=(0,i.useRef)(!1),pe=(0,i.useMemo)(()=>n||Ie[g]||g||"#10b981",[g,n]),q=(0,i.useMemo)(()=>f==="light"?!1:f==="auto"&&typeof window<"u"?window.matchMedia("(prefers-color-scheme: dark)").matches:!0,[f]);(0,i.useEffect)(()=>{oe.current?.scrollIntoView({behavior:"smooth"})},[N,j]);let _=(0,i.useMemo)(()=>o?o.replace(/\/$/,""):typeof window<"u"&&window.location.origin?window.location.origin:"",[o]),ue=(0,i.useCallback)(()=>{D.current=Date.now(),Q("0:00"),v.current&&clearInterval(v.current),v.current=setInterval(()=>{let l=Date.now()-D.current,R=Math.floor(l/1e3),T=Math.floor(R/60),W=R%60;Q(`${T}:${String(W).padStart(2,"0")}`)},250)},[]),r=(0,i.useCallback)(()=>{v.current&&(clearInterval(v.current),v.current=null)},[]),F=(0,i.useCallback)(async()=>{try{P("connecting"),w.current=!1,m(!1),ue();let R=`${_?_.replace(/\/$/,""):""}/api/token?businessId=${encodeURIComponent(t)}`,T=await fetch(R);if(!T.ok)throw new Error("Failed to initialize voice session");let W=await T.json();if(W.business_name&&!k&&ee(W.business_name),!W.token)throw new Error("Invalid session token payload received from host");let te=d||W.agent_id||"",ie=new H({onStatusChange:u=>{if(P(u),u==="connected")p.current=Date.now(),L?.();else if(u==="idle"){if(I(!1),r(),p.current>0){let s=Math.round((Date.now()-p.current)/1e3);p.current=0,Z?.(s)}}else u==="error"&&(I(!1),r())},onThinkingChange:u=>{I(u)},onTranscript:u=>{if(u.who==="user"?I(!0):u.who==="agent"&&I(!1),O(s=>[...s,u]),ae?.(u),u.who==="user")(u.text.includes("@")||u.text.toLowerCase().includes(" at ")&&u.text.toLowerCase().includes(" dot "))&&(w.current=!0,m(!1));else if(u.who==="agent"){let s=u.text.toLowerCase();if(s.includes("verified your email")||s.includes("thank you")&&s.includes("email")||s.includes("sent a calendar invite")||s.includes("sent your confirmation")||s.includes("confirmation code is")||s.includes("i have sent")){w.current=!0,m(!1);return}if(w.current){m(!1);return}(s.includes("what is your email")||s.includes("may i have your email")||s.includes("provide your email")||s.includes("can i have your email")||s.includes("enter your email")||s.includes("spell your email")||s.includes("what's your email")||s.includes("where can i send your confirmation")||s.includes("where should i send your confirmation")||s.includes("where can i send your calendar invite")||s.includes("where should i send your calendar invite")||s.includes("email address")&&(s.includes("what")||s.includes("have")||s.includes("provide")||s.includes("give")||s.includes("tell")))&&m(!0)}},onAudioLevel:(u,s)=>{se(u),ce(s)},onError:()=>{P("error"),r()}});A.current=ie,await ie.start(W.token,te,W.voice)}catch{P("error"),r()}},[_,t,d,k,L,Z,ae,ue,r]),J=(0,i.useCallback)(()=>{if(A.current&&(A.current.stop(),A.current=null),P("idle"),I(!1),se(0),ce(0),r(),m(!1),b(""),z(""),p.current>0){let l=Math.round((Date.now()-p.current)/1e3);p.current=0,Z?.(l)}},[Z,r]),re=(0,i.useCallback)(async l=>{l.preventDefault();let R=E.trim();if(R){x(!0),b(""),z("");try{let T=_?_.replace(/\/$/,""):"",W=await fetch(`${T}/api/tools/${encodeURIComponent(t)}/verify_customer_email`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:R})}),te=await W.json();if(!W.ok||!te.valid||!te.email){b(te.message||"Invalid email or domain has no active mail server."),x(!1);return}let ie=te.email;z(`Verified: ${ie}. Sent to agent.`),O(u=>[...u,{who:"user",text:`My email is ${ie}`}]),A.current&&A.current.sendEmailInput(ie),I(!0),w.current=!0,U(""),m(!1),z("")}catch(T){b(T.message||"Failed to verify email with mail server.")}finally{x(!1)}}},[E,_,t]);(0,i.useEffect)(()=>()=>{r(),A.current&&A.current.stop()},[r]);let fe=h==="bottom-left",C=y==="connected";return(0,e.jsxs)("div",{className:M,style:{position:"relative",zIndex:99999},children:[(0,e.jsx)("div",{style:{position:"fixed",bottom:"20px",left:fe?"20px":"auto",right:fe?"auto":"20px",zIndex:99999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:(0,e.jsxs)("button",{type:"button",onClick:()=>ne(!Y),style:{display:"inline-flex",alignItems:"center",gap:"10px",background:q?"#18181b":"#ffffff",color:q?"#fafafa":"#09090b",border:`1px solid ${q?"#27272a":"#e4e4e7"}`,padding:"10px 18px",borderRadius:"9999px",cursor:"pointer",fontSize:"13px",fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.18)",transition:"transform 0.15s ease, background 0.15s ease"},onMouseEnter:l=>{l.currentTarget.style.transform="scale(1.02)"},onMouseLeave:l=>{l.currentTarget.style.transform="scale(1)"},children:[(0,e.jsx)("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:C?"#ef4444":pe,boxShadow:`0 0 8px ${C?"#ef4444":pe}`}}),(0,e.jsx)("span",{children:$}),(0,e.jsx)("span",{style:{fontSize:"11px",opacity:.6},children:"\u25B2"})]})}),Y&&(0,e.jsxs)(e.Fragment,{children:[c&&(0,e.jsx)("div",{onClick:()=>G(!1),style:{position:"fixed",inset:0,background:"rgba(0, 0, 0, 0.7)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",zIndex:999998}}),(0,e.jsxs)("div",{style:{position:"fixed",bottom:c?"auto":"80px",left:c?"50%":fe?"20px":"auto",right:c||fe?"auto":"20px",top:c?"50%":"auto",transform:c?"translate(-50%, -50%)":"none",width:c?"calc(100vw - 40px)":"390px",maxWidth:c?"1140px":"calc(100vw - 32px)",height:c?"calc(100vh - 40px)":"560px",maxHeight:c?"900px":"calc(100vh - 100px)",background:"#ffffff",border:"1px solid #e4e4e7",borderRadius:"20px",boxShadow:c?"0 32px 64px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)":"0 24px 48px -12px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:999999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",transition:"all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"},children:[(0,e.jsx)("style",{children:`
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
            `}),(0,e.jsxs)("div",{style:{background:"#18181b",color:"#ffffff",padding:c?"16px 22px":"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",userSelect:"none",flexShrink:0},children:[(0,e.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"10px",minWidth:0},children:[(0,e.jsx)("div",{style:{color:"rgba(255,255,255,0.6)",display:"grid",placeItems:"center",flexShrink:0},children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("circle",{cx:"12",cy:"12",r:"1"}),(0,e.jsx)("circle",{cx:"12",cy:"5",r:"1"}),(0,e.jsx)("circle",{cx:"12",cy:"19",r:"1"})]})}),(0,e.jsx)("div",{style:{width:"28px",height:"28px",borderRadius:"50%",background:"rgba(255,255,255,0.15)",display:"grid",placeItems:"center",flexShrink:0,color:"#ffffff"},children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,e.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),(0,e.jsx)("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]})}),(0,e.jsxs)("div",{style:{display:"flex",flexDirection:"column",minWidth:0},children:[(0,e.jsx)("div",{style:{fontSize:"13.5px",fontWeight:600,color:"#ffffff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},children:X}),(0,e.jsxs)("div",{style:{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"11px",color:"rgba(255,255,255,0.75)"},children:[(0,e.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:C?j?"#f59e0b":"#22c55e":y==="connecting"?"#eab308":"rgba(255,255,255,0.4)",animation:j?"omnidesk-pulse-amber 1.5s infinite":"none"}}),(0,e.jsx)("span",{children:C?j?"Thinking \xB7 Checking tools...":"Live \xB7 Speaking":y==="connecting"?"Connecting...":y==="error"?"Error":"Idle \xB7 Ready"})]})]})]}),(0,e.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[(0,e.jsx)("button",{type:"button",onClick:()=>G(!c),title:c?"Exit Fullscreen":"Open Full",style:{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"7px",color:"#ffffff",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:l=>l.currentTarget.style.background="rgba(255,255,255,0.2)",onMouseLeave:l=>l.currentTarget.style.background="rgba(255,255,255,0.1)",children:c?(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("polyline",{points:"4 14 10 14 10 20"}),(0,e.jsx)("polyline",{points:"20 10 14 10 14 4"}),(0,e.jsx)("line",{x1:"14",y1:"10",x2:"21",y2:"3"}),(0,e.jsx)("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]}):(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("polyline",{points:"15 3 21 3 21 9"}),(0,e.jsx)("polyline",{points:"9 21 3 21 3 15"}),(0,e.jsx)("line",{x1:"21",y1:"3",x2:"14",y2:"10"}),(0,e.jsx)("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]})}),(0,e.jsx)("button",{type:"button",onClick:()=>{C&&J(),ne(!1)},title:"Close Widget",style:{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"7px",color:"#ffffff",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:l=>l.currentTarget.style.background="rgba(255,255,255,0.2)",onMouseLeave:l=>l.currentTarget.style.background="rgba(255,255,255,0.1)",children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("line",{x1:"18",y1:"6",x2:"6",y2:"18"}),(0,e.jsx)("line",{x1:"6",y1:"6",x2:"18",y2:"18"})]})})]})]}),(0,e.jsxs)("div",{style:{flex:1,minHeight:0,padding:"16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"12px",background:"#ffffff"},children:[N.length===0&&(0,e.jsxs)("div",{style:{margin:"auto",textAlign:"center",padding:"10px 18px",background:"#f4f4f5",border:"1px solid #e4e4e7",color:"#52525b",borderRadius:"12px",fontSize:"12.5px",fontWeight:500,display:"inline-flex",alignItems:"center",gap:"8px",alignSelf:"center"},children:[(0,e.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:C?"#22c55e":"#a1a1aa",display:"inline-block"}}),(0,e.jsx)("span",{children:C?"Connected \xB7 Speak to our receptionist":y==="connecting"?"Connecting to receptionist...":"Start a call to talk to our receptionist"})]}),N.map((l,R)=>{let T=l.who==="user";return(0,e.jsx)("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:T?"flex-end":"flex-start"},children:(0,e.jsxs)("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[!T&&(0,e.jsx)("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,e.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),(0,e.jsx)("div",{style:{padding:"10px 14px",borderRadius:T?"14px 14px 2px 14px":"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:T?"#18181b":"#f4f4f5",color:T?"#ffffff":"#09090b",boxShadow:"0 1px 2px rgba(0,0,0,0.04)"},children:l.text})]})},R)}),j&&(0,e.jsx)("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:"flex-start"},children:(0,e.jsxs)("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[(0,e.jsx)("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,e.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),(0,e.jsxs)("div",{style:{padding:"10px 14px",borderRadius:"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:"#f4f4f5",color:"#71717a",boxShadow:"0 1px 2px rgba(0,0,0,0.04)",display:"inline-flex",alignItems:"center",gap:"5px",minHeight:"38px"},title:"Agent is thinking and processing...",children:[(0,e.jsx)("span",{className:"omnidesk-motion-dot omnidesk-dot-1"}),(0,e.jsx)("span",{className:"omnidesk-motion-dot omnidesk-dot-2"}),(0,e.jsx)("span",{className:"omnidesk-motion-dot omnidesk-dot-3"})]})]})}),(0,e.jsx)("div",{ref:oe})]}),a&&C&&(0,e.jsxs)("div",{style:{padding:"11px 16px",background:"#f0fdf4",borderTop:"1px solid #bbf7d0",display:"flex",flexDirection:"column",gap:"7px",flexShrink:0},children:[(0,e.jsxs)("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"},children:[(0,e.jsxs)("span",{style:{fontSize:"11px",fontWeight:700,color:"#15803d",textTransform:"uppercase",letterSpacing:"0.04em",display:"inline-flex",alignItems:"center",gap:"6px"},children:[(0,e.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:"#22c55e",display:"inline-block"}}),"Agent Requesting Email \u2022 Verified Mailbox Entry"]}),(0,e.jsx)("button",{type:"button",onClick:()=>m(!1),style:{background:"none",border:"none",color:"#15803d",cursor:"pointer",fontSize:"12px",fontWeight:700,padding:"1px 4px"},children:"\u2715"})]}),(0,e.jsxs)("form",{onSubmit:re,style:{display:"flex",gap:"6px"},children:[(0,e.jsx)("input",{type:"email",autoFocus:!0,value:E,onChange:l=>{U(l.target.value),b("")},placeholder:"Enter your real email (e.g. name@gmail.com)",disabled:V,required:!0,style:{flex:1,fontSize:"12.5px",padding:"7px 11px",borderRadius:"7px",border:B?"1.5px solid #ef4444":"1px solid #86efac",background:"#ffffff",color:"#09090b",outline:"none"}}),(0,e.jsx)("button",{type:"submit",disabled:V||!E.trim(),style:{background:"#16a34a",color:"#ffffff",border:"none",padding:"7px 14px",borderRadius:"7px",fontSize:"12px",fontWeight:600,cursor:V?"wait":"pointer",opacity:V?.7:1},children:V?"...":"Verify & Send"})]}),B&&(0,e.jsxs)("div",{style:{fontSize:"11px",color:"#ef4444",fontWeight:500},children:["\u26A0\uFE0F ",B]}),de&&(0,e.jsxs)("div",{style:{fontSize:"11px",color:"#15803d",fontWeight:600},children:["\u2713 ",de]})]}),(0,e.jsxs)("div",{style:{padding:"12px 16px",borderTop:"1px solid #e4e4e7",background:"#fafafa",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0},children:[(0,e.jsxs)("button",{type:"button",onClick:C?J:F,disabled:y==="connecting",style:{display:"inline-flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:C?"#dc2626":"#000000",color:"#ffffff",borderRadius:"10px",border:"none",fontSize:"13px",fontWeight:600,cursor:y==="connecting"?"not-allowed":"pointer",transition:"all 0.15s ease"},children:[(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,e.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),(0,e.jsx)("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]}),(0,e.jsx)("span",{children:C?"End Voice Call":y==="connecting"?"Connecting...":"Start Voice Call"})]}),(0,e.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[C&&(0,e.jsx)("div",{style:{display:"flex",alignItems:"center",gap:"2.5px",height:"14px"},children:[12,8,14,6,10].map((l,R)=>(0,e.jsx)("span",{style:{width:"2.5px",height:`${Math.max(4,Math.min(14,Math.round(l*(.35+Math.max(le,xe)*1.5))))}px`,background:"#000000",borderRadius:"1px",transition:"height 0.12s ease"}},R))}),(0,e.jsx)("span",{style:{fontFamily:"var(--mono, monospace)",fontSize:"12px",fontWeight:600,padding:"3px 8px",borderRadius:"6px",background:C?"#000000":"#f4f4f5",color:C?"#ffffff":"#71717a"},children:K})]})]})]})]})]})}var ke=be;var Ae={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function ge(o={}){if(typeof window>"u")return;let{host:t,businessId:d="biz_demo_dental",agentId:f,theme:h="light",position:$="bottom-right",label:g="Talk to Receptionist",accent:n="emerald",accentColor:k,businessName:S,greeting:M,onCallStart:L,onCallEnd:Z,onTranscript:ae}=o,Y=k||Ae[n]||n||"#10b981",ne=document.getElementById("omnidesk-voice-widget-root");ne&&ne.remove();let c=document.createElement("div");c.id="omnidesk-voice-widget-root",c.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let G=h==="dark"||h==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,y=null,P="idle",N=0,O=null,le=!1,se=!1,xe=0,ce=0,K=$==="bottom-left",Q=document.createElement("div");Q.style.cssText=`
    position: fixed; bottom: 20px; ${K?"left: 20px;":"right: 20px;"};
    z-index: 999999;
  `;let X=document.createElement("button");X.style.cssText=`
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${G?"#18181b":"#ffffff"}; color: ${G?"#fafafa":"#09090b"};
    border: 1px solid ${G?"#27272a":"#e4e4e7"};
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `,X.innerHTML=`
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${Y};box-shadow:0 0 8px ${Y};display:inline-block;"></span>
    <span>${g}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,Q.appendChild(X);let ee=document.createElement("div");ee.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,ee.onclick=()=>I(!1);let a=document.createElement("div");a.style.cssText=`
    position: fixed; bottom: 80px; ${K?"left: 20px;":"right: 20px;"};
    width: 390px; max-width: calc(100vw - 32px); height: 560px; max-height: calc(100vh - 100px);
    background: #ffffff; border: 1px solid #e4e4e7;
    border-radius: 20px; box-shadow: 0 24px 48px -12px rgba(0,0,0,0.22);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  `;let m=document.createElement("div");m.style.cssText=`
    background: #18181b; color: #ffffff; padding: 13px 18px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; user-select: none; flex-shrink: 0;
  `,m.innerHTML=`
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
      <div style="display: flex; flex-direction: column; min-width: 0;">
        <div id="omnidesk-biz-title" style="font-size: 13.5px; font-weight: 600; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${S||"OmniDesk Hair Salon & Studio"}
        </div>
        <div style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: rgba(255,255,255,0.75); white-space: nowrap;">
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
  `;let E=document.createElement("div");E.style.cssText=`
    flex: 1; min-height: 0; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 12px; background: #ffffff;
  `;let U=document.createElement("div");U.id="omnidesk-placeholder-banner",U.style.cssText=`
    margin: auto; text-align: center; padding: 10px 18px;
    background: #f4f4f5; border: 1px solid #e4e4e7; color: #52525b;
    border-radius: 12px; font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px; align-self: center;
  `,U.innerHTML=`
    <span style="width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block;"></span>
    <span>Start a call to talk to our receptionist</span>
  `,E.appendChild(U);let V=document.createElement("div");V.style.cssText=`
    padding: 12px 16px; border-top: 1px solid #e4e4e7;
    background: #fafafa; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  `;let x=document.createElement("button");x.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: #000000; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s ease;
  `,x.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let B=document.createElement("div");B.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let b=document.createElement("span");b.id="omnidesk-timer",b.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,b.innerText="0:00",B.appendChild(b),V.appendChild(x),V.appendChild(B),a.appendChild(m),a.appendChild(E),a.appendChild(V),c.appendChild(Q),c.appendChild(ee),c.appendChild(a),document.body.appendChild(c);function de(){N=Date.now(),b.innerText="0:00",b.style.background="#000000",b.style.color="#ffffff",O&&clearInterval(O),O=setInterval(()=>{let p=Date.now()-N,v=Math.floor(p/1e3),D=Math.floor(v/60),w=v%60;b.innerText=`${D}:${String(w).padStart(2,"0")}`},250)}function z(){O&&(clearInterval(O),O=null),b.style.background="#f4f4f5",b.style.color="#71717a",b.innerText="0:00"}function j(p){le=p,a.style.display=p?"flex":"none"}function I(p){se=p,ee.style.display=p?"block":"none",p?(a.style.top="50%",a.style.left="50%",a.style.bottom="auto",a.style.right="auto",a.style.transform="translate(-50%, -50%)",a.style.width="calc(100vw - 40px)",a.style.maxWidth="1140px",a.style.height="calc(100vh - 40px)",a.style.maxHeight="900px"):(a.style.top="auto",a.style.left=K?"20px":"auto",a.style.right=K?"auto":"20px",a.style.bottom="80px",a.style.transform="none",a.style.width="390px",a.style.maxWidth="calc(100vw - 32px)",a.style.height="560px",a.style.maxHeight="calc(100vh - 100px)")}X.onclick=()=>j(!le),m.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{j(!1),I(!1)}),m.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{I(!se)});async function A(){let p=m.querySelector("#omnidesk-status-text"),v=m.querySelector("#omnidesk-status-dot"),D=x.querySelector("#omnidesk-btn-text");p.innerText="Connecting...",v.style.background="#eab308",D.innerText="Connecting...",x.disabled=!0,de();try{let w=t;if(!w&&typeof document<"u"){let r=document.querySelector("script[src*='widget.js']");if(r&&r.src&&r.src.startsWith("http"))try{w=new URL(r.src).origin}catch{}}!w&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(w=window.location.origin);let pe=(w||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),q=await fetch(`${pe}/api/token?businessId=${encodeURIComponent(d)}`);if(!q.ok)throw new Error(`Failed to get session token (${q.status})`);let _=await q.json();if(_.business_name&&!S){let r=m.querySelector("#omnidesk-biz-title");r&&(r.innerText=_.business_name)}let ue=f||_.agent_id||"";y=new H({onStatusChange:r=>{if(P=r,r==="connected")p.innerText="Live \xB7 Speaking",v.style.background="#22c55e",D.innerText="End Voice Call",x.style.background="#dc2626",x.disabled=!1,N=Date.now(),L?.();else if(r==="idle"&&(p.innerText="Idle \xB7 Ready",v.style.background="rgba(255,255,255,0.4)",D.innerText="Start Voice Call",x.style.background="#000000",x.disabled=!1,z(),N>0)){let F=Math.round((Date.now()-N)/1e3);N=0,Z?.(F)}},onTranscript:r=>{U.style.display="none";let F=document.createElement("div"),J=r.who==="user";F.style.cssText=`
            display: flex; flex-direction: column; gap: 4px; max-width: 88%;
            align-self: ${J?"flex-end":"flex-start"};
          `;let re=document.createElement("div");re.style.cssText=`
            padding: 10px 14px; border-radius: ${J?"14px 14px 2px 14px":"14px 14px 14px 2px"};
            font-size: 13px; line-height: 1.45;
            background: ${J?"#18181b":"#f4f4f5"};
            color: ${J?"#ffffff":"#09090b"};
            box-shadow: 0 1px 2px rgba(0,0,0,0.04);
          `,re.innerText=r.text,F.appendChild(re),E.appendChild(F),E.scrollTop=E.scrollHeight,ae?.(r)},onAudioLevel:(r,F)=>{xe=r,ce=F},onError:()=>{p.innerText="Error",v.style.background="#ef4444",D.innerText="Start Voice Call",x.style.background="#000000",x.disabled=!1,z()}}),await y.start(_.token,ue,_.voice)}catch(w){console.error("[OmniDesk Voice Widget Error]:",w),p.innerText="Error",v.style.background="#ef4444",D.innerText="Start Voice Call",x.style.background="#000000",x.disabled=!1,z()}}function oe(){y&&(y.stop(),y=null),P="idle",z()}return x.onclick=()=>{P==="connected"?oe():P==="idle"&&A()},{destroy:()=>{z(),y&&y.stop(),c.remove()},startCall:A,endCall:oe}}if(typeof document<"u"){let o=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(o){let t,d=o.src||"";if(d&&d.startsWith("http"))try{t=new URL(d).origin}catch{}let f=o.getAttribute("data-business-id")||void 0,h=o.getAttribute("data-agent")||void 0,$=o.getAttribute("data-theme")||"dark",g=o.getAttribute("data-accent")||"emerald",n=o.getAttribute("data-position")||"bottom-right",k=o.getAttribute("data-label")||void 0,S=o.getAttribute("data-host")||t||"https://omni-desk-rho.vercel.app",M=o.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{ge({businessId:f,agentId:h,theme:$,accent:g,position:n,label:k,host:S,greeting:M})}):ge({businessId:f,agentId:h,theme:$,accent:g,position:n,label:k,host:S,greeting:M})}}0&&(module.exports={AssemblyAIVoiceClient,OmniDeskWidget,VoiceWidget,initOmniDeskWidget});
//# sourceMappingURL=index.js.map