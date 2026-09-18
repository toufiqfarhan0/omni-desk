import{useState as I,useRef as te,useEffect as oe,useCallback as se,useMemo as ae}from"react";var Q=24e3,le="wss://agents.assemblyai.com/v1/ws",de=`
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${Q};
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
`,ce=`
  class PlaybackProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ring = new Float32Array(sampleRate * 30);
      this._writePos = 0;
      this._readPos = 0;
      this._available = 0;
      this._step = ${Q} / sampleRate;
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
`;async function ie(l,a,h){let c=URL.createObjectURL(new Blob([a],{type:"application/javascript"}));try{await l.audioWorklet.addModule(c)}finally{URL.revokeObjectURL(c)}return new AudioWorkletNode(l,h)}var H=class{constructor(a){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.callbacks=a}async start(a,h){try{this.callbacks.onStatusChange?.("connecting");let c=window.AudioContext||window.webkitAudioContext;this.captureCtx=new c({sampleRate:Q}),this.playbackCtx=new c({sampleRate:Q}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await ie(this.playbackCtx,ce,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await ie(this.captureCtx,de,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let w=new URL(le);w.searchParams.set("token",a),this.ws=new WebSocket(w.toString()),this.captureNode.port.onmessage=({data:y})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let s=new Uint8Array(y),d="";for(let b=0;b<s.length;b+=32768)d+=String.fromCharCode.apply(null,Array.from(s.subarray(b,b+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(d)}));let m=new Int16Array(y),C=0;for(let b=0;b<m.length;b+=16)C+=Math.abs(m[b]);this.userLevel=Math.min(1,C/(m.length/16)/8e3)},this.ws.onopen=()=>{h&&h.trim()&&this.ws?.send(JSON.stringify({type:"session.update",session:{agent_id:h.trim()}}))},this.ws.onmessage=({data:y})=>{try{let s=JSON.parse(y);switch(s.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0;break;case"transcript.user":s.text&&this.callbacks.onTranscript?.({who:"user",text:s.text});break;case"transcript.agent":s.text&&this.callbacks.onTranscript?.({who:"agent",text:s.text});break;case"reply.audio":if(s.data&&this.playbackNode){let d=atob(s.data),m=new Uint8Array(d.length);for(let C=0;C<d.length;C++)m[C]=d.charCodeAt(C);this.playbackNode.port.postMessage(m.buffer,[m.buffer]),this.agentLevel=.8}break;case"reply.done":s.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:s.name||s.tool,args:s.arguments||s.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:s.name||s.tool,result:s.result});break;case"session.error":this.callbacks.onError?.(s.message||s.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.stop();break}}catch(s){console.warn("Message parsing error:",s)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(c){this.callbacks.onError?.(c.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(a){this.isMuted=a,a&&(this.userLevel=0)}getMuted(){return this.isMuted}stop(){if(this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(a=>a.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let a=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(a)};this.animFrameId=requestAnimationFrame(a)}};import{Fragment as he,jsx as o,jsxs as v}from"react/jsx-runtime";var pe={slate:"#18181b",purple:"#7c3aed",blue:"#2563eb",emerald:"#059669"};function re({host:l,businessId:a="biz_demo_dental",agentId:h,theme:c="dark",position:w="bottom-right",label:y="Talk to Receptionist",accent:s="slate",accentColor:d,suggestions:m,className:C,onCallStart:b,onCallEnd:Y,onTranscript:Z}){let[S,q]=I(!1),[p,M]=I(!1),[t,u]=I("idle"),[P,R]=I([]),[O,J]=I(0),[V,F]=I(0),[_,E]=I(!1),[n,k]=I("AI Voice Receptionist"),[z,W]=I(""),r=te(null),i=te(null),N=te(0),T=ae(()=>d||pe[s]||s||"#18181b",[s,d]);oe(()=>{i.current?.scrollIntoView({behavior:"smooth"})},[P]);let g=ae(()=>l?l.replace(/\/$/,""):typeof window<"u"&&window.location.origin?window.location.origin:"",[l]),D=se(async()=>{try{u("connecting"),W(""),R([]);let x=g?`${g}/api/token?businessId=${encodeURIComponent(a)}`:`/api/token?businessId=${encodeURIComponent(a)}`,$=await fetch(x);if(!$.ok)throw new Error(`Failed to fetch session token (${$.status})`);let f=await $.json();if(f.business_name&&k(f.business_name),!f.token)throw new Error("Invalid session token payload received from host");let ee=h||f.agent_id||"",X=new H({onStatusChange:L=>{if(u(L),L==="connected")N.current=Date.now(),b?.();else if(L==="idle"&&N.current>0){let K=Math.round((Date.now()-N.current)/1e3);N.current=0,Y?.(K)}},onTranscript:L=>{R(K=>[...K,L]),Z?.(L)},onAudioLevel:(L,K)=>{J(L),F(K)},onError:L=>{W(L),u("error")}});r.current=X,await X.start(f.token,ee)}catch(x){W(x.message||"Failed to start call"),u("error")}},[g,a,h,b,Y,Z]),G=se(()=>{r.current&&(r.current.stop(),r.current=null),u("idle"),E(!1)},[]),j=se(()=>{if(r.current){let x=!_;r.current.setMuted(x),E(x)}},[_]);oe(()=>()=>{r.current&&r.current.stop()},[]);let U=c==="dark"||c==="auto"&&typeof window<"u"&&window.matchMedia("(prefers-color-scheme: dark)").matches,e={bg:U?"#09090b":"#ffffff",cardBg:U?"#121215":"#f4f4f5",border:U?"#27272a":"#e4e4e7",text:U?"#fafafa":"#09090b",textMuted:U?"#a1a1aa":"#71717a",bubbleAgent:U?"#18181b":"#f4f4f5",bubbleUser:T,userText:"#ffffff"},A=w==="bottom-left",B=m||["Check availability","Book consultation","Pricing & services"];return v("div",{className:C,children:[S&&p&&o("div",{onClick:()=>M(!1),style:{position:"fixed",inset:0,background:"rgba(0, 0, 0, 0.65)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",zIndex:999998,transition:"all 0.25s ease"}}),!S&&o("div",{style:{position:"fixed",bottom:"24px",left:A?"24px":"auto",right:A?"auto":"24px",zIndex:999999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:v("button",{onClick:()=>{q(!0),t==="idle"&&D()},style:{display:"flex",alignItems:"center",gap:"10px",padding:"12px 20px",borderRadius:"9999px",background:e.bg,color:e.text,border:`1px solid ${e.border}`,boxShadow:"0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.2)",cursor:"pointer",fontWeight:600,fontSize:"14px",transition:"all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"},children:[o("span",{style:{width:"10px",height:"10px",borderRadius:"50%",background:t==="connected"?T:t==="connecting"?"#f59e0b":"#71717a",boxShadow:t==="connected"?`0 0 10px ${T}`:"none"}}),y]})}),S&&v("div",{style:{position:"fixed",...p?{top:"50%",left:"50%",transform:"translate(-50%, -50%)",width:"min(640px, 92vw)",height:"min(720px, 86vh)",maxHeight:"800px"}:{bottom:"24px",left:A?"24px":"auto",right:A?"auto":"24px",width:"370px",height:"560px",maxHeight:"85vh"},zIndex:999999,background:e.bg,border:`1px solid ${e.border}`,borderRadius:p?"24px":"20px",boxShadow:"0 25px 50px -12px rgba(0, 0, 0, 0.4)",display:"flex",flexDirection:"column",overflow:"hidden",fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",transition:"all 0.3s cubic-bezier(0.16, 1, 0.3, 1)"},children:[v("div",{style:{padding:"14px 18px",borderBottom:`1px solid ${e.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:e.cardBg},children:[v("div",{style:{display:"flex",alignItems:"center",gap:"10px"},children:[o("div",{style:{width:"34px",height:"34px",borderRadius:"50%",background:T,color:"#ffffff",display:"grid",placeItems:"center",fontSize:"14px",flexShrink:0},children:v("svg",{width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[o("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),o("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),o("line",{x1:"12",x2:"12",y1:"19",y2:"22"})]})}),v("div",{children:[o("div",{style:{fontWeight:700,fontSize:"14px",color:e.text},children:n}),v("div",{style:{fontSize:"11px",color:e.textMuted,display:"flex",alignItems:"center",gap:"6px",marginTop:"2px"},children:[o("span",{style:{width:"7px",height:"7px",borderRadius:"50%",background:t==="connected"?"#10b981":t==="connecting"?"#f59e0b":"#71717a"}}),t==="connected"?"Live Receptionist":t==="connecting"?"Connecting...":"Call Ended"]})]})]}),v("div",{style:{display:"flex",alignItems:"center",gap:"6px"},children:[o("button",{type:"button",onClick:()=>M(!p),style:{background:"transparent",border:"none",color:e.textMuted,cursor:"pointer",padding:"6px",borderRadius:"6px",fontSize:"15px",display:"grid",placeItems:"center"},title:p?"Collapse modal":"Expand fullscreen",children:p?"\u2199":"\u2922"}),o("button",{type:"button",onClick:()=>{q(!1),M(!1)},style:{background:"transparent",border:"none",color:e.textMuted,cursor:"pointer",padding:"6px",borderRadius:"6px",fontSize:"15px",display:"grid",placeItems:"center"},title:"Close",children:"\u2715"})]})]}),o("div",{style:{padding:"12px 18px",background:e.bg,borderBottom:`1px solid ${e.border}`,display:"flex",alignItems:"center",justifyContent:"center",gap:"5px",height:"56px"},children:[35,65,85,55,95,70,45,80,55,30,60,40].map((x,$)=>{let f=t==="connected",ee=f?Math.max(O,V):0,X=Math.max(6,Math.min(42,x*(.25+ee*1.6)));return o("div",{style:{width:"4px",height:`${X}px`,borderRadius:"4px",background:f&&V>.08?T:e.border,transition:"height 0.1s ease, background 0.2s ease"}},$)})}),v("div",{style:{flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:"10px"},children:[P.length===0&&o("div",{style:{margin:"auto",textAlign:"center",color:e.textMuted,fontSize:"13px",lineHeight:1.5,padding:"0 20px"},children:t==="connecting"?"Connecting to AI Receptionist...":t==="connected"?"Receptionist is listening. Say hello or ask to book an appointment!":z?o("span",{style:{color:"#ef4444"},children:z}):"Click Start Call to speak with the autonomous receptionist."}),P.map((x,$)=>{let f=x.who==="user";return o("div",{style:{display:"flex",justifyContent:f?"flex-end":"flex-start"},children:o("div",{style:{maxWidth:p?"70%":"82%",padding:"9px 13px",borderRadius:f?"14px 14px 2px 14px":"14px 14px 14px 2px",background:f?e.bubbleUser:e.bubbleAgent,color:f?e.userText:e.text,fontSize:"13px",lineHeight:1.45,wordBreak:"break-word"},children:x.text})},$)}),o("div",{ref:i})]}),B.length>0&&t==="connected"&&o("div",{style:{padding:"8px 16px",display:"flex",gap:"6px",overflowX:"auto",borderTop:`1px solid ${e.border}`,background:e.cardBg},children:B.map((x,$)=>o("div",{style:{fontSize:"11.5px",padding:"4px 10px",borderRadius:"9999px",background:e.bg,border:`1px solid ${e.border}`,color:e.textMuted,whiteSpace:"nowrap",cursor:"default"},children:x},$))}),o("div",{style:{padding:"14px 16px",borderTop:`1px solid ${e.border}`,background:e.cardBg,display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px"},children:t==="connected"?v(he,{children:[o("button",{type:"button",onClick:j,style:{flex:1,padding:"10px",borderRadius:"10px",border:`1px solid ${e.border}`,background:_?"#ef4444":e.bg,color:_?"#ffffff":e.text,fontSize:"12.5px",fontWeight:600,cursor:"pointer",transition:"all 0.15s ease"},children:_?"Unmute Mic":"Mute Mic"}),o("button",{type:"button",onClick:G,style:{flex:1,padding:"10px",borderRadius:"10px",border:"none",background:"#ef4444",color:"#ffffff",fontSize:"12.5px",fontWeight:600,cursor:"pointer",transition:"all 0.15s ease"},children:"End Call"})]}):o("button",{type:"button",onClick:D,disabled:t==="connecting",style:{width:"100%",padding:"11px",borderRadius:"10px",border:"none",background:T,color:"#ffffff",fontSize:"13px",fontWeight:600,cursor:t==="connecting"?"not-allowed":"pointer",opacity:t==="connecting"?.7:1,transition:"all 0.15s ease"},children:t==="connecting"?"Connecting...":"Start Call"})})]})]})}var ue=re;var be={slate:"#18181b",purple:"#7c3aed",blue:"#2563eb",emerald:"#059669"};function ne(l={}){if(typeof window>"u")return;let{host:a,businessId:h="biz_demo_dental",agentId:c,theme:w="dark",position:y="bottom-right",label:s="Talk to Receptionist",accent:d="slate",accentColor:m,suggestions:C,onCallStart:b,onCallEnd:Y,onTranscript:Z}=l,S=m||be[d]||d||"#18181b",q=document.getElementById("omnidesk-voice-widget-root");q&&q.remove();let p=document.createElement("div");p.id="omnidesk-voice-widget-root",p.style.fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let M=w==="dark"||w==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,t={bg:M?"#09090b":"#ffffff",cardBg:M?"#121215":"#f4f4f5",border:M?"#27272a":"#e4e4e7",text:M?"#fafafa":"#09090b",textMuted:M?"#a1a1aa":"#71717a",bubbleAgent:M?"#18181b":"#f4f4f5",bubbleUser:S,userText:"#ffffff"},u=null,P="idle",R=!1,O=0,J=!1,V=y==="bottom-left",F=document.createElement("div");F.style.cssText=`
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
    <span>${s}</span>
  `,F.appendChild(_);let E=document.createElement("div");E.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.65);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    z-index: 999998; display: none;
  `;let n=document.createElement("div");n.style.cssText=`
    position: fixed; bottom: 24px; ${V?"left: 24px;":"right: 24px;"}
    width: 370px; height: 560px; max-height: 85vh;
    background: ${t.bg}; border: 1px solid ${t.border};
    border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  `;let k=document.createElement("div");k.style.cssText=`
    padding: 14px 18px; border-bottom: 1px solid ${t.border};
    display: flex; align-items: center; justify-content: space-between;
    background: ${t.cardBg};
  `,k.innerHTML=`
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
  `;let z=document.createElement("div");z.style.cssText=`
    flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px;
  `;let W=document.createElement("div");W.style.cssText=`
    padding: 14px 16px; border-top: 1px solid ${t.border};
    background: ${t.cardBg}; display: flex; gap: 10px;
  `;let r=document.createElement("button");r.style.cssText=`
    display: none; flex: 1; padding: 10px; border-radius: 10px; border: 1px solid ${t.border};
    background: ${t.bg}; color: ${t.text}; font-size: 12.5px; font-weight: 600; cursor: pointer;
  `,r.innerText="Mute Mic";let i=document.createElement("button");i.style.cssText=`
    width: 100%; padding: 11px; border-radius: 10px; border: none;
    background: ${S}; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
    transition: all 0.15s ease;
  `,i.innerText="Start Call",W.appendChild(r),W.appendChild(i),n.appendChild(k),n.appendChild(z),n.appendChild(W),p.appendChild(E),p.appendChild(F),p.appendChild(n),document.body.appendChild(p);function N(g){J=g,g?(E.style.display="block",n.style.top="50%",n.style.left="50%",n.style.bottom="auto",n.style.right="auto",n.style.transform="translate(-50%, -50%)",n.style.width="min(640px, 92vw)",n.style.height="min(720px, 86vh)",n.style.maxHeight="800px",n.style.borderRadius="24px",k.querySelector("#omnidesk-expand-btn").innerHTML="\u2199"):(E.style.display="none",n.style.top="auto",n.style.left=V?"24px":"auto",n.style.bottom="24px",n.style.right=V?"auto":"24px",n.style.transform="none",n.style.width="370px",n.style.height="560px",n.style.maxHeight="85vh",n.style.borderRadius="20px",k.querySelector("#omnidesk-expand-btn").innerHTML="\u2922")}_.onclick=()=>{F.style.display="none",n.style.display="flex",P==="idle"&&T()},k.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{n.style.display="none",E.style.display="none",F.style.display="block",N(!1)}),k.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{N(!J)}),E.addEventListener("click",()=>{N(!1)}),r.onclick=()=>{u&&(R=!R,u.setMuted(R),r.innerText=R?"Unmute Mic":"Mute Mic",r.style.background=R?"#ef4444":t.bg,r.style.color=R?"#fff":t.text)};async function T(){let g=k.querySelector("#omnidesk-status-text");g.innerHTML='<span style="width:7px;height:7px;border-radius:50%;background:#f59e0b;display:inline-block;"></span> Connecting...',i.innerText="Connecting...",i.disabled=!0;try{let D=a?a.replace(/\/$/,""):typeof window<"u"?window.location.origin:"",G=await fetch(`${D}/api/token?businessId=${encodeURIComponent(h)}`);if(!G.ok)throw new Error("Failed to get session token");let j=await G.json();if(j.business_name){let e=k.querySelector("#omnidesk-biz-title");e&&(e.innerText=j.business_name)}let U=c||j.agent_id||"";u=new H({onStatusChange:e=>{if(P=e,e==="connected")g.innerHTML='<span style="width:7px;height:7px;border-radius:50%;background:#10b981;display:inline-block;"></span> Live Receptionist',i.innerText="End Call",i.style.background="#ef4444",i.style.width="auto",i.style.flex="1",i.disabled=!1,r.style.display="block",O=Date.now(),b?.();else if(e==="idle"&&(g.innerHTML='<span style="width:7px;height:7px;border-radius:50%;background:#71717a;display:inline-block;"></span> Call Ended',i.innerText="Start Call",i.style.background=S,i.style.width="100%",i.disabled=!1,r.style.display="none",O>0)){let A=Math.round((Date.now()-O)/1e3);O=0,Y?.(A)}},onTranscript:e=>{let A=document.createElement("div"),B=e.who==="user";A.style.cssText=`
            display: flex; justify-content: ${B?"flex-end":"flex-start"};
          `,A.innerHTML=`
            <div style="max-width:${J?"70%":"82%"};padding:9px 13px;border-radius:${B?"14px 14px 2px 14px":"14px 14px 14px 2px"};background:${B?t.bubbleUser:t.bubbleAgent};color:${B?t.userText:t.text};font-size:13px;line-height:1.45;">
              ${e.text}
            </div>
          `,z.appendChild(A),z.scrollTop=z.scrollHeight,Z?.(e)},onError:e=>{g.innerHTML=`<span style="width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block;"></span> Error: ${e}`,i.innerText="Start Call",i.style.background=S,i.style.width="100%",i.disabled=!1,r.style.display="none"}}),await u.start(j.token,U)}catch(D){g.innerHTML=`<span style="width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block;"></span> ${D.message||"Connection failed"}`,i.innerText="Start Call",i.style.background=S,i.style.width="100%",i.disabled=!1,r.style.display="none"}}return i.onclick=()=>{P==="connected"&&u?(u.stop(),u=null):P==="idle"&&T()},{destroy:()=>{u&&u.stop(),p.remove()},startCall:T}}if(typeof document<"u"){let l=document.currentScript||document.querySelector("script[data-agent], script[data-business-id]");if(l){let a=l.getAttribute("data-business-id")||void 0,h=l.getAttribute("data-agent")||void 0,c=l.getAttribute("data-theme")||"dark",w=l.getAttribute("data-accent")||"slate",y=l.getAttribute("data-position")||"bottom-right",s=l.getAttribute("data-label")||void 0,d=l.getAttribute("data-host")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{ne({businessId:a,agentId:h,theme:c,accent:w,position:y,label:s,host:d})}):ne({businessId:a,agentId:h,theme:c,accent:w,position:y,label:s,host:d})}}export{H as AssemblyAIVoiceClient,re as OmniDeskWidget,ue as VoiceWidget,ne as initOmniDeskWidget};
//# sourceMappingURL=index.mjs.map