export type CallStatus = "idle" | "connecting" | "connected" | "error";

export interface TranscriptMessage {
  who: "user" | "agent";
  text: string;
  time?: string;
}

export interface VoiceSessionTokenResponse {
  token: string;
  agent_id: string;
  business_name?: string;
  voice?: string;
  ok?: boolean;
}

export interface OmniDeskWidgetProps {
  /**
   * The base URL of your deployed OmniDesk platform.
   * e.g. "https://omni-desk-rho.vercel.app" or "http://localhost:3000".
   * Defaults to window.location.origin when in browser.
   */
  host?: string;
  /**
   * The target business/tenant ID configured in OmniDesk.
   * Defaults to "biz_demo_dental".
   */
  businessId?: string;
  /**
   * Optional explicit AssemblyAI Agent ID.
   * If omitted, resolved dynamically from OmniDesk /api/token.
   */
  agentId?: string;
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
   * Primary accent theme name ("slate" | "purple" | "blue" | "emerald") or custom CSS color.
   * Defaults to "slate".
   */
  accent?: "slate" | "purple" | "blue" | "emerald" | string;
  /**
   * Custom primary accent color (hex or CSS color). Legacy alias for `accent`.
   */
  accentColor?: string;
  /**
   * Optional custom business name title in the widget header.
   */
  businessName?: string;
  /**
   * Initial greeting bubble displayed before/during call.
   */
  greeting?: string;
  /**
   * Custom suggestion prompt chips displayed when call is connected.
   */
  suggestions?: string[];
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

export type VoiceWidgetProps = OmniDeskWidgetProps;

export interface VanillaOmniDeskConfig extends OmniDeskWidgetProps {
  /**
   * Container element ID to mount into, or creates a fixed overlay root if omitted.
   */
  containerId?: string;
}
