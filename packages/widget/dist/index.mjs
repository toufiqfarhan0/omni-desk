import{useState as A,useRef as de,useEffect as Se,useCallback as fe,useMemo as ve}from"react";var me=24e3,Ee="wss://agents.assemblyai.com/v1/ws",Me=`
  class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this._ratio = sampleRate / ${me};
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
      this._step = ${me} / sampleRate;
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
`;async function Ce(g,a,S){let T=URL.createObjectURL(new Blob([a],{type:"application/javascript"}));try{await g.audioWorklet.addModule(T)}finally{URL.revokeObjectURL(T)}return new AudioWorkletNode(g,S)}var se=class{constructor(a){this.ws=null;this.captureCtx=null;this.playbackCtx=null;this.playbackNode=null;this.captureNode=null;this.micStream=null;this.isConnected=!1;this.userLevel=0;this.agentLevel=0;this.animFrameId=null;this.isMuted=!1;this.isThinking=!1;this.callbacks=a}setThinking(a){this.isThinking!==a&&(this.isThinking=a,this.callbacks.onThinkingChange?.(a))}async start(a,S,T){try{this.callbacks.onStatusChange?.("connecting");let F=window.AudioContext||window.webkitAudioContext;this.captureCtx=new F({sampleRate:me}),this.playbackCtx=new F({sampleRate:me}),await Promise.all([this.captureCtx.resume(),this.playbackCtx.resume()]),this.playbackNode=await Ce(this.playbackCtx,Le,"playback"),this.playbackNode.connect(this.playbackCtx.destination),this.micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!1,autoGainControl:!0}}),this.captureNode=await Ce(this.captureCtx,Me,"capture"),this.captureCtx.createMediaStreamSource(this.micStream).connect(this.captureNode);let U=new URL(Ee);U.searchParams.set("token",a),this.ws=new WebSocket(U.toString()),this.captureNode.port.onmessage=({data:v})=>{if(!this.isConnected||!this.ws||this.ws.readyState!==WebSocket.OPEN||this.isMuted)return;let s=new Uint8Array(v),P="";for(let W=0;W<s.length;W+=32768)P+=String.fromCharCode.apply(null,Array.from(s.subarray(W,W+32768)));this.ws.send(JSON.stringify({type:"input.audio",audio:btoa(P)}));let z=new Int16Array(v),I=0;for(let W=0;W<z.length;W+=16)I+=Math.abs(z[W]);this.userLevel=Math.min(1,I/(z.length/16)/8e3)},this.ws.onopen=()=>{let v={};S&&S.trim()?v.agent_id=S.trim():T&&T.trim()&&(v.output={voice:T.trim()}),Object.keys(v).length>0&&this.ws?.send(JSON.stringify({type:"session.update",session:v}))};let E="",R="";this.ws.onmessage=({data:v})=>{try{let s=JSON.parse(v);switch(s.type){case"session.ready":this.isConnected=!0,this.callbacks.onStatusChange?.("connected");break;case"input.speech.started":this.playbackNode?.port.postMessage("stop"),this.agentLevel=0,R="",this.setThinking(!1);break;case"transcript.user.delta":s.text&&(R=s.text,this.callbacks.onTranscript?.({who:"user",text:s.text,isFinal:!1}));break;case"transcript.user":s.text&&(R=s.text,this.callbacks.onTranscript?.({who:"user",text:s.text,isFinal:!0}),this.setThinking(!0));break;case"reply.started":E="";break;case"transcript.agent.delta":s.delta&&(this.setThinking(!1),E&&!E.endsWith(" ")&&!/^[.,!?;:%)]/.test(s.delta)?E+=" "+s.delta:E+=s.delta,this.callbacks.onTranscript?.({who:"agent",text:E,isFinal:!1}));break;case"transcript.agent":s.text&&(this.setThinking(!1),E=s.text,this.callbacks.onTranscript?.({who:"agent",text:s.text,isFinal:!0}));break;case"reply.audio":if(s.data&&this.playbackNode){let P=atob(s.data),z=new Uint8Array(P.length);for(let I=0;I<P.length;I++)z[I]=P.charCodeAt(I);this.playbackNode.port.postMessage(z.buffer,[z.buffer]),this.agentLevel=.8}break;case"reply.done":s.status==="interrupted"&&(this.playbackNode?.port.postMessage("stop"),this.agentLevel=0);break;case"tool.call":this.callbacks.onToolEvent?.({type:"call",tool:s.name||s.tool,args:s.arguments||s.args});break;case"tool.result":this.callbacks.onToolEvent?.({type:"result",tool:s.name||s.tool,result:s.result});break;case"session.error":this.setThinking(!1),this.callbacks.onError?.(s.message||s.code||"Session error"),this.callbacks.onStatusChange?.("error");break;case"session.ended":this.setThinking(!1),this.stop();break}}catch(s){console.warn("Message parsing error:",s)}},this.ws.onerror=()=>{this.callbacks.onError?.("WebSocket connection error"),this.callbacks.onStatusChange?.("error")},this.ws.onclose=()=>{this.stop()},this.startVisualizerLoop()}catch(F){this.callbacks.onError?.(F.message||"Failed to start audio"),this.callbacks.onStatusChange?.("error"),this.stop()}}setMuted(a){this.isMuted=a,a&&(this.userLevel=0)}getMuted(){return this.isMuted}sendUserMessage(a,S){if(!this.ws||this.ws.readyState!==WebSocket.OPEN)return!1;try{return this.setThinking(!0),this.ws.send(JSON.stringify({type:"conversation.message",role:"user",content:a})),S&&this.ws.send(JSON.stringify({type:"reply.create",instructions:S})),!0}catch(T){return console.error("Failed to send message to agent:",T),!1}}sendEmailInput(a){return this.sendUserMessage(`My email address is ${a}`,`The caller entered their verified email address: ${a}. Acknowledge this email, verify it using verify_customer_email if needed, and complete the booking.`)}stop(){if(this.setThinking(!1),this.isConnected=!1,this.animFrameId&&(cancelAnimationFrame(this.animFrameId),this.animFrameId=null),this.playbackNode){try{this.playbackNode.port.postMessage("stop")}catch{}this.playbackNode.disconnect(),this.playbackNode=null}if(this.captureNode&&(this.captureNode.disconnect(),this.captureNode=null),this.micStream&&(this.micStream.getTracks().forEach(a=>a.stop()),this.micStream=null),this.captureCtx&&this.captureCtx.state!=="closed"&&(this.captureCtx.close().catch(()=>{}),this.captureCtx=null),this.playbackCtx&&this.playbackCtx.state!=="closed"&&(this.playbackCtx.close().catch(()=>{}),this.playbackCtx=null),this.ws){if(this.ws.readyState===WebSocket.OPEN)try{this.ws.send(JSON.stringify({type:"session.end"}))}catch{}this.ws.close(),this.ws=null}this.userLevel=0,this.agentLevel=0,this.callbacks.onAudioLevel?.(0,0),this.callbacks.onStatusChange?.("idle")}startVisualizerLoop(){let a=()=>{this.agentLevel=Math.max(0,this.agentLevel-.04),this.userLevel=Math.max(0,this.userLevel-.04),this.callbacks.onAudioLevel?.(this.userLevel,this.agentLevel),this.animFrameId=requestAnimationFrame(a)};this.animFrameId=requestAnimationFrame(a)}};import{Fragment as Ae,jsx as e,jsxs as l}from"react/jsx-runtime";var _e={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function Te({host:g="",businessId:a="biz_demo_dental",agentId:S,theme:T="light",position:F="bottom-right",label:U="Talk to Receptionist",accent:E="emerald",accentColor:R,businessName:v,greeting:s,className:P,onCallStart:z,onCallEnd:I,onTranscript:W}){let[oe,ce]=A(!1),[u,p]=A(!1),[w,H]=A("idle"),[O,q]=A([]),[he,pe]=A(0),[ye,xe]=A(0),[G,ee]=A("0:00"),[te,ie]=A(v||"OmniDesk Hair Salon & Studio"),[ae,V]=A(!1),[J,ne]=A(""),[r,N]=A(!1),[re,C]=A(""),[Z,m]=A(""),[f,D]=A(!1),x=de(null),K=de(null),b=de(0),Q=de(null),X=de(0),Y=de(!1),le=ve(()=>R||_e[E]||E||"#10b981",[E,R]),h=ve(()=>T==="dark"?!0:T==="auto"&&typeof window<"u"?window.matchMedia("(prefers-color-scheme: dark)").matches:!1,[T]);Se(()=>{K.current&&(K.current.scrollTop=K.current.scrollHeight)},[O,f]);let j=ve(()=>g?g.replace(/\/$/,""):typeof window<"u"&&window.location.origin?window.location.origin:"",[g]),be=fe(()=>{X.current=Date.now(),ee("0:00"),Q.current&&clearInterval(Q.current),Q.current=setInterval(()=>{let c=Date.now()-X.current,_=Math.floor(c/1e3),y=Math.floor(_/60),$=_%60;ee(`${y}:${String($).padStart(2,"0")}`)},250)},[]),B=fe(()=>{Q.current&&(clearInterval(Q.current),Q.current=null)},[]),ge=fe(async()=>{try{H("connecting"),Y.current=!1,V(!1),be();let _=`${j?j.replace(/\/$/,""):""}/api/token?businessId=${encodeURIComponent(a)}`,y=await fetch(_);if(!y.ok)throw new Error("Failed to initialize voice session");let $=await y.json();if($.business_name&&!v&&ie($.business_name),!$.token)throw new Error("Invalid session token payload received from host");let n=S||$.agent_id||"",t=new se({onStatusChange:o=>{if(H(o),o==="connected")b.current=Date.now(),z?.();else if(o==="idle"){if(D(!1),B(),b.current>0){let i=Math.round((Date.now()-b.current)/1e3);b.current=0,I?.(i)}}else o==="error"&&(D(!1),B())},onThinkingChange:o=>{o&&D(!0)},onTranscript:o=>{if(o.who==="user"?D(!0):o.who==="agent"&&o.text&&o.text.trim().length>0&&D(!1),q(i=>{let ue=i[i.length-1];if(ue&&ue.who===o.who&&!ue.isFinal){let ke=[...i];return ke[ke.length-1]={...ue,text:o.text,isFinal:o.isFinal??!1},ke}return[...i,{id:o.id||`${Date.now()}-${Math.random()}`,who:o.who,text:o.text,isFinal:o.isFinal??!1}]}),W?.(o),o.who==="user")(o.text.includes("@")||o.text.toLowerCase().includes(" at ")&&o.text.toLowerCase().includes(" dot "))&&(Y.current=!0,V(!1));else if(o.who==="agent"){let i=o.text.toLowerCase();if(i.includes("what is your email")||i.includes("what's your email")||i.includes("may i have your email")||i.includes("provide your email")||i.includes("can i have your email")||i.includes("could i get your email")||i.includes("could you provide your email")||i.includes("enter your email")||i.includes("spell your email")||i.includes("where can i send your confirmation")||i.includes("where should i send your confirmation")||i.includes("where can i send your calendar invite")||i.includes("where should i send your calendar invite")||i.includes("email")&&(i.includes("what")||i.includes("have")||i.includes("provide")||i.includes("give")||i.includes("tell")||i.includes("share")||i.includes("address"))){Y.current=!1,V(!0);return}if(i.includes("verified your email")||i.includes("thank you for your email")||i.includes("thank you for providing your email")||i.includes("sent a calendar invite")||i.includes("sent your confirmation")||i.includes("confirmation code is")||i.includes("i have sent")){Y.current=!0,V(!1);return}Y.current&&V(!1)}},onAudioLevel:(o,i)=>{pe(o),xe(i)},onError:()=>{H("error"),B()}});x.current=t,await t.start($.token,n,$.voice)}catch{H("error"),B()}},[j,a,S,v,z,I,W,be,B]),k=fe(()=>{if(x.current&&(x.current.stop(),x.current=null),H("idle"),D(!1),pe(0),xe(0),B(),V(!1),C(""),m(""),b.current>0){let c=Math.round((Date.now()-b.current)/1e3);b.current=0,I?.(c)}},[I,B]),L=fe(async c=>{c.preventDefault();let _=J.trim();if(_){N(!0),C(""),m("");try{let y=j?j.replace(/\/$/,""):"",$=await fetch(`${y}/api/tools/${encodeURIComponent(a)}/verify_customer_email`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:_})}),n=await $.json();if(!$.ok||!n.valid||!n.email){C(n.message||"Invalid email or domain has no active mail server."),N(!1);return}let t=n.email;m(`Verified: ${t}. Sent to agent.`),q(o=>[...o,{who:"user",text:`My email is ${t}`}]),x.current&&x.current.sendEmailInput(t),D(!0),Y.current=!0,ne(""),V(!1),m("")}catch(y){C(y.message||"Failed to verify email with mail server.")}finally{N(!1)}}},[J,j,a]);Se(()=>()=>{B(),x.current&&x.current.stop()},[B]);let M=F==="bottom-left",d=w==="connected";return l("div",{className:P,style:{position:"relative",zIndex:99999},children:[e("div",{style:{position:"fixed",bottom:"20px",left:M?"20px":"auto",right:M?"auto":"20px",zIndex:99999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"},children:l("button",{type:"button",onClick:()=>ce(!oe),style:{display:"inline-flex",alignItems:"center",gap:"10px",background:h?"#18181b":"#ffffff",color:h?"#fafafa":"#09090b",border:`1px solid ${h?"#27272a":"#e4e4e7"}`,padding:"10px 18px",borderRadius:"9999px",cursor:"pointer",fontSize:"13px",fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.18)",transition:"transform 0.15s ease, background 0.15s ease"},onMouseEnter:c=>{c.currentTarget.style.transform="scale(1.02)"},onMouseLeave:c=>{c.currentTarget.style.transform="scale(1)"},children:[e("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:d?"#ef4444":le,boxShadow:`0 0 8px ${d?"#ef4444":le}`}}),e("span",{children:U}),e("span",{style:{fontSize:"11px",opacity:.6},children:"\u25B2"})]})}),oe&&l(Ae,{children:[u&&e("div",{onClick:()=>p(!1),style:{position:"fixed",inset:0,background:"rgba(0, 0, 0, 0.7)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",zIndex:999998}}),l("div",{style:{position:"fixed",bottom:u?"auto":"80px",left:u?"50%":M?"20px":"auto",right:u||M?"auto":"20px",top:u?"50%":"auto",transform:u?"translate(-50%, -50%)":"none",width:u?"calc(100vw - 40px)":"390px",maxWidth:u?"1140px":"calc(100vw - 32px)",height:u?"calc(100vh - 40px)":"560px",maxHeight:u?"900px":"calc(100vh - 100px)",background:"#ffffff",border:"1px solid #e4e4e7",borderRadius:"20px",boxShadow:u?"0 32px 64px -16px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)":"0 24px 48px -12px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:999999,fontFamily:"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",transition:"all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"},children:[e("style",{children:`
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
            `}),l("div",{style:{background:h?"#18181b":"#ffffff",color:h?"#ffffff":"#09090b",borderBottom:`1px solid ${h?"#27272a":"#e4e4e7"}`,padding:u?"16px 22px":"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",userSelect:"none",flexShrink:0},children:[l("div",{style:{display:"flex",alignItems:"center",gap:"10px",minWidth:0},children:[e("div",{style:{color:h?"rgba(255,255,255,0.6)":"#71717a",display:"grid",placeItems:"center",flexShrink:0},children:l("svg",{xmlns:"http://www.w3.org/2000/svg",width:"16",height:"16",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("circle",{cx:"12",cy:"12",r:"1"}),e("circle",{cx:"12",cy:"5",r:"1"}),e("circle",{cx:"12",cy:"19",r:"1"})]})}),e("div",{style:{width:"28px",height:"28px",borderRadius:"50%",background:h?"rgba(255,255,255,0.15)":"#f4f4f5",display:"grid",placeItems:"center",flexShrink:0,color:h?"#ffffff":"#09090b"},children:l("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),e("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),e("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]})}),l("div",{style:{display:"flex",flexDirection:"column",minWidth:0},children:[e("div",{style:{fontSize:"13.5px",fontWeight:600,color:h?"#ffffff":"#09090b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},children:te}),l("div",{style:{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"11px",color:h?"rgba(255,255,255,0.75)":"#71717a"},children:[e("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:d?f?"#f59e0b":"#22c55e":w==="connecting"?"#eab308":h?"rgba(255,255,255,0.4)":"#a1a1aa",animation:f?"omnidesk-pulse-amber 1.5s infinite":"none"}}),e("span",{children:d?f?"Thinking \xB7 Checking tools...":"Live \xB7 Speaking":w==="connecting"?"Connecting...":w==="error"?"Error":"Idle \xB7 Ready"})]})]})]}),l("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[e("button",{type:"button",onClick:()=>p(!u),title:u?"Exit Fullscreen":"Open Full",style:{background:h?"rgba(255,255,255,0.1)":"#f4f4f5",border:h?"1px solid rgba(255,255,255,0.15)":"1px solid #e4e4e7",borderRadius:"7px",color:h?"#ffffff":"#52525b",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:c=>c.currentTarget.style.background=h?"rgba(255,255,255,0.2)":"#e4e4e7",onMouseLeave:c=>c.currentTarget.style.background=h?"rgba(255,255,255,0.1)":"#f4f4f5",children:u?l("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("polyline",{points:"4 14 10 14 10 20"}),e("polyline",{points:"20 10 14 10 14 4"}),e("line",{x1:"14",y1:"10",x2:"21",y2:"3"}),e("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]}):l("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("polyline",{points:"15 3 21 3 21 9"}),e("polyline",{points:"9 21 3 21 3 15"}),e("line",{x1:"21",y1:"3",x2:"14",y2:"10"}),e("line",{x1:"3",y1:"21",x2:"10",y2:"14"})]})}),e("button",{type:"button",onClick:()=>{d&&k(),ce(!1)},title:"Close Widget",style:{background:h?"rgba(255,255,255,0.1)":"#f4f4f5",border:h?"1px solid rgba(255,255,255,0.15)":"1px solid #e4e4e7",borderRadius:"7px",color:h?"#ffffff":"#52525b",width:"30px",height:"30px",cursor:"pointer",display:"grid",placeItems:"center",transition:"all 0.15s ease"},onMouseEnter:c=>c.currentTarget.style.background=h?"rgba(255,255,255,0.2)":"#e4e4e7",onMouseLeave:c=>c.currentTarget.style.background=h?"rgba(255,255,255,0.1)":"#f4f4f5",children:l("svg",{xmlns:"http://www.w3.org/2000/svg",width:"14",height:"14",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("line",{x1:"18",y1:"6",x2:"6",y2:"18"}),e("line",{x1:"6",y1:"6",x2:"18",y2:"18"})]})})]})]}),l("div",{ref:K,style:{flex:1,minHeight:0,padding:"16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"12px",background:"#ffffff"},children:[O.length===0&&l("div",{style:{margin:"auto",textAlign:"center",padding:"10px 18px",background:"#f4f4f5",border:"1px solid #e4e4e7",color:"#52525b",borderRadius:"12px",fontSize:"12.5px",fontWeight:500,display:"inline-flex",alignItems:"center",gap:"8px",alignSelf:"center"},children:[e("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:d?"#22c55e":"#a1a1aa",display:"inline-block"}}),e("span",{children:d?"Connected \xB7 Speak to our receptionist":w==="connecting"?"Connecting to receptionist...":"Start a call to talk to our receptionist"})]}),O.map((c,_)=>{let y=c.who==="user";return e("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:y?"flex-end":"flex-start"},children:l("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[!y&&e("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:l("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),e("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),e("div",{style:{padding:"10px 14px",borderRadius:y?"14px 14px 2px 14px":"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:y?"#18181b":"#f4f4f5",color:y?"#ffffff":"#09090b",boxShadow:"0 1px 2px rgba(0,0,0,0.04)"},children:c.text})]})},_)}),f&&e("div",{style:{display:"flex",flexDirection:"column",gap:"4px",maxWidth:"88%",alignSelf:"flex-start"},children:l("div",{style:{display:"flex",alignItems:"flex-start",gap:"8px"},children:[e("div",{style:{width:"24px",height:"24px",borderRadius:"50%",background:"#18181b",display:"grid",placeItems:"center",color:"#ffffff",flexShrink:0,marginTop:"2px"},children:l("svg",{xmlns:"http://www.w3.org/2000/svg",width:"13",height:"13",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),e("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"})]})}),l("div",{style:{padding:"10px 14px",borderRadius:"14px 14px 14px 2px",fontSize:"13px",lineHeight:"1.45",background:"#f4f4f5",color:"#71717a",boxShadow:"0 1px 2px rgba(0,0,0,0.04)",display:"inline-flex",alignItems:"center",gap:"5px",minHeight:"38px"},title:"Agent is thinking and processing...",children:[e("span",{className:"omnidesk-motion-dot omnidesk-dot-1"}),e("span",{className:"omnidesk-motion-dot omnidesk-dot-2"}),e("span",{className:"omnidesk-motion-dot omnidesk-dot-3"})]})]})})]}),ae&&d&&l("div",{style:{padding:"11px 16px",background:"#f0fdf4",borderTop:"1px solid #bbf7d0",display:"flex",flexDirection:"column",gap:"7px",flexShrink:0},children:[l("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"},children:[l("span",{style:{fontSize:"11px",fontWeight:700,color:"#15803d",textTransform:"uppercase",letterSpacing:"0.04em",display:"inline-flex",alignItems:"center",gap:"6px"},children:[e("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:"#22c55e",display:"inline-block"}}),"Email Requested by Agent \u2022 Auto Verification"]}),e("button",{type:"button",onClick:()=>V(!1),style:{background:"none",border:"none",color:"#15803d",cursor:"pointer",fontSize:"12px",fontWeight:700,padding:"1px 4px"},children:"\u2715"})]}),l("form",{onSubmit:L,style:{display:"flex",gap:"6px"},children:[e("input",{type:"email",autoFocus:!0,value:J,onChange:c=>{ne(c.target.value),C("")},placeholder:"Enter your real email (e.g. name@gmail.com)",disabled:r,required:!0,style:{flex:1,fontSize:"12.5px",padding:"7px 11px",borderRadius:"7px",border:re?"1.5px solid #ef4444":"1px solid #86efac",background:"#ffffff",color:"#09090b",outline:"none"}}),e("button",{type:"submit",disabled:r||!J.trim(),style:{background:"#16a34a",color:"#ffffff",border:"none",padding:"7px 14px",borderRadius:"7px",fontSize:"12px",fontWeight:600,cursor:r?"wait":"pointer",opacity:r?.7:1},children:r?"...":"Verify & Send"})]}),re&&l("div",{style:{fontSize:"11px",color:"#ef4444",fontWeight:500},children:["\u26A0\uFE0F ",re]}),Z&&l("div",{style:{fontSize:"11px",color:"#15803d",fontWeight:600},children:["\u2713 ",Z]})]}),l("div",{style:{padding:"12px 16px",borderTop:"1px solid #e4e4e7",background:"#fafafa",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0},children:[l("button",{type:"button",onClick:d?k:ge,disabled:w==="connecting",style:{display:"inline-flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:d?"#dc2626":"#000000",color:"#ffffff",borderRadius:"10px",border:"none",fontSize:"13px",fontWeight:600,cursor:w==="connecting"?"not-allowed":"pointer",transition:"all 0.15s ease"},children:[l("svg",{xmlns:"http://www.w3.org/2000/svg",width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e("path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"}),e("path",{d:"M19 10v2a7 7 0 0 1-14 0v-2"}),e("line",{x1:"12",y1:"19",x2:"12",y2:"22"})]}),e("span",{children:d?"End Voice Call":w==="connecting"?"Connecting...":"Start Voice Call"})]}),l("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[d&&e("div",{style:{display:"flex",alignItems:"center",gap:"2.5px",height:"14px"},children:[12,8,14,6,10].map((c,_)=>e("span",{style:{width:"2.5px",height:`${Math.max(4,Math.min(14,Math.round(c*(.35+Math.max(he,ye)*1.5))))}px`,background:"#000000",borderRadius:"1px",transition:"height 0.12s ease"}},_))}),e("span",{style:{fontFamily:"var(--mono, monospace)",fontSize:"12px",fontWeight:600,padding:"3px 8px",borderRadius:"6px",background:d?"#000000":"#f4f4f5",color:d?"#ffffff":"#71717a"},children:G})]})]})]})]})]})}var Ie=Te;var Re={emerald:"#10b981",green:"#10b981",blue:"#2563eb",purple:"#8b5cf6",amber:"#f59e0b",rose:"#f43f5e",slate:"#10b981"};function we(g={}){if(typeof window>"u")return;let{host:a,businessId:S="biz_demo_dental",agentId:T,theme:F="light",position:U="bottom-right",label:E="Talk to Receptionist",accent:R="emerald",accentColor:v,businessName:s,greeting:P,onCallStart:z,onCallEnd:I,onTranscript:W}=g,oe=v||Re[R]||R||"#10b981",ce=document.getElementById("omnidesk-voice-widget-root");ce&&ce.remove();let u=document.createElement("div");u.id="omnidesk-voice-widget-root",u.style.fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";let p=F==="dark"||F==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches,w=null,H="idle",O=0,q=null,he=!1,pe=!1,ye=0,xe=0,G=!1,ee=null,te=null,ie=!1,ae=U==="bottom-left",V=document.createElement("div");V.style.cssText=`
    position: fixed; bottom: 20px; ${ae?"left: 20px;":"right: 20px;"};
    z-index: 999999;
  `;let J=document.createElement("button");J.style.cssText=`
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 18px; border-radius: 9999px;
    background: ${p?"#18181b":"#ffffff"}; color: ${p?"#fafafa":"#09090b"};
    border: 1px solid ${p?"#27272a":"#e4e4e7"};
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    cursor: pointer; font-weight: 600; font-size: 13px;
    transition: transform 0.15s ease, background 0.15s ease;
  `,J.innerHTML=`
    <span id="omnidesk-trigger-dot" style="width:8px;height:8px;border-radius:50%;background:${oe};box-shadow:0 0 8px ${oe};display:inline-block;"></span>
    <span>${E}</span>
    <span id="omnidesk-trigger-arrow" style="font-size:11px;opacity:0.6;">\u25B2</span>
  `,V.appendChild(J);let ne=document.createElement("div");ne.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    z-index: 999998; display: none;
  `,ne.onclick=()=>le(!1);let r=document.createElement("div");r.style.cssText=`
    position: fixed; bottom: 80px; ${ae?"left: 20px;":"right: 20px;"};
    width: 390px; max-width: calc(100vw - 32px); height: 560px; max-height: calc(100vh - 100px);
    background: #ffffff; border: 1px solid #e4e4e7;
    border-radius: 20px; box-shadow: 0 24px 48px -12px rgba(0,0,0,0.22);
    display: none; flex-direction: column; overflow: hidden; z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  `;let N=document.createElement("div");N.style.cssText=`
    background: ${p?"#18181b":"#ffffff"}; color: ${p?"#ffffff":"#09090b"};
    border-bottom: 1px solid ${p?"#27272a":"#e4e4e7"};
    padding: 13px 18px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; user-select: none; flex-shrink: 0;
  `,N.innerHTML=`
    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
      <div style="color: ${p?"rgba(255,255,255,0.6)":"#71717a"}; display: grid; place-items: center; flex-shrink: 0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle>
        </svg>
      </div>
      <div style="width: 28px; height: 28px; border-radius: 50%; background: ${p?"rgba(255,255,255,0.15)":"#f4f4f5"}; display: grid; place-items: center; flex-shrink: 0; color: ${p?"#ffffff":"#09090b"};">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
        </svg>
      </div>
      <div style="display: flex; flex-direction: column; min-width: 0;">
        <div id="omnidesk-biz-title" style="font-size: 13.5px; font-weight: 600; color: ${p?"#ffffff":"#09090b"}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${s||"OmniDesk Hair Salon & Studio"}
        </div>
        <div style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: ${p?"rgba(255,255,255,0.75)":"#71717a"}; white-space: nowrap;">
          <span id="omnidesk-status-dot" style="width: 6px; height: 6px; border-radius: 50%; background: ${p?"rgba(255,255,255,0.4)":"#a1a1aa"}; display: inline-block;"></span>
          <span id="omnidesk-status-text">Idle \xB7 Ready</span>
        </div>
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 8px;">
      <button id="omnidesk-expand-btn" style="background: ${p?"rgba(255,255,255,0.1)":"#f4f4f5"}; border: 1px solid ${p?"rgba(255,255,255,0.15)":"#e4e4e7"}; border-radius: 7px; color: ${p?"#ffffff":"#52525b"}; width: 30px; height: 30px; cursor: pointer; display: grid; place-items: center;" title="Open Full">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
      </button>
      <button id="omnidesk-close-btn" style="background: ${p?"rgba(255,255,255,0.1)":"#f4f4f5"}; border: 1px solid ${p?"rgba(255,255,255,0.15)":"#e4e4e7"}; border-radius: 7px; color: ${p?"#ffffff":"#52525b"}; width: 30px; height: 30px; cursor: pointer; display: grid; place-items: center;" title="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `;let re=document.createElement("style");re.textContent=`
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
  `,u.appendChild(re);let C=document.createElement("div");C.style.cssText=`
    flex: 1; min-height: 0; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 12px; background: #ffffff;
  `;let Z=document.createElement("div");Z.id="omnidesk-placeholder-banner",Z.style.cssText=`
    margin: auto; text-align: center; padding: 10px 18px;
    background: #f4f4f5; border: 1px solid #e4e4e7; color: #52525b;
    border-radius: 12px; font-size: 12.5px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 8px; align-self: center;
  `,Z.innerHTML=`
    <span style="width: 6px; height: 6px; border-radius: 50%; background: #a1a1aa; display: inline-block;"></span>
    <span>Start a call to talk to our receptionist</span>
  `,C.appendChild(Z);let m=document.createElement("div");m.id="omnidesk-thinking-bubble",m.style.cssText=`
    display: none; flex-direction: column; gap: 4px; max-width: 88%; align-self: flex-start;
  `,m.innerHTML=`
    <div style="display: flex; align-items: flex-start; gap: 8px;">
      <div style="width: 24px; height: 24px; border-radius: 50%; background: #18181b; display: grid; place-items: center; color: #ffffff; flex-shrink: 0; margin-top: 2px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        </svg>
      </div>
      <div style="padding: 10px 14px; border-radius: 14px 14px 14px 2px; font-size: 13px; line-height: 1.45; background: ${p?"#18181b":"#f4f4f5"}; color: ${p?"#a1a1aa":"#71717a"}; border: ${p?"1px solid #27272a":"none"}; boxShadow: 0 1px 2px rgba(0,0,0,0.04); display: inline-flex; align-items: center; gap: 5px; min-height: 38px;" title="Agent is thinking and processing...">
        <span class="omnidesk-motion-dot omnidesk-dot-1"></span>
        <span class="omnidesk-motion-dot omnidesk-dot-2"></span>
        <span class="omnidesk-motion-dot omnidesk-dot-3"></span>
      </div>
    </div>
  `,C.appendChild(m);let f=document.createElement("div");f.id="omnidesk-email-bar",f.style.cssText=`
    padding: 11px 16px; background: #f0fdf4; border-top: 1px solid #bbf7d0;
    display: none; flex-direction: column; gap: 7px; flex-shrink: 0;
  `,f.innerHTML=`
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
  `;let D=document.createElement("div");D.style.cssText=`
    padding: 12px 16px; border-top: 1px solid #e4e4e7;
    background: #fafafa; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  `;let x=document.createElement("button");x.style.cssText=`
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; background: #000000; color: #ffffff;
    border-radius: 10px; border: none; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s ease;
  `,x.innerHTML=`
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
    <span id="omnidesk-btn-text">Start Voice Call</span>
  `;let K=document.createElement("div");K.style.cssText=`
    display: flex; align-items: center; gap: 8px;
  `;let b=document.createElement("span");b.id="omnidesk-timer",b.style.cssText=`
    font-family: monospace; font-size: 12px; font-weight: 600;
    padding: 3px 8px; border-radius: 6px; background: #f4f4f5; color: #71717a;
  `,b.innerText="0:00",K.appendChild(b),D.appendChild(x),D.appendChild(K),r.appendChild(N),r.appendChild(C),r.appendChild(f),r.appendChild(D),u.appendChild(V),u.appendChild(ne),u.appendChild(r),document.body.appendChild(u);function Q(){O=Date.now(),b.innerText="0:00",b.style.background="#000000",b.style.color="#ffffff",q&&clearInterval(q),q=setInterval(()=>{let k=Date.now()-O,L=Math.floor(k/1e3),M=Math.floor(L/60),d=L%60;b.innerText=`${M}:${String(d).padStart(2,"0")}`},250)}function X(){q&&(clearInterval(q),q=null),b.style.background="#f4f4f5",b.style.color="#71717a",b.innerText="0:00"}function Y(k){he=k,r.style.display=k?"flex":"none"}function le(k){pe=k,ne.style.display=k?"block":"none",k?(r.style.top="50%",r.style.left="50%",r.style.bottom="auto",r.style.right="auto",r.style.transform="translate(-50%, -50%)",r.style.width="calc(100vw - 40px)",r.style.maxWidth="1140px",r.style.height="calc(100vh - 40px)",r.style.maxHeight="900px"):(r.style.top="auto",r.style.left=ae?"20px":"auto",r.style.right=ae?"auto":"20px",r.style.bottom="80px",r.style.transform="none",r.style.width="390px",r.style.maxWidth="calc(100vw - 32px)",r.style.height="560px",r.style.maxHeight="calc(100vh - 100px)")}J.onclick=()=>Y(!he),N.querySelector("#omnidesk-close-btn").addEventListener("click",()=>{Y(!1),le(!1)}),N.querySelector("#omnidesk-expand-btn").addEventListener("click",()=>{le(!pe)});let h=f.querySelector("#omnidesk-email-form"),j=f.querySelector("#omnidesk-email-input");f.querySelector("#omnidesk-email-close-btn").addEventListener("click",()=>{f.style.display="none"}),h.addEventListener("submit",k=>{k.preventDefault();let L=j.value.trim();if(!L||!L.includes("@"))return;w&&w.sendEmailInput(L),G=!0,f.style.display="none",j.value="",Z.style.display="none";let M=document.createElement("div");M.style.cssText=`
      display: flex; flex-direction: column; gap: 4px; max-width: 88%;
      align-self: flex-end;
    `;let d=document.createElement("div");d.style.cssText=`
      padding: 10px 14px; border-radius: 14px 14px 2px 14px;
      font-size: 13px; line-height: 1.45;
      background: #18181b; color: #ffffff;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    `,d.innerText=`My email is ${L}`,M.appendChild(d),C.insertBefore(M,m),m.style.display="flex",C.scrollTop=C.scrollHeight,ee="user",te=d,ie=!0});async function B(){G=!1,f.style.display="none",m.style.display="none",ee=null,te=null,ie=!1;let k=N.querySelector("#omnidesk-status-text"),L=N.querySelector("#omnidesk-status-dot"),M=x.querySelector("#omnidesk-btn-text");k.innerText="Connecting...",L.style.background="#eab308",M.innerText="Connecting...",x.disabled=!0,Q();try{let d=a;if(!d&&typeof document<"u"){let n=document.querySelector("script[src*='widget.js']");if(n&&n.src&&n.src.startsWith("http"))try{d=new URL(n.src).origin}catch{}}!d&&typeof window<"u"&&!window.location.origin.includes("localhost")&&(d=window.location.origin);let c=(d||"https://omni-desk-rho.vercel.app").replace(/\/$/,""),_=await fetch(`${c}/api/token?businessId=${encodeURIComponent(S)}`);if(!_.ok)throw new Error(`Failed to get session token (${_.status})`);let y=await _.json();if(y.business_name&&!s){let n=N.querySelector("#omnidesk-biz-title");n&&(n.innerText=y.business_name)}let $=T||y.agent_id||"";w=new se({onStatusChange:n=>{if(H=n,n==="connected")k.innerText="Live \xB7 Speaking",L.style.background="#22c55e",M.innerText="End Voice Call",x.style.background="#dc2626",x.disabled=!1,O=Date.now(),z?.();else if(n==="idle"&&(k.innerText="Idle \xB7 Ready",L.style.background=p?"rgba(255,255,255,0.4)":"#a1a1aa",M.innerText="Start Voice Call",x.style.background="#000000",x.disabled=!1,f.style.display="none",m.style.display="none",X(),O>0)){let t=Math.round((Date.now()-O)/1e3);O=0,I?.(t)}},onThinkingChange:n=>{n&&(m.style.display="flex",C.scrollTop=C.scrollHeight)},onTranscript:n=>{if(Z.style.display="none",n.who==="user")n.isFinal&&(m.style.display="flex"),(n.text.includes("@")||n.text.toLowerCase().includes(" at ")&&n.text.toLowerCase().includes(" dot "))&&(G=!0,f.style.display="none");else if(n.who==="agent"){n.text&&n.text.trim().length>0&&(m.style.display="none");let t=n.text.toLowerCase();t.includes("what is your email")||t.includes("what's your email")||t.includes("may i have your email")||t.includes("provide your email")||t.includes("can i have your email")||t.includes("could i get your email")||t.includes("could you provide your email")||t.includes("enter your email")||t.includes("spell your email")||t.includes("where can i send your confirmation")||t.includes("where should i send your confirmation")||t.includes("where can i send your calendar invite")||t.includes("where should i send your calendar invite")||t.includes("email")&&(t.includes("what")||t.includes("have")||t.includes("provide")||t.includes("give")||t.includes("tell")||t.includes("share")||t.includes("address"))?(G=!1,f.style.display="flex",setTimeout(()=>j.focus(),60)):t.includes("verified your email")||t.includes("thank you for your email")||t.includes("thank you for providing your email")||t.includes("sent a calendar invite")||t.includes("sent your confirmation")||t.includes("confirmation code is")||t.includes("i have sent")?(G=!0,f.style.display="none"):G&&(f.style.display="none")}if(ee===n.who&&te&&!ie)te.innerText=n.text,ie=!!n.isFinal;else{let t=document.createElement("div"),o=n.who==="user";t.style.cssText=`
              display: flex; flex-direction: column; gap: 4px; max-width: 88%;
              align-self: ${o?"flex-end":"flex-start"};
            `;let i=document.createElement("div");i.style.cssText=`
              padding: 10px 14px; border-radius: ${o?"14px 14px 2px 14px":"14px 14px 14px 2px"};
              font-size: 13px; line-height: 1.45;
              background: ${o?"#18181b":"#f4f4f5"};
              color: ${o?"#ffffff":"#09090b"};
              box-shadow: 0 1px 2px rgba(0,0,0,0.04);
            `,i.innerText=n.text,t.appendChild(i),C.insertBefore(t,m),ee=n.who,te=i,ie=!!n.isFinal}C.scrollTop=C.scrollHeight,W?.(n)},onAudioLevel:(n,t)=>{ye=n,xe=t},onError:()=>{k.innerText="Error",L.style.background="#ef4444",M.innerText="Start Voice Call",x.style.background="#000000",x.disabled=!1,f.style.display="none",m.style.display="none",X()}}),await w.start(y.token,$,y.voice)}catch(d){console.error("[OmniDesk Voice Widget Error]:",d),k.innerText="Error",L.style.background="#ef4444",M.innerText="Start Voice Call",x.style.background="#000000",x.disabled=!1,f.style.display="none",m.style.display="none",X()}}function ge(){w&&(w.stop(),w=null),H="idle",f.style.display="none",m.style.display="none",X()}return x.onclick=()=>{H==="connected"?ge():H==="idle"&&B()},{destroy:()=>{X(),w&&w.stop(),u.remove()},startCall:B,endCall:ge}}if(typeof document<"u"){let g=document.currentScript||document.querySelector("script[data-agent], script[data-business-id], script[src*='widget.js']");if(g){let a,S=g.src||"";if(S&&S.startsWith("http"))try{a=new URL(S).origin}catch{}let T=g.getAttribute("data-business-id")||void 0,F=g.getAttribute("data-agent")||void 0,U=g.getAttribute("data-theme")||"dark",E=g.getAttribute("data-accent")||"emerald",R=g.getAttribute("data-position")||"bottom-right",v=g.getAttribute("data-label")||void 0,s=g.getAttribute("data-host")||a||"https://omni-desk-rho.vercel.app",P=g.getAttribute("data-greeting")||void 0;document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{we({businessId:T,agentId:F,theme:U,accent:E,position:R,label:v,host:s,greeting:P})}):we({businessId:T,agentId:F,theme:U,accent:E,position:R,label:v,host:s,greeting:P})}}export{se as AssemblyAIVoiceClient,Te as OmniDeskWidget,Ie as VoiceWidget,we as initOmniDeskWidget};
//# sourceMappingURL=index.mjs.map