"use client";

import Link from "next/link";
import { Business } from "@/lib/db";
import { BrandLogo } from "@/components/brand-logo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DashboardSidebarProps {
  businesses: Business[];
  selectedBusiness: Business | null;
  onSelectBusiness: (biz: Business) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpen: boolean;
  onNewBusiness?: () => void;
}

export function DashboardSidebar({
  businesses,
  selectedBusiness,
  onSelectBusiness,
  activeTab,
  onTabChange,
  isOpen,
  onNewBusiness,
}: DashboardSidebarProps) {
  return (
    <aside className={`sidebar${isOpen ? " is-open" : ""}`} id="dashboard-sidebar">
      <div className="sidebar-inner">
        {/* 1. Header with Logo */}
        <div className="sidebar-brand-header">
          <Link href="/" className="sidebar-brand-link">
            <div className="logo-mark">
              <BrandLogo size={30} />
            </div>
            <div className="brand-title-wrap">
              <span className="brand-title">OmniDesk</span>
              <span className="brand-subtitle">Voice Agent Platform</span>
            </div>
          </Link>
        </div>

        {/* 2. Business Selector */}
        <div className="sidebar-biz-card">
          <div className="sidebar-section-heading">
            <span>Active Business</span>
          </div>
          <div className="biz-selector-wrap">
            {businesses.length > 0 ? (
              <Select
                value={selectedBusiness?.id ?? ""}
                onValueChange={(val) => {
                  const biz = businesses.find((b) => b.id === val);
                  if (biz) onSelectBusiness(biz);
                }}
              >
                <SelectTrigger
                  style={{
                    width: "100%",
                    height: "38px",
                    background: "#ffffff",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    padding: "0 10px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--text)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                    overflow: "hidden",
                    minWidth: 0,
                  }}
                >
                  <SelectValue placeholder="Select business..." />
                </SelectTrigger>
                <SelectContent
                  style={{
                    width: "var(--radix-select-trigger-width)",
                    maxWidth: "var(--radix-select-trigger-width)",
                    background: "#ffffff",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.12), 0 8px 10px -6px rgba(0,0,0,0.08)",
                    zIndex: 9999,
                    maxHeight: "280px",
                    overflowX: "hidden",
                  }}
                >
                  {businesses.map((b) => (
                    <SelectItem
                      key={b.id}
                      value={b.id}
                      style={{
                        fontSize: "13px",
                        fontWeight: 500,
                        padding: "8px 12px",
                        cursor: "pointer",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={b.name}
                    >
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>No businesses found</div>
            )}
            {onNewBusiness && (
              <button
                type="button"
                className="btn-new-biz"
                onClick={onNewBusiness}
                style={{
                  width: "100%",
                  justifyContent: "center",
                  padding: "7px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "var(--radius)",
                  background: "#ffffff",
                  border: "1px dashed var(--border-dark)",
                  color: "var(--text)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                  fontFamily: "var(--font)",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                <span>+ New Business</span>
              </button>
            )}
          </div>
        </div>

        {/* 3. Navigation */}
        <div className="sidebar-nav-group">
          <div className="sidebar-section-heading">
            <span>Navigation</span>
          </div>
          <nav className="sidebar-nav-list">
            <button
              className={`tab-item${activeTab === "builder" ? " active" : ""}`}
              onClick={() => onTabChange("builder")}
            >
              <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <span className="nav-text">AI Agent Builder</span>
            </button>

            <button
              className={`tab-item${activeTab === "simulator" ? " active" : ""}`}
              onClick={() => onTabChange("simulator")}
            >
              <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
              </svg>
              <span className="nav-text">Live Voice Tester</span>
            </button>

            <button
              className={`tab-item${activeTab === "bookings" ? " active" : ""}`}
              onClick={() => onTabChange("bookings")}
            >
              <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span className="nav-text">Customer Bookings</span>
            </button>

            <button
              className={`tab-item${activeTab === "conversations" ? " active" : ""}`}
              onClick={() => onTabChange("conversations")}
            >
              <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              <span className="nav-text">Call History</span>
            </button>
          </nav>

          <div className="sidebar-section-heading" style={{ marginTop: "24px" }}>
            <span>Quick Access</span>
          </div>
          <nav className="sidebar-nav-list">
            <a href="/demo" className="sidebar-sublink" target="_blank" rel="noreferrer">
              <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              <span>Try Demos</span>
            </a>
          </nav>
        </div>

        {/* 4. Sidebar Footer / Owner Profile */}
        <div className="sidebar-footer">
          <div className="owner-profile-card">
            <div className="owner-avatar">D</div>
            <div className="owner-profile-info">
              <div className="owner-profile-badge-row">
                <span className="dot" style={{ background: "#16a34a" }} />
                <span style={{ fontSize: "10px", fontWeight: 700, background: "#000000", color: "#ffffff", padding: "1px 5px", borderRadius: "3px", letterSpacing: "0.04em" }}>DEMO</span>
              </div>
              <span className="owner-email-text">demo@omnidesk.ai</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .sidebar {
          width: 270px;
          flex-shrink: 0;
          background: #ffffff;
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          height: 100vh;
          z-index: 40;
          transition: transform 0.25s cubic-bezier(0.16,1,0.3,1);
        }
        .sidebar-inner {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
        }
        .sidebar-brand-header {
          height: 64px;
          box-sizing: border-box;
          padding: 0 20px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }
        .sidebar-brand-link {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          color: var(--text);
        }
        .logo-mark {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }
        .brand-title-wrap { display: flex; flex-direction: column; }
        .brand-title { font-size: 15.5px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; }
        .brand-subtitle { font-size: 11px; font-weight: 500; color: var(--text-muted); letter-spacing: 0.01em; }
        .sidebar-biz-card {
          padding: 16px 18px;
          border-bottom: 1px solid var(--border);
          background: #ffffff;
        }
        .sidebar-section-heading {
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-sub);
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .biz-selector-wrap { display: flex; flex-direction: column; gap: 8px; width: 100%; }
        .biz-select {
          font-family: var(--font);
          font-size: 13px;
          font-weight: 600;
          padding: 8px 12px;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          background: #ffffff;
          color: var(--text);
          cursor: pointer;
          outline: none;
          width: 100%;
        }
        .sidebar-nav-group { padding: 16px 14px; flex: 1; }
        .sidebar-nav-group .sidebar-section-heading { padding: 0 8px; margin-bottom: 6px; }
        .sidebar-nav-list { display: flex; flex-direction: column; gap: 4px; list-style: none; padding: 0; margin: 0; }
        .tab-item {
          width: 100%;
          padding: 9px 12px;
          font-size: 13.5px;
          font-weight: 500;
          color: #52525b;
          text-decoration: none;
          cursor: pointer;
          border: 1px solid transparent;
          border-radius: var(--radius);
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 10px;
          background: transparent;
          transition: all 0.15s ease;
          text-align: left;
          font-family: var(--font);
        }
        .tab-item:hover { color: var(--text); background: #f4f4f5; }
        .tab-item.active { color: #ffffff; font-weight: 600; background: #09090b; box-shadow: 0 1px 3px rgba(0,0,0,0.12); }
        .nav-icon { width: 17px; height: 17px; flex-shrink: 0; stroke: currentColor; }
        .nav-text { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sidebar-sublink {
          width: 100%;
          padding: 8px 12px;
          font-size: 12.5px;
          font-weight: 500;
          color: var(--text-muted);
          text-decoration: none;
          border-radius: var(--radius);
          display: flex;
          align-items: center;
          gap: 10px;
          transition: all 0.15s ease;
        }
        .sidebar-sublink:hover { color: var(--text); background: #f4f4f5; }
        .sidebar-sublink .nav-icon { width: 16px; height: 16px; }
        .sidebar-footer {
          padding: 14px 16px;
          border-top: 1px solid var(--border);
          background: #fafafa;
          margin-top: auto;
        }
        .owner-profile-card { display: flex; align-items: center; gap: 10px; }
        .owner-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: #09090b;
          color: #ffffff;
          display: grid;
          place-items: center;
          font-weight: 700;
          font-size: 13px;
          flex-shrink: 0;
        }
        .owner-profile-info { display: flex; flex-direction: column; overflow: hidden; flex: 1; }
        .owner-profile-badge-row { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
        .dot { width: 7px; height: 7px; border-radius: 50%; }
        .owner-email-text { font-size: 12px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        @media (max-width: 960px) {
          .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            bottom: 0;
            transform: translateX(-100%);
            box-shadow: 0 0 24px rgba(0,0,0,0.15);
          }
          .sidebar.is-open { transform: translateX(0); }
        }
      `}</style>
    </aside>
  );
}
