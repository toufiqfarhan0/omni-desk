import React from 'react';
import { O as OmniDeskWidgetProps, C as CallStatus, T as TranscriptMessage } from './vanilla-jta3krqA.mjs';
export { V as VanillaOmniDeskConfig, a as VoiceSessionTokenResponse, i as initOmniDeskWidget } from './vanilla-jta3krqA.mjs';

declare function OmniDeskWidget({ host, businessId, theme, position, label, accentColor, className, onCallStart, onCallEnd, onTranscript, }: OmniDeskWidgetProps): React.JSX.Element;

interface VoiceSessionCallbacks {
    onStatusChange?: (status: CallStatus) => void;
    onTranscript?: (event: TranscriptMessage) => void;
    onToolEvent?: (event: {
        type: "call" | "result";
        tool: string;
        args?: any;
        result?: any;
    }) => void;
    onError?: (err: string) => void;
    onAudioLevel?: (userLevel: number, agentLevel: number) => void;
}
declare class AssemblyAIVoiceClient {
    private ws;
    private captureCtx;
    private playbackCtx;
    private playbackNode;
    private captureNode;
    private micStream;
    private isConnected;
    private callbacks;
    private userLevel;
    private agentLevel;
    private animFrameId;
    private isMuted;
    constructor(callbacks: VoiceSessionCallbacks);
    start(token: string, agentId: string): Promise<void>;
    setMuted(muted: boolean): void;
    getMuted(): boolean;
    stop(): void;
    private startVisualizerLoop;
}

export { AssemblyAIVoiceClient, CallStatus, OmniDeskWidget, OmniDeskWidgetProps, TranscriptMessage, type VoiceSessionCallbacks };
