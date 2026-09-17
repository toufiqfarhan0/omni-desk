"use client";

import { useState, useEffect } from "react";
import { Conversation, Business } from "@/lib/db";
import { toast } from "sonner";

interface CallHistoryProps {
  business: Business;
}

export function CallHistory({ business }: CallHistoryProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchConversations = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/owner/businesses/${business.id}/conversations`);
      if (!res.ok) {
        // fallback
        const fallbackRes = await fetch(`/api/owner/conversations?businessId=${business.id}`);
        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          setConversations(data.conversations || []);
          return;
        }
        throw new Error("Failed to load call history");
      }
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load call history");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [business.id]);

  const handleOpenTranscript = (conv: Conversation) => {
    setSelectedConv(conv);
    setModalOpen(true);
  };

  return (
    <div>
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
          background: "#ffffff",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
          <thead>
            <tr>
              <th style={{ background: "#fafafa", padding: "10px 14px", fontSize: "11.5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>Caller</th>
              <th style={{ background: "#fafafa", padding: "10px 14px", fontSize: "11.5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>Email</th>
              <th style={{ background: "#fafafa", padding: "10px 14px", fontSize: "11.5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>Started</th>
              <th style={{ background: "#fafafa", padding: "10px 14px", fontSize: "11.5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>Duration</th>
              <th style={{ background: "#fafafa", padding: "10px 14px", fontSize: "11.5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>Outcome</th>
              <th style={{ background: "#fafafa", padding: "10px 14px", fontSize: "11.5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>Transcript</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                  Loading call history...
                </td>
              </tr>
            ) : conversations.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                  No calls recorded yet. Speak with the agent in the Live Voice Tester to generate a call record!
                </td>
              </tr>
            ) : (
              conversations.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 600 }}>
                    {c.caller_name || "Demo Caller"}
                  </td>
                  <td style={{ padding: "12px 14px", color: "var(--text-muted)", fontSize: "12px" }}>
                    {c.caller_email || "caller@example.com"}
                  </td>
                  <td style={{ padding: "12px 14px", color: "var(--text-muted)", fontSize: "12px" }}>
                    {c.started_at ? new Date(c.started_at).toLocaleString() : "Recently"}
                  </td>
                  <td style={{ padding: "12px 14px", fontFamily: "var(--mono)", fontSize: "12px" }}>
                    {Math.floor((c.duration_seconds || 0) / 60)}m{" "}
                    {String((c.duration_seconds || 0) % 60).padStart(2, "0")}s
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        fontFamily: "var(--mono)",
                        padding: "2px 7px",
                        borderRadius: "4px",
                        background: c.status === "booked" ? "#dcfce7" : "#f4f4f5",
                        color: c.status === "booked" ? "#166534" : "var(--text)",
                        border: "1px solid var(--border)",
                        fontWeight: 600,
                      }}
                    >
                      {c.status || "completed"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <button
                      type="button"
                      onClick={() => handleOpenTranscript(c)}
                      style={{
                        background: "#000000",
                        color: "#ffffff",
                        border: "none",
                        padding: "4px 10px",
                        borderRadius: "4px",
                        fontSize: "11.5px",
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      View Transcript
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Transcript Modal Matching web/dashboard.html */}
      {modalOpen && selectedConv && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            zIndex: 100,
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              maxWidth: "640px",
              width: "100%",
              padding: "20px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", paddingBottom: "10px", borderBottom: "1px solid var(--border)" }}>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
                  Call Transcript &mdash; {selectedConv.caller_name || "Caller"}
                </h3>
                <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "2px" }}>
                  {selectedConv.caller_email} &middot; {selectedConv.started_at ? new Date(selectedConv.started_at).toLocaleString() : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ background: "transparent", border: "none", fontSize: "20px", color: "var(--text-muted)", cursor: "pointer" }}
              >
                &times;
              </button>
            </div>

            <div
              style={{
                maxHeight: "440px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                padding: "14px",
                background: "#fafafa",
                borderRadius: "8px",
                border: "1px solid var(--border)",
              }}
            >
              {Array.isArray(selectedConv.transcript) && selectedConv.transcript.length > 0 ? (
                selectedConv.transcript.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                      maxWidth: "85%",
                      alignSelf: item.who === "user" ? "flex-end" : "flex-start",
                    }}
                  >
                    <span style={{ fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase", color: item.who === "user" ? "#71717a" : "#000000" }}>
                      {item.who === "user" ? "Caller" : "OmniDesk Agent"}
                    </span>
                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: item.who === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                        background: item.who === "user" ? "#000000" : "#ffffff",
                        color: item.who === "user" ? "#ffffff" : "#09090b",
                        border: item.who === "user" ? "none" : "1px solid var(--border)",
                        fontSize: "13px",
                        lineHeight: 1.45,
                      }}
                    >
                      {item.text}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px", fontSize: "13px" }}>
                  No speech turns recorded for this session.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
