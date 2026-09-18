"use client";

import { useState, useEffect } from "react";
import { Business, Service } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Sparkles,
  Save,
  Plus,
  Trash2,
  Clock,
  Calendar,
  Volume2,
  Bot,
  Layers,
  ArrowRight,
} from "lucide-react";

interface AgentBuilderProps {
  business: Business;
  onUpdateBusiness: (updated: Business) => void;
}

const INDUSTRY_PRESETS: Record<
  string,
  {
    name: string;
    industry: string;
    tone: string;
    greeting: string;
    system_prompt: string;
    operating_days: string;
    open_hour: number;
    close_hour: number;
    services: Service[];
  }
> = {
  salon: {
    name: "OmniDesk Hair Salon & Studio",
    industry: "salon",
    tone: "warm and inviting",
    greeting:
      "Thanks for calling OmniDesk Hair Salon & Studio. Are you looking to book a haircut, styling, or coloring appointment?",
    system_prompt:
      "You are the autonomous voice receptionist for OmniDesk Hair Salon & Studio. You speak in a warm, welcoming tone. You answer questions about haircuts, styling, balayage, and coloring, check real calendar slots using your tools, and book appointments for clients.",
    operating_days: "mon-fri",
    open_hour: 9,
    close_hour: 17,
    services: [
      {
        key: "haircut",
        label: "Signature Haircut & Styling",
        minutes: 45,
        price: 85,
        description:
          "Custom consultation, precision shear or razor cut, wash, and luxury blowout.",
      },
      {
        key: "blowout",
        label: "Signature Blowout & Treatment",
        minutes: 45,
        price: 65,
        description:
          "Revitalizing scalp massage, clarifying shampoo, hydrating mask, and voluminous blowout styling.",
      },
      {
        key: "full_color",
        label: "Full Color & Gloss",
        minutes: 90,
        price: 185,
        description:
          "All-over single process coloring, custom formulation, nourishing gloss, and blowout.",
      },
      {
        key: "balayage",
        label: "Artisan Balayage & Highlights",
        minutes: 120,
        price: 280,
        description:
          "Hand-painted dimensional highlights, toner formulation, deep conditioning mask, and style.",
      },
    ],
  },
  realestate: {
    name: "OmniDesk Premier Realty Group",
    industry: "realestate",
    tone: "professional and refined",
    greeting:
      "Good day. Thank you for calling OmniDesk Premier Realty Group. Are you interested in scheduling a private property tour or a portfolio consultation?",
    system_prompt:
      "You are an executive leasing and acquisition voice agent for OmniDesk Premier Realty Group. You arrange high-touch private walkthroughs, penthouse viewings, and commercial lease consultations.",
    operating_days: "mon-sat",
    open_hour: 8,
    close_hour: 19,
    services: [
      {
        key: "property_tour",
        label: "Private Luxury Residence Tour",
        minutes: 45,
        price: 0,
        description:
          "Exclusive escorted walkthrough of featured luxury listings with our senior broker.",
      },
      {
        key: "buyer_consultation",
        label: "Acquisition Strategy Consultation",
        minutes: 60,
        price: 150,
        description:
          "In-depth portfolio review, market valuation analysis, and financing advisory session.",
      },
      {
        key: "commercial_walkthrough",
        label: "Commercial Space Walkthrough",
        minutes: 60,
        price: 0,
        description:
          "On-site technical inspection and zoning review for commercial tenants.",
      },
    ],
  },
  dental: {
    name: "OmniDesk Dental Wellness",
    industry: "dental",
    tone: "empathetic and reassuring",
    greeting:
      "Hello, welcome to OmniDesk Dental Wellness. Are you calling to book a routine hygiene exam or an urgent consultation?",
    system_prompt:
      "You are an empathetic front desk coordinator for OmniDesk Dental Wellness. You assist patients in booking preventative cleanings, whitening treatments, and urgent care appointments.",
    operating_days: "mon-fri",
    open_hour: 8,
    close_hour: 16,
    services: [
      {
        key: "hygiene_cleaning",
        label: "Comprehensive Hygiene Exam & Cleaning",
        minutes: 45,
        price: 120,
        description:
          "Ultrasonic plaque removal, enamel polish, periodontal charting, and digital imaging.",
      },
      {
        key: "whitening",
        label: "Clinical Laser Teeth Whitening",
        minutes: 60,
        price: 350,
        description:
          "In-office light-activated whitening system lifting stains up to 8 shades.",
      },
      {
        key: "urgent_consult",
        label: "Urgent Diagnostic Consultation",
        minutes: 30,
        price: 95,
        description:
          "Immediate triage evaluation for pain, tooth discomfort, or restorative repairs.",
      },
    ],
  },
};

export function AgentBuilder({
  business,
  onUpdateBusiness,
}: AgentBuilderProps) {
  const [formData, setFormData] = useState<Business>(business);
  const [services, setServices] = useState<Service[]>(business.services || []);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);

  useEffect(() => {
    setFormData(business);
    setServices(business.services || []);
  }, [business]);

  // New service state
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newMinutes, setNewMinutes] = useState(30);
  const [newPrice, setNewPrice] = useState(50);
  const [newDescription, setNewDescription] = useState("");

  const handleApplyPreset = (presetKey: string) => {
    const p = INDUSTRY_PRESETS[presetKey];
    if (!p) return;
    const updated = {
      ...formData,
      name: p.name,
      industry: p.industry,
      tone: p.tone,
      greeting: p.greeting,
      system_prompt: p.system_prompt,
      operating_days: p.operating_days,
      open_hour: p.open_hour,
      close_hour: p.close_hour,
    };
    setFormData(updated);
    setServices([...p.services]);
    toast.success(`Applied ${p.name} template`);
  };

  const handleSaveOnly = async () => {
    try {
      setIsSaving(true);
      const res = await fetch(`/api/owner/businesses/${formData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          services,
        }),
      });
      if (!res.ok) throw new Error("Failed to save changes");
      const data = await res.json();
      onUpdateBusiness(data.business);
      toast.success("Settings saved successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeployOnly = async () => {
    try {
      setIsDeploying(true);
      // 1. Save latest config first so AssemblyAI gets up-to-date prompts
      const saveRes = await fetch(`/api/owner/businesses/${formData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          services,
        }),
      });
      if (!saveRes.ok) throw new Error("Failed to save configuration");
      const saveData = await saveRes.json();
      onUpdateBusiness(saveData.business);

      // 2. Deploy to AssemblyAI
      const deployRes = await fetch(
        `/api/owner/businesses/${formData.id}/deploy`,
        {
          method: "POST",
        }
      );
      const deployData = await deployRes.json();
      if (!deployRes.ok || !deployData.ok) {
        throw new Error(deployData.error || "Deployment failed");
      }

      toast.success("Voice agent provisioned & active on AssemblyAI");
      if (deployData.agent_id) {
        setFormData((prev) => ({
          ...prev,
          assemblyai_agent_id: deployData.agent_id,
        }));
      }
    } catch (err: any) {
      toast.error(err.message || "Deployment error");
    } finally {
      setIsDeploying(false);
    }
  };

  const handleAddService = () => {
    if (!newLabel.trim()) {
      toast.error("Service title is required");
      return;
    }
    const key =
      newKey.trim().toLowerCase().replace(/\s+/g, "_") ||
      newLabel.trim().toLowerCase().replace(/\s+/g, "_");

    const newService: Service = {
      key,
      label: newLabel.trim(),
      minutes: Number(newMinutes) || 30,
      price: Number(newPrice) || 0,
      description: newDescription.trim(),
    };

    setServices([...services, newService]);
    setNewKey("");
    setNewLabel("");
    setNewDescription("");
    setNewPrice(50);
    setNewMinutes(30);
    toast.success(`Added ${newService.label}`);
  };

  const handleRemoveService = (index: number) => {
    const filtered = services.filter((_, i) => i !== index);
    setServices(filtered);
  };

  const cs = {
    card: { background: "#ffffff", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "24px", boxShadow: "0 1px 2px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column" as const } as React.CSSProperties,
    cardHead: { marginBottom: "20px", paddingBottom: "14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" } as React.CSSProperties,
    cardTitle: { fontSize: "15px", fontWeight: 600, letterSpacing: "-0.01em" } as React.CSSProperties,
    cardSubtitle: { fontSize: "12.5px", color: "var(--text-muted)", marginTop: "3px" } as React.CSSProperties,
    formGroup: { marginBottom: "18px" } as React.CSSProperties,
    label: { display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: "6px", color: "var(--text)" } as React.CSSProperties,
    hint: { fontSize: "11.5px", color: "var(--text-muted)", marginTop: "4px" } as React.CSSProperties,
    input: { width: "100%", fontFamily: "var(--font)", fontSize: "13.5px", padding: "9px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "#ffffff", color: "var(--text)", outline: "none", boxSizing: "border-box" as const },
    textarea: { width: "100%", fontFamily: "var(--font)", fontSize: "13.5px", padding: "9px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "#ffffff", color: "var(--text)", outline: "none", minHeight: "110px", resize: "vertical" as const, lineHeight: "1.45", boxSizing: "border-box" as const },
    select: { width: "100%", fontFamily: "var(--font)", fontSize: "13.5px", padding: "9px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "#ffffff", color: "var(--text)", outline: "none" } as React.CSSProperties,
    btnPrimary: { fontFamily: "var(--font)", fontSize: "13.5px", fontWeight: 600, padding: "10px 18px", borderRadius: "var(--radius)", background: "#000000", color: "#ffffff", border: "1px solid #000000", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px", transition: "all 0.15s ease" } as React.CSSProperties,
    btnSecondary: { fontFamily: "var(--font)", fontSize: "13.5px", fontWeight: 500, padding: "10px 18px", borderRadius: "var(--radius)", background: "#ffffff", color: "var(--text)", border: "1px solid var(--border)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px" } as React.CSSProperties,
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: "24px", alignItems: "stretch" }}>
        {/* Left Column: Config */}
        <div style={cs.card}>
          <div style={cs.cardHead}>
            <div>
              <div style={cs.cardTitle}>Agent Workflow &amp; Persona</div>
              <div style={cs.cardSubtitle}>Configure how your voice receptionist speaks, responds, and enforces booking rules.</div>
            </div>
          </div>

          {/* Industry Preset */}
          <div style={cs.formGroup}>
            <label style={cs.label}>Industry Template (Select Preset or Type Your Business)</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Select onValueChange={(val) => { if (val) handleApplyPreset(val); }}>
                <SelectTrigger style={{ ...cs.select, height: "38px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <SelectValue placeholder="-- Select from popular presets --" />
                </SelectTrigger>
                <SelectContent style={{ background: "#ffffff", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)", zIndex: 9999 }}>
                  <SelectItem value="salon" style={{ fontSize: "13px", padding: "8px 12px", cursor: "pointer" }}>Hair Salon &amp; Studio (Haircuts, Coloring, Balayage, Blowouts)</SelectItem>
                  <SelectItem value="realestate" style={{ fontSize: "13px", padding: "8px 12px", cursor: "pointer" }}>Real Estate Agency (Property Tour, Appraisal, Consultation)</SelectItem>
                  <SelectItem value="dental" style={{ fontSize: "13px", padding: "8px 12px", cursor: "pointer" }}>Dental Clinic (Cleanings, Checkups, Root Canals, Whitening)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p style={cs.hint}>Choose a popular template or type your specific business to automatically generate prompts.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={cs.formGroup}>
              <label style={cs.label} htmlFor="biz-name-input">Business Name</label>
              <input style={cs.input} id="biz-name-input" type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div style={cs.formGroup}>
              <label style={cs.label} htmlFor="voice-model-select">Voice Model</label>
              <Select value={formData.voice_id || "alba"} onValueChange={(val) => setFormData({ ...formData, voice_id: val })}>
                <SelectTrigger id="voice-model-select" style={{ ...cs.select, height: "38px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: "#ffffff", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)", zIndex: 9999 }}>
                  <SelectItem value="alba" style={{ fontSize: "13px", padding: "8px 12px", cursor: "pointer" }}>Alba — Warm, Natural Female (US)</SelectItem>
                  <SelectItem value="marian" style={{ fontSize: "13px", padding: "8px 12px", cursor: "pointer" }}>Marian — Friendly, Expressive (US)</SelectItem>
                  <SelectItem value="callum" style={{ fontSize: "13px", padding: "8px 12px", cursor: "pointer" }}>Callum — Clear, Authoritative (US)</SelectItem>
                  <SelectItem value="charlotte" style={{ fontSize: "13px", padding: "8px 12px", cursor: "pointer" }}>Charlotte — Refined, Professional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* AssemblyAI Agent ID Config */}
          <div style={cs.formGroup}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <label style={{ ...cs.label, marginBottom: 0 }} htmlFor="agent-id-input">
                AssemblyAI Voice Agent ID
              </label>
              {formData.assemblyai_agent_id ? (
                <span style={{ fontSize: "11px", fontFamily: "var(--mono)", color: "#16a34a", fontWeight: 600 }}>
                  Active Agent Configured
                </span>
              ) : (
                <span style={{ fontSize: "11px", fontFamily: "var(--mono)", color: "var(--text-muted)" }}>
                  Using Environment Default
                </span>
              )}
            </div>
            <input
              style={cs.input}
              id="agent-id-input"
              type="text"
              placeholder="e.g. agent_6e8ae0f... (leave empty to use default from env)"
              value={formData.assemblyai_agent_id || ""}
              onChange={(e) => setFormData({ ...formData, assemblyai_agent_id: e.target.value })}
            />
            <p style={cs.hint}>
              Specify your own AssemblyAI Agent ID, or click <strong>Deploy to AssemblyAI</strong> above to auto-create one.
            </p>
          </div>

          <div style={cs.formGroup}>
            <label style={cs.label} htmlFor="slot-duration-select">Slot Interval</label>
            <Select value={String(formData.slot_minutes || 30)} onValueChange={(val) => setFormData({ ...formData, slot_minutes: Number(val) })}>
              <SelectTrigger id="slot-duration-select" style={{ ...cs.select, height: "38px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent style={{ background: "#ffffff", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)", zIndex: 9999 }}>
                <SelectItem value="15" style={{ fontSize: "13px", padding: "8px 12px", cursor: "pointer" }}>15 Minutes</SelectItem>
                <SelectItem value="30" style={{ fontSize: "13px", padding: "8px 12px", cursor: "pointer" }}>30 Minutes</SelectItem>
                <SelectItem value="45" style={{ fontSize: "13px", padding: "8px 12px", cursor: "pointer" }}>45 Minutes</SelectItem>
                <SelectItem value="60" style={{ fontSize: "13px", padding: "8px 12px", cursor: "pointer" }}>60 Minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div style={cs.formGroup}>
            <label style={cs.label} htmlFor="greeting-input">Spoken Initial Greeting</label>
            <input style={cs.input} id="greeting-input" type="text" value={formData.greeting} onChange={(e) => setFormData({ ...formData, greeting: e.target.value })} />
            <p style={cs.hint}>The first sentence the AI receptionist speaks when the caller connects.</p>
          </div>

          <div style={cs.formGroup}>
            <label style={cs.label} htmlFor="system-prompt-input">System Prompt &amp; Instructions</label>
            <textarea style={cs.textarea} id="system-prompt-input" rows={6} value={formData.system_prompt} onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })} />
            <p style={cs.hint}>Define business policies, rules, and conversational guidelines for the agent.</p>
          </div>

          {/* Operating Hours */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px", marginBottom: "18px" }}>
            <div style={{ fontSize: "12.5px", fontWeight: 600, marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Operating Schedule &amp; Slots
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ ...cs.label, fontSize: "11px" }}>Operating Days</label>
                <Select value={formData.operating_days || "mon-fri"} onValueChange={(val) => setFormData({ ...formData, operating_days: val })}>
                  <SelectTrigger style={{ ...cs.select, height: "34px", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#ffffff", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)", zIndex: 9999 }}>
                    <SelectItem value="mon-fri" style={{ fontSize: "12px", padding: "6px 10px", cursor: "pointer" }}>Mon - Fri (5 Days)</SelectItem>
                    <SelectItem value="mon-sat" style={{ fontSize: "12px", padding: "6px 10px", cursor: "pointer" }}>Mon - Sat (6 Days)</SelectItem>
                    <SelectItem value="tue-sat" style={{ fontSize: "12px", padding: "6px 10px", cursor: "pointer" }}>Tue - Sat (5 Days)</SelectItem>
                    <SelectItem value="all-week" style={{ fontSize: "12px", padding: "6px 10px", cursor: "pointer" }}>Mon - Sun (7 Days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label style={{ ...cs.label, fontSize: "11px" }}>Hours (Open to Close)</label>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input type="number" min={0} max={23} value={formData.open_hour} onChange={(e) => setFormData({ ...formData, open_hour: Number(e.target.value) })} style={{ ...cs.input, width: "60px", textAlign: "center", padding: "6px 8px", fontSize: "12px" }} />
                  <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>to</span>
                  <input type="number" min={1} max={24} value={formData.close_hour} onChange={(e) => setFormData({ ...formData, close_hour: Number(e.target.value) })} style={{ ...cs.input, width: "60px", textAlign: "center", padding: "6px 8px", fontSize: "12px" }} />
                </div>
              </div>
              <div>
                <label style={{ ...cs.label, fontSize: "11px" }}>Slot Interval</label>
                <Select value={String(formData.slot_minutes || 30)} onValueChange={(val) => setFormData({ ...formData, slot_minutes: Number(val) })}>
                  <SelectTrigger style={{ ...cs.select, height: "34px", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#ffffff", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)", zIndex: 9999 }}>
                    <SelectItem value="15" style={{ fontSize: "12px", padding: "6px 10px", cursor: "pointer" }}>15 min</SelectItem>
                    <SelectItem value="30" style={{ fontSize: "12px", padding: "6px 10px", cursor: "pointer" }}>30 min</SelectItem>
                    <SelectItem value="45" style={{ fontSize: "12px", padding: "6px 10px", cursor: "pointer" }}>45 min</SelectItem>
                    <SelectItem value="60" style={{ fontSize: "12px", padding: "6px 10px", cursor: "pointer" }}>60 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "12px", marginTop: "auto", paddingTop: "20px" }}>
            <button type="button" onClick={handleSaveOnly} disabled={isSaving || isDeploying} style={{ ...cs.btnSecondary, flex: 1, justifyContent: "center", opacity: isSaving ? 0.6 : 1 }}>
              {isSaving ? "Saving Settings..." : "Save Settings"}
            </button>
            <button type="button" onClick={handleDeployOnly} disabled={isSaving || isDeploying} style={{ ...cs.btnPrimary, flex: 1, justifyContent: "center", opacity: isDeploying ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
                <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
                <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
                <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
              </svg>
              {isDeploying ? "Deploying Agent..." : "Deploy Agent"}
            </button>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Agent Persona Card */}
          <div style={{ background: "#ffffff", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "20px", boxShadow: "var(--shadow-sm)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #000000, #71717a, #000000)" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{ position: "relative", width: "48px", height: "48px", borderRadius: "50%", background: "#000000", color: "#ffffff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: "18px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", flexShrink: 0 }}>
                  {(formData.voice_id || "A")[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "-0.01em", marginBottom: "3px" }}>
                    {formData.voice_id ? formData.voice_id.charAt(0).toUpperCase() + formData.voice_id.slice(1) : "Alba"} — Voice Receptionist
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "4px", background: "#000000", border: "1px solid #000000", color: "#ffffff", fontWeight: 600 }}>AssemblyAI Voice API</span>
                    <span style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "4px", background: "#f4f4f5", border: "1px solid var(--border)", color: "var(--text-muted)", fontWeight: 500 }}>24kHz Audio</span>
                    <span style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "4px", background: "#f4f4f5", border: "1px solid var(--border)", color: "var(--text-muted)", fontWeight: 500 }}>&lt; 300ms</span>
                  </div>
                </div>
              </div>
            </div>
            {/* Greeting preview bubble */}
            <div style={{ background: "#f4f4f5", border: "1px solid var(--border)", borderRadius: "12px 12px 12px 2px", padding: "12px 14px", fontSize: "13px", lineHeight: 1.5, color: "var(--text)", margin: "12px 0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.04em", color: "var(--text-muted)" }}>First Spoken Greeting Preview</span>
                <span style={{ fontSize: "11px", fontFamily: "var(--mono)", color: "var(--text-muted)" }}>Plays on Call Connect</span>
              </div>
              <div style={{ fontSize: "13px", fontStyle: "italic" as const, color: "#18181b" }}>
                &quot;{formData.greeting || "No greeting set."}&quot;
              </div>
            </div>

            {/* Active Agent ID Pill & Copy */}
            <div style={{ background: "#fafafa", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "9px 12px", margin: "10px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.04em" }}>
                  Active AssemblyAI Agent ID
                </div>
                <div style={{ fontSize: "11.5px", fontFamily: "var(--mono)", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "2px" }}>
                  {formData.assemblyai_agent_id || "Active on AssemblyAI (Environment Default)"}
                </div>
              </div>
              {formData.assemblyai_agent_id && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(formData.assemblyai_agent_id || "");
                    toast.success("Copied Agent ID");
                  }}
                  style={{ fontSize: "11px", fontWeight: 600, padding: "4px 8px", borderRadius: "4px", border: "1px solid var(--border)", background: "#ffffff", color: "var(--text)", cursor: "pointer", flexShrink: 0 }}
                >
                  Copy
                </button>
              )}
            </div>

            {/* Connected tools */}
            <div style={{ fontSize: "11.5px", fontWeight: 600, textTransform: "uppercase" as const, color: "var(--text-muted)", marginTop: "12px", marginBottom: "8px" }}>Connected Server-Side Tools</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {["check_availability", "create_booking", "get_today", "validate_email"].map(tool => (
                <div key={tool} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", fontFamily: "var(--mono)", background: "#fafafa", border: "1px solid var(--border)", padding: "6px 10px", borderRadius: "6px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a", boxShadow: "0 0 4px rgba(22,163,74,0.4)", flexShrink: 0 }} />
                  {tool}
                </div>
              ))}
            </div>
          </div>

          {/* Services Catalog */}
          <div style={cs.card}>
            <div style={cs.cardHead}>
              <div>
                <div style={cs.cardTitle}>Services &amp; Pricing Catalog</div>
                <div style={cs.cardSubtitle}>The agent cites these exact prices and durations during calls.</div>
              </div>
              <span style={{ fontSize: "11px", fontFamily: "var(--mono)", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "#f4f4f5", border: "1px solid var(--border)", color: "var(--text)" }}>{services.length} active</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "14px" }}>
              {services.map((s, idx) => (
                <div key={s.key + idx} style={{ background: "#fafafa", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 12px", display: "grid", gridTemplateColumns: "1fr auto", gap: "8px", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>{s.label}</div>
                    <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontFamily: "var(--mono)" }}>${s.price} &bull; {s.minutes}min</div>
                    {s.description && <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "2px" }}>{s.description}</div>}
                  </div>
                  <button onClick={() => handleRemoveService(idx)} style={{ background: "none", border: "1px solid transparent", borderRadius: "4px", cursor: "pointer", height: "28px", width: "28px", display: "grid", placeItems: "center", color: "var(--text-muted)" }} title="Remove service">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6m5 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Add service form */}
            <div style={{ background: "#f9f9f9", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px" }}>
              <div style={{ fontSize: "12.5px", fontWeight: 700, marginBottom: "12px", color: "var(--text)" }}>Add Catalog Service</div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "4px" }}>
                    Service Name
                  </label>
                  <input
                    placeholder="e.g. Signature Haircut"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    style={{ ...cs.input, fontSize: "12.5px", padding: "7px 10px", width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "4px" }}>
                    Service Key
                  </label>
                  <input
                    placeholder="e.g. haircut"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    style={{ ...cs.input, fontSize: "12.5px", padding: "7px 10px", width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "4px" }}>
                    Price ($ USD)
                  </label>
                  <input
                    type="number"
                    placeholder="50"
                    value={newPrice || ""}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    style={{ ...cs.input, fontSize: "12.5px", padding: "7px 10px", width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "4px" }}>
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    placeholder="30"
                    value={newMinutes || ""}
                    onChange={(e) => setNewMinutes(Number(e.target.value))}
                    style={{ ...cs.input, fontSize: "12.5px", padding: "7px 10px", width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "4px" }}>
                  Description / Service Details
                </label>
                <input
                  placeholder="e.g. Precision wash, custom shear cut, and luxury blowout"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  style={{ ...cs.input, fontSize: "12.5px", padding: "7px 10px", width: "100%" }}
                />
              </div>

              <button onClick={handleAddService} style={{ ...cs.btnSecondary, width: "100%", justifyContent: "center", fontSize: "12.5px", padding: "8px 12px", border: "1px dashed var(--border-dark)" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Item to Catalog
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
