"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";

export interface UserNavProps {
  ownerInfo?: { id: string; email: string; name: string } | null;
  onSignOut?: () => void;
  onSwitchToDemo?: () => void;
  align?: "left" | "right";
}

function getInitials(name?: string, email?: string): string {
  return "DE";
}

export function UserNav({ ownerInfo: propOwner, onSignOut, onSwitchToDemo, align = "right" }: UserNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [owner, setOwner] = useState<{ id: string; email: string; name: string } | null>(propOwner || null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Sync with localStorage if prop not provided or on mount
  useEffect(() => {
    if (propOwner) {
      setOwner(propOwner);
      return;
    }
    if (typeof window !== "undefined") {
      const id = localStorage.getItem("omnidesk_owner_id");
      const email = localStorage.getItem("omnidesk_owner_email");
      const name = localStorage.getItem("omnidesk_owner_name");
      if (id) {
        setOwner({
          id,
          email: email || (id === "owner_demo" ? "demo@omnidesk.ai" : "operator@omnidesk.ai"),
          name: name || (id === "owner_demo" ? "OmniDesk Operator" : "Operator"),
        });
      }
    }
  }, [propOwner]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleLogoutClick = () => {
    setIsOpen(false);
    if (onSignOut) {
      onSignOut();
      return;
    }

    if (typeof document !== "undefined") {
      document.cookie = "omnidesk_session=; path=/; max-age=0; SameSite=Lax";
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem("omnidesk_owner_id");
      localStorage.removeItem("omnidesk_owner_email");
      localStorage.removeItem("omnidesk_owner_name");
      localStorage.removeItem("omnidesk_selected_biz_id");
    }
    toast.success("Signed out successfully.");
    setTimeout(() => {
      window.location.href = "/";
    }, 200);
  };

  const handleSwitchDemoClick = () => {
    setIsOpen(false);
    if (onSwitchToDemo) {
      onSwitchToDemo();
      return;
    }

    if (typeof document !== "undefined") {
      document.cookie = "omnidesk_session=owner_demo; path=/; max-age=604800; SameSite=Lax";
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("omnidesk_owner_id", "owner_demo");
      localStorage.setItem("omnidesk_owner_email", "demo@omnidesk.ai");
      localStorage.setItem("omnidesk_owner_name", "OmniDesk Operator");
      localStorage.setItem("omnidesk_selected_biz_id", "biz_demo_dental");
    }
    toast.success("Switched to Demo Account workspace.");
    setTimeout(() => {
      window.location.href = "/dashboard?demo=true";
    }, 250);
  };

  if (!owner) return null;

  const initials = "DE";
  const isDemo = owner.id === "owner_demo";
  const displayName = owner.name && owner.name !== "OmniDesk Operator" ? owner.name : (owner.email ? owner.email.split("@")[0] : "Demo Operator");

  return (
    <div ref={dropdownRef} style={{ position: "relative", display: "inline-block" }}>
      {/* Circle Avatar Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="User account menu"
        aria-expanded={isOpen}
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          background: "#ffffff",
          color: "#000000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: "12.5px",
          letterSpacing: "0.04em",
          border: "1.5px solid #000000",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
          cursor: "pointer",
          transition: "transform 0.15s ease, background 0.15s ease",
          outline: "none",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.05)";
          e.currentTarget.style.background = "#f4f4f5";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.background = "#ffffff";
        }}
      >
        {initials}
      </button>

      {/* Dropdown Menu Modal */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: align === "right" ? 0 : "auto",
            left: align === "left" ? 0 : "auto",
            minWidth: "200px",
            background: "#ffffff",
            border: "1px solid #e4e4e7",
            borderRadius: "14px",
            boxShadow:
              "0 15px 30px -10px rgba(0, 0, 0, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
            padding: "8px",
            zIndex: 1000,
            color: "#09090b",
            fontFamily: "var(--font)",
          }}
        >
          {/* Header Info */}
          <div
            style={{
              padding: "8px 12px 10px",
              borderBottom: "1px solid #f4f4f5",
              marginBottom: "4px",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "#09090b",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                marginBottom: "2px",
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "#71717a",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {owner.email}
            </div>
          </div>

          {/* Logout Button (Only Log out in dropdown) */}
          <button
            type="button"
            onClick={handleLogoutClick}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              width: "100%",
              padding: "9px 12px",
              borderRadius: "8px",
              background: "transparent",
              border: "none",
              color: "#dc2626",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              textAlign: "left",
              transition: "background 0.12s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#dc2626"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
}
