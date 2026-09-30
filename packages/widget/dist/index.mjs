import{useState as q,useRef as ne,useEffect as Le,useCallback as ge,useMemo as Te}from"react";var ve=24e3,Ie="wss://agents.us.assemblyai.com/v1/ws",Ae=`
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
`;async function Me(y,p,w){let T=URL.createObjectURL(new Blob([p],{type:"application/javascript"}));try{await y.audioWorklet.addModule(T)}finally{URL.revokeObjectURL(T)}return new AudioWorkletNode(y,w)}var ce=class{constructor(p){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.isThinking=!1;this.callbacks=p}setThinking(p){this.isThinking!==p&&(this.isThinking=p,this.callbacks.onThinkingChange?.(p))}async start(p,w,T,Y){try{this.callbacks.onStatusChange?.("connecting");let O=window.AudioContext||window.webkitAudioContext;this.captureCtx=new O({sampleRate:ve}),this.playbackCtx=new O({sampleRate:ve}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await Me(this.playbackCtx,Re,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0}}),this.captureNode=await Me(this.captureCtx,Ae,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let J=Y&&Y.trim()||Ie,P=new URL(J);P.searchParams.set("token",p),this.ws=new WebSocket(P.toString()),this.captureNode.port.onmessage=({data:E})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let a=new Uint8Array(E),F="";for(let W=0;W<a.length;W+=32768)F+=String.fromCharCode.apply(null,Array.from(a.subarray(W,W+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(F)}));let B=new Int16Array(E),c=0;for(let W=0;W<B.length;W+=16)c+=Math.abs(B[W]);this.userLevel=Math.min(1,c/(B.length/16)/8e3)},this.ws.onopen=()=>{let E={};w&&w.trim()?E.agent_id=w.trim():T&&T.trim()&&(E.output={voice:T.trim()}),Object.keys(E).length>0&&this.ws?.send(JSON.stringify({type:"session.update",session:E}))};let L="",Z="";this.ws.onmessage=({data:E})=>{try{let a=JSON.parse(E);switch(a.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0,Z="",this.setThinking(!1);break;case"transcript.user.delta":a.text&&(Z=a.text,this.callbacks.onTranscript?.({who:"user",text:a.text,isFinal:!1}));break;case"transcript.user":a.text&&(Z=a.text,this.callbacks.onTranscript?.({who:"user",text:a.text,isFinal:!0}),this.setThinking(!0));break;case"reply.started":L="";break;case"transcript.agent.delta":a.delta&&(this.setThinking(!1),L&&!L.endsWith(" ")&&!/^[.,!?;:%)]/.test(a.delta)?L+=" "+a.delta:L+=a.delta,this.callbacks.onTranscript?.({who:"agent",text:L,isFinal:!1}));break;case"transcript.agent":a.text&&(this.setThinking(!1),L=a.text,this.callbacks.onTranscript?.({who:"agent",text:a.text,isFinal:!0}));break;case"reply.audio":if(a.data&&this.playbackNode){let F=atob(a.data),B=new Uint8Array(F.length);for(let c=0;c<F.length;c++)B[c]=F.charCodeAt(c);this.playbackNode.port.postMessage(B.buffer,[B.buffer]),this.agentLevel=.8}break;case"reply.done":a.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:a.name||a.tool,args:a.arguments||a.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:a.name||a.tool,result:a.result});break;case"reply.error":this.setThinking(!1),this.callbacks.onError?.(a.message||a.code||"Reply generation error");break;case"error":case"session.error":this.setThinking(!1),this.callbacks.onError?.(a.message||a.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.setThinking(!1),this.stop();break}}catch(a){console.warn("Message parsing error:",a)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(O){this.callbacks.onError?.(O.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(p){this.isMuted=p,p&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(p,w){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:p})),w&&this.ws.send(JSON.stringify({type:"reply.create",instructions:w})),!0}catch(T){return console.error("Failed to send message to agent:",T),!1}}sendEmailInput(p){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:`My email is ${p}`})),this.ws.send(JSON.stringify({type:"reply.create",instructions:`The caller has entered and verified their email address: ${p}. Do not ask for their email again. Immediately speak: "I have verified your email as ${p}. Can you please confirm with yes or no?" Then stop speaking and wait for their yes or no answer.`})),!0}catch(w){return console.error("Failed to send email to agent:",w),!1}}stop(){if(this.setThinking(!1),this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(p=>p.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let p=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(p)};this.animFrameId=requestAnimationFrame(p)}};import{Fragment as ze,jsx as i,jsxs as u}from"react/jsx-runtime";var We={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function $e({host:y="",businessId:p="biz_demo_dental",agentId:w,theme:T="light",position:Y="bottom-right",label:O="Talk to Receptionist",accent:J="emerald",accentColor:P,businessName:L,greeting:Z,className:E,onCallStart:a,onCallEnd:F,onTranscript:B}){let[c,W]=q(!1),[m,o]=q(!1),[b,j]=q("idle"),[G,ee]=q([]),[me,he]=q(0),[Ce,ye]=q(0),[Se,se]=q("0:00"),[H,oe]=q(L||"OmniDesk Hair Salon & Studio"),[te,v]=q(!1),[U,pe]=q(""),[K,D]=q(!1),d=ne(null),$=ne(null),Q=ne(0),k=ne(null),X=ne(0),S=ne(!1),h=ne(!1),_=ne(!1),r=Te(()=>P||We[J]||J||"#10b981",[J,P]),s=Te(()=>T==="dark"?!0:T==="auto"&&typeof window<"u"?window.matchMedia("(prefers-color-scheme: dark)").matches:!1,[T]);Le(()=>{$.current&&($.current.scrollTop=$.current.scrollHeight)},[G,K]);let I=Te(()=>y?y.replace(/\/$/,""):typeof window<"u"&&window.location.origin?window.location.origin:"",[y]),xe=ge(()=>{X.current=Date.now(),se("0:00"),k.current&&clearInterval(k.current),k.current=setInterval(()=>{let x=Date.now()-X.current,M=Math.floor(x/1e3),R=Math.floor(M/60),V=M%60;se(`${R}:${String(V).padStart(2,"0")}`)},250)},[]),z=ge(()=>{k.current&&(clearInterval(k.current),k.current=null)},[]),A=ge(async()=>{try{j("connecting"),S.current=!1,h.current=!1,_.current=!1,v(!1),xe();let M=`${I?I.replace(/\/$/,""):""}/api/token?businessId=${encodeURIComponent(p)}`,R=await fetch(M);if(!R.ok)throw new Error("Failed to initialize voice session");let V=await R.json();if(V.business_name&&!L&&oe(V.business_name),!V.token)throw new Error("Invalid session token payload received from host");let ke=w||V.agent_id||"",f=new ce({onStatusChange:n=>{if(j(n),n==="connected")Q.current=Date.now(),a?.();else if(n==="idle"){if(D(!1),z(),Q.current>0){let e=Math.round((Date.now()-Q.current)/1e3);Q.current=0,F?.(e)}}else n==="error"&&(D(!1),z())},onThinkingChange:n=>{n&&D(!0)},onTranscript:n=>{if(n.who==="user"?D(!0):n.who==="agent"&&n.text&&n.text.trim().length>0&&D(!1),ee(e=>{let g=e[e.length-1];if(g&&g.who===n.who&&!g.isFinal){let le=[...e];return le[le.length-1]={...g,text:n.text,isFinal:n.isFinal??!1},le}return[...e,{id:n.id||`${Date.now()}-${Math.random()}`,who:n.who,text:n.text,isFinal:n.isFinal??!1}]}),B?.(n),n.who==="user"){let e=n.text.toLowerCase().trim();(e==="no"||e.startsWith("no ")||e.includes("no,")||e.includes("wrong")||e.includes("incorrect")||e.includes("change my email")||e.includes("different email")||e.includes("that's not right")||e.includes("thats not right")||e.includes("not right")||e.includes("not my email"))&&(_.current=!1,v(!0)),(e==="yes"||e.startsWith("yes ")||e.includes("yes,")||e==="yeah"||e.startsWith("yeah ")||e==="yep"||e==="correct"||e.includes("that's right")||e.includes("thats right")||e.includes("sounds good")||e==="confirm"||e==="sure")&&_.current&&(_.current=!1,v(!1)),(n.text.includes("@")||e.includes(" at ")&&e.includes(" dot ")||e.includes("gmail.com")||e.includes("yahoo.com")||e.includes("outlook.com")||e.includes("hotmail.com")||e.includes("icloud.com"))&&(v(!1),_.current=!0)}else if(n.who==="agent"){let e=n.text.toLowerCase();if(e.includes("confirmation code is")||e.includes("booking is confirmed")||e.includes("scheduled your appointment")||e.includes("all set, your appointment")||e.includes("sent your confirmation")&&(e.includes("code")||e.includes("calendar invite"))||e.includes("sent a calendar invite")&&(e.includes("code")||e.includes("all set"))){h.current=!0,_.current=!1,v(!1);return}if(h.current){v(!1);return}if(e.includes("confirm with yes or no")||e.includes("yes or no")||e.includes("is that correct")||e.includes("is that right")||e.includes("verified your email")||e.includes("checking that email")||e.includes("let me check that email")){_.current=!0,v(!1);return}!_.current&&(e.includes("what is your email")||e.includes("what's your email")||e.includes("whats your email")||e.includes("may i have your email")||e.includes("can i have your email")||e.includes("could i have your email")||e.includes("could i get your email")||e.includes("could you provide your email")||e.includes("can you provide your email")||e.includes("provide your email")||e.includes("enter your email")||e.includes("share your email")||e.includes("need your email")||e.includes("what is your correct email")||e.includes("provide your correct email")||e.includes("where can i send your confirmation")||e.includes("where should i send your confirmation")||e.includes("where can i send your calendar")||e.includes("where should i send your calendar")||e.includes("email address")&&(e.includes("what is")||e.includes("what's")||e.includes("whats")||e.includes("may i have")||e.includes("can i have")||e.includes("could i have")||e.includes("could you provide")||e.includes("can you provide")||e.includes("provide")||e.includes("share")||e.includes("so i can send")||e.includes("to send your")))?v(!0):n.isFinal&&v(!1)}},onAudioLevel:(n,e)=>{he(n),ye(e)},onError:()=>{j("error"),z()}});d.current=f,await f.start(V.token,ke,V.voice,V.ws_url)}catch{j("error"),z()}},[I,p,w,L,a,F,B,xe,z]),be=ge(()=>{if(d.current&&(d.current.stop(),d.current=null),j("idle"),D(!1),he(0),ye(0),z(),h.current=!1,_.current=!1,v(!1),Q.current>0){let x=Math.round((Date.now()-Q.current)/1e3);Q.current=0,F?.(x)}},[F,z]),ae=ge(x=>{x.preventDefault();let M=U.trim();M&&(ee(R=>[...R,{who:"user",text:`My email is ${M}`,isFinal:!0}]),d.current&&d.current.sendEmailInput(M),D(!0),_.current=!0,pe(""),v(!1))},[U]);Le(()=>()=>{z(),d.current&&d.current.stop()},[z]);let re=Y==="bottom-left",C=b==="connected";return u("div",{className:E,style:{position:"relative",zIndex:99999},children:[i("div",{style:{position:"fixed",bottom:"20px",left:re?"20px":"auto",right:re?"auto":"20px",zIndex:99999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:u("button",{type:"button",onClick:()=>W(!c),style:{display:"inline-flex",alignItems:"center",gap:"10px",background:s?"#18181b":"#ffffff",color:s?"#fafafa":"#09090b",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,padding:"10px 18px",borderRadius:"9999px",cursor:"pointer",fontSize:"13px",fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.18)",transition:"transform 0.15s ease, background 0.15s ease"},onMouseEnter:x=>{x.currentTarget.style.transform="scale(1.02)"},onMouseLeave:x=>{x.currentTarget.style.transform="scale(1)"},children:[i("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:C?"#ef4444":r,boxShadow:`0 0 8px ${C?"#ef4444":r}`}}),i("span",{children:O}),i("span",{style:{fontSize:"11px",opacity:.6},children:"\u25B2"})]})}),c&&u(ze,{children:[m&&i("div",{onClick:()=>o(!1),style:{position:"fixed",inset:0,background:"rgba(0, 0, 0, 0.7)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",zIndex:999998}}),u("div",{style:{position:"fixed",bottom:m?"auto":"80px",left:m?"50%":re?"20px":"auto",right:m||re?"auto":"20px",top:m?"50%":"auto",transform:m?"translate(-50%, -50%)":"none",width:m?"calc(100vw - 40px)":"390px",maxWidth:m?"1140px":"calc(100vw - 32px)",height:m?"calc(100vh - 40px)":"560px",maxHeight:m?"900px":"calc(100vh - 100px)",background:s?"#09090b":"#ffffff",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,borderRadius:"20px",boxShadow:m?"0 32px 64px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)":"0 24px 48px -12px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:999999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",transition:"all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"},children:[i("style",{children:`
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
            `}),u("div",{style:{background:s?"#18181b":"#ffffff",color:s?"#ffffff":"#09090b",borderBottom:`1px solid ${s?"#27272a":"#e4e4e7"}`,padding:m?"16px 22px":"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",userSelect:"none",flexShrink:0},children:[u("div",{style:{display:"flex",alignItems:"center",gap:"10px",minWidth:0},children:[i("div",{style:{color:s?"rgba(255,255,255,0.6)":"#71717a",display:"grid",placeItems:"center",flexShrink:0},children:u("svg",{xmlns:"http://www.w3.org/2000/svg",width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("circle",{cx:"12",cy:"12",r:"1"}),i("circle",{cx:"12",cy:"5",r:"1"}),i("circle",{cx:"12",cy:"19",r:"1"})]})}),i("div",{style:{width:"28px",height:"28px",borderRadius:"50%",background:s?"rgba(255,255,255,0.15)":r==="#18181b"?"rgba(24,24,27,0.08)":`${r}18`,display:"grid",placeItems:"center",flexShrink:0,color:s?"#ffffff":r==="#18181b"?"#09090b":r},children:u("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),i("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),i("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]})}),u("div",{style:{display:"flex",flexDirection:"column",minWidth:0},children:[i("div",{style:{fontSize:"13.5px",fontWeight:600,color:s?"#ffffff":"#09090b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},children:H}),u("div",{style:{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"11px",color:s?"rgba(255,255,255,0.75)":"#71717a"},children:[i("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:C?K?"#f59e0b":"#22c55e":b==="connecting"?"#eab308":s?"rgba(255,255,255,0.4)":"#a1a1aa",animation:K?"omnidesk-pulse-amber 1.5s infinite":"none"}}),i("span",{children:C?K?"Thinking \xB7 Checking tools...":"Live \xB7 Speaking":b==="connecting"?"Connecting...":b==="error"?"Error":"Idle \xB7 Ready"})]})]})]}),u("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[i("button",{type:"button",onClick:()=>o(!m),title:m?"Exit Fullscreen":"Open Full",style:{background:s?"rgba(255,255,255,0.1)":"#f4f4f5",border:s?"1px solid rgba(255,255,255,0.15)":"1px solid #e4e4e7",borderRadius:"7px",color:s?"#ffffff":"#52525b",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:x=>x.currentTarget.style.background=s?"rgba(255,255,255,0.2)":"#e4e4e7",onMouseLeave:x=>x.currentTarget.style.background=s?"rgba(255,255,255,0.1)":"#f4f4f5",children:m?u("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("polyline",{points:"4 14 10 14 10 20"}),i("polyline",{points:"20 10 14 10 14 4"}),i("line",{x1:"14",y1:"10",x2:"21",y2:"3"}),i("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]}):u("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("polyline",{points:"15 3 21 3 21 9"}),i("polyline",{points:"9 21 3 21 3 15"}),i("line",{x1:"21",y1:"3",x2:"14",y2:"10"}),i("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]})}),i("button",{type:"button",onClick:()=>{C&&be(),W(!1)},title:"Close Widget",style:{background:s?"rgba(255,255,255,0.1)":"#f4f4f5",border:s?"1px solid rgba(255,255,255,0.15)":"1px solid #e4e4e7",borderRadius:"7px",color:s?"#ffffff":"#52525b",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:x=>x.currentTarget.style.background=s?"rgba(255,255,255,0.2)":"#e4e4e7",onMouseLeave:x=>x.currentTarget.style.background=s?"rgba(255,255,255,0.1)":"#f4f4f5",children:u("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("line",{x1:"18",y1:"6",x2:"6",y2:"18"}),i("line",{x1:"6",y1:"6",x2:"18",y2:"18"})]})})]})]}),u("div",{ref:$,style:{flex:1,minHeight:0,padding:"16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"12px",background:s?"#09090b":"#ffffff"},children:[G.length===0&&u("div",{style:{margin:"auto",textAlign:"center",padding:"10px 18px",background:s?"#18181b":"#f4f4f5",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,color:s?"#a1a1aa":"#52525b",borderRadius:"12px",fontSize:"12.5px",fontWeight:500,display:"inline-flex",alignItems:"center",gap:"8px",alignSelf:"center"},children:[i("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:C?"#22c55e":b==="connecting"?"#eab308":"#a1a1aa",display:"inline-block"}}),i("span",{children:C?"Connected \xB7 Speak to our receptionist":b==="connecting"?"Connecting to receptionist...":"Start a call to talk to our receptionist"})]}),G.map((x,M)=>{let R=x.who==="user";return i("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:R?"flex-end":"flex-start"},children:u("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[!R&&i("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:u("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),i("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),i("div",{style:{padding:"10px 14px",borderRadius:R?"14px 14px 2px 14px":"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:R?r:s?"#18181b":"#f4f4f5",color:R?"#ffffff":s?"#fafafa":"#09090b",border:!R&&s?"1px solid #27272a":"none",boxShadow:R?`0 2px 8px ${r}35`:"0 1px 2px rgba(0,0,0,0.04)"},children:x.text})]})},M)}),K&&i("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:"flex-start"},children:u("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[i("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:u("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),i("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),u("div",{style:{padding:"10px 14px",borderRadius:"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:s?"#18181b":"#f4f4f5",color:s?"#a1a1aa":"#71717a",border:s?"1px solid #27272a":"none",boxShadow:"0 1px 2px rgba(0,0,0,0.04)",display:"inline-flex",alignItems:"center",gap:"5px",minHeight:"38px"},title:"Agent is thinking and processing...",children:[i("span",{className:"omnidesk-motion-dot omnidesk-dot-1"}),i("span",{className:"omnidesk-motion-dot omnidesk-dot-2"}),i("span",{className:"omnidesk-motion-dot omnidesk-dot-3"})]})]})})]}),te&&C&&u("div",{style:{padding:"11px 16px",background:"#f0fdf4",borderTop:"1px solid #bbf7d0",display:"flex",flexDirection:"column",gap:"7px",flexShrink:0},children:[u("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"},children:[u("span",{style:{fontSize:"11px",fontWeight:700,color:"#15803d",textTransform:"uppercase",letterSpacing:"0.04em",display:"inline-flex",alignItems:"center",gap:"6px"},children:[i("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:"#22c55e",display:"inline-block"}}),"Email Requested by Agent"]}),i("button",{type:"button",onClick:()=>v(!1),style:{background:"none",border:"none",color:"#15803d",cursor:"pointer",fontSize:"12px",fontWeight:700,padding:"1px 4px"},children:"\u2715"})]}),u("form",{onSubmit:ae,style:{display:"flex",gap:"6px"},children:[i("input",{type:"email",autoFocus:!0,value:U,onChange:x=>pe(x.target.value),placeholder:"Enter your email (e.g. name@gmail.com)",required:!0,style:{flex:1,fontSize:"12.5px",padding:"7px 11px",borderRadius:"7px",border:"1px solid #86efac",background:"#ffffff",color:"#09090b",outline:"none"}}),i("button",{type:"submit",disabled:!U.trim(),style:{background:"#16a34a",color:"#ffffff",border:"none",padding:"7px 14px",borderRadius:"7px",fontSize:"12px",fontWeight:600,cursor:U.trim()?"pointer":"not-allowed",opacity:U.trim()?1:.6},children:"Send"})]})]}),u("div",{style:{padding:"12px 16px",borderTop:`1px solid ${s?"#27272a":"#e4e4e7"}`,background:s?"#121214":"#fafafa",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0},children:[u("button",{type:"button",onClick:C?be:A,disabled:b==="connecting",style:{display:"inline-flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:C?"#dc2626":b==="connecting"?"#64748b":r,color:"#ffffff",borderRadius:"10px",border:"none",fontSize:"13px",fontWeight:600,boxShadow:C?"0 4px 14px rgba(220, 38, 38, 0.35)":`0 4px 14px ${r}40`,cursor:b==="connecting"?"not-allowed":"pointer",transition:"all 0.15s ease"},children:[u("svg",{xmlns:"http://www.w3.org/2000/svg",width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),i("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),i("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]}),i("span",{children:C?"End Voice Call":b==="connecting"?"Connecting...":"Start Voice Call"})]}),u("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[C&&i("div",{style:{display:"flex",alignItems:"center",gap:"2.5px",height:"14px"},children:[12,8,14,6,10].map((x,M)=>i("span",{style:{width:"2.5px",height:`${Math.max(4,Math.min(14,Math.round(x*(.35+Math.max(me,Ce)*1.5))))}px`,background:r,borderRadius:"1px",transition:"height 0.12s ease"}},M))}),i("span",{style:{fontFamily:"var(--mono, monospace)",fontSize:"12px",fontWeight:600,padding:"3px 8px",borderRadius:"6px",background:s?"#18181b":C?"#000000":"#f4f4f5",color:s||C?"#ffffff":"#71717a",border:s?"1px solid #27272a":"none"},children:Se})]})]})]})]})]})}var Fe=$e;var Ne={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function Ee(y={}){if(typeof window>"u")return;let{host:p,businessId:w="biz_demo_dental",agentId:T,theme:Y="light",position:O="bottom-right",label:J="Talk to Receptionist",accent:P="emerald",accentColor:L,businessName:Z,greeting:E,onCallStart:a,onCallEnd:F,onTranscript:B}=y,c=L||Ne[P]||P||"#10b981",W=document.getElementById("omnidesk-voice-widget-root");W&&W.remove();let m=document.createElement("div");m.id="omnidesk-voice-widget-root",m.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let o=Y==="dark"||Y==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,b=null,j="idle",G=0,ee=null,me=!1,he=!1,Ce=0,ye=0,Se=!1,se=!1,H=!1,oe=null,te=null,v=!1,U=O==="bottom-left",pe=document.createElement("div");pe.style.cssText=`
    position: fixed; bottom: 20px; ${U?"left: 20px;":"right: 20px;"};
    z-index: 999999;
  `;let K=document.createElement("button");K.style.cssText=`
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${o?"#18181b":"#ffffff"}; color: ${o?"#fafafa":"#09090b"};
    border: 1px solid ${o?"#27272a":"#e4e4e7"};
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `,K.innerHTML=`
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${c};box-shadow:0 0 8px ${c};display:inline-block;"></span>
    <span>${J}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,pe.appendChild(K);let D=document.createElement("div");D.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,D.onclick=()=>C(!1);let d=document.createElement("div");d.style.cssText=`
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
      <div style="width: 28px; height: 28px; border-radius: 50%; background: ${o?"rgba(255,255,255,0.15)":c==="#18181b"?"rgba(24,24,27,0.08)":`${c}18`}; display: grid; place-items: center; flex-shrink: 0; color: ${o?"#ffffff":c==="#18181b"?"#09090b":c};">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
        </svg>
      </div>
      <div style="display: flex; flex-direction: column; min-width: 0;">
        <div id="omnidesk-biz-title" style="font-size: 13.5px; font-weight: 600; color: ${o?"#ffffff":"#09090b"}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${Z||"OmniDesk Hair Salon & Studio"}
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
  `;let Q=document.createElement("style");Q.textContent=`
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
  `,m.appendChild(Q);let k=document.createElement("div");k.style.cssText=`
    flex: 1; min-height: 0; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 12px; background: ${o?"#09090b":"#ffffff"};
  `;let X=document.createElement("div");X.id="omnidesk-placeholder-banner",X.style.cssText=`
    margin: auto; text-align: center; padding: 10px 18px;
    background: ${o?"#18181b":"#f4f4f5"}; border: 1px solid ${o?"#27272a":"#e4e4e7"}; color: ${o?"#a1a1aa":"#52525b"};
    border-radius: 12px; font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px; align-self: center;
  `,X.innerHTML=`
    <span id="omnidesk-placeholder-dot" style="width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block;"></span>
    <span>Start a call to talk to our receptionist</span>
  `,k.appendChild(X);let S=document.createElement("div");if(S.id="omnidesk-thinking-bubble",S.style.cssText=`
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
  `,k.appendChild(S),E){X.style.display="none";let f=document.createElement("div");f.style.cssText="display: flex; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;";let n=document.createElement("div");n.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let e=document.createElement("div");e.style.cssText="width: 24px; height: 24px; border-radius: 50%; background: #18181b; display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;",e.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let g=document.createElement("div");g.style.cssText=`padding: 10px 14px; border-radius: 14px 14px 14px 2px; font-size: 13px; line-height: 1.45; background: ${o?"#18181b":"#f4f4f5"}; color: ${o?"#fafafa":"#09090b"}; border: ${o?"1px solid #27272a":"none"}; box-shadow: 0 1px 2px rgba(0,0,0,0.04);`,g.innerText=E,n.appendChild(e),n.appendChild(g),f.appendChild(n),k.insertBefore(f,S),oe="agent",te=g,v=!0}let h=document.createElement("div");h.id="omnidesk-email-bar",h.style.cssText=`
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
  `;let _=document.createElement("div");_.style.cssText=`
    padding: 12px 16px; border-top: 1px solid ${o?"#27272a":"#e4e4e7"};
    background: ${o?"#121214":"#fafafa"}; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  `;let r=document.createElement("button");r.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: ${c}; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    box-shadow: 0 4px 14px ${c}40;
    cursor: pointer; transition: all 0.15s ease;
  `,r.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let s=document.createElement("div");s.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let I=document.createElement("div");I.id="omnidesk-waveform",I.style.cssText="display: none; align-items: center; gap: 2.5px; height: 14px;";let xe=[12,8,14,6,10],z=[];xe.forEach(f=>{let n=document.createElement("span");n.style.cssText=`width: 2.5px; height: ${Math.round(f*.35)}px; background: ${c}; border-radius: 1px; transition: height 0.12s ease;`,I.appendChild(n),z.push(n)}),s.appendChild(I);let A=document.createElement("span");A.id="omnidesk-timer",A.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,A.innerText="0:00",s.appendChild(A),_.appendChild(r),_.appendChild(s),d.appendChild($),d.appendChild(k),d.appendChild(h),d.appendChild(_),m.appendChild(pe),m.appendChild(D),m.appendChild(d),document.body.appendChild(m);function be(){G=Date.now(),A.innerText="0:00",A.style.background=o?"#18181b":"#000000",A.style.color="#ffffff",A.style.border=o?"1px solid #27272a":"none",ee&&clearInterval(ee),ee=setInterval(()=>{let f=Date.now()-G,n=Math.floor(f/1e3),e=Math.floor(n/60),g=n%60;A.innerText=`${e}:${String(g).padStart(2,"0")}`},250)}function ae(){ee&&(clearInterval(ee),ee=null),A.style.background="#f4f4f5",A.style.color="#71717a",A.style.border="none",A.innerText="0:00",I.style.display="none"}function re(f){me=f,d.style.display=f?"flex":"none"}function C(f){he=f,D.style.display=f?"block":"none",f?(d.style.top="50%",d.style.left="50%",d.style.bottom="auto",d.style.right="auto",d.style.transform="translate(-50%, -50%)",d.style.width="calc(100vw - 40px)",d.style.maxWidth="1140px",d.style.height="calc(100vh - 40px)",d.style.maxHeight="900px"):(d.style.top="auto",d.style.left=U?"20px":"auto",d.style.right=U?"auto":"20px",d.style.bottom="80px",d.style.transform="none",d.style.width="390px",d.style.maxWidth="calc(100vw - 32px)",d.style.height="560px",d.style.maxHeight="calc(100vh - 100px)")}K.onclick=()=>re(!me),$.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{re(!1),C(!1)}),$.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{C(!he)});let x=h.querySelector("#omnidesk-email-form"),M=h.querySelector("#omnidesk-email-input");h.querySelector("#omnidesk-email-close-btn").addEventListener("click",()=>{h.style.display="none"}),x.addEventListener("submit",f=>{f.preventDefault();let n=M.value.trim();if(!n||!n.includes("@"))return;b&&b.sendEmailInput(n),H=!0,h.style.display="none",M.value="",X.style.display="none";let e=document.createElement("div");e.style.cssText=`
      display: flex; flex-direction: column; gap: 4px; max-width: 88%;
      align-self: flex-end;
    `;let g=document.createElement("div");g.style.cssText=`
      padding: 10px 14px; border-radius: 14px 14px 2px 14px;
      font-size: 13px; line-height: 1.45;
      background: ${c}; color: #ffffff;
      box-shadow: 0 2px 8px ${c}35;
    `,g.innerText=`My email is ${n}`,e.appendChild(g),k.insertBefore(e,S),S.style.display="flex",k.scrollTop=k.scrollHeight,oe="user",te=g,v=!0});async function V(){Se=!1,se=!1,H=!1,h.style.display="none",S.style.display="none",oe=null,te=null,v=!1;let f=$.querySelector("#omnidesk-status-text"),n=$.querySelector("#omnidesk-status-dot"),e=r.querySelector("#omnidesk-btn-text");f.innerText="Connecting...",n.style.background="#eab308",e.innerText="Connecting...",r.style.background="#64748b",r.style.boxShadow="none",r.disabled=!0,be();try{let g=p;if(!g&&typeof document<"u"){let l=document.querySelector("script[src*='widget.js']");if(l&&l.src&&l.src.startsWith("http"))try{g=new URL(l.src).origin}catch{}}!g&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(g=window.location.origin);let le=(g||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),we=await fetch(`${le}/api/token?businessId=${encodeURIComponent(w)}`);if(!we.ok)throw new Error(`Failed to get session token (${we.status})`);let ue=await we.json();if(ue.business_name&&!Z){let l=$.querySelector("#omnidesk-biz-title");l&&(l.innerText=ue.business_name)}let _e=T||ue.agent_id||"";b=new ce({onStatusChange:l=>{if(j=l,l==="connected")f.innerText="Live \xB7 Speaking",n.style.background="#22c55e",e.innerText="End Voice Call",r.style.background="#dc2626",r.style.boxShadow="0 4px 14px rgba(220, 38, 38, 0.35)",r.disabled=!1,I.style.display="flex",G=Date.now(),a?.();else if(l==="idle"&&(f.innerText="Idle \xB7 Ready",n.style.background=o?"rgba(255,255,255,0.4)":"#a1a1aa",e.innerText="Start Voice Call",r.style.background=c,r.style.boxShadow=`0 4px 14px ${c}40`,r.disabled=!1,I.style.display="none",h.style.display="none",S.style.display="none",ae(),G>0)){let t=Math.round((Date.now()-G)/1e3);G=0,F?.(t)}},onThinkingChange:l=>{l&&(S.style.display="flex",k.scrollTop=k.scrollHeight)},onTranscript:l=>{if(X.style.display="none",l.who==="user"){l.isFinal&&(S.style.display="flex");let t=l.text.toLowerCase().trim();(t==="no"||t.startsWith("no ")||t.includes("no,")||t.includes("wrong")||t.includes("incorrect")||t.includes("change my email")||t.includes("different email")||t.includes("that's not right")||t.includes("thats not right")||t.includes("not right")||t.includes("not my email"))&&(H=!1,h.style.display="flex",setTimeout(()=>M.focus(),60)),(t==="yes"||t.startsWith("yes ")||t.includes("yes,")||t==="yeah"||t.startsWith("yeah ")||t==="yep"||t==="correct"||t.includes("that's right")||t.includes("thats right")||t.includes("sounds good")||t==="confirm"||t==="sure")&&H&&(H=!1,h.style.display="none"),(l.text.includes("@")||t.includes(" at ")&&t.includes(" dot ")||t.includes("gmail.com")||t.includes("yahoo.com")||t.includes("outlook.com")||t.includes("hotmail.com")||t.includes("icloud.com"))&&(h.style.display="none",H=!0)}else if(l.who==="agent"){l.text&&l.text.trim().length>0&&(S.style.display="none");let t=l.text.toLowerCase();if(t.includes("confirmation code is")||t.includes("booking is confirmed")||t.includes("scheduled your appointment")||t.includes("all set, your appointment")||t.includes("sent your confirmation")&&(t.includes("code")||t.includes("calendar invite"))||t.includes("sent a calendar invite")&&(t.includes("code")||t.includes("all set"))){se=!0,H=!1,h.style.display="none";return}if(se){h.style.display="none";return}if(t.includes("confirm with yes or no")||t.includes("yes or no")||t.includes("is that correct")||t.includes("is that right")||t.includes("verified your email")||t.includes("checking that email")||t.includes("let me check that email")){H=!0,h.style.display="none";return}!H&&(t.includes("what is your email")||t.includes("what's your email")||t.includes("whats your email")||t.includes("may i have your email")||t.includes("can i have your email")||t.includes("could i have your email")||t.includes("could i get your email")||t.includes("could you provide your email")||t.includes("can you provide your email")||t.includes("provide your email")||t.includes("enter your email")||t.includes("share your email")||t.includes("need your email")||t.includes("what is your correct email")||t.includes("provide your correct email")||t.includes("where can i send your confirmation")||t.includes("where should i send your confirmation")||t.includes("where can i send your calendar")||t.includes("where should i send your calendar")||t.includes("email address")&&(t.includes("what is")||t.includes("what's")||t.includes("whats")||t.includes("may i have")||t.includes("can i have")||t.includes("could i have")||t.includes("could you provide")||t.includes("can you provide")||t.includes("provide")||t.includes("share")||t.includes("so i can send")||t.includes("to send your")))?(h.style.display="flex",setTimeout(()=>M.focus(),60)):l.isFinal&&(h.style.display="none")}if(oe===l.who&&te&&!v)te.innerText=l.text,v=!!l.isFinal;else{let t=l.who==="user",ie=document.createElement("div");if(ie.style.cssText=`
              display: flex; flex-direction: column; gap: 4px; max-width: 88%;
              align-self: ${t?"flex-end":"flex-start"};
            `,t){let N=document.createElement("div");N.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 2px 14px;
                font-size: 13px; line-height: 1.45;
                background: ${c};
                color: #ffffff;
                box-shadow: 0 2px 8px ${c}35;
              `,N.innerText=l.text,ie.appendChild(N),te=N}else{let N=document.createElement("div");N.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let de=document.createElement("div");de.style.cssText=`
                width: 24px; height: 24px; border-radius: 50%; background: #18181b;
                display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;
              `,de.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let fe=document.createElement("div");fe.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 14px 2px;
                font-size: 13px; line-height: 1.45;
                background: ${o?"#18181b":"#f4f4f5"};
                color: ${o?"#fafafa":"#09090b"};
                border: ${o?"1px solid #27272a":"none"};
                box-shadow: 0 1px 2px rgba(0,0,0,0.04);
              `,fe.innerText=l.text,N.appendChild(de),N.appendChild(fe),ie.appendChild(N),te=fe}k.insertBefore(ie,S),oe=l.who,v=!!l.isFinal}k.scrollTop=k.scrollHeight,B?.(l)},onAudioLevel:(l,t)=>{if(Ce=l,ye=t,j==="connected"){I.style.display="flex";let ie=Math.max(l,t);xe.forEach((N,de)=>{let fe=Math.max(4,Math.min(14,Math.round(N*(.35+ie*1.5))));z[de]&&(z[de].style.height=`${fe}px`)})}},onError:()=>{f.innerText="Error",n.style.background="#ef4444",e.innerText="Start Voice Call",r.style.background=c,r.style.boxShadow=`0 4px 14px ${c}40`,r.disabled=!1,I.style.display="none",h.style.display="none",S.style.display="none",ae()}}),await b.start(ue.token,_e,ue.voice,ue.ws_url)}catch(g){console.error("[OmniDesk Voice Widget Error]:",g),f.innerText="Error",n.style.background="#ef4444",e.innerText="Start Voice Call",r.style.background=c,r.style.boxShadow=`0 4px 14px ${c}40`,r.disabled=!1,I.style.display="none",h.style.display="none",S.style.display="none",ae()}}function ke(){b&&(b.stop(),b=null),j="idle";let f=$.querySelector("#omnidesk-status-text"),n=$.querySelector("#omnidesk-status-dot"),e=r.querySelector("#omnidesk-btn-text");f&&(f.innerText="Idle \xB7 Ready"),n&&(n.style.background=o?"rgba(255,255,255,0.4)":"#a1a1aa"),e&&(e.innerText="Start Voice Call"),r.style.background=c,r.style.boxShadow=`0 4px 14px ${c}40`,r.disabled=!1,I.style.display="none",h.style.display="none",S.style.display="none",se=!1,H=!1,ae()}return r.onclick=()=>{j==="connected"?ke():j==="idle"&&V()},{destroy:()=>{ae(),b&&b.stop(),m.remove()},startCall:V,endCall:ke}}if(typeof document<"u"){let y=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(y){let p,w=y.src||"";if(w&&w.startsWith("http"))try{p=new URL(w).origin}catch{}let T=y.getAttribute("data-business-id")||void 0,Y=y.getAttribute("data-agent")||void 0,O=y.getAttribute("data-theme")||"dark",J=y.getAttribute("data-accent")||"emerald",P=y.getAttribute("data-position")||"bottom-right",L=y.getAttribute("data-label")||void 0,Z=y.getAttribute("data-host")||p||"https://omni-desk-rho.vercel.app",E=y.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{Ee({businessId:T,agentId:Y,theme:O,accent:J,position:P,label:L,host:Z,greeting:E})}):Ee({businessId:T,agentId:Y,theme:O,accent:J,position:P,label:L,host:Z,greeting:E})}}export{ce as AssemblyAIVoiceClient,$e as OmniDeskWidget,Fe as VoiceWidget,Ee as initOmniDeskWidget};
//# sourceMappingURL=index.mjs.map