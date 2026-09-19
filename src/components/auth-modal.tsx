"use client";

import React, { useState } from "react";
import { toast } from "sonner";

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (owner: any) => void;
  initialMode?: "signin" | "signup";
}

export function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  initialMode = "signin",
}: AuthModalProps) {
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [authError, setAuthError] = useState("");

  if (!isOpen) return null;

  const handleDemoSignIn = async () => {
    if (isDemoLoading) return;
    setIsDemoLoading(true);
    const toastId = toast.loading("Connecting to Demo Account...");

    try {
      if (typeof document !== "undefined") {
        document.cookie =
          "omnidesk_session=owner_demo; path=/; max-age=604800; SameSite=Lax";
      }

      const res = await fetch("/api/auth/session?email=demo@omnidesk.ai");
      const data = await res.json();

      if (data.ok && data.owner) {
        if (typeof window !== "undefined") {
          localStorage.setItem("omnidesk_owner_id", data.owner.id);
          localStorage.setItem("omnidesk_owner_email", data.owner.email);
          localStorage.setItem("omnidesk_owner_name", data.owner.name);
          if (data.businesses && data.businesses.length > 0) {
            localStorage.setItem(
              "omnidesk_selected_biz_id",
              data.businesses[0].id
            );
          } else {
            localStorage.setItem(
              "omnidesk_selected_biz_id",
              "biz_demo_dental"
            );
          }
        }
        if (onSuccess) onSuccess(data.owner);
      } else {
        if (typeof window !== "undefined") {
          localStorage.setItem("omnidesk_owner_id", "owner_demo");
          localStorage.setItem("omnidesk_owner_email", "demo@omnidesk.ai");
          localStorage.setItem("omnidesk_owner_name", "OmniDesk Operator");
          localStorage.setItem("omnidesk_selected_biz_id", "biz_demo_dental");
        }
      }
      toast.success("Welcome, Demo Operator! Opening dashboard...", {
        id: toastId,
      });
    } catch {
      if (typeof window !== "undefined") {
        localStorage.setItem("omnidesk_owner_id", "owner_demo");
        localStorage.setItem("omnidesk_owner_email", "demo@omnidesk.ai");
        localStorage.setItem("omnidesk_owner_name", "OmniDesk Operator");
        localStorage.setItem("omnidesk_selected_biz_id", "biz_demo_dental");
      }
      toast.success("Opening Demo Dashboard...", { id: toastId });
    }

    setTimeout(() => {
      onClose();
      window.location.href = "/dashboard?demo=true";
    }, 450);
  };

  return (
    <div
      className="auth-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "grid",
        placeItems: "center",
        zIndex: 1000,
        padding: "16px",
      }}
    >
      <div
        className="auth-modal-card"
        style={{
          background: "#ffffff",
          border: "1px solid #e4e4e7",
          borderRadius: "20px",
          maxWidth: "490px",
          width: "100%",
          padding: "32px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          maxHeight: "92vh",
          overflowY: "auto",
          position: "relative",
          animation: "modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <div>
            <h3
              style={{
                fontSize: "20px",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                margin: "0 0 4px",
                color: "#09090b",
              }}
            >
              OmniDesk Portal Access
            </h3>
            <p
              style={{
                fontSize: "13.5px",
                color: "#71717a",
                margin: 0,
                lineHeight: "1.45",
              }}
            >
              Manage your AI voice receptionist, test live calls, and explore scheduling.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: "transparent",
              border: "none",
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              color: "#71717a",
              fontSize: "22px",
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            &times;
          </button>
        </div>

        {/* BLURRED & DISABLED SIGN IN / SIGN UP SECTION */}
        <div style={{ position: "relative" }}>
          {/* Frosted Glass Overlay with Clear Notice & Demo Account Button */}
          <div
            style={{
              position: "absolute",
              inset: "-6px",
              zIndex: 20,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px 24px",
              textAlign: "center",
              background: "rgba(255, 255, 255, 0.78)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              borderRadius: "16px",
              border: "1px dashed #cbd5e1",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                background: "#f1f5f9",
                border: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "12px",
                color: "#475569",
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div
              style={{
                fontSize: "15px",
                fontWeight: 700,
                color: "#0f172a",
                marginBottom: "5px",
              }}
            >
              Email Sign In &amp; Registration Disabled
            </div>
            <p
              style={{
                fontSize: "13px",
                color: "#64748b",
                margin: "0 0 18px",
                maxWidth: "320px",
                lineHeight: "1.45",
              }}
            >
              We don&apos;t require users to sign in or register. Please use our instant Demo Account to explore all voice agent and booking features.
            </p>
            <button
              type="button"
              onClick={handleDemoSignIn}
              disabled={isDemoLoading}
              style={{
                width: "100%",
                maxWidth: "300px",
                background: "#09090b",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "14px",
                padding: "12px 20px",
                borderRadius: "10px",
                border: "none",
                cursor: isDemoLoading ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.18)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#262626";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#09090b";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {isDemoLoading ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                  <svg
                    style={{ animation: "spin 1s linear infinite", width: "15px", height: "15px" }}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                  </svg>
                  <span>Connecting to Demo...</span>
                </span>
              ) : (
                <span>Enter as Demo Account &rarr;</span>
              )}
            </button>
          </div>

          {/* Blurred Form Behind */}
          <div
            style={{
              filter: "blur(3.5px)",
              opacity: 0.4,
              pointerEvents: "none",
              userSelect: "none",
            }}
            aria-hidden="true"
          >
            {/* Divider */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                textAlign: "center",
                margin: "16px 0",
                color: "#a1a1aa",
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              <div style={{ flex: 1, borderBottom: "1px solid #e4e4e7" }} />
              <span style={{ padding: "0 12px" }}>Or Continue with Email</span>
              <div style={{ flex: 1, borderBottom: "1px solid #e4e4e7" }} />
            </div>

            {/* Tabs */}
            <div
              style={{
                display: "flex",
                background: "#f4f4f5",
                border: "1px solid #e4e4e7",
                borderRadius: "8px",
                padding: "3px",
                marginBottom: "16px",
              }}
            >
              <button
                type="button"
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "none",
                  background: mode === "signin" ? "#ffffff" : "transparent",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: mode === "signin" ? "#09090b" : "#71717a",
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "none",
                  background: mode === "signup" ? "#ffffff" : "transparent",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: mode === "signup" ? "#09090b" : "#71717a",
                }}
              >
                Create Account
              </button>
            </div>

            {/* Inputs */}
            <div style={{ marginBottom: "12px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  marginBottom: "5px",
                  color: "#09090b",
                }}
              >
                Email Address
              </label>
              <input
                type="email"
                tabIndex={-1}
                readOnly
                value="demo@omnidesk.ai"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #e4e4e7",
                  borderRadius: "8px",
                  fontSize: "13.5px",
                  background: "#fff",
                  color: "#09090b",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  marginBottom: "5px",
                  color: "#09090b",
                }}
              >
                Password
              </label>
              <input
                type="password"
                tabIndex={-1}
                readOnly
                value="••••••••••••"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "1px solid #e4e4e7",
                  borderRadius: "8px",
                  fontSize: "13.5px",
                  background: "#fff",
                  color: "#09090b",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <button
              type="button"
              tabIndex={-1}
              style={{
                width: "100%",
                background: "#09090b",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontSize: "13.5px",
                fontWeight: 600,
                padding: "11px 16px",
              }}
            >
              Sign In
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes modalPop {
          from { transform: translateY(12px) scale(0.97); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
