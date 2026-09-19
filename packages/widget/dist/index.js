"use strict";var fe=Object.defineProperty;var be=Object.getOwnPropertyDescriptor;var me=Object.getOwnPropertyNames;var ye=Object.prototype.hasOwnProperty;var ke=(s,t)=>{for(var c in t)fe(s,c,{get:t[c],enumerable:!0})},ve=(s,t,c,d)=>{if(t&&typeof t=="object"||typeof t=="function")for(let x of me(t))!ye.call(s,x)&&x!==c&&fe(s,x,{get:()=>t[x],enumerable:!(d=be(t,x))||d.enumerable});return s};var we=s=>ve(fe({},"__esModule",{value:!0}),s);var Le={};ke(Le,{AssemblyAIVoiceClient:()=>U,OmniDeskWidget:()=>he,VoiceWidget:()=>xe,initOmniDeskWidget:()=>de});module.exports=we(Le);var n=require("react");var ce=24e3,Se="wss://agents.assemblyai.com/v1/ws",Ce=`
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${ce};
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
`,Te=`
  class PlaybackProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ring = new Float32Array(sampleRate * 30);
      this._writePos = 0;
      this._readPos = 0;
      this._available = 0;
      this._step = ${ce} / sampleRate;
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
`;async function ge(s,t,c){let d=URL.createObjectURL(new Blob([t],{type:"application/javascript"}));try{await s.audioWorklet.addModule(d)}finally{URL.revokeObjectURL(d)}return new AudioWorkletNode(s,c)}var U=class{constructor(t){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.callbacks=t}async start(t,c){try{this.callbacks.onStatusChange?.("connecting");let d=window.AudioContext||window.webkitAudioContext;this.captureCtx=new d({sampleRate:ce}),this.playbackCtx=new d({sampleRate:ce}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await ge(this.playbackCtx,Te,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await ge(this.captureCtx,Ce,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let x=new URL(Se);x.searchParams.set("token",t),this.ws=new WebSocket(x.toString()),this.captureNode.port.onmessage=({data:T})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let i=new Uint8Array(T),b="";for(let M=0;M<i.length;M+=32768)b+=String.fromCharCode.apply(null,Array.from(i.subarray(M,M+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(b)}));let m=new Int16Array(T),_=0;for(let M=0;M<m.length;M+=16)_+=Math.abs(m[M]);this.userLevel=Math.min(1,_/(m.length/16)/8e3)},this.ws.onopen=()=>{c&&c.trim()&&this.ws?.send(JSON.stringify({type:"session.update",session:{agent_id:c.trim()}}))},this.ws.onmessage=({data:T})=>{try{let i=JSON.parse(T);switch(i.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0;break;case"transcript.user":i.text&&this.callbacks.onTranscript?.({who:"user",text:i.text});break;case"transcript.agent":i.text&&this.callbacks.onTranscript?.({who:"agent",text:i.text});break;case"reply.audio":if(i.data&&this.playbackNode){let b=atob(i.data),m=new Uint8Array(b.length);for(let _=0;_<b.length;_++)m[_]=b.charCodeAt(_);this.playbackNode.port.postMessage(m.buffer,[m.buffer]),this.agentLevel=.8}break;case"reply.done":i.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:i.name||i.tool,args:i.arguments||i.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:i.name||i.tool,result:i.result});break;case"session.error":this.callbacks.onError?.(i.message||i.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.stop();break}}catch(i){console.warn("Message parsing error:",i)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(d){this.callbacks.onError?.(d.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(t){this.isMuted=t,t&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(t,c){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:t})),c&&this.ws.send(JSON.stringify({type:"reply.create",instructions:c})),!0}catch(d){return console.error("Failed to send message to agent:",d),!1}}sendEmailInput(t){return this.sendUserMessage(`My email address is ${t}`,`The caller entered their verified email address: ${t}. Acknowledge this email, verify it using verify_customer_email if needed, and complete the booking.`)}stop(){if(this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(t=>t.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let t=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(t)};this.animFrameId=requestAnimationFrame(t)}};var e=require("react/jsx-runtime"),_e={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function he({host:s="",businessId:t="biz_demo_dental",agentId:c,theme:d="dark",position:x="bottom-right",label:T="Talk to Receptionist",accent:i="emerald",accentColor:b,businessName:m,greeting:_,className:M,onCallStart:se,onCallEnd:q,onTranscript:oe}){let[J,te]=(0,n.useState)(!1),[a,Z]=(0,n.useState)(!1),[y,R]=(0,n.useState)("idle"),[W,$]=(0,n.useState)([]),[re,ne]=(0,n.useState)(0),[pe,ae]=(0,n.useState)(0),[G,K]=(0,n.useState)("0:00"),[Y,Q]=(0,n.useState)(m||"OmniDesk Hair Salon & Studio"),[o,w]=(0,n.useState)(!1),[L,B]=(0,n.useState)(""),[P,p]=(0,n.useState)(!1),[j,f]=(0,n.useState)(""),[le,z]=(0,n.useState)(""),E=(0,n.useRef)(null),X=(0,n.useRef)(null),N=(0,n.useRef)(0),D=(0,n.useRef)(null),h=(0,n.useRef)(0),I=(0,n.useMemo)(()=>b||_e[i]||i||"#10b981",[i,b]),A=(0,n.useMemo)(()=>d==="light"?!1:d==="auto"&&typeof window<"u"?window.matchMedia("(prefers-color-scheme: dark)").matches:!0,[d]);(0,n.useEffect)(()=>{X.current?.scrollIntoView({behavior:"smooth"})},[W]);let V=(0,n.useMemo)(()=>s?s.replace(/\/$/,""):typeof window<"u"&&window.location.origin?window.location.origin:"",[s]),ie=(0,n.useCallback)(()=>{h.current=Date.now(),K("0:00"),D.current&&clearInterval(D.current),D.current=setInterval(()=>{let r=Date.now()-h.current,C=Math.floor(r/1e3),g=Math.floor(C/60),ee=C%60;K(`${g}:${String(ee).padStart(2,"0")}`)},250)},[]),S=(0,n.useCallback)(()=>{D.current&&(clearInterval(D.current),D.current=null)},[]),ue=(0,n.useCallback)(async()=>{try{R("connecting"),ie();let r=V?`${V}/api/token?businessId=${encodeURIComponent(t)}`:`/api/token?businessId=${encodeURIComponent(t)}`,C=await fetch(r);if(!C.ok)throw new Error(`Failed to fetch session token (${C.status})`);let g=await C.json();if(g.business_name&&!m&&Q(g.business_name),!g.token)throw new Error("Invalid session token payload received from host");let ee=c||g.agent_id||"",H=new U({onStatusChange:v=>{if(R(v),v==="connected")N.current=Date.now(),se?.();else if(v==="idle"&&(S(),N.current>0)){let l=Math.round((Date.now()-N.current)/1e3);N.current=0,q?.(l)}},onTranscript:v=>{if($(l=>[...l,v]),oe?.(v),v.who==="agent"){let l=v.text.toLowerCase();(l.replace(/[\s\-_]/g,"").includes("email")||l.includes("e-mail")||l.includes("email")||l.includes("mail address")||l.includes("your mail")||l.includes("send your confirmation")||l.includes("send the confirmation")||l.includes("calendar invite")||l.includes("where should i send")||l.includes("where can i send")||l.includes("what is your address")||l.includes("spell your")||l.includes("provide your")||l.includes("type your"))&&w(!0)}},onAudioLevel:(v,l)=>{ne(v),ae(l)},onError:()=>{R("error"),S()}});E.current=H,await H.start(g.token,ee)}catch{R("error"),S()}},[V,t,c,m,se,q,oe,ie,S]),k=(0,n.useCallback)(()=>{if(E.current&&(E.current.stop(),E.current=null),R("idle"),ne(0),ae(0),S(),w(!1),f(""),z(""),N.current>0){let r=Math.round((Date.now()-N.current)/1e3);N.current=0,q?.(r)}},[q,S]),O=(0,n.useCallback)(async r=>{r.preventDefault();let C=L.trim();if(C){p(!0),f(""),z("");try{let g=V?V.replace(/\/$/,""):"",ee=await fetch(`${g}/api/tools/${encodeURIComponent(t)}/verify_customer_email`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:C})}),H=await ee.json();if(!ee.ok||!H.valid||!H.email){f(H.message||"Invalid email or domain has no active mail server."),p(!1);return}let v=H.email;z(`Verified: ${v}. Sent to agent.`),$(l=>[...l,{who:"user",text:`My email is ${v}`}]),E.current&&E.current.sendEmailInput(v),B(""),setTimeout(()=>{w(!1),z("")},2500)}catch(g){f(g.message||"Failed to verify email with mail server.")}finally{p(!1)}}},[L,V,t]);(0,n.useEffect)(()=>()=>{S(),E.current&&E.current.stop()},[S]);let F=x==="bottom-left",u=y==="connected";return(0,e.jsxs)("div",{className:M,style:{position:"relative",zIndex:99999},children:[(0,e.jsx)("div",{style:{position:"fixed",bottom:"20px",left:F?"20px":"auto",right:F?"auto":"20px",zIndex:99999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:(0,e.jsxs)("button",{type:"button",onClick:()=>te(!J),style:{display:"inline-flex",alignItems:"center",gap:"10px",background:A?"#18181b":"#ffffff",color:A?"#fafafa":"#09090b",border:`1px solid ${A?"#27272a":"#e4e4e7"}`,padding:"10px 18px",borderRadius:"9999px",cursor:"pointer",fontSize:"13px",fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.18)",transition:"transform 0.15s ease, background 0.15s ease"},onMouseEnter:r=>{r.currentTarget.style.transform="scale(1.02)"},onMouseLeave:r=>{r.currentTarget.style.transform="scale(1)"},children:[(0,e.jsx)("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:u?"#ef4444":I,boxShadow:`0 0 8px ${u?"#ef4444":I}`}}),(0,e.jsx)("span",{children:T}),(0,e.jsx)("span",{style:{fontSize:"11px",opacity:.6},children:"\u25B2"})]})}),J&&(0,e.jsxs)(e.Fragment,{children:[a&&(0,e.jsx)("div",{onClick:()=>Z(!1),style:{position:"fixed",inset:0,background:"rgba(0, 0, 0, 0.7)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",zIndex:999998}}),(0,e.jsxs)("div",{style:{position:"fixed",bottom:a?"auto":"80px",left:a?"50%":F?"20px":"auto",right:a||F?"auto":"20px",top:a?"50%":"auto",transform:a?"translate(-50%, -50%)":"none",width:a?"calc(100vw - 40px)":"390px",maxWidth:a?"1140px":"calc(100vw - 32px)",height:a?"calc(100vh - 40px)":"560px",maxHeight:a?"900px":"calc(100vh - 100px)",background:"#ffffff",border:"1px solid #e4e4e7",borderRadius:"20px",boxShadow:a?"0 32px 64px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)":"0 24px 48px -12px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:999999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",transition:"all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"},children:[(0,e.jsxs)("div",{style:{background:"#18181b",color:"#ffffff",padding:a?"16px 22px":"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",userSelect:"none",flexShrink:0},children:[(0,e.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"10px",minWidth:0},children:[(0,e.jsx)("div",{style:{color:"rgba(255,255,255,0.6)",display:"grid",placeItems:"center",flexShrink:0},children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("circle",{cx:"12",cy:"12",r:"1"}),(0,e.jsx)("circle",{cx:"12",cy:"5",r:"1"}),(0,e.jsx)("circle",{cx:"12",cy:"19",r:"1"})]})}),(0,e.jsx)("div",{style:{width:"28px",height:"28px",borderRadius:"50%",background:"rgba(255,255,255,0.15)",display:"grid",placeItems:"center",flexShrink:0,color:"#ffffff"},children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,e.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),(0,e.jsx)("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]})}),(0,e.jsxs)("div",{style:{display:"flex",flexDirection:"column",minWidth:0},children:[(0,e.jsx)("div",{style:{fontSize:"13.5px",fontWeight:600,color:"#ffffff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},children:Y}),(0,e.jsxs)("div",{style:{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"11px",color:"rgba(255,255,255,0.75)"},children:[(0,e.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:u?"#22c55e":y==="connecting"?"#eab308":"rgba(255,255,255,0.4)"}}),(0,e.jsx)("span",{children:u?"Live \xB7 Speaking":y==="connecting"?"Connecting...":y==="error"?"Error":"Idle \xB7 Ready"})]})]})]}),(0,e.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[(0,e.jsx)("button",{type:"button",onClick:()=>Z(!a),title:a?"Exit Fullscreen":"Open Full",style:{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"7px",color:"#ffffff",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:r=>r.currentTarget.style.background="rgba(255,255,255,0.2)",onMouseLeave:r=>r.currentTarget.style.background="rgba(255,255,255,0.1)",children:a?(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("polyline",{points:"4 14 10 14 10 20"}),(0,e.jsx)("polyline",{points:"20 10 14 10 14 4"}),(0,e.jsx)("line",{x1:"14",y1:"10",x2:"21",y2:"3"}),(0,e.jsx)("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]}):(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("polyline",{points:"15 3 21 3 21 9"}),(0,e.jsx)("polyline",{points:"9 21 3 21 3 15"}),(0,e.jsx)("line",{x1:"21",y1:"3",x2:"14",y2:"10"}),(0,e.jsx)("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]})}),(0,e.jsx)("button",{type:"button",onClick:()=>{u&&k(),te(!1)},title:"Close Widget",style:{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"7px",color:"#ffffff",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:r=>r.currentTarget.style.background="rgba(255,255,255,0.2)",onMouseLeave:r=>r.currentTarget.style.background="rgba(255,255,255,0.1)",children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("line",{x1:"18",y1:"6",x2:"6",y2:"18"}),(0,e.jsx)("line",{x1:"6",y1:"6",x2:"18",y2:"18"})]})})]})]}),(0,e.jsxs)("div",{style:{flex:1,minHeight:0,padding:"16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"12px",background:"#ffffff"},children:[W.length===0&&(0,e.jsxs)("div",{style:{margin:"auto",textAlign:"center",padding:"10px 18px",background:"#f4f4f5",border:"1px solid #e4e4e7",color:"#52525b",borderRadius:"12px",fontSize:"12.5px",fontWeight:500,display:"inline-flex",alignItems:"center",gap:"8px",alignSelf:"center"},children:[(0,e.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:u?"#22c55e":"#a1a1aa",display:"inline-block"}}),(0,e.jsx)("span",{children:u?"Connected \xB7 Speak to our receptionist":y==="connecting"?"Connecting to receptionist...":"Start a call to talk to our receptionist"})]}),W.map((r,C)=>{let g=r.who==="user";return(0,e.jsx)("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:g?"flex-end":"flex-start"},children:(0,e.jsxs)("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[!g&&(0,e.jsx)("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,e.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),(0,e.jsx)("div",{style:{padding:"10px 14px",borderRadius:g?"14px 14px 2px 14px":"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:g?"#18181b":"#f4f4f5",color:g?"#ffffff":"#09090b",boxShadow:"0 1px 2px rgba(0,0,0,0.04)"},children:r.text})]})},C)}),(0,e.jsx)("div",{ref:X})]}),o&&u&&(0,e.jsxs)("div",{style:{padding:"11px 16px",background:"#f0fdf4",borderTop:"1px solid #bbf7d0",display:"flex",flexDirection:"column",gap:"7px",flexShrink:0},children:[(0,e.jsxs)("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"},children:[(0,e.jsxs)("span",{style:{fontSize:"11px",fontWeight:700,color:"#15803d",textTransform:"uppercase",letterSpacing:"0.04em",display:"inline-flex",alignItems:"center",gap:"6px"},children:[(0,e.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:"#22c55e",display:"inline-block"}}),"Agent Requesting Email \u2022 Verified Mailbox Entry"]}),(0,e.jsx)("button",{type:"button",onClick:()=>w(!1),style:{background:"none",border:"none",color:"#15803d",cursor:"pointer",fontSize:"12px",fontWeight:700,padding:"1px 4px"},children:"\u2715"})]}),(0,e.jsxs)("form",{onSubmit:O,style:{display:"flex",gap:"6px"},children:[(0,e.jsx)("input",{type:"email",autoFocus:!0,value:L,onChange:r=>{B(r.target.value),f("")},placeholder:"Enter your real email (e.g. name@gmail.com)",disabled:P,required:!0,style:{flex:1,fontSize:"12.5px",padding:"7px 11px",borderRadius:"7px",border:j?"1.5px solid #ef4444":"1px solid #86efac",background:"#ffffff",color:"#09090b",outline:"none"}}),(0,e.jsx)("button",{type:"submit",disabled:P||!L.trim(),style:{background:"#16a34a",color:"#ffffff",border:"none",padding:"7px 14px",borderRadius:"7px",fontSize:"12px",fontWeight:600,cursor:P?"wait":"pointer",opacity:P?.7:1},children:P?"...":"Verify & Send"})]}),j&&(0,e.jsxs)("div",{style:{fontSize:"11px",color:"#ef4444",fontWeight:500},children:["\u26A0\uFE0F ",j]}),le&&(0,e.jsxs)("div",{style:{fontSize:"11px",color:"#15803d",fontWeight:600},children:["\u2713 ",le]})]}),(0,e.jsxs)("div",{style:{padding:"12px 16px",borderTop:"1px solid #e4e4e7",background:"#fafafa",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0},children:[(0,e.jsxs)("button",{type:"button",onClick:u?k:ue,disabled:y==="connecting",style:{display:"inline-flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:u?"#dc2626":"#000000",color:"#ffffff",borderRadius:"10px",border:"none",fontSize:"13px",fontWeight:600,cursor:y==="connecting"?"not-allowed":"pointer",transition:"all 0.15s ease"},children:[(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,e.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),(0,e.jsx)("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]}),(0,e.jsx)("span",{children:u?"End Voice Call":y==="connecting"?"Connecting...":"Start Voice Call"})]}),(0,e.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[u&&(0,e.jsx)("div",{style:{display:"flex",alignItems:"center",gap:"2.5px",height:"14px"},children:[12,8,14,6,10].map((r,C)=>(0,e.jsx)("span",{style:{width:"2.5px",height:`${Math.max(4,Math.min(14,Math.round(r*(.35+Math.max(re,pe)*1.5))))}px`,background:"#000000",borderRadius:"1px",transition:"height 0.12s ease"}},C))}),(0,e.jsx)("span",{style:{fontFamily:"var(--mono, monospace)",fontSize:"12px",fontWeight:600,padding:"3px 8px",borderRadius:"6px",background:u?"#000000":"#f4f4f5",color:u?"#ffffff":"#71717a"},children:G})]})]})]})]})]})}var xe=he;var Me={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function de(s={}){if(typeof window>"u")return;let{host:t,businessId:c="biz_demo_dental",agentId:d,theme:x="dark",position:T="bottom-right",label:i="Talk to Receptionist",accent:b="emerald",accentColor:m,businessName:_,greeting:M,onCallStart:se,onCallEnd:q,onTranscript:oe}=s,J=m||Me[b]||b||"#10b981",te=document.getElementById("omnidesk-voice-widget-root");te&&te.remove();let a=document.createElement("div");a.id="omnidesk-voice-widget-root",a.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let Z=x==="dark"||x==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,y=null,R="idle",W=0,$=null,re=!1,ne=!1,pe=0,ae=0,G=T==="bottom-left",K=document.createElement("div");K.style.cssText=`
    position: fixed; bottom: 20px; ${G?"left: 20px;":"right: 20px;"};
    z-index: 999999;
  `;let Y=document.createElement("button");Y.style.cssText=`
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${Z?"#18181b":"#ffffff"}; color: ${Z?"#fafafa":"#09090b"};
    border: 1px solid ${Z?"#27272a":"#e4e4e7"};
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `,Y.innerHTML=`
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${J};box-shadow:0 0 8px ${J};display:inline-block;"></span>
    <span>${i}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,K.appendChild(Y);let Q=document.createElement("div");Q.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,Q.onclick=()=>X(!1);let o=document.createElement("div");o.style.cssText=`
    position: fixed; bottom: 80px; ${G?"left: 20px;":"right: 20px;"};
    width: 390px; max-width: calc(100vw - 32px); height: 560px; max-height: calc(100vh - 100px);
    background: #ffffff; border: 1px solid #e4e4e7;
    border-radius: 20px; box-shadow: 0 24px 48px -12px rgba(0,0,0,0.22);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  `;let w=document.createElement("div");w.style.cssText=`
    background: #18181b; color: #ffffff; padding: 13px 18px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; user-select: none; flex-shrink: 0;
  `,w.innerHTML=`
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
  `;let B=document.createElement("div");B.id="omnidesk-placeholder-banner",B.style.cssText=`
    margin: auto; text-align: center; padding: 10px 18px;
    background: #f4f4f5; border: 1px solid #e4e4e7; color: #52525b;
    border-radius: 12px; font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px; align-self: center;
  `,B.innerHTML=`
    <span style="width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block;"></span>
    <span>Start a call to talk to our receptionist</span>
  `,L.appendChild(B);let P=document.createElement("div");P.style.cssText=`
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
  `;let j=document.createElement("div");j.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let f=document.createElement("span");f.id="omnidesk-timer",f.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,f.innerText="0:00",j.appendChild(f),P.appendChild(p),P.appendChild(j),o.appendChild(w),o.appendChild(L),o.appendChild(P),a.appendChild(K),a.appendChild(Q),a.appendChild(o),document.body.appendChild(a);function le(){W=Date.now(),f.innerText="0:00",f.style.background="#000000",f.style.color="#ffffff",$&&clearInterval($),$=setInterval(()=>{let h=Date.now()-W,I=Math.floor(h/1e3),A=Math.floor(I/60),V=I%60;f.innerText=`${A}:${String(V).padStart(2,"0")}`},250)}function z(){$&&(clearInterval($),$=null),f.style.background="#f4f4f5",f.style.color="#71717a",f.innerText="0:00"}function E(h){re=h,o.style.display=h?"flex":"none"}function X(h){ne=h,Q.style.display=h?"block":"none",h?(o.style.top="50%",o.style.left="50%",o.style.bottom="auto",o.style.right="auto",o.style.transform="translate(-50%, -50%)",o.style.width="calc(100vw - 40px)",o.style.maxWidth="1140px",o.style.height="calc(100vh - 40px)",o.style.maxHeight="900px"):(o.style.top="auto",o.style.left=G?"20px":"auto",o.style.right=G?"auto":"20px",o.style.bottom="80px",o.style.transform="none",o.style.width="390px",o.style.maxWidth="calc(100vw - 32px)",o.style.height="560px",o.style.maxHeight="calc(100vh - 100px)")}Y.onclick=()=>E(!re),w.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{E(!1),X(!1)}),w.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{X(!ne)});async function N(){let h=w.querySelector("#omnidesk-status-text"),I=w.querySelector("#omnidesk-status-dot"),A=p.querySelector("#omnidesk-btn-text");h.innerText="Connecting...",I.style.background="#eab308",A.innerText="Connecting...",p.disabled=!0,le();try{let V=t?t.replace(/\/$/,""):typeof window<"u"?window.location.origin:"",ie=await fetch(`${V}/api/token?businessId=${encodeURIComponent(c)}`);if(!ie.ok)throw new Error("Failed to get session token");let S=await ie.json();if(S.business_name&&!_){let k=w.querySelector("#omnidesk-biz-title");k&&(k.innerText=S.business_name)}let ue=d||S.agent_id||"";y=new U({onStatusChange:k=>{if(R=k,k==="connected")h.innerText="Live \xB7 Speaking",I.style.background="#22c55e",A.innerText="End Voice Call",p.style.background="#dc2626",p.disabled=!1,W=Date.now(),se?.();else if(k==="idle"&&(h.innerText="Idle \xB7 Ready",I.style.background="rgba(255,255,255,0.4)",A.innerText="Start Voice Call",p.style.background="#000000",p.disabled=!1,z(),W>0)){let O=Math.round((Date.now()-W)/1e3);W=0,q?.(O)}},onTranscript:k=>{B.style.display="none";let O=document.createElement("div"),F=k.who==="user";O.style.cssText=`
            display: flex; flex-direction: column; gap: 4px; max-width: 88%;
            align-self: ${F?"flex-end":"flex-start"};
          `;let u=document.createElement("div");u.style.cssText=`
            padding: 10px 14px; border-radius: ${F?"14px 14px 2px 14px":"14px 14px 14px 2px"};
            font-size: 13px; line-height: 1.45;
            background: ${F?"#18181b":"#f4f4f5"};
            color: ${F?"#ffffff":"#09090b"};
            box-shadow: 0 1px 2px rgba(0,0,0,0.04);
          `,u.innerText=k.text,O.appendChild(u),L.appendChild(O),L.scrollTop=L.scrollHeight,oe?.(k)},onAudioLevel:(k,O)=>{pe=k,ae=O},onError:()=>{h.innerText="Error",I.style.background="#ef4444",A.innerText="Start Voice Call",p.style.background="#000000",p.disabled=!1,z()}}),await y.start(S.token,ue)}catch{h.innerText="Error",I.style.background="#ef4444",A.innerText="Start Voice Call",p.style.background="#000000",p.disabled=!1,z()}}function D(){y&&(y.stop(),y=null),R="idle",z()}return p.onclick=()=>{R==="connected"?D():R==="idle"&&N()},{destroy:()=>{z(),y&&y.stop(),a.remove()},startCall:N,endCall:D}}if(typeof document<"u"){let s=document.currentScript||document.querySelector("script[data-agent], script[data-business-id]");if(s){let t=s.getAttribute("data-business-id")||void 0,c=s.getAttribute("data-agent")||void 0,d=s.getAttribute("data-theme")||"dark",x=s.getAttribute("data-accent")||"emerald",T=s.getAttribute("data-position")||"bottom-right",i=s.getAttribute("data-label")||void 0,b=s.getAttribute("data-host")||void 0,m=s.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{de({businessId:t,agentId:c,theme:d,accent:x,position:T,label:i,host:b,greeting:m})}):de({businessId:t,agentId:c,theme:d,accent:x,position:T,label:i,host:b,greeting:m})}}0&&(module.exports={AssemblyAIVoiceClient,OmniDeskWidget,VoiceWidget,initOmniDeskWidget});
//# sourceMappingURL=index.js.map