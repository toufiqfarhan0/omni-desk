import{useState as T,useRef as se,useEffect as we,useCallback as ce,useMemo as ye}from"react";var me=24e3,Ce="wss://agents.assemblyai.com/v1/ws",Te=`
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${me};
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
`,Me=`
  class PlaybackProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ring = new Float32Array(sampleRate * 30);
      this._writePos = 0;
      this._readPos = 0;
      this._available = 0;
      this._step = ${me} / sampleRate;
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
`;async function ve(p,t,h){let g=URL.createObjectURL(new Blob([t],{type:"application/javascript"}));try{await p.audioWorklet.addModule(g)}finally{URL.revokeObjectURL(g)}return new AudioWorkletNode(p,h)}var Z=class{constructor(t){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.isThinking=!1;this.callbacks=t}setThinking(t){this.isThinking!==t&&(this.isThinking=t,this.callbacks.onThinkingChange?.(t))}async start(t,h,g){try{this.callbacks.onStatusChange?.("connecting");let _=window.AudioContext||window.webkitAudioContext;this.captureCtx=new _({sampleRate:me}),this.playbackCtx=new _({sampleRate:me}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await ve(this.playbackCtx,Me,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await ve(this.captureCtx,Te,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let O=new URL(Ce);O.searchParams.set("token",t),this.ws=new WebSocket(O.toString()),this.captureNode.port.onmessage=({data:u})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let i=new Uint8Array(u),y="";for(let L=0;L<i.length;L+=32768)y+=String.fromCharCode.apply(null,Array.from(i.subarray(L,L+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(y)}));let w=new Int16Array(u),M=0;for(let L=0;L<w.length;L+=16)M+=Math.abs(w[L]);this.userLevel=Math.min(1,M/(w.length/16)/8e3)},this.ws.onopen=()=>{let u={};h&&h.trim()?u.agent_id=h.trim():g&&g.trim()&&(u.output={voice:g.trim()}),Object.keys(u).length>0&&this.ws?.send(JSON.stringify({type:"session.update",session:u}))},this.ws.onmessage=({data:u})=>{try{let i=JSON.parse(u);switch(i.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0,this.setThinking(!1);break;case"transcript.user":i.text&&(this.callbacks.onTranscript?.({who:"user",text:i.text}),this.setThinking(!0));break;case"transcript.agent":this.setThinking(!1),i.text&&this.callbacks.onTranscript?.({who:"agent",text:i.text});break;case"reply.audio":if(this.setThinking(!1),i.data&&this.playbackNode){let y=atob(i.data),w=new Uint8Array(y.length);for(let M=0;M<y.length;M++)w[M]=y.charCodeAt(M);this.playbackNode.port.postMessage(w.buffer,[w.buffer]),this.agentLevel=.8}break;case"reply.done":i.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:i.name||i.tool,args:i.arguments||i.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:i.name||i.tool,result:i.result});break;case"session.error":this.setThinking(!1),this.callbacks.onError?.(i.message||i.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.setThinking(!1),this.stop();break}}catch(i){console.warn("Message parsing error:",i)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(_){this.callbacks.onError?.(_.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(t){this.isMuted=t,t&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(t,h){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:t})),h&&this.ws.send(JSON.stringify({type:"reply.create",instructions:h})),!0}catch(g){return console.error("Failed to send message to agent:",g),!1}}sendEmailInput(t){return this.sendUserMessage(`My email address is ${t}`,`The caller entered their verified email address: ${t}. Acknowledge this email, verify it using verify_customer_email if needed, and complete the booking.`)}stop(){if(this.setThinking(!1),this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(t=>t.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let t=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(t)};this.animFrameId=requestAnimationFrame(t)}};import{Fragment as Ee,jsx as e,jsxs as n}from"react/jsx-runtime";var Le={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function Se({host:p="",businessId:t="biz_demo_dental",agentId:h,theme:g="light",position:_="bottom-right",label:O="Talk to Receptionist",accent:u="emerald",accentColor:i,businessName:y,greeting:w,className:M,onCallStart:L,onCallEnd:Y,onTranscript:de}){let[G,oe]=T(!1),[l,K]=T(!1),[b,N]=T("idle"),[V,F]=T([]),[pe,re]=T(0),[be,ue]=T(0),[Q,X]=T("0:00"),[ee,te]=T(y||"OmniDesk Hair Salon & Studio"),[r,x]=T(!1),[I,j]=T(""),[z,f]=T(!1),[B,m]=T(""),[fe,D]=T(""),[H,A]=T(!1),R=se(null),ae=se(null),c=se(0),k=se(null),$=se(0),v=se(!1),he=ye(()=>i||Le[u]||u||"#10b981",[u,i]),q=ye(()=>g==="light"?!1:g==="auto"&&typeof window<"u"?window.matchMedia("(prefers-color-scheme: dark)").matches:!0,[g]);we(()=>{ae.current?.scrollIntoView({behavior:"smooth"})},[V,H]);let E=ye(()=>p?p.replace(/\/$/,""):typeof window<"u"&&window.location.origin?window.location.origin:"",[p]),ge=ce(()=>{$.current=Date.now(),X("0:00"),k.current&&clearInterval(k.current),k.current=setInterval(()=>{let a=Date.now()-$.current,W=Math.floor(a/1e3),C=Math.floor(W/60),P=W%60;X(`${C}:${String(P).padStart(2,"0")}`)},250)},[]),o=ce(()=>{k.current&&(clearInterval(k.current),k.current=null)},[]),U=ce(async()=>{try{N("connecting"),v.current=!1,x(!1),ge();let W=`${E?E.replace(/\/$/,""):""}/api/token?businessId=${encodeURIComponent(t)}`,C=await fetch(W);if(!C.ok)throw new Error("Failed to initialize voice session");let P=await C.json();if(P.business_name&&!y&&te(P.business_name),!P.token)throw new Error("Invalid session token payload received from host");let ie=h||P.agent_id||"",ne=new Z({onStatusChange:d=>{if(N(d),d==="connected")c.current=Date.now(),L?.();else if(d==="idle"){if(A(!1),o(),c.current>0){let s=Math.round((Date.now()-c.current)/1e3);c.current=0,Y?.(s)}}else d==="error"&&(A(!1),o())},onThinkingChange:d=>{A(d)},onTranscript:d=>{if(d.who==="user"?A(!0):d.who==="agent"&&A(!1),F(s=>[...s,d]),de?.(d),d.who==="user")(d.text.includes("@")||d.text.toLowerCase().includes(" at ")&&d.text.toLowerCase().includes(" dot "))&&(v.current=!0,x(!1));else if(d.who==="agent"){let s=d.text.toLowerCase();if(s.includes("verified your email")||s.includes("thank you")&&s.includes("email")||s.includes("sent a calendar invite")||s.includes("sent your confirmation")||s.includes("confirmation code is")||s.includes("i have sent")){v.current=!0,x(!1);return}if(v.current){x(!1);return}(s.includes("what is your email")||s.includes("may i have your email")||s.includes("provide your email")||s.includes("can i have your email")||s.includes("enter your email")||s.includes("spell your email")||s.includes("what's your email")||s.includes("where can i send your confirmation")||s.includes("where should i send your confirmation")||s.includes("where can i send your calendar invite")||s.includes("where should i send your calendar invite")||s.includes("email address")&&(s.includes("what")||s.includes("have")||s.includes("provide")||s.includes("give")||s.includes("tell")))&&x(!0)}},onAudioLevel:(d,s)=>{re(d),ue(s)},onError:()=>{N("error"),o()}});R.current=ne,await ne.start(P.token,ie,P.voice)}catch{N("error"),o()}},[E,t,h,y,L,Y,de,ge,o]),J=ce(()=>{if(R.current&&(R.current.stop(),R.current=null),N("idle"),A(!1),re(0),ue(0),o(),x(!1),m(""),D(""),c.current>0){let a=Math.round((Date.now()-c.current)/1e3);c.current=0,Y?.(a)}},[Y,o]),le=ce(async a=>{a.preventDefault();let W=I.trim();if(W){f(!0),m(""),D("");try{let C=E?E.replace(/\/$/,""):"",P=await fetch(`${C}/api/tools/${encodeURIComponent(t)}/verify_customer_email`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:W})}),ie=await P.json();if(!P.ok||!ie.valid||!ie.email){m(ie.message||"Invalid email or domain has no active mail server."),f(!1);return}let ne=ie.email;D(`Verified: ${ne}. Sent to agent.`),F(d=>[...d,{who:"user",text:`My email is ${ne}`}]),R.current&&R.current.sendEmailInput(ne),A(!0),v.current=!0,j(""),x(!1),D("")}catch(C){m(C.message||"Failed to verify email with mail server.")}finally{f(!1)}}},[I,E,t]);we(()=>()=>{o(),R.current&&R.current.stop()},[o]);let xe=_==="bottom-left",S=b==="connected";return n("div",{className:M,style:{position:"relative",zIndex:99999},children:[e("div",{style:{position:"fixed",bottom:"20px",left:xe?"20px":"auto",right:xe?"auto":"20px",zIndex:99999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:n("button",{type:"button",onClick:()=>oe(!G),style:{display:"inline-flex",alignItems:"center",gap:"10px",background:q?"#18181b":"#ffffff",color:q?"#fafafa":"#09090b",border:`1px solid ${q?"#27272a":"#e4e4e7"}`,padding:"10px 18px",borderRadius:"9999px",cursor:"pointer",fontSize:"13px",fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.18)",transition:"transform 0.15s ease, background 0.15s ease"},onMouseEnter:a=>{a.currentTarget.style.transform="scale(1.02)"},onMouseLeave:a=>{a.currentTarget.style.transform="scale(1)"},children:[e("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:S?"#ef4444":he,boxShadow:`0 0 8px ${S?"#ef4444":he}`}}),e("span",{children:O}),e("span",{style:{fontSize:"11px",opacity:.6},children:"\u25B2"})]})}),G&&n(Ee,{children:[l&&e("div",{onClick:()=>K(!1),style:{position:"fixed",inset:0,background:"rgba(0, 0, 0, 0.7)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",zIndex:999998}}),n("div",{style:{position:"fixed",bottom:l?"auto":"80px",left:l?"50%":xe?"20px":"auto",right:l||xe?"auto":"20px",top:l?"50%":"auto",transform:l?"translate(-50%, -50%)":"none",width:l?"calc(100vw - 40px)":"390px",maxWidth:l?"1140px":"calc(100vw - 32px)",height:l?"calc(100vh - 40px)":"560px",maxHeight:l?"900px":"calc(100vh - 100px)",background:"#ffffff",border:"1px solid #e4e4e7",borderRadius:"20px",boxShadow:l?"0 32px 64px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)":"0 24px 48px -12px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:999999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",transition:"all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"},children:[e("style",{children:`
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
            `}),n("div",{style:{background:"#18181b",color:"#ffffff",padding:l?"16px 22px":"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",userSelect:"none",flexShrink:0},children:[n("div",{style:{display:"flex",alignItems:"center",gap:"10px",minWidth:0},children:[e("div",{style:{color:"rgba(255,255,255,0.6)",display:"grid",placeItems:"center",flexShrink:0},children:n("svg",{xmlns:"http://www.w3.org/2000/svg",width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("circle",{cx:"12",cy:"12",r:"1"}),e("circle",{cx:"12",cy:"5",r:"1"}),e("circle",{cx:"12",cy:"19",r:"1"})]})}),e("div",{style:{width:"28px",height:"28px",borderRadius:"50%",background:"rgba(255,255,255,0.15)",display:"grid",placeItems:"center",flexShrink:0,color:"#ffffff"},children:n("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),e("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),e("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]})}),n("div",{style:{display:"flex",flexDirection:"column",minWidth:0},children:[e("div",{style:{fontSize:"13.5px",fontWeight:600,color:"#ffffff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},children:ee}),n("div",{style:{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"11px",color:"rgba(255,255,255,0.75)"},children:[e("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:S?H?"#f59e0b":"#22c55e":b==="connecting"?"#eab308":"rgba(255,255,255,0.4)",animation:H?"omnidesk-pulse-amber 1.5s infinite":"none"}}),e("span",{children:S?H?"Thinking \xB7 Checking tools...":"Live \xB7 Speaking":b==="connecting"?"Connecting...":b==="error"?"Error":"Idle \xB7 Ready"})]})]})]}),n("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[e("button",{type:"button",onClick:()=>K(!l),title:l?"Exit Fullscreen":"Open Full",style:{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"7px",color:"#ffffff",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:a=>a.currentTarget.style.background="rgba(255,255,255,0.2)",onMouseLeave:a=>a.currentTarget.style.background="rgba(255,255,255,0.1)",children:l?n("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("polyline",{points:"4 14 10 14 10 20"}),e("polyline",{points:"20 10 14 10 14 4"}),e("line",{x1:"14",y1:"10",x2:"21",y2:"3"}),e("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]}):n("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("polyline",{points:"15 3 21 3 21 9"}),e("polyline",{points:"9 21 3 21 3 15"}),e("line",{x1:"21",y1:"3",x2:"14",y2:"10"}),e("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]})}),e("button",{type:"button",onClick:()=>{S&&J(),oe(!1)},title:"Close Widget",style:{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"7px",color:"#ffffff",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:a=>a.currentTarget.style.background="rgba(255,255,255,0.2)",onMouseLeave:a=>a.currentTarget.style.background="rgba(255,255,255,0.1)",children:n("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("line",{x1:"18",y1:"6",x2:"6",y2:"18"}),e("line",{x1:"6",y1:"6",x2:"18",y2:"18"})]})})]})]}),n("div",{style:{flex:1,minHeight:0,padding:"16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"12px",background:"#ffffff"},children:[V.length===0&&n("div",{style:{margin:"auto",textAlign:"center",padding:"10px 18px",background:"#f4f4f5",border:"1px solid #e4e4e7",color:"#52525b",borderRadius:"12px",fontSize:"12.5px",fontWeight:500,display:"inline-flex",alignItems:"center",gap:"8px",alignSelf:"center"},children:[e("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:S?"#22c55e":"#a1a1aa",display:"inline-block"}}),e("span",{children:S?"Connected \xB7 Speak to our receptionist":b==="connecting"?"Connecting to receptionist...":"Start a call to talk to our receptionist"})]}),V.map((a,W)=>{let C=a.who==="user";return e("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:C?"flex-end":"flex-start"},children:n("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[!C&&e("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:n("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),e("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),e("div",{style:{padding:"10px 14px",borderRadius:C?"14px 14px 2px 14px":"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:C?"#18181b":"#f4f4f5",color:C?"#ffffff":"#09090b",boxShadow:"0 1px 2px rgba(0,0,0,0.04)"},children:a.text})]})},W)}),H&&e("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:"flex-start"},children:n("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[e("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:n("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),e("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),n("div",{style:{padding:"10px 14px",borderRadius:"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:"#f4f4f5",color:"#71717a",boxShadow:"0 1px 2px rgba(0,0,0,0.04)",display:"inline-flex",alignItems:"center",gap:"5px",minHeight:"38px"},title:"Agent is thinking and processing...",children:[e("span",{className:"omnidesk-motion-dot omnidesk-dot-1"}),e("span",{className:"omnidesk-motion-dot omnidesk-dot-2"}),e("span",{className:"omnidesk-motion-dot omnidesk-dot-3"})]})]})}),e("div",{ref:ae})]}),r&&S&&n("div",{style:{padding:"11px 16px",background:"#f0fdf4",borderTop:"1px solid #bbf7d0",display:"flex",flexDirection:"column",gap:"7px",flexShrink:0},children:[n("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"},children:[n("span",{style:{fontSize:"11px",fontWeight:700,color:"#15803d",textTransform:"uppercase",letterSpacing:"0.04em",display:"inline-flex",alignItems:"center",gap:"6px"},children:[e("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:"#22c55e",display:"inline-block"}}),"Agent Requesting Email \u2022 Verified Mailbox Entry"]}),e("button",{type:"button",onClick:()=>x(!1),style:{background:"none",border:"none",color:"#15803d",cursor:"pointer",fontSize:"12px",fontWeight:700,padding:"1px 4px"},children:"\u2715"})]}),n("form",{onSubmit:le,style:{display:"flex",gap:"6px"},children:[e("input",{type:"email",autoFocus:!0,value:I,onChange:a=>{j(a.target.value),m("")},placeholder:"Enter your real email (e.g. name@gmail.com)",disabled:z,required:!0,style:{flex:1,fontSize:"12.5px",padding:"7px 11px",borderRadius:"7px",border:B?"1.5px solid #ef4444":"1px solid #86efac",background:"#ffffff",color:"#09090b",outline:"none"}}),e("button",{type:"submit",disabled:z||!I.trim(),style:{background:"#16a34a",color:"#ffffff",border:"none",padding:"7px 14px",borderRadius:"7px",fontSize:"12px",fontWeight:600,cursor:z?"wait":"pointer",opacity:z?.7:1},children:z?"...":"Verify & Send"})]}),B&&n("div",{style:{fontSize:"11px",color:"#ef4444",fontWeight:500},children:["\u26A0\uFE0F ",B]}),fe&&n("div",{style:{fontSize:"11px",color:"#15803d",fontWeight:600},children:["\u2713 ",fe]})]}),n("div",{style:{padding:"12px 16px",borderTop:"1px solid #e4e4e7",background:"#fafafa",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0},children:[n("button",{type:"button",onClick:S?J:U,disabled:b==="connecting",style:{display:"inline-flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:S?"#dc2626":"#000000",color:"#ffffff",borderRadius:"10px",border:"none",fontSize:"13px",fontWeight:600,cursor:b==="connecting"?"not-allowed":"pointer",transition:"all 0.15s ease"},children:[n("svg",{xmlns:"http://www.w3.org/2000/svg",width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),e("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),e("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]}),e("span",{children:S?"End Voice Call":b==="connecting"?"Connecting...":"Start Voice Call"})]}),n("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[S&&e("div",{style:{display:"flex",alignItems:"center",gap:"2.5px",height:"14px"},children:[12,8,14,6,10].map((a,W)=>e("span",{style:{width:"2.5px",height:`${Math.max(4,Math.min(14,Math.round(a*(.35+Math.max(pe,be)*1.5))))}px`,background:"#000000",borderRadius:"1px",transition:"height 0.12s ease"}},W))}),e("span",{style:{fontFamily:"var(--mono, monospace)",fontSize:"12px",fontWeight:600,padding:"3px 8px",borderRadius:"6px",background:S?"#000000":"#f4f4f5",color:S?"#ffffff":"#71717a"},children:Q})]})]})]})]})]})}var _e=Se;var Ie={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function ke(p={}){if(typeof window>"u")return;let{host:t,businessId:h="biz_demo_dental",agentId:g,theme:_="light",position:O="bottom-right",label:u="Talk to Receptionist",accent:i="emerald",accentColor:y,businessName:w,greeting:M,onCallStart:L,onCallEnd:Y,onTranscript:de}=p,G=y||Ie[i]||i||"#10b981",oe=document.getElementById("omnidesk-voice-widget-root");oe&&oe.remove();let l=document.createElement("div");l.id="omnidesk-voice-widget-root",l.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let K=_==="dark"||_==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,b=null,N="idle",V=0,F=null,pe=!1,re=!1,be=0,ue=0,Q=O==="bottom-left",X=document.createElement("div");X.style.cssText=`
    position: fixed; bottom: 20px; ${Q?"left: 20px;":"right: 20px;"};
    z-index: 999999;
  `;let ee=document.createElement("button");ee.style.cssText=`
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${K?"#18181b":"#ffffff"}; color: ${K?"#fafafa":"#09090b"};
    border: 1px solid ${K?"#27272a":"#e4e4e7"};
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `,ee.innerHTML=`
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${G};box-shadow:0 0 8px ${G};display:inline-block;"></span>
    <span>${u}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,X.appendChild(ee);let te=document.createElement("div");te.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,te.onclick=()=>A(!1);let r=document.createElement("div");r.style.cssText=`
    position: fixed; bottom: 80px; ${Q?"left: 20px;":"right: 20px;"};
    width: 390px; max-width: calc(100vw - 32px); height: 560px; max-height: calc(100vh - 100px);
    background: #ffffff; border: 1px solid #e4e4e7;
    border-radius: 20px; box-shadow: 0 24px 48px -12px rgba(0,0,0,0.22);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  `;let x=document.createElement("div");x.style.cssText=`
    background: #18181b; color: #ffffff; padding: 13px 18px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; user-select: none; flex-shrink: 0;
  `,x.innerHTML=`
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
          ${w||"OmniDesk Hair Salon & Studio"}
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
  `;let I=document.createElement("div");I.style.cssText=`
    flex: 1; min-height: 0; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 12px; background: #ffffff;
  `;let j=document.createElement("div");j.id="omnidesk-placeholder-banner",j.style.cssText=`
    margin: auto; text-align: center; padding: 10px 18px;
    background: #f4f4f5; border: 1px solid #e4e4e7; color: #52525b;
    border-radius: 12px; font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px; align-self: center;
  `,j.innerHTML=`
    <span style="width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block;"></span>
    <span>Start a call to talk to our receptionist</span>
  `,I.appendChild(j);let z=document.createElement("div");z.style.cssText=`
    padding: 12px 16px; border-top: 1px solid #e4e4e7;
    background: #fafafa; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  `;let f=document.createElement("button");f.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: #000000; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s ease;
  `,f.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let B=document.createElement("div");B.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let m=document.createElement("span");m.id="omnidesk-timer",m.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,m.innerText="0:00",B.appendChild(m),z.appendChild(f),z.appendChild(B),r.appendChild(x),r.appendChild(I),r.appendChild(z),l.appendChild(X),l.appendChild(te),l.appendChild(r),document.body.appendChild(l);function fe(){V=Date.now(),m.innerText="0:00",m.style.background="#000000",m.style.color="#ffffff",F&&clearInterval(F),F=setInterval(()=>{let c=Date.now()-V,k=Math.floor(c/1e3),$=Math.floor(k/60),v=k%60;m.innerText=`${$}:${String(v).padStart(2,"0")}`},250)}function D(){F&&(clearInterval(F),F=null),m.style.background="#f4f4f5",m.style.color="#71717a",m.innerText="0:00"}function H(c){pe=c,r.style.display=c?"flex":"none"}function A(c){re=c,te.style.display=c?"block":"none",c?(r.style.top="50%",r.style.left="50%",r.style.bottom="auto",r.style.right="auto",r.style.transform="translate(-50%, -50%)",r.style.width="calc(100vw - 40px)",r.style.maxWidth="1140px",r.style.height="calc(100vh - 40px)",r.style.maxHeight="900px"):(r.style.top="auto",r.style.left=Q?"20px":"auto",r.style.right=Q?"auto":"20px",r.style.bottom="80px",r.style.transform="none",r.style.width="390px",r.style.maxWidth="calc(100vw - 32px)",r.style.height="560px",r.style.maxHeight="calc(100vh - 100px)")}ee.onclick=()=>H(!pe),x.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{H(!1),A(!1)}),x.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{A(!re)});async function R(){let c=x.querySelector("#omnidesk-status-text"),k=x.querySelector("#omnidesk-status-dot"),$=f.querySelector("#omnidesk-btn-text");c.innerText="Connecting...",k.style.background="#eab308",$.innerText="Connecting...",f.disabled=!0,fe();try{let v=t;if(!v&&typeof document<"u"){let o=document.querySelector("script[src*='widget.js']");if(o&&o.src&&o.src.startsWith("http"))try{v=new URL(o.src).origin}catch{}}!v&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(v=window.location.origin);let he=(v||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),q=await fetch(`${he}/api/token?businessId=${encodeURIComponent(h)}`);if(!q.ok)throw new Error(`Failed to get session token (${q.status})`);let E=await q.json();if(E.business_name&&!w){let o=x.querySelector("#omnidesk-biz-title");o&&(o.innerText=E.business_name)}let ge=g||E.agent_id||"";b=new Z({onStatusChange:o=>{if(N=o,o==="connected")c.innerText="Live \xB7 Speaking",k.style.background="#22c55e",$.innerText="End Voice Call",f.style.background="#dc2626",f.disabled=!1,V=Date.now(),L?.();else if(o==="idle"&&(c.innerText="Idle \xB7 Ready",k.style.background="rgba(255,255,255,0.4)",$.innerText="Start Voice Call",f.style.background="#000000",f.disabled=!1,D(),V>0)){let U=Math.round((Date.now()-V)/1e3);V=0,Y?.(U)}},onTranscript:o=>{j.style.display="none";let U=document.createElement("div"),J=o.who==="user";U.style.cssText=`
            display: flex; flex-direction: column; gap: 4px; max-width: 88%;
            align-self: ${J?"flex-end":"flex-start"};
          `;let le=document.createElement("div");le.style.cssText=`
            padding: 10px 14px; border-radius: ${J?"14px 14px 2px 14px":"14px 14px 14px 2px"};
            font-size: 13px; line-height: 1.45;
            background: ${J?"#18181b":"#f4f4f5"};
            color: ${J?"#ffffff":"#09090b"};
            box-shadow: 0 1px 2px rgba(0,0,0,0.04);
          `,le.innerText=o.text,U.appendChild(le),I.appendChild(U),I.scrollTop=I.scrollHeight,de?.(o)},onAudioLevel:(o,U)=>{be=o,ue=U},onError:()=>{c.innerText="Error",k.style.background="#ef4444",$.innerText="Start Voice Call",f.style.background="#000000",f.disabled=!1,D()}}),await b.start(E.token,ge,E.voice)}catch(v){console.error("[OmniDesk Voice Widget Error]:",v),c.innerText="Error",k.style.background="#ef4444",$.innerText="Start Voice Call",f.style.background="#000000",f.disabled=!1,D()}}function ae(){b&&(b.stop(),b=null),N="idle",D()}return f.onclick=()=>{N==="connected"?ae():N==="idle"&&R()},{destroy:()=>{D(),b&&b.stop(),l.remove()},startCall:R,endCall:ae}}if(typeof document<"u"){let p=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(p){let t,h=p.src||"";if(h&&h.startsWith("http"))try{t=new URL(h).origin}catch{}let g=p.getAttribute("data-business-id")||void 0,_=p.getAttribute("data-agent")||void 0,O=p.getAttribute("data-theme")||"dark",u=p.getAttribute("data-accent")||"emerald",i=p.getAttribute("data-position")||"bottom-right",y=p.getAttribute("data-label")||void 0,w=p.getAttribute("data-host")||t||"https://omni-desk-rho.vercel.app",M=p.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{ke({businessId:g,agentId:_,theme:O,accent:u,position:i,label:y,host:w,greeting:M})}):ke({businessId:g,agentId:_,theme:O,accent:u,position:i,label:y,host:w,greeting:M})}}export{Z as AssemblyAIVoiceClient,Se as OmniDeskWidget,_e as VoiceWidget,ke as initOmniDeskWidget};
//# sourceMappingURL=index.mjs.map