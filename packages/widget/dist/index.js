"use strict";var Ce=Object.defineProperty;var Le=Object.getOwnPropertyDescriptor;var $e=Object.getOwnPropertyNames;var Ae=Object.prototype.hasOwnProperty;var _e=(u,a)=>{for(var y in a)Ce(u,y,{get:a[y],enumerable:!0})},Ie=(u,a,y,k)=>{if(a&&typeof a=="object"||typeof a=="function")for(let S of $e(a))!Ae.call(u,S)&&S!==y&&Ce(u,S,{get:()=>a[S],enumerable:!(k=Le(a,S))||k.enumerable});return u};var Re=u=>Ie(Ce({},"__esModule",{value:!0}),u);var Ne={};_e(Ne,{AssemblyAIVoiceClient:()=>te,OmniDeskWidget:()=>Se,VoiceWidget:()=>Me,initOmniDeskWidget:()=>ke});module.exports=Re(Ne);var p=require("react");var be=24e3,We="wss://agents.assemblyai.com/v1/ws",Fe=`
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${be};
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
`,ze=`
  class PlaybackProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ring = new Float32Array(sampleRate * 30);
      this._writePos = 0;
      this._readPos = 0;
      this._available = 0;
      this._step = ${be} / sampleRate;
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
`;async function Te(u,a,y){let k=URL.createObjectURL(new Blob([a],{type:"application/javascript"}));try{await u.audioWorklet.addModule(k)}finally{URL.revokeObjectURL(k)}return new AudioWorkletNode(u,y)}var te=class{constructor(a){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.isThinking=!1;this.callbacks=a}setThinking(a){this.isThinking!==a&&(this.isThinking=a,this.callbacks.onThinkingChange?.(a))}async start(a,y,k){try{this.callbacks.onStatusChange?.("connecting");let S=window.AudioContext||window.webkitAudioContext;this.captureCtx=new S({sampleRate:be}),this.playbackCtx=new S({sampleRate:be}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await Te(this.playbackCtx,ze,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0}}),this.captureNode=await Te(this.captureCtx,Fe,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let K=new URL(We);K.searchParams.set("token",a),this.ws=new WebSocket(K.toString()),this.captureNode.port.onmessage=({data:T})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let r=new Uint8Array(T),W="";for(let B=0;B<r.length;B+=32768)W+=String.fromCharCode.apply(null,Array.from(r.subarray(B,B+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(W)}));let H=new Int16Array(T),F=0;for(let B=0;B<H.length;B+=16)F+=Math.abs(H[B]);this.userLevel=Math.min(1,F/(H.length/16)/8e3)},this.ws.onopen=()=>{let T={};y&&y.trim()?T.agent_id=y.trim():k&&k.trim()&&(T.output={voice:k.trim()}),Object.keys(T).length>0&&this.ws?.send(JSON.stringify({type:"session.update",session:T}))};let L="",P="";this.ws.onmessage=({data:T})=>{try{let r=JSON.parse(T);switch(r.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0,P="",this.setThinking(!1);break;case"transcript.user.delta":r.text&&(P=r.text,this.callbacks.onTranscript?.({who:"user",text:r.text,isFinal:!1}));break;case"transcript.user":r.text&&(P=r.text,this.callbacks.onTranscript?.({who:"user",text:r.text,isFinal:!0}),this.setThinking(!0));break;case"reply.started":L="";break;case"transcript.agent.delta":r.delta&&(this.setThinking(!1),L&&!L.endsWith(" ")&&!/^[.,!?;:%)]/.test(r.delta)?L+=" "+r.delta:L+=r.delta,this.callbacks.onTranscript?.({who:"agent",text:L,isFinal:!1}));break;case"transcript.agent":r.text&&(this.setThinking(!1),L=r.text,this.callbacks.onTranscript?.({who:"agent",text:r.text,isFinal:!0}));break;case"reply.audio":if(r.data&&this.playbackNode){let W=atob(r.data),H=new Uint8Array(W.length);for(let F=0;F<W.length;F++)H[F]=W.charCodeAt(F);this.playbackNode.port.postMessage(H.buffer,[H.buffer]),this.agentLevel=.8}break;case"reply.done":r.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:r.name||r.tool,args:r.arguments||r.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:r.name||r.tool,result:r.result});break;case"session.error":this.setThinking(!1),this.callbacks.onError?.(r.message||r.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.setThinking(!1),this.stop();break}}catch(r){console.warn("Message parsing error:",r)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(S){this.callbacks.onError?.(S.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(a){this.isMuted=a,a&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(a,y){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:a})),y&&this.ws.send(JSON.stringify({type:"reply.create",instructions:y})),!0}catch(k){return console.error("Failed to send message to agent:",k),!1}}sendEmailInput(a){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:`My email address is ${a}`})),!0}catch(y){return console.error("Failed to send email to agent:",y),!1}}stop(){if(this.setThinking(!1),this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(a=>a.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let a=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(a)};this.animFrameId=requestAnimationFrame(a)}};var t=require("react/jsx-runtime"),Pe={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function Se({host:u="",businessId:a="biz_demo_dental",agentId:y,theme:k="light",position:S="bottom-right",label:K="Talk to Receptionist",accent:L="emerald",accentColor:P,businessName:T,greeting:r,className:W,onCallStart:H,onCallEnd:F,onTranscript:B}){let[g,ce]=(0,p.useState)(!1),[b,o]=(0,p.useState)(!1),[w,O]=(0,p.useState)("idle"),[Y,Q]=(0,p.useState)([]),[he,pe]=(0,p.useState)(0),[we,xe]=(0,p.useState)(0),[ve,ee]=(0,p.useState)("0:00"),[j,ne]=(0,p.useState)(T||"OmniDesk Hair Salon & Studio"),[X,E]=(0,p.useState)(!1),[U,re]=(0,p.useState)(""),[Z,V]=(0,p.useState)(!1),c=(0,p.useRef)(null),A=(0,p.useRef)(null),J=(0,p.useRef)(0),v=(0,p.useRef)(null),G=(0,p.useRef)(0),M=(0,p.useRef)(!1),x=(0,p.useRef)(!1),z=(0,p.useRef)(!1),l=(0,p.useMemo)(()=>P||Pe[L]||L||"#10b981",[L,P]),s=(0,p.useMemo)(()=>k==="dark"?!0:k==="auto"&&typeof window<"u"?window.matchMedia("(prefers-color-scheme: dark)").matches:!1,[k]);(0,p.useEffect)(()=>{A.current&&(A.current.scrollTop=A.current.scrollHeight)},[Y,Z]);let _=(0,p.useMemo)(()=>u?u.replace(/\/$/,""):typeof window<"u"&&window.location.origin?window.location.origin:"",[u]),ue=(0,p.useCallback)(()=>{G.current=Date.now(),ee("0:00"),v.current&&clearInterval(v.current),v.current=setInterval(()=>{let h=Date.now()-G.current,$=Math.floor(h/1e3),R=Math.floor($/60),q=$%60;ee(`${R}:${String(q).padStart(2,"0")}`)},250)},[]),N=(0,p.useCallback)(()=>{v.current&&(clearInterval(v.current),v.current=null)},[]),I=(0,p.useCallback)(async()=>{try{O("connecting"),M.current=!1,x.current=!1,z.current=!1,E(!1),ue();let $=`${_?_.replace(/\/$/,""):""}/api/token?businessId=${encodeURIComponent(a)}`,R=await fetch($);if(!R.ok)throw new Error("Failed to initialize voice session");let q=await R.json();if(q.business_name&&!T&&ne(q.business_name),!q.token)throw new Error("Invalid session token payload received from host");let me=y||q.agent_id||"",f=new te({onStatusChange:i=>{if(O(i),i==="connected")J.current=Date.now(),H?.();else if(i==="idle"){if(V(!1),N(),J.current>0){let e=Math.round((Date.now()-J.current)/1e3);J.current=0,F?.(e)}}else i==="error"&&(V(!1),N())},onThinkingChange:i=>{i&&V(!0)},onTranscript:i=>{if(i.who==="user"?V(!0):i.who==="agent"&&i.text&&i.text.trim().length>0&&V(!1),Q(e=>{let m=e[e.length-1];if(m&&m.who===i.who&&!m.isFinal){let le=[...e];return le[le.length-1]={...m,text:i.text,isFinal:i.isFinal??!1},le}return[...e,{id:i.id||`${Date.now()}-${Math.random()}`,who:i.who,text:i.text,isFinal:i.isFinal??!1}]}),B?.(i),i.who==="user"){let e=i.text.toLowerCase();(e==="no"||e.startsWith("no ")||e.includes("no,")||e.includes("wrong")||e.includes("incorrect")||e.includes("change my email")||e.includes("different email"))&&(z.current=!1),(i.text.includes("@")||e.includes(" at ")&&e.includes(" dot ")||e.includes("gmail.com")||e.includes("yahoo.com")||e.includes("outlook.com")||e.includes("hotmail.com")||e.includes("icloud.com"))&&(E(!1),z.current=!0)}else if(i.who==="agent"){let e=i.text.toLowerCase();if(e.includes("confirmation code is")||e.includes("booking is confirmed")||e.includes("scheduled your appointment")||e.includes("all set, your appointment")||e.includes("sent your confirmation")&&(e.includes("code")||e.includes("calendar invite"))||e.includes("sent a calendar invite")&&(e.includes("code")||e.includes("all set"))){x.current=!0,z.current=!1,E(!1);return}if(x.current){E(!1);return}if(e.includes("confirm with yes or no")||e.includes("yes or no")||e.includes("is that correct")||e.includes("is that right")){z.current=!0,E(!1);return}e.includes("what is your email")||e.includes("what's your email")||e.includes("whats your email")||e.includes("may i have your email")||e.includes("can i have your email")||e.includes("could i have your email")||e.includes("could i get your email")||e.includes("could you provide your email")||e.includes("can you provide your email")||e.includes("provide your email")||e.includes("enter your email")||e.includes("spell your email")||e.includes("share your email")||e.includes("need your email")||e.includes("what email")||e.includes("which email")||e.includes("where can i send your confirmation")||e.includes("where should i send your confirmation")||e.includes("where can i send your calendar")||e.includes("where should i send your calendar")||e.includes("email")&&(e.includes("what is")||e.includes("what's")||e.includes("whats")||e.includes("may i have")||e.includes("can i have")||e.includes("could i have")||e.includes("may i get")||e.includes("could i get")||e.includes("can you provide")||e.includes("could you provide")||e.includes("provide")||e.includes("give me")||e.includes("tell me")||e.includes("share")||e.includes("best email")||e.includes("your email")||e.includes("send your calendar invite")||e.includes("send your confirmation")||e.includes("send a calendar invite")||e.includes("send the calendar invite")||e.includes("send the confirmation")||e.includes("send a confirmation")||e.includes("so i can send")||e.includes("to send your"))?(z.current=!1,E(!0)):i.isFinal&&!x.current&&!z.current&&E(!1)}},onAudioLevel:(i,e)=>{pe(i),xe(e)},onError:()=>{O("error"),N()}});c.current=f,await f.start(q.token,me,q.voice)}catch{O("error"),N()}},[_,a,y,T,H,F,B,ue,N]),ge=(0,p.useCallback)(()=>{if(c.current&&(c.current.stop(),c.current=null),O("idle"),V(!1),pe(0),xe(0),N(),x.current=!1,z.current=!1,E(!1),J.current>0){let h=Math.round((Date.now()-J.current)/1e3);J.current=0,F?.(h)}},[F,N]),ie=(0,p.useCallback)(h=>{h.preventDefault();let $=U.trim();$&&(Q(R=>[...R,{who:"user",text:`My email is ${$}`,isFinal:!0}]),c.current&&c.current.sendEmailInput($),V(!0),z.current=!0,re(""),E(!1))},[U]);(0,p.useEffect)(()=>()=>{N(),c.current&&c.current.stop()},[N]);let se=S==="bottom-left",C=w==="connected";return(0,t.jsxs)("div",{className:W,style:{position:"relative",zIndex:99999},children:[(0,t.jsx)("div",{style:{position:"fixed",bottom:"20px",left:se?"20px":"auto",right:se?"auto":"20px",zIndex:99999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:(0,t.jsxs)("button",{type:"button",onClick:()=>ce(!g),style:{display:"inline-flex",alignItems:"center",gap:"10px",background:s?"#18181b":"#ffffff",color:s?"#fafafa":"#09090b",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,padding:"10px 18px",borderRadius:"9999px",cursor:"pointer",fontSize:"13px",fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.18)",transition:"transform 0.15s ease, background 0.15s ease"},onMouseEnter:h=>{h.currentTarget.style.transform="scale(1.02)"},onMouseLeave:h=>{h.currentTarget.style.transform="scale(1)"},children:[(0,t.jsx)("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:C?"#ef4444":l,boxShadow:`0 0 8px ${C?"#ef4444":l}`}}),(0,t.jsx)("span",{children:K}),(0,t.jsx)("span",{style:{fontSize:"11px",opacity:.6},children:"\u25B2"})]})}),g&&(0,t.jsxs)(t.Fragment,{children:[b&&(0,t.jsx)("div",{onClick:()=>o(!1),style:{position:"fixed",inset:0,background:"rgba(0, 0, 0, 0.7)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",zIndex:999998}}),(0,t.jsxs)("div",{style:{position:"fixed",bottom:b?"auto":"80px",left:b?"50%":se?"20px":"auto",right:b||se?"auto":"20px",top:b?"50%":"auto",transform:b?"translate(-50%, -50%)":"none",width:b?"calc(100vw - 40px)":"390px",maxWidth:b?"1140px":"calc(100vw - 32px)",height:b?"calc(100vh - 40px)":"560px",maxHeight:b?"900px":"calc(100vh - 100px)",background:s?"#09090b":"#ffffff",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,borderRadius:"20px",boxShadow:b?"0 32px 64px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)":"0 24px 48px -12px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:999999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",transition:"all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"},children:[(0,t.jsx)("style",{children:`
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
            `}),(0,t.jsxs)("div",{style:{background:s?"#18181b":"#ffffff",color:s?"#ffffff":"#09090b",borderBottom:`1px solid ${s?"#27272a":"#e4e4e7"}`,padding:b?"16px 22px":"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",userSelect:"none",flexShrink:0},children:[(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"10px",minWidth:0},children:[(0,t.jsx)("div",{style:{color:s?"rgba(255,255,255,0.6)":"#71717a",display:"grid",placeItems:"center",flexShrink:0},children:(0,t.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,t.jsx)("circle",{cx:"12",cy:"12",r:"1"}),(0,t.jsx)("circle",{cx:"12",cy:"5",r:"1"}),(0,t.jsx)("circle",{cx:"12",cy:"19",r:"1"})]})}),(0,t.jsx)("div",{style:{width:"28px",height:"28px",borderRadius:"50%",background:s?"rgba(255,255,255,0.15)":l==="#18181b"?"rgba(24,24,27,0.08)":`${l}18`,display:"grid",placeItems:"center",flexShrink:0,color:s?"#ffffff":l==="#18181b"?"#09090b":l},children:(0,t.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,t.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,t.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),(0,t.jsx)("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]})}),(0,t.jsxs)("div",{style:{display:"flex",flexDirection:"column",minWidth:0},children:[(0,t.jsx)("div",{style:{fontSize:"13.5px",fontWeight:600,color:s?"#ffffff":"#09090b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},children:j}),(0,t.jsxs)("div",{style:{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"11px",color:s?"rgba(255,255,255,0.75)":"#71717a"},children:[(0,t.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:C?Z?"#f59e0b":"#22c55e":w==="connecting"?"#eab308":s?"rgba(255,255,255,0.4)":"#a1a1aa",animation:Z?"omnidesk-pulse-amber 1.5s infinite":"none"}}),(0,t.jsx)("span",{children:C?Z?"Thinking \xB7 Checking tools...":"Live \xB7 Speaking":w==="connecting"?"Connecting...":w==="error"?"Error":"Idle \xB7 Ready"})]})]})]}),(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[(0,t.jsx)("button",{type:"button",onClick:()=>o(!b),title:b?"Exit Fullscreen":"Open Full",style:{background:s?"rgba(255,255,255,0.1)":"#f4f4f5",border:s?"1px solid rgba(255,255,255,0.15)":"1px solid #e4e4e7",borderRadius:"7px",color:s?"#ffffff":"#52525b",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:h=>h.currentTarget.style.background=s?"rgba(255,255,255,0.2)":"#e4e4e7",onMouseLeave:h=>h.currentTarget.style.background=s?"rgba(255,255,255,0.1)":"#f4f4f5",children:b?(0,t.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,t.jsx)("polyline",{points:"4 14 10 14 10 20"}),(0,t.jsx)("polyline",{points:"20 10 14 10 14 4"}),(0,t.jsx)("line",{x1:"14",y1:"10",x2:"21",y2:"3"}),(0,t.jsx)("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]}):(0,t.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,t.jsx)("polyline",{points:"15 3 21 3 21 9"}),(0,t.jsx)("polyline",{points:"9 21 3 21 3 15"}),(0,t.jsx)("line",{x1:"21",y1:"3",x2:"14",y2:"10"}),(0,t.jsx)("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]})}),(0,t.jsx)("button",{type:"button",onClick:()=>{C&&ge(),ce(!1)},title:"Close Widget",style:{background:s?"rgba(255,255,255,0.1)":"#f4f4f5",border:s?"1px solid rgba(255,255,255,0.15)":"1px solid #e4e4e7",borderRadius:"7px",color:s?"#ffffff":"#52525b",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:h=>h.currentTarget.style.background=s?"rgba(255,255,255,0.2)":"#e4e4e7",onMouseLeave:h=>h.currentTarget.style.background=s?"rgba(255,255,255,0.1)":"#f4f4f5",children:(0,t.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,t.jsx)("line",{x1:"18",y1:"6",x2:"6",y2:"18"}),(0,t.jsx)("line",{x1:"6",y1:"6",x2:"18",y2:"18"})]})})]})]}),(0,t.jsxs)("div",{ref:A,style:{flex:1,minHeight:0,padding:"16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"12px",background:s?"#09090b":"#ffffff"},children:[Y.length===0&&(0,t.jsxs)("div",{style:{margin:"auto",textAlign:"center",padding:"10px 18px",background:s?"#18181b":"#f4f4f5",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,color:s?"#a1a1aa":"#52525b",borderRadius:"12px",fontSize:"12.5px",fontWeight:500,display:"inline-flex",alignItems:"center",gap:"8px",alignSelf:"center"},children:[(0,t.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:C?"#22c55e":w==="connecting"?"#eab308":"#a1a1aa",display:"inline-block"}}),(0,t.jsx)("span",{children:C?"Connected \xB7 Speak to our receptionist":w==="connecting"?"Connecting to receptionist...":"Start a call to talk to our receptionist"})]}),Y.map((h,$)=>{let R=h.who==="user";return(0,t.jsx)("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:R?"flex-end":"flex-start"},children:(0,t.jsxs)("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[!R&&(0,t.jsx)("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:(0,t.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,t.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,t.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),(0,t.jsx)("div",{style:{padding:"10px 14px",borderRadius:R?"14px 14px 2px 14px":"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:R?l:s?"#18181b":"#f4f4f5",color:R?"#ffffff":s?"#fafafa":"#09090b",border:!R&&s?"1px solid #27272a":"none",boxShadow:R?`0 2px 8px ${l}35`:"0 1px 2px rgba(0,0,0,0.04)"},children:h.text})]})},$)}),Z&&(0,t.jsx)("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:"flex-start"},children:(0,t.jsxs)("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[(0,t.jsx)("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:(0,t.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,t.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,t.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),(0,t.jsxs)("div",{style:{padding:"10px 14px",borderRadius:"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:s?"#18181b":"#f4f4f5",color:s?"#a1a1aa":"#71717a",border:s?"1px solid #27272a":"none",boxShadow:"0 1px 2px rgba(0,0,0,0.04)",display:"inline-flex",alignItems:"center",gap:"5px",minHeight:"38px"},title:"Agent is thinking and processing...",children:[(0,t.jsx)("span",{className:"omnidesk-motion-dot omnidesk-dot-1"}),(0,t.jsx)("span",{className:"omnidesk-motion-dot omnidesk-dot-2"}),(0,t.jsx)("span",{className:"omnidesk-motion-dot omnidesk-dot-3"})]})]})})]}),X&&C&&(0,t.jsxs)("div",{style:{padding:"11px 16px",background:"#f0fdf4",borderTop:"1px solid #bbf7d0",display:"flex",flexDirection:"column",gap:"7px",flexShrink:0},children:[(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"},children:[(0,t.jsxs)("span",{style:{fontSize:"11px",fontWeight:700,color:"#15803d",textTransform:"uppercase",letterSpacing:"0.04em",display:"inline-flex",alignItems:"center",gap:"6px"},children:[(0,t.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:"#22c55e",display:"inline-block"}}),"Email Requested by Agent"]}),(0,t.jsx)("button",{type:"button",onClick:()=>E(!1),style:{background:"none",border:"none",color:"#15803d",cursor:"pointer",fontSize:"12px",fontWeight:700,padding:"1px 4px"},children:"\u2715"})]}),(0,t.jsxs)("form",{onSubmit:ie,style:{display:"flex",gap:"6px"},children:[(0,t.jsx)("input",{type:"email",autoFocus:!0,value:U,onChange:h=>re(h.target.value),placeholder:"Enter your email (e.g. name@gmail.com)",required:!0,style:{flex:1,fontSize:"12.5px",padding:"7px 11px",borderRadius:"7px",border:"1px solid #86efac",background:"#ffffff",color:"#09090b",outline:"none"}}),(0,t.jsx)("button",{type:"submit",disabled:!U.trim(),style:{background:"#16a34a",color:"#ffffff",border:"none",padding:"7px 14px",borderRadius:"7px",fontSize:"12px",fontWeight:600,cursor:U.trim()?"pointer":"not-allowed",opacity:U.trim()?1:.6},children:"Send"})]})]}),(0,t.jsxs)("div",{style:{padding:"12px 16px",borderTop:`1px solid ${s?"#27272a":"#e4e4e7"}`,background:s?"#121214":"#fafafa",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0},children:[(0,t.jsxs)("button",{type:"button",onClick:C?ge:I,disabled:w==="connecting",style:{display:"inline-flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:C?"#dc2626":w==="connecting"?"#64748b":l,color:"#ffffff",borderRadius:"10px",border:"none",fontSize:"13px",fontWeight:600,boxShadow:C?"0 4px 14px rgba(220, 38, 38, 0.35)":`0 4px 14px ${l}40`,cursor:w==="connecting"?"not-allowed":"pointer",transition:"all 0.15s ease"},children:[(0,t.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,t.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,t.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),(0,t.jsx)("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]}),(0,t.jsx)("span",{children:C?"End Voice Call":w==="connecting"?"Connecting...":"Start Voice Call"})]}),(0,t.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[C&&(0,t.jsx)("div",{style:{display:"flex",alignItems:"center",gap:"2.5px",height:"14px"},children:[12,8,14,6,10].map((h,$)=>(0,t.jsx)("span",{style:{width:"2.5px",height:`${Math.max(4,Math.min(14,Math.round(h*(.35+Math.max(he,we)*1.5))))}px`,background:l,borderRadius:"1px",transition:"height 0.12s ease"}},$))}),(0,t.jsx)("span",{style:{fontFamily:"var(--mono, monospace)",fontSize:"12px",fontWeight:600,padding:"3px 8px",borderRadius:"6px",background:s?"#18181b":C?"#000000":"#f4f4f5",color:s||C?"#ffffff":"#71717a",border:s?"1px solid #27272a":"none"},children:ve})]})]})]})]})]})}var Me=Se;var Be={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function ke(u={}){if(typeof window>"u")return;let{host:a,businessId:y="biz_demo_dental",agentId:k,theme:S="light",position:K="bottom-right",label:L="Talk to Receptionist",accent:P="emerald",accentColor:T,businessName:r,greeting:W,onCallStart:H,onCallEnd:F,onTranscript:B}=u,g=T||Be[P]||P||"#10b981",ce=document.getElementById("omnidesk-voice-widget-root");ce&&ce.remove();let b=document.createElement("div");b.id="omnidesk-voice-widget-root",b.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let o=S==="dark"||S==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,w=null,O="idle",Y=0,Q=null,he=!1,pe=!1,we=0,xe=0,ve=!1,ee=!1,j=!1,ne=null,X=null,E=!1,U=K==="bottom-left",re=document.createElement("div");re.style.cssText=`
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
  `,re.appendChild(Z);let V=document.createElement("div");V.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,V.onclick=()=>C(!1);let c=document.createElement("div");c.style.cssText=`
    position: fixed; bottom: 80px; ${U?"left: 20px;":"right: 20px;"};
    width: 390px; max-width: calc(100vw - 32px); height: 560px; max-height: calc(100vh - 100px);
    background: ${o?"#09090b":"#ffffff"}; border: 1px solid ${o?"#27272a":"#e4e4e7"};
    border-radius: 20px; box-shadow: 0 24px 48px -12px rgba(0,0,0,0.22);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  `;let A=document.createElement("div");A.style.cssText=`
    background: ${o?"#18181b":"#ffffff"}; color: ${o?"#ffffff":"#09090b"};
    border-bottom: 1px solid ${o?"#27272a":"#e4e4e7"};
    padding: 13px 18px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; user-select: none; flex-shrink: 0;
  `,A.innerHTML=`
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
  `;let J=document.createElement("style");J.textContent=`
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
  `,b.appendChild(J);let v=document.createElement("div");v.style.cssText=`
    flex: 1; min-height: 0; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 12px; background: ${o?"#09090b":"#ffffff"};
  `;let G=document.createElement("div");G.id="omnidesk-placeholder-banner",G.style.cssText=`
    margin: auto; text-align: center; padding: 10px 18px;
    background: ${o?"#18181b":"#f4f4f5"}; border: 1px solid ${o?"#27272a":"#e4e4e7"}; color: ${o?"#a1a1aa":"#52525b"};
    border-radius: 12px; font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px; align-self: center;
  `,G.innerHTML=`
    <span id="omnidesk-placeholder-dot" style="width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block;"></span>
    <span>Start a call to talk to our receptionist</span>
  `,v.appendChild(G);let M=document.createElement("div");if(M.id="omnidesk-thinking-bubble",M.style.cssText=`
    display: none; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;
  `,M.innerHTML=`
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
  `,v.appendChild(M),W){G.style.display="none";let f=document.createElement("div");f.style.cssText="display: flex; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;";let i=document.createElement("div");i.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let e=document.createElement("div");e.style.cssText="width: 24px; height: 24px; border-radius: 50%; background: #18181b; display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;",e.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let m=document.createElement("div");m.style.cssText=`padding: 10px 14px; border-radius: 14px 14px 14px 2px; font-size: 13px; line-height: 1.45; background: ${o?"#18181b":"#f4f4f5"}; color: ${o?"#fafafa":"#09090b"}; border: ${o?"1px solid #27272a":"none"}; box-shadow: 0 1px 2px rgba(0,0,0,0.04);`,m.innerText=W,i.appendChild(e),i.appendChild(m),f.appendChild(i),v.insertBefore(f,M),ne="agent",X=m,E=!0}let x=document.createElement("div");x.id="omnidesk-email-bar",x.style.cssText=`
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
  `;let z=document.createElement("div");z.style.cssText=`
    padding: 12px 16px; border-top: 1px solid ${o?"#27272a":"#e4e4e7"};
    background: ${o?"#121214":"#fafafa"}; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  `;let l=document.createElement("button");l.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: ${g}; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    box-shadow: 0 4px 14px ${g}40;
    cursor: pointer; transition: all 0.15s ease;
  `,l.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let s=document.createElement("div");s.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let _=document.createElement("div");_.id="omnidesk-waveform",_.style.cssText="display: none; align-items: center; gap: 2.5px; height: 14px;";let ue=[12,8,14,6,10],N=[];ue.forEach(f=>{let i=document.createElement("span");i.style.cssText=`width: 2.5px; height: ${Math.round(f*.35)}px; background: ${g}; border-radius: 1px; transition: height 0.12s ease;`,_.appendChild(i),N.push(i)}),s.appendChild(_);let I=document.createElement("span");I.id="omnidesk-timer",I.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,I.innerText="0:00",s.appendChild(I),z.appendChild(l),z.appendChild(s),c.appendChild(A),c.appendChild(v),c.appendChild(x),c.appendChild(z),b.appendChild(re),b.appendChild(V),b.appendChild(c),document.body.appendChild(b);function ge(){Y=Date.now(),I.innerText="0:00",I.style.background=o?"#18181b":"#000000",I.style.color="#ffffff",I.style.border=o?"1px solid #27272a":"none",Q&&clearInterval(Q),Q=setInterval(()=>{let f=Date.now()-Y,i=Math.floor(f/1e3),e=Math.floor(i/60),m=i%60;I.innerText=`${e}:${String(m).padStart(2,"0")}`},250)}function ie(){Q&&(clearInterval(Q),Q=null),I.style.background="#f4f4f5",I.style.color="#71717a",I.style.border="none",I.innerText="0:00",_.style.display="none"}function se(f){he=f,c.style.display=f?"flex":"none"}function C(f){pe=f,V.style.display=f?"block":"none",f?(c.style.top="50%",c.style.left="50%",c.style.bottom="auto",c.style.right="auto",c.style.transform="translate(-50%, -50%)",c.style.width="calc(100vw - 40px)",c.style.maxWidth="1140px",c.style.height="calc(100vh - 40px)",c.style.maxHeight="900px"):(c.style.top="auto",c.style.left=U?"20px":"auto",c.style.right=U?"auto":"20px",c.style.bottom="80px",c.style.transform="none",c.style.width="390px",c.style.maxWidth="calc(100vw - 32px)",c.style.height="560px",c.style.maxHeight="calc(100vh - 100px)")}Z.onclick=()=>se(!he),A.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{se(!1),C(!1)}),A.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{C(!pe)});let h=x.querySelector("#omnidesk-email-form"),$=x.querySelector("#omnidesk-email-input");x.querySelector("#omnidesk-email-close-btn").addEventListener("click",()=>{x.style.display="none"}),h.addEventListener("submit",f=>{f.preventDefault();let i=$.value.trim();if(!i||!i.includes("@"))return;w&&w.sendEmailInput(i),j=!0,x.style.display="none",$.value="",G.style.display="none";let e=document.createElement("div");e.style.cssText=`
      display: flex; flex-direction: column; gap: 4px; max-width: 88%;
      align-self: flex-end;
    `;let m=document.createElement("div");m.style.cssText=`
      padding: 10px 14px; border-radius: 14px 14px 2px 14px;
      font-size: 13px; line-height: 1.45;
      background: ${g}; color: #ffffff;
      box-shadow: 0 2px 8px ${g}35;
    `,m.innerText=`My email is ${i}`,e.appendChild(m),v.insertBefore(e,M),M.style.display="flex",v.scrollTop=v.scrollHeight,ne="user",X=m,E=!0});async function q(){ve=!1,ee=!1,j=!1,x.style.display="none",M.style.display="none",ne=null,X=null,E=!1;let f=A.querySelector("#omnidesk-status-text"),i=A.querySelector("#omnidesk-status-dot"),e=l.querySelector("#omnidesk-btn-text");f.innerText="Connecting...",i.style.background="#eab308",e.innerText="Connecting...",l.style.background="#64748b",l.style.boxShadow="none",l.disabled=!0,ge();try{let m=a;if(!m&&typeof document<"u"){let d=document.querySelector("script[src*='widget.js']");if(d&&d.src&&d.src.startsWith("http"))try{m=new URL(d.src).origin}catch{}}!m&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(m=window.location.origin);let le=(m||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),ye=await fetch(`${le}/api/token?businessId=${encodeURIComponent(y)}`);if(!ye.ok)throw new Error(`Failed to get session token (${ye.status})`);let fe=await ye.json();if(fe.business_name&&!r){let d=A.querySelector("#omnidesk-biz-title");d&&(d.innerText=fe.business_name)}let Ee=k||fe.agent_id||"";w=new te({onStatusChange:d=>{if(O=d,d==="connected")f.innerText="Live \xB7 Speaking",i.style.background="#22c55e",e.innerText="End Voice Call",l.style.background="#dc2626",l.style.boxShadow="0 4px 14px rgba(220, 38, 38, 0.35)",l.disabled=!1,_.style.display="flex",Y=Date.now(),H?.();else if(d==="idle"&&(f.innerText="Idle \xB7 Ready",i.style.background=o?"rgba(255,255,255,0.4)":"#a1a1aa",e.innerText="Start Voice Call",l.style.background=g,l.style.boxShadow=`0 4px 14px ${g}40`,l.disabled=!1,_.style.display="none",x.style.display="none",M.style.display="none",ie(),Y>0)){let n=Math.round((Date.now()-Y)/1e3);Y=0,F?.(n)}},onThinkingChange:d=>{d&&(M.style.display="flex",v.scrollTop=v.scrollHeight)},onTranscript:d=>{if(G.style.display="none",d.who==="user"){d.isFinal&&(M.style.display="flex");let n=d.text.toLowerCase();(n==="no"||n.startsWith("no ")||n.includes("no,")||n.includes("wrong")||n.includes("incorrect")||n.includes("change my email")||n.includes("different email"))&&(j=!1),(d.text.includes("@")||n.includes(" at ")&&n.includes(" dot ")||n.includes("gmail.com")||n.includes("yahoo.com")||n.includes("outlook.com")||n.includes("hotmail.com")||n.includes("icloud.com"))&&(x.style.display="none",j=!0)}else if(d.who==="agent"){d.text&&d.text.trim().length>0&&(M.style.display="none");let n=d.text.toLowerCase();if(n.includes("confirmation code is")||n.includes("booking is confirmed")||n.includes("scheduled your appointment")||n.includes("all set, your appointment")||n.includes("sent your confirmation")&&(n.includes("code")||n.includes("calendar invite"))||n.includes("sent a calendar invite")&&(n.includes("code")||n.includes("all set"))){ee=!0,j=!1,x.style.display="none";return}if(ee){x.style.display="none";return}if(n.includes("confirm with yes or no")||n.includes("yes or no")||n.includes("is that correct")||n.includes("is that right")){j=!0,x.style.display="none";return}n.includes("what is your email")||n.includes("what's your email")||n.includes("whats your email")||n.includes("may i have your email")||n.includes("can i have your email")||n.includes("could i have your email")||n.includes("could i get your email")||n.includes("could you provide your email")||n.includes("can you provide your email")||n.includes("provide your email")||n.includes("enter your email")||n.includes("spell your email")||n.includes("share your email")||n.includes("need your email")||n.includes("what email")||n.includes("which email")||n.includes("where can i send your confirmation")||n.includes("where should i send your confirmation")||n.includes("where can i send your calendar")||n.includes("where should i send your calendar")||n.includes("email")&&(n.includes("what is")||n.includes("what's")||n.includes("whats")||n.includes("may i have")||n.includes("can i have")||n.includes("could i have")||n.includes("may i get")||n.includes("could i get")||n.includes("can you provide")||n.includes("could you provide")||n.includes("provide")||n.includes("give me")||n.includes("tell me")||n.includes("share")||n.includes("best email")||n.includes("your email")||n.includes("send your calendar invite")||n.includes("send your confirmation")||n.includes("send a calendar invite")||n.includes("send the calendar invite")||n.includes("send the confirmation")||n.includes("send a confirmation")||n.includes("so i can send")||n.includes("to send your"))?(j=!1,x.style.display="flex",setTimeout(()=>$.focus(),60)):d.isFinal&&!ee&&!j&&(x.style.display="none")}if(ne===d.who&&X&&!E)X.innerText=d.text,E=!!d.isFinal;else{let n=d.who==="user",oe=document.createElement("div");if(oe.style.cssText=`
              display: flex; flex-direction: column; gap: 4px; max-width: 88%;
              align-self: ${n?"flex-end":"flex-start"};
            `,n){let D=document.createElement("div");D.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 2px 14px;
                font-size: 13px; line-height: 1.45;
                background: ${g};
                color: #ffffff;
                box-shadow: 0 2px 8px ${g}35;
              `,D.innerText=d.text,oe.appendChild(D),X=D}else{let D=document.createElement("div");D.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let ae=document.createElement("div");ae.style.cssText=`
                width: 24px; height: 24px; border-radius: 50%; background: #18181b;
                display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;
              `,ae.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let de=document.createElement("div");de.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 14px 2px;
                font-size: 13px; line-height: 1.45;
                background: ${o?"#18181b":"#f4f4f5"};
                color: ${o?"#fafafa":"#09090b"};
                border: ${o?"1px solid #27272a":"none"};
                box-shadow: 0 1px 2px rgba(0,0,0,0.04);
              `,de.innerText=d.text,D.appendChild(ae),D.appendChild(de),oe.appendChild(D),X=de}v.insertBefore(oe,M),ne=d.who,E=!!d.isFinal}v.scrollTop=v.scrollHeight,B?.(d)},onAudioLevel:(d,n)=>{if(we=d,xe=n,O==="connected"){_.style.display="flex";let oe=Math.max(d,n);ue.forEach((D,ae)=>{let de=Math.max(4,Math.min(14,Math.round(D*(.35+oe*1.5))));N[ae]&&(N[ae].style.height=`${de}px`)})}},onError:()=>{f.innerText="Error",i.style.background="#ef4444",e.innerText="Start Voice Call",l.style.background=g,l.style.boxShadow=`0 4px 14px ${g}40`,l.disabled=!1,_.style.display="none",x.style.display="none",M.style.display="none",ie()}}),await w.start(fe.token,Ee,fe.voice)}catch(m){console.error("[OmniDesk Voice Widget Error]:",m),f.innerText="Error",i.style.background="#ef4444",e.innerText="Start Voice Call",l.style.background=g,l.style.boxShadow=`0 4px 14px ${g}40`,l.disabled=!1,_.style.display="none",x.style.display="none",M.style.display="none",ie()}}function me(){w&&(w.stop(),w=null),O="idle";let f=A.querySelector("#omnidesk-status-text"),i=A.querySelector("#omnidesk-status-dot"),e=l.querySelector("#omnidesk-btn-text");f&&(f.innerText="Idle \xB7 Ready"),i&&(i.style.background=o?"rgba(255,255,255,0.4)":"#a1a1aa"),e&&(e.innerText="Start Voice Call"),l.style.background=g,l.style.boxShadow=`0 4px 14px ${g}40`,l.disabled=!1,_.style.display="none",x.style.display="none",M.style.display="none",ee=!1,j=!1,ie()}return l.onclick=()=>{O==="connected"?me():O==="idle"&&q()},{destroy:()=>{ie(),w&&w.stop(),b.remove()},startCall:q,endCall:me}}if(typeof document<"u"){let u=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(u){let a,y=u.src||"";if(y&&y.startsWith("http"))try{a=new URL(y).origin}catch{}let k=u.getAttribute("data-business-id")||void 0,S=u.getAttribute("data-agent")||void 0,K=u.getAttribute("data-theme")||"dark",L=u.getAttribute("data-accent")||"emerald",P=u.getAttribute("data-position")||"bottom-right",T=u.getAttribute("data-label")||void 0,r=u.getAttribute("data-host")||a||"https://omni-desk-rho.vercel.app",W=u.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{ke({businessId:k,agentId:S,theme:K,accent:L,position:P,label:T,host:r,greeting:W})}):ke({businessId:k,agentId:S,theme:K,accent:L,position:P,label:T,host:r,greeting:W})}}0&&(module.exports={AssemblyAIVoiceClient,OmniDeskWidget,VoiceWidget,initOmniDeskWidget});
//# sourceMappingURL=index.js.map