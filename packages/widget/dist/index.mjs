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
`;async function Ee(m,c,k){let S=URL.createObjectURL(new Blob([c],{type:"application/javascript"}));try{await m.audioWorklet.addModule(S)}finally{URL.revokeObjectURL(S)}return new AudioWorkletNode(m,k)}var re=class{constructor(c){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.isThinking=!1;this.callbacks=c}setThinking(c){this.isThinking!==c&&(this.isThinking=c,this.callbacks.onThinkingChange?.(c))}async start(c,k,S){try{this.callbacks.onStatusChange?.("connecting");let B=window.AudioContext||window.webkitAudioContext;this.captureCtx=new B({sampleRate:ve}),this.playbackCtx=new B({sampleRate:ve}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await Ee(this.playbackCtx,Re,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0}}),this.captureNode=await Ee(this.captureCtx,Ie,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let K=new URL(_e);K.searchParams.set("token",c),this.ws=new WebSocket(K.toString()),this.captureNode.port.onmessage=({data:C})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let a=new Uint8Array(C),I="";for(let z=0;z<a.length;z+=32768)I+=String.fromCharCode.apply(null,Array.from(a.subarray(z,z+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(I)}));let H=new Int16Array(C),R=0;for(let z=0;z<H.length;z+=16)R+=Math.abs(H[z]);this.userLevel=Math.min(1,R/(H.length/16)/8e3)},this.ws.onopen=()=>{let C={};k&&k.trim()?C.agent_id=k.trim():S&&S.trim()&&(C.output={voice:S.trim()}),Object.keys(C).length>0&&this.ws?.send(JSON.stringify({type:"session.update",session:C}))};let M="",F="";this.ws.onmessage=({data:C})=>{try{let a=JSON.parse(C);switch(a.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0,F="",this.setThinking(!1);break;case"transcript.user.delta":a.text&&(F=a.text,this.callbacks.onTranscript?.({who:"user",text:a.text,isFinal:!1}));break;case"transcript.user":a.text&&(F=a.text,this.callbacks.onTranscript?.({who:"user",text:a.text,isFinal:!0}),this.setThinking(!0));break;case"reply.started":M="";break;case"transcript.agent.delta":a.delta&&(this.setThinking(!1),M&&!M.endsWith(" ")&&!/^[.,!?;:%)]/.test(a.delta)?M+=" "+a.delta:M+=a.delta,this.callbacks.onTranscript?.({who:"agent",text:M,isFinal:!1}));break;case"transcript.agent":a.text&&(this.setThinking(!1),M=a.text,this.callbacks.onTranscript?.({who:"agent",text:a.text,isFinal:!0}));break;case"reply.audio":if(a.data&&this.playbackNode){let I=atob(a.data),H=new Uint8Array(I.length);for(let R=0;R<I.length;R++)H[R]=I.charCodeAt(R);this.playbackNode.port.postMessage(H.buffer,[H.buffer]),this.agentLevel=.8}break;case"reply.done":a.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:a.name||a.tool,args:a.arguments||a.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:a.name||a.tool,result:a.result});break;case"session.error":this.setThinking(!1),this.callbacks.onError?.(a.message||a.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.setThinking(!1),this.stop();break}}catch(a){console.warn("Message parsing error:",a)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(B){this.callbacks.onError?.(B.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(c){this.isMuted=c,c&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(c,k){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:c})),k&&this.ws.send(JSON.stringify({type:"reply.create",instructions:k})),!0}catch(S){return console.error("Failed to send message to agent:",S),!1}}sendEmailInput(c){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:`My email address is ${c}`})),!0}catch(k){return console.error("Failed to send email to agent:",k),!1}}stop(){if(this.setThinking(!1),this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(c=>c.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let c=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(c)};this.animFrameId=requestAnimationFrame(c)}};import{Fragment as ze,jsx as n,jsxs as p}from"react/jsx-runtime";var We={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function $e({host:m="",businessId:c="biz_demo_dental",agentId:k,theme:S="light",position:B="bottom-right",label:K="Talk to Receptionist",accent:M="emerald",accentColor:F,businessName:C,greeting:a,className:I,onCallStart:H,onCallEnd:R,onTranscript:z}){let[g,ue]=Y(!1),[x,o]=Y(!1),[y,O]=Y("idle"),[Z,X]=Y([]),[me,fe]=Y(0),[Ce,ye]=Y(0),[Se,ee]=Y("0:00"),[j,le]=Y(C||"OmniDesk Hair Salon & Studio"),[te,E]=Y(!1),[U,de]=Y(""),[J,V]=Y(!1),d=ne(null),L=ne(null),G=ne(0),w=ne(null),Q=ne(0),T=ne(!1),h=ne(!1),W=ne(!1),r=Te(()=>F||We[M]||M||"#10b981",[M,F]),s=Te(()=>S==="dark"?!0:S==="auto"&&typeof window<"u"?window.matchMedia("(prefers-color-scheme: dark)").matches:!1,[S]);Le(()=>{L.current&&(L.current.scrollTop=L.current.scrollHeight)},[Z,J]);let $=Te(()=>m?m.replace(/\/$/,""):typeof window<"u"&&window.location.origin?window.location.origin:"",[m]),he=ge(()=>{Q.current=Date.now(),ee("0:00"),w.current&&clearInterval(w.current),w.current=setInterval(()=>{let f=Date.now()-Q.current,_=Math.floor(f/1e3),N=Math.floor(_/60),q=_%60;ee(`${N}:${String(q).padStart(2,"0")}`)},250)},[]),P=ge(()=>{w.current&&(clearInterval(w.current),w.current=null)},[]),A=ge(async()=>{try{O("connecting"),T.current=!1,h.current=!1,W.current=!1,E(!1),he();let _=`${$?$.replace(/\/$/,""):""}/api/token?businessId=${encodeURIComponent(c)}`,N=await fetch(_);if(!N.ok)throw new Error("Failed to initialize voice session");let q=await N.json();if(q.business_name&&!C&&le(q.business_name),!q.token)throw new Error("Invalid session token payload received from host");let ke=k||q.agent_id||"",u=new re({onStatusChange:i=>{if(O(i),i==="connected")G.current=Date.now(),H?.();else if(i==="idle"){if(V(!1),P(),G.current>0){let e=Math.round((Date.now()-G.current)/1e3);G.current=0,R?.(e)}}else i==="error"&&(V(!1),P())},onThinkingChange:i=>{i&&V(!0)},onTranscript:i=>{if(i.who==="user"?V(!0):i.who==="agent"&&i.text&&i.text.trim().length>0&&V(!1),X(e=>{let b=e[e.length-1];if(b&&b.who===i.who&&!b.isFinal){let ce=[...e];return ce[ce.length-1]={...b,text:i.text,isFinal:i.isFinal??!1},ce}return[...e,{id:i.id||`${Date.now()}-${Math.random()}`,who:i.who,text:i.text,isFinal:i.isFinal??!1}]}),z?.(i),i.who==="user"){let e=i.text.toLowerCase();(e==="no"||e.startsWith("no ")||e.includes("no,")||e.includes("wrong")||e.includes("incorrect")||e.includes("change my email")||e.includes("different email"))&&(W.current=!1),(i.text.includes("@")||e.includes(" at ")&&e.includes(" dot ")||e.includes("gmail.com")||e.includes("yahoo.com")||e.includes("outlook.com")||e.includes("hotmail.com")||e.includes("icloud.com"))&&(E(!1),W.current=!0)}else if(i.who==="agent"){let e=i.text.toLowerCase();if(i.isFinal){if(e.includes("confirmation code is")||e.includes("booking is confirmed")||e.includes("scheduled your appointment")||e.includes("all set, your appointment")||e.includes("sent your confirmation")&&(e.includes("code")||e.includes("calendar invite"))||e.includes("sent a calendar invite")&&(e.includes("code")||e.includes("all set"))){h.current=!0,W.current=!1,E(!1);return}if(h.current){E(!1);return}if(e.includes("confirm with yes or no")||e.includes("yes or no")||e.includes("is that correct")||e.includes("is that right")){W.current=!0,E(!1);return}e.includes("what is your email")||e.includes("what's your email")||e.includes("may i have your email")||e.includes("can i have your email")||e.includes("could i get your email")||e.includes("could you provide your email")||e.includes("provide your email")||e.includes("enter your email")||e.includes("spell your email")||e.includes("share your email")||e.includes("need your email")||e.includes("what email")||e.includes("which email")||e.includes("where can i send your confirmation")||e.includes("where should i send your confirmation")||e.includes("where can i send your calendar")||e.includes("where should i send your calendar")||e.includes("email")&&(e.includes("what is")||e.includes("what's")||e.includes("may i have")||e.includes("can i have")||e.includes("provide")||e.includes("give me")||e.includes("tell me")||e.includes("send your calendar invite")||e.includes("send your confirmation"))?(W.current=!1,E(!0)):!h.current&&!W.current&&E(!1)}}},onAudioLevel:(i,e)=>{fe(i),ye(e)},onError:()=>{O("error"),P()}});d.current=u,await u.start(q.token,ke,q.voice)}catch{O("error"),P()}},[$,c,k,C,H,R,z,he,P]),be=ge(()=>{if(d.current&&(d.current.stop(),d.current=null),O("idle"),V(!1),fe(0),ye(0),P(),h.current=!1,W.current=!1,E(!1),G.current>0){let f=Math.round((Date.now()-G.current)/1e3);G.current=0,R?.(f)}},[R,P]),ie=ge(f=>{f.preventDefault();let _=U.trim();_&&(d.current&&d.current.sendEmailInput(_),V(!0),W.current=!0,de(""),E(!1))},[U]);Le(()=>()=>{P(),d.current&&d.current.stop()},[P]);let se=B==="bottom-left",v=y==="connected";return p("div",{className:I,style:{position:"relative",zIndex:99999},children:[n("div",{style:{position:"fixed",bottom:"20px",left:se?"20px":"auto",right:se?"auto":"20px",zIndex:99999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:p("button",{type:"button",onClick:()=>ue(!g),style:{display:"inline-flex",alignItems:"center",gap:"10px",background:s?"#18181b":"#ffffff",color:s?"#fafafa":"#09090b",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,padding:"10px 18px",borderRadius:"9999px",cursor:"pointer",fontSize:"13px",fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.18)",transition:"transform 0.15s ease, background 0.15s ease"},onMouseEnter:f=>{f.currentTarget.style.transform="scale(1.02)"},onMouseLeave:f=>{f.currentTarget.style.transform="scale(1)"},children:[n("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:v?"#ef4444":r,boxShadow:`0 0 8px ${v?"#ef4444":r}`}}),n("span",{children:K}),n("span",{style:{fontSize:"11px",opacity:.6},children:"\u25B2"})]})}),g&&p(ze,{children:[x&&n("div",{onClick:()=>o(!1),style:{position:"fixed",inset:0,background:"rgba(0, 0, 0, 0.7)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",zIndex:999998}}),p("div",{style:{position:"fixed",bottom:x?"auto":"80px",left:x?"50%":se?"20px":"auto",right:x||se?"auto":"20px",top:x?"50%":"auto",transform:x?"translate(-50%, -50%)":"none",width:x?"calc(100vw - 40px)":"390px",maxWidth:x?"1140px":"calc(100vw - 32px)",height:x?"calc(100vh - 40px)":"560px",maxHeight:x?"900px":"calc(100vh - 100px)",background:s?"#09090b":"#ffffff",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,borderRadius:"20px",boxShadow:x?"0 32px 64px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)":"0 24px 48px -12px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:999999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",transition:"all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"},children:[n("style",{children:`
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
            `}),p("div",{style:{background:s?"#18181b":"#ffffff",color:s?"#ffffff":"#09090b",borderBottom:`1px solid ${s?"#27272a":"#e4e4e7"}`,padding:x?"16px 22px":"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",userSelect:"none",flexShrink:0},children:[p("div",{style:{display:"flex",alignItems:"center",gap:"10px",minWidth:0},children:[n("div",{style:{color:s?"rgba(255,255,255,0.6)":"#71717a",display:"grid",placeItems:"center",flexShrink:0},children:p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[n("circle",{cx:"12",cy:"12",r:"1"}),n("circle",{cx:"12",cy:"5",r:"1"}),n("circle",{cx:"12",cy:"19",r:"1"})]})}),n("div",{style:{width:"28px",height:"28px",borderRadius:"50%",background:s?"rgba(255,255,255,0.15)":r==="#18181b"?"rgba(24,24,27,0.08)":`${r}18`,display:"grid",placeItems:"center",flexShrink:0,color:s?"#ffffff":r==="#18181b"?"#09090b":r},children:p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[n("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),n("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),n("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]})}),p("div",{style:{display:"flex",flexDirection:"column",minWidth:0},children:[n("div",{style:{fontSize:"13.5px",fontWeight:600,color:s?"#ffffff":"#09090b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},children:j}),p("div",{style:{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"11px",color:s?"rgba(255,255,255,0.75)":"#71717a"},children:[n("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:v?J?"#f59e0b":"#22c55e":y==="connecting"?"#eab308":s?"rgba(255,255,255,0.4)":"#a1a1aa",animation:J?"omnidesk-pulse-amber 1.5s infinite":"none"}}),n("span",{children:v?J?"Thinking \xB7 Checking tools...":"Live \xB7 Speaking":y==="connecting"?"Connecting...":y==="error"?"Error":"Idle \xB7 Ready"})]})]})]}),p("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[n("button",{type:"button",onClick:()=>o(!x),title:x?"Exit Fullscreen":"Open Full",style:{background:s?"rgba(255,255,255,0.1)":"#f4f4f5",border:s?"1px solid rgba(255,255,255,0.15)":"1px solid #e4e4e7",borderRadius:"7px",color:s?"#ffffff":"#52525b",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:f=>f.currentTarget.style.background=s?"rgba(255,255,255,0.2)":"#e4e4e7",onMouseLeave:f=>f.currentTarget.style.background=s?"rgba(255,255,255,0.1)":"#f4f4f5",children:x?p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[n("polyline",{points:"4 14 10 14 10 20"}),n("polyline",{points:"20 10 14 10 14 4"}),n("line",{x1:"14",y1:"10",x2:"21",y2:"3"}),n("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]}):p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[n("polyline",{points:"15 3 21 3 21 9"}),n("polyline",{points:"9 21 3 21 3 15"}),n("line",{x1:"21",y1:"3",x2:"14",y2:"10"}),n("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]})}),n("button",{type:"button",onClick:()=>{v&&be(),ue(!1)},title:"Close Widget",style:{background:s?"rgba(255,255,255,0.1)":"#f4f4f5",border:s?"1px solid rgba(255,255,255,0.15)":"1px solid #e4e4e7",borderRadius:"7px",color:s?"#ffffff":"#52525b",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:f=>f.currentTarget.style.background=s?"rgba(255,255,255,0.2)":"#e4e4e7",onMouseLeave:f=>f.currentTarget.style.background=s?"rgba(255,255,255,0.1)":"#f4f4f5",children:p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[n("line",{x1:"18",y1:"6",x2:"6",y2:"18"}),n("line",{x1:"6",y1:"6",x2:"18",y2:"18"})]})})]})]}),p("div",{ref:L,style:{flex:1,minHeight:0,padding:"16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"12px",background:s?"#09090b":"#ffffff"},children:[Z.length===0&&p("div",{style:{margin:"auto",textAlign:"center",padding:"10px 18px",background:s?"#18181b":"#f4f4f5",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,color:s?"#a1a1aa":"#52525b",borderRadius:"12px",fontSize:"12.5px",fontWeight:500,display:"inline-flex",alignItems:"center",gap:"8px",alignSelf:"center"},children:[n("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:v?"#22c55e":y==="connecting"?"#eab308":"#a1a1aa",display:"inline-block"}}),n("span",{children:v?"Connected \xB7 Speak to our receptionist":y==="connecting"?"Connecting to receptionist...":"Start a call to talk to our receptionist"})]}),Z.map((f,_)=>{let N=f.who==="user";return n("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:N?"flex-end":"flex-start"},children:p("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[!N&&n("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[n("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),n("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),n("div",{style:{padding:"10px 14px",borderRadius:N?"14px 14px 2px 14px":"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:N?r:s?"#18181b":"#f4f4f5",color:N?"#ffffff":s?"#fafafa":"#09090b",border:!N&&s?"1px solid #27272a":"none",boxShadow:N?`0 2px 8px ${r}35`:"0 1px 2px rgba(0,0,0,0.04)"},children:f.text})]})},_)}),J&&n("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:"flex-start"},children:p("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[n("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[n("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),n("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),p("div",{style:{padding:"10px 14px",borderRadius:"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:s?"#18181b":"#f4f4f5",color:s?"#a1a1aa":"#71717a",border:s?"1px solid #27272a":"none",boxShadow:"0 1px 2px rgba(0,0,0,0.04)",display:"inline-flex",alignItems:"center",gap:"5px",minHeight:"38px"},title:"Agent is thinking and processing...",children:[n("span",{className:"omnidesk-motion-dot omnidesk-dot-1"}),n("span",{className:"omnidesk-motion-dot omnidesk-dot-2"}),n("span",{className:"omnidesk-motion-dot omnidesk-dot-3"})]})]})})]}),te&&v&&p("div",{style:{padding:"11px 16px",background:"#f0fdf4",borderTop:"1px solid #bbf7d0",display:"flex",flexDirection:"column",gap:"7px",flexShrink:0},children:[p("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"},children:[p("span",{style:{fontSize:"11px",fontWeight:700,color:"#15803d",textTransform:"uppercase",letterSpacing:"0.04em",display:"inline-flex",alignItems:"center",gap:"6px"},children:[n("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:"#22c55e",display:"inline-block"}}),"Email Requested by Agent"]}),n("button",{type:"button",onClick:()=>E(!1),style:{background:"none",border:"none",color:"#15803d",cursor:"pointer",fontSize:"12px",fontWeight:700,padding:"1px 4px"},children:"\u2715"})]}),p("form",{onSubmit:ie,style:{display:"flex",gap:"6px"},children:[n("input",{type:"email",autoFocus:!0,value:U,onChange:f=>de(f.target.value),placeholder:"Enter your email (e.g. name@gmail.com)",required:!0,style:{flex:1,fontSize:"12.5px",padding:"7px 11px",borderRadius:"7px",border:"1px solid #86efac",background:"#ffffff",color:"#09090b",outline:"none"}}),n("button",{type:"submit",disabled:!U.trim(),style:{background:"#16a34a",color:"#ffffff",border:"none",padding:"7px 14px",borderRadius:"7px",fontSize:"12px",fontWeight:600,cursor:U.trim()?"pointer":"not-allowed",opacity:U.trim()?1:.6},children:"Send"})]})]}),p("div",{style:{padding:"12px 16px",borderTop:`1px solid ${s?"#27272a":"#e4e4e7"}`,background:s?"#121214":"#fafafa",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0},children:[p("button",{type:"button",onClick:v?be:A,disabled:y==="connecting",style:{display:"inline-flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:v?"#dc2626":y==="connecting"?"#64748b":r,color:"#ffffff",borderRadius:"10px",border:"none",fontSize:"13px",fontWeight:600,boxShadow:v?"0 4px 14px rgba(220, 38, 38, 0.35)":`0 4px 14px ${r}40`,cursor:y==="connecting"?"not-allowed":"pointer",transition:"all 0.15s ease"},children:[p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[n("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),n("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),n("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]}),n("span",{children:v?"End Voice Call":y==="connecting"?"Connecting...":"Start Voice Call"})]}),p("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[v&&n("div",{style:{display:"flex",alignItems:"center",gap:"2.5px",height:"14px"},children:[12,8,14,6,10].map((f,_)=>n("span",{style:{width:"2.5px",height:`${Math.max(4,Math.min(14,Math.round(f*(.35+Math.max(me,Ce)*1.5))))}px`,background:r,borderRadius:"1px",transition:"height 0.12s ease"}},_))}),n("span",{style:{fontFamily:"var(--mono, monospace)",fontSize:"12px",fontWeight:600,padding:"3px 8px",borderRadius:"6px",background:s?"#18181b":v?"#000000":"#f4f4f5",color:s||v?"#ffffff":"#71717a",border:s?"1px solid #27272a":"none"},children:Se})]})]})]})]})]})}var Fe=$e;var Pe={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function Me(m={}){if(typeof window>"u")return;let{host:c,businessId:k="biz_demo_dental",agentId:S,theme:B="light",position:K="bottom-right",label:M="Talk to Receptionist",accent:F="emerald",accentColor:C,businessName:a,greeting:I,onCallStart:H,onCallEnd:R,onTranscript:z}=m,g=C||Pe[F]||F||"#10b981",ue=document.getElementById("omnidesk-voice-widget-root");ue&&ue.remove();let x=document.createElement("div");x.id="omnidesk-voice-widget-root",x.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let o=B==="dark"||B==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,y=null,O="idle",Z=0,X=null,me=!1,fe=!1,Ce=0,ye=0,Se=!1,ee=!1,j=!1,le=null,te=null,E=!1,U=K==="bottom-left",de=document.createElement("div");de.style.cssText=`
    position: fixed; bottom: 20px; ${U?"left: 20px;":"right: 20px;"};
    z-index: 999999;
  `;let J=document.createElement("button");J.style.cssText=`
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${o?"#18181b":"#ffffff"}; color: ${o?"#fafafa":"#09090b"};
    border: 1px solid ${o?"#27272a":"#e4e4e7"};
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `,J.innerHTML=`
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${g};box-shadow:0 0 8px ${g};display:inline-block;"></span>
    <span>${M}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,de.appendChild(J);let V=document.createElement("div");V.style.cssText=`
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
  `;let L=document.createElement("div");L.style.cssText=`
    background: ${o?"#18181b":"#ffffff"}; color: ${o?"#ffffff":"#09090b"};
    border-bottom: 1px solid ${o?"#27272a":"#e4e4e7"};
    padding: 13px 18px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; user-select: none; flex-shrink: 0;
  `,L.innerHTML=`
    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
      <div style="color: ${o?"rgba(255,255,255,0.6)":"#71717a"}; display: grid; place-items: center; flex-shrink: 0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle>
        </svg>
      </div>
      <div style="width: 28px; height: 28px; border-radius: 50%; background: ${o?"rgba(255,255,255,0.15)":g==="#18181b"?"rgba(24,24,27,0.08)":`${g}18`}; display: grid; place-items: center; flex-shrink: 0; color: ${o?"#ffffff":g==="#18181b"?"#09090b":g};">
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
  `,x.appendChild(G);let w=document.createElement("div");w.style.cssText=`
    flex: 1; min-height: 0; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 12px; background: ${o?"#09090b":"#ffffff"};
  `;let Q=document.createElement("div");Q.id="omnidesk-placeholder-banner",Q.style.cssText=`
    margin: auto; text-align: center; padding: 10px 18px;
    background: ${o?"#18181b":"#f4f4f5"}; border: 1px solid ${o?"#27272a":"#e4e4e7"}; color: ${o?"#a1a1aa":"#52525b"};
    border-radius: 12px; font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px; align-self: center;
  `,Q.innerHTML=`
    <span id="omnidesk-placeholder-dot" style="width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block;"></span>
    <span>Start a call to talk to our receptionist</span>
  `,w.appendChild(Q);let T=document.createElement("div");if(T.id="omnidesk-thinking-bubble",T.style.cssText=`
    display: none; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;
  `,T.innerHTML=`
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
  `,w.appendChild(T),I){Q.style.display="none";let u=document.createElement("div");u.style.cssText="display: flex; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;";let i=document.createElement("div");i.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let e=document.createElement("div");e.style.cssText="width: 24px; height: 24px; border-radius: 50%; background: #18181b; display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;",e.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let b=document.createElement("div");b.style.cssText=`padding: 10px 14px; border-radius: 14px 14px 14px 2px; font-size: 13px; line-height: 1.45; background: ${o?"#18181b":"#f4f4f5"}; color: ${o?"#fafafa":"#09090b"}; border: ${o?"1px solid #27272a":"none"}; box-shadow: 0 1px 2px rgba(0,0,0,0.04);`,b.innerText=I,i.appendChild(e),i.appendChild(b),u.appendChild(i),w.insertBefore(u,T),le="agent",te=b,E=!0}let h=document.createElement("div");h.id="omnidesk-email-bar",h.style.cssText=`
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
  `;let W=document.createElement("div");W.style.cssText=`
    padding: 12px 16px; border-top: 1px solid ${o?"#27272a":"#e4e4e7"};
    background: ${o?"#121214":"#fafafa"}; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  `;let r=document.createElement("button");r.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: ${g}; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    box-shadow: 0 4px 14px ${g}40;
    cursor: pointer; transition: all 0.15s ease;
  `,r.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let s=document.createElement("div");s.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let $=document.createElement("div");$.id="omnidesk-waveform",$.style.cssText="display: none; align-items: center; gap: 2.5px; height: 14px;";let he=[12,8,14,6,10],P=[];he.forEach(u=>{let i=document.createElement("span");i.style.cssText=`width: 2.5px; height: ${Math.round(u*.35)}px; background: ${g}; border-radius: 1px; transition: height 0.12s ease;`,$.appendChild(i),P.push(i)}),s.appendChild($);let A=document.createElement("span");A.id="omnidesk-timer",A.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,A.innerText="0:00",s.appendChild(A),W.appendChild(r),W.appendChild(s),d.appendChild(L),d.appendChild(w),d.appendChild(h),d.appendChild(W),x.appendChild(de),x.appendChild(V),x.appendChild(d),document.body.appendChild(x);function be(){Z=Date.now(),A.innerText="0:00",A.style.background=o?"#18181b":"#000000",A.style.color="#ffffff",A.style.border=o?"1px solid #27272a":"none",X&&clearInterval(X),X=setInterval(()=>{let u=Date.now()-Z,i=Math.floor(u/1e3),e=Math.floor(i/60),b=i%60;A.innerText=`${e}:${String(b).padStart(2,"0")}`},250)}function ie(){X&&(clearInterval(X),X=null),A.style.background="#f4f4f5",A.style.color="#71717a",A.style.border="none",A.innerText="0:00",$.style.display="none"}function se(u){me=u,d.style.display=u?"flex":"none"}function v(u){fe=u,V.style.display=u?"block":"none",u?(d.style.top="50%",d.style.left="50%",d.style.bottom="auto",d.style.right="auto",d.style.transform="translate(-50%, -50%)",d.style.width="calc(100vw - 40px)",d.style.maxWidth="1140px",d.style.height="calc(100vh - 40px)",d.style.maxHeight="900px"):(d.style.top="auto",d.style.left=U?"20px":"auto",d.style.right=U?"auto":"20px",d.style.bottom="80px",d.style.transform="none",d.style.width="390px",d.style.maxWidth="calc(100vw - 32px)",d.style.height="560px",d.style.maxHeight="calc(100vh - 100px)")}J.onclick=()=>se(!me),L.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{se(!1),v(!1)}),L.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{v(!fe)});let f=h.querySelector("#omnidesk-email-form"),_=h.querySelector("#omnidesk-email-input");h.querySelector("#omnidesk-email-close-btn").addEventListener("click",()=>{h.style.display="none"}),f.addEventListener("submit",u=>{u.preventDefault();let i=_.value.trim();!i||!i.includes("@")||(y&&y.sendEmailInput(i),j=!0,h.style.display="none",_.value="",T.style.display="flex",w.scrollTop=w.scrollHeight)});async function q(){Se=!1,ee=!1,j=!1,h.style.display="none",T.style.display="none",le=null,te=null,E=!1;let u=L.querySelector("#omnidesk-status-text"),i=L.querySelector("#omnidesk-status-dot"),e=r.querySelector("#omnidesk-btn-text");u.innerText="Connecting...",i.style.background="#eab308",e.innerText="Connecting...",r.style.background="#64748b",r.style.boxShadow="none",r.disabled=!0,be();try{let b=c;if(!b&&typeof document<"u"){let l=document.querySelector("script[src*='widget.js']");if(l&&l.src&&l.src.startsWith("http"))try{b=new URL(l.src).origin}catch{}}!b&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(b=window.location.origin);let ce=(b||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),we=await fetch(`${ce}/api/token?businessId=${encodeURIComponent(k)}`);if(!we.ok)throw new Error(`Failed to get session token (${we.status})`);let xe=await we.json();if(xe.business_name&&!a){let l=L.querySelector("#omnidesk-biz-title");l&&(l.innerText=xe.business_name)}let Ae=S||xe.agent_id||"";y=new re({onStatusChange:l=>{if(O=l,l==="connected")u.innerText="Live \xB7 Speaking",i.style.background="#22c55e",e.innerText="End Voice Call",r.style.background="#dc2626",r.style.boxShadow="0 4px 14px rgba(220, 38, 38, 0.35)",r.disabled=!1,$.style.display="flex",Z=Date.now(),H?.();else if(l==="idle"&&(u.innerText="Idle \xB7 Ready",i.style.background=o?"rgba(255,255,255,0.4)":"#a1a1aa",e.innerText="Start Voice Call",r.style.background=g,r.style.boxShadow=`0 4px 14px ${g}40`,r.disabled=!1,$.style.display="none",h.style.display="none",T.style.display="none",ie(),Z>0)){let t=Math.round((Date.now()-Z)/1e3);Z=0,R?.(t)}},onThinkingChange:l=>{l&&(T.style.display="flex",w.scrollTop=w.scrollHeight)},onTranscript:l=>{if(Q.style.display="none",l.who==="user"){l.isFinal&&(T.style.display="flex");let t=l.text.toLowerCase();(t==="no"||t.startsWith("no ")||t.includes("no,")||t.includes("wrong")||t.includes("incorrect")||t.includes("change my email")||t.includes("different email"))&&(j=!1),(l.text.includes("@")||t.includes(" at ")&&t.includes(" dot ")||t.includes("gmail.com")||t.includes("yahoo.com")||t.includes("outlook.com")||t.includes("hotmail.com")||t.includes("icloud.com"))&&(h.style.display="none",j=!0)}else if(l.who==="agent"){l.text&&l.text.trim().length>0&&(T.style.display="none");let t=l.text.toLowerCase();if(l.isFinal){if(t.includes("confirmation code is")||t.includes("booking is confirmed")||t.includes("scheduled your appointment")||t.includes("all set, your appointment")||t.includes("sent your confirmation")&&(t.includes("code")||t.includes("calendar invite"))||t.includes("sent a calendar invite")&&(t.includes("code")||t.includes("all set"))){ee=!0,j=!1,h.style.display="none";return}if(ee){h.style.display="none";return}if(t.includes("confirm with yes or no")||t.includes("yes or no")||t.includes("is that correct")||t.includes("is that right")){j=!0,h.style.display="none";return}t.includes("what is your email")||t.includes("what's your email")||t.includes("may i have your email")||t.includes("can i have your email")||t.includes("could i get your email")||t.includes("could you provide your email")||t.includes("provide your email")||t.includes("enter your email")||t.includes("spell your email")||t.includes("share your email")||t.includes("need your email")||t.includes("what email")||t.includes("which email")||t.includes("where can i send your confirmation")||t.includes("where should i send your confirmation")||t.includes("where can i send your calendar")||t.includes("where should i send your calendar")||t.includes("email")&&(t.includes("what is")||t.includes("what's")||t.includes("may i have")||t.includes("can i have")||t.includes("provide")||t.includes("give me")||t.includes("tell me")||t.includes("send your calendar invite")||t.includes("send your confirmation"))?(j=!1,h.style.display="flex",setTimeout(()=>_.focus(),60)):!ee&&!j&&(h.style.display="none")}}if(le===l.who&&te&&!E)te.innerText=l.text,E=!!l.isFinal;else{let t=l.who==="user",oe=document.createElement("div");if(oe.style.cssText=`
              display: flex; flex-direction: column; gap: 4px; max-width: 88%;
              align-self: ${t?"flex-end":"flex-start"};
            `,t){let D=document.createElement("div");D.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 2px 14px;
                font-size: 13px; line-height: 1.45;
                background: ${g};
                color: #ffffff;
                box-shadow: 0 2px 8px ${g}35;
              `,D.innerText=l.text,oe.appendChild(D),te=D}else{let D=document.createElement("div");D.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let ae=document.createElement("div");ae.style.cssText=`
                width: 24px; height: 24px; border-radius: 50%; background: #18181b;
                display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;
              `,ae.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let pe=document.createElement("div");pe.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 14px 2px;
                font-size: 13px; line-height: 1.45;
                background: ${o?"#18181b":"#f4f4f5"};
                color: ${o?"#fafafa":"#09090b"};
                border: ${o?"1px solid #27272a":"none"};
                box-shadow: 0 1px 2px rgba(0,0,0,0.04);
              `,pe.innerText=l.text,D.appendChild(ae),D.appendChild(pe),oe.appendChild(D),te=pe}w.insertBefore(oe,T),le=l.who,E=!!l.isFinal}w.scrollTop=w.scrollHeight,z?.(l)},onAudioLevel:(l,t)=>{if(Ce=l,ye=t,O==="connected"){$.style.display="flex";let oe=Math.max(l,t);he.forEach((D,ae)=>{let pe=Math.max(4,Math.min(14,Math.round(D*(.35+oe*1.5))));P[ae]&&(P[ae].style.height=`${pe}px`)})}},onError:()=>{u.innerText="Error",i.style.background="#ef4444",e.innerText="Start Voice Call",r.style.background=g,r.style.boxShadow=`0 4px 14px ${g}40`,r.disabled=!1,$.style.display="none",h.style.display="none",T.style.display="none",ie()}}),await y.start(xe.token,Ae,xe.voice)}catch(b){console.error("[OmniDesk Voice Widget Error]:",b),u.innerText="Error",i.style.background="#ef4444",e.innerText="Start Voice Call",r.style.background=g,r.style.boxShadow=`0 4px 14px ${g}40`,r.disabled=!1,$.style.display="none",h.style.display="none",T.style.display="none",ie()}}function ke(){y&&(y.stop(),y=null),O="idle";let u=L.querySelector("#omnidesk-status-text"),i=L.querySelector("#omnidesk-status-dot"),e=r.querySelector("#omnidesk-btn-text");u&&(u.innerText="Idle \xB7 Ready"),i&&(i.style.background=o?"rgba(255,255,255,0.4)":"#a1a1aa"),e&&(e.innerText="Start Voice Call"),r.style.background=g,r.style.boxShadow=`0 4px 14px ${g}40`,r.disabled=!1,$.style.display="none",h.style.display="none",T.style.display="none",ee=!1,j=!1,ie()}return r.onclick=()=>{O==="connected"?ke():O==="idle"&&q()},{destroy:()=>{ie(),y&&y.stop(),x.remove()},startCall:q,endCall:ke}}if(typeof document<"u"){let m=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(m){let c,k=m.src||"";if(k&&k.startsWith("http"))try{c=new URL(k).origin}catch{}let S=m.getAttribute("data-business-id")||void 0,B=m.getAttribute("data-agent")||void 0,K=m.getAttribute("data-theme")||"dark",M=m.getAttribute("data-accent")||"emerald",F=m.getAttribute("data-position")||"bottom-right",C=m.getAttribute("data-label")||void 0,a=m.getAttribute("data-host")||c||"https://omni-desk-rho.vercel.app",I=m.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{Me({businessId:S,agentId:B,theme:K,accent:M,position:F,label:C,host:a,greeting:I})}):Me({businessId:S,agentId:B,theme:K,accent:M,position:F,label:C,host:a,greeting:I})}}export{re as AssemblyAIVoiceClient,$e as OmniDeskWidget,Fe as VoiceWidget,Me as initOmniDeskWidget};
//# sourceMappingURL=index.mjs.map