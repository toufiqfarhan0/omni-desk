"use strict";var fe=Object.defineProperty;var me=Object.getOwnPropertyDescriptor;var be=Object.getOwnPropertyNames;var ye=Object.prototype.hasOwnProperty;var ke=(o,t)=>{for(var l in t)fe(o,l,{get:t[l],enumerable:!0})},ve=(o,t,l,d)=>{if(t&&typeof t=="object"||typeof t=="function")for(let m of be(t))!ye.call(o,m)&&m!==l&&fe(o,m,{get:()=>t[m],enumerable:!(d=me(t,m))||d.enumerable});return o};var we=o=>ve(fe({},"__esModule",{value:!0}),o);var Le={};ke(Le,{AssemblyAIVoiceClient:()=>U,OmniDeskWidget:()=>he,VoiceWidget:()=>xe,initOmniDeskWidget:()=>pe});module.exports=we(Le);var i=require("react");var de=24e3,Se="wss://agents.assemblyai.com/v1/ws",Ce=`
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${de};
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
      this._step = ${de} / sampleRate;
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
`;async function ge(o,t,l){let d=URL.createObjectURL(new Blob([t],{type:"application/javascript"}));try{await o.audioWorklet.addModule(d)}finally{URL.revokeObjectURL(d)}return new AudioWorkletNode(o,l)}var U=class{constructor(t){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.callbacks=t}async start(t,l){try{this.callbacks.onStatusChange?.("connecting");let d=window.AudioContext||window.webkitAudioContext;this.captureCtx=new d({sampleRate:de}),this.playbackCtx=new d({sampleRate:de}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await ge(this.playbackCtx,Te,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await ge(this.captureCtx,Ce,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let m=new URL(Se);m.searchParams.set("token",t),this.ws=new WebSocket(m.toString()),this.captureNode.port.onmessage=({data:E})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let n=new Uint8Array(E),b="";for(let S=0;S<n.length;S+=32768)b+=String.fromCharCode.apply(null,Array.from(n.subarray(S,S+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(b)}));let y=new Int16Array(E),w=0;for(let S=0;S<y.length;S+=16)w+=Math.abs(y[S]);this.userLevel=Math.min(1,w/(y.length/16)/8e3)},this.ws.onopen=()=>{l&&l.trim()&&this.ws?.send(JSON.stringify({type:"session.update",session:{agent_id:l.trim()}}))},this.ws.onmessage=({data:E})=>{try{let n=JSON.parse(E);switch(n.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0;break;case"transcript.user":n.text&&this.callbacks.onTranscript?.({who:"user",text:n.text});break;case"transcript.agent":n.text&&this.callbacks.onTranscript?.({who:"agent",text:n.text});break;case"reply.audio":if(n.data&&this.playbackNode){let b=atob(n.data),y=new Uint8Array(b.length);for(let w=0;w<b.length;w++)y[w]=b.charCodeAt(w);this.playbackNode.port.postMessage(y.buffer,[y.buffer]),this.agentLevel=.8}break;case"reply.done":n.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:n.name||n.tool,args:n.arguments||n.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:n.name||n.tool,result:n.result});break;case"session.error":this.callbacks.onError?.(n.message||n.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.stop();break}}catch(n){console.warn("Message parsing error:",n)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(d){this.callbacks.onError?.(d.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(t){this.isMuted=t,t&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(t,l){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:t})),l&&this.ws.send(JSON.stringify({type:"reply.create",instructions:l})),!0}catch(d){return console.error("Failed to send message to agent:",d),!1}}sendEmailInput(t){return this.sendUserMessage(`My email address is ${t}`,`The caller entered their verified email address: ${t}. Acknowledge this email, verify it using verify_customer_email if needed, and complete the booking.`)}stop(){if(this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(t=>t.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let t=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(t)};this.animFrameId=requestAnimationFrame(t)}};var e=require("react/jsx-runtime"),Me={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function he({host:o="",businessId:t="biz_demo_dental",agentId:l,theme:d="dark",position:m="bottom-right",label:E="Talk to Receptionist",accent:n="emerald",accentColor:b,businessName:y,greeting:w,className:S,onCallStart:ne,onCallEnd:H,onTranscript:se}){let[q,te]=(0,i.useState)(!1),[a,J]=(0,i.useState)(!1),[k,P]=(0,i.useState)("idle"),[V,D]=(0,i.useState)([]),[oe,ie]=(0,i.useState)(0),[ue,re]=(0,i.useState)(0),[Z,G]=(0,i.useState)("0:00"),[K,Y]=(0,i.useState)(y||"OmniDesk Hair Salon & Studio"),[r,T]=(0,i.useState)(!1),[I,F]=(0,i.useState)(""),[z,f]=(0,i.useState)(!1),[j,h]=(0,i.useState)(""),[ae,N]=(0,i.useState)(""),A=(0,i.useRef)(null),Q=(0,i.useRef)(null),$=(0,i.useRef)(0),O=(0,i.useRef)(null),g=(0,i.useRef)(0),R=(0,i.useMemo)(()=>b||Me[n]||n||"#10b981",[n,b]),W=(0,i.useMemo)(()=>d==="light"?!1:d==="auto"&&typeof window<"u"?window.matchMedia("(prefers-color-scheme: dark)").matches:!0,[d]);(0,i.useEffect)(()=>{Q.current?.scrollIntoView({behavior:"smooth"})},[V]);let v=(0,i.useMemo)(()=>o?o.replace(/\/$/,""):typeof window<"u"&&window.location.origin?window.location.origin:"",[o]),le=(0,i.useCallback)(()=>{g.current=Date.now(),G("0:00"),O.current&&clearInterval(O.current),O.current=setInterval(()=>{let s=Date.now()-g.current,M=Math.floor(s/1e3),x=Math.floor(M/60),ee=M%60;G(`${x}:${String(ee).padStart(2,"0")}`)},250)},[]),_=(0,i.useCallback)(()=>{O.current&&(clearInterval(O.current),O.current=null)},[]),X=(0,i.useCallback)(async()=>{try{P("connecting"),le();let s=v?`${v}/api/token?businessId=${encodeURIComponent(t)}`:`/api/token?businessId=${encodeURIComponent(t)}`,M=await fetch(s);if(!M.ok)throw new Error(`Failed to fetch session token (${M.status})`);let x=await M.json();if(x.business_name&&!y&&Y(x.business_name),!x.token)throw new Error("Invalid session token payload received from host");let ee=l||x.agent_id||"",B=new U({onStatusChange:C=>{if(P(C),C==="connected")$.current=Date.now(),ne?.();else if(C==="idle"&&(_(),$.current>0)){let c=Math.round((Date.now()-$.current)/1e3);$.current=0,H?.(c)}},onTranscript:C=>{if(D(c=>[...c,C]),se?.(C),C.who==="agent"){let c=C.text.toLowerCase();(c.replace(/[\s\-_]/g,"").includes("email")||c.includes("e-mail")||c.includes("email")||c.includes("mail address")||c.includes("your mail")||c.includes("send your confirmation")||c.includes("send the confirmation")||c.includes("calendar invite")||c.includes("where should i send")||c.includes("where can i send")||c.includes("what is your address")||c.includes("spell your")||c.includes("provide your")||c.includes("type your"))&&T(!0)}},onAudioLevel:(C,c)=>{ie(C),re(c)},onError:()=>{P("error"),_()}});A.current=B,await B.start(x.token,ee)}catch{P("error"),_()}},[v,t,l,y,ne,H,se,le,_]),ce=(0,i.useCallback)(()=>{if(A.current&&(A.current.stop(),A.current=null),P("idle"),ie(0),re(0),_(),T(!1),h(""),N(""),$.current>0){let s=Math.round((Date.now()-$.current)/1e3);$.current=0,H?.(s)}},[H,_]),p=(0,i.useCallback)(async s=>{s.preventDefault();let M=I.trim();if(M){f(!0),h(""),N("");try{let x=v?v.replace(/\/$/,""):"",ee=await fetch(`${x}/api/tools/${encodeURIComponent(t)}/verify_customer_email`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:M})}),B=await ee.json();if(!ee.ok||!B.valid||!B.email){h(B.message||"Invalid email or domain has no active mail server."),f(!1);return}let C=B.email;N(`Verified: ${C}. Sent to agent.`),D(c=>[...c,{who:"user",text:`My email is ${C}`}]),A.current&&A.current.sendEmailInput(C),F(""),setTimeout(()=>{T(!1),N("")},2500)}catch(x){h(x.message||"Failed to verify email with mail server.")}finally{f(!1)}}},[I,v,t]);(0,i.useEffect)(()=>()=>{_(),A.current&&A.current.stop()},[_]);let L=m==="bottom-left",u=k==="connected";return(0,e.jsxs)("div",{className:S,style:{position:"relative",zIndex:99999},children:[(0,e.jsx)("div",{style:{position:"fixed",bottom:"20px",left:L?"20px":"auto",right:L?"auto":"20px",zIndex:99999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:(0,e.jsxs)("button",{type:"button",onClick:()=>te(!q),style:{display:"inline-flex",alignItems:"center",gap:"10px",background:W?"#18181b":"#ffffff",color:W?"#fafafa":"#09090b",border:`1px solid ${W?"#27272a":"#e4e4e7"}`,padding:"10px 18px",borderRadius:"9999px",cursor:"pointer",fontSize:"13px",fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.18)",transition:"transform 0.15s ease, background 0.15s ease"},onMouseEnter:s=>{s.currentTarget.style.transform="scale(1.02)"},onMouseLeave:s=>{s.currentTarget.style.transform="scale(1)"},children:[(0,e.jsx)("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:u?"#ef4444":R,boxShadow:`0 0 8px ${u?"#ef4444":R}`}}),(0,e.jsx)("span",{children:E}),(0,e.jsx)("span",{style:{fontSize:"11px",opacity:.6},children:"\u25B2"})]})}),q&&(0,e.jsxs)(e.Fragment,{children:[a&&(0,e.jsx)("div",{onClick:()=>J(!1),style:{position:"fixed",inset:0,background:"rgba(0, 0, 0, 0.7)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",zIndex:999998}}),(0,e.jsxs)("div",{style:{position:"fixed",bottom:a?"auto":"80px",left:a?"50%":L?"20px":"auto",right:a||L?"auto":"20px",top:a?"50%":"auto",transform:a?"translate(-50%, -50%)":"none",width:a?"calc(100vw - 40px)":"390px",maxWidth:a?"1140px":"calc(100vw - 32px)",height:a?"calc(100vh - 40px)":"560px",maxHeight:a?"900px":"calc(100vh - 100px)",background:"#ffffff",border:"1px solid #e4e4e7",borderRadius:"20px",boxShadow:a?"0 32px 64px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)":"0 24px 48px -12px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:999999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",transition:"all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"},children:[(0,e.jsxs)("div",{style:{background:"#18181b",color:"#ffffff",padding:a?"16px 22px":"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",userSelect:"none",flexShrink:0},children:[(0,e.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"10px",minWidth:0},children:[(0,e.jsx)("div",{style:{color:"rgba(255,255,255,0.6)",display:"grid",placeItems:"center",flexShrink:0},children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("circle",{cx:"12",cy:"12",r:"1"}),(0,e.jsx)("circle",{cx:"12",cy:"5",r:"1"}),(0,e.jsx)("circle",{cx:"12",cy:"19",r:"1"})]})}),(0,e.jsx)("div",{style:{width:"28px",height:"28px",borderRadius:"50%",background:"rgba(255,255,255,0.15)",display:"grid",placeItems:"center",flexShrink:0,color:"#ffffff"},children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,e.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),(0,e.jsx)("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]})}),(0,e.jsxs)("div",{style:{display:"flex",flexDirection:"column",minWidth:0},children:[(0,e.jsx)("div",{style:{fontSize:"13.5px",fontWeight:600,color:"#ffffff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},children:K}),(0,e.jsxs)("div",{style:{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"11px",color:"rgba(255,255,255,0.75)"},children:[(0,e.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:u?"#22c55e":k==="connecting"?"#eab308":"rgba(255,255,255,0.4)"}}),(0,e.jsx)("span",{children:u?"Live \xB7 Speaking":k==="connecting"?"Connecting...":k==="error"?"Error":"Idle \xB7 Ready"})]})]})]}),(0,e.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[(0,e.jsx)("button",{type:"button",onClick:()=>J(!a),title:a?"Exit Fullscreen":"Open Full",style:{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"7px",color:"#ffffff",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:s=>s.currentTarget.style.background="rgba(255,255,255,0.2)",onMouseLeave:s=>s.currentTarget.style.background="rgba(255,255,255,0.1)",children:a?(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("polyline",{points:"4 14 10 14 10 20"}),(0,e.jsx)("polyline",{points:"20 10 14 10 14 4"}),(0,e.jsx)("line",{x1:"14",y1:"10",x2:"21",y2:"3"}),(0,e.jsx)("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]}):(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("polyline",{points:"15 3 21 3 21 9"}),(0,e.jsx)("polyline",{points:"9 21 3 21 3 15"}),(0,e.jsx)("line",{x1:"21",y1:"3",x2:"14",y2:"10"}),(0,e.jsx)("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]})}),(0,e.jsx)("button",{type:"button",onClick:()=>{u&&ce(),te(!1)},title:"Close Widget",style:{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"7px",color:"#ffffff",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:s=>s.currentTarget.style.background="rgba(255,255,255,0.2)",onMouseLeave:s=>s.currentTarget.style.background="rgba(255,255,255,0.1)",children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("line",{x1:"18",y1:"6",x2:"6",y2:"18"}),(0,e.jsx)("line",{x1:"6",y1:"6",x2:"18",y2:"18"})]})})]})]}),(0,e.jsxs)("div",{style:{flex:1,minHeight:0,padding:"16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"12px",background:"#ffffff"},children:[V.length===0&&(0,e.jsxs)("div",{style:{margin:"auto",textAlign:"center",padding:"10px 18px",background:"#f4f4f5",border:"1px solid #e4e4e7",color:"#52525b",borderRadius:"12px",fontSize:"12.5px",fontWeight:500,display:"inline-flex",alignItems:"center",gap:"8px",alignSelf:"center"},children:[(0,e.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:u?"#22c55e":"#a1a1aa",display:"inline-block"}}),(0,e.jsx)("span",{children:u?"Connected \xB7 Speak to our receptionist":k==="connecting"?"Connecting to receptionist...":"Start a call to talk to our receptionist"})]}),V.map((s,M)=>{let x=s.who==="user";return(0,e.jsx)("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:x?"flex-end":"flex-start"},children:(0,e.jsxs)("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[!x&&(0,e.jsx)("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,e.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),(0,e.jsx)("div",{style:{padding:"10px 14px",borderRadius:x?"14px 14px 2px 14px":"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:x?"#18181b":"#f4f4f5",color:x?"#ffffff":"#09090b",boxShadow:"0 1px 2px rgba(0,0,0,0.04)"},children:s.text})]})},M)}),(0,e.jsx)("div",{ref:Q})]}),r&&u&&(0,e.jsxs)("div",{style:{padding:"11px 16px",background:"#f0fdf4",borderTop:"1px solid #bbf7d0",display:"flex",flexDirection:"column",gap:"7px",flexShrink:0},children:[(0,e.jsxs)("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"},children:[(0,e.jsxs)("span",{style:{fontSize:"11px",fontWeight:700,color:"#15803d",textTransform:"uppercase",letterSpacing:"0.04em",display:"inline-flex",alignItems:"center",gap:"6px"},children:[(0,e.jsx)("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:"#22c55e",display:"inline-block"}}),"Agent Requesting Email \u2022 Verified Mailbox Entry"]}),(0,e.jsx)("button",{type:"button",onClick:()=>T(!1),style:{background:"none",border:"none",color:"#15803d",cursor:"pointer",fontSize:"12px",fontWeight:700,padding:"1px 4px"},children:"\u2715"})]}),(0,e.jsxs)("form",{onSubmit:p,style:{display:"flex",gap:"6px"},children:[(0,e.jsx)("input",{type:"email",autoFocus:!0,value:I,onChange:s=>{F(s.target.value),h("")},placeholder:"Enter your real email (e.g. name@gmail.com)",disabled:z,required:!0,style:{flex:1,fontSize:"12.5px",padding:"7px 11px",borderRadius:"7px",border:j?"1.5px solid #ef4444":"1px solid #86efac",background:"#ffffff",color:"#09090b",outline:"none"}}),(0,e.jsx)("button",{type:"submit",disabled:z||!I.trim(),style:{background:"#16a34a",color:"#ffffff",border:"none",padding:"7px 14px",borderRadius:"7px",fontSize:"12px",fontWeight:600,cursor:z?"wait":"pointer",opacity:z?.7:1},children:z?"...":"Verify & Send"})]}),j&&(0,e.jsxs)("div",{style:{fontSize:"11px",color:"#ef4444",fontWeight:500},children:["\u26A0\uFE0F ",j]}),ae&&(0,e.jsxs)("div",{style:{fontSize:"11px",color:"#15803d",fontWeight:600},children:["\u2713 ",ae]})]}),(0,e.jsxs)("div",{style:{padding:"12px 16px",borderTop:"1px solid #e4e4e7",background:"#fafafa",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0},children:[(0,e.jsxs)("button",{type:"button",onClick:u?ce:X,disabled:k==="connecting",style:{display:"inline-flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:u?"#dc2626":"#000000",color:"#ffffff",borderRadius:"10px",border:"none",fontSize:"13px",fontWeight:600,cursor:k==="connecting"?"not-allowed":"pointer",transition:"all 0.15s ease"},children:[(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,e.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,e.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),(0,e.jsx)("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]}),(0,e.jsx)("span",{children:u?"End Voice Call":k==="connecting"?"Connecting...":"Start Voice Call"})]}),(0,e.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[u&&(0,e.jsx)("div",{style:{display:"flex",alignItems:"center",gap:"2.5px",height:"14px"},children:[12,8,14,6,10].map((s,M)=>(0,e.jsx)("span",{style:{width:"2.5px",height:`${Math.max(4,Math.min(14,Math.round(s*(.35+Math.max(oe,ue)*1.5))))}px`,background:"#000000",borderRadius:"1px",transition:"height 0.12s ease"}},M))}),(0,e.jsx)("span",{style:{fontFamily:"var(--mono, monospace)",fontSize:"12px",fontWeight:600,padding:"3px 8px",borderRadius:"6px",background:u?"#000000":"#f4f4f5",color:u?"#ffffff":"#71717a"},children:Z})]})]})]})]})]})}var xe=he;var _e={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function pe(o={}){if(typeof window>"u")return;let{host:t,businessId:l="biz_demo_dental",agentId:d,theme:m="dark",position:E="bottom-right",label:n="Talk to Receptionist",accent:b="emerald",accentColor:y,businessName:w,greeting:S,onCallStart:ne,onCallEnd:H,onTranscript:se}=o,q=y||_e[b]||b||"#10b981",te=document.getElementById("omnidesk-voice-widget-root");te&&te.remove();let a=document.createElement("div");a.id="omnidesk-voice-widget-root",a.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let J=m==="dark"||m==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,k=null,P="idle",V=0,D=null,oe=!1,ie=!1,ue=0,re=0,Z=E==="bottom-left",G=document.createElement("div");G.style.cssText=`
    position: fixed; bottom: 20px; ${Z?"left: 20px;":"right: 20px;"};
    z-index: 999999;
  `;let K=document.createElement("button");K.style.cssText=`
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${J?"#18181b":"#ffffff"}; color: ${J?"#fafafa":"#09090b"};
    border: 1px solid ${J?"#27272a":"#e4e4e7"};
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `,K.innerHTML=`
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${q};box-shadow:0 0 8px ${q};display:inline-block;"></span>
    <span>${n}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,G.appendChild(K);let Y=document.createElement("div");Y.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,Y.onclick=()=>Q(!1);let r=document.createElement("div");r.style.cssText=`
    position: fixed; bottom: 80px; ${Z?"left: 20px;":"right: 20px;"};
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
  `;let I=document.createElement("div");I.style.cssText=`
    flex: 1; min-height: 0; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 12px; background: #ffffff;
  `;let F=document.createElement("div");F.id="omnidesk-placeholder-banner",F.style.cssText=`
    margin: auto; text-align: center; padding: 10px 18px;
    background: #f4f4f5; border: 1px solid #e4e4e7; color: #52525b;
    border-radius: 12px; font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px; align-self: center;
  `,F.innerHTML=`
    <span style="width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block;"></span>
    <span>Start a call to talk to our receptionist</span>
  `,I.appendChild(F);let z=document.createElement("div");z.style.cssText=`
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
  `;let j=document.createElement("div");j.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let h=document.createElement("span");h.id="omnidesk-timer",h.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,h.innerText="0:00",j.appendChild(h),z.appendChild(f),z.appendChild(j),r.appendChild(T),r.appendChild(I),r.appendChild(z),a.appendChild(G),a.appendChild(Y),a.appendChild(r),document.body.appendChild(a);function ae(){V=Date.now(),h.innerText="0:00",h.style.background="#000000",h.style.color="#ffffff",D&&clearInterval(D),D=setInterval(()=>{let g=Date.now()-V,R=Math.floor(g/1e3),W=Math.floor(R/60),v=R%60;h.innerText=`${W}:${String(v).padStart(2,"0")}`},250)}function N(){D&&(clearInterval(D),D=null),h.style.background="#f4f4f5",h.style.color="#71717a",h.innerText="0:00"}function A(g){oe=g,r.style.display=g?"flex":"none"}function Q(g){ie=g,Y.style.display=g?"block":"none",g?(r.style.top="50%",r.style.left="50%",r.style.bottom="auto",r.style.right="auto",r.style.transform="translate(-50%, -50%)",r.style.width="calc(100vw - 40px)",r.style.maxWidth="1140px",r.style.height="calc(100vh - 40px)",r.style.maxHeight="900px"):(r.style.top="auto",r.style.left=Z?"20px":"auto",r.style.right=Z?"auto":"20px",r.style.bottom="80px",r.style.transform="none",r.style.width="390px",r.style.maxWidth="calc(100vw - 32px)",r.style.height="560px",r.style.maxHeight="calc(100vh - 100px)")}K.onclick=()=>A(!oe),T.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{A(!1),Q(!1)}),T.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{Q(!ie)});async function $(){let g=T.querySelector("#omnidesk-status-text"),R=T.querySelector("#omnidesk-status-dot"),W=f.querySelector("#omnidesk-btn-text");g.innerText="Connecting...",R.style.background="#eab308",W.innerText="Connecting...",f.disabled=!0,ae();try{let v=t;if(!v&&typeof document<"u"){let p=document.querySelector("script[src*='widget.js']");if(p&&p.src&&p.src.startsWith("http"))try{v=new URL(p.src).origin}catch{}}!v&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(v=window.location.origin);let le=(v||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),_=await fetch(`${le}/api/token?businessId=${encodeURIComponent(l)}`);if(!_.ok)throw new Error(`Failed to get session token (${_.status})`);let X=await _.json();if(X.business_name&&!w){let p=T.querySelector("#omnidesk-biz-title");p&&(p.innerText=X.business_name)}let ce=d||X.agent_id||"";k=new U({onStatusChange:p=>{if(P=p,p==="connected")g.innerText="Live \xB7 Speaking",R.style.background="#22c55e",W.innerText="End Voice Call",f.style.background="#dc2626",f.disabled=!1,V=Date.now(),ne?.();else if(p==="idle"&&(g.innerText="Idle \xB7 Ready",R.style.background="rgba(255,255,255,0.4)",W.innerText="Start Voice Call",f.style.background="#000000",f.disabled=!1,N(),V>0)){let L=Math.round((Date.now()-V)/1e3);V=0,H?.(L)}},onTranscript:p=>{F.style.display="none";let L=document.createElement("div"),u=p.who==="user";L.style.cssText=`
            display: flex; flex-direction: column; gap: 4px; max-width: 88%;
            align-self: ${u?"flex-end":"flex-start"};
          `;let s=document.createElement("div");s.style.cssText=`
            padding: 10px 14px; border-radius: ${u?"14px 14px 2px 14px":"14px 14px 14px 2px"};
            font-size: 13px; line-height: 1.45;
            background: ${u?"#18181b":"#f4f4f5"};
            color: ${u?"#ffffff":"#09090b"};
            box-shadow: 0 1px 2px rgba(0,0,0,0.04);
          `,s.innerText=p.text,L.appendChild(s),I.appendChild(L),I.scrollTop=I.scrollHeight,se?.(p)},onAudioLevel:(p,L)=>{ue=p,re=L},onError:()=>{g.innerText="Error",R.style.background="#ef4444",W.innerText="Start Voice Call",f.style.background="#000000",f.disabled=!1,N()}}),await k.start(X.token,ce)}catch(v){console.error("[OmniDesk Voice Widget Error]:",v),g.innerText="Error",R.style.background="#ef4444",W.innerText="Start Voice Call",f.style.background="#000000",f.disabled=!1,N()}}function O(){k&&(k.stop(),k=null),P="idle",N()}return f.onclick=()=>{P==="connected"?O():P==="idle"&&$()},{destroy:()=>{N(),k&&k.stop(),a.remove()},startCall:$,endCall:O}}if(typeof document<"u"){let o=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(o){let t,l=o.src||"";if(l&&l.startsWith("http"))try{t=new URL(l).origin}catch{}let d=o.getAttribute("data-business-id")||void 0,m=o.getAttribute("data-agent")||void 0,E=o.getAttribute("data-theme")||"dark",n=o.getAttribute("data-accent")||"emerald",b=o.getAttribute("data-position")||"bottom-right",y=o.getAttribute("data-label")||void 0,w=o.getAttribute("data-host")||t||"https://omni-desk-rho.vercel.app",S=o.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{pe({businessId:d,agentId:m,theme:E,accent:n,position:b,label:y,host:w,greeting:S})}):pe({businessId:d,agentId:m,theme:E,accent:n,position:b,label:y,host:w,greeting:S})}}0&&(module.exports={AssemblyAIVoiceClient,OmniDeskWidget,VoiceWidget,initOmniDeskWidget});
//# sourceMappingURL=index.js.map