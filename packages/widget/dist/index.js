"use strict";var te=Object.defineProperty;var oe=Object.getOwnPropertyDescriptor;var ae=Object.getOwnPropertyNames;var re=Object.prototype.hasOwnProperty;var le=(a,n)=>{for(var c in n)te(a,c,{get:n[c],enumerable:!0})},de=(a,n,c,p)=>{if(n&&typeof n=="object"||typeof n=="function")for(let u of ae(n))!re.call(a,u)&&u!==c&&te(a,u,{get:()=>n[u],enumerable:!(p=oe(n,u))||p.enumerable});return a};var ce=a=>de(te({},"__esModule",{value:!0}),a);var fe={};le(fe,{AssemblyAIVoiceClient:()=>U,OmniDeskWidget:()=>se,VoiceWidget:()=>ie,initOmniDeskWidget:()=>Q});module.exports=ce(fe);var l=require("react");var X=24e3,pe="wss://agents.assemblyai.com/v1/ws",ue=`
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${X};
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
`,he=`
  class PlaybackProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ring = new Float32Array(sampleRate * 30);
      this._writePos = 0;
      this._readPos = 0;
      this._available = 0;
      this._step = ${X} / sampleRate;
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
`;async function ne(a,n,c){let p=URL.createObjectURL(new Blob([n],{type:"application/javascript"}));try{await a.audioWorklet.addModule(p)}finally{URL.revokeObjectURL(p)}return new AudioWorkletNode(a,c)}var U=class{constructor(n){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.callbacks=n}async start(n,c){try{this.callbacks.onStatusChange?.("connecting");let p=window.AudioContext||window.webkitAudioContext;this.captureCtx=new p({sampleRate:X}),this.playbackCtx=new p({sampleRate:X}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await ne(this.playbackCtx,he,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await ne(this.captureCtx,ue,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let u=new URL(pe);u.searchParams.set("token",n),this.ws=new WebSocket(u.toString()),this.captureNode.port.onmessage=({data:k})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let i=new Uint8Array(k),h="";for(let f=0;f<i.length;f+=32768)h+=String.fromCharCode.apply(null,Array.from(i.subarray(f,f+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(h)}));let v=new Int16Array(k),C=0;for(let f=0;f<v.length;f+=16)C+=Math.abs(v[f]);this.userLevel=Math.min(1,C/(v.length/16)/8e3)},this.ws.onopen=()=>{c&&c.trim()&&this.ws?.send(JSON.stringify({type:"session.update",session:{agent_id:c.trim()}}))},this.ws.onmessage=({data:k})=>{try{let i=JSON.parse(k);switch(i.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0;break;case"transcript.user":i.text&&this.callbacks.onTranscript?.({who:"user",text:i.text});break;case"transcript.agent":i.text&&this.callbacks.onTranscript?.({who:"agent",text:i.text});break;case"reply.audio":if(i.data&&this.playbackNode){let h=atob(i.data),v=new Uint8Array(h.length);for(let C=0;C<h.length;C++)v[C]=h.charCodeAt(C);this.playbackNode.port.postMessage(v.buffer,[v.buffer]),this.agentLevel=.8}break;case"reply.done":i.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:i.name||i.tool,args:i.arguments||i.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:i.name||i.tool,result:i.result});break;case"session.error":this.callbacks.onError?.(i.message||i.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.stop();break}}catch(i){console.warn("Message parsing error:",i)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(p){this.callbacks.onError?.(p.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(n){this.isMuted=n,n&&(this.userLevel=0)}getMuted(){return this.isMuted}stop(){if(this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(n=>n.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let n=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(n)};this.animFrameId=requestAnimationFrame(n)}};var s=require("react/jsx-runtime"),be={slate:"#18181b",purple:"#7c3aed",blue:"#2563eb",emerald:"#059669"};function se({host:a,businessId:n="biz_demo_dental",agentId:c,theme:p="dark",position:u="bottom-right",label:k="Talk to Receptionist",accent:i="slate",accentColor:h,suggestions:v,className:C,onCallStart:f,onCallEnd:K,onTranscript:Y}){let[S,j]=(0,l.useState)(!1),[b,M]=(0,l.useState)(!1),[t,x]=(0,l.useState)("idle"),[I,R]=(0,l.useState)([]),[H,q]=(0,l.useState)(0),[V,F]=(0,l.useState)(0),[_,E]=(0,l.useState)(!1),[o,w]=(0,l.useState)("AI Voice Receptionist"),[P,z]=(0,l.useState)(""),d=(0,l.useRef)(null),r=(0,l.useRef)(null),W=(0,l.useRef)(0),T=(0,l.useMemo)(()=>h||be[i]||i||"#18181b",[i,h]);(0,l.useEffect)(()=>{r.current?.scrollIntoView({behavior:"smooth"})},[I]);let m=(0,l.useMemo)(()=>a?a.replace(/\/$/,""):typeof window<"u"&&window.location.origin?window.location.origin:"",[a]),O=(0,l.useCallback)(async()=>{try{x("connecting"),z(""),R([]);let g=m?`${m}/api/token?businessId=${encodeURIComponent(n)}`:`/api/token?businessId=${encodeURIComponent(n)}`,$=await fetch(g);if(!$.ok)throw new Error(`Failed to fetch session token (${$.status})`);let y=await $.json();if(y.business_name&&w(y.business_name),!y.token)throw new Error("Invalid session token payload received from host");let ee=c||y.agent_id||"",G=new U({onStatusChange:L=>{if(x(L),L==="connected")W.current=Date.now(),f?.();else if(L==="idle"&&W.current>0){let J=Math.round((Date.now()-W.current)/1e3);W.current=0,K?.(J)}},onTranscript:L=>{R(J=>[...J,L]),Y?.(L)},onAudioLevel:(L,J)=>{q(L),F(J)},onError:L=>{z(L),x("error")}});d.current=G,await G.start(y.token,ee)}catch(g){z(g.message||"Failed to start call"),x("error")}},[m,n,c,f,K,Y]),Z=(0,l.useCallback)(()=>{d.current&&(d.current.stop(),d.current=null),x("idle"),E(!1)},[]),D=(0,l.useCallback)(()=>{if(d.current){let g=!_;d.current.setMuted(g),E(g)}},[_]);(0,l.useEffect)(()=>()=>{d.current&&d.current.stop()},[]);let N=p==="dark"||p==="auto"&&typeof window<"u"&&window.matchMedia("(prefers-color-scheme: dark)").matches,e={bg:N?"#09090b":"#ffffff",cardBg:N?"#121215":"#f4f4f5",border:N?"#27272a":"#e4e4e7",text:N?"#fafafa":"#09090b",textMuted:N?"#a1a1aa":"#71717a",bubbleAgent:N?"#18181b":"#f4f4f5",bubbleUser:T,userText:"#ffffff"},A=u==="bottom-left",B=v||["Check availability","Book consultation","Pricing & services"];return(0,s.jsxs)("div",{className:C,children:[S&&b&&(0,s.jsx)("div",{onClick:()=>M(!1),style:{position:"fixed",inset:0,background:"rgba(0, 0, 0, 0.65)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",zIndex:999998,transition:"all 0.25s ease"}}),!S&&(0,s.jsx)("div",{style:{position:"fixed",bottom:"24px",left:A?"24px":"auto",right:A?"auto":"24px",zIndex:999999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:(0,s.jsxs)("button",{onClick:()=>{j(!0),t==="idle"&&O()},style:{display:"flex",alignItems:"center",gap:"10px",padding:"12px 20px",borderRadius:"9999px",background:e.bg,color:e.text,border:`1px solid ${e.border}`,boxShadow:"0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.2)",cursor:"pointer",fontWeight:600,fontSize:"14px",transition:"all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"},children:[(0,s.jsx)("span",{style:{width:"10px",height:"10px",borderRadius:"50%",background:t==="connected"?T:t==="connecting"?"#f59e0b":"#71717a",boxShadow:t==="connected"?`0 0 10px ${T}`:"none"}}),k]})}),S&&(0,s.jsxs)("div",{style:{position:"fixed",...b?{top:"50%",left:"50%",transform:"translate(-50%, -50%)",width:"min(640px, 92vw)",height:"min(720px, 86vh)",maxHeight:"800px"}:{bottom:"24px",left:A?"24px":"auto",right:A?"auto":"24px",width:"370px",height:"560px",maxHeight:"85vh"},zIndex:999999,background:e.bg,border:`1px solid ${e.border}`,borderRadius:b?"24px":"20px",boxShadow:"0 25px 50px -12px rgba(0, 0, 0, 0.4)",display:"flex",flexDirection:"column",overflow:"hidden",fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",transition:"all 0.3s cubic-bezier(0.16, 1, 0.3, 1)"},children:[(0,s.jsxs)("div",{style:{padding:"14px 18px",borderBottom:`1px solid ${e.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:e.cardBg},children:[(0,s.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"10px"},children:[(0,s.jsx)("div",{style:{width:"34px",height:"34px",borderRadius:"50%",background:T,color:"#ffffff",display:"grid",placeItems:"center",fontSize:"14px",flexShrink:0},children:(0,s.jsxs)("svg",{width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[(0,s.jsx)("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),(0,s.jsx)("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),(0,s.jsx)("line",{x1:"12",x2:"12",y1:"19",y2:"22"})]})}),(0,s.jsxs)("div",{children:[(0,s.jsx)("div",{style:{fontWeight:700,fontSize:"14px",color:e.text},children:o}),(0,s.jsxs)("div",{style:{fontSize:"11px",color:e.textMuted,display:"flex",alignItems:"center",gap:"6px",marginTop:"2px"},children:[(0,s.jsx)("span",{style:{width:"7px",height:"7px",borderRadius:"50%",background:t==="connected"?"#10b981":t==="connecting"?"#f59e0b":"#71717a"}}),t==="connected"?"Live Receptionist":t==="connecting"?"Connecting...":"Call Ended"]})]})]}),(0,s.jsxs)("div",{style:{display:"flex",alignItems:"center",gap:"6px"},children:[(0,s.jsx)("button",{type:"button",onClick:()=>M(!b),style:{background:"transparent",border:"none",color:e.textMuted,cursor:"pointer",padding:"6px",borderRadius:"6px",fontSize:"15px",display:"grid",placeItems:"center"},title:b?"Collapse modal":"Expand fullscreen",children:b?"\u2199":"\u2922"}),(0,s.jsx)("button",{type:"button",onClick:()=>{j(!1),M(!1)},style:{background:"transparent",border:"none",color:e.textMuted,cursor:"pointer",padding:"6px",borderRadius:"6px",fontSize:"15px",display:"grid",placeItems:"center"},title:"Close",children:"\u2715"})]})]}),(0,s.jsx)("div",{style:{padding:"12px 18px",background:e.bg,borderBottom:`1px solid ${e.border}`,display:"flex",alignItems:"center",justifyContent:"center",gap:"5px",height:"56px"},children:[35,65,85,55,95,70,45,80,55,30,60,40].map((g,$)=>{let y=t==="connected",ee=y?Math.max(H,V):0,G=Math.max(6,Math.min(42,g*(.25+ee*1.6)));return(0,s.jsx)("div",{style:{width:"4px",height:`${G}px`,borderRadius:"4px",background:y&&V>.08?T:e.border,transition:"height 0.1s ease, background 0.2s ease"}},$)})}),(0,s.jsxs)("div",{style:{flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:"10px"},children:[I.length===0&&(0,s.jsx)("div",{style:{margin:"auto",textAlign:"center",color:e.textMuted,fontSize:"13px",lineHeight:1.5,padding:"0 20px"},children:t==="connecting"?"Connecting to AI Receptionist...":t==="connected"?"Receptionist is listening. Say hello or ask to book an appointment!":P?(0,s.jsx)("span",{style:{color:"#ef4444"},children:P}):"Click Start Call to speak with the autonomous receptionist."}),I.map((g,$)=>{let y=g.who==="user";return(0,s.jsx)("div",{style:{display:"flex",justifyContent:y?"flex-end":"flex-start"},children:(0,s.jsx)("div",{style:{maxWidth:b?"70%":"82%",padding:"9px 13px",borderRadius:y?"14px 14px 2px 14px":"14px 14px 14px 2px",background:y?e.bubbleUser:e.bubbleAgent,color:y?e.userText:e.text,fontSize:"13px",lineHeight:1.45,wordBreak:"break-word"},children:g.text})},$)}),(0,s.jsx)("div",{ref:r})]}),B.length>0&&t==="connected"&&(0,s.jsx)("div",{style:{padding:"8px 16px",display:"flex",gap:"6px",overflowX:"auto",borderTop:`1px solid ${e.border}`,background:e.cardBg},children:B.map((g,$)=>(0,s.jsx)("div",{style:{fontSize:"11.5px",padding:"4px 10px",borderRadius:"9999px",background:e.bg,border:`1px solid ${e.border}`,color:e.textMuted,whiteSpace:"nowrap",cursor:"default"},children:g},$))}),(0,s.jsx)("div",{style:{padding:"14px 16px",borderTop:`1px solid ${e.border}`,background:e.cardBg,display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px"},children:t==="connected"?(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)("button",{type:"button",onClick:D,style:{flex:1,padding:"10px",borderRadius:"10px",border:`1px solid ${e.border}`,background:_?"#ef4444":e.bg,color:_?"#ffffff":e.text,fontSize:"12.5px",fontWeight:600,cursor:"pointer",transition:"all 0.15s ease"},children:_?"Unmute Mic":"Mute Mic"}),(0,s.jsx)("button",{type:"button",onClick:Z,style:{flex:1,padding:"10px",borderRadius:"10px",border:"none",background:"#ef4444",color:"#ffffff",fontSize:"12.5px",fontWeight:600,cursor:"pointer",transition:"all 0.15s ease"},children:"End Call"})]}):(0,s.jsx)("button",{type:"button",onClick:O,disabled:t==="connecting",style:{width:"100%",padding:"11px",borderRadius:"10px",border:"none",background:T,color:"#ffffff",fontSize:"13px",fontWeight:600,cursor:t==="connecting"?"not-allowed":"pointer",opacity:t==="connecting"?.7:1,transition:"all 0.15s ease"},children:t==="connecting"?"Connecting...":"Start Call"})})]})]})}var ie=se;var xe={slate:"#18181b",purple:"#7c3aed",blue:"#2563eb",emerald:"#059669"};function Q(a={}){if(typeof window>"u")return;let{host:n,businessId:c="biz_demo_dental",agentId:p,theme:u="dark",position:k="bottom-right",label:i="Talk to Receptionist",accent:h="slate",accentColor:v,suggestions:C,onCallStart:f,onCallEnd:K,onTranscript:Y}=a,S=v||xe[h]||h||"#18181b",j=document.getElementById("omnidesk-voice-widget-root");j&&j.remove();let b=document.createElement("div");b.id="omnidesk-voice-widget-root",b.style.fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let M=u==="dark"||u==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,t={bg:M?"#09090b":"#ffffff",cardBg:M?"#121215":"#f4f4f5",border:M?"#27272a":"#e4e4e7",text:M?"#fafafa":"#09090b",textMuted:M?"#a1a1aa":"#71717a",bubbleAgent:M?"#18181b":"#f4f4f5",bubbleUser:S,userText:"#ffffff"},x=null,I="idle",R=!1,H=0,q=!1,V=k==="bottom-left",F=document.createElement("div");F.style.cssText=`
    position: fixed; bottom: 24px; ${V?"left: 24px;":"right: 24px;"}
    z-index: 999999;
  `;let _=document.createElement("button");_.style.cssText=`
    display: flex; align-items: center; gap: 10px;
    padding: 12px 20px; border-radius: 9999px;
    background: ${t.bg}; color: ${t.text};
    border: 1px solid ${t.border};
    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.2);
    cursor: pointer; font-weight: 600; font-size: 14px;
    transition: all 0.2s ease;
  `,_.innerHTML=`
    <span style="width:10px;height:10px;border-radius:50%;background:#71717a;display:inline-block;"></span>
    <span>${i}</span>
  `,F.appendChild(_);let E=document.createElement("div");E.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.65);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    z-index: 999998; display: none;
  `;let o=document.createElement("div");o.style.cssText=`
    position: fixed; bottom: 24px; ${V?"left: 24px;":"right: 24px;"}
    width: 370px; height: 560px; max-height: 85vh;
    background: ${t.bg}; border: 1px solid ${t.border};
    border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  `;let w=document.createElement("div");w.style.cssText=`
    padding: 14px 18px; border-bottom: 1px solid ${t.border};
    display: flex; align-items: center; justify-content: space-between;
    background: ${t.cardBg};
  `,w.innerHTML=`
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="width: 34px; height: 34px; border-radius: 50%; background: ${S}; color: #fff; display: grid; place-items: center; font-size: 14px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
      </div>
      <div>
        <div style="font-weight:700;font-size:14px;color:${t.text};" id="omnidesk-biz-title">AI Receptionist</div>
        <div style="font-size:11px;color:${t.textMuted};margin-top:2px;display:flex;align-items:center;gap:6px;" id="omnidesk-status-text">
          <span style="width:7px;height:7px;border-radius:50%;background:#71717a;display:inline-block;"></span> Ready
        </div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;">
      <button id="omnidesk-expand-btn" style="background:transparent;border:none;color:${t.textMuted};cursor:pointer;padding:6px;font-size:15px;" title="Expand">\u2922</button>
      <button id="omnidesk-close-btn" style="background:transparent;border:none;color:${t.textMuted};cursor:pointer;padding:6px;font-size:15px;" title="Close">\u2715</button>
    </div>
  `;let P=document.createElement("div");P.style.cssText=`
    flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px;
  `;let z=document.createElement("div");z.style.cssText=`
    padding: 14px 16px; border-top: 1px solid ${t.border};
    background: ${t.cardBg}; display: flex; gap: 10px;
  `;let d=document.createElement("button");d.style.cssText=`
    display: none; flex: 1; padding: 10px; border-radius: 10px; border: 1px solid ${t.border};
    background: ${t.bg}; color: ${t.text}; font-size: 12.5px; font-weight: 600; cursor: pointer;
  `,d.innerText="Mute Mic";let r=document.createElement("button");r.style.cssText=`
    width: 100%; padding: 11px; border-radius: 10px; border: none;
    background: ${S}; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
    transition: all 0.15s ease;
  `,r.innerText="Start Call",z.appendChild(d),z.appendChild(r),o.appendChild(w),o.appendChild(P),o.appendChild(z),b.appendChild(E),b.appendChild(F),b.appendChild(o),document.body.appendChild(b);function W(m){q=m,m?(E.style.display="block",o.style.top="50%",o.style.left="50%",o.style.bottom="auto",o.style.right="auto",o.style.transform="translate(-50%, -50%)",o.style.width="min(640px, 92vw)",o.style.height="min(720px, 86vh)",o.style.maxHeight="800px",o.style.borderRadius="24px",w.querySelector("#omnidesk-expand-btn").innerHTML="\u2199"):(E.style.display="none",o.style.top="auto",o.style.left=V?"24px":"auto",o.style.bottom="24px",o.style.right=V?"auto":"24px",o.style.transform="none",o.style.width="370px",o.style.height="560px",o.style.maxHeight="85vh",o.style.borderRadius="20px",w.querySelector("#omnidesk-expand-btn").innerHTML="\u2922")}_.onclick=()=>{F.style.display="none",o.style.display="flex",I==="idle"&&T()},w.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{o.style.display="none",E.style.display="none",F.style.display="block",W(!1)}),w.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{W(!q)}),E.addEventListener("click",()=>{W(!1)}),d.onclick=()=>{x&&(R=!R,x.setMuted(R),d.innerText=R?"Unmute Mic":"Mute Mic",d.style.background=R?"#ef4444":t.bg,d.style.color=R?"#fff":t.text)};async function T(){let m=w.querySelector("#omnidesk-status-text");m.innerHTML='<span style="width:7px;height:7px;border-radius:50%;background:#f59e0b;display:inline-block;"></span> Connecting...',r.innerText="Connecting...",r.disabled=!0;try{let O=n?n.replace(/\/$/,""):typeof window<"u"?window.location.origin:"",Z=await fetch(`${O}/api/token?businessId=${encodeURIComponent(c)}`);if(!Z.ok)throw new Error("Failed to get session token");let D=await Z.json();if(D.business_name){let e=w.querySelector("#omnidesk-biz-title");e&&(e.innerText=D.business_name)}let N=p||D.agent_id||"";x=new U({onStatusChange:e=>{if(I=e,e==="connected")m.innerHTML='<span style="width:7px;height:7px;border-radius:50%;background:#10b981;display:inline-block;"></span> Live Receptionist',r.innerText="End Call",r.style.background="#ef4444",r.style.width="auto",r.style.flex="1",r.disabled=!1,d.style.display="block",H=Date.now(),f?.();else if(e==="idle"&&(m.innerHTML='<span style="width:7px;height:7px;border-radius:50%;background:#71717a;display:inline-block;"></span> Call Ended',r.innerText="Start Call",r.style.background=S,r.style.width="100%",r.disabled=!1,d.style.display="none",H>0)){let A=Math.round((Date.now()-H)/1e3);H=0,K?.(A)}},onTranscript:e=>{let A=document.createElement("div"),B=e.who==="user";A.style.cssText=`
            display: flex; justify-content: ${B?"flex-end":"flex-start"};
          `,A.innerHTML=`
            <div style="max-width:${q?"70%":"82%"};padding:9px 13px;border-radius:${B?"14px 14px 2px 14px":"14px 14px 14px 2px"};background:${B?t.bubbleUser:t.bubbleAgent};color:${B?t.userText:t.text};font-size:13px;line-height:1.45;">
              ${e.text}
            </div>
          `,P.appendChild(A),P.scrollTop=P.scrollHeight,Y?.(e)},onError:e=>{m.innerHTML=`<span style="width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block;"></span> Error: ${e}`,r.innerText="Start Call",r.style.background=S,r.style.width="100%",r.disabled=!1,d.style.display="none"}}),await x.start(D.token,N)}catch(O){m.innerHTML=`<span style="width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block;"></span> ${O.message||"Connection failed"}`,r.innerText="Start Call",r.style.background=S,r.style.width="100%",r.disabled=!1,d.style.display="none"}}return r.onclick=()=>{I==="connected"&&x?(x.stop(),x=null):I==="idle"&&T()},{destroy:()=>{x&&x.stop(),b.remove()},startCall:T}}if(typeof document<"u"){let a=document.currentScript||document.querySelector("script[data-agent], script[data-business-id]");if(a){let n=a.getAttribute("data-business-id")||void 0,c=a.getAttribute("data-agent")||void 0,p=a.getAttribute("data-theme")||"dark",u=a.getAttribute("data-accent")||"slate",k=a.getAttribute("data-position")||"bottom-right",i=a.getAttribute("data-label")||void 0,h=a.getAttribute("data-host")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{Q({businessId:n,agentId:c,theme:p,accent:u,position:k,label:i,host:h})}):Q({businessId:n,agentId:c,theme:p,accent:u,position:k,label:i,host:h})}}0&&(module.exports={AssemblyAIVoiceClient,OmniDeskWidget,VoiceWidget,initOmniDeskWidget});
//# sourceMappingURL=index.js.map