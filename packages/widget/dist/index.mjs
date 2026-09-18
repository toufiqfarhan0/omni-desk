import{useState as V,useRef as te,useEffect as oe,useCallback as ie,useMemo as Y}from"react";var Q=24e3,le="wss://agents.assemblyai.com/v1/ws",ce=`
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
`,de=`
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
`;async function ne(o,t,m){let r=URL.createObjectURL(new Blob([t],{type:"application/javascript"}));try{await o.audioWorklet.addModule(r)}finally{URL.revokeObjectURL(r)}return new AudioWorkletNode(o,m)}var z=class{constructor(t){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.callbacks=t}async start(t,m){try{this.callbacks.onStatusChange?.("connecting");let r=window.AudioContext||window.webkitAudioContext;this.captureCtx=new r({sampleRate:Q}),this.playbackCtx=new r({sampleRate:Q}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await ne(this.playbackCtx,de,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await ne(this.captureCtx,ce,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let A=new URL(le);A.searchParams.set("token",t),this.ws=new WebSocket(A.toString()),this.captureNode.port.onmessage=({data:x})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let e=new Uint8Array(x),l="";for(let C=0;C<e.length;C+=32768)l+=String.fromCharCode.apply(null,Array.from(e.subarray(C,C+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(l)}));let c=new Int16Array(x),b=0;for(let C=0;C<c.length;C+=16)b+=Math.abs(c[C]);this.userLevel=Math.min(1,b/(c.length/16)/8e3)},this.ws.onopen=()=>{m&&m.trim()&&this.ws?.send(JSON.stringify({type:"session.update",session:{agent_id:m.trim()}}))},this.ws.onmessage=({data:x})=>{try{let e=JSON.parse(x);switch(e.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0;break;case"transcript.user":e.text&&this.callbacks.onTranscript?.({who:"user",text:e.text});break;case"transcript.agent":e.text&&this.callbacks.onTranscript?.({who:"agent",text:e.text});break;case"reply.audio":if(e.data&&this.playbackNode){let l=atob(e.data),c=new Uint8Array(l.length);for(let b=0;b<l.length;b++)c[b]=l.charCodeAt(b);this.playbackNode.port.postMessage(c.buffer,[c.buffer]),this.agentLevel=.8}break;case"reply.done":e.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:e.name||e.tool,args:e.arguments||e.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:e.name||e.tool,result:e.result});break;case"session.error":this.callbacks.onError?.(e.message||e.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.stop();break}}catch(e){console.warn("Message parsing error:",e)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(r){this.callbacks.onError?.(r.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(t){this.isMuted=t,t&&(this.userLevel=0)}getMuted(){return this.isMuted}stop(){if(this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(t=>t.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let t=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(t)};this.animFrameId=requestAnimationFrame(t)}};import{jsx as w,jsxs as D}from"react/jsx-runtime";var pe={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"},ue=[8,14,18,11,16,20,12,6,15];function ae({host:o="",businessId:t="biz_demo_dental",agentId:m,theme:r="dark",position:A="bottom-right",label:x="Talk to Receptionist",accent:e="emerald",accentColor:l,businessName:c,greeting:b,className:C,onCallStart:j,onCallEnd:O,onTranscript:J}){let[h,H]=V(!1),[y,k]=V("idle"),[i,M]=V([]),[$,I]=V(0),[B,K]=V(0),[X,G]=V(c||"OmniDesk AI Receptionist"),R=te(null),W=te(null),S=te(0),f=Y(()=>l||pe[e]||e||"#10b981",[e,l]),n=Y(()=>r==="light"?!1:r==="auto"&&typeof window<"u"?window.matchMedia("(prefers-color-scheme: dark)").matches:!0,[r]),E=Y(()=>b||(t==="biz_demo_dental"&&x.toLowerCase().includes("appointment")?"Hello! Welcome to Luxe & Mane Hair Studio. Would you like to check availability or book an appointment?":"Hello! Welcome to OmniDesk. Would you like to check availability or book a consultation?"),[b,t,x]);oe(()=>{W.current?.scrollIntoView({behavior:"smooth"})},[i]);let N=Y(()=>o?o.replace(/\/$/,""):typeof window<"u"&&window.location.origin?window.location.origin:"",[o]),F=ie(async()=>{try{k("connecting"),M([]);let p=N?`${N}/api/token?businessId=${encodeURIComponent(t)}`:`/api/token?businessId=${encodeURIComponent(t)}`,L=await fetch(p);if(!L.ok)throw new Error(`Failed to fetch session token (${L.status})`);let g=await L.json();if(g.business_name&&!c&&G(`${g.business_name} AI Receptionist`),!g.token)throw new Error("Invalid session token payload received from host");let a=m||g.agent_id||"",_=new z({onStatusChange:v=>{if(k(v),v==="connected")S.current=Date.now(),j?.();else if(v==="idle"&&S.current>0){let T=Math.round((Date.now()-S.current)/1e3);S.current=0,O?.(T)}},onTranscript:v=>{M(T=>[...T,v]),J?.(v)},onAudioLevel:(v,T)=>{I(v),K(T)},onError:v=>{k("error")}});R.current=_,await _.start(g.token,a)}catch{k("error")}},[N,t,m,c,j,O,J]),q=ie(()=>{if(R.current&&(R.current.stop(),R.current=null),k("idle"),I(0),K(0),S.current>0){let p=Math.round((Date.now()-S.current)/1e3);S.current=0,O?.(p)}},[O]);oe(()=>()=>{R.current&&R.current.stop()},[]);let s=A==="bottom-left",d=y==="connected";return D("div",{className:C,style:{position:"relative",zIndex:99999},children:[w("div",{style:{position:"fixed",bottom:"20px",left:s?"20px":"auto",right:s?"auto":"20px",zIndex:99999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:D("button",{type:"button",onClick:()=>H(!h),style:{display:"inline-flex",alignItems:"center",gap:"10px",background:n?"#18181b":"#ffffff",color:n?"#fafafa":"#09090b",border:`1px solid ${n?"#27272a":"#e4e4e7"}`,padding:"10px 18px",borderRadius:"9999px",cursor:"pointer",fontSize:"13px",fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.25)",transition:"transform 0.15s ease, background 0.15s ease"},onMouseEnter:p=>{p.currentTarget.style.transform="scale(1.02)"},onMouseLeave:p=>{p.currentTarget.style.transform="scale(1)"},children:[w("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:d?"#ef4444":f,boxShadow:`0 0 8px ${d?"#ef4444":f}`}}),w("span",{children:x}),w("span",{style:{fontSize:"11px",opacity:.6},children:"\u25B2"})]})}),h&&D("div",{style:{position:"fixed",bottom:"70px",left:s?"20px":"auto",right:s?"auto":"20px",width:"320px",height:"280px",background:n?"#18181b":"#ffffff",border:`1px solid ${n?"#27272a":"#e4e4e7"}`,borderRadius:"18px",boxShadow:"0 20px 30px -10px rgba(0,0,0,0.4)",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:99999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:[D("div",{style:{padding:"12px 16px",borderBottom:`1px solid ${n?"#27272a":"#e4e4e7"}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:n?"#09090b":"#f4f4f5"},children:[D("div",{children:[w("div",{style:{fontSize:"13px",fontWeight:700,color:n?"#fafafa":"#09090b"},children:X}),w("div",{style:{fontSize:"10.5px",color:f,fontWeight:600},children:d?"Live Voice Call (24kHz)":y==="connecting"?"Connecting...":"Ready to connect"})]}),w("button",{type:"button",onClick:()=>H(!1),style:{background:"transparent",border:"none",fontSize:"14px",color:"#71717a",cursor:"pointer",padding:"4px",display:"grid",placeItems:"center"},title:"Close",children:"\u2715"})]}),D("div",{style:{flex:1,padding:"12px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"8px"},children:[w("div",{style:{alignSelf:"flex-start",background:n?"#27272a":"#f4f4f5",color:n?"#f4f4f5":"#09090b",padding:"8px 12px",borderRadius:"12px",fontSize:"12px",maxWidth:"85%",lineHeight:1.4},children:E}),i.map((p,L)=>{let g=p.who==="user";return w("div",{style:{alignSelf:g?"flex-end":"flex-start",background:g?f:n?"#27272a":"#f4f4f5",color:g?"#ffffff":n?"#f4f4f5":"#09090b",padding:"8px 12px",borderRadius:"12px",fontSize:"12px",maxWidth:"85%",lineHeight:1.4},children:p.text},L)}),w("div",{ref:W})]}),D("div",{style:{padding:"10px 14px",borderTop:`1px solid ${n?"#27272a":"#e4e4e7"}`,display:"flex",alignItems:"center",justifyContent:"space-between"},children:[w("div",{style:{display:"flex",alignItems:"center",gap:"3px",height:"18px"},children:ue.map((p,L)=>{let g=Math.max($,B),a=d?Math.max(5,Math.min(18,Math.round(p*(.35+g*1.5)))):4;return w("div",{style:{width:"3px",height:`${a}px`,borderRadius:"2px",background:d?B>.05?f:"#3b82f6":f,opacity:d?1:.7,transition:"height 0.15s ease"}},L)})}),w("button",{type:"button",onClick:d?q:F,disabled:y==="connecting",style:{background:d?"#ef4444":f,color:"#ffffff",border:"none",padding:"7px 16px",borderRadius:"9999px",fontSize:"12px",fontWeight:700,cursor:y==="connecting"?"not-allowed":"pointer",opacity:y==="connecting"?.7:1,boxShadow:`0 2px 8px ${d?"rgba(239,68,68,0.3)":"rgba(16,185,129,0.3)"}`,transition:"all 0.15s ease"},children:d?"End Call":y==="connecting"?"Connecting...":"Start Call"})]})]})]})}var he=ae;var fe={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"},re=[8,14,18,11,16,20,12,6,15];function se(o={}){if(typeof window>"u")return;let{host:t,businessId:m="biz_demo_dental",agentId:r,theme:A="dark",position:x="bottom-right",label:e="Talk to Receptionist",accent:l="emerald",accentColor:c,businessName:b,greeting:C,onCallStart:j,onCallEnd:O,onTranscript:J}=o,h=c||fe[l]||l||"#10b981",H=document.getElementById("omnidesk-voice-widget-root");H&&H.remove();let y=document.createElement("div");y.id="omnidesk-voice-widget-root",y.style.fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let k=A==="dark"||A==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,i={bg:k?"#18181b":"#ffffff",headerBg:k?"#09090b":"#f4f4f5",border:k?"#27272a":"#e4e4e7",text:k?"#fafafa":"#09090b",textMuted:k?"#a1a1aa":"#71717a",bubbleAgent:k?"#27272a":"#f4f4f5",bubbleUser:h,userText:"#ffffff",agentText:k?"#f4f4f5":"#09090b"},M=null,$="idle",I=0,B=!1,K=0,X=0,G=x==="bottom-left",R=C||"Hello! Welcome to OmniDesk. Would you like to check availability or book a consultation?",W=document.createElement("div");W.style.cssText=`
    position: fixed; bottom: 20px; ${G?"left: 20px;":"right: 20px;"};
    z-index: 999999;
  `;let S=document.createElement("button");S.style.cssText=`
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${i.bg}; color: ${i.text};
    border: 1px solid ${i.border};
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `,S.innerHTML=`
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${h};box-shadow:0 0 8px ${h};display:inline-block;"></span>
    <span>${e}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,W.appendChild(S);let f=document.createElement("div");f.style.cssText=`
    position: fixed; bottom: 70px; ${G?"left: 20px;":"right: 20px;"};
    width: 320px; height: 280px;
    background: ${i.bg}; border: 1px solid ${i.border};
    border-radius: 18px; box-shadow: 0 20px 30px -10px rgba(0,0,0,0.4);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;let n=document.createElement("div");n.style.cssText=`
    padding: 12px 16px; border-bottom: 1px solid ${i.border};
    display: flex; align-items: center; justify-content: space-between;
    background: ${i.headerBg};
  `,n.innerHTML=`
    <div>
      <div style="font-size:13px;font-weight:700;color:${i.text};" id="omnidesk-biz-title">${b||"OmniDesk AI Receptionist"}</div>
      <div style="font-size:10.5px;color:${h};font-weight:600;" id="omnidesk-status-text">Ready to connect</div>
    </div>
    <button id="omnidesk-close-btn" style="background:transparent;border:none;color:${i.textMuted};cursor:pointer;padding:4px;font-size:14px;" title="Close">\u2715</button>
  `;let E=document.createElement("div");E.style.cssText=`
    flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px;
  `;let N=document.createElement("div");N.style.cssText=`
    align-self: flex-start; background: ${i.bubbleAgent}; color: ${i.agentText};
    padding: 8px 12px; border-radius: 12px; font-size: 12px; max-width: 85%; line-height: 1.4;
  `,N.innerText=R,E.appendChild(N);let F=document.createElement("div");F.style.cssText=`
    padding: 10px 14px; border-top: 1px solid ${i.border};
    display: flex; align-items: center; justify-content: space-between;
  `;let q=document.createElement("div");q.style.cssText=`
    display: flex; align-items: center; gap: 3px; height: 18px;
  `,re.forEach(()=>{let a=document.createElement("div");a.className="omnidesk-freq-bar",a.style.cssText=`
      width: 3px; height: 4px; border-radius: 2px;
      background: ${h}; opacity: 0.7; transition: height 0.15s ease;
    `,q.appendChild(a)});let s=document.createElement("button");s.style.cssText=`
    padding: 7px 16px; border-radius: 9999px; border: none;
    background: ${h}; color: #ffffff; font-size: 12px; font-weight: 700; cursor: pointer;
    box-shadow: 0 2px 8px rgba(16,185,129,0.3); transition: all 0.15s ease;
  `,s.innerText="Start Call",F.appendChild(q),F.appendChild(s),f.appendChild(n),f.appendChild(E),f.appendChild(F),y.appendChild(W),y.appendChild(f),document.body.appendChild(y);function d(a,_){f.querySelectorAll(".omnidesk-freq-bar").forEach((T,U)=>{let Z=re[U],u=a?Math.max(5,Math.min(18,Math.round(Z*(.35+_*1.5)))):4;T.style.height=`${u}px`,T.style.opacity=a?"1":"0.7"})}function p(a){B=a,f.style.display=a?"flex":"none"}S.onclick=()=>{p(!B)},n.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{p(!1)});async function L(){let a=n.querySelector("#omnidesk-status-text"),_=W.querySelector("#omnidesk-trigger-dot");a.innerText="Connecting...",s.innerText="Connecting...",s.disabled=!0;try{let v=t?t.replace(/\/$/,""):typeof window<"u"?window.location.origin:"",T=await fetch(`${v}/api/token?businessId=${encodeURIComponent(m)}`);if(!T.ok)throw new Error("Failed to get session token");let U=await T.json();if(U.business_name&&!b){let u=n.querySelector("#omnidesk-biz-title");u&&(u.innerText=`${U.business_name} AI Receptionist`)}let Z=r||U.agent_id||"";M=new z({onStatusChange:u=>{if($=u,u==="connected")a.innerText="Live Voice Call (24kHz)",s.innerText="End Call",s.style.background="#ef4444",s.style.boxShadow="0 2px 8px rgba(239,68,68,0.3)",s.disabled=!1,_&&(_.style.background="#ef4444",_.style.boxShadow="0 0 8px #ef4444"),I=Date.now(),j?.();else if(u==="idle"&&(a.innerText="Ready to connect",s.innerText="Start Call",s.style.background=h,s.style.boxShadow="0 2px 8px rgba(16,185,129,0.3)",s.disabled=!1,_&&(_.style.background=h,_.style.boxShadow=`0 0 8px ${h}`),d(!1,0),I>0)){let P=Math.round((Date.now()-I)/1e3);I=0,O?.(P)}},onTranscript:u=>{let P=document.createElement("div"),ee=u.who==="user";P.style.cssText=`
            align-self: ${ee?"flex-end":"flex-start"};
            background: ${ee?i.bubbleUser:i.bubbleAgent};
            color: ${ee?i.userText:i.agentText};
            padding: 8px 12px; border-radius: 12px; font-size: 12px; max-width: 85%; line-height: 1.4;
          `,P.innerText=u.text,E.appendChild(P),E.scrollTop=E.scrollHeight,J?.(u)},onAudioLevel:(u,P)=>{K=u,X=P,d($==="connected",Math.max(u,P))},onError:u=>{a.innerText="Connection error",s.innerText="Start Call",s.style.background=h,s.disabled=!1,d(!1,0)}}),await M.start(U.token,Z)}catch{a.innerText="Connection failed",s.innerText="Start Call",s.style.background=h,s.disabled=!1,d(!1,0)}}function g(){M&&(M.stop(),M=null),$="idle",d(!1,0)}return s.onclick=()=>{$==="connected"?g():$==="idle"&&L()},{destroy:()=>{M&&M.stop(),y.remove()},startCall:L,endCall:g}}if(typeof document<"u"){let o=document.currentScript||document.querySelector("script[data-agent], script[data-business-id]");if(o){let t=o.getAttribute("data-business-id")||void 0,m=o.getAttribute("data-agent")||void 0,r=o.getAttribute("data-theme")||"dark",A=o.getAttribute("data-accent")||"emerald",x=o.getAttribute("data-position")||"bottom-right",e=o.getAttribute("data-label")||void 0,l=o.getAttribute("data-host")||void 0,c=o.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{se({businessId:t,agentId:m,theme:r,accent:A,position:x,label:e,host:l,greeting:c})}):se({businessId:t,agentId:m,theme:r,accent:A,position:x,label:e,host:l,greeting:c})}}export{z as AssemblyAIVoiceClient,ae as OmniDeskWidget,he as VoiceWidget,se as initOmniDeskWidget};
//# sourceMappingURL=index.mjs.map