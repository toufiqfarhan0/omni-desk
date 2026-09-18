type CallStatus = "idle" | "connecting" | "connected" | "error";
interface TranscriptMessage {
    who: "user" | "agent";
    text: string;
    time?: string;
}
interface VoiceSessionTokenResponse {
    token: string;
    agent_id: string;
    business_name?: string;
    ok?: boolean;
}
interface OmniDeskWidgetProps {
    /**
     * The base URL of your deployed OmniDesk platform.
     * e.g. "https://omni-desk-rho.vercel.app" or "http://localhost:3000"
     */
    host: string;
    /**
     * The target business/tenant ID configured in OmniDesk.
     * Defaults to "biz_demo_dental".
     */
    businessId?: string;
    /**
     * Visual theme for the widget.
     * Defaults to "dark".
     */
    theme?: "dark" | "light" | "auto";
    /**
     * Widget floating position on the screen.
     * Defaults to "bottom-right".
     */
    position?: "bottom-right" | "bottom-left";
    /**
     * Text label displayed on the trigger button.
     * Defaults to "Talk to Receptionist".
     */
    label?: string;
    /**
     * Custom primary accent color (hex or CSS color).
     * Defaults to "#10b981" (emerald).
     */
    accentColor?: string;
    /**
     * Optional custom CSS class for the container.
     */
    className?: string;
    /**
     * Callback fired when a voice call is successfully connected.
     */
    onCallStart?: () => void;
    /**
     * Callback fired when a voice call ends.
     */
    onCallEnd?: (durationSeconds: number) => void;
    /**
     * Callback fired on incoming/outgoing transcript updates.
     */
    onTranscript?: (msg: TranscriptMessage) => void;
}
interface VanillaOmniDeskConfig extends OmniDeskWidgetProps {
    /**
     * Container element ID to mount into, or creates a fixed overlay root if omitted.
     */
    containerId?: string;
}

declare function initOmniDeskWidget(config: VanillaOmniDeskConfig): {
    destroy: () => void;
    startCall: () => Promise<void>;
} | undefined;

export { type CallStatus as C, type OmniDeskWidgetProps as O, type TranscriptMessage as T, type VanillaOmniDeskConfig as V, type VoiceSessionTokenResponse as a, initOmniDeskWidget as i };
