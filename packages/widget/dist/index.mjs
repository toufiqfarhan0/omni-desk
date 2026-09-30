import{useState as I,useRef as se,useEffect as $e,useCallback as me,useMemo as Ee}from"react";var ve=24e3,Ae="wss://agents.assemblyai.com/v1/ws",Ie=`
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
`;async function Le(k,d,S){let T=URL.createObjectURL(new Blob([d],{type:"application/javascript"}));try{await k.audioWorklet.addModule(T)}finally{URL.revokeObjectURL(T)}return new AudioWorkletNode(k,S)}var de=class{constructor(d){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.isThinking=!1;this.callbacks=d}setThinking(d){this.isThinking!==d&&(this.isThinking=d,this.callbacks.onThinkingChange?.(d))}async start(d,S,T){try{this.callbacks.onStatusChange?.("connecting");let N=window.AudioContext||window.webkitAudioContext;this.captureCtx=new N({sampleRate:ve}),this.playbackCtx=new N({sampleRate:ve}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await Le(this.playbackCtx,Re,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0}}),this.captureNode=await Le(this.captureCtx,Ie,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let G=new URL(Ae);G.searchParams.set("token",d),this.ws=new WebSocket(G.toString()),this.captureNode.port.onmessage=({data:v})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let r=new Uint8Array(v),$="";for(let W=0;W<r.length;W+=32768)$+=String.fromCharCode.apply(null,Array.from(r.subarray(W,W+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa($)}));let V=new Int16Array(v),_=0;for(let W=0;W<V.length;W+=16)_+=Math.abs(V[W]);this.userLevel=Math.min(1,_/(V.length/16)/8e3)},this.ws.onopen=()=>{let v={};S&&S.trim()?v.agent_id=S.trim():T&&T.trim()&&(v.output={voice:T.trim()}),Object.keys(v).length>0&&this.ws?.send(JSON.stringify({type:"session.update",session:v}))};let M="",R="";this.ws.onmessage=({data:v})=>{try{let r=JSON.parse(v);switch(r.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0,R="",this.setThinking(!1);break;case"transcript.user.delta":r.text&&(R=r.text,this.callbacks.onTranscript?.({who:"user",text:r.text,isFinal:!1}));break;case"transcript.user":r.text&&(R=r.text,this.callbacks.onTranscript?.({who:"user",text:r.text,isFinal:!0}),this.setThinking(!0));break;case"reply.started":M="";break;case"transcript.agent.delta":r.delta&&(this.setThinking(!1),M&&!M.endsWith(" ")&&!/^[.,!?;:%)]/.test(r.delta)?M+=" "+r.delta:M+=r.delta,this.callbacks.onTranscript?.({who:"agent",text:M,isFinal:!1}));break;case"transcript.agent":r.text&&(this.setThinking(!1),M=r.text,this.callbacks.onTranscript?.({who:"agent",text:r.text,isFinal:!0}));break;case"reply.audio":if(r.data&&this.playbackNode){let $=atob(r.data),V=new Uint8Array($.length);for(let _=0;_<$.length;_++)V[_]=$.charCodeAt(_);this.playbackNode.port.postMessage(V.buffer,[V.buffer]),this.agentLevel=.8}break;case"reply.done":r.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:r.name||r.tool,args:r.arguments||r.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:r.name||r.tool,result:r.result});break;case"session.error":this.setThinking(!1),this.callbacks.onError?.(r.message||r.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.setThinking(!1),this.stop();break}}catch(r){console.warn("Message parsing error:",r)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(N){this.callbacks.onError?.(N.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(d){this.isMuted=d,d&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(d,S){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:d})),S&&this.ws.send(JSON.stringify({type:"reply.create",instructions:S})),!0}catch(T){return console.error("Failed to send message to agent:",T),!1}}sendEmailInput(d){return this.sendUserMessage(`My email address is ${d}`,`The caller entered their email address: ${d}. Call verify_customer_email to validate it, then ask the caller: "I have verified your email as ${d}. Can you please confirm with yes or no?" Do not book until they confirm with yes. If they say no, ask for their email again.`)}stop(){if(this.setThinking(!1),this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(d=>d.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let d=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(d)};this.animFrameId=requestAnimationFrame(d)}};import{Fragment as Fe,jsx as i,jsxs as p}from"react/jsx-runtime";var We={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function _e({host:k="",businessId:d="biz_demo_dental",agentId:S,theme:T="light",position:N="bottom-right",label:G="Talk to Receptionist",accent:M="emerald",accentColor:R,businessName:v,greeting:r,className:$,onCallStart:V,onCallEnd:_,onTranscript:W}){let[g,fe]=I(!1),[m,o]=I(!1),[w,O]=I("idle"),[q,K]=I([]),[ye,he]=I(0),[Ce,be]=I(0),[Se,oe]=I("0:00"),[Y,ae]=I(v||"OmniDesk Hair Salon & Studio"),[Q,E]=I(!1),[X,ce]=I(""),[Z,ie]=I(!1),[h,L]=I(""),[xe,C]=I(""),[z,y]=I(!1),x=se(null),ee=se(null),c=se(0),j=se(null),A=se(0),ke=se(!1),ne=se(!1),b=se(!1),F=Ee(()=>R||We[M]||M||"#10b981",[M,R]),s=Ee(()=>T==="dark"?!0:T==="auto"&&typeof window<"u"?window.matchMedia("(prefers-color-scheme: dark)").matches:!1,[T]);$e(()=>{ee.current&&(ee.current.scrollTop=ee.current.scrollHeight)},[q,z]);let te=Ee(()=>k?k.replace(/\/$/,""):typeof window<"u"&&window.location.origin?window.location.origin:"",[k]),pe=me(()=>{A.current=Date.now(),oe("0:00"),j.current&&clearInterval(j.current),j.current=setInterval(()=>{let n=Date.now()-A.current,u=Math.floor(n/1e3),l=Math.floor(u/60),P=u%60;oe(`${l}:${String(P).padStart(2,"0")}`)},250)},[]),U=me(()=>{j.current&&(clearInterval(j.current),j.current=null)},[]),ge=me(async()=>{try{O("connecting"),ke.current=!1,ne.current=!1,b.current=!1,E(!1),pe();let u=`${te?te.replace(/\/$/,""):""}/api/token?businessId=${encodeURIComponent(d)}`,l=await fetch(u);if(!l.ok)throw new Error("Failed to initialize voice session");let P=await l.json();if(P.business_name&&!v&&ae(P.business_name),!P.token)throw new Error("Invalid session token payload received from host");let J=S||P.agent_id||"",H=new de({onStatusChange:f=>{if(O(f),f==="connected")c.current=Date.now(),V?.();else if(f==="idle"){if(y(!1),U(),c.current>0){let e=Math.round((Date.now()-c.current)/1e3);c.current=0,_?.(e)}}else f==="error"&&(y(!1),U())},onThinkingChange:f=>{f&&y(!0)},onTranscript:f=>{if(f.who==="user"?y(!0):f.who==="agent"&&f.text&&f.text.trim().length>0&&y(!1),K(e=>{let t=e[e.length-1];if(t&&t.who===f.who&&!t.isFinal){let D=[...e];return D[D.length-1]={...t,text:f.text,isFinal:f.isFinal??!1},D}return[...e,{id:f.id||`${Date.now()}-${Math.random()}`,who:f.who,text:f.text,isFinal:f.isFinal??!1}]}),W?.(f),f.who==="user"){let e=f.text.toLowerCase();(e==="no"||e.startsWith("no ")||e.includes("no,")||e.includes("wrong")||e.includes("incorrect")||e.includes("change my email")||e.includes("different email"))&&(b.current=!1),(f.text.includes("@")||e.includes(" at ")&&e.includes(" dot ")||e.includes("gmail.com")||e.includes("yahoo.com")||e.includes("outlook.com")||e.includes("hotmail.com")||e.includes("icloud.com"))&&(E(!1),b.current=!0)}else if(f.who==="agent"){let e=f.text.toLowerCase();if(e.includes("confirmation code is")||e.includes("booking is confirmed")||e.includes("scheduled your appointment")||e.includes("all set, your appointment")||e.includes("sent your confirmation")&&(e.includes("code")||e.includes("calendar invite"))||e.includes("sent a calendar invite")&&(e.includes("code")||e.includes("all set"))){ne.current=!0,b.current=!1,E(!1);return}if(ne.current){E(!1);return}if(e.includes("confirm with yes or no")||e.includes("yes or no")||e.includes("is that correct")||e.includes("is that right")){b.current=!0,E(!1);return}e.includes("what is your email")||e.includes("what's your email")||e.includes("may i have your email")||e.includes("can i have your email")||e.includes("could i get your email")||e.includes("could you provide your email")||e.includes("provide your email")||e.includes("enter your email")||e.includes("spell your email")||e.includes("share your email")||e.includes("need your email")||e.includes("what email")||e.includes("which email")||e.includes("where can i send your confirmation")||e.includes("where should i send your confirmation")||e.includes("where can i send your calendar")||e.includes("where should i send your calendar")||e.includes("email")&&(e.includes("what is")||e.includes("what's")||e.includes("may i have")||e.includes("can i have")||e.includes("provide")||e.includes("give me")||e.includes("tell me")||e.includes("send your calendar invite")||e.includes("send your confirmation"))?(b.current=!1,E(!0)):E(!1)}},onAudioLevel:(f,e)=>{he(f),be(e)},onError:()=>{O("error"),U()}});x.current=H,await H.start(P.token,J,P.voice)}catch{O("error"),U()}},[te,d,S,v,V,_,W,pe,U]),Te=me(()=>{if(x.current&&(x.current.stop(),x.current=null),O("idle"),y(!1),he(0),be(0),U(),ne.current=!1,b.current=!1,E(!1),L(""),C(""),c.current>0){let n=Math.round((Date.now()-c.current)/1e3);c.current=0,_?.(n)}},[_,U]),we=me(async n=>{n.preventDefault();let u=X.trim();if(u){ie(!0),L(""),C("");try{let l=te?te.replace(/\/$/,""):"",P=await fetch(`${l}/api/tools/${encodeURIComponent(d)}/verify_customer_email`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:u})}),J=await P.json();if(!P.ok||!J.valid||!J.email){L(J.message||"Invalid email or domain has no active mail server."),ie(!1);return}let H=J.email;C(`Verified: ${H}. Sent to agent.`),K(f=>[...f,{who:"user",text:`My email is ${H}`}]),x.current&&x.current.sendEmailInput(H),y(!0),b.current=!0,ce(""),E(!1),C("")}catch(l){L(l.message||"Failed to verify email with mail server.")}finally{ie(!1)}}},[X,te,d]);$e(()=>()=>{U(),x.current&&x.current.stop()},[U]);let re=N==="bottom-left",a=w==="connected";return p("div",{className:$,style:{position:"relative",zIndex:99999},children:[i("div",{style:{position:"fixed",bottom:"20px",left:re?"20px":"auto",right:re?"auto":"20px",zIndex:99999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:p("button",{type:"button",onClick:()=>fe(!g),style:{display:"inline-flex",alignItems:"center",gap:"10px",background:s?"#18181b":"#ffffff",color:s?"#fafafa":"#09090b",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,padding:"10px 18px",borderRadius:"9999px",cursor:"pointer",fontSize:"13px",fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.18)",transition:"transform 0.15s ease, background 0.15s ease"},onMouseEnter:n=>{n.currentTarget.style.transform="scale(1.02)"},onMouseLeave:n=>{n.currentTarget.style.transform="scale(1)"},children:[i("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:a?"#ef4444":F,boxShadow:`0 0 8px ${a?"#ef4444":F}`}}),i("span",{children:G}),i("span",{style:{fontSize:"11px",opacity:.6},children:"\u25B2"})]})}),g&&p(Fe,{children:[m&&i("div",{onClick:()=>o(!1),style:{position:"fixed",inset:0,background:"rgba(0, 0, 0, 0.7)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",zIndex:999998}}),p("div",{style:{position:"fixed",bottom:m?"auto":"80px",left:m?"50%":re?"20px":"auto",right:m||re?"auto":"20px",top:m?"50%":"auto",transform:m?"translate(-50%, -50%)":"none",width:m?"calc(100vw - 40px)":"390px",maxWidth:m?"1140px":"calc(100vw - 32px)",height:m?"calc(100vh - 40px)":"560px",maxHeight:m?"900px":"calc(100vh - 100px)",background:s?"#09090b":"#ffffff",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,borderRadius:"20px",boxShadow:m?"0 32px 64px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)":"0 24px 48px -12px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:999999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",transition:"all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"},children:[i("style",{children:`
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
            `}),p("div",{style:{background:s?"#18181b":"#ffffff",color:s?"#ffffff":"#09090b",borderBottom:`1px solid ${s?"#27272a":"#e4e4e7"}`,padding:m?"16px 22px":"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",userSelect:"none",flexShrink:0},children:[p("div",{style:{display:"flex",alignItems:"center",gap:"10px",minWidth:0},children:[i("div",{style:{color:s?"rgba(255,255,255,0.6)":"#71717a",display:"grid",placeItems:"center",flexShrink:0},children:p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("circle",{cx:"12",cy:"12",r:"1"}),i("circle",{cx:"12",cy:"5",r:"1"}),i("circle",{cx:"12",cy:"19",r:"1"})]})}),i("div",{style:{width:"28px",height:"28px",borderRadius:"50%",background:s?"rgba(255,255,255,0.15)":F==="#18181b"?"rgba(24,24,27,0.08)":`${F}18`,display:"grid",placeItems:"center",flexShrink:0,color:s?"#ffffff":F==="#18181b"?"#09090b":F},children:p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),i("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),i("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]})}),p("div",{style:{display:"flex",flexDirection:"column",minWidth:0},children:[i("div",{style:{fontSize:"13.5px",fontWeight:600,color:s?"#ffffff":"#09090b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},children:Y}),p("div",{style:{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"11px",color:s?"rgba(255,255,255,0.75)":"#71717a"},children:[i("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:a?z?"#f59e0b":"#22c55e":w==="connecting"?"#eab308":s?"rgba(255,255,255,0.4)":"#a1a1aa",animation:z?"omnidesk-pulse-amber 1.5s infinite":"none"}}),i("span",{children:a?z?"Thinking \xB7 Checking tools...":"Live \xB7 Speaking":w==="connecting"?"Connecting...":w==="error"?"Error":"Idle \xB7 Ready"})]})]})]}),p("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[i("button",{type:"button",onClick:()=>o(!m),title:m?"Exit Fullscreen":"Open Full",style:{background:s?"rgba(255,255,255,0.1)":"#f4f4f5",border:s?"1px solid rgba(255,255,255,0.15)":"1px solid #e4e4e7",borderRadius:"7px",color:s?"#ffffff":"#52525b",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:n=>n.currentTarget.style.background=s?"rgba(255,255,255,0.2)":"#e4e4e7",onMouseLeave:n=>n.currentTarget.style.background=s?"rgba(255,255,255,0.1)":"#f4f4f5",children:m?p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("polyline",{points:"4 14 10 14 10 20"}),i("polyline",{points:"20 10 14 10 14 4"}),i("line",{x1:"14",y1:"10",x2:"21",y2:"3"}),i("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]}):p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("polyline",{points:"15 3 21 3 21 9"}),i("polyline",{points:"9 21 3 21 3 15"}),i("line",{x1:"21",y1:"3",x2:"14",y2:"10"}),i("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]})}),i("button",{type:"button",onClick:()=>{a&&Te(),fe(!1)},title:"Close Widget",style:{background:s?"rgba(255,255,255,0.1)":"#f4f4f5",border:s?"1px solid rgba(255,255,255,0.15)":"1px solid #e4e4e7",borderRadius:"7px",color:s?"#ffffff":"#52525b",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:n=>n.currentTarget.style.background=s?"rgba(255,255,255,0.2)":"#e4e4e7",onMouseLeave:n=>n.currentTarget.style.background=s?"rgba(255,255,255,0.1)":"#f4f4f5",children:p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("line",{x1:"18",y1:"6",x2:"6",y2:"18"}),i("line",{x1:"6",y1:"6",x2:"18",y2:"18"})]})})]})]}),p("div",{ref:ee,style:{flex:1,minHeight:0,padding:"16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"12px",background:s?"#09090b":"#ffffff"},children:[q.length===0&&p("div",{style:{margin:"auto",textAlign:"center",padding:"10px 18px",background:s?"#18181b":"#f4f4f5",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,color:s?"#a1a1aa":"#52525b",borderRadius:"12px",fontSize:"12.5px",fontWeight:500,display:"inline-flex",alignItems:"center",gap:"8px",alignSelf:"center"},children:[i("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:a?"#22c55e":w==="connecting"?"#eab308":"#a1a1aa",display:"inline-block"}}),i("span",{children:a?"Connected \xB7 Speak to our receptionist":w==="connecting"?"Connecting to receptionist...":"Start a call to talk to our receptionist"})]}),q.map((n,u)=>{let l=n.who==="user";return i("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:l?"flex-end":"flex-start"},children:p("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[!l&&i("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),i("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),i("div",{style:{padding:"10px 14px",borderRadius:l?"14px 14px 2px 14px":"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:l?F:s?"#18181b":"#f4f4f5",color:l?"#ffffff":s?"#fafafa":"#09090b",border:!l&&s?"1px solid #27272a":"none",boxShadow:l?`0 2px 8px ${F}35`:"0 1px 2px rgba(0,0,0,0.04)"},children:n.text})]})},u)}),z&&i("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:"flex-start"},children:p("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[i("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),i("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),p("div",{style:{padding:"10px 14px",borderRadius:"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:s?"#18181b":"#f4f4f5",color:s?"#a1a1aa":"#71717a",border:s?"1px solid #27272a":"none",boxShadow:"0 1px 2px rgba(0,0,0,0.04)",display:"inline-flex",alignItems:"center",gap:"5px",minHeight:"38px"},title:"Agent is thinking and processing...",children:[i("span",{className:"omnidesk-motion-dot omnidesk-dot-1"}),i("span",{className:"omnidesk-motion-dot omnidesk-dot-2"}),i("span",{className:"omnidesk-motion-dot omnidesk-dot-3"})]})]})})]}),Q&&a&&p("div",{style:{padding:"11px 16px",background:"#f0fdf4",borderTop:"1px solid #bbf7d0",display:"flex",flexDirection:"column",gap:"7px",flexShrink:0},children:[p("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"},children:[p("span",{style:{fontSize:"11px",fontWeight:700,color:"#15803d",textTransform:"uppercase",letterSpacing:"0.04em",display:"inline-flex",alignItems:"center",gap:"6px"},children:[i("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:"#22c55e",display:"inline-block"}}),"Email Requested by Agent \u2022 Auto Verification"]}),i("button",{type:"button",onClick:()=>E(!1),style:{background:"none",border:"none",color:"#15803d",cursor:"pointer",fontSize:"12px",fontWeight:700,padding:"1px 4px"},children:"\u2715"})]}),p("form",{onSubmit:we,style:{display:"flex",gap:"6px"},children:[i("input",{type:"email",autoFocus:!0,value:X,onChange:n=>{ce(n.target.value),L("")},placeholder:"Enter your real email (e.g. name@gmail.com)",disabled:Z,required:!0,style:{flex:1,fontSize:"12.5px",padding:"7px 11px",borderRadius:"7px",border:h?"1.5px solid #ef4444":"1px solid #86efac",background:"#ffffff",color:"#09090b",outline:"none"}}),i("button",{type:"submit",disabled:Z||!X.trim(),style:{background:"#16a34a",color:"#ffffff",border:"none",padding:"7px 14px",borderRadius:"7px",fontSize:"12px",fontWeight:600,cursor:Z?"wait":"pointer",opacity:Z?.7:1},children:Z?"...":"Verify & Send"})]}),h&&p("div",{style:{fontSize:"11px",color:"#ef4444",fontWeight:500},children:["\u26A0\uFE0F ",h]}),xe&&p("div",{style:{fontSize:"11px",color:"#15803d",fontWeight:600},children:["\u2713 ",xe]})]}),p("div",{style:{padding:"12px 16px",borderTop:`1px solid ${s?"#27272a":"#e4e4e7"}`,background:s?"#121214":"#fafafa",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0},children:[p("button",{type:"button",onClick:a?Te:ge,disabled:w==="connecting",style:{display:"inline-flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:a?"#dc2626":w==="connecting"?"#64748b":F,color:"#ffffff",borderRadius:"10px",border:"none",fontSize:"13px",fontWeight:600,boxShadow:a?"0 4px 14px rgba(220, 38, 38, 0.35)":`0 4px 14px ${F}40`,cursor:w==="connecting"?"not-allowed":"pointer",transition:"all 0.15s ease"},children:[p("svg",{xmlns:"http://www.w3.org/2000/svg",width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),i("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),i("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]}),i("span",{children:a?"End Voice Call":w==="connecting"?"Connecting...":"Start Voice Call"})]}),p("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[a&&i("div",{style:{display:"flex",alignItems:"center",gap:"2.5px",height:"14px"},children:[12,8,14,6,10].map((n,u)=>i("span",{style:{width:"2.5px",height:`${Math.max(4,Math.min(14,Math.round(n*(.35+Math.max(ye,Ce)*1.5))))}px`,background:F,borderRadius:"1px",transition:"height 0.12s ease"}},u))}),i("span",{style:{fontFamily:"var(--mono, monospace)",fontSize:"12px",fontWeight:600,padding:"3px 8px",borderRadius:"6px",background:s?"#18181b":a?"#000000":"#f4f4f5",color:s||a?"#ffffff":"#71717a",border:s?"1px solid #27272a":"none"},children:Se})]})]})]})]})]})}var ze=_e;var Pe={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function Me(k={}){if(typeof window>"u")return;let{host:d,businessId:S="biz_demo_dental",agentId:T,theme:N="light",position:G="bottom-right",label:M="Talk to Receptionist",accent:R="emerald",accentColor:v,businessName:r,greeting:$,onCallStart:V,onCallEnd:_,onTranscript:W}=k,g=v||Pe[R]||R||"#10b981",fe=document.getElementById("omnidesk-voice-widget-root");fe&&fe.remove();let m=document.createElement("div");m.id="omnidesk-voice-widget-root",m.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let o=N==="dark"||N==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,w=null,O="idle",q=0,K=null,ye=!1,he=!1,Ce=0,be=0,Se=!1,oe=!1,Y=!1,ae=null,Q=null,E=!1,X=G==="bottom-left",ce=document.createElement("div");ce.style.cssText=`
    position: fixed; bottom: 20px; ${X?"left: 20px;":"right: 20px;"};
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
    <span>${M}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,ce.appendChild(Z);let ie=document.createElement("div");ie.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,ie.onclick=()=>pe(!1);let h=document.createElement("div");h.style.cssText=`
    position: fixed; bottom: 80px; ${X?"left: 20px;":"right: 20px;"};
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
          ${r||"OmniDesk Hair Salon & Studio"}
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
  `;let xe=document.createElement("style");xe.textContent=`
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
  `,m.appendChild(xe);let C=document.createElement("div");C.style.cssText=`
    flex: 1; min-height: 0; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 12px; background: ${o?"#09090b":"#ffffff"};
  `;let z=document.createElement("div");z.id="omnidesk-placeholder-banner",z.style.cssText=`
    margin: auto; text-align: center; padding: 10px 18px;
    background: ${o?"#18181b":"#f4f4f5"}; border: 1px solid ${o?"#27272a":"#e4e4e7"}; color: ${o?"#a1a1aa":"#52525b"};
    border-radius: 12px; font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px; align-self: center;
  `,z.innerHTML=`
    <span id="omnidesk-placeholder-dot" style="width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block;"></span>
    <span>Start a call to talk to our receptionist</span>
  `,C.appendChild(z);let y=document.createElement("div");if(y.id="omnidesk-thinking-bubble",y.style.cssText=`
    display: none; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;
  `,y.innerHTML=`
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
  `,C.appendChild(y),$){z.style.display="none";let a=document.createElement("div");a.style.cssText="display: flex; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;";let n=document.createElement("div");n.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let u=document.createElement("div");u.style.cssText="width: 24px; height: 24px; border-radius: 50%; background: #18181b; display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;",u.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let l=document.createElement("div");l.style.cssText=`padding: 10px 14px; border-radius: 14px 14px 14px 2px; font-size: 13px; line-height: 1.45; background: ${o?"#18181b":"#f4f4f5"}; color: ${o?"#fafafa":"#09090b"}; border: ${o?"1px solid #27272a":"none"}; box-shadow: 0 1px 2px rgba(0,0,0,0.04);`,l.innerText=$,n.appendChild(u),n.appendChild(l),a.appendChild(n),C.insertBefore(a,y),ae="agent",Q=l,E=!0}let x=document.createElement("div");x.id="omnidesk-email-bar",x.style.cssText=`
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
  `;let ee=document.createElement("div");ee.style.cssText=`
    padding: 12px 16px; border-top: 1px solid ${o?"#27272a":"#e4e4e7"};
    background: ${o?"#121214":"#fafafa"}; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  `;let c=document.createElement("button");c.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: ${g}; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    box-shadow: 0 4px 14px ${g}40;
    cursor: pointer; transition: all 0.15s ease;
  `,c.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let j=document.createElement("div");j.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let A=document.createElement("div");A.id="omnidesk-waveform",A.style.cssText="display: none; align-items: center; gap: 2.5px; height: 14px;";let ke=[12,8,14,6,10],ne=[];ke.forEach(a=>{let n=document.createElement("span");n.style.cssText=`width: 2.5px; height: ${Math.round(a*.35)}px; background: ${g}; border-radius: 1px; transition: height 0.12s ease;`,A.appendChild(n),ne.push(n)}),j.appendChild(A);let b=document.createElement("span");b.id="omnidesk-timer",b.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,b.innerText="0:00",j.appendChild(b),ee.appendChild(c),ee.appendChild(j),h.appendChild(L),h.appendChild(C),h.appendChild(x),h.appendChild(ee),m.appendChild(ce),m.appendChild(ie),m.appendChild(h),document.body.appendChild(m);function F(){q=Date.now(),b.innerText="0:00",b.style.background=o?"#18181b":"#000000",b.style.color="#ffffff",b.style.border=o?"1px solid #27272a":"none",K&&clearInterval(K),K=setInterval(()=>{let a=Date.now()-q,n=Math.floor(a/1e3),u=Math.floor(n/60),l=n%60;b.innerText=`${u}:${String(l).padStart(2,"0")}`},250)}function s(){K&&(clearInterval(K),K=null),b.style.background="#f4f4f5",b.style.color="#71717a",b.style.border="none",b.innerText="0:00",A.style.display="none"}function te(a){ye=a,h.style.display=a?"flex":"none"}function pe(a){he=a,ie.style.display=a?"block":"none",a?(h.style.top="50%",h.style.left="50%",h.style.bottom="auto",h.style.right="auto",h.style.transform="translate(-50%, -50%)",h.style.width="calc(100vw - 40px)",h.style.maxWidth="1140px",h.style.height="calc(100vh - 40px)",h.style.maxHeight="900px"):(h.style.top="auto",h.style.left=X?"20px":"auto",h.style.right=X?"auto":"20px",h.style.bottom="80px",h.style.transform="none",h.style.width="390px",h.style.maxWidth="calc(100vw - 32px)",h.style.height="560px",h.style.maxHeight="calc(100vh - 100px)")}Z.onclick=()=>te(!ye),L.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{te(!1),pe(!1)}),L.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{pe(!he)});let U=x.querySelector("#omnidesk-email-form"),ge=x.querySelector("#omnidesk-email-input");x.querySelector("#omnidesk-email-close-btn").addEventListener("click",()=>{x.style.display="none"}),U.addEventListener("submit",a=>{a.preventDefault();let n=ge.value.trim();if(!n||!n.includes("@"))return;w&&w.sendEmailInput(n),Y=!0,x.style.display="none",ge.value="",z.style.display="none";let u=document.createElement("div");u.style.cssText=`
      display: flex; flex-direction: column; gap: 4px; max-width: 88%;
      align-self: flex-end;
    `;let l=document.createElement("div");l.style.cssText=`
      padding: 10px 14px; border-radius: 14px 14px 2px 14px;
      font-size: 13px; line-height: 1.45;
      background: ${g}; color: #ffffff;
      box-shadow: 0 2px 8px ${g}35;
    `,l.innerText=`My email is ${n}`,u.appendChild(l),C.insertBefore(u,y),y.style.display="flex",C.scrollTop=C.scrollHeight,ae="user",Q=l,E=!0});async function we(){Se=!1,oe=!1,Y=!1,x.style.display="none",y.style.display="none",ae=null,Q=null,E=!1;let a=L.querySelector("#omnidesk-status-text"),n=L.querySelector("#omnidesk-status-dot"),u=c.querySelector("#omnidesk-btn-text");a.innerText="Connecting...",n.style.background="#eab308",u.innerText="Connecting...",c.style.background="#64748b",c.style.boxShadow="none",c.disabled=!0,F();try{let l=d;if(!l&&typeof document<"u"){let e=document.querySelector("script[src*='widget.js']");if(e&&e.src&&e.src.startsWith("http"))try{l=new URL(e.src).origin}catch{}}!l&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(l=window.location.origin);let P=(l||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),J=await fetch(`${P}/api/token?businessId=${encodeURIComponent(S)}`);if(!J.ok)throw new Error(`Failed to get session token (${J.status})`);let H=await J.json();if(H.business_name&&!r){let e=L.querySelector("#omnidesk-biz-title");e&&(e.innerText=H.business_name)}let f=T||H.agent_id||"";w=new de({onStatusChange:e=>{if(O=e,e==="connected")a.innerText="Live \xB7 Speaking",n.style.background="#22c55e",u.innerText="End Voice Call",c.style.background="#dc2626",c.style.boxShadow="0 4px 14px rgba(220, 38, 38, 0.35)",c.disabled=!1,A.style.display="flex",q=Date.now(),V?.();else if(e==="idle"&&(a.innerText="Idle \xB7 Ready",n.style.background=o?"rgba(255,255,255,0.4)":"#a1a1aa",u.innerText="Start Voice Call",c.style.background=g,c.style.boxShadow=`0 4px 14px ${g}40`,c.disabled=!1,A.style.display="none",x.style.display="none",y.style.display="none",s(),q>0)){let t=Math.round((Date.now()-q)/1e3);q=0,_?.(t)}},onThinkingChange:e=>{e&&(y.style.display="flex",C.scrollTop=C.scrollHeight)},onTranscript:e=>{if(z.style.display="none",e.who==="user"){e.isFinal&&(y.style.display="flex");let t=e.text.toLowerCase();(t==="no"||t.startsWith("no ")||t.includes("no,")||t.includes("wrong")||t.includes("incorrect")||t.includes("change my email")||t.includes("different email"))&&(Y=!1),(e.text.includes("@")||t.includes(" at ")&&t.includes(" dot ")||t.includes("gmail.com")||t.includes("yahoo.com")||t.includes("outlook.com")||t.includes("hotmail.com")||t.includes("icloud.com"))&&(x.style.display="none",Y=!0)}else if(e.who==="agent"){e.text&&e.text.trim().length>0&&(y.style.display="none");let t=e.text.toLowerCase();if(t.includes("confirmation code is")||t.includes("booking is confirmed")||t.includes("scheduled your appointment")||t.includes("all set, your appointment")||t.includes("sent your confirmation")&&(t.includes("code")||t.includes("calendar invite"))||t.includes("sent a calendar invite")&&(t.includes("code")||t.includes("all set"))){oe=!0,Y=!1,x.style.display="none";return}if(oe){x.style.display="none";return}if(t.includes("confirm with yes or no")||t.includes("yes or no")||t.includes("is that correct")||t.includes("is that right")){Y=!0,x.style.display="none";return}t.includes("what is your email")||t.includes("what's your email")||t.includes("may i have your email")||t.includes("can i have your email")||t.includes("could i get your email")||t.includes("could you provide your email")||t.includes("provide your email")||t.includes("enter your email")||t.includes("spell your email")||t.includes("share your email")||t.includes("need your email")||t.includes("what email")||t.includes("which email")||t.includes("where can i send your confirmation")||t.includes("where should i send your confirmation")||t.includes("where can i send your calendar")||t.includes("where should i send your calendar")||t.includes("email")&&(t.includes("what is")||t.includes("what's")||t.includes("may i have")||t.includes("can i have")||t.includes("provide")||t.includes("give me")||t.includes("tell me")||t.includes("send your calendar invite")||t.includes("send your confirmation"))?(Y=!1,x.style.display="flex",setTimeout(()=>ge.focus(),60)):x.style.display="none"}if(ae===e.who&&Q&&!E)Q.innerText=e.text,E=!!e.isFinal;else{let t=e.who==="user",D=document.createElement("div");if(D.style.cssText=`
              display: flex; flex-direction: column; gap: 4px; max-width: 88%;
              align-self: ${t?"flex-end":"flex-start"};
            `,t){let B=document.createElement("div");B.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 2px 14px;
                font-size: 13px; line-height: 1.45;
                background: ${g};
                color: #ffffff;
                box-shadow: 0 2px 8px ${g}35;
              `,B.innerText=e.text,D.appendChild(B),Q=B}else{let B=document.createElement("div");B.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let le=document.createElement("div");le.style.cssText=`
                width: 24px; height: 24px; border-radius: 50%; background: #18181b;
                display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;
              `,le.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let ue=document.createElement("div");ue.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 14px 2px;
                font-size: 13px; line-height: 1.45;
                background: ${o?"#18181b":"#f4f4f5"};
                color: ${o?"#fafafa":"#09090b"};
                border: ${o?"1px solid #27272a":"none"};
                box-shadow: 0 1px 2px rgba(0,0,0,0.04);
              `,ue.innerText=e.text,B.appendChild(le),B.appendChild(ue),D.appendChild(B),Q=ue}C.insertBefore(D,y),ae=e.who,E=!!e.isFinal}C.scrollTop=C.scrollHeight,W?.(e)},onAudioLevel:(e,t)=>{if(Ce=e,be=t,O==="connected"){A.style.display="flex";let D=Math.max(e,t);ke.forEach((B,le)=>{let ue=Math.max(4,Math.min(14,Math.round(B*(.35+D*1.5))));ne[le]&&(ne[le].style.height=`${ue}px`)})}},onError:()=>{a.innerText="Error",n.style.background="#ef4444",u.innerText="Start Voice Call",c.style.background=g,c.style.boxShadow=`0 4px 14px ${g}40`,c.disabled=!1,A.style.display="none",x.style.display="none",y.style.display="none",s()}}),await w.start(H.token,f,H.voice)}catch(l){console.error("[OmniDesk Voice Widget Error]:",l),a.innerText="Error",n.style.background="#ef4444",u.innerText="Start Voice Call",c.style.background=g,c.style.boxShadow=`0 4px 14px ${g}40`,c.disabled=!1,A.style.display="none",x.style.display="none",y.style.display="none",s()}}function re(){w&&(w.stop(),w=null),O="idle";let a=L.querySelector("#omnidesk-status-text"),n=L.querySelector("#omnidesk-status-dot"),u=c.querySelector("#omnidesk-btn-text");a&&(a.innerText="Idle \xB7 Ready"),n&&(n.style.background=o?"rgba(255,255,255,0.4)":"#a1a1aa"),u&&(u.innerText="Start Voice Call"),c.style.background=g,c.style.boxShadow=`0 4px 14px ${g}40`,c.disabled=!1,A.style.display="none",x.style.display="none",y.style.display="none",oe=!1,Y=!1,s()}return c.onclick=()=>{O==="connected"?re():O==="idle"&&we()},{destroy:()=>{s(),w&&w.stop(),m.remove()},startCall:we,endCall:re}}if(typeof document<"u"){let k=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(k){let d,S=k.src||"";if(S&&S.startsWith("http"))try{d=new URL(S).origin}catch{}let T=k.getAttribute("data-business-id")||void 0,N=k.getAttribute("data-agent")||void 0,G=k.getAttribute("data-theme")||"dark",M=k.getAttribute("data-accent")||"emerald",R=k.getAttribute("data-position")||"bottom-right",v=k.getAttribute("data-label")||void 0,r=k.getAttribute("data-host")||d||"https://omni-desk-rho.vercel.app",$=k.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{Me({businessId:T,agentId:N,theme:G,accent:M,position:R,label:v,host:r,greeting:$})}):Me({businessId:T,agentId:N,theme:G,accent:M,position:R,label:v,host:r,greeting:$})}}export{de as AssemblyAIVoiceClient,_e as OmniDeskWidget,ze as VoiceWidget,Me as initOmniDeskWidget};
//# sourceMappingURL=index.mjs.map