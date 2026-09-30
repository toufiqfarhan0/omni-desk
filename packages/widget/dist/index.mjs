import{useState as Y,useRef as ne,useEffect as Le,useCallback as ge,useMemo as Te}from"react";var ve=24e3,_e="wss://agents.assemblyai.com/v1/ws",Ie=`
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${ve};
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
`,Re=`
  class PlaybackProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ring = new Float32Array(sampleRate * 30);
      this._writePos = 0;
      this._readPos = 0;
      this._available = 0;
      this._step = ${ve} / sampleRate;
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
`;async function Ee(y,c,w){let T=URL.createObjectURL(new Blob([c],{type:"application/javascript"}));try{await y.audioWorklet.addModule(T)}finally{URL.revokeObjectURL(T)}return new AudioWorkletNode(y,w)}var le=class{constructor(c){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.isThinking=!1;this.callbacks=c}setThinking(c){this.isThinking!==c&&(this.isThinking=c,this.callbacks.onThinkingChange?.(c))}async start(c,w,T){try{this.callbacks.onStatusChange?.("connecting");let B=window.AudioContext||window.webkitAudioContext;this.captureCtx=new B({sampleRate:ve}),this.playbackCtx=new B({sampleRate:ve}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await Ee(this.playbackCtx,Re,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0}}),this.captureNode=await Ee(this.captureCtx,Ie,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let Q=new URL(_e);Q.searchParams.set("token",c),this.ws=new WebSocket(Q.toString()),this.captureNode.port.onmessage=({data:C})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let a=new Uint8Array(C),R="";for(let N=0;N<a.length;N+=32768)R+=String.fromCharCode.apply(null,Array.from(a.subarray(N,N+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(R)}));let H=new Int16Array(C),W=0;for(let N=0;N<H.length;N+=16)W+=Math.abs(H[N]);this.userLevel=Math.min(1,W/(H.length/16)/8e3)},this.ws.onopen=()=>{let C={};w&&w.trim()?C.agent_id=w.trim():T&&T.trim()&&(C.output={voice:T.trim()}),Object.keys(C).length>0&&this.ws?.send(JSON.stringify({type:"session.update",session:C}))};let E="",z="";this.ws.onmessage=({data:C})=>{try{let a=JSON.parse(C);switch(a.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0,z="",this.setThinking(!1);break;case"transcript.user.delta":a.text&&(z=a.text,this.callbacks.onTranscript?.({who:"user",text:a.text,isFinal:!1}));break;case"transcript.user":a.text&&(z=a.text,this.callbacks.onTranscript?.({who:"user",text:a.text,isFinal:!0}),this.setThinking(!0));break;case"reply.started":E="";break;case"transcript.agent.delta":a.delta&&(this.setThinking(!1),E&&!E.endsWith(" ")&&!/^[.,!?;:%)]/.test(a.delta)?E+=" "+a.delta:E+=a.delta,this.callbacks.onTranscript?.({who:"agent",text:E,isFinal:!1}));break;case"transcript.agent":a.text&&(this.setThinking(!1),E=a.text,this.callbacks.onTranscript?.({who:"agent",text:a.text,isFinal:!0}));break;case"reply.audio":if(a.data&&this.playbackNode){let R=atob(a.data),H=new Uint8Array(R.length);for(let W=0;W<R.length;W++)H[W]=R.charCodeAt(W);this.playbackNode.port.postMessage(H.buffer,[H.buffer]),this.agentLevel=.8}break;case"reply.done":a.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:a.name||a.tool,args:a.arguments||a.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:a.name||a.tool,result:a.result});break;case"session.error":this.setThinking(!1),this.callbacks.onError?.(a.message||a.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.setThinking(!1),this.stop();break}}catch(a){console.warn("Message parsing error:",a)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(B){this.callbacks.onError?.(B.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(c){this.isMuted=c,c&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(c,w){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:c})),w&&this.ws.send(JSON.stringify({type:"reply.create",instructions:w})),!0}catch(T){return console.error("Failed to send message to agent:",T),!1}}sendEmailInput(c){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:`My email address is ${c}`})),this.ws.send(JSON.stringify({type:"reply.create"})),!0}catch(w){return console.error("Failed to send email to agent:",w),!1}}stop(){if(this.setThinking(!1),this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(c=>c.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let c=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(c)};this.animFrameId=requestAnimationFrame(c)}};import{Fragment as ze,jsx as n,jsxs as p}from"react/jsx-runtime";var We={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function $e({host:y="",businessId:c="biz_demo_dental",agentId:w,theme:T="light",position:B="bottom-right",label:Q="Talk to Receptionist",accent:E="emerald",accentColor:z,businessName:C,greeting:a,className:R,onCallStart:H,onCallEnd:W,onTranscript:N}){let[x,ue]=Y(!1),[m,o]=Y(!1),[b,O]=Y("idle"),[J,X]=Y([]),[me,fe]=Y(0),[Ce,ye]=Y(0),[Se,te]=Y("0:00"),[j,ie]=Y(C||"OmniDesk Hair Salon & Studio"),[ee,M]=Y(!1),[U,de]=Y(""),[Z,V]=Y(!1),d=ne(null),$=ne(null),G=ne(0),k=ne(null),K=ne(0),S=ne(!1),h=ne(!1),F=ne(!1),r=Te(()=>z||We[E]||E||"#10b981",[E,z]),s=Te(()=>T==="dark"?!0:T==="auto"&&typeof window<"u"?window.matchMedia("(prefers-color-scheme: dark)").matches:!1,[T]);Le(()=>{$.current&&($.current.scrollTop=$.current.scrollHeight)},[J,Z]);let A=Te(()=>y?y.replace(/\/$/,""):typeof window<"u"&&window.location.origin?window.location.origin:"",[y]),he=ge(()=>{K.current=Date.now(),te("0:00"),k.current&&clearInterval(k.current),k.current=setInterval(()=>{let f=Date.now()-K.current,L=Math.floor(f/1e3),I=Math.floor(L/60),q=L%60;te(`${I}:${String(q).padStart(2,"0")}`)},250)},[]),P=ge(()=>{k.current&&(clearInterval(k.current),k.current=null)},[]),_=ge(async()=>{try{O("connecting"),S.current=!1,h.current=!1,F.current=!1,M(!1),he();let L=`${A?A.replace(/\/$/,""):""}/api/token?businessId=${encodeURIComponent(c)}`,I=await fetch(L);if(!I.ok)throw new Error("Failed to initialize voice session");let q=await I.json();if(q.business_name&&!C&&ie(q.business_name),!q.token)throw new Error("Invalid session token payload received from host");let ke=w||q.agent_id||"",u=new le({onStatusChange:i=>{if(O(i),i==="connected")G.current=Date.now(),H?.();else if(i==="idle"){if(V(!1),P(),G.current>0){let e=Math.round((Date.now()-G.current)/1e3);G.current=0,W?.(e)}}else i==="error"&&(V(!1),P())},onThinkingChange:i=>{i&&V(!0)},onTranscript:i=>{if(i.who==="user"?V(!0):i.who==="agent"&&i.text&&i.text.trim().length>0&&V(!1),X(e=>{let g=e[e.length-1];if(g&&g.who===i.who&&!g.isFinal){let ce=[...e];return ce[ce.length-1]={...g,text:i.text,isFinal:i.isFinal??!1},ce}return[...e,{id:i.id||`${Date.now()}-${Math.random()}`,who:i.who,text:i.text,isFinal:i.isFinal??!1}]}),N?.(i),i.who==="user"){let e=i.text.toLowerCase();(e==="no"||e.startsWith("no ")||e.includes("no,")||e.includes("wrong")||e.includes("incorrect")||e.includes("change my email")||e.includes("different email"))&&(F.current=!1),(i.text.includes("@")||e.includes(" at ")&&e.includes(" dot ")||e.includes("gmail.com")||e.includes("yahoo.com")||e.includes("outlook.com")||e.includes("hotmail.com")||e.includes("icloud.com"))&&(M(!1),F.current=!0)}else if(i.who==="agent"){let e=i.text.toLowerCase();if(e.includes("confirmation code is")||e.includes("booking is confirmed")||e.includes("scheduled your appointment")||e.includes("all set, your appointment")||e.includes("sent your confirmation")&&(e.includes("code")||e.includes("calendar invite"))||e.includes("sent a calendar invite")&&(e.includes("code")||e.includes("all set"))){h.current=!0,F.current=!1,M(!1);return}if(h.current){M(!1);return}if(e.includes("confirm with yes or no")||e.includes("yes or no")||e.includes("is that correct")||e.includes("is that right")){F.current=!0,M(!1);return}e.includes("what is your email")||e.includes("what's your email")||e.includes("whats your email")||e.includes("may i have your email")||e.includes("can i have your email")||e.includes("could i have your email")||e.includes("could i get your email")||e.includes("could you provide your email")||e.includes("can you provide your email")||e.includes("provide your email")||e.includes("enter your email")||e.includes("spell your email")||e.includes("share your email")||e.includes("need your email")||e.includes("what email")||e.includes("which email")||e.includes("where can i send your confirmation")||e.includes("where should i send your confirmation")||e.includes("where can i send your calendar")||e.includes("where should i send your calendar")||e.includes("email")&&(e.includes("what is")||e.includes("what's")||e.includes("whats")||e.includes("may i have")||e.includes("can i have")||e.includes("could i have")||e.includes("may i get")||e.includes("could i get")||e.includes("can you provide")||e.includes("could you provide")||e.includes("provide")||e.includes("give me")||e.includes("tell me")||e.includes("share")||e.includes("best email")||e.includes("your email")||e.includes("send your calendar invite")||e.includes("send your confirmation")||e.includes("send a calendar invite")||e.includes("send the calendar invite")||e.includes("send the confirmation")||e.includes("send a confirmation")||e.includes("so i can send")||e.includes("to send your"))?(F.current=!1,M(!0)):i.isFinal&&!h.current&&!F.current&&M(!1)}},onAudioLevel:(i,e)=>{fe(i),ye(e)},onError:()=>{O("error"),P()}});d.current=u,await u.start(q.token,ke,q.voice)}catch{O("error"),P()}},[A,c,w,C,H,W,N,he,P]),be=ge(()=>{if(d.current&&(d.current.stop(),d.current=null),O("idle"),V(!1),fe(0),ye(0),P(),h.current=!1,F.current=!1,M(!1),G.current>0){let f=Math.round((Date.now()-G.current)/1e3);G.current=0,W?.(f)}},[W,P]),se=ge(f=>{f.preventDefault();let L=U.trim();L&&(X(I=>[...I,{who:"user",text:`My email is ${L}`,isFinal:!0}]),d.current&&d.current.sendEmailInput(L),V(!0),F.current=!0,de(""),M(!1))},[U]);Le(()=>()=>{P(),d.current&&d.current.stop()},[P]);let oe=B==="bottom-left",v=b==="connected";return p("div",{className:R,style:{position:"relative",zIndex:99999},children:[n("div",{style:{position:"fixed",bottom:"20px",left:oe?"20px":"auto",right:oe?"auto":"20px",zIndex:99999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:p("button",{type:"button",onClick:()=>ue(!x),style:{display:"inline-flex",alignItems:"center",gap:"10px",background:s?"#18181b":"#ffffff",color:s?"#fafafa":"#09090b",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,padding:"10px 18px",borderRadius:"9999px",cursor:"pointer",fontSize:"13px",fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.18)",transition:"transform 0.15s ease, background 0.15s ease"},onMouseEnter:f=>{f.currentTarget.style.transform="scale(1.02)"},onMouseLeave:f=>{f.currentTarget.style.transform="scale(1)"},children:[n("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:v?"#ef4444":r,boxShadow:`0 0 8px ${v?"#ef4444":r}`}}),n("span",{children:Q}),n("span",{style:{fontSize:"11px",opacity:.6},children:"\u25B2"})]})}),x&&p(ze,{children:[m&&n("div",{onClick:()=>o(!1),style:{position:"fixed",inset:0,background:"rgba(0, 0, 0, 0.7)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",zIndex:999998}}),p("div",{style:{position:"fixed",bottom:m?"auto":"80px",left:m?"50%":oe?"20px":"auto",right:m||oe?"auto":"20px",top:m?"50%":"auto",transform:m?"translate(-50%, -50%)":"none",width:m?"calc(100vw - 40px)":"390px",maxWidth:m?"1140px":"calc(100vw - 32px)",height:m?"calc(100vh - 40px)":"560px",maxHeight:m?"900px":"calc(100vh - 100px)",background:s?"#09090b":"#ffffff",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,borderRadius:"20px",boxShadow:m?"0 32px 64px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)":"0 24px 48px -12px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:999999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",transition:"all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"},children:[n("style",{children:`
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
            `}),p("div",{style:{background:s?"#18181b":"#ffffff",color:s?"#ffffff":"#09090b",borderBottom:`1px solid ${s?"#27272a":"#e4e4e7"}`,padding:m?"16px 22px":"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",userSelect:"none",flexShrink:0},children:[p("div",{style:{display:"flex",alignItems:"center",gap:"10px",minWidth:0},children:[n("div",{style:{color:s?"rgba(255,255,255,0.6)":"#71717a",display:"grid",placeItems:"center",flexShrink:0},children:p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[n("circle",{cx:"12",cy:"12",r:"1"}),n("circle",{cx:"12",cy:"5",r:"1"}),n("circle",{cx:"12",cy:"19",r:"1"})]})}),n("div",{style:{width:"28px",height:"28px",borderRadius:"50%",background:s?"rgba(255,255,255,0.15)":r==="#18181b"?"rgba(24,24,27,0.08)":`${r}18`,display:"grid",placeItems:"center",flexShrink:0,color:s?"#ffffff":r==="#18181b"?"#09090b":r},children:p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[n("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),n("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),n("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]})}),p("div",{style:{display:"flex",flexDirection:"column",minWidth:0},children:[n("div",{style:{fontSize:"13.5px",fontWeight:600,color:s?"#ffffff":"#09090b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},children:j}),p("div",{style:{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"11px",color:s?"rgba(255,255,255,0.75)":"#71717a"},children:[n("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:v?Z?"#f59e0b":"#22c55e":b==="connecting"?"#eab308":s?"rgba(255,255,255,0.4)":"#a1a1aa",animation:Z?"omnidesk-pulse-amber 1.5s infinite":"none"}}),n("span",{children:v?Z?"Thinking \xB7 Checking tools...":"Live \xB7 Speaking":b==="connecting"?"Connecting...":b==="error"?"Error":"Idle \xB7 Ready"})]})]})]}),p("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[n("button",{type:"button",onClick:()=>o(!m),title:m?"Exit Fullscreen":"Open Full",style:{background:s?"rgba(255,255,255,0.1)":"#f4f4f5",border:s?"1px solid rgba(255,255,255,0.15)":"1px solid #e4e4e7",borderRadius:"7px",color:s?"#ffffff":"#52525b",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:f=>f.currentTarget.style.background=s?"rgba(255,255,255,0.2)":"#e4e4e7",onMouseLeave:f=>f.currentTarget.style.background=s?"rgba(255,255,255,0.1)":"#f4f4f5",children:m?p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[n("polyline",{points:"4 14 10 14 10 20"}),n("polyline",{points:"20 10 14 10 14 4"}),n("line",{x1:"14",y1:"10",x2:"21",y2:"3"}),n("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]}):p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[n("polyline",{points:"15 3 21 3 21 9"}),n("polyline",{points:"9 21 3 21 3 15"}),n("line",{x1:"21",y1:"3",x2:"14",y2:"10"}),n("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]})}),n("button",{type:"button",onClick:()=>{v&&be(),ue(!1)},title:"Close Widget",style:{background:s?"rgba(255,255,255,0.1)":"#f4f4f5",border:s?"1px solid rgba(255,255,255,0.15)":"1px solid #e4e4e7",borderRadius:"7px",color:s?"#ffffff":"#52525b",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:f=>f.currentTarget.style.background=s?"rgba(255,255,255,0.2)":"#e4e4e7",onMouseLeave:f=>f.currentTarget.style.background=s?"rgba(255,255,255,0.1)":"#f4f4f5",children:p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[n("line",{x1:"18",y1:"6",x2:"6",y2:"18"}),n("line",{x1:"6",y1:"6",x2:"18",y2:"18"})]})})]})]}),p("div",{ref:$,style:{flex:1,minHeight:0,padding:"16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"12px",background:s?"#09090b":"#ffffff"},children:[J.length===0&&p("div",{style:{margin:"auto",textAlign:"center",padding:"10px 18px",background:s?"#18181b":"#f4f4f5",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,color:s?"#a1a1aa":"#52525b",borderRadius:"12px",fontSize:"12.5px",fontWeight:500,display:"inline-flex",alignItems:"center",gap:"8px",alignSelf:"center"},children:[n("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:v?"#22c55e":b==="connecting"?"#eab308":"#a1a1aa",display:"inline-block"}}),n("span",{children:v?"Connected \xB7 Speak to our receptionist":b==="connecting"?"Connecting to receptionist...":"Start a call to talk to our receptionist"})]}),J.map((f,L)=>{let I=f.who==="user";return n("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:I?"flex-end":"flex-start"},children:p("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[!I&&n("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[n("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),n("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),n("div",{style:{padding:"10px 14px",borderRadius:I?"14px 14px 2px 14px":"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:I?r:s?"#18181b":"#f4f4f5",color:I?"#ffffff":s?"#fafafa":"#09090b",border:!I&&s?"1px solid #27272a":"none",boxShadow:I?`0 2px 8px ${r}35`:"0 1px 2px rgba(0,0,0,0.04)"},children:f.text})]})},L)}),Z&&n("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:"flex-start"},children:p("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[n("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[n("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),n("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),p("div",{style:{padding:"10px 14px",borderRadius:"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:s?"#18181b":"#f4f4f5",color:s?"#a1a1aa":"#71717a",border:s?"1px solid #27272a":"none",boxShadow:"0 1px 2px rgba(0,0,0,0.04)",display:"inline-flex",alignItems:"center",gap:"5px",minHeight:"38px"},title:"Agent is thinking and processing...",children:[n("span",{className:"omnidesk-motion-dot omnidesk-dot-1"}),n("span",{className:"omnidesk-motion-dot omnidesk-dot-2"}),n("span",{className:"omnidesk-motion-dot omnidesk-dot-3"})]})]})})]}),ee&&v&&p("div",{style:{padding:"11px 16px",background:"#f0fdf4",borderTop:"1px solid #bbf7d0",display:"flex",flexDirection:"column",gap:"7px",flexShrink:0},children:[p("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"},children:[p("span",{style:{fontSize:"11px",fontWeight:700,color:"#15803d",textTransform:"uppercase",letterSpacing:"0.04em",display:"inline-flex",alignItems:"center",gap:"6px"},children:[n("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:"#22c55e",display:"inline-block"}}),"Email Requested by Agent"]}),n("button",{type:"button",onClick:()=>M(!1),style:{background:"none",border:"none",color:"#15803d",cursor:"pointer",fontSize:"12px",fontWeight:700,padding:"1px 4px"},children:"\u2715"})]}),p("form",{onSubmit:se,style:{display:"flex",gap:"6px"},children:[n("input",{type:"email",autoFocus:!0,value:U,onChange:f=>de(f.target.value),placeholder:"Enter your email (e.g. name@gmail.com)",required:!0,style:{flex:1,fontSize:"12.5px",padding:"7px 11px",borderRadius:"7px",border:"1px solid #86efac",background:"#ffffff",color:"#09090b",outline:"none"}}),n("button",{type:"submit",disabled:!U.trim(),style:{background:"#16a34a",color:"#ffffff",border:"none",padding:"7px 14px",borderRadius:"7px",fontSize:"12px",fontWeight:600,cursor:U.trim()?"pointer":"not-allowed",opacity:U.trim()?1:.6},children:"Send"})]})]}),p("div",{style:{padding:"12px 16px",borderTop:`1px solid ${s?"#27272a":"#e4e4e7"}`,background:s?"#121214":"#fafafa",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0},children:[p("button",{type:"button",onClick:v?be:_,disabled:b==="connecting",style:{display:"inline-flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:v?"#dc2626":b==="connecting"?"#64748b":r,color:"#ffffff",borderRadius:"10px",border:"none",fontSize:"13px",fontWeight:600,boxShadow:v?"0 4px 14px rgba(220, 38, 38, 0.35)":`0 4px 14px ${r}40`,cursor:b==="connecting"?"not-allowed":"pointer",transition:"all 0.15s ease"},children:[p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[n("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),n("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),n("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]}),n("span",{children:v?"End Voice Call":b==="connecting"?"Connecting...":"Start Voice Call"})]}),p("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[v&&n("div",{style:{display:"flex",alignItems:"center",gap:"2.5px",height:"14px"},children:[12,8,14,6,10].map((f,L)=>n("span",{style:{width:"2.5px",height:`${Math.max(4,Math.min(14,Math.round(f*(.35+Math.max(me,Ce)*1.5))))}px`,background:r,borderRadius:"1px",transition:"height 0.12s ease"}},L))}),n("span",{style:{fontFamily:"var(--mono, monospace)",fontSize:"12px",fontWeight:600,padding:"3px 8px",borderRadius:"6px",background:s?"#18181b":v?"#000000":"#f4f4f5",color:s||v?"#ffffff":"#71717a",border:s?"1px solid #27272a":"none"},children:Se})]})]})]})]})]})}var Fe=$e;var Ne={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function Me(y={}){if(typeof window>"u")return;let{host:c,businessId:w="biz_demo_dental",agentId:T,theme:B="light",position:Q="bottom-right",label:E="Talk to Receptionist",accent:z="emerald",accentColor:C,businessName:a,greeting:R,onCallStart:H,onCallEnd:W,onTranscript:N}=y,x=C||Ne[z]||z||"#10b981",ue=document.getElementById("omnidesk-voice-widget-root");ue&&ue.remove();let m=document.createElement("div");m.id="omnidesk-voice-widget-root",m.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let o=B==="dark"||B==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,b=null,O="idle",J=0,X=null,me=!1,fe=!1,Ce=0,ye=0,Se=!1,te=!1,j=!1,ie=null,ee=null,M=!1,U=Q==="bottom-left",de=document.createElement("div");de.style.cssText=`
    position: fixed; bottom: 20px; ${U?"left: 20px;":"right: 20px;"};
    z-index: 999999;
  `;let Z=document.createElement("button");Z.style.cssText=`
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${o?"#18181b":"#ffffff"}; color: ${o?"#fafafa":"#09090b"};
    border: 1px solid ${o?"#27272a":"#e4e4e7"};
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `,Z.innerHTML=`
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${x};box-shadow:0 0 8px ${x};display:inline-block;"></span>
    <span>${E}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,de.appendChild(Z);let V=document.createElement("div");V.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,V.onclick=()=>v(!1);let d=document.createElement("div");d.style.cssText=`
    position: fixed; bottom: 80px; ${U?"left: 20px;":"right: 20px;"};
    width: 390px; max-width: calc(100vw - 32px); height: 560px; max-height: calc(100vh - 100px);
    background: ${o?"#09090b":"#ffffff"}; border: 1px solid ${o?"#27272a":"#e4e4e7"};
    border-radius: 20px; box-shadow: 0 24px 48px -12px rgba(0,0,0,0.22);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  `;let $=document.createElement("div");$.style.cssText=`
    background: ${o?"#18181b":"#ffffff"}; color: ${o?"#ffffff":"#09090b"};
    border-bottom: 1px solid ${o?"#27272a":"#e4e4e7"};
    padding: 13px 18px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; user-select: none; flex-shrink: 0;
  `,$.innerHTML=`
    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
      <div style="color: ${o?"rgba(255,255,255,0.6)":"#71717a"}; display: grid; place-items: center; flex-shrink: 0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle>
        </svg>
      </div>
      <div style="width: 28px; height: 28px; border-radius: 50%; background: ${o?"rgba(255,255,255,0.15)":x==="#18181b"?"rgba(24,24,27,0.08)":`${x}18`}; display: grid; place-items: center; flex-shrink: 0; color: ${o?"#ffffff":x==="#18181b"?"#09090b":x};">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
        </svg>
      </div>
      <div style="display: flex; flex-direction: column; min-width: 0;">
        <div id="omnidesk-biz-title" style="font-size: 13.5px; font-weight: 600; color: ${o?"#ffffff":"#09090b"}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${a||"OmniDesk Hair Salon & Studio"}
        </div>
        <div style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: ${o?"rgba(255,255,255,0.75)":"#71717a"}; white-space: nowrap;">
          <span id="omnidesk-status-dot" style="width: 6px; height: 6px; border-radius: 50%; background: ${o?"rgba(255,255,255,0.4)":"#a1a1aa"}; display: inline-block;"></span>
          <span id="omnidesk-status-text">Idle \xB7 Ready</span>
        </div>
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 8px;">
      <button id="omnidesk-expand-btn" style="background: ${o?"rgba(255,255,255,0.1)":"#f4f4f5"}; border: 1px solid ${o?"rgba(255,255,255,0.15)":"#e4e4e7"}; border-radius: 7px; color: ${o?"#ffffff":"#52525b"}; width: 30px; height: 30px; cursor: pointer; display: grid; place-items: center;" title="Open Full">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
      </button>
      <button id="omnidesk-close-btn" style="background: ${o?"rgba(255,255,255,0.1)":"#f4f4f5"}; border: 1px solid ${o?"rgba(255,255,255,0.15)":"#e4e4e7"}; border-radius: 7px; color: ${o?"#ffffff":"#52525b"}; width: 30px; height: 30px; cursor: pointer; display: grid; place-items: center;" title="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `;let G=document.createElement("style");G.textContent=`
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
  `,m.appendChild(G);let k=document.createElement("div");k.style.cssText=`
    flex: 1; min-height: 0; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 12px; background: ${o?"#09090b":"#ffffff"};
  `;let K=document.createElement("div");K.id="omnidesk-placeholder-banner",K.style.cssText=`
    margin: auto; text-align: center; padding: 10px 18px;
    background: ${o?"#18181b":"#f4f4f5"}; border: 1px solid ${o?"#27272a":"#e4e4e7"}; color: ${o?"#a1a1aa":"#52525b"};
    border-radius: 12px; font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px; align-self: center;
  `,K.innerHTML=`
    <span id="omnidesk-placeholder-dot" style="width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block;"></span>
    <span>Start a call to talk to our receptionist</span>
  `,k.appendChild(K);let S=document.createElement("div");if(S.id="omnidesk-thinking-bubble",S.style.cssText=`
    display: none; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;
  `,S.innerHTML=`
    <div style="display: flex; align-items: flex-start; gap: 8px;">
      <div style="width: 24px; height: 24px; border-radius: 50%; background: #18181b; display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        </svg>
      </div>
      <div style="padding: 10px 14px; border-radius: 14px 14px 14px 2px; font-size: 13px; line-height: 1.45; background: ${o?"#18181b":"#f4f4f5"}; color: ${o?"#a1a1aa":"#71717a"}; border: ${o?"1px solid #27272a":"none"}; boxShadow: 0 1px 2px rgba(0,0,0,0.04); display: inline-flex; align-items: center; gap: 5px; min-height: 38px;" title="Agent is thinking and processing...">
        <span class="omnidesk-motion-dot omnidesk-dot-1"></span>
        <span class="omnidesk-motion-dot omnidesk-dot-2"></span>
        <span class="omnidesk-motion-dot omnidesk-dot-3"></span>
      </div>
    </div>
  `,k.appendChild(S),R){K.style.display="none";let u=document.createElement("div");u.style.cssText="display: flex; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;";let i=document.createElement("div");i.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let e=document.createElement("div");e.style.cssText="width: 24px; height: 24px; border-radius: 50%; background: #18181b; display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;",e.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let g=document.createElement("div");g.style.cssText=`padding: 10px 14px; border-radius: 14px 14px 14px 2px; font-size: 13px; line-height: 1.45; background: ${o?"#18181b":"#f4f4f5"}; color: ${o?"#fafafa":"#09090b"}; border: ${o?"1px solid #27272a":"none"}; box-shadow: 0 1px 2px rgba(0,0,0,0.04);`,g.innerText=R,i.appendChild(e),i.appendChild(g),u.appendChild(i),k.insertBefore(u,S),ie="agent",ee=g,M=!0}let h=document.createElement("div");h.id="omnidesk-email-bar",h.style.cssText=`
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
  `;let F=document.createElement("div");F.style.cssText=`
    padding: 12px 16px; border-top: 1px solid ${o?"#27272a":"#e4e4e7"};
    background: ${o?"#121214":"#fafafa"}; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  `;let r=document.createElement("button");r.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: ${x}; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    box-shadow: 0 4px 14px ${x}40;
    cursor: pointer; transition: all 0.15s ease;
  `,r.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let s=document.createElement("div");s.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let A=document.createElement("div");A.id="omnidesk-waveform",A.style.cssText="display: none; align-items: center; gap: 2.5px; height: 14px;";let he=[12,8,14,6,10],P=[];he.forEach(u=>{let i=document.createElement("span");i.style.cssText=`width: 2.5px; height: ${Math.round(u*.35)}px; background: ${x}; border-radius: 1px; transition: height 0.12s ease;`,A.appendChild(i),P.push(i)}),s.appendChild(A);let _=document.createElement("span");_.id="omnidesk-timer",_.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,_.innerText="0:00",s.appendChild(_),F.appendChild(r),F.appendChild(s),d.appendChild($),d.appendChild(k),d.appendChild(h),d.appendChild(F),m.appendChild(de),m.appendChild(V),m.appendChild(d),document.body.appendChild(m);function be(){J=Date.now(),_.innerText="0:00",_.style.background=o?"#18181b":"#000000",_.style.color="#ffffff",_.style.border=o?"1px solid #27272a":"none",X&&clearInterval(X),X=setInterval(()=>{let u=Date.now()-J,i=Math.floor(u/1e3),e=Math.floor(i/60),g=i%60;_.innerText=`${e}:${String(g).padStart(2,"0")}`},250)}function se(){X&&(clearInterval(X),X=null),_.style.background="#f4f4f5",_.style.color="#71717a",_.style.border="none",_.innerText="0:00",A.style.display="none"}function oe(u){me=u,d.style.display=u?"flex":"none"}function v(u){fe=u,V.style.display=u?"block":"none",u?(d.style.top="50%",d.style.left="50%",d.style.bottom="auto",d.style.right="auto",d.style.transform="translate(-50%, -50%)",d.style.width="calc(100vw - 40px)",d.style.maxWidth="1140px",d.style.height="calc(100vh - 40px)",d.style.maxHeight="900px"):(d.style.top="auto",d.style.left=U?"20px":"auto",d.style.right=U?"auto":"20px",d.style.bottom="80px",d.style.transform="none",d.style.width="390px",d.style.maxWidth="calc(100vw - 32px)",d.style.height="560px",d.style.maxHeight="calc(100vh - 100px)")}Z.onclick=()=>oe(!me),$.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{oe(!1),v(!1)}),$.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{v(!fe)});let f=h.querySelector("#omnidesk-email-form"),L=h.querySelector("#omnidesk-email-input");h.querySelector("#omnidesk-email-close-btn").addEventListener("click",()=>{h.style.display="none"}),f.addEventListener("submit",u=>{u.preventDefault();let i=L.value.trim();if(!i||!i.includes("@"))return;b&&b.sendEmailInput(i),j=!0,h.style.display="none",L.value="",K.style.display="none";let e=document.createElement("div");e.style.cssText=`
      display: flex; flex-direction: column; gap: 4px; max-width: 88%;
      align-self: flex-end;
    `;let g=document.createElement("div");g.style.cssText=`
      padding: 10px 14px; border-radius: 14px 14px 2px 14px;
      font-size: 13px; line-height: 1.45;
      background: ${x}; color: #ffffff;
      box-shadow: 0 2px 8px ${x}35;
    `,g.innerText=`My email is ${i}`,e.appendChild(g),k.insertBefore(e,S),S.style.display="flex",k.scrollTop=k.scrollHeight,ie="user",ee=g,M=!0});async function q(){Se=!1,te=!1,j=!1,h.style.display="none",S.style.display="none",ie=null,ee=null,M=!1;let u=$.querySelector("#omnidesk-status-text"),i=$.querySelector("#omnidesk-status-dot"),e=r.querySelector("#omnidesk-btn-text");u.innerText="Connecting...",i.style.background="#eab308",e.innerText="Connecting...",r.style.background="#64748b",r.style.boxShadow="none",r.disabled=!0,be();try{let g=c;if(!g&&typeof document<"u"){let l=document.querySelector("script[src*='widget.js']");if(l&&l.src&&l.src.startsWith("http"))try{g=new URL(l.src).origin}catch{}}!g&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(g=window.location.origin);let ce=(g||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),we=await fetch(`${ce}/api/token?businessId=${encodeURIComponent(w)}`);if(!we.ok)throw new Error(`Failed to get session token (${we.status})`);let xe=await we.json();if(xe.business_name&&!a){let l=$.querySelector("#omnidesk-biz-title");l&&(l.innerText=xe.business_name)}let Ae=T||xe.agent_id||"";b=new le({onStatusChange:l=>{if(O=l,l==="connected")u.innerText="Live \xB7 Speaking",i.style.background="#22c55e",e.innerText="End Voice Call",r.style.background="#dc2626",r.style.boxShadow="0 4px 14px rgba(220, 38, 38, 0.35)",r.disabled=!1,A.style.display="flex",J=Date.now(),H?.();else if(l==="idle"&&(u.innerText="Idle \xB7 Ready",i.style.background=o?"rgba(255,255,255,0.4)":"#a1a1aa",e.innerText="Start Voice Call",r.style.background=x,r.style.boxShadow=`0 4px 14px ${x}40`,r.disabled=!1,A.style.display="none",h.style.display="none",S.style.display="none",se(),J>0)){let t=Math.round((Date.now()-J)/1e3);J=0,W?.(t)}},onThinkingChange:l=>{l&&(S.style.display="flex",k.scrollTop=k.scrollHeight)},onTranscript:l=>{if(K.style.display="none",l.who==="user"){l.isFinal&&(S.style.display="flex");let t=l.text.toLowerCase();(t==="no"||t.startsWith("no ")||t.includes("no,")||t.includes("wrong")||t.includes("incorrect")||t.includes("change my email")||t.includes("different email"))&&(j=!1),(l.text.includes("@")||t.includes(" at ")&&t.includes(" dot ")||t.includes("gmail.com")||t.includes("yahoo.com")||t.includes("outlook.com")||t.includes("hotmail.com")||t.includes("icloud.com"))&&(h.style.display="none",j=!0)}else if(l.who==="agent"){l.text&&l.text.trim().length>0&&(S.style.display="none");let t=l.text.toLowerCase();if(t.includes("confirmation code is")||t.includes("booking is confirmed")||t.includes("scheduled your appointment")||t.includes("all set, your appointment")||t.includes("sent your confirmation")&&(t.includes("code")||t.includes("calendar invite"))||t.includes("sent a calendar invite")&&(t.includes("code")||t.includes("all set"))){te=!0,j=!1,h.style.display="none";return}if(te){h.style.display="none";return}if(t.includes("confirm with yes or no")||t.includes("yes or no")||t.includes("is that correct")||t.includes("is that right")){j=!0,h.style.display="none";return}t.includes("what is your email")||t.includes("what's your email")||t.includes("whats your email")||t.includes("may i have your email")||t.includes("can i have your email")||t.includes("could i have your email")||t.includes("could i get your email")||t.includes("could you provide your email")||t.includes("can you provide your email")||t.includes("provide your email")||t.includes("enter your email")||t.includes("spell your email")||t.includes("share your email")||t.includes("need your email")||t.includes("what email")||t.includes("which email")||t.includes("where can i send your confirmation")||t.includes("where should i send your confirmation")||t.includes("where can i send your calendar")||t.includes("where should i send your calendar")||t.includes("email")&&(t.includes("what is")||t.includes("what's")||t.includes("whats")||t.includes("may i have")||t.includes("can i have")||t.includes("could i have")||t.includes("may i get")||t.includes("could i get")||t.includes("can you provide")||t.includes("could you provide")||t.includes("provide")||t.includes("give me")||t.includes("tell me")||t.includes("share")||t.includes("best email")||t.includes("your email")||t.includes("send your calendar invite")||t.includes("send your confirmation")||t.includes("send a calendar invite")||t.includes("send the calendar invite")||t.includes("send the confirmation")||t.includes("send a confirmation")||t.includes("so i can send")||t.includes("to send your"))?(j=!1,h.style.display="flex",setTimeout(()=>L.focus(),60)):l.isFinal&&!te&&!j&&(h.style.display="none")}if(ie===l.who&&ee&&!M)ee.innerText=l.text,M=!!l.isFinal;else{let t=l.who==="user",ae=document.createElement("div");if(ae.style.cssText=`
              display: flex; flex-direction: column; gap: 4px; max-width: 88%;
              align-self: ${t?"flex-end":"flex-start"};
            `,t){let D=document.createElement("div");D.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 2px 14px;
                font-size: 13px; line-height: 1.45;
                background: ${x};
                color: #ffffff;
                box-shadow: 0 2px 8px ${x}35;
              `,D.innerText=l.text,ae.appendChild(D),ee=D}else{let D=document.createElement("div");D.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let re=document.createElement("div");re.style.cssText=`
                width: 24px; height: 24px; border-radius: 50%; background: #18181b;
                display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;
              `,re.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let pe=document.createElement("div");pe.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 14px 2px;
                font-size: 13px; line-height: 1.45;
                background: ${o?"#18181b":"#f4f4f5"};
                color: ${o?"#fafafa":"#09090b"};
                border: ${o?"1px solid #27272a":"none"};
                box-shadow: 0 1px 2px rgba(0,0,0,0.04);
              `,pe.innerText=l.text,D.appendChild(re),D.appendChild(pe),ae.appendChild(D),ee=pe}k.insertBefore(ae,S),ie=l.who,M=!!l.isFinal}k.scrollTop=k.scrollHeight,N?.(l)},onAudioLevel:(l,t)=>{if(Ce=l,ye=t,O==="connected"){A.style.display="flex";let ae=Math.max(l,t);he.forEach((D,re)=>{let pe=Math.max(4,Math.min(14,Math.round(D*(.35+ae*1.5))));P[re]&&(P[re].style.height=`${pe}px`)})}},onError:()=>{u.innerText="Error",i.style.background="#ef4444",e.innerText="Start Voice Call",r.style.background=x,r.style.boxShadow=`0 4px 14px ${x}40`,r.disabled=!1,A.style.display="none",h.style.display="none",S.style.display="none",se()}}),await b.start(xe.token,Ae,xe.voice)}catch(g){console.error("[OmniDesk Voice Widget Error]:",g),u.innerText="Error",i.style.background="#ef4444",e.innerText="Start Voice Call",r.style.background=x,r.style.boxShadow=`0 4px 14px ${x}40`,r.disabled=!1,A.style.display="none",h.style.display="none",S.style.display="none",se()}}function ke(){b&&(b.stop(),b=null),O="idle";let u=$.querySelector("#omnidesk-status-text"),i=$.querySelector("#omnidesk-status-dot"),e=r.querySelector("#omnidesk-btn-text");u&&(u.innerText="Idle \xB7 Ready"),i&&(i.style.background=o?"rgba(255,255,255,0.4)":"#a1a1aa"),e&&(e.innerText="Start Voice Call"),r.style.background=x,r.style.boxShadow=`0 4px 14px ${x}40`,r.disabled=!1,A.style.display="none",h.style.display="none",S.style.display="none",te=!1,j=!1,se()}return r.onclick=()=>{O==="connected"?ke():O==="idle"&&q()},{destroy:()=>{se(),b&&b.stop(),m.remove()},startCall:q,endCall:ke}}if(typeof document<"u"){let y=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(y){let c,w=y.src||"";if(w&&w.startsWith("http"))try{c=new URL(w).origin}catch{}let T=y.getAttribute("data-business-id")||void 0,B=y.getAttribute("data-agent")||void 0,Q=y.getAttribute("data-theme")||"dark",E=y.getAttribute("data-accent")||"emerald",z=y.getAttribute("data-position")||"bottom-right",C=y.getAttribute("data-label")||void 0,a=y.getAttribute("data-host")||c||"https://omni-desk-rho.vercel.app",R=y.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{Me({businessId:T,agentId:B,theme:Q,accent:E,position:z,label:C,host:a,greeting:R})}):Me({businessId:T,agentId:B,theme:Q,accent:E,position:z,label:C,host:a,greeting:R})}}export{le as AssemblyAIVoiceClient,$e as OmniDeskWidget,Fe as VoiceWidget,Me as initOmniDeskWidget};
//# sourceMappingURL=index.mjs.map