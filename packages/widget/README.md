# omnidesk-voice

> Embeddable autonomous voice receptionist widget and client SDK for [OmniDesk](https://github.com/toufiqfarhan0/omni-desk) & AssemblyAI.

Add a 24kHz conversational voice AI receptionist to any React, Next.js, or HTML website in less than 2 minutes.

---

## Features

- **Real-Time 16kHz/24kHz Web Audio**: Bidirectional PCM streaming directly to AssemblyAI Voice Agent.
- **Autonomous Tool Execution**: Check calendar availability, book appointments, and send email invites during natural speech turns.
- **Dynamic Voice Model Synthesis**: Supports instant voice selection (Anna, Alba, etc.) via AssemblyAI `output.voice` session parameters.
- **Smart Email Verification Bar**: Automatically presents an interactive DNS/MX mail server validation input when the agent requests an email address, then silently closes upon capture.
- **Strict Deduplication**: Guarantees exactly 1 calendar invite (`.ics`) email is sent per appointment.
- **Self-Contained Styling**: Beautiful dark/light/auto themes with zero Tailwind or external CSS setup required.
- **Audio Frequency Visualizer**: Animated waveform indicating both user speech and agent audio levels.
- **Live Transcript Feed**: Real-time turn-by-turn conversation bubbles.
- **Dual Support**: Works out-of-the-box with **React / Next.js** and **Vanilla JS / Static HTML**.

---

## Installation

```bash
npm install omnidesk-voice
# or
pnpm add omnidesk-voice
# or
yarn add omnidesk-voice
```

---

## Quickstart

### 1. React / Next.js App

```tsx
import { OmniDeskWidget } from "omnidesk-voice";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}

        {/* Embed the floating voice receptionist */}
        <OmniDeskWidget
          host="https://omni-desk-rho.vercel.app"
          businessId="biz_demo_dental"
          theme="dark"
          position="bottom-right"
          label="Talk to Receptionist"
          onCallStart={() => console.log("Call started")}
          onCallEnd={(duration) => console.log(`Call lasted ${duration}s`)}
        />
      </body>
    </html>
  );
}
```

---

### 2. Vanilla JS / Static HTML / Shopify / Webflow

```html
<script type="module">
  import { initOmniDeskWidget } from "https://esm.sh/omnidesk-voice";

  initOmniDeskWidget({
    host: "https://omni-desk-rho.vercel.app",
    businessId: "biz_demo_dental",
    theme: "dark",
    position: "bottom-right",
    label: "Talk to Receptionist"
  });
</script>
```

---

### 3. Headless Audio Client (Custom UI)

If you prefer building your own custom voice interface:

```ts
import { AssemblyAIVoiceClient } from "omnidesk-voice";

const client = new AssemblyAIVoiceClient({
  onStatusChange: (status) => console.log("Status:", status),
  onTranscript: (msg) => console.log(`${msg.who}: ${msg.text}`),
  onAudioLevel: (userLevel, agentLevel) => updateWaveform(userLevel, agentLevel),
  onError: (err) => console.error(err),
});

// Start session with token, agent ID, and selected voice from OmniDesk API
const res = await fetch("https://your-domain.com/api/token?businessId=biz_123");
const { token, agent_id, voice } = await res.json();
await client.start(token, agent_id, voice);

// Send verified email input programmatically:
client.sendEmailInput("customer@gmail.com");

// Later: Stop call
client.stop();
```
client.stop();
```

---

## Component Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| **`host`** | `string` | *(Required)* | The base URL of your deployed OmniDesk server (e.g. `https://omni-desk-rho.vercel.app`). |
| **`businessId`** | `string` | `"biz_demo_dental"` | The target practice or business tenant ID. |
| **`theme`** | `"dark" \| "light" \| "auto"` | `"dark"` | Visual color scheme. |
| **`position`** | `"bottom-right" \| "bottom-left"` | `"bottom-right"` | Screen corner position of the floating button and modal. |
| **`label`** | `string` | `"Talk to Receptionist"` | Text label on the trigger button. |
| **`accentColor`**| `string` | `"#10b981"` | Primary accent color for user bubbles, active states, and buttons. |
| **`onCallStart`**| `() => void` | &mdash; | Callback invoked when the voice call successfully connects. |
| **`onCallEnd`**  | `(durationSeconds: number) => void` | &mdash; | Callback invoked when the call terminates with duration in seconds. |
| **`onTranscript`**| `(msg: TranscriptMessage) => void` | &mdash; | Callback invoked for each real-time speech turn. |

---

## Publishing to NPM

To publish a new version to npm:

1. Navigate to the package directory:
   ```bash
   cd packages/widget
   ```
2. Build the distribution bundles:
   ```bash
   npm run build
   ```
3. Login to your npm account (if not already logged in):
   ```bash
   npm login
   ```
4. Publish:
   ```bash
   npm publish --access public
   ```

---

## License

MIT License &copy; 2026 Toufiq Farhan
