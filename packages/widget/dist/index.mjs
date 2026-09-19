import{useState as C,useRef as oe,useEffect as me,useCallback as re,useMemo as ge}from"react";var ue=24e3,ke="wss://agents.assemblyai.com/v1/ws",ve=`
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${ue};
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
      this._step = ${ue} / sampleRate;
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
`;async function be(l,n,g){let c=URL.createObjectURL(new Blob([n],{type:"application/javascript"}));try{await l.audioWorklet.addModule(c)}finally{URL.revokeObjectURL(c)}return new AudioWorkletNode(l,g)}var q=class{constructor(n){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.callbacks=n}async start(n,g){try{this.callbacks.onStatusChange?.("connecting");let c=window.AudioContext||window.webkitAudioContext;this.captureCtx=new c({sampleRate:ue}),this.playbackCtx=new c({sampleRate:ue}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await be(this.playbackCtx,we,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await be(this.captureCtx,ve,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let R=new URL(ke);R.searchParams.set("token",n),this.ws=new WebSocket(R.toString()),this.captureNode.port.onmessage=({data:T})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let t=new Uint8Array(T),x="";for(let M=0;M<t.length;M+=32768)x+=String.fromCharCode.apply(null,Array.from(t.subarray(M,M+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(x)}));let b=new Int16Array(T),_=0;for(let M=0;M<b.length;M+=16)_+=Math.abs(b[M]);this.userLevel=Math.min(1,_/(b.length/16)/8e3)},this.ws.onopen=()=>{g&&g.trim()&&this.ws?.send(JSON.stringify({type:"session.update",session:{agent_id:g.trim()}}))},this.ws.onmessage=({data:T})=>{try{let t=JSON.parse(T);switch(t.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0;break;case"transcript.user":t.text&&this.callbacks.onTranscript?.({who:"user",text:t.text});break;case"transcript.agent":t.text&&this.callbacks.onTranscript?.({who:"agent",text:t.text});break;case"reply.audio":if(t.data&&this.playbackNode){let x=atob(t.data),b=new Uint8Array(x.length);for(let _=0;_<x.length;_++)b[_]=x.charCodeAt(_);this.playbackNode.port.postMessage(b.buffer,[b.buffer]),this.agentLevel=.8}break;case"reply.done":t.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:t.name||t.tool,args:t.arguments||t.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:t.name||t.tool,result:t.result});break;case"session.error":this.callbacks.onError?.(t.message||t.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.stop();break}}catch(t){console.warn("Message parsing error:",t)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(c){this.callbacks.onError?.(c.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(n){this.isMuted=n,n&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(n,g){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:n})),g&&this.ws.send(JSON.stringify({type:"reply.create",instructions:g})),!0}catch(c){return console.error("Failed to send message to agent:",c),!1}}sendEmailInput(n){return this.sendUserMessage(`My email address is ${n}`,`The caller entered their verified email address: ${n}. Acknowledge this email, verify it using verify_customer_email if needed, and complete the booking.`)}stop(){if(this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(n=>n.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let n=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(n)};this.animFrameId=requestAnimationFrame(n)}};import{Fragment as Te,jsx as e,jsxs as i}from"react/jsx-runtime";var Se={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function ye({host:l="",businessId:n="biz_demo_dental",agentId:g,theme:c="dark",position:R="bottom-right",label:T="Talk to Receptionist",accent:t="emerald",accentColor:x,businessName:b,greeting:_,className:M,onCallStart:ae,onCallEnd:J,onTranscript:le}){let[Z,ne]=C(!1),[r,G]=C(!1),[m,W]=C("idle"),[P,D]=C([]),[ce,ie]=C(0),[fe,de]=C(0),[K,Y]=C("0:00"),[Q,X]=C(b||"OmniDesk Hair Salon & Studio"),[s,v]=C(!1),[L,U]=C(""),[z,d]=C(!1),[j,u]=C(""),[pe,N]=C(""),E=oe(null),ee=oe(null),V=oe(0),O=oe(null),f=oe(0),I=ge(()=>x||Se[t]||t||"#10b981",[t,x]),A=ge(()=>c==="light"?!1:c==="auto"&&typeof window<"u"?window.matchMedia("(prefers-color-scheme: dark)").matches:!0,[c]);me(()=>{ee.current?.scrollIntoView({behavior:"smooth"})},[P]);let $=ge(()=>l?l.replace(/\/$/,""):typeof window<"u"&&window.location.origin?window.location.origin:"",[l]),se=re(()=>{f.current=Date.now(),Y("0:00"),O.current&&clearInterval(O.current),O.current=setInterval(()=>{let o=Date.now()-f.current,S=Math.floor(o/1e3),h=Math.floor(S/60),te=S%60;Y(`${h}:${String(te).padStart(2,"0")}`)},250)},[]),w=re(()=>{O.current&&(clearInterval(O.current),O.current=null)},[]),he=re(async()=>{try{W("connecting"),se();let o=$?`${$}/api/token?businessId=${encodeURIComponent(n)}`:`/api/token?businessId=${encodeURIComponent(n)}`,S=await fetch(o);if(!S.ok)throw new Error(`Failed to fetch session token (${S.status})`);let h=await S.json();if(h.business_name&&!b&&X(h.business_name),!h.token)throw new Error("Invalid session token payload received from host");let te=g||h.agent_id||"",H=new q({onStatusChange:k=>{if(W(k),k==="connected")V.current=Date.now(),ae?.();else if(k==="idle"&&(w(),V.current>0)){let a=Math.round((Date.now()-V.current)/1e3);V.current=0,J?.(a)}},onTranscript:k=>{if(D(a=>[...a,k]),le?.(k),k.who==="agent"){let a=k.text.toLowerCase();(a.replace(/[\s\-_]/g,"").includes("email")||a.includes("e-mail")||a.includes("email")||a.includes("mail address")||a.includes("your mail")||a.includes("send your confirmation")||a.includes("send the confirmation")||a.includes("calendar invite")||a.includes("where should i send")||a.includes("where can i send")||a.includes("what is your address")||a.includes("spell your")||a.includes("provide your")||a.includes("type your"))&&v(!0)}},onAudioLevel:(k,a)=>{ie(k),de(a)},onError:()=>{W("error"),w()}});E.current=H,await H.start(h.token,te)}catch{W("error"),w()}},[$,n,g,b,ae,J,le,se,w]),y=re(()=>{if(E.current&&(E.current.stop(),E.current=null),W("idle"),ie(0),de(0),w(),v(!1),u(""),N(""),V.current>0){let o=Math.round((Date.now()-V.current)/1e3);V.current=0,J?.(o)}},[J,w]),F=re(async o=>{o.preventDefault();let S=L.trim();if(S){d(!0),u(""),N("");try{let h=$?$.replace(/\/$/,""):"",te=await fetch(`${h}/api/tools/${encodeURIComponent(n)}/verify_customer_email`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:S})}),H=await te.json();if(!te.ok||!H.valid||!H.email){u(H.message||"Invalid email or domain has no active mail server."),d(!1);return}let k=H.email;N(`Verified: ${k}. Sent to agent.`),D(a=>[...a,{who:"user",text:`My email is ${k}`}]),E.current&&E.current.sendEmailInput(k),U(""),setTimeout(()=>{v(!1),N("")},2500)}catch(h){u(h.message||"Failed to verify email with mail server.")}finally{d(!1)}}},[L,$,n]);me(()=>()=>{w(),E.current&&E.current.stop()},[w]);let B=R==="bottom-left",p=m==="connected";return i("div",{className:M,style:{position:"relative",zIndex:99999},children:[e("div",{style:{position:"fixed",bottom:"20px",left:B?"20px":"auto",right:B?"auto":"20px",zIndex:99999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:i("button",{type:"button",onClick:()=>ne(!Z),style:{display:"inline-flex",alignItems:"center",gap:"10px",background:A?"#18181b":"#ffffff",color:A?"#fafafa":"#09090b",border:`1px solid ${A?"#27272a":"#e4e4e7"}`,padding:"10px 18px",borderRadius:"9999px",cursor:"pointer",fontSize:"13px",fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.18)",transition:"transform 0.15s ease, background 0.15s ease"},onMouseEnter:o=>{o.currentTarget.style.transform="scale(1.02)"},onMouseLeave:o=>{o.currentTarget.style.transform="scale(1)"},children:[e("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:p?"#ef4444":I,boxShadow:`0 0 8px ${p?"#ef4444":I}`}}),e("span",{children:T}),e("span",{style:{fontSize:"11px",opacity:.6},children:"\u25B2"})]})}),Z&&i(Te,{children:[r&&e("div",{onClick:()=>G(!1),style:{position:"fixed",inset:0,background:"rgba(0, 0, 0, 0.7)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",zIndex:999998}}),i("div",{style:{position:"fixed",bottom:r?"auto":"80px",left:r?"50%":B?"20px":"auto",right:r||B?"auto":"20px",top:r?"50%":"auto",transform:r?"translate(-50%, -50%)":"none",width:r?"calc(100vw - 40px)":"390px",maxWidth:r?"1140px":"calc(100vw - 32px)",height:r?"calc(100vh - 40px)":"560px",maxHeight:r?"900px":"calc(100vh - 100px)",background:"#ffffff",border:"1px solid #e4e4e7",borderRadius:"20px",boxShadow:r?"0 32px 64px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)":"0 24px 48px -12px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:999999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",transition:"all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"},children:[i("div",{style:{background:"#18181b",color:"#ffffff",padding:r?"16px 22px":"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",userSelect:"none",flexShrink:0},children:[i("div",{style:{display:"flex",alignItems:"center",gap:"10px",minWidth:0},children:[e("div",{style:{color:"rgba(255,255,255,0.6)",display:"grid",placeItems:"center",flexShrink:0},children:i("svg",{xmlns:"http://www.w3.org/2000/svg",width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("circle",{cx:"12",cy:"12",r:"1"}),e("circle",{cx:"12",cy:"5",r:"1"}),e("circle",{cx:"12",cy:"19",r:"1"})]})}),e("div",{style:{width:"28px",height:"28px",borderRadius:"50%",background:"rgba(255,255,255,0.15)",display:"grid",placeItems:"center",flexShrink:0,color:"#ffffff"},children:i("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),e("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),e("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]})}),i("div",{style:{display:"flex",flexDirection:"column",minWidth:0},children:[e("div",{style:{fontSize:"13.5px",fontWeight:600,color:"#ffffff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},children:Q}),i("div",{style:{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"11px",color:"rgba(255,255,255,0.75)"},children:[e("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:p?"#22c55e":m==="connecting"?"#eab308":"rgba(255,255,255,0.4)"}}),e("span",{children:p?"Live \xB7 Speaking":m==="connecting"?"Connecting...":m==="error"?"Error":"Idle \xB7 Ready"})]})]})]}),i("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[e("button",{type:"button",onClick:()=>G(!r),title:r?"Exit Fullscreen":"Open Full",style:{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"7px",color:"#ffffff",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:o=>o.currentTarget.style.background="rgba(255,255,255,0.2)",onMouseLeave:o=>o.currentTarget.style.background="rgba(255,255,255,0.1)",children:r?i("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("polyline",{points:"4 14 10 14 10 20"}),e("polyline",{points:"20 10 14 10 14 4"}),e("line",{x1:"14",y1:"10",x2:"21",y2:"3"}),e("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]}):i("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("polyline",{points:"15 3 21 3 21 9"}),e("polyline",{points:"9 21 3 21 3 15"}),e("line",{x1:"21",y1:"3",x2:"14",y2:"10"}),e("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]})}),e("button",{type:"button",onClick:()=>{p&&y(),ne(!1)},title:"Close Widget",style:{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"7px",color:"#ffffff",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:o=>o.currentTarget.style.background="rgba(255,255,255,0.2)",onMouseLeave:o=>o.currentTarget.style.background="rgba(255,255,255,0.1)",children:i("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("line",{x1:"18",y1:"6",x2:"6",y2:"18"}),e("line",{x1:"6",y1:"6",x2:"18",y2:"18"})]})})]})]}),i("div",{style:{flex:1,minHeight:0,padding:"16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"12px",background:"#ffffff"},children:[P.length===0&&i("div",{style:{margin:"auto",textAlign:"center",padding:"10px 18px",background:"#f4f4f5",border:"1px solid #e4e4e7",color:"#52525b",borderRadius:"12px",fontSize:"12.5px",fontWeight:500,display:"inline-flex",alignItems:"center",gap:"8px",alignSelf:"center"},children:[e("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:p?"#22c55e":"#a1a1aa",display:"inline-block"}}),e("span",{children:p?"Connected \xB7 Speak to our receptionist":m==="connecting"?"Connecting to receptionist...":"Start a call to talk to our receptionist"})]}),P.map((o,S)=>{let h=o.who==="user";return e("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:h?"flex-end":"flex-start"},children:i("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[!h&&e("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:i("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),e("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),e("div",{style:{padding:"10px 14px",borderRadius:h?"14px 14px 2px 14px":"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:h?"#18181b":"#f4f4f5",color:h?"#ffffff":"#09090b",boxShadow:"0 1px 2px rgba(0,0,0,0.04)"},children:o.text})]})},S)}),e("div",{ref:ee})]}),s&&p&&i("div",{style:{padding:"11px 16px",background:"#f0fdf4",borderTop:"1px solid #bbf7d0",display:"flex",flexDirection:"column",gap:"7px",flexShrink:0},children:[i("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"},children:[i("span",{style:{fontSize:"11px",fontWeight:700,color:"#15803d",textTransform:"uppercase",letterSpacing:"0.04em",display:"inline-flex",alignItems:"center",gap:"6px"},children:[e("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:"#22c55e",display:"inline-block"}}),"Agent Requesting Email \u2022 Verified Mailbox Entry"]}),e("button",{type:"button",onClick:()=>v(!1),style:{background:"none",border:"none",color:"#15803d",cursor:"pointer",fontSize:"12px",fontWeight:700,padding:"1px 4px"},children:"\u2715"})]}),i("form",{onSubmit:F,style:{display:"flex",gap:"6px"},children:[e("input",{type:"email",autoFocus:!0,value:L,onChange:o=>{U(o.target.value),u("")},placeholder:"Enter your real email (e.g. name@gmail.com)",disabled:z,required:!0,style:{flex:1,fontSize:"12.5px",padding:"7px 11px",borderRadius:"7px",border:j?"1.5px solid #ef4444":"1px solid #86efac",background:"#ffffff",color:"#09090b",outline:"none"}}),e("button",{type:"submit",disabled:z||!L.trim(),style:{background:"#16a34a",color:"#ffffff",border:"none",padding:"7px 14px",borderRadius:"7px",fontSize:"12px",fontWeight:600,cursor:z?"wait":"pointer",opacity:z?.7:1},children:z?"...":"Verify & Send"})]}),j&&i("div",{style:{fontSize:"11px",color:"#ef4444",fontWeight:500},children:["\u26A0\uFE0F ",j]}),pe&&i("div",{style:{fontSize:"11px",color:"#15803d",fontWeight:600},children:["\u2713 ",pe]})]}),i("div",{style:{padding:"12px 16px",borderTop:"1px solid #e4e4e7",background:"#fafafa",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0},children:[i("button",{type:"button",onClick:p?y:he,disabled:m==="connecting",style:{display:"inline-flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:p?"#dc2626":"#000000",color:"#ffffff",borderRadius:"10px",border:"none",fontSize:"13px",fontWeight:600,cursor:m==="connecting"?"not-allowed":"pointer",transition:"all 0.15s ease"},children:[i("svg",{xmlns:"http://www.w3.org/2000/svg",width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),e("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),e("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]}),e("span",{children:p?"End Voice Call":m==="connecting"?"Connecting...":"Start Voice Call"})]}),i("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[p&&e("div",{style:{display:"flex",alignItems:"center",gap:"2.5px",height:"14px"},children:[12,8,14,6,10].map((o,S)=>e("span",{style:{width:"2.5px",height:`${Math.max(4,Math.min(14,Math.round(o*(.35+Math.max(ce,fe)*1.5))))}px`,background:"#000000",borderRadius:"1px",transition:"height 0.12s ease"}},S))}),e("span",{style:{fontFamily:"var(--mono, monospace)",fontSize:"12px",fontWeight:600,padding:"3px 8px",borderRadius:"6px",background:p?"#000000":"#f4f4f5",color:p?"#ffffff":"#71717a"},children:K})]})]})]})]})]})}var Ce=ye;var _e={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function xe(l={}){if(typeof window>"u")return;let{host:n,businessId:g="biz_demo_dental",agentId:c,theme:R="dark",position:T="bottom-right",label:t="Talk to Receptionist",accent:x="emerald",accentColor:b,businessName:_,greeting:M,onCallStart:ae,onCallEnd:J,onTranscript:le}=l,Z=b||_e[x]||x||"#10b981",ne=document.getElementById("omnidesk-voice-widget-root");ne&&ne.remove();let r=document.createElement("div");r.id="omnidesk-voice-widget-root",r.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let G=R==="dark"||R==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,m=null,W="idle",P=0,D=null,ce=!1,ie=!1,fe=0,de=0,K=T==="bottom-left",Y=document.createElement("div");Y.style.cssText=`
    position: fixed; bottom: 20px; ${K?"left: 20px;":"right: 20px;"};
    z-index: 999999;
  `;let Q=document.createElement("button");Q.style.cssText=`
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${G?"#18181b":"#ffffff"}; color: ${G?"#fafafa":"#09090b"};
    border: 1px solid ${G?"#27272a":"#e4e4e7"};
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `,Q.innerHTML=`
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${Z};box-shadow:0 0 8px ${Z};display:inline-block;"></span>
    <span>${t}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,Y.appendChild(Q);let X=document.createElement("div");X.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,X.onclick=()=>ee(!1);let s=document.createElement("div");s.style.cssText=`
    position: fixed; bottom: 80px; ${K?"left: 20px;":"right: 20px;"};
    width: 390px; max-width: calc(100vw - 32px); height: 560px; max-height: calc(100vh - 100px);
    background: #ffffff; border: 1px solid #e4e4e7;
    border-radius: 20px; box-shadow: 0 24px 48px -12px rgba(0,0,0,0.22);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  `;let v=document.createElement("div");v.style.cssText=`
    background: #18181b; color: #ffffff; padding: 13px 18px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; user-select: none; flex-shrink: 0;
  `,v.innerHTML=`
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
          ${_||"OmniDesk Hair Salon & Studio"}
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
  `;let L=document.createElement("div");L.style.cssText=`
    flex: 1; min-height: 0; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 12px; background: #ffffff;
  `;let U=document.createElement("div");U.id="omnidesk-placeholder-banner",U.style.cssText=`
    margin: auto; text-align: center; padding: 10px 18px;
    background: #f4f4f5; border: 1px solid #e4e4e7; color: #52525b;
    border-radius: 12px; font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px; align-self: center;
  `,U.innerHTML=`
    <span style="width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block;"></span>
    <span>Start a call to talk to our receptionist</span>
  `,L.appendChild(U);let z=document.createElement("div");z.style.cssText=`
    padding: 12px 16px; border-top: 1px solid #e4e4e7;
    background: #fafafa; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  `;let d=document.createElement("button");d.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: #000000; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s ease;
  `,d.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let j=document.createElement("div");j.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let u=document.createElement("span");u.id="omnidesk-timer",u.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,u.innerText="0:00",j.appendChild(u),z.appendChild(d),z.appendChild(j),s.appendChild(v),s.appendChild(L),s.appendChild(z),r.appendChild(Y),r.appendChild(X),r.appendChild(s),document.body.appendChild(r);function pe(){P=Date.now(),u.innerText="0:00",u.style.background="#000000",u.style.color="#ffffff",D&&clearInterval(D),D=setInterval(()=>{let f=Date.now()-P,I=Math.floor(f/1e3),A=Math.floor(I/60),$=I%60;u.innerText=`${A}:${String($).padStart(2,"0")}`},250)}function N(){D&&(clearInterval(D),D=null),u.style.background="#f4f4f5",u.style.color="#71717a",u.innerText="0:00"}function E(f){ce=f,s.style.display=f?"flex":"none"}function ee(f){ie=f,X.style.display=f?"block":"none",f?(s.style.top="50%",s.style.left="50%",s.style.bottom="auto",s.style.right="auto",s.style.transform="translate(-50%, -50%)",s.style.width="calc(100vw - 40px)",s.style.maxWidth="1140px",s.style.height="calc(100vh - 40px)",s.style.maxHeight="900px"):(s.style.top="auto",s.style.left=K?"20px":"auto",s.style.right=K?"auto":"20px",s.style.bottom="80px",s.style.transform="none",s.style.width="390px",s.style.maxWidth="calc(100vw - 32px)",s.style.height="560px",s.style.maxHeight="calc(100vh - 100px)")}Q.onclick=()=>E(!ce),v.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{E(!1),ee(!1)}),v.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{ee(!ie)});async function V(){let f=v.querySelector("#omnidesk-status-text"),I=v.querySelector("#omnidesk-status-dot"),A=d.querySelector("#omnidesk-btn-text");f.innerText="Connecting...",I.style.background="#eab308",A.innerText="Connecting...",d.disabled=!0,pe();try{let $=n?n.replace(/\/$/,""):typeof window<"u"?window.location.origin:"",se=await fetch(`${$}/api/token?businessId=${encodeURIComponent(g)}`);if(!se.ok)throw new Error("Failed to get session token");let w=await se.json();if(w.business_name&&!_){let y=v.querySelector("#omnidesk-biz-title");y&&(y.innerText=w.business_name)}let he=c||w.agent_id||"";m=new q({onStatusChange:y=>{if(W=y,y==="connected")f.innerText="Live \xB7 Speaking",I.style.background="#22c55e",A.innerText="End Voice Call",d.style.background="#dc2626",d.disabled=!1,P=Date.now(),ae?.();else if(y==="idle"&&(f.innerText="Idle \xB7 Ready",I.style.background="rgba(255,255,255,0.4)",A.innerText="Start Voice Call",d.style.background="#000000",d.disabled=!1,N(),P>0)){let F=Math.round((Date.now()-P)/1e3);P=0,J?.(F)}},onTranscript:y=>{U.style.display="none";let F=document.createElement("div"),B=y.who==="user";F.style.cssText=`
            display: flex; flex-direction: column; gap: 4px; max-width: 88%;
            align-self: ${B?"flex-end":"flex-start"};
          `;let p=document.createElement("div");p.style.cssText=`
            padding: 10px 14px; border-radius: ${B?"14px 14px 2px 14px":"14px 14px 14px 2px"};
            font-size: 13px; line-height: 1.45;
            background: ${B?"#18181b":"#f4f4f5"};
            color: ${B?"#ffffff":"#09090b"};
            box-shadow: 0 1px 2px rgba(0,0,0,0.04);
          `,p.innerText=y.text,F.appendChild(p),L.appendChild(F),L.scrollTop=L.scrollHeight,le?.(y)},onAudioLevel:(y,F)=>{fe=y,de=F},onError:()=>{f.innerText="Error",I.style.background="#ef4444",A.innerText="Start Voice Call",d.style.background="#000000",d.disabled=!1,N()}}),await m.start(w.token,he)}catch{f.innerText="Error",I.style.background="#ef4444",A.innerText="Start Voice Call",d.style.background="#000000",d.disabled=!1,N()}}function O(){m&&(m.stop(),m=null),W="idle",N()}return d.onclick=()=>{W==="connected"?O():W==="idle"&&V()},{destroy:()=>{N(),m&&m.stop(),r.remove()},startCall:V,endCall:O}}if(typeof document<"u"){let l=document.currentScript||document.querySelector("script[data-agent], script[data-business-id]");if(l){let n=l.getAttribute("data-business-id")||void 0,g=l.getAttribute("data-agent")||void 0,c=l.getAttribute("data-theme")||"dark",R=l.getAttribute("data-accent")||"emerald",T=l.getAttribute("data-position")||"bottom-right",t=l.getAttribute("data-label")||void 0,x=l.getAttribute("data-host")||void 0,b=l.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{xe({businessId:n,agentId:g,theme:c,accent:R,position:T,label:t,host:x,greeting:b})}):xe({businessId:n,agentId:g,theme:c,accent:R,position:T,label:t,host:x,greeting:b})}}export{q as AssemblyAIVoiceClient,ye as OmniDeskWidget,Ce as VoiceWidget,xe as initOmniDeskWidget};
//# sourceMappingURL=index.mjs.map