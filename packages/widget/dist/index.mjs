import{useState as _,useRef as oe,useEffect as be,useCallback as re,useMemo as ge}from"react";var fe=24e3,ke="wss://agents.assemblyai.com/v1/ws",ve=`
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${fe};
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
`,we=`
  class PlaybackProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ring = new Float32Array(sampleRate * 30);
      this._writePos = 0;
      this._readPos = 0;
      this._available = 0;
      this._step = ${fe} / sampleRate;
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
`;async function me(l,n,h){let g=URL.createObjectURL(new Blob([n],{type:"application/javascript"}));try{await l.audioWorklet.addModule(g)}finally{URL.revokeObjectURL(g)}return new AudioWorkletNode(l,h)}var J=class{constructor(n){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.callbacks=n}async start(n,h,g){try{this.callbacks.onStatusChange?.("connecting");let L=window.AudioContext||window.webkitAudioContext;this.captureCtx=new L({sampleRate:fe}),this.playbackCtx=new L({sampleRate:fe}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await me(this.playbackCtx,we,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await me(this.captureCtx,ve,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let O=new URL(ke);O.searchParams.set("token",n),this.ws=new WebSocket(O.toString()),this.captureNode.port.onmessage=({data:p})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let t=new Uint8Array(p),k="";for(let C=0;C<t.length;C+=32768)k+=String.fromCharCode.apply(null,Array.from(t.subarray(C,C+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(k)}));let v=new Int16Array(p),S=0;for(let C=0;C<v.length;C+=16)S+=Math.abs(v[C]);this.userLevel=Math.min(1,S/(v.length/16)/8e3)},this.ws.onopen=()=>{let p={};h&&h.trim()&&(p.agent_id=h.trim()),g&&g.trim()&&(p.output={voice:g.trim()}),Object.keys(p).length>0&&this.ws?.send(JSON.stringify({type:"session.update",session:p}))},this.ws.onmessage=({data:p})=>{try{let t=JSON.parse(p);switch(t.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0;break;case"transcript.user":t.text&&this.callbacks.onTranscript?.({who:"user",text:t.text});break;case"transcript.agent":t.text&&this.callbacks.onTranscript?.({who:"agent",text:t.text});break;case"reply.audio":if(t.data&&this.playbackNode){let k=atob(t.data),v=new Uint8Array(k.length);for(let S=0;S<k.length;S++)v[S]=k.charCodeAt(S);this.playbackNode.port.postMessage(v.buffer,[v.buffer]),this.agentLevel=.8}break;case"reply.done":t.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:t.name||t.tool,args:t.arguments||t.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:t.name||t.tool,result:t.result});break;case"session.error":this.callbacks.onError?.(t.message||t.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.stop();break}}catch(t){console.warn("Message parsing error:",t)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(L){this.callbacks.onError?.(L.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(n){this.isMuted=n,n&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(n,h){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:n})),h&&this.ws.send(JSON.stringify({type:"reply.create",instructions:h})),!0}catch(g){return console.error("Failed to send message to agent:",g),!1}}sendEmailInput(n){return this.sendUserMessage(`My email address is ${n}`,`The caller entered their verified email address: ${n}. Acknowledge this email, verify it using verify_customer_email if needed, and complete the booking.`)}stop(){if(this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(n=>n.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let n=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(n)};this.animFrameId=requestAnimationFrame(n)}};import{Fragment as Te,jsx as e,jsxs as s}from"react/jsx-runtime";var Se={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function ye({host:l="",businessId:n="biz_demo_dental",agentId:h,theme:g="dark",position:L="bottom-right",label:O="Talk to Receptionist",accent:p="emerald",accentColor:t,businessName:k,greeting:v,className:S,onCallStart:C,onCallEnd:Z,onTranscript:ae}){let[G,ne]=_(!1),[r,K]=_(!1),[b,V]=_("idle"),[z,F]=_([]),[le,se]=_(0),[he,ce]=_(0),[Y,Q]=_("0:00"),[X,ee]=_(k||"OmniDesk Hair Salon & Studio"),[o,T]=_(!1),[R,j]=_(""),[N,u]=_(!1),[B,x]=_(""),[de,$]=_(""),A=oe(null),te=oe(null),D=oe(0),U=oe(null),m=oe(0),W=ge(()=>t||Se[p]||p||"#10b981",[p,t]),P=ge(()=>g==="light"?!1:g==="auto"&&typeof window<"u"?window.matchMedia("(prefers-color-scheme: dark)").matches:!0,[g]);be(()=>{te.current?.scrollIntoView({behavior:"smooth"})},[z]);let y=ge(()=>l?l.replace(/\/$/,""):typeof window<"u"&&window.location.origin?window.location.origin:"",[l]),pe=re(()=>{m.current=Date.now(),Q("0:00"),U.current&&clearInterval(U.current),U.current=setInterval(()=>{let i=Date.now()-m.current,M=Math.floor(i/1e3),f=Math.floor(M/60),ie=M%60;Q(`${f}:${String(ie).padStart(2,"0")}`)},250)},[]),E=re(()=>{U.current&&(clearInterval(U.current),U.current=null)},[]),H=re(async()=>{try{V("connecting"),pe();let i=y?`${y}/api/token?businessId=${encodeURIComponent(n)}`:`/api/token?businessId=${encodeURIComponent(n)}`,M=await fetch(i);if(!M.ok)throw new Error(`Failed to fetch session token (${M.status})`);let f=await M.json();if(f.business_name&&!k&&ee(f.business_name),!f.token)throw new Error("Invalid session token payload received from host");let ie=h||f.agent_id||"",q=new J({onStatusChange:w=>{if(V(w),w==="connected")D.current=Date.now(),C?.();else if(w==="idle"&&(E(),D.current>0)){let a=Math.round((Date.now()-D.current)/1e3);D.current=0,Z?.(a)}},onTranscript:w=>{if(F(a=>[...a,w]),ae?.(w),w.who==="agent"){let a=w.text.toLowerCase();(a.replace(/[\s\-_]/g,"").includes("email")||a.includes("e-mail")||a.includes("email")||a.includes("mail address")||a.includes("your mail")||a.includes("send your confirmation")||a.includes("send the confirmation")||a.includes("calendar invite")||a.includes("where should i send")||a.includes("where can i send")||a.includes("what is your address")||a.includes("spell your")||a.includes("provide your")||a.includes("type your"))&&T(!0)}},onAudioLevel:(w,a)=>{se(w),ce(a)},onError:()=>{V("error"),E()}});A.current=q,await q.start(f.token,ie,f.voice)}catch{V("error"),E()}},[y,n,h,k,C,Z,ae,pe,E]),ue=re(()=>{if(A.current&&(A.current.stop(),A.current=null),V("idle"),se(0),ce(0),E(),T(!1),x(""),$(""),D.current>0){let i=Math.round((Date.now()-D.current)/1e3);D.current=0,Z?.(i)}},[Z,E]),c=re(async i=>{i.preventDefault();let M=R.trim();if(M){u(!0),x(""),$("");try{let f=y?y.replace(/\/$/,""):"",ie=await fetch(`${f}/api/tools/${encodeURIComponent(n)}/verify_customer_email`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:M})}),q=await ie.json();if(!ie.ok||!q.valid||!q.email){x(q.message||"Invalid email or domain has no active mail server."),u(!1);return}let w=q.email;$(`Verified: ${w}. Sent to agent.`),F(a=>[...a,{who:"user",text:`My email is ${w}`}]),A.current&&A.current.sendEmailInput(w),j(""),setTimeout(()=>{T(!1),$("")},2500)}catch(f){x(f.message||"Failed to verify email with mail server.")}finally{u(!1)}}},[R,y,n]);be(()=>()=>{E(),A.current&&A.current.stop()},[E]);let I=L==="bottom-left",d=b==="connected";return s("div",{className:S,style:{position:"relative",zIndex:99999},children:[e("div",{style:{position:"fixed",bottom:"20px",left:I?"20px":"auto",right:I?"auto":"20px",zIndex:99999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:s("button",{type:"button",onClick:()=>ne(!G),style:{display:"inline-flex",alignItems:"center",gap:"10px",background:P?"#18181b":"#ffffff",color:P?"#fafafa":"#09090b",border:`1px solid ${P?"#27272a":"#e4e4e7"}`,padding:"10px 18px",borderRadius:"9999px",cursor:"pointer",fontSize:"13px",fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.18)",transition:"transform 0.15s ease, background 0.15s ease"},onMouseEnter:i=>{i.currentTarget.style.transform="scale(1.02)"},onMouseLeave:i=>{i.currentTarget.style.transform="scale(1)"},children:[e("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:d?"#ef4444":W,boxShadow:`0 0 8px ${d?"#ef4444":W}`}}),e("span",{children:O}),e("span",{style:{fontSize:"11px",opacity:.6},children:"\u25B2"})]})}),G&&s(Te,{children:[r&&e("div",{onClick:()=>K(!1),style:{position:"fixed",inset:0,background:"rgba(0, 0, 0, 0.7)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",zIndex:999998}}),s("div",{style:{position:"fixed",bottom:r?"auto":"80px",left:r?"50%":I?"20px":"auto",right:r||I?"auto":"20px",top:r?"50%":"auto",transform:r?"translate(-50%, -50%)":"none",width:r?"calc(100vw - 40px)":"390px",maxWidth:r?"1140px":"calc(100vw - 32px)",height:r?"calc(100vh - 40px)":"560px",maxHeight:r?"900px":"calc(100vh - 100px)",background:"#ffffff",border:"1px solid #e4e4e7",borderRadius:"20px",boxShadow:r?"0 32px 64px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)":"0 24px 48px -12px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:999999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",transition:"all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"},children:[s("div",{style:{background:"#18181b",color:"#ffffff",padding:r?"16px 22px":"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",userSelect:"none",flexShrink:0},children:[s("div",{style:{display:"flex",alignItems:"center",gap:"10px",minWidth:0},children:[e("div",{style:{color:"rgba(255,255,255,0.6)",display:"grid",placeItems:"center",flexShrink:0},children:s("svg",{xmlns:"http://www.w3.org/2000/svg",width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("circle",{cx:"12",cy:"12",r:"1"}),e("circle",{cx:"12",cy:"5",r:"1"}),e("circle",{cx:"12",cy:"19",r:"1"})]})}),e("div",{style:{width:"28px",height:"28px",borderRadius:"50%",background:"rgba(255,255,255,0.15)",display:"grid",placeItems:"center",flexShrink:0,color:"#ffffff"},children:s("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),e("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),e("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]})}),s("div",{style:{display:"flex",flexDirection:"column",minWidth:0},children:[e("div",{style:{fontSize:"13.5px",fontWeight:600,color:"#ffffff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},children:X}),s("div",{style:{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"11px",color:"rgba(255,255,255,0.75)"},children:[e("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:d?"#22c55e":b==="connecting"?"#eab308":"rgba(255,255,255,0.4)"}}),e("span",{children:d?"Live \xB7 Speaking":b==="connecting"?"Connecting...":b==="error"?"Error":"Idle \xB7 Ready"})]})]})]}),s("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[e("button",{type:"button",onClick:()=>K(!r),title:r?"Exit Fullscreen":"Open Full",style:{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"7px",color:"#ffffff",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:i=>i.currentTarget.style.background="rgba(255,255,255,0.2)",onMouseLeave:i=>i.currentTarget.style.background="rgba(255,255,255,0.1)",children:r?s("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("polyline",{points:"4 14 10 14 10 20"}),e("polyline",{points:"20 10 14 10 14 4"}),e("line",{x1:"14",y1:"10",x2:"21",y2:"3"}),e("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]}):s("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("polyline",{points:"15 3 21 3 21 9"}),e("polyline",{points:"9 21 3 21 3 15"}),e("line",{x1:"21",y1:"3",x2:"14",y2:"10"}),e("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]})}),e("button",{type:"button",onClick:()=>{d&&ue(),ne(!1)},title:"Close Widget",style:{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"7px",color:"#ffffff",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:i=>i.currentTarget.style.background="rgba(255,255,255,0.2)",onMouseLeave:i=>i.currentTarget.style.background="rgba(255,255,255,0.1)",children:s("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("line",{x1:"18",y1:"6",x2:"6",y2:"18"}),e("line",{x1:"6",y1:"6",x2:"18",y2:"18"})]})})]})]}),s("div",{style:{flex:1,minHeight:0,padding:"16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"12px",background:"#ffffff"},children:[z.length===0&&s("div",{style:{margin:"auto",textAlign:"center",padding:"10px 18px",background:"#f4f4f5",border:"1px solid #e4e4e7",color:"#52525b",borderRadius:"12px",fontSize:"12.5px",fontWeight:500,display:"inline-flex",alignItems:"center",gap:"8px",alignSelf:"center"},children:[e("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:d?"#22c55e":"#a1a1aa",display:"inline-block"}}),e("span",{children:d?"Connected \xB7 Speak to our receptionist":b==="connecting"?"Connecting to receptionist...":"Start a call to talk to our receptionist"})]}),z.map((i,M)=>{let f=i.who==="user";return e("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:f?"flex-end":"flex-start"},children:s("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[!f&&e("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:s("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),e("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),e("div",{style:{padding:"10px 14px",borderRadius:f?"14px 14px 2px 14px":"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:f?"#18181b":"#f4f4f5",color:f?"#ffffff":"#09090b",boxShadow:"0 1px 2px rgba(0,0,0,0.04)"},children:i.text})]})},M)}),e("div",{ref:te})]}),o&&d&&s("div",{style:{padding:"11px 16px",background:"#f0fdf4",borderTop:"1px solid #bbf7d0",display:"flex",flexDirection:"column",gap:"7px",flexShrink:0},children:[s("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"},children:[s("span",{style:{fontSize:"11px",fontWeight:700,color:"#15803d",textTransform:"uppercase",letterSpacing:"0.04em",display:"inline-flex",alignItems:"center",gap:"6px"},children:[e("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:"#22c55e",display:"inline-block"}}),"Agent Requesting Email \u2022 Verified Mailbox Entry"]}),e("button",{type:"button",onClick:()=>T(!1),style:{background:"none",border:"none",color:"#15803d",cursor:"pointer",fontSize:"12px",fontWeight:700,padding:"1px 4px"},children:"\u2715"})]}),s("form",{onSubmit:c,style:{display:"flex",gap:"6px"},children:[e("input",{type:"email",autoFocus:!0,value:R,onChange:i=>{j(i.target.value),x("")},placeholder:"Enter your real email (e.g. name@gmail.com)",disabled:N,required:!0,style:{flex:1,fontSize:"12.5px",padding:"7px 11px",borderRadius:"7px",border:B?"1.5px solid #ef4444":"1px solid #86efac",background:"#ffffff",color:"#09090b",outline:"none"}}),e("button",{type:"submit",disabled:N||!R.trim(),style:{background:"#16a34a",color:"#ffffff",border:"none",padding:"7px 14px",borderRadius:"7px",fontSize:"12px",fontWeight:600,cursor:N?"wait":"pointer",opacity:N?.7:1},children:N?"...":"Verify & Send"})]}),B&&s("div",{style:{fontSize:"11px",color:"#ef4444",fontWeight:500},children:["\u26A0\uFE0F ",B]}),de&&s("div",{style:{fontSize:"11px",color:"#15803d",fontWeight:600},children:["\u2713 ",de]})]}),s("div",{style:{padding:"12px 16px",borderTop:"1px solid #e4e4e7",background:"#fafafa",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0},children:[s("button",{type:"button",onClick:d?ue:H,disabled:b==="connecting",style:{display:"inline-flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:d?"#dc2626":"#000000",color:"#ffffff",borderRadius:"10px",border:"none",fontSize:"13px",fontWeight:600,cursor:b==="connecting"?"not-allowed":"pointer",transition:"all 0.15s ease"},children:[s("svg",{xmlns:"http://www.w3.org/2000/svg",width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),e("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),e("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]}),e("span",{children:d?"End Voice Call":b==="connecting"?"Connecting...":"Start Voice Call"})]}),s("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[d&&e("div",{style:{display:"flex",alignItems:"center",gap:"2.5px",height:"14px"},children:[12,8,14,6,10].map((i,M)=>e("span",{style:{width:"2.5px",height:`${Math.max(4,Math.min(14,Math.round(i*(.35+Math.max(le,he)*1.5))))}px`,background:"#000000",borderRadius:"1px",transition:"height 0.12s ease"}},M))}),e("span",{style:{fontFamily:"var(--mono, monospace)",fontSize:"12px",fontWeight:600,padding:"3px 8px",borderRadius:"6px",background:d?"#000000":"#f4f4f5",color:d?"#ffffff":"#71717a"},children:Y})]})]})]})]})]})}var Ce=ye;var Me={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function xe(l={}){if(typeof window>"u")return;let{host:n,businessId:h="biz_demo_dental",agentId:g,theme:L="dark",position:O="bottom-right",label:p="Talk to Receptionist",accent:t="emerald",accentColor:k,businessName:v,greeting:S,onCallStart:C,onCallEnd:Z,onTranscript:ae}=l,G=k||Me[t]||t||"#10b981",ne=document.getElementById("omnidesk-voice-widget-root");ne&&ne.remove();let r=document.createElement("div");r.id="omnidesk-voice-widget-root",r.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let K=L==="dark"||L==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,b=null,V="idle",z=0,F=null,le=!1,se=!1,he=0,ce=0,Y=O==="bottom-left",Q=document.createElement("div");Q.style.cssText=`
    position: fixed; bottom: 20px; ${Y?"left: 20px;":"right: 20px;"};
    z-index: 999999;
  `;let X=document.createElement("button");X.style.cssText=`
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${K?"#18181b":"#ffffff"}; color: ${K?"#fafafa":"#09090b"};
    border: 1px solid ${K?"#27272a":"#e4e4e7"};
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `,X.innerHTML=`
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${G};box-shadow:0 0 8px ${G};display:inline-block;"></span>
    <span>${p}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,Q.appendChild(X);let ee=document.createElement("div");ee.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,ee.onclick=()=>te(!1);let o=document.createElement("div");o.style.cssText=`
    position: fixed; bottom: 80px; ${Y?"left: 20px;":"right: 20px;"};
    width: 390px; max-width: calc(100vw - 32px); height: 560px; max-height: calc(100vh - 100px);
    background: #ffffff; border: 1px solid #e4e4e7;
    border-radius: 20px; box-shadow: 0 24px 48px -12px rgba(0,0,0,0.22);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  `;let T=document.createElement("div");T.style.cssText=`
    background: #18181b; color: #ffffff; padding: 13px 18px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; user-select: none; flex-shrink: 0;
  `,T.innerHTML=`
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
  `;let R=document.createElement("div");R.style.cssText=`
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
  `,R.appendChild(j);let N=document.createElement("div");N.style.cssText=`
    padding: 12px 16px; border-top: 1px solid #e4e4e7;
    background: #fafafa; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  `;let u=document.createElement("button");u.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: #000000; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s ease;
  `,u.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let B=document.createElement("div");B.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let x=document.createElement("span");x.id="omnidesk-timer",x.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,x.innerText="0:00",B.appendChild(x),N.appendChild(u),N.appendChild(B),o.appendChild(T),o.appendChild(R),o.appendChild(N),r.appendChild(Q),r.appendChild(ee),r.appendChild(o),document.body.appendChild(r);function de(){z=Date.now(),x.innerText="0:00",x.style.background="#000000",x.style.color="#ffffff",F&&clearInterval(F),F=setInterval(()=>{let m=Date.now()-z,W=Math.floor(m/1e3),P=Math.floor(W/60),y=W%60;x.innerText=`${P}:${String(y).padStart(2,"0")}`},250)}function $(){F&&(clearInterval(F),F=null),x.style.background="#f4f4f5",x.style.color="#71717a",x.innerText="0:00"}function A(m){le=m,o.style.display=m?"flex":"none"}function te(m){se=m,ee.style.display=m?"block":"none",m?(o.style.top="50%",o.style.left="50%",o.style.bottom="auto",o.style.right="auto",o.style.transform="translate(-50%, -50%)",o.style.width="calc(100vw - 40px)",o.style.maxWidth="1140px",o.style.height="calc(100vh - 40px)",o.style.maxHeight="900px"):(o.style.top="auto",o.style.left=Y?"20px":"auto",o.style.right=Y?"auto":"20px",o.style.bottom="80px",o.style.transform="none",o.style.width="390px",o.style.maxWidth="calc(100vw - 32px)",o.style.height="560px",o.style.maxHeight="calc(100vh - 100px)")}X.onclick=()=>A(!le),T.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{A(!1),te(!1)}),T.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{te(!se)});async function D(){let m=T.querySelector("#omnidesk-status-text"),W=T.querySelector("#omnidesk-status-dot"),P=u.querySelector("#omnidesk-btn-text");m.innerText="Connecting...",W.style.background="#eab308",P.innerText="Connecting...",u.disabled=!0,de();try{let y=n;if(!y&&typeof document<"u"){let c=document.querySelector("script[src*='widget.js']");if(c&&c.src&&c.src.startsWith("http"))try{y=new URL(c.src).origin}catch{}}!y&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(y=window.location.origin);let pe=(y||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),E=await fetch(`${pe}/api/token?businessId=${encodeURIComponent(h)}`);if(!E.ok)throw new Error(`Failed to get session token (${E.status})`);let H=await E.json();if(H.business_name&&!v){let c=T.querySelector("#omnidesk-biz-title");c&&(c.innerText=H.business_name)}let ue=g||H.agent_id||"";b=new J({onStatusChange:c=>{if(V=c,c==="connected")m.innerText="Live \xB7 Speaking",W.style.background="#22c55e",P.innerText="End Voice Call",u.style.background="#dc2626",u.disabled=!1,z=Date.now(),C?.();else if(c==="idle"&&(m.innerText="Idle \xB7 Ready",W.style.background="rgba(255,255,255,0.4)",P.innerText="Start Voice Call",u.style.background="#000000",u.disabled=!1,$(),z>0)){let I=Math.round((Date.now()-z)/1e3);z=0,Z?.(I)}},onTranscript:c=>{j.style.display="none";let I=document.createElement("div"),d=c.who==="user";I.style.cssText=`
            display: flex; flex-direction: column; gap: 4px; max-width: 88%;
            align-self: ${d?"flex-end":"flex-start"};
          `;let i=document.createElement("div");i.style.cssText=`
            padding: 10px 14px; border-radius: ${d?"14px 14px 2px 14px":"14px 14px 14px 2px"};
            font-size: 13px; line-height: 1.45;
            background: ${d?"#18181b":"#f4f4f5"};
            color: ${d?"#ffffff":"#09090b"};
            box-shadow: 0 1px 2px rgba(0,0,0,0.04);
          `,i.innerText=c.text,I.appendChild(i),R.appendChild(I),R.scrollTop=R.scrollHeight,ae?.(c)},onAudioLevel:(c,I)=>{he=c,ce=I},onError:()=>{m.innerText="Error",W.style.background="#ef4444",P.innerText="Start Voice Call",u.style.background="#000000",u.disabled=!1,$()}}),await b.start(H.token,ue,H.voice)}catch(y){console.error("[OmniDesk Voice Widget Error]:",y),m.innerText="Error",W.style.background="#ef4444",P.innerText="Start Voice Call",u.style.background="#000000",u.disabled=!1,$()}}function U(){b&&(b.stop(),b=null),V="idle",$()}return u.onclick=()=>{V==="connected"?U():V==="idle"&&D()},{destroy:()=>{$(),b&&b.stop(),r.remove()},startCall:D,endCall:U}}if(typeof document<"u"){let l=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(l){let n,h=l.src||"";if(h&&h.startsWith("http"))try{n=new URL(h).origin}catch{}let g=l.getAttribute("data-business-id")||void 0,L=l.getAttribute("data-agent")||void 0,O=l.getAttribute("data-theme")||"dark",p=l.getAttribute("data-accent")||"emerald",t=l.getAttribute("data-position")||"bottom-right",k=l.getAttribute("data-label")||void 0,v=l.getAttribute("data-host")||n||"https://omni-desk-rho.vercel.app",S=l.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{xe({businessId:g,agentId:L,theme:O,accent:p,position:t,label:k,host:v,greeting:S})}):xe({businessId:g,agentId:L,theme:O,accent:p,position:t,label:k,host:v,greeting:S})}}export{J as AssemblyAIVoiceClient,ye as OmniDeskWidget,Ce as VoiceWidget,xe as initOmniDeskWidget};
//# sourceMappingURL=index.mjs.map