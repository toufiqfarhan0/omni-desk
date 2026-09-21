"use strict";var ge=Object.defineProperty;var ye=Object.getOwnPropertyDescriptor;var ke=Object.getOwnPropertyNames;var ve=Object.prototype.hasOwnProperty;var we=(o,t)=>{for(var c in t)ge(o,c,{get:t[c],enumerable:!0})},Se=(o,t,c,d)=>{if(t&&typeof t=="object"||typeof t=="function")for(let u of ke(t))!ve.call(o,u)&&u!==c&&ge(o,u,{get:()=>t[u],enumerable:!(d=ye(t,u))||d.enumerable});return o};var Ce=o=>Se(ge({},"__esModule",{value:!0}),o);var Ie={};we(Ie,{AssemblyAIVoiceClient:()=>q,OmniDeskWidget:()=>xe,VoiceWidget:()=>be,initOmniDeskWidget:()=>ue});module.exports=Ce(Ie);var i=require("react");var pe=24e3,Te="wss://agents.assemblyai.com/v1/ws",Me=`
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${pe};
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
`,Le=`
  class PlaybackProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ring = new Float32Array(sampleRate * 30);
      this._writePos = 0;
      this._readPos = 0;
      this._available = 0;
      this._step = ${pe} / sampleRate;
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
`;async function me(o,t,c){let d=URL.createObjectURL(new Blob([t],{type:"application/javascript"}));try{await o.audioWorklet.addModule(d)}finally{URL.revokeObjectURL(d)}return new AudioWorkletNode(o,c)}var q=class{constructor(t){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.callbacks=t}async start(t,c,d){try{this.callbacks.onStatusChange?.("connecting");let u=window.AudioContext||window.webkitAudioContext;this.captureCtx=new u({sampleRate:pe}),this.playbackCtx=new u({sampleRate:pe}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await me(this.playbackCtx,Le,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await me(this.captureCtx,Me,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let $=new URL(Te);$.searchParams.set("token",t),this.ws=new WebSocket($.toString()),this.captureNode.port.onmessage=({data:f})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let n=new Uint8Array(f),v="";for(let L=0;L<n.length;L+=32768)v+=String.fromCharCode.apply(null,Array.from(n.subarray(L,L+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(v)}));let w=new Int16Array(f),M=0;for(let L=0;L<w.length;L+=16)M+=Math.abs(w[L]);this.userLevel=Math.min(1,M/(w.length/16)/8e3)},this.ws.onopen=()=>{let f={};c&&c.trim()&&(f.agent_id=c.trim()),d&&d.trim()&&(f.output={voice:d.trim()}),Object.keys(f).length>0&&this.ws?.send(JSON.stringify({type:"session.update",session:f}))},this.ws.onmessage=({data:f})=>{try{let n=JSON.parse(f);switch(n.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0;break;case"transcript.user":n.text&&this.callbacks.onTranscript?.({who:"user",text:n.text});break;case"transcript.agent":n.text&&this.callbacks.onTranscript?.({who:"agent",text:n.text});break;case"reply.audio":if(n.data&&this.playbackNode){let v=atob(n.data),w=new Uint8Array(v.length);for(let M=0;M<v.length;M++)w[M]=v.charCodeAt(M);this.playbackNode.port.postMessage(w.buffer,[w.buffer]),this.agentLevel=.8}break;case"reply.done":n.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:n.name||n.tool,args:n.arguments||n.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:n.name||n.tool,result:n.result});break;case"session.error":this.callbacks.onError?.(n.message||n.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.stop();break}}catch(n){console.warn("Message parsing error:",n)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(u){this.callbacks.onError?.(u.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(t){this.isMuted=t,t&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(t,c){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:t})),c&&this.ws.send(JSON.stringify({type:"reply.create",instructions:c})),!0}catch(d){return console.error("Failed to send message to agent:",d),!1}}sendEmailInput(t){return this.sendUserMessage(`My email address is ${t}`,`The caller entered their verified email address: ${t}. Acknowledge this email, verify it using verify_customer_email if needed, and complete the booking.`)}stop(){if(this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(t=>t.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let t=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(t)};this.animFrameId=requestAnimationFrame(t)}};var e=require("react/jsx-runtime"),_e={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function xe({host:o="",businessId:t="biz_demo_dental",agentId:c,theme:d="dark",position:u="bottom-right",label:$="Talk to Receptionist",accent:f="emerald",accentColor:n,businessName:v,greeting:w,className:M,onCallStart:L,onCallEnd:Z,onTranscript:ae}){let[G,oe]=(0,i.useState)(!1),[l,K]=(0,i.useState)(!1),[y,W]=(0,i.useState)("idle"),[P,O]=(0,i.useState)([]),[le,re]=(0,i.useState)(0),[fe,ce]=(0,i.useState)(0),[Y,Q]=(0,i.useState)("0:00"),[X,ee]=(0,i.useState)(v||"OmniDesk Hair Salon & Studio"),[r,x]=(0,i.useState)(!1),[E,B]=(0,i.useState)(""),[V,h]=(0,i.useState)(!1),[J,m]=(0,i.useState)(""),[de,N]=(0,i.useState)(""),I=(0,i.useRef)(null),te=(0,i.useRef)(null),z=(0,i.useRef)(0),F=(0,i.useRef)(null),b=(0,i.useRef)(0),S=(0,i.useRef)(!1),D=(0,i.useMemo)(()=>n||_e[f]||f||"#10b981",[f,n]),_=(0,i.useMemo)(()=>d==="light"?!1:d==="auto"&&typeof window<"u"?window.matchMedia("(prefers-color-scheme: dark)").matches:!0,[d]);(0,i.useEffect)(()=>{te.current?.scrollIntoView({behavior:"smooth"})},[P]);let H=(0,i.useMemo)(()=>o?o.replace(/\/$/,""):typeof window<"u"&&window.location.origin?window.location.origin:"",[o]),ie=(0,i.useCallback)(()=>{b.current=Date.now(),Q("0:00"),F.current&&clearInterval(F.current),F.current=setInterval(()=>{let a=Date.now()-b.current,A=Math.floor(a/1e3),T=Math.floor(A/60),R=A%60;Q(`${T}:${String(R).padStart(2,"0")}`)},250)},[]),C=(0,i.useCallback)(()=>{F.current&&(clearInterval(F.current),F.current=null)},[]),he=(0,i.useCallback)(async()=>{try{W("connecting"),S.current=!1,x(!1),ie();let A=`${H?H.replace(/\/$/,""):""}/api/token?businessId=${encodeURIComponent(t)}`,T=await fetch(A);if(!T.ok)throw new Error("Failed to initialize voice session");let R=await T.json();if(R.business_name&&!v&&ee(R.business_name),!R.token)throw new Error("Invalid session token payload received from host");let ne=c||R.agent_id||"",se=new q({onStatusChange:k=>{if(W(k),k==="connected")z.current=Date.now(),L?.();else if(k==="idle"&&(C(),z.current>0)){let s=Math.round((Date.now()-z.current)/1e3);z.current=0,Z?.(s)}},onTranscript:k=>{if(O(s=>[...s,k]),ae?.(k),k.who==="user")(k.text.includes("@")||k.text.toLowerCase().includes(" at ")&&k.text.toLowerCase().includes(" dot "))&&(S.current=!0,x(!1));else if(k.who==="agent"){let s=k.text.toLowerCase();if(s.includes("verified your email")||s.includes("thank you")&&s.includes("email")||s.includes("sent a calendar invite")||s.includes("sent your confirmation")||s.includes("confirmation code is")||s.includes("i have sent")){S.current=!0,x(!1);return}if(S.current){x(!1);return}(s.includes("what is your email")||s.includes("may i have your email")||s.includes("provide your email")||s.includes("can i have your email")||s.includes("enter your email")||s.includes("spell your email")||s.includes("what's your email")||s.includes("where can i send your confirmation")||s.includes("where should i send your confirmation")||s.includes("where can i send your calendar invite")||s.includes("where should i send your calendar invite")||s.includes("email address")&&(s.includes("what")||s.includes("have")||s.includes("provide")||s.includes("give")||s.includes("tell")))&&x(!0)}},onAudioLevel:(k,s)=>{re(k),ce(s)},onError:()=>{W("error"),C()}});I.current=se,await se.start(R.token,ne,R.voice)}catch{W("error"),C()}},[H,t,c,v,L,Z,ae,ie,C]),p=(0,i.useCallback)(()=>{if(I.current&&(I.current.stop(),I.current=null),W("idle"),re(0),ce(0),C(),x(!1),m(""),N(""),z.current>0){let a=Math.round((Date.now()-z.current)/1e3);z.current=0,Z?.(a)}},[Z,C]),U=(0,i.useCallback)(async a=>{a.preventDefault();let A=E.trim();if(A){h(!0),m(""),N("");try{let T=H?H.replace(/\/$/,""):"",R=await fetch(`${T}/api/tools/${encodeURIComponent(t)}/verify_customer_email`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:A})}),ne=await R.json();if(!R.ok||!ne.valid||!ne.email){m(ne.message||"Invalid email or domain has no active mail server."),h(!1);return}let se=ne.email;N(`Verified: ${se}. Sent to agent.`),O(k=>[...k,{who:"user",text:`My email is ${se}`}]),I.current&&I.current.sendEmailInput(se),S.current=!0,B(""),x(!1),N("")}catch(T){m(T.message||"Failed to verify email with mail server.")}finally{h(!1)}}},[E,H,t]);(0,i.useEffect)(()=>()=>{C(),I.current&&I.current.stop()},[C]);let j=u==="bottom-left",g=y==="connected";return(0,e.jsxs)("div",{className:M,style:{position:"relative",zIndex:99999},children:[(0,e.jsx)("div",{style:{position:"fixed",bottom:"20px",left:j?"20px":"auto",right:j?"auto":"20px",zIndex:99999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:(0,e.jsxs)("button",{type:"button",onClick:()=>oe(!G),style:{display:"inline-flex",alignItems:"center",gap:"10px",background:_?"#18181b":"#ffffff",color:_?"#fafafa":"#09090b",border:`1px solid ${_?"#27272a":"#e4e4e7"}`,padding:"10px 18px",borderRadius:"9999px",cursor:"pointer",fontSize:"13px",fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.18)",transition:"transform 0.15s ease, background 0.15s ease"},onMouseEnter:a=>{a.currentTarget.style.transform="scale(1.02)"},onMouseLeave:a=>{a.currentTarget.style.transform="scale(1)"},children:[(0,e.jsx)("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:g?"#ef4444":D,boxShadow:`0 0 8px ${g?"#ef4444":D}`}}),(0,e.jsx)("span",{children:$}),(0,e.jsx)("span",{style:{fontSize:"11px",opacity:.6},children:"\u25B2"})]})}),G&&(0,e.jsxs)(e.Fragment,{children:[l&&(0,e.jsx)("div",{onClick:()=>K(!1),style:{position:"fixed",inset:0,background:"rgba(0, 0, 0, 0.7)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",zIndex:999998}}),(0,e.jsxs)("div",{style:{position:"fixed",bottom:l?"auto":"80px",left:l?"50%":j?"20px":"auto",right:l||j?"auto":"20px",top:l?"50%":"auto",transform:l?"translate(-50%, -50%)":"none",width:l?"calc(100vw - 40px)":"390px",maxWidth:l?"1140px":"calc(100vw - 32px)",height:l?"calc(100vh - 40px)":"560px",maxHeight:l?"900px":"calc(100vh - 100px)",background:"#ffffff",border:"1px solid #e4e4e7",borderRadius:"20px",boxShadow:l?"0 32px 64px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)":"0 24px 48px -12px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:999999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",transition:"all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"},children:[(0,e.jsxs)("div",{style:{background:"#18181b",color:"#ffffff",padding:l?"16px 22px":"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",userSelect:"none",flexShrink:0},children:[(0,e.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"10px",minWidth:0},children:[(0,e.jsx)("div",{style:{color:"rgba(255,255,255,0.6)",display:"grid",placeItems:"center",flexShrink:0},children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("circle",{cx:"12",cy:"12",r:"1"}),(0,e.jsx)("circle",{cx:"12",cy:"5",r:"1"}),(0,e.jsx)("circle",{cx:"12",cy:"19",r:"1"})]})}),(0,e.jsx)("div",{style:{width:"28px",height:"28px",borderRadius:"50%",background:"rgba(255,255,255,0.15)",display:"grid",placeItems:"center",flexShrink:0,color:"#ffffff"},children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,e.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),(0,e.jsx)("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]})}),(0,e.jsxs)("div",{style:{display:"flex",flexDirection:"column",minWidth:0},children:[(0,e.jsx)("div",{style:{fontSize:"13.5px",fontWeight:600,color:"#ffffff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},children:X}),(0,e.jsxs)("div",{style:{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"11px",color:"rgba(255,255,255,0.75)"},children:[(0,e.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:g?"#22c55e":y==="connecting"?"#eab308":"rgba(255,255,255,0.4)"}}),(0,e.jsx)("span",{children:g?"Live \xB7 Speaking":y==="connecting"?"Connecting...":y==="error"?"Error":"Idle \xB7 Ready"})]})]})]}),(0,e.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[(0,e.jsx)("button",{type:"button",onClick:()=>K(!l),title:l?"Exit Fullscreen":"Open Full",style:{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"7px",color:"#ffffff",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:a=>a.currentTarget.style.background="rgba(255,255,255,0.2)",onMouseLeave:a=>a.currentTarget.style.background="rgba(255,255,255,0.1)",children:l?(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("polyline",{points:"4 14 10 14 10 20"}),(0,e.jsx)("polyline",{points:"20 10 14 10 14 4"}),(0,e.jsx)("line",{x1:"14",y1:"10",x2:"21",y2:"3"}),(0,e.jsx)("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]}):(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("polyline",{points:"15 3 21 3 21 9"}),(0,e.jsx)("polyline",{points:"9 21 3 21 3 15"}),(0,e.jsx)("line",{x1:"21",y1:"3",x2:"14",y2:"10"}),(0,e.jsx)("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]})}),(0,e.jsx)("button",{type:"button",onClick:()=>{g&&p(),oe(!1)},title:"Close Widget",style:{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"7px",color:"#ffffff",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:a=>a.currentTarget.style.background="rgba(255,255,255,0.2)",onMouseLeave:a=>a.currentTarget.style.background="rgba(255,255,255,0.1)",children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("line",{x1:"18",y1:"6",x2:"6",y2:"18"}),(0,e.jsx)("line",{x1:"6",y1:"6",x2:"18",y2:"18"})]})})]})]}),(0,e.jsxs)("div",{style:{flex:1,minHeight:0,padding:"16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"12px",background:"#ffffff"},children:[P.length===0&&(0,e.jsxs)("div",{style:{margin:"auto",textAlign:"center",padding:"10px 18px",background:"#f4f4f5",border:"1px solid #e4e4e7",color:"#52525b",borderRadius:"12px",fontSize:"12.5px",fontWeight:500,display:"inline-flex",alignItems:"center",gap:"8px",alignSelf:"center"},children:[(0,e.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:g?"#22c55e":"#a1a1aa",display:"inline-block"}}),(0,e.jsx)("span",{children:g?"Connected \xB7 Speak to our receptionist":y==="connecting"?"Connecting to receptionist...":"Start a call to talk to our receptionist"})]}),P.map((a,A)=>{let T=a.who==="user";return(0,e.jsx)("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:T?"flex-end":"flex-start"},children:(0,e.jsxs)("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[!T&&(0,e.jsx)("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,e.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),(0,e.jsx)("div",{style:{padding:"10px 14px",borderRadius:T?"14px 14px 2px 14px":"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:T?"#18181b":"#f4f4f5",color:T?"#ffffff":"#09090b",boxShadow:"0 1px 2px rgba(0,0,0,0.04)"},children:a.text})]})},A)}),(0,e.jsx)("div",{ref:te})]}),r&&g&&(0,e.jsxs)("div",{style:{padding:"11px 16px",background:"#f0fdf4",borderTop:"1px solid #bbf7d0",display:"flex",flexDirection:"column",gap:"7px",flexShrink:0},children:[(0,e.jsxs)("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"},children:[(0,e.jsxs)("span",{style:{fontSize:"11px",fontWeight:700,color:"#15803d",textTransform:"uppercase",letterSpacing:"0.04em",display:"inline-flex",alignItems:"center",gap:"6px"},children:[(0,e.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:"#22c55e",display:"inline-block"}}),"Agent Requesting Email \u2022 Verified Mailbox Entry"]}),(0,e.jsx)("button",{type:"button",onClick:()=>x(!1),style:{background:"none",border:"none",color:"#15803d",cursor:"pointer",fontSize:"12px",fontWeight:700,padding:"1px 4px"},children:"\u2715"})]}),(0,e.jsxs)("form",{onSubmit:U,style:{display:"flex",gap:"6px"},children:[(0,e.jsx)("input",{type:"email",autoFocus:!0,value:E,onChange:a=>{B(a.target.value),m("")},placeholder:"Enter your real email (e.g. name@gmail.com)",disabled:V,required:!0,style:{flex:1,fontSize:"12.5px",padding:"7px 11px",borderRadius:"7px",border:J?"1.5px solid #ef4444":"1px solid #86efac",background:"#ffffff",color:"#09090b",outline:"none"}}),(0,e.jsx)("button",{type:"submit",disabled:V||!E.trim(),style:{background:"#16a34a",color:"#ffffff",border:"none",padding:"7px 14px",borderRadius:"7px",fontSize:"12px",fontWeight:600,cursor:V?"wait":"pointer",opacity:V?.7:1},children:V?"...":"Verify & Send"})]}),J&&(0,e.jsxs)("div",{style:{fontSize:"11px",color:"#ef4444",fontWeight:500},children:["\u26A0\uFE0F ",J]}),de&&(0,e.jsxs)("div",{style:{fontSize:"11px",color:"#15803d",fontWeight:600},children:["\u2713 ",de]})]}),(0,e.jsxs)("div",{style:{padding:"12px 16px",borderTop:"1px solid #e4e4e7",background:"#fafafa",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0},children:[(0,e.jsxs)("button",{type:"button",onClick:g?p:he,disabled:y==="connecting",style:{display:"inline-flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:g?"#dc2626":"#000000",color:"#ffffff",borderRadius:"10px",border:"none",fontSize:"13px",fontWeight:600,cursor:y==="connecting"?"not-allowed":"pointer",transition:"all 0.15s ease"},children:[(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,e.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),(0,e.jsx)("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]}),(0,e.jsx)("span",{children:g?"End Voice Call":y==="connecting"?"Connecting...":"Start Voice Call"})]}),(0,e.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[g&&(0,e.jsx)("div",{style:{display:"flex",alignItems:"center",gap:"2.5px",height:"14px"},children:[12,8,14,6,10].map((a,A)=>(0,e.jsx)("span",{style:{width:"2.5px",height:`${Math.max(4,Math.min(14,Math.round(a*(.35+Math.max(le,fe)*1.5))))}px`,background:"#000000",borderRadius:"1px",transition:"height 0.12s ease"}},A))}),(0,e.jsx)("span",{style:{fontFamily:"var(--mono, monospace)",fontSize:"12px",fontWeight:600,padding:"3px 8px",borderRadius:"6px",background:g?"#000000":"#f4f4f5",color:g?"#ffffff":"#71717a"},children:Y})]})]})]})]})]})}var be=xe;var Ee={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function ue(o={}){if(typeof window>"u")return;let{host:t,businessId:c="biz_demo_dental",agentId:d,theme:u="dark",position:$="bottom-right",label:f="Talk to Receptionist",accent:n="emerald",accentColor:v,businessName:w,greeting:M,onCallStart:L,onCallEnd:Z,onTranscript:ae}=o,G=v||Ee[n]||n||"#10b981",oe=document.getElementById("omnidesk-voice-widget-root");oe&&oe.remove();let l=document.createElement("div");l.id="omnidesk-voice-widget-root",l.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let K=u==="dark"||u==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,y=null,W="idle",P=0,O=null,le=!1,re=!1,fe=0,ce=0,Y=$==="bottom-left",Q=document.createElement("div");Q.style.cssText=`
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
    <span>${f}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,Q.appendChild(X);let ee=document.createElement("div");ee.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,ee.onclick=()=>te(!1);let r=document.createElement("div");r.style.cssText=`
    position: fixed; bottom: 80px; ${Y?"left: 20px;":"right: 20px;"};
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
      <div style="display: flex; flexDirection: column; min-width: 0;">
        <div id="omnidesk-biz-title" style="font-size: 13.5px; font-weight: 600; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${w||"OmniDesk Hair Salon & Studio"}
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
  `;let E=document.createElement("div");E.style.cssText=`
    flex: 1; min-height: 0; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 12px; background: #ffffff;
  `;let B=document.createElement("div");B.id="omnidesk-placeholder-banner",B.style.cssText=`
    margin: auto; text-align: center; padding: 10px 18px;
    background: #f4f4f5; border: 1px solid #e4e4e7; color: #52525b;
    border-radius: 12px; font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px; align-self: center;
  `,B.innerHTML=`
    <span style="width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block;"></span>
    <span>Start a call to talk to our receptionist</span>
  `,E.appendChild(B);let V=document.createElement("div");V.style.cssText=`
    padding: 12px 16px; border-top: 1px solid #e4e4e7;
    background: #fafafa; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  `;let h=document.createElement("button");h.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: #000000; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s ease;
  `,h.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let J=document.createElement("div");J.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let m=document.createElement("span");m.id="omnidesk-timer",m.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,m.innerText="0:00",J.appendChild(m),V.appendChild(h),V.appendChild(J),r.appendChild(x),r.appendChild(E),r.appendChild(V),l.appendChild(Q),l.appendChild(ee),l.appendChild(r),document.body.appendChild(l);function de(){P=Date.now(),m.innerText="0:00",m.style.background="#000000",m.style.color="#ffffff",O&&clearInterval(O),O=setInterval(()=>{let b=Date.now()-P,S=Math.floor(b/1e3),D=Math.floor(S/60),_=S%60;m.innerText=`${D}:${String(_).padStart(2,"0")}`},250)}function N(){O&&(clearInterval(O),O=null),m.style.background="#f4f4f5",m.style.color="#71717a",m.innerText="0:00"}function I(b){le=b,r.style.display=b?"flex":"none"}function te(b){re=b,ee.style.display=b?"block":"none",b?(r.style.top="50%",r.style.left="50%",r.style.bottom="auto",r.style.right="auto",r.style.transform="translate(-50%, -50%)",r.style.width="calc(100vw - 40px)",r.style.maxWidth="1140px",r.style.height="calc(100vh - 40px)",r.style.maxHeight="900px"):(r.style.top="auto",r.style.left=Y?"20px":"auto",r.style.right=Y?"auto":"20px",r.style.bottom="80px",r.style.transform="none",r.style.width="390px",r.style.maxWidth="calc(100vw - 32px)",r.style.height="560px",r.style.maxHeight="calc(100vh - 100px)")}X.onclick=()=>I(!le),x.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{I(!1),te(!1)}),x.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{te(!re)});async function z(){let b=x.querySelector("#omnidesk-status-text"),S=x.querySelector("#omnidesk-status-dot"),D=h.querySelector("#omnidesk-btn-text");b.innerText="Connecting...",S.style.background="#eab308",D.innerText="Connecting...",h.disabled=!0,de();try{let _=t;if(!_&&typeof document<"u"){let p=document.querySelector("script[src*='widget.js']");if(p&&p.src&&p.src.startsWith("http"))try{_=new URL(p.src).origin}catch{}}!_&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(_=window.location.origin);let H=(_||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),ie=await fetch(`${H}/api/token?businessId=${encodeURIComponent(c)}`);if(!ie.ok)throw new Error(`Failed to get session token (${ie.status})`);let C=await ie.json();if(C.business_name&&!w){let p=x.querySelector("#omnidesk-biz-title");p&&(p.innerText=C.business_name)}let he=d||C.agent_id||"";y=new q({onStatusChange:p=>{if(W=p,p==="connected")b.innerText="Live \xB7 Speaking",S.style.background="#22c55e",D.innerText="End Voice Call",h.style.background="#dc2626",h.disabled=!1,P=Date.now(),L?.();else if(p==="idle"&&(b.innerText="Idle \xB7 Ready",S.style.background="rgba(255,255,255,0.4)",D.innerText="Start Voice Call",h.style.background="#000000",h.disabled=!1,N(),P>0)){let U=Math.round((Date.now()-P)/1e3);P=0,Z?.(U)}},onTranscript:p=>{B.style.display="none";let U=document.createElement("div"),j=p.who==="user";U.style.cssText=`
            display: flex; flex-direction: column; gap: 4px; max-width: 88%;
            align-self: ${j?"flex-end":"flex-start"};
          `;let g=document.createElement("div");g.style.cssText=`
            padding: 10px 14px; border-radius: ${j?"14px 14px 2px 14px":"14px 14px 14px 2px"};
            font-size: 13px; line-height: 1.45;
            background: ${j?"#18181b":"#f4f4f5"};
            color: ${j?"#ffffff":"#09090b"};
            box-shadow: 0 1px 2px rgba(0,0,0,0.04);
          `,g.innerText=p.text,U.appendChild(g),E.appendChild(U),E.scrollTop=E.scrollHeight,ae?.(p)},onAudioLevel:(p,U)=>{fe=p,ce=U},onError:()=>{b.innerText="Error",S.style.background="#ef4444",D.innerText="Start Voice Call",h.style.background="#000000",h.disabled=!1,N()}}),await y.start(C.token,he,C.voice)}catch(_){console.error("[OmniDesk Voice Widget Error]:",_),b.innerText="Error",S.style.background="#ef4444",D.innerText="Start Voice Call",h.style.background="#000000",h.disabled=!1,N()}}function F(){y&&(y.stop(),y=null),W="idle",N()}return h.onclick=()=>{W==="connected"?F():W==="idle"&&z()},{destroy:()=>{N(),y&&y.stop(),l.remove()},startCall:z,endCall:F}}if(typeof document<"u"){let o=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(o){let t,c=o.src||"";if(c&&c.startsWith("http"))try{t=new URL(c).origin}catch{}let d=o.getAttribute("data-business-id")||void 0,u=o.getAttribute("data-agent")||void 0,$=o.getAttribute("data-theme")||"dark",f=o.getAttribute("data-accent")||"emerald",n=o.getAttribute("data-position")||"bottom-right",v=o.getAttribute("data-label")||void 0,w=o.getAttribute("data-host")||t||"https://omni-desk-rho.vercel.app",M=o.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{ue({businessId:d,agentId:u,theme:$,accent:f,position:n,label:v,host:w,greeting:M})}):ue({businessId:d,agentId:u,theme:$,accent:f,position:n,label:v,host:w,greeting:M})}}0&&(module.exports={AssemblyAIVoiceClient,OmniDeskWidget,VoiceWidget,initOmniDeskWidget});
//# sourceMappingURL=index.js.map