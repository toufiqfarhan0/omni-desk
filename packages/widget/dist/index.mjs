import{useState as _,useRef as re,useEffect as ke,useCallback as ce,useMemo as me}from"react";var he=24e3,we="wss://agents.assemblyai.com/v1/ws",Se=`
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
`,Ce=`
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
`;async function ye(l,n,f){let h=URL.createObjectURL(new Blob([n],{type:"application/javascript"}));try{await l.audioWorklet.addModule(h)}finally{URL.revokeObjectURL(h)}return new AudioWorkletNode(l,f)}var Z=class{constructor(n){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.callbacks=n}async start(n,f,h){try{this.callbacks.onStatusChange?.("connecting");let E=window.AudioContext||window.webkitAudioContext;this.captureCtx=new E({sampleRate:he}),this.playbackCtx=new E({sampleRate:he}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await ye(this.playbackCtx,Ce,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await ye(this.captureCtx,Se,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let O=new URL(we);O.searchParams.set("token",n),this.ws=new WebSocket(O.toString()),this.captureNode.port.onmessage=({data:d})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let t=new Uint8Array(d),k="";for(let M=0;M<t.length;M+=32768)k+=String.fromCharCode.apply(null,Array.from(t.subarray(M,M+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(k)}));let v=new Int16Array(d),T=0;for(let M=0;M<v.length;M+=16)T+=Math.abs(v[M]);this.userLevel=Math.min(1,T/(v.length/16)/8e3)},this.ws.onopen=()=>{let d={};f&&f.trim()&&(d.agent_id=f.trim()),h&&h.trim()&&(d.output={voice:h.trim()}),Object.keys(d).length>0&&this.ws?.send(JSON.stringify({type:"session.update",session:d}))},this.ws.onmessage=({data:d})=>{try{let t=JSON.parse(d);switch(t.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0;break;case"transcript.user":t.text&&this.callbacks.onTranscript?.({who:"user",text:t.text});break;case"transcript.agent":t.text&&this.callbacks.onTranscript?.({who:"agent",text:t.text});break;case"reply.audio":if(t.data&&this.playbackNode){let k=atob(t.data),v=new Uint8Array(k.length);for(let T=0;T<k.length;T++)v[T]=k.charCodeAt(T);this.playbackNode.port.postMessage(v.buffer,[v.buffer]),this.agentLevel=.8}break;case"reply.done":t.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:t.name||t.tool,args:t.arguments||t.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:t.name||t.tool,result:t.result});break;case"session.error":this.callbacks.onError?.(t.message||t.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.stop();break}}catch(t){console.warn("Message parsing error:",t)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(E){this.callbacks.onError?.(E.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(n){this.isMuted=n,n&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(n,f){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:n})),f&&this.ws.send(JSON.stringify({type:"reply.create",instructions:f})),!0}catch(h){return console.error("Failed to send message to agent:",h),!1}}sendEmailInput(n){return this.sendUserMessage(`My email address is ${n}`,`The caller entered their verified email address: ${n}. Acknowledge this email, verify it using verify_customer_email if needed, and complete the booking.`)}stop(){if(this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(n=>n.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let n=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(n)};this.animFrameId=requestAnimationFrame(n)}};import{Fragment as Le,jsx as e,jsxs as s}from"react/jsx-runtime";var Te={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function ve({host:l="",businessId:n="biz_demo_dental",agentId:f,theme:h="dark",position:E="bottom-right",label:O="Talk to Receptionist",accent:d="emerald",accentColor:t,businessName:k,greeting:v,className:T,onCallStart:M,onCallEnd:G,onTranscript:de}){let[K,ae]=_(!1),[a,Y]=_(!1),[b,P]=_("idle"),[V,F]=_([]),[pe,le]=_(0),[ge,ue]=_(0),[Q,X]=_("0:00"),[ee,te]=_(k||"OmniDesk Hair Salon & Studio"),[o,g]=_(!1),[I,H]=_(""),[N,p]=_(!1),[J,x]=_(""),[fe,z]=_(""),A=re(null),ie=re(null),D=re(0),U=re(null),m=re(0),w=re(!1),$=me(()=>t||Te[d]||d||"#10b981",[d,t]),L=me(()=>h==="light"?!1:h==="auto"&&typeof window<"u"?window.matchMedia("(prefers-color-scheme: dark)").matches:!0,[h]);ke(()=>{ie.current?.scrollIntoView({behavior:"smooth"})},[V]);let q=me(()=>l?l.replace(/\/$/,""):typeof window<"u"&&window.location.origin?window.location.origin:"",[l]),ne=ce(()=>{m.current=Date.now(),X("0:00"),U.current&&clearInterval(U.current),U.current=setInterval(()=>{let r=Date.now()-m.current,R=Math.floor(r/1e3),C=Math.floor(R/60),W=R%60;X(`${C}:${String(W).padStart(2,"0")}`)},250)},[]),S=ce(()=>{U.current&&(clearInterval(U.current),U.current=null)},[]),xe=ce(async()=>{try{P("connecting"),w.current=!1,g(!1),ne();let R=`${q?q.replace(/\/$/,""):""}/api/token?businessId=${encodeURIComponent(n)}`,C=await fetch(R);if(!C.ok)throw new Error("Failed to initialize voice session");let W=await C.json();if(W.business_name&&!k&&te(W.business_name),!W.token)throw new Error("Invalid session token payload received from host");let se=f||W.agent_id||"",oe=new Z({onStatusChange:y=>{if(P(y),y==="connected")D.current=Date.now(),M?.();else if(y==="idle"&&(S(),D.current>0)){let i=Math.round((Date.now()-D.current)/1e3);D.current=0,G?.(i)}},onTranscript:y=>{if(F(i=>[...i,y]),de?.(y),y.who==="user")(y.text.includes("@")||y.text.toLowerCase().includes(" at ")&&y.text.toLowerCase().includes(" dot "))&&(w.current=!0,g(!1));else if(y.who==="agent"){let i=y.text.toLowerCase();if(i.includes("verified your email")||i.includes("thank you")&&i.includes("email")||i.includes("sent a calendar invite")||i.includes("sent your confirmation")||i.includes("confirmation code is")||i.includes("i have sent")){w.current=!0,g(!1);return}if(w.current){g(!1);return}(i.includes("what is your email")||i.includes("may i have your email")||i.includes("provide your email")||i.includes("can i have your email")||i.includes("enter your email")||i.includes("spell your email")||i.includes("what's your email")||i.includes("where can i send your confirmation")||i.includes("where should i send your confirmation")||i.includes("where can i send your calendar invite")||i.includes("where should i send your calendar invite")||i.includes("email address")&&(i.includes("what")||i.includes("have")||i.includes("provide")||i.includes("give")||i.includes("tell")))&&g(!0)}},onAudioLevel:(y,i)=>{le(y),ue(i)},onError:()=>{P("error"),S()}});A.current=oe,await oe.start(W.token,se,W.voice)}catch{P("error"),S()}},[q,n,f,k,M,G,de,ne,S]),c=ce(()=>{if(A.current&&(A.current.stop(),A.current=null),P("idle"),le(0),ue(0),S(),g(!1),x(""),z(""),D.current>0){let r=Math.round((Date.now()-D.current)/1e3);D.current=0,G?.(r)}},[G,S]),j=ce(async r=>{r.preventDefault();let R=I.trim();if(R){p(!0),x(""),z("");try{let C=q?q.replace(/\/$/,""):"",W=await fetch(`${C}/api/tools/${encodeURIComponent(n)}/verify_customer_email`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:R})}),se=await W.json();if(!W.ok||!se.valid||!se.email){x(se.message||"Invalid email or domain has no active mail server."),p(!1);return}let oe=se.email;z(`Verified: ${oe}. Sent to agent.`),F(y=>[...y,{who:"user",text:`My email is ${oe}`}]),A.current&&A.current.sendEmailInput(oe),w.current=!0,H(""),g(!1),z("")}catch(C){x(C.message||"Failed to verify email with mail server.")}finally{p(!1)}}},[I,q,n]);ke(()=>()=>{S(),A.current&&A.current.stop()},[S]);let B=E==="bottom-left",u=b==="connected";return s("div",{className:T,style:{position:"relative",zIndex:99999},children:[e("div",{style:{position:"fixed",bottom:"20px",left:B?"20px":"auto",right:B?"auto":"20px",zIndex:99999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:s("button",{type:"button",onClick:()=>ae(!K),style:{display:"inline-flex",alignItems:"center",gap:"10px",background:L?"#18181b":"#ffffff",color:L?"#fafafa":"#09090b",border:`1px solid ${L?"#27272a":"#e4e4e7"}`,padding:"10px 18px",borderRadius:"9999px",cursor:"pointer",fontSize:"13px",fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.18)",transition:"transform 0.15s ease, background 0.15s ease"},onMouseEnter:r=>{r.currentTarget.style.transform="scale(1.02)"},onMouseLeave:r=>{r.currentTarget.style.transform="scale(1)"},children:[e("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:u?"#ef4444":$,boxShadow:`0 0 8px ${u?"#ef4444":$}`}}),e("span",{children:O}),e("span",{style:{fontSize:"11px",opacity:.6},children:"\u25B2"})]})}),K&&s(Le,{children:[a&&e("div",{onClick:()=>Y(!1),style:{position:"fixed",inset:0,background:"rgba(0, 0, 0, 0.7)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",zIndex:999998}}),s("div",{style:{position:"fixed",bottom:a?"auto":"80px",left:a?"50%":B?"20px":"auto",right:a||B?"auto":"20px",top:a?"50%":"auto",transform:a?"translate(-50%, -50%)":"none",width:a?"calc(100vw - 40px)":"390px",maxWidth:a?"1140px":"calc(100vw - 32px)",height:a?"calc(100vh - 40px)":"560px",maxHeight:a?"900px":"calc(100vh - 100px)",background:"#ffffff",border:"1px solid #e4e4e7",borderRadius:"20px",boxShadow:a?"0 32px 64px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)":"0 24px 48px -12px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:999999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",transition:"all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"},children:[s("div",{style:{background:"#18181b",color:"#ffffff",padding:a?"16px 22px":"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",userSelect:"none",flexShrink:0},children:[s("div",{style:{display:"flex",alignItems:"center",gap:"10px",minWidth:0},children:[e("div",{style:{color:"rgba(255,255,255,0.6)",display:"grid",placeItems:"center",flexShrink:0},children:s("svg",{xmlns:"http://www.w3.org/2000/svg",width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("circle",{cx:"12",cy:"12",r:"1"}),e("circle",{cx:"12",cy:"5",r:"1"}),e("circle",{cx:"12",cy:"19",r:"1"})]})}),e("div",{style:{width:"28px",height:"28px",borderRadius:"50%",background:"rgba(255,255,255,0.15)",display:"grid",placeItems:"center",flexShrink:0,color:"#ffffff"},children:s("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),e("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),e("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]})}),s("div",{style:{display:"flex",flexDirection:"column",minWidth:0},children:[e("div",{style:{fontSize:"13.5px",fontWeight:600,color:"#ffffff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},children:ee}),s("div",{style:{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"11px",color:"rgba(255,255,255,0.75)"},children:[e("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:u?"#22c55e":b==="connecting"?"#eab308":"rgba(255,255,255,0.4)"}}),e("span",{children:u?"Live \xB7 Speaking":b==="connecting"?"Connecting...":b==="error"?"Error":"Idle \xB7 Ready"})]})]})]}),s("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[e("button",{type:"button",onClick:()=>Y(!a),title:a?"Exit Fullscreen":"Open Full",style:{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"7px",color:"#ffffff",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:r=>r.currentTarget.style.background="rgba(255,255,255,0.2)",onMouseLeave:r=>r.currentTarget.style.background="rgba(255,255,255,0.1)",children:a?s("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("polyline",{points:"4 14 10 14 10 20"}),e("polyline",{points:"20 10 14 10 14 4"}),e("line",{x1:"14",y1:"10",x2:"21",y2:"3"}),e("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]}):s("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("polyline",{points:"15 3 21 3 21 9"}),e("polyline",{points:"9 21 3 21 3 15"}),e("line",{x1:"21",y1:"3",x2:"14",y2:"10"}),e("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]})}),e("button",{type:"button",onClick:()=>{u&&c(),ae(!1)},title:"Close Widget",style:{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"7px",color:"#ffffff",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:r=>r.currentTarget.style.background="rgba(255,255,255,0.2)",onMouseLeave:r=>r.currentTarget.style.background="rgba(255,255,255,0.1)",children:s("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("line",{x1:"18",y1:"6",x2:"6",y2:"18"}),e("line",{x1:"6",y1:"6",x2:"18",y2:"18"})]})})]})]}),s("div",{style:{flex:1,minHeight:0,padding:"16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"12px",background:"#ffffff"},children:[V.length===0&&s("div",{style:{margin:"auto",textAlign:"center",padding:"10px 18px",background:"#f4f4f5",border:"1px solid #e4e4e7",color:"#52525b",borderRadius:"12px",fontSize:"12.5px",fontWeight:500,display:"inline-flex",alignItems:"center",gap:"8px",alignSelf:"center"},children:[e("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:u?"#22c55e":"#a1a1aa",display:"inline-block"}}),e("span",{children:u?"Connected \xB7 Speak to our receptionist":b==="connecting"?"Connecting to receptionist...":"Start a call to talk to our receptionist"})]}),V.map((r,R)=>{let C=r.who==="user";return e("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:C?"flex-end":"flex-start"},children:s("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[!C&&e("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:s("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),e("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),e("div",{style:{padding:"10px 14px",borderRadius:C?"14px 14px 2px 14px":"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:C?"#18181b":"#f4f4f5",color:C?"#ffffff":"#09090b",boxShadow:"0 1px 2px rgba(0,0,0,0.04)"},children:r.text})]})},R)}),e("div",{ref:ie})]}),o&&u&&s("div",{style:{padding:"11px 16px",background:"#f0fdf4",borderTop:"1px solid #bbf7d0",display:"flex",flexDirection:"column",gap:"7px",flexShrink:0},children:[s("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"},children:[s("span",{style:{fontSize:"11px",fontWeight:700,color:"#15803d",textTransform:"uppercase",letterSpacing:"0.04em",display:"inline-flex",alignItems:"center",gap:"6px"},children:[e("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:"#22c55e",display:"inline-block"}}),"Agent Requesting Email \u2022 Verified Mailbox Entry"]}),e("button",{type:"button",onClick:()=>g(!1),style:{background:"none",border:"none",color:"#15803d",cursor:"pointer",fontSize:"12px",fontWeight:700,padding:"1px 4px"},children:"\u2715"})]}),s("form",{onSubmit:j,style:{display:"flex",gap:"6px"},children:[e("input",{type:"email",autoFocus:!0,value:I,onChange:r=>{H(r.target.value),x("")},placeholder:"Enter your real email (e.g. name@gmail.com)",disabled:N,required:!0,style:{flex:1,fontSize:"12.5px",padding:"7px 11px",borderRadius:"7px",border:J?"1.5px solid #ef4444":"1px solid #86efac",background:"#ffffff",color:"#09090b",outline:"none"}}),e("button",{type:"submit",disabled:N||!I.trim(),style:{background:"#16a34a",color:"#ffffff",border:"none",padding:"7px 14px",borderRadius:"7px",fontSize:"12px",fontWeight:600,cursor:N?"wait":"pointer",opacity:N?.7:1},children:N?"...":"Verify & Send"})]}),J&&s("div",{style:{fontSize:"11px",color:"#ef4444",fontWeight:500},children:["\u26A0\uFE0F ",J]}),fe&&s("div",{style:{fontSize:"11px",color:"#15803d",fontWeight:600},children:["\u2713 ",fe]})]}),s("div",{style:{padding:"12px 16px",borderTop:"1px solid #e4e4e7",background:"#fafafa",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0},children:[s("button",{type:"button",onClick:u?c:xe,disabled:b==="connecting",style:{display:"inline-flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:u?"#dc2626":"#000000",color:"#ffffff",borderRadius:"10px",border:"none",fontSize:"13px",fontWeight:600,cursor:b==="connecting"?"not-allowed":"pointer",transition:"all 0.15s ease"},children:[s("svg",{xmlns:"http://www.w3.org/2000/svg",width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),e("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),e("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]}),e("span",{children:u?"End Voice Call":b==="connecting"?"Connecting...":"Start Voice Call"})]}),s("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[u&&e("div",{style:{display:"flex",alignItems:"center",gap:"2.5px",height:"14px"},children:[12,8,14,6,10].map((r,R)=>e("span",{style:{width:"2.5px",height:`${Math.max(4,Math.min(14,Math.round(r*(.35+Math.max(pe,ge)*1.5))))}px`,background:"#000000",borderRadius:"1px",transition:"height 0.12s ease"}},R))}),e("span",{style:{fontFamily:"var(--mono, monospace)",fontSize:"12px",fontWeight:600,padding:"3px 8px",borderRadius:"6px",background:u?"#000000":"#f4f4f5",color:u?"#ffffff":"#71717a"},children:Q})]})]})]})]})]})}var Me=ve;var _e={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function be(l={}){if(typeof window>"u")return;let{host:n,businessId:f="biz_demo_dental",agentId:h,theme:E="dark",position:O="bottom-right",label:d="Talk to Receptionist",accent:t="emerald",accentColor:k,businessName:v,greeting:T,onCallStart:M,onCallEnd:G,onTranscript:de}=l,K=k||_e[t]||t||"#10b981",ae=document.getElementById("omnidesk-voice-widget-root");ae&&ae.remove();let a=document.createElement("div");a.id="omnidesk-voice-widget-root",a.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let Y=E==="dark"||E==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,b=null,P="idle",V=0,F=null,pe=!1,le=!1,ge=0,ue=0,Q=O==="bottom-left",X=document.createElement("div");X.style.cssText=`
    position: fixed; bottom: 20px; ${Q?"left: 20px;":"right: 20px;"};
    z-index: 999999;
  `;let ee=document.createElement("button");ee.style.cssText=`
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${Y?"#18181b":"#ffffff"}; color: ${Y?"#fafafa":"#09090b"};
    border: 1px solid ${Y?"#27272a":"#e4e4e7"};
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `,ee.innerHTML=`
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${K};box-shadow:0 0 8px ${K};display:inline-block;"></span>
    <span>${d}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,X.appendChild(ee);let te=document.createElement("div");te.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,te.onclick=()=>ie(!1);let o=document.createElement("div");o.style.cssText=`
    position: fixed; bottom: 80px; ${Q?"left: 20px;":"right: 20px;"};
    width: 390px; max-width: calc(100vw - 32px); height: 560px; max-height: calc(100vh - 100px);
    background: #ffffff; border: 1px solid #e4e4e7;
    border-radius: 20px; box-shadow: 0 24px 48px -12px rgba(0,0,0,0.22);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  `;let g=document.createElement("div");g.style.cssText=`
    background: #18181b; color: #ffffff; padding: 13px 18px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; user-select: none; flex-shrink: 0;
  `,g.innerHTML=`
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
      <div style="display: flex; flexDirection: column; min-width: 0;">
        <div id="omnidesk-biz-title" style="font-size: 13.5px; font-weight: 600; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${v||"OmniDesk Hair Salon & Studio"}
        </div>
        <div style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: rgba(255,255,255,0.75);">
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
  `;let H=document.createElement("div");H.id="omnidesk-placeholder-banner",H.style.cssText=`
    margin: auto; text-align: center; padding: 10px 18px;
    background: #f4f4f5; border: 1px solid #e4e4e7; color: #52525b;
    border-radius: 12px; font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px; align-self: center;
  `,H.innerHTML=`
    <span style="width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block;"></span>
    <span>Start a call to talk to our receptionist</span>
  `,I.appendChild(H);let N=document.createElement("div");N.style.cssText=`
    padding: 12px 16px; border-top: 1px solid #e4e4e7;
    background: #fafafa; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  `;let p=document.createElement("button");p.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: #000000; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s ease;
  `,p.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let J=document.createElement("div");J.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let x=document.createElement("span");x.id="omnidesk-timer",x.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,x.innerText="0:00",J.appendChild(x),N.appendChild(p),N.appendChild(J),o.appendChild(g),o.appendChild(I),o.appendChild(N),a.appendChild(X),a.appendChild(te),a.appendChild(o),document.body.appendChild(a);function fe(){V=Date.now(),x.innerText="0:00",x.style.background="#000000",x.style.color="#ffffff",F&&clearInterval(F),F=setInterval(()=>{let m=Date.now()-V,w=Math.floor(m/1e3),$=Math.floor(w/60),L=w%60;x.innerText=`${$}:${String(L).padStart(2,"0")}`},250)}function z(){F&&(clearInterval(F),F=null),x.style.background="#f4f4f5",x.style.color="#71717a",x.innerText="0:00"}function A(m){pe=m,o.style.display=m?"flex":"none"}function ie(m){le=m,te.style.display=m?"block":"none",m?(o.style.top="50%",o.style.left="50%",o.style.bottom="auto",o.style.right="auto",o.style.transform="translate(-50%, -50%)",o.style.width="calc(100vw - 40px)",o.style.maxWidth="1140px",o.style.height="calc(100vh - 40px)",o.style.maxHeight="900px"):(o.style.top="auto",o.style.left=Q?"20px":"auto",o.style.right=Q?"auto":"20px",o.style.bottom="80px",o.style.transform="none",o.style.width="390px",o.style.maxWidth="calc(100vw - 32px)",o.style.height="560px",o.style.maxHeight="calc(100vh - 100px)")}ee.onclick=()=>A(!pe),g.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{A(!1),ie(!1)}),g.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{ie(!le)});async function D(){let m=g.querySelector("#omnidesk-status-text"),w=g.querySelector("#omnidesk-status-dot"),$=p.querySelector("#omnidesk-btn-text");m.innerText="Connecting...",w.style.background="#eab308",$.innerText="Connecting...",p.disabled=!0,fe();try{let L=n;if(!L&&typeof document<"u"){let c=document.querySelector("script[src*='widget.js']");if(c&&c.src&&c.src.startsWith("http"))try{L=new URL(c.src).origin}catch{}}!L&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(L=window.location.origin);let q=(L||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),ne=await fetch(`${q}/api/token?businessId=${encodeURIComponent(f)}`);if(!ne.ok)throw new Error(`Failed to get session token (${ne.status})`);let S=await ne.json();if(S.business_name&&!v){let c=g.querySelector("#omnidesk-biz-title");c&&(c.innerText=S.business_name)}let xe=h||S.agent_id||"";b=new Z({onStatusChange:c=>{if(P=c,c==="connected")m.innerText="Live \xB7 Speaking",w.style.background="#22c55e",$.innerText="End Voice Call",p.style.background="#dc2626",p.disabled=!1,V=Date.now(),M?.();else if(c==="idle"&&(m.innerText="Idle \xB7 Ready",w.style.background="rgba(255,255,255,0.4)",$.innerText="Start Voice Call",p.style.background="#000000",p.disabled=!1,z(),V>0)){let j=Math.round((Date.now()-V)/1e3);V=0,G?.(j)}},onTranscript:c=>{H.style.display="none";let j=document.createElement("div"),B=c.who==="user";j.style.cssText=`
            display: flex; flex-direction: column; gap: 4px; max-width: 88%;
            align-self: ${B?"flex-end":"flex-start"};
          `;let u=document.createElement("div");u.style.cssText=`
            padding: 10px 14px; border-radius: ${B?"14px 14px 2px 14px":"14px 14px 14px 2px"};
            font-size: 13px; line-height: 1.45;
            background: ${B?"#18181b":"#f4f4f5"};
            color: ${B?"#ffffff":"#09090b"};
            box-shadow: 0 1px 2px rgba(0,0,0,0.04);
          `,u.innerText=c.text,j.appendChild(u),I.appendChild(j),I.scrollTop=I.scrollHeight,de?.(c)},onAudioLevel:(c,j)=>{ge=c,ue=j},onError:()=>{m.innerText="Error",w.style.background="#ef4444",$.innerText="Start Voice Call",p.style.background="#000000",p.disabled=!1,z()}}),await b.start(S.token,xe,S.voice)}catch(L){console.error("[OmniDesk Voice Widget Error]:",L),m.innerText="Error",w.style.background="#ef4444",$.innerText="Start Voice Call",p.style.background="#000000",p.disabled=!1,z()}}function U(){b&&(b.stop(),b=null),P="idle",z()}return p.onclick=()=>{P==="connected"?U():P==="idle"&&D()},{destroy:()=>{z(),b&&b.stop(),a.remove()},startCall:D,endCall:U}}if(typeof document<"u"){let l=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(l){let n,f=l.src||"";if(f&&f.startsWith("http"))try{n=new URL(f).origin}catch{}let h=l.getAttribute("data-business-id")||void 0,E=l.getAttribute("data-agent")||void 0,O=l.getAttribute("data-theme")||"dark",d=l.getAttribute("data-accent")||"emerald",t=l.getAttribute("data-position")||"bottom-right",k=l.getAttribute("data-label")||void 0,v=l.getAttribute("data-host")||n||"https://omni-desk-rho.vercel.app",T=l.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{be({businessId:h,agentId:E,theme:O,accent:d,position:t,label:k,host:v,greeting:T})}):be({businessId:h,agentId:E,theme:O,accent:d,position:t,label:k,host:v,greeting:T})}}export{Z as AssemblyAIVoiceClient,ve as OmniDeskWidget,Me as VoiceWidget,be as initOmniDeskWidget};
//# sourceMappingURL=index.mjs.map