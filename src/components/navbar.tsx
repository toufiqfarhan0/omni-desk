"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { UserNav } from "@/components/user-nav";
import { AuthModal } from "@/components/auth-modal";
import { toast } from "sonner";

export interface NavbarProps {
  activeSection?: "features" | "architecture" | "docs" | "demo" | "dashboard";
  className?: string;
  onOpenAuthModal?: () => void;
}

export function Navbar({ activeSection, className = "", onOpenAuthModal }: NavbarProps) {
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    email: string;
    name: string;
  } | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Sync auth state on mount and across tabs
  useEffect(() => {
    const syncUser = () => {
      if (typeof window === "undefined") return;
      const id = localStorage.getItem("omnidesk_owner_id");
      const email = localStorage.getItem("omnidesk_owner_email");
      const name = localStorage.getItem("omnidesk_owner_name");
      if (id) {
        setCurrentUser({
          id,
          email:
            email ||
            (id === "owner_demo" ? "demo@omnidesk.ai" : "operator@omnidesk.ai"),
          name:
            name ||
            (id === "owner_demo" ? "OmniDesk Operator" : "Practice Operator"),
        });
      } else {
        setCurrentUser(null);
      }
    };

    syncUser();
    window.addEventListener("storage", syncUser);
    return () => window.removeEventListener("storage", syncUser);
  }, []);

  const handleSignOut = () => {
    if (typeof document !== "undefined") {
      document.cookie = "omnidesk_session=; path=/; max-age=0; SameSite=Lax";
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem("omnidesk_owner_id");
      localStorage.removeItem("omnidesk_owner_email");
      localStorage.removeItem("omnidesk_owner_name");
      localStorage.removeItem("omnidesk_selected_biz_id");
    }
    setCurrentUser(null);
    toast.success("Signed out successfully.");
  };

  return (
    <>
      <header
        className={`omnidesk-navbar ${className}`}
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(255, 255, 255, 0.90)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid #e4e4e7",
          transition: "border-color 0.2s ease",
        }}
      >
        <div
          style={{
            maxWidth: "1180px",
            margin: "0 auto",
            padding: "0 24px",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              height: "68px",
            }}
          >
            {/* Logo */}
            <Link
              href="/"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                textDecoration: "none",
                color: "#09090b",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  display: "grid",
                  placeItems: "center",
                  color: "#09090b",
                  flexShrink: 0,
                }}
              >
                <BrandLogo size={32} />
              </div>
              <span
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  letterSpacing: "-0.025em",
                  color: "#09090b",
                }}
              >
                OmniDesk
              </span>
            </Link>

            {/* Central Navigation Links */}
            <div
              className="navbar-links"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "28px",
              }}
            >
              <Link
                href="/#features"
                style={{
                  fontSize: "13.5px",
                  fontWeight: 500,
                  color: activeSection === "features" ? "#09090b" : "#71717a",
                  textDecoration: "none",
                  transition: "color 0.15s ease",
                }}
              >
                Capabilities
              </Link>
              <Link
                href="/#architecture"
                style={{
                  fontSize: "13.5px",
                  fontWeight: 500,
                  color: activeSection === "architecture" ? "#09090b" : "#71717a",
                  textDecoration: "none",
                  transition: "color 0.15s ease",
                }}
              >
                Architecture
              </Link>
              <Link
                href="/docs"
                style={{
                  fontSize: "13.5px",
                  fontWeight: 500,
                  color: activeSection === "docs" ? "#09090b" : "#71717a",
                  textDecoration: "none",
                  transition: "color 0.15s ease",
                }}
              >
                Docs
              </Link>
            </div>

            {/* Right Action Items */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Link
                href="/demo"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "13px",
                  fontWeight: 600,
                  padding: "7px 14px",
                  borderRadius: "8px",
                  border: "1px solid #e4e4e7",
                  background: "#ffffff",
                  color: "#52525b",
                  textDecoration: "none",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  transition: "all 0.15s ease",
                }}
              >
                Try Demos
              </Link>

              {currentUser ? (
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Link
                    href="/dashboard"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      fontWeight: 600,
                      padding: "7px 16px",
                      borderRadius: "8px",
                      background: "#09090b",
                      color: "#ffffff",
                      textDecoration: "none",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                      transition: "background 0.15s ease",
                    }}
                  >
                    Dashboard &rarr;
                  </Link>
                  <UserNav
                    ownerInfo={currentUser}
                    onSignOut={handleSignOut}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenAuthModal) {
                      onOpenAuthModal();
                    } else {
                      toast.info("You need to login to access the owner portal.");
                      setAuthModalOpen(true);
                    }
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "7px",
                    fontSize: "13px",
                    fontWeight: 600,
                    padding: "7px 16px",
                    borderRadius: "8px",
                    background: "#09090b",
                    color: "#ffffff",
                    border: "1px solid #09090b",
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" x2="19" y1="8" y2="14" />
                    <line x1="22" x2="16" y1="11" y2="11" />
                  </svg>
                  <span>Sign In / Sign Up</span>
                </button>
              )}
            </div>
          </nav>
        </div>
      </header>

      {/* Unified Auth / Demo Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(owner) => {
          setCurrentUser(owner);
          setAuthModalOpen(false);
        }}
      />
    </>
  );
}
