"use client";

import { useState, useRef, useEffect } from "react";
import { AssemblyAIVoiceClient } from "@/lib/audio";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  ChevronDown,
  ChevronUp,
  Volume2,
  Sparkles,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";

export interface VoiceWidgetProps {
  businessId?: string;
  theme?: string;
  accent?: string;
  position?: string;
  label?: string;
}

export function VoiceWidget({
  businessId = "biz_demo_dental",
  theme = "dark",
  accent = "slate",
  position = "bottom-right",
  label = "Talk to Receptionist",
}: VoiceWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [callStatus, setCallStatus] = useState<
    "idle" | "connecting" | "connected" | "error"
  >("idle");
  const [transcripts, setTranscripts] = useState<
    Array<{ who: "user" | "agent"; text: string }>
  >([]);
  const [userLevel, setUserLevel] = useState(0);
  const [agentLevel, setAgentLevel] = useState(0);
  const [businessName, setBusinessName] = useState("Voice Receptionist");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const voiceClientRef = useRef<AssemblyAIVoiceClient | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (transcripts.length > 0) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcripts]);

  const handleStartCall = async () => {
    try {
      setCallStatus("connecting");
      setTranscripts([]);

      const res = await fetch(`/api/token?businessId=${businessId}`);
      if (!res.ok) throw new Error("Failed to initialize session");
      const data = await res.json();
      if (data.business_name) setBusinessName(data.business_name);

      const client = new AssemblyAIVoiceClient({
        onStatusChange: (status) => setCallStatus(status),
        onTranscript: (ev) => {
          setTranscripts((prev) => [...prev, { who: ev.who, text: ev.text }]);
        },
        onAudioLevel: (u, a) => {
          setUserLevel(u);
          setAgentLevel(a);
        },
        onError: (err) => {
          toast.error(err);
          setCallStatus("error");
        },
      });

      voiceClientRef.current = client;
      await client.start(data.token, data.agent_id);
    } catch (err: any) {
      toast.error(err.message || "Failed to start call");
      setCallStatus("error");
    }
  };

  const handleEndCall = () => {
    if (voiceClientRef.current) {
      voiceClientRef.current.stop();
      voiceClientRef.current = null;
    }
    setCallStatus("idle");
    setUserLevel(0);
    setAgentLevel(0);
  };

  const posClasses =
    position === "bottom-left" ? "left-6 bottom-6" : "right-6 bottom-6";

  return (
    <>
      {/* Backdrop when in full screen */}
      {isOpen && isFullscreen && (
        <div
          onClick={() => setIsFullscreen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-[80] transition-opacity"
        />
      )}

      <div className={`fixed ${isFullscreen ? "inset-4 sm:inset-8 md:inset-12 max-w-4xl mx-auto my-auto z-[90] flex flex-col" : `${posClasses} z-50 flex flex-col items-end`}`}>
        {/* Call Window */}
        {isOpen && (
          <div className={isFullscreen ? "flex-1 w-full flex flex-col rounded-2xl border border-neutral-800 bg-neutral-950/98 p-6 shadow-2xl backdrop-blur-xl transition-all" : "mb-3 w-80 sm:w-96 rounded-2xl border border-neutral-800 bg-neutral-950/95 p-4 shadow-2xl backdrop-blur-xl transition-all"}>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800/80">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-neutral-100 block">
                  {businessName}
                </span>
                <span className="text-[10px] text-neutral-500">
                  Powered by AssemblyAI Voice
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${
                    callStatus === "connected"
                      ? "border-emerald-800 bg-emerald-950/50 text-emerald-300"
                      : callStatus === "connecting"
                      ? "border-amber-800 bg-amber-950/50 text-amber-300 animate-pulse"
                      : "border-neutral-800 text-neutral-400"
                  }`}
                >
                  {callStatus === "connected"
                    ? "Live"
                    : callStatus === "connecting"
                    ? "Connecting"
                    : "Standby"}
                </Badge>
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  title={isFullscreen ? "Minimize" : "Open Full"}
                  className="text-neutral-400 hover:text-white hover:bg-neutral-800/80 p-1.5 rounded-md transition-colors"
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsFullscreen(false);
                    setIsOpen(false);
                  }}
                  title="Close"
                  className="text-neutral-400 hover:text-white hover:bg-neutral-800/80 p-1.5 rounded-md transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

          {/* Transcript Feed */}
          <div className="my-3 h-52 overflow-y-auto rounded-lg border border-neutral-800/60 bg-neutral-900/40 p-2.5 space-y-2">
            {transcripts.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-[11px] text-neutral-500">
                <Volume2 className="h-5 w-5 mb-1.5 text-neutral-600" />
                <span>
                  {callStatus === "connected"
                    ? "Listening... Speak to schedule."
                    : "Press 'Call Receptionist' below to start speaking."}
                </span>
              </div>
            ) : (
              transcripts.map((t, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${
                    t.who === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <span className="text-[9px] text-neutral-500 mb-0.5">
                    {t.who === "user" ? "You" : "Receptionist"}
                  </span>
                  <div
                    className={`max-w-[85%] rounded-md px-2.5 py-1.5 text-[11px] leading-relaxed ${
                      t.who === "user"
                        ? "bg-neutral-800 text-neutral-100"
                        : "bg-neutral-900 border border-neutral-800 text-neutral-200"
                    }`}
                  >
                    {t.text}
                  </div>
                </div>
              ))
            )}
            <div ref={scrollRef} />
          </div>

          {/* Level Meter */}
          {callStatus === "connected" && (
            <div className="mb-3 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-neutral-400">
                <span>Mic Level</span>
                <span>Agent Level</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="h-1.5 rounded-full bg-neutral-900 overflow-hidden">
                  <div
                    className="h-full bg-neutral-200 transition-all duration-75"
                    style={{ width: `${Math.min(100, userLevel * 100)}%` }}
                  />
                </div>
                <div className="h-1.5 rounded-full bg-neutral-900 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-75"
                    style={{ width: `${Math.min(100, agentLevel * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Control Button */}
          {callStatus !== "connected" ? (
            <Button
              onClick={handleStartCall}
              disabled={callStatus === "connecting"}
              className="w-full h-9 text-xs bg-neutral-100 text-neutral-950 font-semibold hover:bg-neutral-200 gap-1.5"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              {callStatus === "connecting" ? "Connecting..." : "Call Receptionist"}
            </Button>
          ) : (
            <Button
              onClick={handleEndCall}
              variant="destructive"
              className="w-full h-9 text-xs font-semibold gap-1.5"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              End Call
            </Button>
          )}
        </div>
      )}

      {/* Floating Launcher Pill Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="h-11 rounded-full border border-neutral-700 bg-neutral-900/90 px-4 text-xs font-semibold text-neutral-100 shadow-xl backdrop-blur-md hover:bg-neutral-800 gap-2"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <Mic className="h-3.5 w-3.5" />
        <span>{label}</span>
      </Button>
    </div>
    </>
  );
}
