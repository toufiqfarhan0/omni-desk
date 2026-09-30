import{useState as I,useRef as fe,useEffect as Ee,useCallback as me,useMemo as Se}from"react";var ve=24e3,$e="wss://agents.assemblyai.com/v1/ws",_e=`
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
`,Ie=`
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
`;async function Me(b,c,T){let M=URL.createObjectURL(new Blob([c],{type:"application/javascript"}));try{await b.audioWorklet.addModule(M)}finally{URL.revokeObjectURL(M)}return new AudioWorkletNode(b,T)}var ae=class{constructor(c){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.isThinking=!1;this.callbacks=c}setThinking(c){this.isThinking!==c&&(this.isThinking=c,this.callbacks.onThinkingChange?.(c))}async start(c,T,M){try{this.callbacks.onStatusChange?.("connecting");let F=window.AudioContext||window.webkitAudioContext;this.captureCtx=new F({sampleRate:ve}),this.playbackCtx=new F({sampleRate:ve}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await Me(this.playbackCtx,Ie,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0}}),this.captureNode=await Me(this.captureCtx,_e,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let J=new URL($e);J.searchParams.set("token",c),this.ws=new WebSocket(J.toString()),this.captureNode.port.onmessage=({data:S})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let r=new Uint8Array(S),L="";for(let R=0;R<r.length;R+=32768)L+=String.fromCharCode.apply(null,Array.from(r.subarray(R,R+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(L)}));let V=new Int16Array(S),$=0;for(let R=0;R<V.length;R+=16)$+=Math.abs(V[R]);this.userLevel=Math.min(1,$/(V.length/16)/8e3)},this.ws.onopen=()=>{let S={};T&&T.trim()?S.agent_id=T.trim():M&&M.trim()&&(S.output={voice:M.trim()}),Object.keys(S).length>0&&this.ws?.send(JSON.stringify({type:"session.update",session:S}))};let E="",A="";this.ws.onmessage=({data:S})=>{try{let r=JSON.parse(S);switch(r.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0,A="",this.setThinking(!1);break;case"transcript.user.delta":r.text&&(A=r.text,this.callbacks.onTranscript?.({who:"user",text:r.text,isFinal:!1}));break;case"transcript.user":r.text&&(A=r.text,this.callbacks.onTranscript?.({who:"user",text:r.text,isFinal:!0}),this.setThinking(!0));break;case"reply.started":E="";break;case"transcript.agent.delta":r.delta&&(this.setThinking(!1),E&&!E.endsWith(" ")&&!/^[.,!?;:%)]/.test(r.delta)?E+=" "+r.delta:E+=r.delta,this.callbacks.onTranscript?.({who:"agent",text:E,isFinal:!1}));break;case"transcript.agent":r.text&&(this.setThinking(!1),E=r.text,this.callbacks.onTranscript?.({who:"agent",text:r.text,isFinal:!0}));break;case"reply.audio":if(r.data&&this.playbackNode){let L=atob(r.data),V=new Uint8Array(L.length);for(let $=0;$<L.length;$++)V[$]=L.charCodeAt($);this.playbackNode.port.postMessage(V.buffer,[V.buffer]),this.agentLevel=.8}break;case"reply.done":r.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:r.name||r.tool,args:r.arguments||r.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:r.name||r.tool,result:r.result});break;case"session.error":this.setThinking(!1),this.callbacks.onError?.(r.message||r.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.setThinking(!1),this.stop();break}}catch(r){console.warn("Message parsing error:",r)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(F){this.callbacks.onError?.(F.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(c){this.isMuted=c,c&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(c,T){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:c})),T&&this.ws.send(JSON.stringify({type:"reply.create",instructions:T})),!0}catch(M){return console.error("Failed to send message to agent:",M),!1}}sendEmailInput(c){return this.sendUserMessage(`My email address is ${c}`,`The caller entered their verified email address: ${c}. Acknowledge this email, verify it using verify_customer_email if needed, and complete the booking.`)}stop(){if(this.setThinking(!1),this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(c=>c.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let c=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(c)};this.animFrameId=requestAnimationFrame(c)}};import{Fragment as We,jsx as i,jsxs as u}from"react/jsx-runtime";var Ae={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function Le({host:b="",businessId:c="biz_demo_dental",agentId:T,theme:M="light",position:F="bottom-right",label:J="Talk to Receptionist",accent:E="emerald",accentColor:A,businessName:S,greeting:r,className:L,onCallStart:V,onCallEnd:$,onTranscript:R}){let[x,he]=I(!1),[g,o]=I(!1),[k,N]=I("idle"),[j,Y]=I([]),[ye,xe]=I(0),[we,be]=I(0),[ne,te]=I("0:00"),[G,ie]=I(S||"OmniDesk Hair Salon & Studio"),[re,U]=I(!1),[K,se]=I(""),[p,_]=I(!1),[le,v]=I(""),[q,y]=I(""),[m,B]=I(!1),d=fe(null),Q=fe(null),w=fe(0),X=fe(null),de=fe(0),C=fe(!1),W=Se(()=>A||Ae[E]||E||"#10b981",[E,A]),s=Se(()=>M==="dark"?!0:M==="auto"&&typeof window<"u"?window.matchMedia("(prefers-color-scheme: dark)").matches:!1,[M]);Ee(()=>{Q.current&&(Q.current.scrollTop=Q.current.scrollHeight)},[j,m]);let ee=Se(()=>b?b.replace(/\/$/,""):typeof window<"u"&&window.location.origin?window.location.origin:"",[b]),ce=me(()=>{de.current=Date.now(),te("0:00"),X.current&&clearInterval(X.current),X.current=setInterval(()=>{let n=Date.now()-de.current,f=Math.floor(n/1e3),l=Math.floor(f/60),P=f%60;te(`${l}:${String(P).padStart(2,"0")}`)},250)},[]),O=me(()=>{X.current&&(clearInterval(X.current),X.current=null)},[]),ge=me(async()=>{try{N("connecting"),C.current=!1,U(!1),ce();let f=`${ee?ee.replace(/\/$/,""):""}/api/token?businessId=${encodeURIComponent(c)}`,l=await fetch(f);if(!l.ok)throw new Error("Failed to initialize voice session");let P=await l.json();if(P.business_name&&!S&&ie(P.business_name),!P.token)throw new Error("Invalid session token payload received from host");let Z=T||P.agent_id||"",D=new ae({onStatusChange:h=>{if(N(h),h==="connected")w.current=Date.now(),V?.();else if(h==="idle"){if(B(!1),O(),w.current>0){let e=Math.round((Date.now()-w.current)/1e3);w.current=0,$?.(e)}}else h==="error"&&(B(!1),O())},onThinkingChange:h=>{h&&B(!0)},onTranscript:h=>{if(h.who==="user"?B(!0):h.who==="agent"&&h.text&&h.text.trim().length>0&&B(!1),Y(e=>{let t=e[e.length-1];if(t&&t.who===h.who&&!t.isFinal){let z=[...e];return z[z.length-1]={...t,text:h.text,isFinal:h.isFinal??!1},z}return[...e,{id:h.id||`${Date.now()}-${Math.random()}`,who:h.who,text:h.text,isFinal:h.isFinal??!1}]}),R?.(h),h.who==="user"){let e=h.text.toLowerCase();(h.text.includes("@")||e.includes(" at ")&&e.includes(" dot ")||e.includes("gmail")||e.includes("yahoo")||e.includes("outlook")||e.includes("hotmail")||e.includes("icloud"))&&(C.current=!0,U(!1))}else if(h.who==="agent"){let e=h.text.toLowerCase();(e.includes("verified your email")||e.includes("email is verified")||e.includes("verified that email")||e.includes("sent a calendar")||e.includes("sent your confirmation")||e.includes("calendar invite")||e.includes("confirmation code is")||e.includes("booking is confirmed")||e.includes("all set, your appointment")||e.includes("scheduled your appointment"))&&(C.current=!0);let z=!C.current&&(e.includes("what is your email")||e.includes("what's your email")||e.includes("may i have your email")||e.includes("can i have your email")||e.includes("could i get your email")||e.includes("could you provide your email")||e.includes("provide your email")||e.includes("enter your email")||e.includes("spell your email")||e.includes("share your email")||e.includes("need your email")||e.includes("what email")||e.includes("which email")||e.includes("where can i send your confirmation")||e.includes("where should i send your confirmation")||e.includes("where can i send your calendar")||e.includes("where should i send your calendar")||e.includes("email")&&(e.includes("what is")||e.includes("what's")||e.includes("may i have")||e.includes("can you provide")||e.includes("could you provide")||e.includes("give me your")||e.includes("tell me your")));U(!!z)}},onAudioLevel:(h,e)=>{xe(h),be(e)},onError:()=>{N("error"),O()}});d.current=D,await D.start(P.token,Z,P.voice)}catch{N("error"),O()}},[ee,c,T,S,V,$,R,ce,O]),Ce=me(()=>{if(d.current&&(d.current.stop(),d.current=null),N("idle"),B(!1),xe(0),be(0),O(),U(!1),v(""),y(""),w.current>0){let n=Math.round((Date.now()-w.current)/1e3);w.current=0,$?.(n)}},[$,O]),ke=me(async n=>{n.preventDefault();let f=K.trim();if(f){_(!0),v(""),y("");try{let l=ee?ee.replace(/\/$/,""):"",P=await fetch(`${l}/api/tools/${encodeURIComponent(c)}/verify_customer_email`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:f})}),Z=await P.json();if(!P.ok||!Z.valid||!Z.email){v(Z.message||"Invalid email or domain has no active mail server."),_(!1);return}let D=Z.email;y(`Verified: ${D}. Sent to agent.`),Y(h=>[...h,{who:"user",text:`My email is ${D}`}]),d.current&&d.current.sendEmailInput(D),B(!0),C.current=!0,se(""),U(!1),y("")}catch(l){v(l.message||"Failed to verify email with mail server.")}finally{_(!1)}}},[K,ee,c]);Ee(()=>()=>{O(),d.current&&d.current.stop()},[O]);let oe=F==="bottom-left",a=k==="connected";return u("div",{className:L,style:{position:"relative",zIndex:99999},children:[i("div",{style:{position:"fixed",bottom:"20px",left:oe?"20px":"auto",right:oe?"auto":"20px",zIndex:99999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:u("button",{type:"button",onClick:()=>he(!x),style:{display:"inline-flex",alignItems:"center",gap:"10px",background:s?"#18181b":"#ffffff",color:s?"#fafafa":"#09090b",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,padding:"10px 18px",borderRadius:"9999px",cursor:"pointer",fontSize:"13px",fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.18)",transition:"transform 0.15s ease, background 0.15s ease"},onMouseEnter:n=>{n.currentTarget.style.transform="scale(1.02)"},onMouseLeave:n=>{n.currentTarget.style.transform="scale(1)"},children:[i("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:a?"#ef4444":W,boxShadow:`0 0 8px ${a?"#ef4444":W}`}}),i("span",{children:J}),i("span",{style:{fontSize:"11px",opacity:.6},children:"\u25B2"})]})}),x&&u(We,{children:[g&&i("div",{onClick:()=>o(!1),style:{position:"fixed",inset:0,background:"rgba(0, 0, 0, 0.7)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",zIndex:999998}}),u("div",{style:{position:"fixed",bottom:g?"auto":"80px",left:g?"50%":oe?"20px":"auto",right:g||oe?"auto":"20px",top:g?"50%":"auto",transform:g?"translate(-50%, -50%)":"none",width:g?"calc(100vw - 40px)":"390px",maxWidth:g?"1140px":"calc(100vw - 32px)",height:g?"calc(100vh - 40px)":"560px",maxHeight:g?"900px":"calc(100vh - 100px)",background:s?"#09090b":"#ffffff",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,borderRadius:"20px",boxShadow:g?"0 32px 64px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)":"0 24px 48px -12px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:999999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",transition:"all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"},children:[i("style",{children:`
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
            `}),u("div",{style:{background:s?"#18181b":"#ffffff",color:s?"#ffffff":"#09090b",borderBottom:`1px solid ${s?"#27272a":"#e4e4e7"}`,padding:g?"16px 22px":"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",userSelect:"none",flexShrink:0},children:[u("div",{style:{display:"flex",alignItems:"center",gap:"10px",minWidth:0},children:[i("div",{style:{color:s?"rgba(255,255,255,0.6)":"#71717a",display:"grid",placeItems:"center",flexShrink:0},children:u("svg",{xmlns:"http://www.w3.org/2000/svg",width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("circle",{cx:"12",cy:"12",r:"1"}),i("circle",{cx:"12",cy:"5",r:"1"}),i("circle",{cx:"12",cy:"19",r:"1"})]})}),i("div",{style:{width:"28px",height:"28px",borderRadius:"50%",background:s?"rgba(255,255,255,0.15)":W==="#18181b"?"rgba(24,24,27,0.08)":`${W}18`,display:"grid",placeItems:"center",flexShrink:0,color:s?"#ffffff":W==="#18181b"?"#09090b":W},children:u("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),i("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),i("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]})}),u("div",{style:{display:"flex",flexDirection:"column",minWidth:0},children:[i("div",{style:{fontSize:"13.5px",fontWeight:600,color:s?"#ffffff":"#09090b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},children:G}),u("div",{style:{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"11px",color:s?"rgba(255,255,255,0.75)":"#71717a"},children:[i("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:a?m?"#f59e0b":"#22c55e":k==="connecting"?"#eab308":s?"rgba(255,255,255,0.4)":"#a1a1aa",animation:m?"omnidesk-pulse-amber 1.5s infinite":"none"}}),i("span",{children:a?m?"Thinking \xB7 Checking tools...":"Live \xB7 Speaking":k==="connecting"?"Connecting...":k==="error"?"Error":"Idle \xB7 Ready"})]})]})]}),u("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[i("button",{type:"button",onClick:()=>o(!g),title:g?"Exit Fullscreen":"Open Full",style:{background:s?"rgba(255,255,255,0.1)":"#f4f4f5",border:s?"1px solid rgba(255,255,255,0.15)":"1px solid #e4e4e7",borderRadius:"7px",color:s?"#ffffff":"#52525b",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:n=>n.currentTarget.style.background=s?"rgba(255,255,255,0.2)":"#e4e4e7",onMouseLeave:n=>n.currentTarget.style.background=s?"rgba(255,255,255,0.1)":"#f4f4f5",children:g?u("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("polyline",{points:"4 14 10 14 10 20"}),i("polyline",{points:"20 10 14 10 14 4"}),i("line",{x1:"14",y1:"10",x2:"21",y2:"3"}),i("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]}):u("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("polyline",{points:"15 3 21 3 21 9"}),i("polyline",{points:"9 21 3 21 3 15"}),i("line",{x1:"21",y1:"3",x2:"14",y2:"10"}),i("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]})}),i("button",{type:"button",onClick:()=>{a&&Ce(),he(!1)},title:"Close Widget",style:{background:s?"rgba(255,255,255,0.1)":"#f4f4f5",border:s?"1px solid rgba(255,255,255,0.15)":"1px solid #e4e4e7",borderRadius:"7px",color:s?"#ffffff":"#52525b",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:n=>n.currentTarget.style.background=s?"rgba(255,255,255,0.2)":"#e4e4e7",onMouseLeave:n=>n.currentTarget.style.background=s?"rgba(255,255,255,0.1)":"#f4f4f5",children:u("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("line",{x1:"18",y1:"6",x2:"6",y2:"18"}),i("line",{x1:"6",y1:"6",x2:"18",y2:"18"})]})})]})]}),u("div",{ref:Q,style:{flex:1,minHeight:0,padding:"16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"12px",background:s?"#09090b":"#ffffff"},children:[j.length===0&&u("div",{style:{margin:"auto",textAlign:"center",padding:"10px 18px",background:s?"#18181b":"#f4f4f5",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,color:s?"#a1a1aa":"#52525b",borderRadius:"12px",fontSize:"12.5px",fontWeight:500,display:"inline-flex",alignItems:"center",gap:"8px",alignSelf:"center"},children:[i("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:a?"#22c55e":k==="connecting"?"#eab308":"#a1a1aa",display:"inline-block"}}),i("span",{children:a?"Connected \xB7 Speak to our receptionist":k==="connecting"?"Connecting to receptionist...":"Start a call to talk to our receptionist"})]}),j.map((n,f)=>{let l=n.who==="user";return i("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:l?"flex-end":"flex-start"},children:u("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[!l&&i("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:u("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),i("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),i("div",{style:{padding:"10px 14px",borderRadius:l?"14px 14px 2px 14px":"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:l?W:s?"#18181b":"#f4f4f5",color:l?"#ffffff":s?"#fafafa":"#09090b",border:!l&&s?"1px solid #27272a":"none",boxShadow:l?`0 2px 8px ${W}35`:"0 1px 2px rgba(0,0,0,0.04)"},children:n.text})]})},f)}),m&&i("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:"flex-start"},children:u("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[i("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:u("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),i("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),u("div",{style:{padding:"10px 14px",borderRadius:"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:s?"#18181b":"#f4f4f5",color:s?"#a1a1aa":"#71717a",border:s?"1px solid #27272a":"none",boxShadow:"0 1px 2px rgba(0,0,0,0.04)",display:"inline-flex",alignItems:"center",gap:"5px",minHeight:"38px"},title:"Agent is thinking and processing...",children:[i("span",{className:"omnidesk-motion-dot omnidesk-dot-1"}),i("span",{className:"omnidesk-motion-dot omnidesk-dot-2"}),i("span",{className:"omnidesk-motion-dot omnidesk-dot-3"})]})]})})]}),re&&a&&u("div",{style:{padding:"11px 16px",background:"#f0fdf4",borderTop:"1px solid #bbf7d0",display:"flex",flexDirection:"column",gap:"7px",flexShrink:0},children:[u("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"},children:[u("span",{style:{fontSize:"11px",fontWeight:700,color:"#15803d",textTransform:"uppercase",letterSpacing:"0.04em",display:"inline-flex",alignItems:"center",gap:"6px"},children:[i("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:"#22c55e",display:"inline-block"}}),"Email Requested by Agent \u2022 Auto Verification"]}),i("button",{type:"button",onClick:()=>U(!1),style:{background:"none",border:"none",color:"#15803d",cursor:"pointer",fontSize:"12px",fontWeight:700,padding:"1px 4px"},children:"\u2715"})]}),u("form",{onSubmit:ke,style:{display:"flex",gap:"6px"},children:[i("input",{type:"email",autoFocus:!0,value:K,onChange:n=>{se(n.target.value),v("")},placeholder:"Enter your real email (e.g. name@gmail.com)",disabled:p,required:!0,style:{flex:1,fontSize:"12.5px",padding:"7px 11px",borderRadius:"7px",border:le?"1.5px solid #ef4444":"1px solid #86efac",background:"#ffffff",color:"#09090b",outline:"none"}}),i("button",{type:"submit",disabled:p||!K.trim(),style:{background:"#16a34a",color:"#ffffff",border:"none",padding:"7px 14px",borderRadius:"7px",fontSize:"12px",fontWeight:600,cursor:p?"wait":"pointer",opacity:p?.7:1},children:p?"...":"Verify & Send"})]}),le&&u("div",{style:{fontSize:"11px",color:"#ef4444",fontWeight:500},children:["\u26A0\uFE0F ",le]}),q&&u("div",{style:{fontSize:"11px",color:"#15803d",fontWeight:600},children:["\u2713 ",q]})]}),u("div",{style:{padding:"12px 16px",borderTop:`1px solid ${s?"#27272a":"#e4e4e7"}`,background:s?"#121214":"#fafafa",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0},children:[u("button",{type:"button",onClick:a?Ce:ge,disabled:k==="connecting",style:{display:"inline-flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:a?"#dc2626":k==="connecting"?"#64748b":W,color:"#ffffff",borderRadius:"10px",border:"none",fontSize:"13px",fontWeight:600,boxShadow:a?"0 4px 14px rgba(220, 38, 38, 0.35)":`0 4px 14px ${W}40`,cursor:k==="connecting"?"not-allowed":"pointer",transition:"all 0.15s ease"},children:[u("svg",{xmlns:"http://www.w3.org/2000/svg",width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[i("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),i("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),i("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]}),i("span",{children:a?"End Voice Call":k==="connecting"?"Connecting...":"Start Voice Call"})]}),u("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[a&&i("div",{style:{display:"flex",alignItems:"center",gap:"2.5px",height:"14px"},children:[12,8,14,6,10].map((n,f)=>i("span",{style:{width:"2.5px",height:`${Math.max(4,Math.min(14,Math.round(n*(.35+Math.max(ye,we)*1.5))))}px`,background:W,borderRadius:"1px",transition:"height 0.12s ease"}},f))}),i("span",{style:{fontFamily:"var(--mono, monospace)",fontSize:"12px",fontWeight:600,padding:"3px 8px",borderRadius:"6px",background:s?"#18181b":a?"#000000":"#f4f4f5",color:s||a?"#ffffff":"#71717a",border:s?"1px solid #27272a":"none"},children:ne})]})]})]})]})]})}var Re=Le;var Pe={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function Te(b={}){if(typeof window>"u")return;let{host:c,businessId:T="biz_demo_dental",agentId:M,theme:F="light",position:J="bottom-right",label:E="Talk to Receptionist",accent:A="emerald",accentColor:S,businessName:r,greeting:L,onCallStart:V,onCallEnd:$,onTranscript:R}=b,x=S||Pe[A]||A||"#10b981",he=document.getElementById("omnidesk-voice-widget-root");he&&he.remove();let g=document.createElement("div");g.id="omnidesk-voice-widget-root",g.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let o=F==="dark"||F==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,k=null,N="idle",j=0,Y=null,ye=!1,xe=!1,we=0,be=0,ne=!1,te=null,G=null,ie=!1,re=J==="bottom-left",U=document.createElement("div");U.style.cssText=`
    position: fixed; bottom: 20px; ${re?"left: 20px;":"right: 20px;"};
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
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${x};box-shadow:0 0 8px ${x};display:inline-block;"></span>
    <span>${E}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,U.appendChild(K);let se=document.createElement("div");se.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,se.onclick=()=>ce(!1);let p=document.createElement("div");p.style.cssText=`
    position: fixed; bottom: 80px; ${re?"left: 20px;":"right: 20px;"};
    width: 390px; max-width: calc(100vw - 32px); height: 560px; max-height: calc(100vh - 100px);
    background: ${o?"#09090b":"#ffffff"}; border: 1px solid ${o?"#27272a":"#e4e4e7"};
    border-radius: 20px; box-shadow: 0 24px 48px -12px rgba(0,0,0,0.22);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  `;let _=document.createElement("div");_.style.cssText=`
    background: ${o?"#18181b":"#ffffff"}; color: ${o?"#ffffff":"#09090b"};
    border-bottom: 1px solid ${o?"#27272a":"#e4e4e7"};
    padding: 13px 18px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; user-select: none; flex-shrink: 0;
  `,_.innerHTML=`
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
  `;let le=document.createElement("style");le.textContent=`
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
  `,g.appendChild(le);let v=document.createElement("div");v.style.cssText=`
    flex: 1; min-height: 0; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 12px; background: ${o?"#09090b":"#ffffff"};
  `;let q=document.createElement("div");q.id="omnidesk-placeholder-banner",q.style.cssText=`
    margin: auto; text-align: center; padding: 10px 18px;
    background: ${o?"#18181b":"#f4f4f5"}; border: 1px solid ${o?"#27272a":"#e4e4e7"}; color: ${o?"#a1a1aa":"#52525b"};
    border-radius: 12px; font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px; align-self: center;
  `,q.innerHTML=`
    <span id="omnidesk-placeholder-dot" style="width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block;"></span>
    <span>Start a call to talk to our receptionist</span>
  `,v.appendChild(q);let y=document.createElement("div");if(y.id="omnidesk-thinking-bubble",y.style.cssText=`
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
  `,v.appendChild(y),L){q.style.display="none";let a=document.createElement("div");a.style.cssText="display: flex; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;";let n=document.createElement("div");n.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let f=document.createElement("div");f.style.cssText="width: 24px; height: 24px; border-radius: 50%; background: #18181b; display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;",f.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let l=document.createElement("div");l.style.cssText=`padding: 10px 14px; border-radius: 14px 14px 14px 2px; font-size: 13px; line-height: 1.45; background: ${o?"#18181b":"#f4f4f5"}; color: ${o?"#fafafa":"#09090b"}; border: ${o?"1px solid #27272a":"none"}; box-shadow: 0 1px 2px rgba(0,0,0,0.04);`,l.innerText=L,n.appendChild(f),n.appendChild(l),a.appendChild(n),v.insertBefore(a,y),te="agent",G=l,ie=!0}let m=document.createElement("div");m.id="omnidesk-email-bar",m.style.cssText=`
    padding: 11px 16px; background: #f0fdf4; border-top: 1px solid #bbf7d0;
    display: none; flex-direction: column; gap: 7px; flex-shrink: 0;
  `,m.innerHTML=`
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
  `;let B=document.createElement("div");B.style.cssText=`
    padding: 12px 16px; border-top: 1px solid ${o?"#27272a":"#e4e4e7"};
    background: ${o?"#121214":"#fafafa"}; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  `;let d=document.createElement("button");d.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: ${x}; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    box-shadow: 0 4px 14px ${x}40;
    cursor: pointer; transition: all 0.15s ease;
  `,d.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let Q=document.createElement("div");Q.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let w=document.createElement("div");w.id="omnidesk-waveform",w.style.cssText="display: none; align-items: center; gap: 2.5px; height: 14px;";let X=[12,8,14,6,10],de=[];X.forEach(a=>{let n=document.createElement("span");n.style.cssText=`width: 2.5px; height: ${Math.round(a*.35)}px; background: ${x}; border-radius: 1px; transition: height 0.12s ease;`,w.appendChild(n),de.push(n)}),Q.appendChild(w);let C=document.createElement("span");C.id="omnidesk-timer",C.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,C.innerText="0:00",Q.appendChild(C),B.appendChild(d),B.appendChild(Q),p.appendChild(_),p.appendChild(v),p.appendChild(m),p.appendChild(B),g.appendChild(U),g.appendChild(se),g.appendChild(p),document.body.appendChild(g);function W(){j=Date.now(),C.innerText="0:00",C.style.background=o?"#18181b":"#000000",C.style.color="#ffffff",C.style.border=o?"1px solid #27272a":"none",Y&&clearInterval(Y),Y=setInterval(()=>{let a=Date.now()-j,n=Math.floor(a/1e3),f=Math.floor(n/60),l=n%60;C.innerText=`${f}:${String(l).padStart(2,"0")}`},250)}function s(){Y&&(clearInterval(Y),Y=null),C.style.background="#f4f4f5",C.style.color="#71717a",C.style.border="none",C.innerText="0:00",w.style.display="none"}function ee(a){ye=a,p.style.display=a?"flex":"none"}function ce(a){xe=a,se.style.display=a?"block":"none",a?(p.style.top="50%",p.style.left="50%",p.style.bottom="auto",p.style.right="auto",p.style.transform="translate(-50%, -50%)",p.style.width="calc(100vw - 40px)",p.style.maxWidth="1140px",p.style.height="calc(100vh - 40px)",p.style.maxHeight="900px"):(p.style.top="auto",p.style.left=re?"20px":"auto",p.style.right=re?"auto":"20px",p.style.bottom="80px",p.style.transform="none",p.style.width="390px",p.style.maxWidth="calc(100vw - 32px)",p.style.height="560px",p.style.maxHeight="calc(100vh - 100px)")}K.onclick=()=>ee(!ye),_.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{ee(!1),ce(!1)}),_.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{ce(!xe)});let O=m.querySelector("#omnidesk-email-form"),ge=m.querySelector("#omnidesk-email-input");m.querySelector("#omnidesk-email-close-btn").addEventListener("click",()=>{m.style.display="none"}),O.addEventListener("submit",a=>{a.preventDefault();let n=ge.value.trim();if(!n||!n.includes("@"))return;k&&k.sendEmailInput(n),ne=!0,m.style.display="none",ge.value="",q.style.display="none";let f=document.createElement("div");f.style.cssText=`
      display: flex; flex-direction: column; gap: 4px; max-width: 88%;
      align-self: flex-end;
    `;let l=document.createElement("div");l.style.cssText=`
      padding: 10px 14px; border-radius: 14px 14px 2px 14px;
      font-size: 13px; line-height: 1.45;
      background: ${x}; color: #ffffff;
      box-shadow: 0 2px 8px ${x}35;
    `,l.innerText=`My email is ${n}`,f.appendChild(l),v.insertBefore(f,y),y.style.display="flex",v.scrollTop=v.scrollHeight,te="user",G=l,ie=!0});async function ke(){ne=!1,m.style.display="none",y.style.display="none",te=null,G=null,ie=!1;let a=_.querySelector("#omnidesk-status-text"),n=_.querySelector("#omnidesk-status-dot"),f=d.querySelector("#omnidesk-btn-text");a.innerText="Connecting...",n.style.background="#eab308",f.innerText="Connecting...",d.style.background="#64748b",d.style.boxShadow="none",d.disabled=!0,W();try{let l=c;if(!l&&typeof document<"u"){let e=document.querySelector("script[src*='widget.js']");if(e&&e.src&&e.src.startsWith("http"))try{l=new URL(e.src).origin}catch{}}!l&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(l=window.location.origin);let P=(l||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),Z=await fetch(`${P}/api/token?businessId=${encodeURIComponent(T)}`);if(!Z.ok)throw new Error(`Failed to get session token (${Z.status})`);let D=await Z.json();if(D.business_name&&!r){let e=_.querySelector("#omnidesk-biz-title");e&&(e.innerText=D.business_name)}let h=M||D.agent_id||"";k=new ae({onStatusChange:e=>{if(N=e,e==="connected")a.innerText="Live \xB7 Speaking",n.style.background="#22c55e",f.innerText="End Voice Call",d.style.background="#dc2626",d.style.boxShadow="0 4px 14px rgba(220, 38, 38, 0.35)",d.disabled=!1,w.style.display="flex",j=Date.now(),V?.();else if(e==="idle"&&(a.innerText="Idle \xB7 Ready",n.style.background=o?"rgba(255,255,255,0.4)":"#a1a1aa",f.innerText="Start Voice Call",d.style.background=x,d.style.boxShadow=`0 4px 14px ${x}40`,d.disabled=!1,w.style.display="none",m.style.display="none",y.style.display="none",s(),j>0)){let t=Math.round((Date.now()-j)/1e3);j=0,$?.(t)}},onThinkingChange:e=>{e&&(y.style.display="flex",v.scrollTop=v.scrollHeight)},onTranscript:e=>{if(q.style.display="none",e.who==="user"){e.isFinal&&(y.style.display="flex");let t=e.text.toLowerCase();(e.text.includes("@")||t.includes(" at ")&&t.includes(" dot ")||t.includes("gmail")||t.includes("yahoo")||t.includes("outlook")||t.includes("hotmail")||t.includes("icloud"))&&(ne=!0,m.style.display="none")}else if(e.who==="agent"){e.text&&e.text.trim().length>0&&(y.style.display="none");let t=e.text.toLowerCase();(t.includes("verified your email")||t.includes("email is verified")||t.includes("verified that email")||t.includes("sent a calendar")||t.includes("sent your confirmation")||t.includes("calendar invite")||t.includes("confirmation code is")||t.includes("booking is confirmed")||t.includes("all set, your appointment")||t.includes("scheduled your appointment"))&&(ne=!0),!ne&&(t.includes("what is your email")||t.includes("what's your email")||t.includes("may i have your email")||t.includes("can i have your email")||t.includes("could i get your email")||t.includes("could you provide your email")||t.includes("provide your email")||t.includes("enter your email")||t.includes("spell your email")||t.includes("share your email")||t.includes("need your email")||t.includes("what email")||t.includes("which email")||t.includes("where can i send your confirmation")||t.includes("where should i send your confirmation")||t.includes("where can i send your calendar")||t.includes("where should i send your calendar")||t.includes("email")&&(t.includes("what is")||t.includes("what's")||t.includes("may i have")||t.includes("can you provide")||t.includes("could you provide")||t.includes("give me your")||t.includes("tell me your")))?(m.style.display="flex",setTimeout(()=>ge.focus(),60)):m.style.display="none"}if(te===e.who&&G&&!ie)G.innerText=e.text,ie=!!e.isFinal;else{let t=e.who==="user",z=document.createElement("div");if(z.style.cssText=`
              display: flex; flex-direction: column; gap: 4px; max-width: 88%;
              align-self: ${t?"flex-end":"flex-start"};
            `,t){let H=document.createElement("div");H.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 2px 14px;
                font-size: 13px; line-height: 1.45;
                background: ${x};
                color: #ffffff;
                box-shadow: 0 2px 8px ${x}35;
              `,H.innerText=e.text,z.appendChild(H),G=H}else{let H=document.createElement("div");H.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let pe=document.createElement("div");pe.style.cssText=`
                width: 24px; height: 24px; border-radius: 50%; background: #18181b;
                display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;
              `,pe.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let ue=document.createElement("div");ue.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 14px 2px;
                font-size: 13px; line-height: 1.45;
                background: ${o?"#18181b":"#f4f4f5"};
                color: ${o?"#fafafa":"#09090b"};
                border: ${o?"1px solid #27272a":"none"};
                box-shadow: 0 1px 2px rgba(0,0,0,0.04);
              `,ue.innerText=e.text,H.appendChild(pe),H.appendChild(ue),z.appendChild(H),G=ue}v.insertBefore(z,y),te=e.who,ie=!!e.isFinal}v.scrollTop=v.scrollHeight,R?.(e)},onAudioLevel:(e,t)=>{if(we=e,be=t,N==="connected"){w.style.display="flex";let z=Math.max(e,t);X.forEach((H,pe)=>{let ue=Math.max(4,Math.min(14,Math.round(H*(.35+z*1.5))));de[pe]&&(de[pe].style.height=`${ue}px`)})}},onError:()=>{a.innerText="Error",n.style.background="#ef4444",f.innerText="Start Voice Call",d.style.background=x,d.style.boxShadow=`0 4px 14px ${x}40`,d.disabled=!1,w.style.display="none",m.style.display="none",y.style.display="none",s()}}),await k.start(D.token,h,D.voice)}catch(l){console.error("[OmniDesk Voice Widget Error]:",l),a.innerText="Error",n.style.background="#ef4444",f.innerText="Start Voice Call",d.style.background=x,d.style.boxShadow=`0 4px 14px ${x}40`,d.disabled=!1,w.style.display="none",m.style.display="none",y.style.display="none",s()}}function oe(){k&&(k.stop(),k=null),N="idle";let a=_.querySelector("#omnidesk-status-text"),n=_.querySelector("#omnidesk-status-dot"),f=d.querySelector("#omnidesk-btn-text");a&&(a.innerText="Idle \xB7 Ready"),n&&(n.style.background=o?"rgba(255,255,255,0.4)":"#a1a1aa"),f&&(f.innerText="Start Voice Call"),d.style.background=x,d.style.boxShadow=`0 4px 14px ${x}40`,d.disabled=!1,w.style.display="none",m.style.display="none",y.style.display="none",s()}return d.onclick=()=>{N==="connected"?oe():N==="idle"&&ke()},{destroy:()=>{s(),k&&k.stop(),g.remove()},startCall:ke,endCall:oe}}if(typeof document<"u"){let b=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(b){let c,T=b.src||"";if(T&&T.startsWith("http"))try{c=new URL(T).origin}catch{}let M=b.getAttribute("data-business-id")||void 0,F=b.getAttribute("data-agent")||void 0,J=b.getAttribute("data-theme")||"dark",E=b.getAttribute("data-accent")||"emerald",A=b.getAttribute("data-position")||"bottom-right",S=b.getAttribute("data-label")||void 0,r=b.getAttribute("data-host")||c||"https://omni-desk-rho.vercel.app",L=b.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{Te({businessId:M,agentId:F,theme:J,accent:E,position:A,label:S,host:r,greeting:L})}):Te({businessId:M,agentId:F,theme:J,accent:E,position:A,label:S,host:r,greeting:L})}}export{ae as AssemblyAIVoiceClient,Le as OmniDeskWidget,Re as VoiceWidget,Te as initOmniDeskWidget};
//# sourceMappingURL=index.mjs.map