"use strict";var Ce=Object.defineProperty;var Le=Object.getOwnPropertyDescriptor;var $e=Object.getOwnPropertyNames;var _e=Object.prototype.hasOwnProperty;var Ie=(f,a)=>{for(var y in a)Ce(f,y,{get:a[y],enumerable:!0})},Ae=(f,a,y,k)=>{if(a&&typeof a=="object"||typeof a=="function")for(let L of $e(a))!_e.call(f,L)&&L!==y&&Ce(f,L,{get:()=>a[L],enumerable:!(k=Le(a,L))||k.enumerable});return f};var Re=f=>Ae(Ce({},"__esModule",{value:!0}),f);var Be={};Ie(Be,{AssemblyAIVoiceClient:()=>ie,OmniDeskWidget:()=>Se,VoiceWidget:()=>Ee,initOmniDeskWidget:()=>ke});module.exports=Re(Be);var p=require("react");var be=24e3,We="wss://agents.us.assemblyai.com/v1/ws",Fe=`
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
`;async function Te(f,a,y){let k=URL.createObjectURL(new Blob([a],{type:"application/javascript"}));try{await f.audioWorklet.addModule(k)}finally{URL.revokeObjectURL(k)}return new AudioWorkletNode(f,y)}var ie=class{constructor(a){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.isThinking=!1;this.callbacks=a}setThinking(a){this.isThinking!==a&&(this.isThinking=a,this.callbacks.onThinkingChange?.(a))}async start(a,y,k,L){try{this.callbacks.onStatusChange?.("connecting");let j=window.AudioContext||window.webkitAudioContext;this.captureCtx=new j({sampleRate:be}),this.playbackCtx=new j({sampleRate:be}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await Te(this.playbackCtx,ze,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0}}),this.captureNode=await Te(this.captureCtx,Fe,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let Y=L&&L.trim()||We,B=new URL(Y);B.searchParams.set("token",a),this.ws=new WebSocket(B.toString()),this.captureNode.port.onmessage=({data:E})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let r=new Uint8Array(E),z="";for(let F=0;F<r.length;F+=32768)z+=String.fromCharCode.apply(null,Array.from(r.subarray(F,F+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(z)}));let H=new Int16Array(E),u=0;for(let F=0;F<H.length;F+=16)u+=Math.abs(H[F]);this.userLevel=Math.min(1,u/(H.length/16)/8e3)},this.ws.onopen=()=>{let E={};y&&y.trim()?E.agent_id=y.trim():k&&k.trim()&&(E.output={voice:k.trim()}),Object.keys(E).length>0&&this.ws?.send(JSON.stringify({type:"session.update",session:E}))};let $="",J="";this.ws.onmessage=({data:E})=>{try{let r=JSON.parse(E);switch(r.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0,J="",this.setThinking(!1);break;case"transcript.user.delta":r.text&&(J=r.text,this.callbacks.onTranscript?.({who:"user",text:r.text,isFinal:!1}));break;case"transcript.user":r.text&&(J=r.text,this.callbacks.onTranscript?.({who:"user",text:r.text,isFinal:!0}),this.setThinking(!0));break;case"reply.started":$="";break;case"transcript.agent.delta":r.delta&&(this.setThinking(!1),$&&!$.endsWith(" ")&&!/^[.,!?;:%)]/.test(r.delta)?$+=" "+r.delta:$+=r.delta,this.callbacks.onTranscript?.({who:"agent",text:$,isFinal:!1}));break;case"transcript.agent":r.text&&(this.setThinking(!1),$=r.text,this.callbacks.onTranscript?.({who:"agent",text:r.text,isFinal:!0}));break;case"reply.audio":if(r.data&&this.playbackNode){let z=atob(r.data),H=new Uint8Array(z.length);for(let u=0;u<z.length;u++)H[u]=z.charCodeAt(u);this.playbackNode.port.postMessage(H.buffer,[H.buffer]),this.agentLevel=.8}break;case"reply.done":r.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:r.name||r.tool,args:r.arguments||r.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:r.name||r.tool,result:r.result});break;case"reply.error":this.setThinking(!1),this.callbacks.onError?.(r.message||r.code||"Reply generation error");break;case"error":case"session.error":this.setThinking(!1),this.callbacks.onError?.(r.message||r.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.setThinking(!1),this.stop();break}}catch(r){console.warn("Message parsing error:",r)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(j){this.callbacks.onError?.(j.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(a){this.isMuted=a,a&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(a,y){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:a})),y&&this.ws.send(JSON.stringify({type:"reply.create",instructions:y})),!0}catch(k){return console.error("Failed to send message to agent:",k),!1}}sendEmailInput(a){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:`My email is ${a}`})),this.ws.send(JSON.stringify({type:"reply.create",instructions:`The caller has entered and verified their email address: ${a}. Do not ask for their email again. Immediately speak: "I have verified your email as ${a}. Can you please confirm with yes or no?" Then stop speaking and wait for their yes or no answer.`})),!0}catch(y){return console.error("Failed to send email to agent:",y),!1}}stop(){if(this.setThinking(!1),this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(a=>a.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let a=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(a)};this.animFrameId=requestAnimationFrame(a)}};var i=require("react/jsx-runtime"),Ne={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function Se({host:f="",businessId:a="biz_demo_dental",agentId:y,theme:k="light",position:L="bottom-right",label:j="Talk to Receptionist",accent:Y="emerald",accentColor:B,businessName:$,greeting:J,className:E,onCallStart:r,onCallEnd:z,onTranscript:H}){let[u,F]=(0,p.useState)(!1),[b,o]=(0,p.useState)(!1),[w,U]=(0,p.useState)("idle"),[Z,X]=(0,p.useState)([]),[he,ue]=(0,p.useState)(0),[we,xe]=(0,p.useState)(0),[ve,ne]=(0,p.useState)("0:00"),[D,se]=(0,p.useState)($||"OmniDesk Hair Salon & Studio"),[ee,C]=(0,p.useState)(!1),[q,de]=(0,p.useState)(""),[G,V]=(0,p.useState)(!1),c=(0,p.useRef)(null),_=(0,p.useRef)(null),K=(0,p.useRef)(0),v=(0,p.useRef)(null),Q=(0,p.useRef)(0),T=(0,p.useRef)(!1),x=(0,p.useRef)(!1),I=(0,p.useRef)(!1),l=(0,p.useMemo)(()=>B||Ne[Y]||Y||"#10b981",[Y,B]),s=(0,p.useMemo)(()=>k==="dark"?!0:k==="auto"&&typeof window<"u"?window.matchMedia("(prefers-color-scheme: dark)").matches:!1,[k]);(0,p.useEffect)(()=>{_.current&&(_.current.scrollTop=_.current.scrollHeight)},[Z,G]);let A=(0,p.useMemo)(()=>f?f.replace(/\/$/,""):typeof window<"u"&&window.location.origin?window.location.origin:"",[f]),fe=(0,p.useCallback)(()=>{Q.current=Date.now(),ne("0:00"),v.current&&clearInterval(v.current),v.current=setInterval(()=>{let g=Date.now()-Q.current,M=Math.floor(g/1e3),W=Math.floor(M/60),O=M%60;ne(`${W}:${String(O).padStart(2,"0")}`)},250)},[]),N=(0,p.useCallback)(()=>{v.current&&(clearInterval(v.current),v.current=null)},[]),R=(0,p.useCallback)(async()=>{try{U("connecting"),T.current=!1,x.current=!1,I.current=!1,C(!1),fe();let M=`${A?A.replace(/\/$/,""):""}/api/token?businessId=${encodeURIComponent(a)}`,W=await fetch(M);if(!W.ok)throw new Error("Failed to initialize voice session");let O=await W.json();if(O.business_name&&!$&&se(O.business_name),!O.token)throw new Error("Invalid session token payload received from host");let me=y||O.agent_id||"",h=new ie({onStatusChange:n=>{if(U(n),n==="connected")K.current=Date.now(),r?.();else if(n==="idle"){if(V(!1),N(),K.current>0){let e=Math.round((Date.now()-K.current)/1e3);K.current=0,z?.(e)}}else n==="error"&&(V(!1),N())},onThinkingChange:n=>{n&&V(!0)},onTranscript:n=>{if(n.who==="user"?V(!0):n.who==="agent"&&n.text&&n.text.trim().length>0&&V(!1),X(e=>{let m=e[e.length-1];if(m&&m.who===n.who&&!m.isFinal){let re=[...e];return re[re.length-1]={...m,text:n.text,isFinal:n.isFinal??!1},re}return[...e,{id:n.id||`${Date.now()}-${Math.random()}`,who:n.who,text:n.text,isFinal:n.isFinal??!1}]}),H?.(n),n.who==="user"){let e=n.text.toLowerCase().trim();(e==="no"||e.startsWith("no ")||e.includes("no,")||e.includes("wrong")||e.includes("incorrect")||e.includes("change my email")||e.includes("different email")||e.includes("that's not right")||e.includes("thats not right")||e.includes("not right")||e.includes("not my email"))&&(I.current=!1,C(!0)),(e==="yes"||e.startsWith("yes ")||e.includes("yes,")||e==="yeah"||e.startsWith("yeah ")||e==="yep"||e==="correct"||e.includes("that's right")||e.includes("thats right")||e.includes("sounds good")||e==="confirm"||e==="sure")&&I.current&&(I.current=!1,C(!1)),(n.text.includes("@")||e.includes(" at ")&&e.includes(" dot ")||e.includes("gmail.com")||e.includes("yahoo.com")||e.includes("outlook.com")||e.includes("hotmail.com")||e.includes("icloud.com"))&&(C(!1),I.current=!0)}else if(n.who==="agent"){let e=n.text.toLowerCase();if(e.includes("confirmation code is")||e.includes("booking is confirmed")||e.includes("scheduled your appointment")||e.includes("all set, your appointment")||e.includes("sent your confirmation")&&(e.includes("code")||e.includes("calendar invite"))||e.includes("sent a calendar invite")&&(e.includes("code")||e.includes("all set"))){x.current=!0,I.current=!1,C(!1);return}if(x.current){C(!1);return}if(e.includes("confirm with yes or no")||e.includes("yes or no")||e.includes("is that correct")||e.includes("is that right")||e.includes("verified your email")||e.includes("checking that email")||e.includes("let me check that email")){I.current=!0,C(!1);return}!I.current&&(e.includes("what is your email")||e.includes("what's your email")||e.includes("whats your email")||e.includes("may i have your email")||e.includes("can i have your email")||e.includes("could i have your email")||e.includes("could i get your email")||e.includes("could you provide your email")||e.includes("can you provide your email")||e.includes("provide your email")||e.includes("enter your email")||e.includes("share your email")||e.includes("need your email")||e.includes("what is your correct email")||e.includes("provide your correct email")||e.includes("where can i send your confirmation")||e.includes("where should i send your confirmation")||e.includes("where can i send your calendar")||e.includes("where should i send your calendar")||e.includes("email address")&&(e.includes("what is")||e.includes("what's")||e.includes("whats")||e.includes("may i have")||e.includes("can i have")||e.includes("could i have")||e.includes("could you provide")||e.includes("can you provide")||e.includes("provide")||e.includes("share")||e.includes("so i can send")||e.includes("to send your")))?C(!0):n.isFinal&&C(!1)}},onAudioLevel:(n,e)=>{ue(n),xe(e)},onError:()=>{U("error"),N()}});c.current=h,await h.start(O.token,me,O.voice,O.ws_url)}catch{U("error"),N()}},[A,a,y,$,r,z,H,fe,N]),ge=(0,p.useCallback)(()=>{if(c.current&&(c.current.stop(),c.current=null),U("idle"),V(!1),ue(0),xe(0),N(),x.current=!1,I.current=!1,C(!1),K.current>0){let g=Math.round((Date.now()-K.current)/1e3);K.current=0,z?.(g)}},[z,N]),oe=(0,p.useCallback)(g=>{g.preventDefault();let M=q.trim();M&&(X(W=>[...W,{who:"user",text:`My email is ${M}`,isFinal:!0}]),c.current&&c.current.sendEmailInput(M),V(!0),I.current=!0,de(""),C(!1))},[q]);(0,p.useEffect)(()=>()=>{N(),c.current&&c.current.stop()},[N]);let ae=L==="bottom-left",S=w==="connected";return(0,i.jsxs)("div",{className:E,style:{position:"relative",zIndex:99999},children:[(0,i.jsx)("div",{style:{position:"fixed",bottom:"20px",left:ae?"20px":"auto",right:ae?"auto":"20px",zIndex:99999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:(0,i.jsxs)("button",{type:"button",onClick:()=>F(!u),style:{display:"inline-flex",alignItems:"center",gap:"10px",background:s?"#18181b":"#ffffff",color:s?"#fafafa":"#09090b",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,padding:"10px 18px",borderRadius:"9999px",cursor:"pointer",fontSize:"13px",fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.18)",transition:"transform 0.15s ease, background 0.15s ease"},onMouseEnter:g=>{g.currentTarget.style.transform="scale(1.02)"},onMouseLeave:g=>{g.currentTarget.style.transform="scale(1)"},children:[(0,i.jsx)("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:S?"#ef4444":l,boxShadow:`0 0 8px ${S?"#ef4444":l}`}}),(0,i.jsx)("span",{children:j}),(0,i.jsx)("span",{style:{fontSize:"11px",opacity:.6},children:"\u25B2"})]})}),u&&(0,i.jsxs)(i.Fragment,{children:[b&&(0,i.jsx)("div",{onClick:()=>o(!1),style:{position:"fixed",inset:0,background:"rgba(0, 0, 0, 0.7)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",zIndex:999998}}),(0,i.jsxs)("div",{style:{position:"fixed",bottom:b?"auto":"80px",left:b?"50%":ae?"20px":"auto",right:b||ae?"auto":"20px",top:b?"50%":"auto",transform:b?"translate(-50%, -50%)":"none",width:b?"calc(100vw - 40px)":"390px",maxWidth:b?"1140px":"calc(100vw - 32px)",height:b?"calc(100vh - 40px)":"560px",maxHeight:b?"900px":"calc(100vh - 100px)",background:s?"#09090b":"#ffffff",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,borderRadius:"20px",boxShadow:b?"0 32px 64px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)":"0 24px 48px -12px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:999999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",transition:"all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"},children:[(0,i.jsx)("style",{children:`
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
            `}),(0,i.jsxs)("div",{style:{background:s?"#18181b":"#ffffff",color:s?"#ffffff":"#09090b",borderBottom:`1px solid ${s?"#27272a":"#e4e4e7"}`,padding:b?"16px 22px":"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",userSelect:"none",flexShrink:0},children:[(0,i.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"10px",minWidth:0},children:[(0,i.jsx)("div",{style:{color:s?"rgba(255,255,255,0.6)":"#71717a",display:"grid",placeItems:"center",flexShrink:0},children:(0,i.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,i.jsx)("circle",{cx:"12",cy:"12",r:"1"}),(0,i.jsx)("circle",{cx:"12",cy:"5",r:"1"}),(0,i.jsx)("circle",{cx:"12",cy:"19",r:"1"})]})}),(0,i.jsx)("div",{style:{width:"28px",height:"28px",borderRadius:"50%",background:s?"rgba(255,255,255,0.15)":l==="#18181b"?"rgba(24,24,27,0.08)":`${l}18`,display:"grid",placeItems:"center",flexShrink:0,color:s?"#ffffff":l==="#18181b"?"#09090b":l},children:(0,i.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,i.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,i.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),(0,i.jsx)("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]})}),(0,i.jsxs)("div",{style:{display:"flex",flexDirection:"column",minWidth:0},children:[(0,i.jsx)("div",{style:{fontSize:"13.5px",fontWeight:600,color:s?"#ffffff":"#09090b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},children:D}),(0,i.jsxs)("div",{style:{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"11px",color:s?"rgba(255,255,255,0.75)":"#71717a"},children:[(0,i.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:S?G?"#f59e0b":"#22c55e":w==="connecting"?"#eab308":s?"rgba(255,255,255,0.4)":"#a1a1aa",animation:G?"omnidesk-pulse-amber 1.5s infinite":"none"}}),(0,i.jsx)("span",{children:S?G?"Thinking \xB7 Checking tools...":"Live \xB7 Speaking":w==="connecting"?"Connecting...":w==="error"?"Error":"Idle \xB7 Ready"})]})]})]}),(0,i.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[(0,i.jsx)("button",{type:"button",onClick:()=>o(!b),title:b?"Exit Fullscreen":"Open Full",style:{background:s?"rgba(255,255,255,0.1)":"#f4f4f5",border:s?"1px solid rgba(255,255,255,0.15)":"1px solid #e4e4e7",borderRadius:"7px",color:s?"#ffffff":"#52525b",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:g=>g.currentTarget.style.background=s?"rgba(255,255,255,0.2)":"#e4e4e7",onMouseLeave:g=>g.currentTarget.style.background=s?"rgba(255,255,255,0.1)":"#f4f4f5",children:b?(0,i.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,i.jsx)("polyline",{points:"4 14 10 14 10 20"}),(0,i.jsx)("polyline",{points:"20 10 14 10 14 4"}),(0,i.jsx)("line",{x1:"14",y1:"10",x2:"21",y2:"3"}),(0,i.jsx)("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]}):(0,i.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,i.jsx)("polyline",{points:"15 3 21 3 21 9"}),(0,i.jsx)("polyline",{points:"9 21 3 21 3 15"}),(0,i.jsx)("line",{x1:"21",y1:"3",x2:"14",y2:"10"}),(0,i.jsx)("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]})}),(0,i.jsx)("button",{type:"button",onClick:()=>{S&&ge(),F(!1)},title:"Close Widget",style:{background:s?"rgba(255,255,255,0.1)":"#f4f4f5",border:s?"1px solid rgba(255,255,255,0.15)":"1px solid #e4e4e7",borderRadius:"7px",color:s?"#ffffff":"#52525b",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:g=>g.currentTarget.style.background=s?"rgba(255,255,255,0.2)":"#e4e4e7",onMouseLeave:g=>g.currentTarget.style.background=s?"rgba(255,255,255,0.1)":"#f4f4f5",children:(0,i.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,i.jsx)("line",{x1:"18",y1:"6",x2:"6",y2:"18"}),(0,i.jsx)("line",{x1:"6",y1:"6",x2:"18",y2:"18"})]})})]})]}),(0,i.jsxs)("div",{ref:_,style:{flex:1,minHeight:0,padding:"16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"12px",background:s?"#09090b":"#ffffff"},children:[Z.length===0&&(0,i.jsxs)("div",{style:{margin:"auto",textAlign:"center",padding:"10px 18px",background:s?"#18181b":"#f4f4f5",border:`1px solid ${s?"#27272a":"#e4e4e7"}`,color:s?"#a1a1aa":"#52525b",borderRadius:"12px",fontSize:"12.5px",fontWeight:500,display:"inline-flex",alignItems:"center",gap:"8px",alignSelf:"center"},children:[(0,i.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:S?"#22c55e":w==="connecting"?"#eab308":"#a1a1aa",display:"inline-block"}}),(0,i.jsx)("span",{children:S?"Connected \xB7 Speak to our receptionist":w==="connecting"?"Connecting to receptionist...":"Start a call to talk to our receptionist"})]}),Z.map((g,M)=>{let W=g.who==="user";return(0,i.jsx)("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:W?"flex-end":"flex-start"},children:(0,i.jsxs)("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[!W&&(0,i.jsx)("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:(0,i.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,i.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,i.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),(0,i.jsx)("div",{style:{padding:"10px 14px",borderRadius:W?"14px 14px 2px 14px":"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:W?l:s?"#18181b":"#f4f4f5",color:W?"#ffffff":s?"#fafafa":"#09090b",border:!W&&s?"1px solid #27272a":"none",boxShadow:W?`0 2px 8px ${l}35`:"0 1px 2px rgba(0,0,0,0.04)"},children:g.text})]})},M)}),G&&(0,i.jsx)("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:"flex-start"},children:(0,i.jsxs)("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[(0,i.jsx)("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:(0,i.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,i.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,i.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),(0,i.jsxs)("div",{style:{padding:"10px 14px",borderRadius:"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:s?"#18181b":"#f4f4f5",color:s?"#a1a1aa":"#71717a",border:s?"1px solid #27272a":"none",boxShadow:"0 1px 2px rgba(0,0,0,0.04)",display:"inline-flex",alignItems:"center",gap:"5px",minHeight:"38px"},title:"Agent is thinking and processing...",children:[(0,i.jsx)("span",{className:"omnidesk-motion-dot omnidesk-dot-1"}),(0,i.jsx)("span",{className:"omnidesk-motion-dot omnidesk-dot-2"}),(0,i.jsx)("span",{className:"omnidesk-motion-dot omnidesk-dot-3"})]})]})})]}),ee&&S&&(0,i.jsxs)("div",{style:{padding:"11px 16px",background:"#f0fdf4",borderTop:"1px solid #bbf7d0",display:"flex",flexDirection:"column",gap:"7px",flexShrink:0},children:[(0,i.jsxs)("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"},children:[(0,i.jsxs)("span",{style:{fontSize:"11px",fontWeight:700,color:"#15803d",textTransform:"uppercase",letterSpacing:"0.04em",display:"inline-flex",alignItems:"center",gap:"6px"},children:[(0,i.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:"#22c55e",display:"inline-block"}}),"Email Requested by Agent"]}),(0,i.jsx)("button",{type:"button",onClick:()=>C(!1),style:{background:"none",border:"none",color:"#15803d",cursor:"pointer",fontSize:"12px",fontWeight:700,padding:"1px 4px"},children:"\u2715"})]}),(0,i.jsxs)("form",{onSubmit:oe,style:{display:"flex",gap:"6px"},children:[(0,i.jsx)("input",{type:"email",autoFocus:!0,value:q,onChange:g=>de(g.target.value),placeholder:"Enter your email (e.g. name@gmail.com)",required:!0,style:{flex:1,fontSize:"12.5px",padding:"7px 11px",borderRadius:"7px",border:"1px solid #86efac",background:"#ffffff",color:"#09090b",outline:"none"}}),(0,i.jsx)("button",{type:"submit",disabled:!q.trim(),style:{background:"#16a34a",color:"#ffffff",border:"none",padding:"7px 14px",borderRadius:"7px",fontSize:"12px",fontWeight:600,cursor:q.trim()?"pointer":"not-allowed",opacity:q.trim()?1:.6},children:"Send"})]})]}),(0,i.jsxs)("div",{style:{padding:"12px 16px",borderTop:`1px solid ${s?"#27272a":"#e4e4e7"}`,background:s?"#121214":"#fafafa",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0},children:[(0,i.jsxs)("button",{type:"button",onClick:S?ge:R,disabled:w==="connecting",style:{display:"inline-flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:S?"#dc2626":w==="connecting"?"#64748b":l,color:"#ffffff",borderRadius:"10px",border:"none",fontSize:"13px",fontWeight:600,boxShadow:S?"0 4px 14px rgba(220, 38, 38, 0.35)":`0 4px 14px ${l}40`,cursor:w==="connecting"?"not-allowed":"pointer",transition:"all 0.15s ease"},children:[(0,i.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,i.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,i.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),(0,i.jsx)("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]}),(0,i.jsx)("span",{children:S?"End Voice Call":w==="connecting"?"Connecting...":"Start Voice Call"})]}),(0,i.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[S&&(0,i.jsx)("div",{style:{display:"flex",alignItems:"center",gap:"2.5px",height:"14px"},children:[12,8,14,6,10].map((g,M)=>(0,i.jsx)("span",{style:{width:"2.5px",height:`${Math.max(4,Math.min(14,Math.round(g*(.35+Math.max(he,we)*1.5))))}px`,background:l,borderRadius:"1px",transition:"height 0.12s ease"}},M))}),(0,i.jsx)("span",{style:{fontFamily:"var(--mono, monospace)",fontSize:"12px",fontWeight:600,padding:"3px 8px",borderRadius:"6px",background:s?"#18181b":S?"#000000":"#f4f4f5",color:s||S?"#ffffff":"#71717a",border:s?"1px solid #27272a":"none"},children:ve})]})]})]})]})]})}var Ee=Se;var Pe={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function ke(f={}){if(typeof window>"u")return;let{host:a,businessId:y="biz_demo_dental",agentId:k,theme:L="light",position:j="bottom-right",label:Y="Talk to Receptionist",accent:B="emerald",accentColor:$,businessName:J,greeting:E,onCallStart:r,onCallEnd:z,onTranscript:H}=f,u=$||Pe[B]||B||"#10b981",F=document.getElementById("omnidesk-voice-widget-root");F&&F.remove();let b=document.createElement("div");b.id="omnidesk-voice-widget-root",b.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let o=L==="dark"||L==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,w=null,U="idle",Z=0,X=null,he=!1,ue=!1,we=0,xe=0,ve=!1,ne=!1,D=!1,se=null,ee=null,C=!1,q=j==="bottom-left",de=document.createElement("div");de.style.cssText=`
    position: fixed; bottom: 20px; ${q?"left: 20px;":"right: 20px;"};
    z-index: 999999;
  `;let G=document.createElement("button");G.style.cssText=`
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${o?"#18181b":"#ffffff"}; color: ${o?"#fafafa":"#09090b"};
    border: 1px solid ${o?"#27272a":"#e4e4e7"};
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `,G.innerHTML=`
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${u};box-shadow:0 0 8px ${u};display:inline-block;"></span>
    <span>${Y}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,de.appendChild(G);let V=document.createElement("div");V.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,V.onclick=()=>S(!1);let c=document.createElement("div");c.style.cssText=`
    position: fixed; bottom: 80px; ${q?"left: 20px;":"right: 20px;"};
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
      <div style="width: 28px; height: 28px; border-radius: 50%; background: ${o?"rgba(255,255,255,0.15)":u==="#18181b"?"rgba(24,24,27,0.08)":`${u}18`}; display: grid; place-items: center; flex-shrink: 0; color: ${o?"#ffffff":u==="#18181b"?"#09090b":u};">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
        </svg>
      </div>
      <div style="display: flex; flex-direction: column; min-width: 0;">
        <div id="omnidesk-biz-title" style="font-size: 13.5px; font-weight: 600; color: ${o?"#ffffff":"#09090b"}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${J||"OmniDesk Hair Salon & Studio"}
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
  `;let K=document.createElement("style");K.textContent=`
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
  `,b.appendChild(K);let v=document.createElement("div");v.style.cssText=`
    flex: 1; min-height: 0; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 12px; background: ${o?"#09090b":"#ffffff"};
  `;let Q=document.createElement("div");Q.id="omnidesk-placeholder-banner",Q.style.cssText=`
    margin: auto; text-align: center; padding: 10px 18px;
    background: ${o?"#18181b":"#f4f4f5"}; border: 1px solid ${o?"#27272a":"#e4e4e7"}; color: ${o?"#a1a1aa":"#52525b"};
    border-radius: 12px; font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px; align-self: center;
  `,Q.innerHTML=`
    <span id="omnidesk-placeholder-dot" style="width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block;"></span>
    <span>Start a call to talk to our receptionist</span>
  `,v.appendChild(Q);let T=document.createElement("div");if(T.id="omnidesk-thinking-bubble",T.style.cssText=`
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
  `,v.appendChild(T),E){Q.style.display="none";let h=document.createElement("div");h.style.cssText="display: flex; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;";let n=document.createElement("div");n.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let e=document.createElement("div");e.style.cssText="width: 24px; height: 24px; border-radius: 50%; background: #18181b; display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;",e.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let m=document.createElement("div");m.style.cssText=`padding: 10px 14px; border-radius: 14px 14px 14px 2px; font-size: 13px; line-height: 1.45; background: ${o?"#18181b":"#f4f4f5"}; color: ${o?"#fafafa":"#09090b"}; border: ${o?"1px solid #27272a":"none"}; box-shadow: 0 1px 2px rgba(0,0,0,0.04);`,m.innerText=E,n.appendChild(e),n.appendChild(m),h.appendChild(n),v.insertBefore(h,T),se="agent",ee=m,C=!0}let x=document.createElement("div");x.id="omnidesk-email-bar",x.style.cssText=`
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
  `;let I=document.createElement("div");I.style.cssText=`
    padding: 12px 16px; border-top: 1px solid ${o?"#27272a":"#e4e4e7"};
    background: ${o?"#121214":"#fafafa"}; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  `;let l=document.createElement("button");l.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: ${u}; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    box-shadow: 0 4px 14px ${u}40;
    cursor: pointer; transition: all 0.15s ease;
  `,l.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let s=document.createElement("div");s.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let A=document.createElement("div");A.id="omnidesk-waveform",A.style.cssText="display: none; align-items: center; gap: 2.5px; height: 14px;";let fe=[12,8,14,6,10],N=[];fe.forEach(h=>{let n=document.createElement("span");n.style.cssText=`width: 2.5px; height: ${Math.round(h*.35)}px; background: ${u}; border-radius: 1px; transition: height 0.12s ease;`,A.appendChild(n),N.push(n)}),s.appendChild(A);let R=document.createElement("span");R.id="omnidesk-timer",R.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,R.innerText="0:00",s.appendChild(R),I.appendChild(l),I.appendChild(s),c.appendChild(_),c.appendChild(v),c.appendChild(x),c.appendChild(I),b.appendChild(de),b.appendChild(V),b.appendChild(c),document.body.appendChild(b);function ge(){Z=Date.now(),R.innerText="0:00",R.style.background=o?"#18181b":"#000000",R.style.color="#ffffff",R.style.border=o?"1px solid #27272a":"none",X&&clearInterval(X),X=setInterval(()=>{let h=Date.now()-Z,n=Math.floor(h/1e3),e=Math.floor(n/60),m=n%60;R.innerText=`${e}:${String(m).padStart(2,"0")}`},250)}function oe(){X&&(clearInterval(X),X=null),R.style.background="#f4f4f5",R.style.color="#71717a",R.style.border="none",R.innerText="0:00",A.style.display="none"}function ae(h){he=h,c.style.display=h?"flex":"none"}function S(h){ue=h,V.style.display=h?"block":"none",h?(c.style.top="50%",c.style.left="50%",c.style.bottom="auto",c.style.right="auto",c.style.transform="translate(-50%, -50%)",c.style.width="calc(100vw - 40px)",c.style.maxWidth="1140px",c.style.height="calc(100vh - 40px)",c.style.maxHeight="900px"):(c.style.top="auto",c.style.left=q?"20px":"auto",c.style.right=q?"auto":"20px",c.style.bottom="80px",c.style.transform="none",c.style.width="390px",c.style.maxWidth="calc(100vw - 32px)",c.style.height="560px",c.style.maxHeight="calc(100vh - 100px)")}G.onclick=()=>ae(!he),_.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{ae(!1),S(!1)}),_.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{S(!ue)});let g=x.querySelector("#omnidesk-email-form"),M=x.querySelector("#omnidesk-email-input");x.querySelector("#omnidesk-email-close-btn").addEventListener("click",()=>{x.style.display="none"}),g.addEventListener("submit",h=>{h.preventDefault();let n=M.value.trim();if(!n||!n.includes("@"))return;w&&w.sendEmailInput(n),D=!0,x.style.display="none",M.value="",Q.style.display="none";let e=document.createElement("div");e.style.cssText=`
      display: flex; flex-direction: column; gap: 4px; max-width: 88%;
      align-self: flex-end;
    `;let m=document.createElement("div");m.style.cssText=`
      padding: 10px 14px; border-radius: 14px 14px 2px 14px;
      font-size: 13px; line-height: 1.45;
      background: ${u}; color: #ffffff;
      box-shadow: 0 2px 8px ${u}35;
    `,m.innerText=`My email is ${n}`,e.appendChild(m),v.insertBefore(e,T),T.style.display="flex",v.scrollTop=v.scrollHeight,se="user",ee=m,C=!0});async function O(){ve=!1,ne=!1,D=!1,x.style.display="none",T.style.display="none",se=null,ee=null,C=!1;let h=_.querySelector("#omnidesk-status-text"),n=_.querySelector("#omnidesk-status-dot"),e=l.querySelector("#omnidesk-btn-text");h.innerText="Connecting...",n.style.background="#eab308",e.innerText="Connecting...",l.style.background="#64748b",l.style.boxShadow="none",l.disabled=!0,ge();try{let m=a;if(!m&&typeof document<"u"){let d=document.querySelector("script[src*='widget.js']");if(d&&d.src&&d.src.startsWith("http"))try{m=new URL(d.src).origin}catch{}}!m&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(m=window.location.origin);let re=(m||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),ye=await fetch(`${re}/api/token?businessId=${encodeURIComponent(y)}`);if(!ye.ok)throw new Error(`Failed to get session token (${ye.status})`);let ce=await ye.json();if(ce.business_name&&!J){let d=_.querySelector("#omnidesk-biz-title");d&&(d.innerText=ce.business_name)}let Me=k||ce.agent_id||"";w=new ie({onStatusChange:d=>{if(U=d,d==="connected")h.innerText="Live \xB7 Speaking",n.style.background="#22c55e",e.innerText="End Voice Call",l.style.background="#dc2626",l.style.boxShadow="0 4px 14px rgba(220, 38, 38, 0.35)",l.disabled=!1,A.style.display="flex",Z=Date.now(),r?.();else if(d==="idle"&&(h.innerText="Idle \xB7 Ready",n.style.background=o?"rgba(255,255,255,0.4)":"#a1a1aa",e.innerText="Start Voice Call",l.style.background=u,l.style.boxShadow=`0 4px 14px ${u}40`,l.disabled=!1,A.style.display="none",x.style.display="none",T.style.display="none",oe(),Z>0)){let t=Math.round((Date.now()-Z)/1e3);Z=0,z?.(t)}},onThinkingChange:d=>{d&&(T.style.display="flex",v.scrollTop=v.scrollHeight)},onTranscript:d=>{if(Q.style.display="none",d.who==="user"){d.isFinal&&(T.style.display="flex");let t=d.text.toLowerCase().trim();(t==="no"||t.startsWith("no ")||t.includes("no,")||t.includes("wrong")||t.includes("incorrect")||t.includes("change my email")||t.includes("different email")||t.includes("that's not right")||t.includes("thats not right")||t.includes("not right")||t.includes("not my email"))&&(D=!1,x.style.display="flex",setTimeout(()=>M.focus(),60)),(t==="yes"||t.startsWith("yes ")||t.includes("yes,")||t==="yeah"||t.startsWith("yeah ")||t==="yep"||t==="correct"||t.includes("that's right")||t.includes("thats right")||t.includes("sounds good")||t==="confirm"||t==="sure")&&D&&(D=!1,x.style.display="none"),(d.text.includes("@")||t.includes(" at ")&&t.includes(" dot ")||t.includes("gmail.com")||t.includes("yahoo.com")||t.includes("outlook.com")||t.includes("hotmail.com")||t.includes("icloud.com"))&&(x.style.display="none",D=!0)}else if(d.who==="agent"){d.text&&d.text.trim().length>0&&(T.style.display="none");let t=d.text.toLowerCase();if(t.includes("confirmation code is")||t.includes("booking is confirmed")||t.includes("scheduled your appointment")||t.includes("all set, your appointment")||t.includes("sent your confirmation")&&(t.includes("code")||t.includes("calendar invite"))||t.includes("sent a calendar invite")&&(t.includes("code")||t.includes("all set"))){ne=!0,D=!1,x.style.display="none";return}if(ne){x.style.display="none";return}if(t.includes("confirm with yes or no")||t.includes("yes or no")||t.includes("is that correct")||t.includes("is that right")||t.includes("verified your email")||t.includes("checking that email")||t.includes("let me check that email")){D=!0,x.style.display="none";return}!D&&(t.includes("what is your email")||t.includes("what's your email")||t.includes("whats your email")||t.includes("may i have your email")||t.includes("can i have your email")||t.includes("could i have your email")||t.includes("could i get your email")||t.includes("could you provide your email")||t.includes("can you provide your email")||t.includes("provide your email")||t.includes("enter your email")||t.includes("share your email")||t.includes("need your email")||t.includes("what is your correct email")||t.includes("provide your correct email")||t.includes("where can i send your confirmation")||t.includes("where should i send your confirmation")||t.includes("where can i send your calendar")||t.includes("where should i send your calendar")||t.includes("email address")&&(t.includes("what is")||t.includes("what's")||t.includes("whats")||t.includes("may i have")||t.includes("can i have")||t.includes("could i have")||t.includes("could you provide")||t.includes("can you provide")||t.includes("provide")||t.includes("share")||t.includes("so i can send")||t.includes("to send your")))?(x.style.display="flex",setTimeout(()=>M.focus(),60)):d.isFinal&&(x.style.display="none")}if(se===d.who&&ee&&!C)ee.innerText=d.text,C=!!d.isFinal;else{let t=d.who==="user",te=document.createElement("div");if(te.style.cssText=`
              display: flex; flex-direction: column; gap: 4px; max-width: 88%;
              align-self: ${t?"flex-end":"flex-start"};
            `,t){let P=document.createElement("div");P.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 2px 14px;
                font-size: 13px; line-height: 1.45;
                background: ${u};
                color: #ffffff;
                box-shadow: 0 2px 8px ${u}35;
              `,P.innerText=d.text,te.appendChild(P),ee=P}else{let P=document.createElement("div");P.style.cssText="display: flex; align-items: flex-start; gap: 8px;";let le=document.createElement("div");le.style.cssText=`
                width: 24px; height: 24px; border-radius: 50%; background: #18181b;
                display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;
              `,le.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>';let pe=document.createElement("div");pe.style.cssText=`
                padding: 10px 14px; border-radius: 14px 14px 14px 2px;
                font-size: 13px; line-height: 1.45;
                background: ${o?"#18181b":"#f4f4f5"};
                color: ${o?"#fafafa":"#09090b"};
                border: ${o?"1px solid #27272a":"none"};
                box-shadow: 0 1px 2px rgba(0,0,0,0.04);
              `,pe.innerText=d.text,P.appendChild(le),P.appendChild(pe),te.appendChild(P),ee=pe}v.insertBefore(te,T),se=d.who,C=!!d.isFinal}v.scrollTop=v.scrollHeight,H?.(d)},onAudioLevel:(d,t)=>{if(we=d,xe=t,U==="connected"){A.style.display="flex";let te=Math.max(d,t);fe.forEach((P,le)=>{let pe=Math.max(4,Math.min(14,Math.round(P*(.35+te*1.5))));N[le]&&(N[le].style.height=`${pe}px`)})}},onError:()=>{h.innerText="Error",n.style.background="#ef4444",e.innerText="Start Voice Call",l.style.background=u,l.style.boxShadow=`0 4px 14px ${u}40`,l.disabled=!1,A.style.display="none",x.style.display="none",T.style.display="none",oe()}}),await w.start(ce.token,Me,ce.voice,ce.ws_url)}catch(m){console.error("[OmniDesk Voice Widget Error]:",m),h.innerText="Error",n.style.background="#ef4444",e.innerText="Start Voice Call",l.style.background=u,l.style.boxShadow=`0 4px 14px ${u}40`,l.disabled=!1,A.style.display="none",x.style.display="none",T.style.display="none",oe()}}function me(){w&&(w.stop(),w=null),U="idle";let h=_.querySelector("#omnidesk-status-text"),n=_.querySelector("#omnidesk-status-dot"),e=l.querySelector("#omnidesk-btn-text");h&&(h.innerText="Idle \xB7 Ready"),n&&(n.style.background=o?"rgba(255,255,255,0.4)":"#a1a1aa"),e&&(e.innerText="Start Voice Call"),l.style.background=u,l.style.boxShadow=`0 4px 14px ${u}40`,l.disabled=!1,A.style.display="none",x.style.display="none",T.style.display="none",ne=!1,D=!1,oe()}return l.onclick=()=>{U==="connected"?me():U==="idle"&&O()},{destroy:()=>{oe(),w&&w.stop(),b.remove()},startCall:O,endCall:me}}if(typeof document<"u"){let f=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(f){let a,y=f.src||"";if(y&&y.startsWith("http"))try{a=new URL(y).origin}catch{}let k=f.getAttribute("data-business-id")||void 0,L=f.getAttribute("data-agent")||void 0,j=f.getAttribute("data-theme")||"dark",Y=f.getAttribute("data-accent")||"emerald",B=f.getAttribute("data-position")||"bottom-right",$=f.getAttribute("data-label")||void 0,J=f.getAttribute("data-host")||a||"https://omni-desk-rho.vercel.app",E=f.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{ke({businessId:k,agentId:L,theme:j,accent:Y,position:B,label:$,host:J,greeting:E})}):ke({businessId:k,agentId:L,theme:j,accent:Y,position:B,label:$,host:J,greeting:E})}}0&&(module.exports={AssemblyAIVoiceClient,OmniDeskWidget,VoiceWidget,initOmniDeskWidget});
//# sourceMappingURL=index.js.map