import{useState as Y,useRef as ie,useEffect as Le,useCallback as ge,useMemo as Te}from"react";var ve=24e3,Ie="wss://agents.assemblyai.com/v1/ws",Ae=`
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
`;async function Me(y,c,w){let E=URL.createObjectURL(new Blob([c],{type:"application/javascript"}));try{await y.audioWorklet.addModule(E)}finally{URL.revokeObjectURL(E)}return new AudioWorkletNode(y,w)}var de=class{constructor(c){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.isThinking=!1;this.callbacks=c}setThinking(c){this.isThinking!==c&&(this.isThinking=c,this.callbacks.onThinkingChange?.(c))}async start(c,w,E){try{this.callbacks.onStatusChange?.("connecting");let H=window.AudioContext||window.webkitAudioContext;this.captureCtx=new H({sampleRate:ve}),this.playbackCtx=new H({sampleRate:ve}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await Me(this.playbackCtx,Re,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0}}),this.captureNode=await Me(this.captureCtx,Ae,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let Q=new URL(Ie);Q.searchParams.set("token",c),this.ws=new WebSocket(Q.toString()),this.captureNode.port.onmessage=({data:S})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let a=new Uint8Array(S),W="";for(let N=0;N<a.length;N+=32768)W+=String.fromCharCode.apply(null,Array.from(a.subarray(N,N+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(W)}));let D=new Int16Array(S),F=0;for(let N=0;N<D.length;N+=16)F+=Math.abs(D[N]);this.userLevel=Math.min(1,F/(D.length/16)/8e3)},this.ws.onopen=()=>{let S={};w&&w.trim()?S.agent_id=w.trim():E&&E.trim()&&(S.output={voice:E.trim()}),Object.keys(S).length>0&&this.ws?.send(JSON.stringify({type:"session.update",session:S}))};let L="",z="";this.ws.onmessage=({data:S})=>{try{let a=JSON.parse(S);switch(a.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0,z="",this.setThinking(!1);break;case"transcript.user.delta":a.text&&(z=a.text,this.callbacks.onTranscript?.({who:"user",text:a.text,isFinal:!1}));break;case"transcript.user":a.text&&(z=a.text,this.callbacks.onTranscript?.({who:"user",text:a.text,isFinal:!0}),this.setThinking(!0));break;case"reply.started":L="";break;case"transcript.agent.delta":a.delta&&(this.setThinking(!1),L&&!L.endsWith(" ")&&!/^[.,!?;:%)]/.test(a.delta)?L+=" "+a.delta:L+=a.delta,this.callbacks.onTranscript?.({who:"agent",text:L,isFinal:!1}));break;case"transcript.agent":a.text&&(this.setThinking(!1),L=a.text,this.callbacks.onTranscript?.({who:"agent",text:a.text,isFinal:!0}));break;case"reply.audio":if(a.data&&this.playbackNode){let W=atob(a.data),D=new Uint8Array(W.length);for(let F=0;F<W.length;F++)D[F]=W.charCodeAt(F);this.playbackNode.port.postMessage(D.buffer,[D.buffer]),this.agentLevel=.8}break;case"reply.done":a.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:a.name||a.tool,args:a.arguments||a.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:a.name||a.tool,result:a.result});break;case"session.error":this.setThinking(!1),this.callbacks.onError?.(a.message||a.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.setThinking(!1),this.stop();break}}catch(a){console.warn("Message parsing error:",a)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(H){this.callbacks.onError?.(H.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(c){this.isMuted=c,c&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(c,w){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:c})),w&&this.ws.send(JSON.stringify({type:"reply.create",instructions:w})),!0}catch(E){return console.error("Failed to send message to agent:",E),!1}}sendEmailInput(c){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:`My email is ${c}`})),this.ws.send(JSON.stringify({type:"reply.create",instructions:`The caller has entered and verified their email address: ${c}. Do not ask for their email again. Immediately speak: "I have verified your email as ${c}. Can you please confirm with yes or no?" Then stop speaking and wait for their yes or no answer.`})),!0}catch(w){return console.error("Failed to send email to agent:",w),!1}}stop(){if(this.setThinking(!1),this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(c=>c.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let c=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(c)};this.animFrameId=requestAnimationFrame(c)}};import{Fragment as ze,jsx as i,jsxs as p}from"react/jsx-runtime";var We={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function $e({host:y="",businessId:c="biz_demo_dental",agentId:w,theme:E="light",position:H="bottom-right",label:Q="Talk to Receptionist",accent:L="emerald",accentColor:z,businessName:S,greeting:a,className:W,onCallStart:D,onCallEnd:F,onTranscript:N}){let[g,ue]=Y(!1),[m,o]=Y(!1),[b,j]=Y("idle"),[J,X]=Y([]),[me,fe]=Y(0),[Ce,ye]=Y(0),[Se,ne]=Y("0:00"),[V,se]=Y(S||"OmniDesk Hair Salon & Studio"),[ee,v]=Y(!1),[U,ce]=Y(""),[Z,O]=Y(!1),d=ie(null),$=ie(null),G=ie(0),k=ie(null),K=ie(0),T=ie(!1),f=ie(!1),_=ie(!1),r=Te(()=>z||We[L]||L||"#10b981",[L,z]),s=Te(()=>E==="dark"?!0:E==="auto"&&typeof window<"u"?window.matchMedia("(prefers-color-scheme: dark)").matches:!1,[E]);Le(()=>{$.current&&($.current.scrollTop=$.current.scrollHeight)},[J,Z]);let I=Te(()=>y?y.replace(/\/$/,""):typeof window<"u"&&window.location.origin?window.location.origin:"",[y]),he=ge(()=>{K.current=Date.now(),ne("0:00"),k.current&&clearInterval(k.current),k.current=setInterval(()=>{let h=Date.now()-K.current,M=Math.floor(h/1e3),R=Math.floor(M/60),q=M%60;ne(`${R}:${String(q).padStart(2,"0")}`)},250)},[]),P=ge(()=>{k.current&&(clearInterval(k.current),k.current=null)},[]),A=ge(async()=>{try{j("connecting"),T.current=!1,f.current=!1,_.current=!1,v(!1),he();let M=`${I?I.replace(/\/$/,""):""}/api/token?businessId=${encodeURIComponent(c)}`,R=await fetch(M);if(!R.ok)throw new Error("Failed to initialize voice session");let q=await R.json();if(q.business_name&&!S&&se(q.business_name),!q.token)throw new Error("Invalid session token payload received from host");let ke=w||q.agent_id||"",u=new de({onStatusChange:n=>{if(j(n),n==="connected")G.current=Date.now(),D?.();else if(n==="idle"){if(O(!1),P(),G.current>0){let e=Math.round((Date.now()-G.current)/1e3);G.current=0,F?.(e)}}else n==="error"&&(O(!1),P())},onThinkingChange:n=>{n&&O(!0)},onTranscript:n=>{if(n.who==="user"?O(!0):n.who==="agent"&&n.text&&n.text.trim().length>0&&O(!1),X(e=>{let x=e[e.length-1];if(x&&x.who===n.who&&!x.isFinal){let re=[...e];return re[re.length-1]={...x,text:n.text,isFinal:n.isFinal??!1},re}return[...e,{id:n.id||`${Date.now()}-${Math.random()}`,who:n.who,text:n.text,isFinal:n.isFinal??!1}]}),N?.(n),n.who==="user"){let e=n.text.toLowerCase().trim();(e==="no"||e.startsWith("no ")||e.includes("no,")||e.includes("wrong")||e.includes("incorrect")||e.includes("change my email")||e.includes("different email")||e.includes("that's not right")||e.includes("thats not right")||e.includes("not right")||e.includes("not my email"))&&(_.current=!1,v(!0)),(e==="yes"||e.startsWith("yes ")||e.includes("yes,")||e==="yeah"||e.startsWith("yeah ")||e==="yep"||e==="correct"||e.includes("that's right")||e.includes("thats right")||e.includes("sounds good")||e==="confirm"||e==="sure")&&_.current&&(_.current=!1,v(!1)),(n.text.includes("@")||e.includes(" at ")&&e.includes(" dot ")||e.includes("gmail.com")||e.includes("yahoo.com")||e.includes("outlook.com")||e.includes("hotmail.com")||e.includes("icloud.com"))&&(v(!1),_.current=!0)}else if(n.who==="agent"){let e=n.text.toLowerCase();if(e.includes("confirmation code is")||e.includes("booking is confirmed")||e.includes("scheduled your appointment")||e.includes("all set, your appointment")||e.includes("sent your confirmation")&&(e.includes("code")||e.includes("calendar invite"))||e.includes("sent a calendar invite")&&(e.includes("code")||e.includes("all set"))){f.current=!0,_.current=!1,v(!1);return}if(f.current){v(!1);return}if(e.includes("confirm with yes or no")||e.includes("yes or no")||e.includes("is that correct")||e.includes("is that right")||e.includes("verified your email")||e.includes("checking that email")||e.includes("let me check that email")){_.current=!0,v(!1);return}!_.current&&(e.includes("what is your email")||e.includes("what's your email")||e.includes("whats your email")||e.includes("may i have your email")||e.includes("can i have your email")||e.includes("could i have your email")||e.includes("could i get your email")||e.includes("could you provide your email")||e.includes("can you provide your email")||e.includes("provide your email")||e.includes("enter your email")||e.includes("share your email")||e.includes("need your email")||e.includes("what is your correct email")||e.includes("provide your correct email")||e.includes("where can i send your confirmation")||e.includes("where should i send your confirmation")||e.includes("where can i send your calendar")||e.includes("where should i send your calendar")||e.includes("email address")&&(e.includes("what is")||e.includes("what's")||e.includes("whats")||e.includes("may i have")||e.includes("can i have")||e.includes("could i have")||e.includes("could you provide")||e.includes("can you provide")||e.includes("provide")||e.includes("share")||e.includes("so i can send")||e.includes("to send your")))?v(!0):n.isFinal&&v(!1)}},onAudioLevel:(n,e)=>{fe(n),ye(e)},onError:()=>{j("error"),P()}});d.current=u,await u.start(q.token,ke,q.voice)}catch{j("error"),P()}},[I,c,w,S,D,F,N,he,P]),be=ge(()=>{if(d.current&&(d.current.stop(),d.current=null),j("idle"),O(!1),fe(0),ye(0),P(),f.current=!1,_.current=!1,v(!1),G.current>0){let h=Math.round((Date.now()-G.current)/1e3);G.current=0,F?.(h)}},[F,P]),oe=ge(h=>{h.preventDefault();let M=U.trim();M&&(X(R=>[...R,{who:"user",text:`My email is ${M}`,isFinal:!0}]),d.current&&d.current.sendEmailInput(M),O(!0),_.current=!0,ce(""),v(!1))},[U]);Le(()=>()=>{P(),d.current&&d.current.stop()},[P]);let ae=H==="bottom-left",C=b==="connected";return p("div",{className:W,style:{position:"relative",zIndex:99999},children:[i("div",{style:{position:"fixed",bottom:"20px",left:ae?"20px":"auto",right:ae?"auto":"20px",zIndex:99999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:p("button",{type:"button",onClick:()=>ue(!g),style:{display:"inline-flex",alignItems:"center",gap:"10px",background:s?"#18181b":"#ffffff",color:s?"#fafafa":"#09090b",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,padding:"10px 18px",borderRadius:"9999px",cursor:"pointer",fontSize:"13px",fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.18)",transition:"transform 0.15s ease, background 0.15s ease"},onMouseEnter:h=>{h.currentTarget.style.transform="scale(1.02)"},onMouseLeave:h=>{h.currentTarget.style.transform="scale(1)"},children:[i("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:C?"#ef4444":r,boxShadow:`0 0 8px ${C?"#ef4444":r}`}}),i("span",{children:Q}),i("span",{style:{fontSize:"11px",opacity:.6},children:"\u25B2"})]})}),g&&p(ze,{children:[m&&i("div",{onClick:()=>o(!1),style:{position:"fixed",inset:0,background:"rgba(0, 0, 0, 0.7)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",zIndex:999998}}),p("div",{style:{position:"fixed",bottom:m?"auto":"80px",left:m?"50%":ae?"20px":"auto",right:m||ae?"auto":"20px",top:m?"50%":"auto",transform:m?"translate(-50%, -50%)":"none",width:m?"calc(100vw - 40px)":"390px",maxWidth:m?"1140px":"calc(100vw - 32px)",height:m?"calc(100vh - 40px)":"560px",maxHeight:m?"900px":"calc(100vh - 100px)",background:s?"#09090b":"#ffffff",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,borderRadius:"20px",boxShadow:m?"0 32px 64px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)":"0 24px 48px -12px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:999999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",transition:"all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"},children:[i("style",{children:`
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
            `}),p("div",{style:{background:s?"#18181b":"#ffffff",color:s?"#ffffff":"#09090b",borderBottom:`1px solid ${s?"#27272a":"#e4e4e7"}`,padding:m?"16px 22px":"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",userSelect:"none",flexShrink:0},children:[p("div",{style:{display:"flex",alignItems:"center",gap:"10px",minWidth:0},children:[i("div",{style:{color:s?"rgba(255,255,255,0.6)":"#71717a",display:"grid",placeItems:"center",flexShrink:0},children:p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("circle",{cx:"12",cy:"12",r:"1"}),i("circle",{cx:"12",cy:"5",r:"1"}),i("circle",{cx:"12",cy:"19",r:"1"})]})}),i("div",{style:{width:"28px",height:"28px",borderRadius:"50%",background:s?"rgba(255,255,255,0.15)":r==="#18181b"?"rgba(24,24,27,0.08)":`${r}18`,display:"grid",placeItems:"center",flexShrink:0,color:s?"#ffffff":r==="#18181b"?"#09090b":r},children:p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),i("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),i("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]})}),p("div",{style:{display:"flex",flexDirection:"column",minWidth:0},children:[i("div",{style:{fontSize:"13.5px",fontWeight:600,color:s?"#ffffff":"#09090b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},children:V}),p("div",{style:{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"11px",color:s?"rgba(255,255,255,0.75)":"#71717a"},children:[i("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:C?Z?"#f59e0b":"#22c55e":b==="connecting"?"#eab308":s?"rgba(255,255,255,0.4)":"#a1a1aa",animation:Z?"omnidesk-pulse-amber 1.5s infinite":"none"}}),i("span",{children:C?Z?"Thinking \xB7 Checking tools...":"Live \xB7 Speaking":b==="connecting"?"Connecting...":b==="error"?"Error":"Idle \xB7 Ready"})]})]})]}),p("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[i("button",{type:"button",onClick:()=>o(!m),title:m?"Exit Fullscreen":"Open Full",style:{background:s?"rgba(255,255,255,0.1)":"#f4f4f5",border:s?"1px solid rgba(255,255,255,0.15)":"1px solid #e4e4e7",borderRadius:"7px",color:s?"#ffffff":"#52525b",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:h=>h.currentTarget.style.background=s?"rgba(255,255,255,0.2)":"#e4e4e7",onMouseLeave:h=>h.currentTarget.style.background=s?"rgba(255,255,255,0.1)":"#f4f4f5",children:m?p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("polyline",{points:"4 14 10 14 10 20"}),i("polyline",{points:"20 10 14 10 14 4"}),i("line",{x1:"14",y1:"10",x2:"21",y2:"3"}),i("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]}):p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("polyline",{points:"15 3 21 3 21 9"}),i("polyline",{points:"9 21 3 21 3 15"}),i("line",{x1:"21",y1:"3",x2:"14",y2:"10"}),i("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]})}),i("button",{type:"button",onClick:()=>{C&&be(),ue(!1)},title:"Close Widget",style:{background:s?"rgba(255,255,255,0.1)":"#f4f4f5",border:s?"1px solid rgba(255,255,255,0.15)":"1px solid #e4e4e7",borderRadius:"7px",color:s?"#ffffff":"#52525b",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:h=>h.currentTarget.style.background=s?"rgba(255,255,255,0.2)":"#e4e4e7",onMouseLeave:h=>h.currentTarget.style.background=s?"rgba(255,255,255,0.1)":"#f4f4f5",children:p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("line",{x1:"18",y1:"6",x2:"6",y2:"18"}),i("line",{x1:"6",y1:"6",x2:"18",y2:"18"})]})})]})]}),p("div",{ref:$,style:{flex:1,minHeight:0,padding:"16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"12px",background:s?"#09090b":"#ffffff"},children:[J.length===0&&p("div",{style:{margin:"auto",textAlign:"center",padding:"10px 18px",background:s?"#18181b":"#f4f4f5",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,color:s?"#a1a1aa":"#52525b",borderRadius:"12px",fontSize:"12.5px",fontWeight:500,display:"inline-flex",alignItems:"center",gap:"8px",alignSelf:"center"},children:[i("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:C?"#22c55e":b==="connecting"?"#eab308":"#a1a1aa",display:"inline-block"}}),i("span",{children:C?"Connected \xB7 Speak to our receptionist":b==="connecting"?"Connecting to receptionist...":"Start a call to talk to our receptionist"})]}),J.map((h,M)=>{let R=h.who==="user";return i("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:R?"flex-end":"flex-start"},children:p("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[!R&&i("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),i("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),i("div",{style:{padding:"10px 14px",borderRadius:R?"14px 14px 2px 14px":"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:R?r:s?"#18181b":"#f4f4f5",color:R?"#ffffff":s?"#fafafa":"#09090b",border:!R&&s?"1px solid #27272a":"none",boxShadow:R?`0 2px 8px ${r}35`:"0 1px 2px rgba(0,0,0,0.04)"},children:h.text})]})},M)}),Z&&i("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:"flex-start"},children:p("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[i("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),i("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),p("div",{style:{padding:"10px 14px",borderRadius:"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:s?"#18181b":"#f4f4f5",color:s?"#a1a1aa":"#71717a",border:s?"1px solid #27272a":"none",boxShadow:"0 1px 2px rgba(0,0,0,0.04)",display:"inline-flex",alignItems:"center",gap:"5px",minHeight:"38px"},title:"Agent is thinking and processing...",children:[i("span",{className:"omnidesk-motion-dot omnidesk-dot-1"}),i("span",{className:"omnidesk-motion-dot omnidesk-dot-2"}),i("span",{className:"omnidesk-motion-dot omnidesk-dot-3"})]})]})})]}),ee&&C&&p("div",{style:{padding:"11px 16px",background:"#f0fdf4",borderTop:"1px solid #bbf7d0",display:"flex",flexDirection:"column",gap:"7px",flexShrink:0},children:[p("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"},children:[p("span",{style:{fontSize:"11px",fontWeight:700,color:"#15803d",textTransform:"uppercase",letterSpacing:"0.04em",display:"inline-flex",alignItems:"center",gap:"6px"},children:[i("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:"#22c55e",display:"inline-block"}}),"Email Requested by Agent"]}),i("button",{type:"button",onClick:()=>v(!1),style:{background:"none",border:"none",color:"#15803d",cursor:"pointer",fontSize:"12px",fontWeight:700,padding:"1px 4px"},children:"\u2715"})]}),p("form",{onSubmit:oe,style:{display:"flex",gap:"6px"},children:[i("input",{type:"email",autoFocus:!0,value:U,onChange:h=>ce(h.target.value),placeholder:"Enter your email (e.g. name@gmail.com)",required:!0,style:{flex:1,fontSize:"12.5px",padding:"7px 11px",borderRadius:"7px",border:"1px solid #86efac",background:"#ffffff",color:"#09090b",outline:"none"}}),i("button",{type:"submit",disabled:!U.trim(),style:{background:"#16a34a",color:"#ffffff",border:"none",padding:"7px 14px",borderRadius:"7px",fontSize:"12px",fontWeight:600,cursor:U.trim()?"pointer":"not-allowed",opacity:U.trim()?1:.6},children:"Send"})]})]}),p("div",{style:{padding:"12px 16px",borderTop:`1px solid ${s?"#27272a":"#e4e4e7"}`,background:s?"#121214":"#fafafa",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0},children:[p("button",{type:"button",onClick:C?be:A,disabled:b==="connecting",style:{display:"inline-flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:C?"#dc2626":b==="connecting"?"#64748b":r,color:"#ffffff",borderRadius:"10px",border:"none",fontSize:"13px",fontWeight:600,boxShadow:C?"0 4px 14px rgba(220, 38, 38, 0.35)":`0 4px 14px ${r}40`,cursor:b==="connecting"?"not-allowed":"pointer",transition:"all 0.15s ease"},children:[p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),i("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),i("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]}),i("span",{children:C?"End Voice Call":b==="connecting"?"Connecting...":"Start Voice Call"})]}),p("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[C&&i("div",{style:{display:"flex",alignItems:"center",gap:"2.5px",height:"14px"},children:[12,8,14,6,10].map((h,M)=>i("span",{style:{width:"2.5px",height:`${Math.max(4,Math.min(14,Math.round(h*(.35+Math.max(me,Ce)*1.5))))}px`,background:r,borderRadius:"1px",transition:"height 0.12s ease"}},M))}),i("span",{style:{fontFamily:"var(--mono, monospace)",fontSize:"12px",fontWeight:600,padding:"3px 8px",borderRadius:"6px",background:s?"#18181b":C?"#000000":"#f4f4f5",color:s||C?"#ffffff":"#71717a",border:s?"1px solid #27272a":"none"},children:Se})]})]})]})]})]})}var Fe=$e;var Ne={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function Ee(y={}){if(typeof window>"u")return;let{host:c,businessId:w="biz_demo_dental",agentId:E,theme:H="light",position:Q="bottom-right",label:L="Talk to Receptionist",accent:z="emerald",accentColor:S,businessName:a,greeting:W,onCallStart:D,onCallEnd:F,onTranscript:N}=y,g=S||Ne[z]||z||"#10b981",ue=document.getElementById("omnidesk-voice-widget-root");ue&&ue.remove();let m=document.createElement("div");m.id="omnidesk-voice-widget-root",m.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let o=H==="dark"||H==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,b=null,j="idle",J=0,X=null,me=!1,fe=!1,Ce=0,ye=0,Se=!1,ne=!1,V=!1,se=null,ee=null,v=!1,U=Q==="bottom-left",ce=document.createElement("div");ce.style.cssText=`
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
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${g};box-shadow:0 0 8px ${g};display:inline-block;"></span>
    <span>${L}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,ce.appendChild(Z);let O=document.createElement("div");O.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,O.onclick=()=>C(!1);let d=document.createElement("div");d.style.cssText=`
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
  `,k.appendChild(K);let T=document.createElement("div");if(T.id="omnidesk-thinking-bubble",T.style.cssText=`
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
  `,k.appendChild(T),W){K.style.display="none";let u=document.createElement("div");u.style.cssText="display: flex; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;";let n=document.createElement("div");n.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let e=document.createElement("div");e.style.cssText="width: 24px; height: 24px; border-radius: 50%; background: #18181b; display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;",e.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let x=document.createElement("div");x.style.cssText=`padding: 10px 14px; border-radius: 14px 14px 14px 2px; font-size: 13px; line-height: 1.45; background: ${o?"#18181b":"#f4f4f5"}; color: ${o?"#fafafa":"#09090b"}; border: ${o?"1px solid #27272a":"none"}; box-shadow: 0 1px 2px rgba(0,0,0,0.04);`,x.innerText=W,n.appendChild(e),n.appendChild(x),u.appendChild(n),k.insertBefore(u,T),se="agent",ee=x,v=!0}let f=document.createElement("div");f.id="omnidesk-email-bar",f.style.cssText=`
    padding: 11px 16px; background: #f0fdf4; border-top: 1px solid #bbf7d0;
    display: none; flex-direction: column; gap: 7px; flex-shrink: 0;
  `,f.innerHTML=`
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
  `;let _=document.createElement("div");_.style.cssText=`
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
  `;let I=document.createElement("div");I.id="omnidesk-waveform",I.style.cssText="display: none; align-items: center; gap: 2.5px; height: 14px;";let he=[12,8,14,6,10],P=[];he.forEach(u=>{let n=document.createElement("span");n.style.cssText=`width: 2.5px; height: ${Math.round(u*.35)}px; background: ${g}; border-radius: 1px; transition: height 0.12s ease;`,I.appendChild(n),P.push(n)}),s.appendChild(I);let A=document.createElement("span");A.id="omnidesk-timer",A.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,A.innerText="0:00",s.appendChild(A),_.appendChild(r),_.appendChild(s),d.appendChild($),d.appendChild(k),d.appendChild(f),d.appendChild(_),m.appendChild(ce),m.appendChild(O),m.appendChild(d),document.body.appendChild(m);function be(){J=Date.now(),A.innerText="0:00",A.style.background=o?"#18181b":"#000000",A.style.color="#ffffff",A.style.border=o?"1px solid #27272a":"none",X&&clearInterval(X),X=setInterval(()=>{let u=Date.now()-J,n=Math.floor(u/1e3),e=Math.floor(n/60),x=n%60;A.innerText=`${e}:${String(x).padStart(2,"0")}`},250)}function oe(){X&&(clearInterval(X),X=null),A.style.background="#f4f4f5",A.style.color="#71717a",A.style.border="none",A.innerText="0:00",I.style.display="none"}function ae(u){me=u,d.style.display=u?"flex":"none"}function C(u){fe=u,O.style.display=u?"block":"none",u?(d.style.top="50%",d.style.left="50%",d.style.bottom="auto",d.style.right="auto",d.style.transform="translate(-50%, -50%)",d.style.width="calc(100vw - 40px)",d.style.maxWidth="1140px",d.style.height="calc(100vh - 40px)",d.style.maxHeight="900px"):(d.style.top="auto",d.style.left=U?"20px":"auto",d.style.right=U?"auto":"20px",d.style.bottom="80px",d.style.transform="none",d.style.width="390px",d.style.maxWidth="calc(100vw - 32px)",d.style.height="560px",d.style.maxHeight="calc(100vh - 100px)")}Z.onclick=()=>ae(!me),$.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{ae(!1),C(!1)}),$.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{C(!fe)});let h=f.querySelector("#omnidesk-email-form"),M=f.querySelector("#omnidesk-email-input");f.querySelector("#omnidesk-email-close-btn").addEventListener("click",()=>{f.style.display="none"}),h.addEventListener("submit",u=>{u.preventDefault();let n=M.value.trim();if(!n||!n.includes("@"))return;b&&b.sendEmailInput(n),V=!0,f.style.display="none",M.value="",K.style.display="none";let e=document.createElement("div");e.style.cssText=`
      display: flex; flex-direction: column; gap: 4px; max-width: 88%;
      align-self: flex-end;
    `;let x=document.createElement("div");x.style.cssText=`
      padding: 10px 14px; border-radius: 14px 14px 2px 14px;
      font-size: 13px; line-height: 1.45;
      background: ${g}; color: #ffffff;
      box-shadow: 0 2px 8px ${g}35;
    `,x.innerText=`My email is ${n}`,e.appendChild(x),k.insertBefore(e,T),T.style.display="flex",k.scrollTop=k.scrollHeight,se="user",ee=x,v=!0});async function q(){Se=!1,ne=!1,V=!1,f.style.display="none",T.style.display="none",se=null,ee=null,v=!1;let u=$.querySelector("#omnidesk-status-text"),n=$.querySelector("#omnidesk-status-dot"),e=r.querySelector("#omnidesk-btn-text");u.innerText="Connecting...",n.style.background="#eab308",e.innerText="Connecting...",r.style.background="#64748b",r.style.boxShadow="none",r.disabled=!0,be();try{let x=c;if(!x&&typeof document<"u"){let l=document.querySelector("script[src*='widget.js']");if(l&&l.src&&l.src.startsWith("http"))try{x=new URL(l.src).origin}catch{}}!x&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(x=window.location.origin);let re=(x||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),we=await fetch(`${re}/api/token?businessId=${encodeURIComponent(w)}`);if(!we.ok)throw new Error(`Failed to get session token (${we.status})`);let xe=await we.json();if(xe.business_name&&!a){let l=$.querySelector("#omnidesk-biz-title");l&&(l.innerText=xe.business_name)}let _e=E||xe.agent_id||"";b=new de({onStatusChange:l=>{if(j=l,l==="connected")u.innerText="Live \xB7 Speaking",n.style.background="#22c55e",e.innerText="End Voice Call",r.style.background="#dc2626",r.style.boxShadow="0 4px 14px rgba(220, 38, 38, 0.35)",r.disabled=!1,I.style.display="flex",J=Date.now(),D?.();else if(l==="idle"&&(u.innerText="Idle \xB7 Ready",n.style.background=o?"rgba(255,255,255,0.4)":"#a1a1aa",e.innerText="Start Voice Call",r.style.background=g,r.style.boxShadow=`0 4px 14px ${g}40`,r.disabled=!1,I.style.display="none",f.style.display="none",T.style.display="none",oe(),J>0)){let t=Math.round((Date.now()-J)/1e3);J=0,F?.(t)}},onThinkingChange:l=>{l&&(T.style.display="flex",k.scrollTop=k.scrollHeight)},onTranscript:l=>{if(K.style.display="none",l.who==="user"){l.isFinal&&(T.style.display="flex");let t=l.text.toLowerCase().trim();(t==="no"||t.startsWith("no ")||t.includes("no,")||t.includes("wrong")||t.includes("incorrect")||t.includes("change my email")||t.includes("different email")||t.includes("that's not right")||t.includes("thats not right")||t.includes("not right")||t.includes("not my email"))&&(V=!1,f.style.display="flex",setTimeout(()=>M.focus(),60)),(t==="yes"||t.startsWith("yes ")||t.includes("yes,")||t==="yeah"||t.startsWith("yeah ")||t==="yep"||t==="correct"||t.includes("that's right")||t.includes("thats right")||t.includes("sounds good")||t==="confirm"||t==="sure")&&V&&(V=!1,f.style.display="none"),(l.text.includes("@")||t.includes(" at ")&&t.includes(" dot ")||t.includes("gmail.com")||t.includes("yahoo.com")||t.includes("outlook.com")||t.includes("hotmail.com")||t.includes("icloud.com"))&&(f.style.display="none",V=!0)}else if(l.who==="agent"){l.text&&l.text.trim().length>0&&(T.style.display="none");let t=l.text.toLowerCase();if(t.includes("confirmation code is")||t.includes("booking is confirmed")||t.includes("scheduled your appointment")||t.includes("all set, your appointment")||t.includes("sent your confirmation")&&(t.includes("code")||t.includes("calendar invite"))||t.includes("sent a calendar invite")&&(t.includes("code")||t.includes("all set"))){ne=!0,V=!1,f.style.display="none";return}if(ne){f.style.display="none";return}if(t.includes("confirm with yes or no")||t.includes("yes or no")||t.includes("is that correct")||t.includes("is that right")||t.includes("verified your email")||t.includes("checking that email")||t.includes("let me check that email")){V=!0,f.style.display="none";return}!V&&(t.includes("what is your email")||t.includes("what's your email")||t.includes("whats your email")||t.includes("may i have your email")||t.includes("can i have your email")||t.includes("could i have your email")||t.includes("could i get your email")||t.includes("could you provide your email")||t.includes("can you provide your email")||t.includes("provide your email")||t.includes("enter your email")||t.includes("share your email")||t.includes("need your email")||t.includes("what is your correct email")||t.includes("provide your correct email")||t.includes("where can i send your confirmation")||t.includes("where should i send your confirmation")||t.includes("where can i send your calendar")||t.includes("where should i send your calendar")||t.includes("email address")&&(t.includes("what is")||t.includes("what's")||t.includes("whats")||t.includes("may i have")||t.includes("can i have")||t.includes("could i have")||t.includes("could you provide")||t.includes("can you provide")||t.includes("provide")||t.includes("share")||t.includes("so i can send")||t.includes("to send your")))?(f.style.display="flex",setTimeout(()=>M.focus(),60)):l.isFinal&&(f.style.display="none")}if(se===l.who&&ee&&!v)ee.innerText=l.text,v=!!l.isFinal;else{let t=l.who==="user",te=document.createElement("div");if(te.style.cssText=`
              display: flex; flex-direction: column; gap: 4px; max-width: 88%;
              align-self: ${t?"flex-end":"flex-start"};
            `,t){let B=document.createElement("div");B.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 2px 14px;
                font-size: 13px; line-height: 1.45;
                background: ${g};
                color: #ffffff;
                box-shadow: 0 2px 8px ${g}35;
              `,B.innerText=l.text,te.appendChild(B),ee=B}else{let B=document.createElement("div");B.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let le=document.createElement("div");le.style.cssText=`
                width: 24px; height: 24px; border-radius: 50%; background: #18181b;
                display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;
              `,le.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let pe=document.createElement("div");pe.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 14px 2px;
                font-size: 13px; line-height: 1.45;
                background: ${o?"#18181b":"#f4f4f5"};
                color: ${o?"#fafafa":"#09090b"};
                border: ${o?"1px solid #27272a":"none"};
                box-shadow: 0 1px 2px rgba(0,0,0,0.04);
              `,pe.innerText=l.text,B.appendChild(le),B.appendChild(pe),te.appendChild(B),ee=pe}k.insertBefore(te,T),se=l.who,v=!!l.isFinal}k.scrollTop=k.scrollHeight,N?.(l)},onAudioLevel:(l,t)=>{if(Ce=l,ye=t,j==="connected"){I.style.display="flex";let te=Math.max(l,t);he.forEach((B,le)=>{let pe=Math.max(4,Math.min(14,Math.round(B*(.35+te*1.5))));P[le]&&(P[le].style.height=`${pe}px`)})}},onError:()=>{u.innerText="Error",n.style.background="#ef4444",e.innerText="Start Voice Call",r.style.background=g,r.style.boxShadow=`0 4px 14px ${g}40`,r.disabled=!1,I.style.display="none",f.style.display="none",T.style.display="none",oe()}}),await b.start(xe.token,_e,xe.voice)}catch(x){console.error("[OmniDesk Voice Widget Error]:",x),u.innerText="Error",n.style.background="#ef4444",e.innerText="Start Voice Call",r.style.background=g,r.style.boxShadow=`0 4px 14px ${g}40`,r.disabled=!1,I.style.display="none",f.style.display="none",T.style.display="none",oe()}}function ke(){b&&(b.stop(),b=null),j="idle";let u=$.querySelector("#omnidesk-status-text"),n=$.querySelector("#omnidesk-status-dot"),e=r.querySelector("#omnidesk-btn-text");u&&(u.innerText="Idle \xB7 Ready"),n&&(n.style.background=o?"rgba(255,255,255,0.4)":"#a1a1aa"),e&&(e.innerText="Start Voice Call"),r.style.background=g,r.style.boxShadow=`0 4px 14px ${g}40`,r.disabled=!1,I.style.display="none",f.style.display="none",T.style.display="none",ne=!1,V=!1,oe()}return r.onclick=()=>{j==="connected"?ke():j==="idle"&&q()},{destroy:()=>{oe(),b&&b.stop(),m.remove()},startCall:q,endCall:ke}}if(typeof document<"u"){let y=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(y){let c,w=y.src||"";if(w&&w.startsWith("http"))try{c=new URL(w).origin}catch{}let E=y.getAttribute("data-business-id")||void 0,H=y.getAttribute("data-agent")||void 0,Q=y.getAttribute("data-theme")||"dark",L=y.getAttribute("data-accent")||"emerald",z=y.getAttribute("data-position")||"bottom-right",S=y.getAttribute("data-label")||void 0,a=y.getAttribute("data-host")||c||"https://omni-desk-rho.vercel.app",W=y.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{Ee({businessId:E,agentId:H,theme:Q,accent:L,position:z,label:S,host:a,greeting:W})}):Ee({businessId:E,agentId:H,theme:Q,accent:L,position:z,label:S,host:a,greeting:W})}}export{de as AssemblyAIVoiceClient,$e as OmniDeskWidget,Fe as VoiceWidget,Ee as initOmniDeskWidget};
//# sourceMappingURL=index.mjs.map