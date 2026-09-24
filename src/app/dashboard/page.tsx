"use client";

import { useState, useEffect, useCallback } from "react";
import { Business } from "@/lib/db";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { AgentBuilder } from "@/components/dashboard/agent-builder";
import { VoiceTester } from "@/components/dashboard/voice-tester";
import { BookingsCRM } from "@/components/dashboard/bookings-crm";
import { CallHistory } from "@/components/dashboard/call-history";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type TabId = "builder" | "simulator" | "bookings" | "conversations";

const TAB_LABELS: Record<TabId, string> = {
  builder: "AI Agent Builder",
  simulator: "Live Voice Tester",
  bookings: "Customer Bookings",
  conversations: "Call History",
};

export default function DashboardPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("builder");
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // New Business Modal
  const [newBizOpen, setNewBizOpen] = useState(false);
  const [newBizName, setNewBizName] = useState("");
  const [newBizIndustry, setNewBizIndustry] = useState("");
  const [newBizCustomType, setNewBizCustomType] = useState("");
  const [isCreatingBiz, setIsCreatingBiz] = useState(false);
  const [ownerInfo, setOwnerInfo] = useState<{ id: string; email: string; name: string }>({
    id: "owner_demo",
    email: "demo@omnidesk.ai",
    name: "Demo Operator",
  });

  useEffect(() => {
    async function load() {
      try {
        let savedOwnerId = typeof window !== "undefined" ? localStorage.getItem("omnidesk_owner_id") : null;
        const savedOwnerEmail = typeof window !== "undefined" ? localStorage.getItem("omnidesk_owner_email") : null;
        const savedOwnerName = typeof window !== "undefined" ? localStorage.getItem("omnidesk_owner_name") : null;

        // If not in localStorage, check if cookie exists
        if (!savedOwnerId && typeof document !== "undefined") {
          const match = document.cookie.match(/(?:^|;\s*)omnidesk_session=([^;]+)/);
          if (match && match[1]) {
            savedOwnerId = decodeURIComponent(match[1]);
            localStorage.setItem("omnidesk_owner_id", savedOwnerId);
          }
        }

        // Check if demo query param is set (user explicitly clicked Enter as Demo Account)
        const isDemoParam = typeof window !== "undefined" && window.location.search.includes("demo=true");

        if (isDemoParam && !savedOwnerId) {
          savedOwnerId = "owner_demo";
          if (typeof localStorage !== "undefined") {
            localStorage.setItem("omnidesk_owner_id", "owner_demo");
            localStorage.setItem("omnidesk_owner_email", "demo@omnidesk.ai");
            localStorage.setItem("omnidesk_owner_name", "OmniDesk Operator");
            localStorage.setItem("omnidesk_selected_biz_id", "biz_demo_dental");
          }
        }

        // Client-side guard: if no owner logged in, redirect to home with auth modal
        if (!savedOwnerId) {
          setIsLoading(false);
          window.location.href = "/?auth=required&redirect=/dashboard";
          return;
        }

        const effectiveOwnerId = savedOwnerId;

        // Make sure cookie is also in sync with localStorage
        if (typeof document !== "undefined" && !document.cookie.includes("omnidesk_session=")) {
          const maxAge = 604800;
          document.cookie = `omnidesk_session=${encodeURIComponent(effectiveOwnerId)}; path=/; max-age=${maxAge}; SameSite=Lax`;
        }

        setOwnerInfo({
          id: effectiveOwnerId,
          email: savedOwnerEmail || (effectiveOwnerId === "owner_demo" ? "demo@omnidesk.ai" : "operator@omnidesk.ai"),
          name: savedOwnerName || (effectiveOwnerId === "owner_demo" ? "OmniDesk Operator" : "Practice Operator"),
        });

        const res = await fetch(`/api/owner/businesses?ownerId=${encodeURIComponent(effectiveOwnerId)}`);
        if (res.ok) {
          const data = await res.json();
          const list: Business[] = data.businesses || [];
          setBusinesses(list);
          if (list.length > 0) {
            const savedId =
              typeof window !== "undefined"
                ? localStorage.getItem("omnidesk_selected_biz_id")
                : null;
            const salonBiz = list.find(
              (b) =>
                b.id === "biz_demo_dental" ||
                b.industry?.toLowerCase() === "salon" ||
                b.name?.toLowerCase().includes("hair salon") ||
                b.name?.toLowerCase().includes("salon")
            );
            const savedBiz = savedId
              ? list.find((b) => b.id === savedId)
              : null;
            setSelectedBusiness(savedBiz || salonBiz || list[0]);
          }
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const handleSelectBusiness = (biz: Business) => {
    setSelectedBusiness(biz);
    if (typeof window !== "undefined") {
      localStorage.setItem("omnidesk_selected_biz_id", biz.id);
    }
  };

  const handleSignOut = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("omnidesk_owner_id");
      localStorage.removeItem("omnidesk_owner_email");
      localStorage.removeItem("omnidesk_owner_name");
      localStorage.removeItem("omnidesk_selected_biz_id");
      document.cookie = "omnidesk_session=; path=/; max-age=0; SameSite=Lax";
    }
    window.location.href = "/";
  };

  const handleUpdateBusiness = useCallback((updated: Business) => {
    setSelectedBusiness(updated);
    setBusinesses((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  }, []);

  const handleCreateBusinessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBizName.trim()) return;

    setIsCreatingBiz(true);
    const chosenIndustry = newBizIndustry || newBizCustomType.trim() || "general";
    const effectiveOwnerId = ownerInfo.id || "owner_demo";

    try {
      const res = await fetch(`/api/owner/businesses?ownerId=${encodeURIComponent(effectiveOwnerId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_id: effectiveOwnerId,
          name: newBizName.trim(),
          industry: chosenIndustry,
          tone: "warm",
          greeting: `Thanks for calling ${newBizName.trim()}. Are you looking to book an appointment?`,
          system_prompt: `You are an autonomous voice receptionist for ${newBizName.trim()}. You speak naturally, answer questions about our services, check real calendar slots using your tools, and book appointments for callers.`,
          slot_minutes: 30,
          open_hour: 9,
          close_hour: 17,
          operating_days: "mon-fri",
          services: [
            {
              key: "consultation",
              label: "Initial Consultation",
              minutes: 30,
              price: 95,
              description: "Comprehensive evaluation and intake.",
            },
            {
              key: "standard-service",
              label: "Standard Service Appointment",
              minutes: 45,
              price: 150,
              description: "Full professional appointment.",
            },
          ],
        }),
      });

      if (!res.ok) throw new Error("Failed to create new business");
      const data = await res.json();
      if (data.business) {
        setBusinesses((prev) => [data.business, ...prev]);
        setSelectedBusiness(data.business);
        setNewBizOpen(false);
        setNewBizName("");
        setNewBizIndustry("");
        setNewBizCustomType("");
        toast.success(`Created workflow for ${data.business.name}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create workflow");
    } finally {
      setIsCreatingBiz(false);
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop is-open"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <DashboardSidebar
        businesses={businesses}
        selectedBusiness={selectedBusiness}
        onSelectBusiness={handleSelectBusiness}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab as TabId);
          setSidebarOpen(false);
        }}
        isOpen={sidebarOpen}
        onNewBusiness={() => setNewBizOpen(true)}
        ownerInfo={ownerInfo}
        onSignOut={handleSignOut}
      />

      {/* Main Content Area */}
      <div className="main-content-area">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <button
              id="sidebar-toggle-btn"
              className="sidebar-toggle-btn"
              type="button"
              aria-label="Toggle Menu"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div className="breadcrumb">
              <span className="breadcrumb-root">Dashboard</span>
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb-current">{TAB_LABELS[activeTab]}</span>
            </div>
          </div>
          <div className="topbar-right">
            <div className="live-voice-pill">
              <span className="pulse-dot" />
              <span>AssemblyAI Connected</span>
            </div>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="dash-container">
          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "1260px", margin: "0 auto", width: "100%" }}>
              {/* Skeleton header */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div className="skeleton-shimmer" style={{ width: "200px", height: "16px", borderRadius: "5px" }} />
                <div className="skeleton-shimmer" style={{ width: "320px", height: "12px", borderRadius: "4px" }} />
              </div>
              {/* Skeleton two-col layout */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "20px" }}>
                <div style={{ background: "#ffffff", border: "1px solid #e4e4e7", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                      <div className="skeleton-shimmer" style={{ width: "90px", height: "11px", borderRadius: "3px" }} />
                      <div className="skeleton-shimmer" style={{ width: "100%", height: "40px", borderRadius: "8px" }} />
                    </div>
                  ))}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                    <div className="skeleton-shimmer" style={{ height: "40px", borderRadius: "8px" }} />
                    <div className="skeleton-shimmer" style={{ height: "40px", borderRadius: "8px" }} />
                  </div>
                  <div className="skeleton-shimmer" style={{ width: "100%", height: "90px", borderRadius: "8px" }} />
                </div>
                <div style={{ background: "#ffffff", border: "1px solid #e4e4e7", borderRadius: "12px", padding: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div className="skeleton-shimmer" style={{ width: "40px", height: "40px", borderRadius: "50%" }} />
                    <div>
                      <div className="skeleton-shimmer" style={{ width: "100px", height: "13px", borderRadius: "4px", marginBottom: "6px" }} />
                      <div className="skeleton-shimmer" style={{ width: "70px", height: "20px", borderRadius: "6px" }} />
                    </div>
                  </div>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="skeleton-shimmer" style={{ width: "100%", height: "36px", borderRadius: "8px" }} />
                  ))}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="skeleton-shimmer" style={{ height: "26px", borderRadius: "6px" }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

          ) : !selectedBusiness ? (
            <div style={{ display: "flex", height: "200px", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              No business tenant found. Click + New Business to create one.
            </div>
          ) : (
            <>
              {activeTab === "builder" && (
                <AgentBuilder
                  key={selectedBusiness.id}
                  business={selectedBusiness}
                  onUpdateBusiness={handleUpdateBusiness}
                />
              )}
              {activeTab === "simulator" && (
                <VoiceTester
                  key={selectedBusiness.id}
                  business={selectedBusiness}
                />
              )}
              {activeTab === "bookings" && (
                <BookingsCRM
                  key={selectedBusiness.id}
                  business={selectedBusiness}
                />
              )}
              {activeTab === "conversations" && (
                <CallHistory
                  key={selectedBusiness.id}
                  business={selectedBusiness}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* NEW BUSINESS MODAL Matching web/dashboard.html */}
      {newBizOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(2px)",
            zIndex: 100,
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setNewBizOpen(false);
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              maxWidth: "480px",
              width: "100%",
              padding: "24px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Create New Business Workflow</h2>
              <button
                type="button"
                onClick={() => setNewBizOpen(false)}
                style={{ background: "transparent", border: "none", fontSize: "20px", color: "var(--text-muted)", cursor: "pointer" }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateBusinessSubmit}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: "6px" }}>
                  Business Name
                </label>
                <input
                  type="text"
                  value={newBizName}
                  onChange={(e) => setNewBizName(e.target.value)}
                  placeholder="e.g. Lumina MedSpa, Vanguard Advisory, City Clinic"
                  required
                  style={{
                    width: "100%",
                    fontFamily: "var(--font)",
                    fontSize: "13.5px",
                    padding: "9px 12px",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: "6px" }}>
                  Industry / Business Type
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <Select
                    value={newBizIndustry}
                    onValueChange={(val) => setNewBizIndustry(val)}
                  >
                    <SelectTrigger
                      style={{
                        width: "100%",
                        height: "40px",
                        background: "#ffffff",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                        padding: "0 12px",
                        fontSize: "13.5px",
                        fontWeight: 500,
                        color: "var(--text)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                      }}
                    >
                      <SelectValue placeholder="-- Select an industry preset --" />
                    </SelectTrigger>
                    <SelectContent
                      style={{
                        background: "#ffffff",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                        boxShadow: "0 10px 25px -5px rgba(0,0,0,0.12)",
                        zIndex: 9999,
                      }}
                    >
                      <SelectItem value="salon" style={{ fontSize: "13px", padding: "8px 12px", cursor: "pointer" }}>Hair Salon &amp; Studio</SelectItem>
                      <SelectItem value="medspa" style={{ fontSize: "13px", padding: "8px 12px", cursor: "pointer" }}>MedSpa &amp; Aesthetics</SelectItem>
                      <SelectItem value="legal" style={{ fontSize: "13px", padding: "8px 12px", cursor: "pointer" }}>Law Firm &amp; Legal Services</SelectItem>
                      <SelectItem value="dental" style={{ fontSize: "13px", padding: "8px 12px", cursor: "pointer" }}>Dental Clinic</SelectItem>
                      <SelectItem value="auto" style={{ fontSize: "13px", padding: "8px 12px", cursor: "pointer" }}>Automotive Repair</SelectItem>
                      <SelectItem value="realestate" style={{ fontSize: "13px", padding: "8px 12px", cursor: "pointer" }}>Real Estate</SelectItem>
                    </SelectContent>
                  </Select>
                  <input
                    type="text"
                    value={newBizCustomType}
                    onChange={(e) => setNewBizCustomType(e.target.value)}
                    placeholder="Or type your business type (e.g. Veterinary, Fitness, Plumbing)..."
                    style={{
                      width: "100%",
                      fontFamily: "var(--font)",
                      fontSize: "13px",
                      padding: "8px 12px",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--border)",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
                <button
                  type="submit"
                  disabled={isCreatingBiz}
                  style={{
                    flex: 1,
                    background: "#000000",
                    color: "#ffffff",
                    border: "none",
                    padding: "11px",
                    borderRadius: "var(--radius)",
                    fontSize: "13.5px",
                    fontWeight: 600,
                    cursor: isCreatingBiz ? "not-allowed" : "pointer",
                    opacity: isCreatingBiz ? 0.7 : 1,
                  }}
                >
                  {isCreatingBiz ? "Creating..." : "Create Workflow"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        :root {
          --bg: #ffffff;
          --surface: #fafafa;
          --surface-2: #f4f4f5;
          --border: #e4e4e7;
          --border-dark: #d4d4d8;
          --text: #09090b;
          --text-muted: #71717a;
          --text-sub: #a1a1aa;
          --accent: #000000;
          --accent-fg: #ffffff;
          --font: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          --mono: "JetBrains Mono", monospace;
          --radius: 8px;
          --radius-lg: 12px;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: var(--font); background: #fafafa; color: var(--text); min-height: 100vh; -webkit-font-smoothing: antialiased; }
        .dashboard-layout { display: flex; min-height: 100vh; width: 100%; background: #fafafa; }
        .sidebar-backdrop { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.35); backdrop-filter: blur(2px); z-index: 39; }
        .sidebar-backdrop.is-open { display: block; }
        .main-content-area {
          flex: 1;
          margin-left: 270px;
          width: calc(100% - 270px);
          min-width: 0;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: #fafafa;
          padding-top: 64px;
          box-sizing: border-box;
        }
        .topbar { background: #ffffff; border-bottom: 1px solid var(--border); height: 64px; box-sizing: border-box; padding: 0 28px; display: flex; align-items: center; justify-content: space-between; position: fixed; top: 0; left: 270px; right: 0; z-index: 30; }
        .topbar-left { display: flex; align-items: center; gap: 12px; }
        .sidebar-toggle-btn { display: none; background: none; border: 1px solid var(--border); border-radius: 6px; padding: 6px; cursor: pointer; color: var(--text); }
        .breadcrumb { display: flex; align-items: center; gap: 8px; font-size: 13.5px; }
        .breadcrumb-root { color: var(--text-muted); font-weight: 500; }
        .breadcrumb-sep { color: var(--text-sub); font-size: 12px; }
        .breadcrumb-current { font-weight: 600; color: var(--text); }
        .topbar-right { display: flex; align-items: center; gap: 12px; }
        .live-voice-pill { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 500; background: #f4f4f5; border: 1px solid var(--border); padding: 5px 11px; border-radius: 99px; color: var(--text-muted); }
        .demo-link { font-size: 12.5px; font-weight: 500; color: var(--text-muted); text-decoration: none; padding: 6px 12px; border-radius: var(--radius); border: 1px solid var(--border); background: #ffffff; transition: all 0.15s; }
        .demo-link:hover { color: var(--text); border-color: #000000; }
        .dash-container { max-width: 1260px; width: 100%; margin: 0 auto; padding: 24px 28px 64px; flex: 1; }
        @media (max-width: 960px) {
          .main-content-area { margin-left: 0; width: 100%; }
          .topbar { left: 0; }
          .sidebar-toggle-btn { display: inline-flex; }
          .dash-container { padding: 20px 16px 48px; }
        }
      `}</style>
    </div>
  );
}
