"use strict";var be=Object.defineProperty;var Ce=Object.getOwnPropertyDescriptor;var Se=Object.getOwnPropertyNames;var Te=Object.prototype.hasOwnProperty;var Ee=(c,i)=>{for(var m in i)be(c,m,{get:i[m],enumerable:!0})},Me=(c,i,m,y)=>{if(i&&typeof i=="object"||typeof i=="function")for(let C of Se(i))!Te.call(c,C)&&C!==m&&be(c,C,{get:()=>i[C],enumerable:!(y=Ce(i,C))||y.enumerable});return c};var Le=c=>Me(be({},"__esModule",{value:!0}),c);var $e={};Ee($e,{AssemblyAIVoiceClient:()=>X,OmniDeskWidget:()=>ke,VoiceWidget:()=>we,initOmniDeskWidget:()=>xe});module.exports=Le($e);var r=require("react");var he=24e3,_e="wss://agents.assemblyai.com/v1/ws",Ie=`
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
`,Ae=`
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
`;async function ve(c,i,m){let y=URL.createObjectURL(new Blob([i],{type:"application/javascript"}));try{await c.audioWorklet.addModule(y)}finally{URL.revokeObjectURL(y)}return new AudioWorkletNode(c,m)}var X=class{constructor(i){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.isThinking=!1;this.callbacks=i}setThinking(i){this.isThinking!==i&&(this.isThinking=i,this.callbacks.onThinkingChange?.(i))}async start(i,m,y){try{this.callbacks.onStatusChange?.("connecting");let C=window.AudioContext||window.webkitAudioContext;this.captureCtx=new C({sampleRate:he}),this.playbackCtx=new C({sampleRate:he}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await ve(this.playbackCtx,Ae,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await ve(this.captureCtx,Ie,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let j=new URL(_e);j.searchParams.set("token",i),this.ws=new WebSocket(j.toString()),this.captureNode.port.onmessage=({data:S})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let o=new Uint8Array(S),F="";for(let W=0;W<o.length;W+=32768)F+=String.fromCharCode.apply(null,Array.from(o.subarray(W,W+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(F)}));let P=new Int16Array(S),A=0;for(let W=0;W<P.length;W+=16)A+=Math.abs(P[W]);this.userLevel=Math.min(1,A/(P.length/16)/8e3)},this.ws.onopen=()=>{let S={};m&&m.trim()?S.agent_id=m.trim():y&&y.trim()&&(S.output={voice:y.trim()}),Object.keys(S).length>0&&this.ws?.send(JSON.stringify({type:"session.update",session:S}))};let M="",R="";this.ws.onmessage=({data:S})=>{try{let o=JSON.parse(S);switch(o.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0,R="",this.setThinking(!1);break;case"transcript.user.delta":o.text&&(R=o.text,this.callbacks.onTranscript?.({who:"user",text:o.text,isFinal:!1}));break;case"transcript.user":o.text&&(R=o.text,this.callbacks.onTranscript?.({who:"user",text:o.text,isFinal:!0}),this.setThinking(!0));break;case"reply.started":M="";break;case"transcript.agent.delta":o.delta&&(this.setThinking(!1),M&&!M.endsWith(" ")&&!/^[.,!?;:%)]/.test(o.delta)?M+=" "+o.delta:M+=o.delta,this.callbacks.onTranscript?.({who:"agent",text:M,isFinal:!1}));break;case"transcript.agent":o.text&&(this.setThinking(!1),M=o.text,this.callbacks.onTranscript?.({who:"agent",text:o.text,isFinal:!0}));break;case"reply.audio":if(o.data&&this.playbackNode){let F=atob(o.data),P=new Uint8Array(F.length);for(let A=0;A<F.length;A++)P[A]=F.charCodeAt(A);this.playbackNode.port.postMessage(P.buffer,[P.buffer]),this.agentLevel=.8}break;case"reply.done":o.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:o.name||o.tool,args:o.arguments||o.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:o.name||o.tool,result:o.result});break;case"session.error":this.setThinking(!1),this.callbacks.onError?.(o.message||o.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.setThinking(!1),this.stop();break}}catch(o){console.warn("Message parsing error:",o)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(C){this.callbacks.onError?.(C.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(i){this.isMuted=i,i&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(i,m){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:i})),m&&this.ws.send(JSON.stringify({type:"reply.create",instructions:m})),!0}catch(y){return console.error("Failed to send message to agent:",y),!1}}sendEmailInput(i){return this.sendUserMessage(`My email address is ${i}`,`The caller entered their verified email address: ${i}. Acknowledge this email, verify it using verify_customer_email if needed, and complete the booking.`)}stop(){if(this.setThinking(!1),this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(i=>i.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let i=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(i)};this.animFrameId=requestAnimationFrame(i)}};var e=require("react/jsx-runtime"),Re={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function ke({host:c="",businessId:i="biz_demo_dental",agentId:m,theme:y="light",position:C="bottom-right",label:j="Talk to Receptionist",accent:M="emerald",accentColor:R,businessName:S,greeting:o,className:F,onCallStart:P,onCallEnd:A,onTranscript:W}){let[se,le]=(0,r.useState)(!1),[f,u]=(0,r.useState)(!1),[T,B]=(0,r.useState)("idle"),[H,U]=(0,r.useState)([]),[pe,de]=(0,r.useState)(0),[ge,ue]=(0,r.useState)(0),[Y,ee]=(0,r.useState)("0:00"),[te,ie]=(0,r.useState)(S||"OmniDesk Hair Salon & Studio"),[oe,z]=(0,r.useState)(!1),[q,ne]=(0,r.useState)(""),[l,V]=(0,r.useState)(!1),[ae,E]=(0,r.useState)(""),[J,b]=(0,r.useState)(""),[h,N]=(0,r.useState)(!1),g=(0,r.useRef)(null),G=(0,r.useRef)(null),v=(0,r.useRef)(0),K=(0,r.useRef)(null),Q=(0,r.useRef)(0),Z=(0,r.useRef)(!1),re=(0,r.useMemo)(()=>R||Re[M]||M||"#10b981",[M,R]),x=(0,r.useMemo)(()=>y==="dark"?!0:y==="auto"&&typeof window<"u"?window.matchMedia("(prefers-color-scheme: dark)").matches:!1,[y]);(0,r.useEffect)(()=>{G.current&&(G.current.scrollTop=G.current.scrollHeight)},[H,h]);let O=(0,r.useMemo)(()=>c?c.replace(/\/$/,""):typeof window<"u"&&window.location.origin?window.location.origin:"",[c]),me=(0,r.useCallback)(()=>{Q.current=Date.now(),ee("0:00"),K.current&&clearInterval(K.current),K.current=setInterval(()=>{let p=Date.now()-Q.current,I=Math.floor(p/1e3),k=Math.floor(I/60),$=I%60;ee(`${k}:${String($).padStart(2,"0")}`)},250)},[]),D=(0,r.useCallback)(()=>{K.current&&(clearInterval(K.current),K.current=null)},[]),fe=(0,r.useCallback)(async()=>{try{B("connecting"),Z.current=!1,z(!1),me();let I=`${O?O.replace(/\/$/,""):""}/api/token?businessId=${encodeURIComponent(i)}`,k=await fetch(I);if(!k.ok)throw new Error("Failed to initialize voice session");let $=await k.json();if($.business_name&&!S&&ie($.business_name),!$.token)throw new Error("Invalid session token payload received from host");let s=m||$.agent_id||"",t=new X({onStatusChange:a=>{if(B(a),a==="connected")v.current=Date.now(),P?.();else if(a==="idle"){if(N(!1),D(),v.current>0){let n=Math.round((Date.now()-v.current)/1e3);v.current=0,A?.(n)}}else a==="error"&&(N(!1),D())},onThinkingChange:a=>{a&&N(!0)},onTranscript:a=>{if(a.who==="user"?N(!0):a.who==="agent"&&a.text&&a.text.trim().length>0&&N(!1),U(n=>{let ce=n[n.length-1];if(ce&&ce.who===a.who&&!ce.isFinal){let ye=[...n];return ye[ye.length-1]={...ce,text:a.text,isFinal:a.isFinal??!1},ye}return[...n,{id:a.id||`${Date.now()}-${Math.random()}`,who:a.who,text:a.text,isFinal:a.isFinal??!1}]}),W?.(a),a.who==="user")(a.text.includes("@")||a.text.toLowerCase().includes(" at ")&&a.text.toLowerCase().includes(" dot "))&&(Z.current=!0,z(!1));else if(a.who==="agent"){let n=a.text.toLowerCase();if(n.includes("what is your email")||n.includes("what's your email")||n.includes("may i have your email")||n.includes("provide your email")||n.includes("can i have your email")||n.includes("could i get your email")||n.includes("could you provide your email")||n.includes("enter your email")||n.includes("spell your email")||n.includes("where can i send your confirmation")||n.includes("where should i send your confirmation")||n.includes("where can i send your calendar invite")||n.includes("where should i send your calendar invite")||n.includes("email")&&(n.includes("what")||n.includes("have")||n.includes("provide")||n.includes("give")||n.includes("tell")||n.includes("share")||n.includes("address"))){Z.current=!1,z(!0);return}if(n.includes("verified your email")||n.includes("thank you for your email")||n.includes("thank you for providing your email")||n.includes("sent a calendar invite")||n.includes("sent your confirmation")||n.includes("confirmation code is")||n.includes("i have sent")){Z.current=!0,z(!1);return}Z.current&&z(!1)}},onAudioLevel:(a,n)=>{de(a),ue(n)},onError:()=>{B("error"),D()}});g.current=t,await t.start($.token,s,$.voice)}catch{B("error"),D()}},[O,i,m,S,P,A,W,me,D]),w=(0,r.useCallback)(()=>{if(g.current&&(g.current.stop(),g.current=null),B("idle"),N(!1),de(0),ue(0),D(),z(!1),E(""),b(""),v.current>0){let p=Math.round((Date.now()-v.current)/1e3);v.current=0,A?.(p)}},[A,D]),_=(0,r.useCallback)(async p=>{p.preventDefault();let I=q.trim();if(I){V(!0),E(""),b("");try{let k=O?O.replace(/\/$/,""):"",$=await fetch(`${k}/api/tools/${encodeURIComponent(i)}/verify_customer_email`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:I})}),s=await $.json();if(!$.ok||!s.valid||!s.email){E(s.message||"Invalid email or domain has no active mail server."),V(!1);return}let t=s.email;b(`Verified: ${t}. Sent to agent.`),U(a=>[...a,{who:"user",text:`My email is ${t}`}]),g.current&&g.current.sendEmailInput(t),N(!0),Z.current=!0,ne(""),z(!1),b("")}catch(k){E(k.message||"Failed to verify email with mail server.")}finally{V(!1)}}},[q,O,i]);(0,r.useEffect)(()=>()=>{D(),g.current&&g.current.stop()},[D]);let L=C==="bottom-left",d=T==="connected";return(0,e.jsxs)("div",{className:F,style:{position:"relative",zIndex:99999},children:[(0,e.jsx)("div",{style:{position:"fixed",bottom:"20px",left:L?"20px":"auto",right:L?"auto":"20px",zIndex:99999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:(0,e.jsxs)("button",{type:"button",onClick:()=>le(!se),style:{display:"inline-flex",alignItems:"center",gap:"10px",background:x?"#18181b":"#ffffff",color:x?"#fafafa":"#09090b",border:`1px solid ${x?"#27272a":"#e4e4e7"}`,padding:"10px 18px",borderRadius:"9999px",cursor:"pointer",fontSize:"13px",fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.18)",transition:"transform 0.15s ease, background 0.15s ease"},onMouseEnter:p=>{p.currentTarget.style.transform="scale(1.02)"},onMouseLeave:p=>{p.currentTarget.style.transform="scale(1)"},children:[(0,e.jsx)("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:d?"#ef4444":re,boxShadow:`0 0 8px ${d?"#ef4444":re}`}}),(0,e.jsx)("span",{children:j}),(0,e.jsx)("span",{style:{fontSize:"11px",opacity:.6},children:"\u25B2"})]})}),se&&(0,e.jsxs)(e.Fragment,{children:[f&&(0,e.jsx)("div",{onClick:()=>u(!1),style:{position:"fixed",inset:0,background:"rgba(0, 0, 0, 0.7)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",zIndex:999998}}),(0,e.jsxs)("div",{style:{position:"fixed",bottom:f?"auto":"80px",left:f?"50%":L?"20px":"auto",right:f||L?"auto":"20px",top:f?"50%":"auto",transform:f?"translate(-50%, -50%)":"none",width:f?"calc(100vw - 40px)":"390px",maxWidth:f?"1140px":"calc(100vw - 32px)",height:f?"calc(100vh - 40px)":"560px",maxHeight:f?"900px":"calc(100vh - 100px)",background:"#ffffff",border:"1px solid #e4e4e7",borderRadius:"20px",boxShadow:f?"0 32px 64px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)":"0 24px 48px -12px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:999999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",transition:"all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"},children:[(0,e.jsx)("style",{children:`
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
            `}),(0,e.jsxs)("div",{style:{background:x?"#18181b":"#ffffff",color:x?"#ffffff":"#09090b",borderBottom:`1px solid ${x?"#27272a":"#e4e4e7"}`,padding:f?"16px 22px":"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",userSelect:"none",flexShrink:0},children:[(0,e.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"10px",minWidth:0},children:[(0,e.jsx)("div",{style:{color:x?"rgba(255,255,255,0.6)":"#71717a",display:"grid",placeItems:"center",flexShrink:0},children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("circle",{cx:"12",cy:"12",r:"1"}),(0,e.jsx)("circle",{cx:"12",cy:"5",r:"1"}),(0,e.jsx)("circle",{cx:"12",cy:"19",r:"1"})]})}),(0,e.jsx)("div",{style:{width:"28px",height:"28px",borderRadius:"50%",background:x?"rgba(255,255,255,0.15)":"#f4f4f5",display:"grid",placeItems:"center",flexShrink:0,color:x?"#ffffff":"#09090b"},children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,e.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),(0,e.jsx)("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]})}),(0,e.jsxs)("div",{style:{display:"flex",flexDirection:"column",minWidth:0},children:[(0,e.jsx)("div",{style:{fontSize:"13.5px",fontWeight:600,color:x?"#ffffff":"#09090b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},children:te}),(0,e.jsxs)("div",{style:{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"11px",color:x?"rgba(255,255,255,0.75)":"#71717a"},children:[(0,e.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:d?h?"#f59e0b":"#22c55e":T==="connecting"?"#eab308":x?"rgba(255,255,255,0.4)":"#a1a1aa",animation:h?"omnidesk-pulse-amber 1.5s infinite":"none"}}),(0,e.jsx)("span",{children:d?h?"Thinking \xB7 Checking tools...":"Live \xB7 Speaking":T==="connecting"?"Connecting...":T==="error"?"Error":"Idle \xB7 Ready"})]})]})]}),(0,e.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[(0,e.jsx)("button",{type:"button",onClick:()=>u(!f),title:f?"Exit Fullscreen":"Open Full",style:{background:x?"rgba(255,255,255,0.1)":"#f4f4f5",border:x?"1px solid rgba(255,255,255,0.15)":"1px solid #e4e4e7",borderRadius:"7px",color:x?"#ffffff":"#52525b",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:p=>p.currentTarget.style.background=x?"rgba(255,255,255,0.2)":"#e4e4e7",onMouseLeave:p=>p.currentTarget.style.background=x?"rgba(255,255,255,0.1)":"#f4f4f5",children:f?(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("polyline",{points:"4 14 10 14 10 20"}),(0,e.jsx)("polyline",{points:"20 10 14 10 14 4"}),(0,e.jsx)("line",{x1:"14",y1:"10",x2:"21",y2:"3"}),(0,e.jsx)("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]}):(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("polyline",{points:"15 3 21 3 21 9"}),(0,e.jsx)("polyline",{points:"9 21 3 21 3 15"}),(0,e.jsx)("line",{x1:"21",y1:"3",x2:"14",y2:"10"}),(0,e.jsx)("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]})}),(0,e.jsx)("button",{type:"button",onClick:()=>{d&&w(),le(!1)},title:"Close Widget",style:{background:x?"rgba(255,255,255,0.1)":"#f4f4f5",border:x?"1px solid rgba(255,255,255,0.15)":"1px solid #e4e4e7",borderRadius:"7px",color:x?"#ffffff":"#52525b",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:p=>p.currentTarget.style.background=x?"rgba(255,255,255,0.2)":"#e4e4e7",onMouseLeave:p=>p.currentTarget.style.background=x?"rgba(255,255,255,0.1)":"#f4f4f5",children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("line",{x1:"18",y1:"6",x2:"6",y2:"18"}),(0,e.jsx)("line",{x1:"6",y1:"6",x2:"18",y2:"18"})]})})]})]}),(0,e.jsxs)("div",{ref:G,style:{flex:1,minHeight:0,padding:"16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"12px",background:"#ffffff"},children:[H.length===0&&(0,e.jsxs)("div",{style:{margin:"auto",textAlign:"center",padding:"10px 18px",background:"#f4f4f5",border:"1px solid #e4e4e7",color:"#52525b",borderRadius:"12px",fontSize:"12.5px",fontWeight:500,display:"inline-flex",alignItems:"center",gap:"8px",alignSelf:"center"},children:[(0,e.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:d?"#22c55e":"#a1a1aa",display:"inline-block"}}),(0,e.jsx)("span",{children:d?"Connected \xB7 Speak to our receptionist":T==="connecting"?"Connecting to receptionist...":"Start a call to talk to our receptionist"})]}),H.map((p,I)=>{let k=p.who==="user";return(0,e.jsx)("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:k?"flex-end":"flex-start"},children:(0,e.jsxs)("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[!k&&(0,e.jsx)("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,e.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),(0,e.jsx)("div",{style:{padding:"10px 14px",borderRadius:k?"14px 14px 2px 14px":"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:k?"#18181b":"#f4f4f5",color:k?"#ffffff":"#09090b",boxShadow:"0 1px 2px rgba(0,0,0,0.04)"},children:p.text})]})},I)}),h&&(0,e.jsx)("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:"flex-start"},children:(0,e.jsxs)("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[(0,e.jsx)("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,e.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),(0,e.jsxs)("div",{style:{padding:"10px 14px",borderRadius:"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:"#f4f4f5",color:"#71717a",boxShadow:"0 1px 2px rgba(0,0,0,0.04)",display:"inline-flex",alignItems:"center",gap:"5px",minHeight:"38px"},title:"Agent is thinking and processing...",children:[(0,e.jsx)("span",{className:"omnidesk-motion-dot omnidesk-dot-1"}),(0,e.jsx)("span",{className:"omnidesk-motion-dot omnidesk-dot-2"}),(0,e.jsx)("span",{className:"omnidesk-motion-dot omnidesk-dot-3"})]})]})})]}),oe&&d&&(0,e.jsxs)("div",{style:{padding:"11px 16px",background:"#f0fdf4",borderTop:"1px solid #bbf7d0",display:"flex",flexDirection:"column",gap:"7px",flexShrink:0},children:[(0,e.jsxs)("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"},children:[(0,e.jsxs)("span",{style:{fontSize:"11px",fontWeight:700,color:"#15803d",textTransform:"uppercase",letterSpacing:"0.04em",display:"inline-flex",alignItems:"center",gap:"6px"},children:[(0,e.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:"#22c55e",display:"inline-block"}}),"Email Requested by Agent \u2022 Auto Verification"]}),(0,e.jsx)("button",{type:"button",onClick:()=>z(!1),style:{background:"none",border:"none",color:"#15803d",cursor:"pointer",fontSize:"12px",fontWeight:700,padding:"1px 4px"},children:"\u2715"})]}),(0,e.jsxs)("form",{onSubmit:_,style:{display:"flex",gap:"6px"},children:[(0,e.jsx)("input",{type:"email",autoFocus:!0,value:q,onChange:p=>{ne(p.target.value),E("")},placeholder:"Enter your real email (e.g. name@gmail.com)",disabled:l,required:!0,style:{flex:1,fontSize:"12.5px",padding:"7px 11px",borderRadius:"7px",border:ae?"1.5px solid #ef4444":"1px solid #86efac",background:"#ffffff",color:"#09090b",outline:"none"}}),(0,e.jsx)("button",{type:"submit",disabled:l||!q.trim(),style:{background:"#16a34a",color:"#ffffff",border:"none",padding:"7px 14px",borderRadius:"7px",fontSize:"12px",fontWeight:600,cursor:l?"wait":"pointer",opacity:l?.7:1},children:l?"...":"Verify & Send"})]}),ae&&(0,e.jsxs)("div",{style:{fontSize:"11px",color:"#ef4444",fontWeight:500},children:["\u26A0\uFE0F ",ae]}),J&&(0,e.jsxs)("div",{style:{fontSize:"11px",color:"#15803d",fontWeight:600},children:["\u2713 ",J]})]}),(0,e.jsxs)("div",{style:{padding:"12px 16px",borderTop:"1px solid #e4e4e7",background:"#fafafa",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0},children:[(0,e.jsxs)("button",{type:"button",onClick:d?w:fe,disabled:T==="connecting",style:{display:"inline-flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:d?"#dc2626":"#000000",color:"#ffffff",borderRadius:"10px",border:"none",fontSize:"13px",fontWeight:600,cursor:T==="connecting"?"not-allowed":"pointer",transition:"all 0.15s ease"},children:[(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,e.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),(0,e.jsx)("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]}),(0,e.jsx)("span",{children:d?"End Voice Call":T==="connecting"?"Connecting...":"Start Voice Call"})]}),(0,e.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[d&&(0,e.jsx)("div",{style:{display:"flex",alignItems:"center",gap:"2.5px",height:"14px"},children:[12,8,14,6,10].map((p,I)=>(0,e.jsx)("span",{style:{width:"2.5px",height:`${Math.max(4,Math.min(14,Math.round(p*(.35+Math.max(pe,ge)*1.5))))}px`,background:"#000000",borderRadius:"1px",transition:"height 0.12s ease"}},I))}),(0,e.jsx)("span",{style:{fontFamily:"var(--mono, monospace)",fontSize:"12px",fontWeight:600,padding:"3px 8px",borderRadius:"6px",background:d?"#000000":"#f4f4f5",color:d?"#ffffff":"#71717a"},children:Y})]})]})]})]})]})}var we=ke;var We={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function xe(c={}){if(typeof window>"u")return;let{host:i,businessId:m="biz_demo_dental",agentId:y,theme:C="light",position:j="bottom-right",label:M="Talk to Receptionist",accent:R="emerald",accentColor:S,businessName:o,greeting:F,onCallStart:P,onCallEnd:A,onTranscript:W}=c,se=S||We[R]||R||"#10b981",le=document.getElementById("omnidesk-voice-widget-root");le&&le.remove();let f=document.createElement("div");f.id="omnidesk-voice-widget-root",f.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let u=C==="dark"||C==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,T=null,B="idle",H=0,U=null,pe=!1,de=!1,ge=0,ue=0,Y=!1,ee=null,te=null,ie=!1,oe=j==="bottom-left",z=document.createElement("div");z.style.cssText=`
    position: fixed; bottom: 20px; ${oe?"left: 20px;":"right: 20px;"};
    z-index: 999999;
  `;let q=document.createElement("button");q.style.cssText=`
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${u?"#18181b":"#ffffff"}; color: ${u?"#fafafa":"#09090b"};
    border: 1px solid ${u?"#27272a":"#e4e4e7"};
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `,q.innerHTML=`
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${se};box-shadow:0 0 8px ${se};display:inline-block;"></span>
    <span>${M}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,z.appendChild(q);let ne=document.createElement("div");ne.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,ne.onclick=()=>re(!1);let l=document.createElement("div");l.style.cssText=`
    position: fixed; bottom: 80px; ${oe?"left: 20px;":"right: 20px;"};
    width: 390px; max-width: calc(100vw - 32px); height: 560px; max-height: calc(100vh - 100px);
    background: #ffffff; border: 1px solid #e4e4e7;
    border-radius: 20px; box-shadow: 0 24px 48px -12px rgba(0,0,0,0.22);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  `;let V=document.createElement("div");V.style.cssText=`
    background: ${u?"#18181b":"#ffffff"}; color: ${u?"#ffffff":"#09090b"};
    border-bottom: 1px solid ${u?"#27272a":"#e4e4e7"};
    padding: 13px 18px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; user-select: none; flex-shrink: 0;
  `,V.innerHTML=`
    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
      <div style="color: ${u?"rgba(255,255,255,0.6)":"#71717a"}; display: grid; place-items: center; flex-shrink: 0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle>
        </svg>
      </div>
      <div style="width: 28px; height: 28px; border-radius: 50%; background: ${u?"rgba(255,255,255,0.15)":"#f4f4f5"}; display: grid; place-items: center; flex-shrink: 0; color: ${u?"#ffffff":"#09090b"};">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
        </svg>
      </div>
      <div style="display: flex; flex-direction: column; min-width: 0;">
        <div id="omnidesk-biz-title" style="font-size: 13.5px; font-weight: 600; color: ${u?"#ffffff":"#09090b"}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${o||"OmniDesk Hair Salon & Studio"}
        </div>
        <div style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: ${u?"rgba(255,255,255,0.75)":"#71717a"}; white-space: nowrap;">
          <span id="omnidesk-status-dot" style="width: 6px; height: 6px; border-radius: 50%; background: ${u?"rgba(255,255,255,0.4)":"#a1a1aa"}; display: inline-block;"></span>
          <span id="omnidesk-status-text">Idle \xB7 Ready</span>
        </div>
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 8px;">
      <button id="omnidesk-expand-btn" style="background: ${u?"rgba(255,255,255,0.1)":"#f4f4f5"}; border: 1px solid ${u?"rgba(255,255,255,0.15)":"#e4e4e7"}; border-radius: 7px; color: ${u?"#ffffff":"#52525b"}; width: 30px; height: 30px; cursor: pointer; display: grid; place-items: center;" title="Open Full">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
      </button>
      <button id="omnidesk-close-btn" style="background: ${u?"rgba(255,255,255,0.1)":"#f4f4f5"}; border: 1px solid ${u?"rgba(255,255,255,0.15)":"#e4e4e7"}; border-radius: 7px; color: ${u?"#ffffff":"#52525b"}; width: 30px; height: 30px; cursor: pointer; display: grid; place-items: center;" title="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `;let ae=document.createElement("style");ae.textContent=`
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
  `,f.appendChild(ae);let E=document.createElement("div");E.style.cssText=`
    flex: 1; min-height: 0; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 12px; background: #ffffff;
  `;let J=document.createElement("div");J.id="omnidesk-placeholder-banner",J.style.cssText=`
    margin: auto; text-align: center; padding: 10px 18px;
    background: #f4f4f5; border: 1px solid #e4e4e7; color: #52525b;
    border-radius: 12px; font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px; align-self: center;
  `,J.innerHTML=`
    <span style="width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block;"></span>
    <span>Start a call to talk to our receptionist</span>
  `,E.appendChild(J);let b=document.createElement("div");b.id="omnidesk-thinking-bubble",b.style.cssText=`
    display: none; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;
  `,b.innerHTML=`
    <div style="display: flex; align-items: flex-start; gap: 8px;">
      <div style="width: 24px; height: 24px; border-radius: 50%; background: #18181b; display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        </svg>
      </div>
      <div style="padding: 10px 14px; border-radius: 14px 14px 14px 2px; font-size: 13px; line-height: 1.45; background: ${u?"#18181b":"#f4f4f5"}; color: ${u?"#a1a1aa":"#71717a"}; border: ${u?"1px solid #27272a":"none"}; boxShadow: 0 1px 2px rgba(0,0,0,0.04); display: inline-flex; align-items: center; gap: 5px; min-height: 38px;" title="Agent is thinking and processing...">
        <span class="omnidesk-motion-dot omnidesk-dot-1"></span>
        <span class="omnidesk-motion-dot omnidesk-dot-2"></span>
        <span class="omnidesk-motion-dot omnidesk-dot-3"></span>
      </div>
    </div>
  `,E.appendChild(b);let h=document.createElement("div");h.id="omnidesk-email-bar",h.style.cssText=`
    padding: 11px 16px; background: #f0fdf4; border-top: 1px solid #bbf7d0;
    display: none; flex-direction: column; gap: 7px; flex-shrink: 0;
  `,h.innerHTML=`
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
  `;let N=document.createElement("div");N.style.cssText=`
    padding: 12px 16px; border-top: 1px solid #e4e4e7;
    background: #fafafa; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  `;let g=document.createElement("button");g.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: #000000; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s ease;
  `,g.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let G=document.createElement("div");G.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let v=document.createElement("span");v.id="omnidesk-timer",v.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,v.innerText="0:00",G.appendChild(v),N.appendChild(g),N.appendChild(G),l.appendChild(V),l.appendChild(E),l.appendChild(h),l.appendChild(N),f.appendChild(z),f.appendChild(ne),f.appendChild(l),document.body.appendChild(f);function K(){H=Date.now(),v.innerText="0:00",v.style.background="#000000",v.style.color="#ffffff",U&&clearInterval(U),U=setInterval(()=>{let w=Date.now()-H,_=Math.floor(w/1e3),L=Math.floor(_/60),d=_%60;v.innerText=`${L}:${String(d).padStart(2,"0")}`},250)}function Q(){U&&(clearInterval(U),U=null),v.style.background="#f4f4f5",v.style.color="#71717a",v.innerText="0:00"}function Z(w){pe=w,l.style.display=w?"flex":"none"}function re(w){de=w,ne.style.display=w?"block":"none",w?(l.style.top="50%",l.style.left="50%",l.style.bottom="auto",l.style.right="auto",l.style.transform="translate(-50%, -50%)",l.style.width="calc(100vw - 40px)",l.style.maxWidth="1140px",l.style.height="calc(100vh - 40px)",l.style.maxHeight="900px"):(l.style.top="auto",l.style.left=oe?"20px":"auto",l.style.right=oe?"auto":"20px",l.style.bottom="80px",l.style.transform="none",l.style.width="390px",l.style.maxWidth="calc(100vw - 32px)",l.style.height="560px",l.style.maxHeight="calc(100vh - 100px)")}q.onclick=()=>Z(!pe),V.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{Z(!1),re(!1)}),V.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{re(!de)});let x=h.querySelector("#omnidesk-email-form"),O=h.querySelector("#omnidesk-email-input");h.querySelector("#omnidesk-email-close-btn").addEventListener("click",()=>{h.style.display="none"}),x.addEventListener("submit",w=>{w.preventDefault();let _=O.value.trim();if(!_||!_.includes("@"))return;T&&T.sendEmailInput(_),Y=!0,h.style.display="none",O.value="",J.style.display="none";let L=document.createElement("div");L.style.cssText=`
      display: flex; flex-direction: column; gap: 4px; max-width: 88%;
      align-self: flex-end;
    `;let d=document.createElement("div");d.style.cssText=`
      padding: 10px 14px; border-radius: 14px 14px 2px 14px;
      font-size: 13px; line-height: 1.45;
      background: #18181b; color: #ffffff;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    `,d.innerText=`My email is ${_}`,L.appendChild(d),E.insertBefore(L,b),b.style.display="flex",E.scrollTop=E.scrollHeight,ee="user",te=d,ie=!0});async function D(){Y=!1,h.style.display="none",b.style.display="none",ee=null,te=null,ie=!1;let w=V.querySelector("#omnidesk-status-text"),_=V.querySelector("#omnidesk-status-dot"),L=g.querySelector("#omnidesk-btn-text");w.innerText="Connecting...",_.style.background="#eab308",L.innerText="Connecting...",g.disabled=!0,K();try{let d=i;if(!d&&typeof document<"u"){let s=document.querySelector("script[src*='widget.js']");if(s&&s.src&&s.src.startsWith("http"))try{d=new URL(s.src).origin}catch{}}!d&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(d=window.location.origin);let p=(d||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),I=await fetch(`${p}/api/token?businessId=${encodeURIComponent(m)}`);if(!I.ok)throw new Error(`Failed to get session token (${I.status})`);let k=await I.json();if(k.business_name&&!o){let s=V.querySelector("#omnidesk-biz-title");s&&(s.innerText=k.business_name)}let $=y||k.agent_id||"";T=new X({onStatusChange:s=>{if(B=s,s==="connected")w.innerText="Live \xB7 Speaking",_.style.background="#22c55e",L.innerText="End Voice Call",g.style.background="#dc2626",g.disabled=!1,H=Date.now(),P?.();else if(s==="idle"&&(w.innerText="Idle \xB7 Ready",_.style.background=u?"rgba(255,255,255,0.4)":"#a1a1aa",L.innerText="Start Voice Call",g.style.background="#000000",g.disabled=!1,h.style.display="none",b.style.display="none",Q(),H>0)){let t=Math.round((Date.now()-H)/1e3);H=0,A?.(t)}},onThinkingChange:s=>{s&&(b.style.display="flex",E.scrollTop=E.scrollHeight)},onTranscript:s=>{if(J.style.display="none",s.who==="user")s.isFinal&&(b.style.display="flex"),(s.text.includes("@")||s.text.toLowerCase().includes(" at ")&&s.text.toLowerCase().includes(" dot "))&&(Y=!0,h.style.display="none");else if(s.who==="agent"){s.text&&s.text.trim().length>0&&(b.style.display="none");let t=s.text.toLowerCase();t.includes("what is your email")||t.includes("what's your email")||t.includes("may i have your email")||t.includes("provide your email")||t.includes("can i have your email")||t.includes("could i get your email")||t.includes("could you provide your email")||t.includes("enter your email")||t.includes("spell your email")||t.includes("where can i send your confirmation")||t.includes("where should i send your confirmation")||t.includes("where can i send your calendar invite")||t.includes("where should i send your calendar invite")||t.includes("email")&&(t.includes("what")||t.includes("have")||t.includes("provide")||t.includes("give")||t.includes("tell")||t.includes("share")||t.includes("address"))?(Y=!1,h.style.display="flex",setTimeout(()=>O.focus(),60)):t.includes("verified your email")||t.includes("thank you for your email")||t.includes("thank you for providing your email")||t.includes("sent a calendar invite")||t.includes("sent your confirmation")||t.includes("confirmation code is")||t.includes("i have sent")?(Y=!0,h.style.display="none"):Y&&(h.style.display="none")}if(ee===s.who&&te&&!ie)te.innerText=s.text,ie=!!s.isFinal;else{let t=document.createElement("div"),a=s.who==="user";t.style.cssText=`
              display: flex; flex-direction: column; gap: 4px; max-width: 88%;
              align-self: ${a?"flex-end":"flex-start"};
            `;let n=document.createElement("div");n.style.cssText=`
              padding: 10px 14px; border-radius: ${a?"14px 14px 2px 14px":"14px 14px 14px 2px"};
              font-size: 13px; line-height: 1.45;
              background: ${a?"#18181b":"#f4f4f5"};
              color: ${a?"#ffffff":"#09090b"};
              box-shadow: 0 1px 2px rgba(0,0,0,0.04);
            `,n.innerText=s.text,t.appendChild(n),E.insertBefore(t,b),ee=s.who,te=n,ie=!!s.isFinal}E.scrollTop=E.scrollHeight,W?.(s)},onAudioLevel:(s,t)=>{ge=s,ue=t},onError:()=>{w.innerText="Error",_.style.background="#ef4444",L.innerText="Start Voice Call",g.style.background="#000000",g.disabled=!1,h.style.display="none",b.style.display="none",Q()}}),await T.start(k.token,$,k.voice)}catch(d){console.error("[OmniDesk Voice Widget Error]:",d),w.innerText="Error",_.style.background="#ef4444",L.innerText="Start Voice Call",g.style.background="#000000",g.disabled=!1,h.style.display="none",b.style.display="none",Q()}}function fe(){T&&(T.stop(),T=null),B="idle",h.style.display="none",b.style.display="none",Q()}return g.onclick=()=>{B==="connected"?fe():B==="idle"&&D()},{destroy:()=>{Q(),T&&T.stop(),f.remove()},startCall:D,endCall:fe}}if(typeof document<"u"){let c=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(c){let i,m=c.src||"";if(m&&m.startsWith("http"))try{i=new URL(m).origin}catch{}let y=c.getAttribute("data-business-id")||void 0,C=c.getAttribute("data-agent")||void 0,j=c.getAttribute("data-theme")||"dark",M=c.getAttribute("data-accent")||"emerald",R=c.getAttribute("data-position")||"bottom-right",S=c.getAttribute("data-label")||void 0,o=c.getAttribute("data-host")||i||"https://omni-desk-rho.vercel.app",F=c.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{xe({businessId:y,agentId:C,theme:j,accent:M,position:R,label:S,host:o,greeting:F})}):xe({businessId:y,agentId:C,theme:j,accent:M,position:R,label:S,host:o,greeting:F})}}0&&(module.exports={AssemblyAIVoiceClient,OmniDeskWidget,VoiceWidget,initOmniDeskWidget});
//# sourceMappingURL=index.js.map