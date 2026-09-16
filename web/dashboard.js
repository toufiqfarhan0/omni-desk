/**
 * OmniDesk SaaS Owner Dashboard & Voice Agent Builder
 * Multi-tenant business workflows, live voice agent testing,
 * call history logging, and customer bookings CRM.
 */

const PRESETS = {
  dental: {
    name: "OmniDesk Dental Clinic",
    tone: "warm",
    greeting: "Thanks for calling OmniDesk Dental Clinic. Are you looking to book an appointment?",
    system_prompt: "You are an autonomous receptionist for OmniDesk Dental Clinic. You speak naturally, answer questions about dental procedures, check real calendar slots using your tools, and book appointments for callers.",
    voice_id: "131a436c-0fc4-4797-90f7-d0e515d18b06",
    slot_minutes: 30,
    open_hour: 9,
    close_hour: 17,
    keyterms: ["OmniDesk", "cleaning", "checkup", "whitening", "root canal", "fluoride", "cavity"],
    services: [
      { key: "checkup", label: "Routine Checkup", minutes: 30, price: 85, description: "Comprehensive dental examination, gum health check and preventive evaluation." },
      { key: "cleaning", label: "Dental Cleaning", minutes: 30, price: 120, description: "Full dental hygiene cleaning, ultrasonic plaque removal and enamel polish." },
      { key: "whitening", label: "Teeth Whitening", minutes: 60, price: 250, description: "Professional clinical teeth whitening for stain removal and enamel brightening." },
      { key: "root-canal", label: "Root Canal", minutes: 90, price: 650, description: "Specialized endodontic therapy, pulp restoration and tooth preservation." }
    ]
  },
  medspa: {
    name: "Lumina MedSpa & Aesthetics",
    tone: "reassuring",
    greeting: "Thank you for calling Lumina MedSpa. How may I assist you with your aesthetic treatment today?",
    system_prompt: "You are an autonomous receptionist for Lumina MedSpa. You provide consultations on aesthetic skin treatments, check availability, and schedule appointments with certified clinicians.",
    voice_id: "b7d50908-b17c-442d-ad8d-810c63997ed9",
    slot_minutes: 30,
    open_hour: 10,
    close_hour: 18,
    keyterms: ["Lumina", "botox", "hydrafacial", "microneedling", "laser", "dermal filler"],
    services: [
      { key: "hydrafacial", label: "HydraFacial Deluxe", minutes: 45, price: 195, description: "Deep cleanse, exfoliation, painless extractions, and antioxidant infusion." },
      { key: "botox", label: "Botox Consultation & Treatment", minutes: 30, price: 280, description: "Precision wrinkle relaxation treatment by licensed physician." },
      { key: "microneedling", label: "Collagen Microneedling", minutes: 60, price: 350, description: "Advanced collagen induction therapy for scar reduction and texture smoothing." },
      { key: "laser", label: "Laser Skin Resurfacing", minutes: 60, price: 420, description: "Fractional non-ablative laser treatment for pigment and skin renewal." }
    ]
  },
  legal: {
    name: "Vanguard Legal Advisory",
    tone: "professional",
    greeting: "Thank you for contacting Vanguard Legal Advisory. Are you seeking to schedule an attorney consultation?",
    system_prompt: "You are a professional legal intake receptionist for Vanguard Legal Advisory. You qualify client inquiries, check attorney consultation availability, and book confidential consultation sessions.",
    voice_id: "098b63e0-3273-47a2-9694-de982d618991",
    slot_minutes: 30,
    open_hour: 9,
    close_hour: 17,
    keyterms: ["Vanguard", "litigation", "retainer", "attorney", "corporate", "estate planning"],
    services: [
      { key: "initial-consult", label: "Initial Attorney Consultation", minutes: 30, price: 150, description: "Confidential case evaluation and legal options assessment." },
      { key: "contract-review", label: "Commercial Contract Review", minutes: 60, price: 350, description: "Detailed clause-by-clause legal risk assessment and advisory." },
      { key: "estate-planning", label: "Estate & Will Planning", minutes: 60, price: 450, description: "Comprehensive estate distribution, trust drafting, and power of attorney." }
    ]
  },
  salon: {
    name: "Aura Hair Studio & Barber",
    tone: "warm",
    greeting: "Welcome to Aura Studio! Are you looking to book a haircut or styling session today?",
    system_prompt: "You are a welcoming receptionist for Aura Hair Studio. You assist clients in selecting services, checking open stylist chairs, and scheduling appointments.",
    voice_id: "131a436c-0fc4-4797-90f7-d0e515d18b06",
    slot_minutes: 30,
    open_hour: 9,
    close_hour: 19,
    keyterms: ["Aura", "balayage", "fade", "haircut", "blowout", "keratin"],
    services: [
      { key: "haircut", label: "Signature Haircut & Style", minutes: 45, price: 65, description: "Consultation, precision wash, cut, and blow-dry styling." },
      { key: "balayage", label: "Custom Balayage & Tone", minutes: 90, price: 220, description: "Hand-painted dimensional highlights with gloss glaze treatment." },
      { key: "beard-groom", label: "Deluxe Barber Beard Grooming", minutes: 30, price: 40, description: "Hot towel prep, straight-razor detailing, and conditioning balm." }
    ]
  },
  auto: {
    name: "Precision Auto Care",
    tone: "efficient",
    greeting: "Thanks for calling Precision Auto Care. What service can we get your vehicle scheduled for?",
    system_prompt: "You are an efficient service advisor for Precision Auto Care. You schedule preventative maintenance, diagnostic evaluations, and mechanical repairs.",
    voice_id: "098b63e0-3273-47a2-9694-de982d618991",
    slot_minutes: 30,
    open_hour: 8,
    close_hour: 18,
    keyterms: ["Precision Auto", "synthetic oil", "brake pads", "transmission", "alignment"],
    services: [
      { key: "oil-change", label: "Full Synthetic Oil Service", minutes: 30, price: 79, description: "OEM filter replacement, synthetic motor oil, and 21-point safety inspection." },
      { key: "brakes", label: "Brake Pad & Rotor Inspection", minutes: 45, price: 160, description: "Brake pad replacement, rotor measurement, and hydraulic fluid check." },
      { key: "diagnostic", label: "OBD-II Computer Diagnostic", minutes: 45, price: 110, description: "Full engine sensor interrogation and detailed diagnostic report." }
    ]
  },
  realestate: {
    name: "Sterling Real Estate Partners",
    tone: "professional",
    greeting: "Thank you for calling Sterling Real Estate Partners. How can we assist you with your property search or listing today?",
    system_prompt: "You are an autonomous scheduling coordinator for Sterling Real Estate Partners. You book private property viewings, appraisal consultations, and buyer advisory meetings.",
    voice_id: "79a125e8-cd45-4c13-8a67-188112f4dd22",
    slot_minutes: 45,
    open_hour: 9,
    close_hour: 18,
    keyterms: ["Sterling", "viewing", "appraisal", "escrow", "mortgage", "listing"],
    services: [
      { key: "property-tour", label: "Private Property Tour", minutes: 45, price: 0, description: "Exclusive private guided walkthrough of active residential listing." },
      { key: "home-valuation", label: "Home Valuation & Market Appraisal", minutes: 60, price: 0, description: "In-depth comparative market analysis and listing pricing consultation." },
      { key: "buyer-advisory", label: "Buyer Advisory Strategy Session", minutes: 45, price: 0, description: "Financing review, neighborhood analysis, and pre-approval consultation." }
    ]
  }
};

function detectIndustryFromText(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("law") || t.includes("legal") || t.includes("attorney") || t.includes("counsel") || t.includes("advocat")) return "legal";
  if (t.includes("dent") || t.includes("tooth") || t.includes("teeth") || t.includes("smile") || t.includes("ortho")) return "dental";
  if (t.includes("medspa") || t.includes("aesthet") || t.includes("botox") || t.includes("facial") || t.includes("dermat") || t.includes("skin") || t.includes("spa")) return "medspa";
  if (t.includes("salon") || t.includes("hair") || t.includes("barber") || t.includes("cut") || t.includes("styl")) return "salon";
  if (t.includes("auto") || t.includes("car") || t.includes("mechanic") || t.includes("tire") || t.includes("repair") || t.includes("garage") || t.includes("vehicle") || t.includes("brake")) return "auto";
  if (t.includes("real") || t.includes("estate") || t.includes("realt") || t.includes("proper") || t.includes("home") || t.includes("hous")) return "realestate";
  return null;
}

// ---------------------------------------------------------------------------
// App State
// ---------------------------------------------------------------------------

let state = {
  owner: null,
  businesses: [],
  activeBiz: null,
  activeTab: "tab-builder",
  keyterms: [],
  services: []
};

// Elements
const els = {
  bizSelect: document.getElementById("biz-select"),
  btnCreateBiz: document.getElementById("btn-create-biz"),
  ownerEmailText: document.getElementById("owner-email-text"),
  btnAuthSwitch: document.getElementById("btn-auth-switch"),
  btnDeployAgent: document.getElementById("btn-deploy-agent"),
  bannerAgentPill: document.getElementById("banner-agent-pill"),
  bannerAgentDesc: document.getElementById("banner-agent-desc"),

  // Tab buttons
  tabItems: document.querySelectorAll(".tab-item"),
  tabPanes: document.querySelectorAll(".tab-pane"),

  // Builder inputs
  presetIndustry: document.getElementById("preset-industry"),
  customIndustryInput: document.getElementById("custom-industry-input"),
  btnApplyCustomIndustry: document.getElementById("btn-apply-custom-industry"),
  bizNameInput: document.getElementById("biz-name-input"),
  voiceToneSelect: document.getElementById("voice-tone-select"),
  voiceModelSelect: document.getElementById("voice-model-select"),
  slotDurationSelect: document.getElementById("slot-duration-select"),
  greetingInput: document.getElementById("greeting-input"),
  systemPromptInput: document.getElementById("system-prompt-input"),
  keytermsChips: document.getElementById("keyterms-chips"),
  newKeytermInput: document.getElementById("new-keyterm-input"),
  btnAddKeyterm: document.getElementById("btn-add-keyterm"),
  servicesList: document.getElementById("services-list-container"),
  btnAddServiceRow: document.getElementById("btn-add-service-row"),
  openHourInput: document.getElementById("open-hour-input"),
  closeHourInput: document.getElementById("close-hour-input"),

  // Simulator
  simDot: document.getElementById("sim-dot"),
  simStatusLabel: document.getElementById("sim-status-label"),
  simTimer: document.getElementById("sim-timer"),
  simFeed: document.getElementById("sim-feed"),
  btnStartSim: document.getElementById("btn-start-sim"),
  simToolsFeed: document.getElementById("sim-tools-feed"),

  // Bookings & KPIs
  kpiTodayCount: document.getElementById("kpi-today-count"),
  kpiUpcomingCount: document.getElementById("kpi-upcoming-count"),
  kpiTotalCount: document.getElementById("kpi-total-count"),
  kpiTotalVal: document.getElementById("kpi-total-val"),
  bookingsTableBody: document.getElementById("bookings-table-body"),
  badgeBookingsCount: document.getElementById("badge-bookings-count"),

  // Conversations
  convTableBody: document.getElementById("conv-table-body"),
  badgeConvCount: document.getElementById("badge-conv-count"),

  // Modals
  authModal: document.getElementById("auth-modal"),
  authForm: document.getElementById("auth-form"),
  authEmailInput: document.getElementById("auth-email-input"),
  authNameInput: document.getElementById("auth-name-input"),
  btnCloseAuth: document.getElementById("btn-close-auth"),

  newBizModal: document.getElementById("new-biz-modal"),
  newBizForm: document.getElementById("new-biz-form"),
  modalBizName: document.getElementById("modal-biz-name"),
  modalBizIndustry: document.getElementById("modal-biz-industry"),
  modalBizCustomIndustry: document.getElementById("modal-biz-custom-industry"),
  btnCloseNewBiz: document.getElementById("btn-close-new-biz"),

  transcriptModal: document.getElementById("transcript-modal"),
  transcriptModalTitle: document.getElementById("transcript-modal-title"),
  transcriptModalBody: document.getElementById("transcript-modal-body"),
  btnCloseTranscript: document.getElementById("btn-close-transcript"),
};

// ---------------------------------------------------------------------------
// Initialization & Auth
// ---------------------------------------------------------------------------

async function init() {
  bindTabs();
  bindModals();
  bindBuilderEvents();
  bindSimulatorEvents();

  const stored = localStorage.getItem("omnidesk_owner");
  if (stored) {
    try {
      state.owner = JSON.parse(stored);
    } catch (_) {}
  }

  const ownerEmail = state.owner ? state.owner.email : "demo@omnidesk.ai";
  await loadOwnerSession(ownerEmail);
}

async function loadOwnerSession(email) {
  try {
    const res = await fetch(`/api/auth/session?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    if (data.ok && data.owner) {
      state.owner = data.owner;
      state.businesses = data.businesses || [];
      localStorage.setItem("omnidesk_owner", JSON.stringify(state.owner));
      els.ownerEmailText.textContent = state.owner.email;

      renderBusinessSelect();

      if (state.businesses.length > 0) {
        selectBusiness(state.businesses[0].id);
      }
    }
  } catch (err) {
    console.error("Failed to load session:", err);
  }
}

function renderBusinessSelect() {
  els.bizSelect.innerHTML = "";
  for (const b of state.businesses) {
    const opt = document.createElement("option");
    opt.value = b.id;
    opt.textContent = b.name;
    els.bizSelect.appendChild(opt);
  }
}

async function selectBusiness(bizId) {
  // Refresh latest business state from API
  if (state.owner) {
    try {
      const res = await fetch(`/api/owner/businesses?owner_id=${state.owner.id}`);
      const data = await res.json();
      if (data.businesses) {
        state.businesses = data.businesses;
        renderBusinessSelect();
      }
    } catch (_) {}
  }

  const found = state.businesses.find((b) => b.id === bizId) || state.businesses[0];
  if (!found) return;
  state.activeBiz = found;
  els.bizSelect.value = found.id;

  populateBuilder(found);
  loadBookings();
  loadConversations();
}

// ---------------------------------------------------------------------------
// Builder Population & Dynamic Custom Industry Application
// ---------------------------------------------------------------------------

function populateBuilder(biz) {
  els.bizNameInput.value = biz.name || "";

  // Set dropdown preset if matched, else set custom industry input
  if (PRESETS[biz.industry]) {
    els.presetIndustry.value = biz.industry;
    if (els.customIndustryInput) els.customIndustryInput.value = "";
  } else {
    els.presetIndustry.value = "";
    if (els.customIndustryInput) els.customIndustryInput.value = biz.industry || "";
  }

  els.voiceToneSelect.value = biz.tone || "professional";
  els.voiceModelSelect.value = biz.voice_id || "131a436c-0fc4-4797-90f7-d0e515d18b06";
  els.slotDurationSelect.value = String(biz.slot_minutes || 30);
  els.greetingInput.value = biz.greeting || "";
  els.systemPromptInput.value = biz.system_prompt || "";
  els.openHourInput.value = String(biz.open_hour || 9);
  els.closeHourInput.value = String(biz.close_hour || 17);

  // Keyterms
  state.keyterms = Array.isArray(biz.keyterms) ? [...biz.keyterms] : [];
  renderKeytermChips();

  // Services
  state.services = Array.isArray(biz.services) ? JSON.parse(JSON.stringify(biz.services)) : [];
  renderServicesList();

  // Status banner
  if (biz.assemblyai_agent_id) {
    els.bannerAgentPill.textContent = "AssemblyAI Provisioned";
    els.bannerAgentPill.style.background = "#000000";
    els.bannerAgentDesc.textContent = `Agent ${biz.assemblyai_agent_id} active with live HTTP tools.`;
  } else {
    els.bannerAgentPill.textContent = "Draft Workflow";
    els.bannerAgentPill.style.background = "#71717a";
    els.bannerAgentDesc.textContent = "Click 'Save & Deploy Voice Agent' to provision on AssemblyAI Voice Agent API.";
  }
}

function applyIndustryTemplate(industryKeyOrCustom, forcedBizName = null) {
  const currentBizName = forcedBizName || (els.bizNameInput.value.trim() || (state.activeBiz ? state.activeBiz.name : "My Business"));
  
  let p = PRESETS[industryKeyOrCustom];
  if (!p) {
    const detected = detectIndustryFromText(industryKeyOrCustom);
    if (detected && PRESETS[detected]) p = PRESETS[detected];
  }

  if (p) {
    const matchedKey = Object.keys(PRESETS).includes(industryKeyOrCustom) ? industryKeyOrCustom : (detectIndustryFromText(industryKeyOrCustom) || "");
    els.presetIndustry.value = matchedKey;
    if (els.customIndustryInput) els.customIndustryInput.value = "";
    els.bizNameInput.value = currentBizName;
    els.voiceToneSelect.value = p.tone;
    els.greetingInput.value = `Thanks for calling ${currentBizName}. Are you looking to book an appointment?`;
    els.systemPromptInput.value = `You are an autonomous receptionist for ${currentBizName}. You speak naturally, answer questions about our services, check real calendar slots using your tools, and book appointments for callers.`;
    els.voiceModelSelect.value = p.voice_id;
    els.slotDurationSelect.value = String(p.slot_minutes);
    els.openHourInput.value = String(p.open_hour);
    els.closeHourInput.value = String(p.close_hour);
    state.keyterms = [currentBizName, ...p.keyterms.filter(k => k !== p.name)];
    renderKeytermChips();
    state.services = JSON.parse(JSON.stringify(p.services));
    renderServicesList();
  } else {
    // Custom typed business type (e.g. Veterinary, Gym, Photography Studio, Accounting, etc.)
    const cleanType = industryKeyOrCustom.trim();
    els.presetIndustry.value = "";
    if (els.customIndustryInput) els.customIndustryInput.value = cleanType;
    els.bizNameInput.value = currentBizName;
    els.voiceToneSelect.value = "professional";
    els.greetingInput.value = `Thanks for calling ${currentBizName}. Are you looking to schedule an appointment or consultation?`;
    els.systemPromptInput.value = `You are an autonomous AI voice receptionist for ${currentBizName}, specializing in ${cleanType}. You speak in a natural, polite, and reassuring tone. You answer caller questions about ${cleanType} offerings, check real calendar slots using your tools, collect the caller's name and email address, and book appointments.`;
    els.voiceModelSelect.value = "131a436c-0fc4-4797-90f7-d0e515d18b06";
    els.slotDurationSelect.value = "30";
    els.openHourInput.value = "9";
    els.closeHourInput.value = "17";
    state.keyterms = [currentBizName, cleanType, "appointment", "booking", "consultation", "schedule"];
    renderKeytermChips();
    state.services = [
      { key: "consultation", label: "Initial Consultation", minutes: 30, price: 95, description: `Comprehensive ${cleanType} evaluation and assessment.` },
      { key: "standard-service", label: "Standard Service Appointment", minutes: 45, price: 150, description: `Full professional ${cleanType} appointment.` },
      { key: "follow-up", label: "Follow-Up & Review", minutes: 30, price: 65, description: `Progress review, adjustments, and follow-up consultation.` }
    ];
    renderServicesList();
  }
}

function renderKeytermChips() {
  els.keytermsChips.innerHTML = "";
  state.keyterms.forEach((term, idx) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `${escapeHtml(term)} <span class="chip-remove" data-idx="${idx}">&times;</span>`;
    els.keytermsChips.appendChild(chip);
  });

  els.keytermsChips.querySelectorAll(".chip-remove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const i = parseInt(e.target.dataset.idx, 10);
      state.keyterms.splice(i, 1);
      renderKeytermChips();
    });
  });
}

function renderServicesList() {
  els.servicesList.innerHTML = "";
  state.services.forEach((s, idx) => {
    const row = document.createElement("div");
    row.className = "service-row";
    row.innerHTML = `
      <input type="text" class="srv-label" value="${escapeHtml(s.label || "")}" placeholder="Service Title" data-idx="${idx}" />
      <input type="number" class="srv-mins" value="${s.minutes || 30}" placeholder="Mins" data-idx="${idx}" />
      <input type="number" class="srv-price" value="${s.price || 0}" placeholder="$" data-idx="${idx}" />
      <input type="text" class="srv-desc" value="${escapeHtml(s.description || "")}" placeholder="Description" data-idx="${idx}" />
      <button type="button" class="btn-del" data-idx="${idx}" title="Remove">&times;</button>
    `;
    els.servicesList.appendChild(row);
  });

  els.servicesList.querySelectorAll(".srv-label").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      state.services[idx].label = e.target.value;
      state.services[idx].key = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    });
  });
  els.servicesList.querySelectorAll(".srv-mins").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      state.services[idx].minutes = parseInt(e.target.value, 10) || 30;
    });
  });
  els.servicesList.querySelectorAll(".srv-price").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      state.services[idx].price = parseFloat(e.target.value) || 0;
    });
  });
  els.servicesList.querySelectorAll(".srv-desc").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      state.services[idx].description = e.target.value;
    });
  });
  els.servicesList.querySelectorAll(".btn-del").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(e.target.closest(".btn-del").dataset.idx, 10);
      state.services.splice(idx, 1);
      renderServicesList();
    });
  });
}

function bindBuilderEvents() {
  // Business switcher
  els.bizSelect.addEventListener("change", (e) => {
    selectBusiness(e.target.value);
  });

  // Preset Industry dropdown selection -> Updates all values (prompt, greeting, services, keyterms) while keeping practice name!
  els.presetIndustry.addEventListener("change", (e) => {
    if (e.target.value) {
      applyIndustryTemplate(e.target.value);
    }
  });

  // Direct typing of business/industry -> Updates all values (prompt, greeting, services, keyterms)
  if (els.btnApplyCustomIndustry) {
    els.btnApplyCustomIndustry.addEventListener("click", () => {
      const val = els.customIndustryInput.value.trim();
      if (val) {
        applyIndustryTemplate(val);
      }
    });
  }
  if (els.customIndustryInput) {
    els.customIndustryInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        els.btnApplyCustomIndustry.click();
      }
    });
  }

  // Add Keyterm
  els.btnAddKeyterm.addEventListener("click", () => {
    const val = els.newKeytermInput.value.trim();
    if (val && !state.keyterms.includes(val)) {
      state.keyterms.push(val);
      renderKeytermChips();
      els.newKeytermInput.value = "";
    }
  });
  els.newKeytermInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      els.btnAddKeyterm.click();
    }
  });

  // Add Service Offering
  els.btnAddServiceRow.addEventListener("click", () => {
    state.services.push({
      key: `service-${state.services.length + 1}`,
      label: "New Service",
      minutes: 30,
      price: 100,
      description: "Consultation and procedure"
    });
    renderServicesList();
  });

  // Save & Deploy Button
  els.btnDeployAgent.addEventListener("click", async () => {
    if (!state.activeBiz) return;
    els.btnDeployAgent.disabled = true;
    els.btnDeployAgent.innerHTML = "Deploying to AssemblyAI...";

    const currentIndustry = els.presetIndustry.value || (els.customIndustryInput ? els.customIndustryInput.value.trim() : "") || state.activeBiz.industry || "general";

    const payload = {
      name: els.bizNameInput.value.trim(),
      industry: currentIndustry,
      tone: els.voiceToneSelect.value,
      greeting: els.greetingInput.value.trim(),
      system_prompt: els.systemPromptInput.value.trim(),
      voice_id: els.voiceModelSelect.value,
      slot_minutes: parseInt(els.slotDurationSelect.value, 10),
      open_hour: parseInt(els.openHourInput.value, 10),
      close_hour: parseInt(els.closeHourInput.value, 10),
      keyterms: state.keyterms,
      services: state.services
    };

    try {
      const updateRes = await fetch(`/api/owner/businesses/${state.activeBiz.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const updateData = await updateRes.json();
      if (!updateData.ok) throw new Error("Update failed");

      const deployRes = await fetch(`/api/owner/businesses/${state.activeBiz.id}/deploy`, {
        method: "POST"
      });
      const deployData = await deployRes.json();
      if (!deployData.ok) throw new Error(deployData.detail || "Deploy failed");

      state.activeBiz = deployData.business;
      populateBuilder(state.activeBiz);

      alert(`Voice Agent successfully deployed to AssemblyAI!\nAgent ID: ${deployData.agent_id}`);
    } catch (err) {
      alert(`Deployment notice: ${err.message}`);
    } finally {
      els.btnDeployAgent.disabled = false;
      els.btnDeployAgent.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Save & Deploy Voice Agent
      `;
    }
  });
}

// ---------------------------------------------------------------------------
// Tabs & Modals Navigation
// ---------------------------------------------------------------------------

function bindTabs() {
  els.tabItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      els.tabItems.forEach((b) => b.classList.remove("active"));
      els.tabPanes.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const targetId = btn.dataset.tab;
      document.getElementById(targetId).classList.add("active");
      state.activeTab = targetId;

      if (targetId === "tab-bookings") loadBookings();
      if (targetId === "tab-conversations") loadConversations();
    });
  });
}

function bindModals() {
  els.btnAuthSwitch.addEventListener("click", () => {
    els.authModal.hidden = false;
  });
  els.btnCloseAuth.addEventListener("click", () => {
    els.authModal.hidden = true;
  });

  els.authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = els.authEmailInput.value.trim();
    const name = els.authNameInput.value.trim();
    if (!email) return;

    try {
      const res = await fetch("/api/auth/owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name })
      });
      const data = await res.json();
      if (data.ok) {
        state.owner = data.owner;
        state.businesses = data.businesses || [];
        localStorage.setItem("omnidesk_owner", JSON.stringify(state.owner));
        els.ownerEmailText.textContent = state.owner.email;
        renderBusinessSelect();
        if (state.businesses.length > 0) selectBusiness(state.businesses[0].id);
        els.authModal.hidden = true;
      }
    } catch (err) {
      alert("Authentication error: " + err.message);
    }
  });

  // New business modal
  els.btnCreateBiz.addEventListener("click", () => {
    els.newBizModal.hidden = false;
  });
  els.btnCloseNewBiz.addEventListener("click", () => {
    els.newBizModal.hidden = true;
  });

  // Auto-detect industry when typing business name in modal!
  if (els.modalBizName) {
    els.modalBizName.addEventListener("input", (e) => {
      const detected = detectIndustryFromText(e.target.value);
      if (detected && PRESETS[detected] && !els.modalBizCustomIndustry.value) {
        els.modalBizIndustry.value = detected;
      }
    });
  }

  els.newBizForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = els.modalBizName.value.trim();
    const selectedPreset = els.modalBizIndustry.value;
    const customType = els.modalBizCustomIndustry.value.trim();
    if (!name || !state.owner) return;

    const chosenIndustry = selectedPreset || customType || detectIndustryFromText(name) || "general";
    const template = PRESETS[chosenIndustry] || (detectIndustryFromText(chosenIndustry) ? PRESETS[detectIndustryFromText(chosenIndustry)] : null);

    let tone = "professional";
    let greeting = `Thanks for calling ${name}. Are you looking to book an appointment?`;
    let systemPrompt = `You are an autonomous receptionist for ${name}. You speak naturally, answer questions about our services, check real calendar slots using your tools, and book appointments for callers.`;
    let voiceId = "131a436c-0fc4-4797-90f7-d0e515d18b06";
    let slotMins = 30;
    let openH = 9;
    let closeH = 17;
    let keyterms = [name, chosenIndustry, "appointment", "booking"];
    let services = [];

    if (template) {
      tone = template.tone;
      greeting = `Thanks for calling ${name}. Are you looking to book an appointment?`;
      systemPrompt = template.system_prompt.replace(template.name, name);
      voiceId = template.voice_id;
      slotMins = template.slot_minutes;
      openH = template.open_hour;
      closeH = template.close_hour;
      keyterms = [name, ...template.keyterms.filter(k => k !== template.name)];
      services = JSON.parse(JSON.stringify(template.services));
    } else {
      greeting = `Thanks for calling ${name}. Are you looking to schedule an appointment or consultation?`;
      systemPrompt = `You are an autonomous AI voice receptionist for ${name}, specializing in ${chosenIndustry}. You speak in a natural, polite, and reassuring tone. You answer caller questions about ${chosenIndustry} offerings, check real calendar slots using your tools, collect the caller's name and email address, and book appointments.`;
      services = [
        { key: "consultation", label: "Initial Consultation", minutes: 30, price: 95, description: `Comprehensive ${chosenIndustry} evaluation and assessment.` },
        { key: "standard-service", label: "Standard Service Appointment", minutes: 45, price: 150, description: `Full professional ${chosenIndustry} appointment.` },
        { key: "follow-up", label: "Follow-Up & Review", minutes: 30, price: 65, description: `Progress review, adjustments, and follow-up consultation.` }
      ];
    }

    const payload = {
      owner_id: state.owner.id,
      name: name,
      industry: chosenIndustry,
      tone: tone,
      greeting: greeting,
      system_prompt: systemPrompt,
      voice_id: voiceId,
      slot_minutes: slotMins,
      open_hour: openH,
      close_hour: closeH,
      keyterms: keyterms,
      services: services
    };

    try {
      const res = await fetch("/api/owner/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.ok && data.business) {
        state.businesses.unshift(data.business);
        renderBusinessSelect();
        selectBusiness(data.business.id);
        els.newBizModal.hidden = true;
        els.modalBizName.value = "";
        els.modalBizCustomIndustry.value = "";
        els.modalBizIndustry.value = "";
      }
    } catch (err) {
      alert("Failed to create business: " + err.message);
    }
  });

  els.btnCloseTranscript.addEventListener("click", () => {
    els.transcriptModal.hidden = true;
  });
}

// ---------------------------------------------------------------------------
// Customer Bookings CRM Tab
// ---------------------------------------------------------------------------

async function loadBookings() {
  if (!state.activeBiz) return;
  try {
    const res = await fetch(`/api/owner/businesses/${state.activeBiz.id}/bookings`);
    const data = await res.json();
    const bookings = data.bookings || [];

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayCount = bookings.filter((b) => b.appointment_date === todayStr).length;
    const upcomingCount = bookings.filter((b) => b.appointment_date > todayStr).length;
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.price || 0), 0);

    els.kpiTodayCount.textContent = todayCount;
    els.kpiUpcomingCount.textContent = upcomingCount;
    els.kpiTotalCount.textContent = bookings.length;
    els.kpiTotalVal.textContent = `$${totalRevenue.toLocaleString()}`;
    els.badgeBookingsCount.textContent = bookings.length;

    if (bookings.length === 0) {
      els.bookingsTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px;">
            No customer bookings recorded yet. Speak with the agent in the Live Voice Tester to book an appointment!
          </td>
        </tr>
      `;
      return;
    }

    els.bookingsTableBody.innerHTML = bookings
      .map(
        (b) => `
        <tr>
          <td><span class="badge-tag" style="font-weight:700;">${escapeHtml(b.confirmation_code)}</span></td>
          <td><strong>${escapeHtml(b.appointment_date)}</strong> at ${escapeHtml(b.appointment_time)}</td>
          <td>${escapeHtml(b.customer_name)}<br><span style="font-size:11.5px; color:var(--text-muted);">${escapeHtml(b.customer_email)}</span></td>
          <td>${escapeHtml(b.service_label)}</td>
          <td><strong>$${b.price || 0}</strong></td>
          <td>
            <span class="badge-tag ${b.confirmation_sent ? "sent" : ""}">
              ${b.confirmation_sent ? "Sent (.ics)" : "Pending"}
            </span>
          </td>
          <td style="font-size: 11.5px; color: var(--text-muted);">${escapeHtml(b.created_at)}</td>
        </tr>
      `
      )
      .join("");
  } catch (err) {
    console.error("Failed to load bookings:", err);
  }
}

// ---------------------------------------------------------------------------
// Conversation History Tab
// ---------------------------------------------------------------------------

async function loadConversations() {
  if (!state.activeBiz) return;
  try {
    const res = await fetch(`/api/owner/businesses/${state.activeBiz.id}/conversations`);
    const data = await res.json();
    const convs = data.conversations || [];
    els.badgeConvCount.textContent = convs.length;

    if (convs.length === 0) {
      els.convTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 32px;">
            No recorded conversations yet. Start a call in the Live Voice Tester to record dialogue.
          </td>
        </tr>
      `;
      return;
    }

    els.convTableBody.innerHTML = convs
      .map(
        (c, idx) => `
        <tr>
          <td><strong>${escapeHtml(c.caller_name || "Caller")}</strong></td>
          <td>${escapeHtml(c.caller_email || "Not specified")}</td>
          <td>${escapeHtml(c.started_at)}</td>
          <td><span class="badge-tag">${c.duration_seconds || 0}s</span></td>
          <td>
            <span class="badge-tag ${c.outcome === "booked" ? "sent" : ""}">
              ${c.outcome === "booked" ? "Booked Slot" : "Inquiry"}
            </span>
          </td>
          <td>
            <button type="button" class="btn-secondary btn-view-transcript" data-idx="${idx}" style="padding: 4px 10px; font-size: 12px;">
              View Transcript
            </button>
          </td>
        </tr>
      `
      )
      .join("");

    els.convTableBody.querySelectorAll(".btn-view-transcript").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        const conv = convs[idx];
        showTranscriptModal(conv);
      });
    });
  } catch (err) {
    console.error("Failed to load conversations:", err);
  }
}

function showTranscriptModal(conv) {
  els.transcriptModalTitle.textContent = `Call with ${conv.caller_name || "Caller"} (${conv.started_at})`;
  const transcript = Array.isArray(conv.transcript) ? conv.transcript : [];
  if (transcript.length === 0) {
    els.transcriptModalBody.innerHTML = `<p style="color: var(--text-muted); font-size: 13px;">(No transcript captured)</p>`;
  } else {
    els.transcriptModalBody.innerHTML = transcript
      .map(
        (t) => `
        <div class="bubble ${t.who}">
          <span class="bubble-who">${t.who === "agent" ? "AI Receptionist" : "Caller"}</span>
          ${escapeHtml(t.text)}
        </div>
      `
      )
      .join("");
  }
  els.transcriptModal.hidden = false;
}

// ---------------------------------------------------------------------------
// Real-Time Live Voice Simulator
// ---------------------------------------------------------------------------

const SAMPLE_RATE = 24000;
const WS_URL = "wss://agents.assemblyai.com/v1/ws";

let sim = {
  active: false,
  ws: null,
  audioCtx: null,
  micStream: null,
  workletNode: null,
  startTime: 0,
  timerInterval: null,
  transcript: [],
  toolCalls: [],
  callerName: "",
  callerEmail: "",
  hasBooked: false,
  eventCursor: 0,
  pollTimer: null
};

function bindSimulatorEvents() {
  els.btnStartSim.addEventListener("click", () => {
    if (sim.active) {
      endSimCall();
    } else {
      startSimCall();
    }
  });
}

async function startSimCall() {
  if (!state.activeBiz) return;

  els.btnStartSim.disabled = true;
  els.simStatusLabel.textContent = "Connecting to AssemblyAI...";
  els.simDot.className = "sim-dot";

  try {
    const tokenRes = await fetch(`/api/owner/businesses/${state.activeBiz.id}/token`);
    if (!tokenRes.status.toString().startsWith("2")) {
      const err = await tokenRes.json();
      throw new Error(err.detail || "Failed to mint AssemblyAI session token");
    }
    const { token, agent_id } = await tokenRes.json();

    sim.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: SAMPLE_RATE,
        echoCancellation: true,
        noiseSuppression: true
      }
    });

    sim.audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
    await sim.audioCtx.audioWorklet.addModule("/worklet.js");

    sim.ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);

    sim.ws.onopen = () => {
      sim.ws.send(
        JSON.stringify({
          type: "session.update",
          session: { agent_id: agent_id }
        })
      );
    };

    sim.transcript = [];
    sim.toolCalls = [];
    sim.callerName = "";
    sim.callerEmail = "";
    sim.hasBooked = false;
    els.simFeed.innerHTML = "";
    els.simToolsFeed.innerHTML = "";

    sim.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      handleSimMessage(msg);
    };

    sim.ws.onerror = () => {
      els.simStatusLabel.textContent = "Connection error";
      endSimCall();
    };

    sim.ws.onclose = () => {
      if (sim.active) endSimCall();
    };

    sim.workletNode = new AudioWorkletNode(sim.audioCtx, "pcm-processor");
    sim.workletNode.port.onmessage = ({ data }) => {
      if (sim.ws && sim.ws.readyState === WebSocket.OPEN && sim.active) {
        sim.ws.send(JSON.stringify({ type: "input.audio", audio: toBase64(data) }));
      }
    };
    sim.audioCtx.createMediaStreamSource(sim.micStream).connect(sim.workletNode);
    sim.workletNode.connect(sim.audioCtx.destination);
  } catch (err) {
    alert("Call setup error: " + err.message);
    els.btnStartSim.disabled = false;
    els.simStatusLabel.textContent = "Failed to start call";
  }
}

function handleSimMessage(msg) {
  switch (msg.type) {
    case "session.ready":
      sim.active = true;
      els.btnStartSim.disabled = false;
      els.btnStartSim.classList.add("ending");
      els.btnStartSim.innerHTML = `End Call`;
      els.simDot.className = "sim-dot live";
      els.simStatusLabel.textContent = "Live Conversation — Speaking with Agent";
      startSimTimer();
      sim.eventCursor = 0;
      sim.pollTimer = setInterval(pollSimTools, 500);
      break;

    case "input.speech.started":
      stopPlayback();
      break;

    case "transcript.user":
      addSimBubble("user", msg.text);
      sim.transcript.push({ who: "user", text: msg.text });
      break;

    case "transcript.agent":
      addSimBubble("agent", msg.text);
      sim.transcript.push({ who: "agent", text: msg.text });
      break;

    case "reply.audio":
      playChunk(fromBase64(msg.data));
      break;

    case "reply.done":
      if (msg.status === "interrupted") stopPlayback();
      break;

    case "session.ended":
      endSimCall();
      break;
  }
}

function addSimBubble(who, text) {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${who}`;
  const label = who === "agent" ? "AI Receptionist" : "You";
  bubble.innerHTML = `<span class="bubble-who">${label}</span>${escapeHtml(text)}`;
  els.simFeed.appendChild(bubble);
  els.simFeed.scrollTop = els.simFeed.scrollHeight;
}

async function pollSimTools() {
  try {
    const res = await fetch(`/api/events?since=${sim.eventCursor}`);
    const data = await res.json();
    sim.eventCursor = data.cursor;
    for (const ev of data.events) {
      sim.toolCalls.push(ev);
      renderSimToolItem(ev);
      if (ev.tool === "book_appointment" && ev.arguments) {
        sim.hasBooked = true;
        if (ev.arguments.customer_name) sim.callerName = ev.arguments.customer_name;
        if (ev.arguments.email) sim.callerEmail = ev.arguments.email;
        loadBookings();
      }
    }
  } catch (_) {}
}

function renderSimToolItem(ev) {
  const card = document.createElement("div");
  card.style.background = "#fafafa";
  card.style.border = "1px solid var(--border)";
  card.style.borderRadius = "6px";
  card.style.padding = "8px 12px";
  card.style.fontSize = "12px";

  const head = document.createElement("div");
  head.style.display = "flex";
  head.style.justifyContent = "space-between";
  head.style.fontWeight = "600";
  head.style.marginBottom = "4px";
  head.innerHTML = `<span>POST /tools/${escapeHtml(ev.tool)}</span><span style="font-family:var(--mono); color:var(--text-muted);">${ev.at}</span>`;

  const msg = document.createElement("div");
  msg.style.color = "var(--text-muted)";
  msg.textContent = (ev.result && ev.result.message) || "Tool executed";

  card.append(head, msg);
  els.simToolsFeed.appendChild(card);
  els.simToolsFeed.scrollTop = els.simToolsFeed.scrollHeight;
}

let playScheduled = [];
let simPlayHead = 0;

function playChunk(int16) {
  if (!sim.audioCtx) return;
  const buffer = sim.audioCtx.createBuffer(1, int16.length, SAMPLE_RATE);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < int16.length; i++) channel[i] = int16[i] / 32768;

  const src = sim.audioCtx.createBufferSource();
  src.buffer = buffer;
  src.connect(sim.audioCtx.destination);

  const now = sim.audioCtx.currentTime;
  const at = Math.max(now, simPlayHead);
  src.start(at);
  simPlayHead = at + buffer.duration;
  playScheduled.push(src);
  src.onended = () => {
    const idx = playScheduled.indexOf(src);
    if (idx !== -1) playScheduled.splice(idx, 1);
  };
}

function stopPlayback() {
  for (const s of playScheduled) {
    try { s.stop(); } catch (_) {}
  }
  playScheduled = [];
  if (sim.audioCtx) simPlayHead = sim.audioCtx.currentTime;
}

function startSimTimer() {
  sim.startTime = Date.now();
  sim.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - sim.startTime) / 1000);
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    els.simTimer.textContent = `${m}:${String(s).padStart(2, "0")}`;
  }, 500);
}

async function endSimCall() {
  sim.active = false;
  clearInterval(sim.timerInterval);
  clearInterval(sim.pollTimer);

  if (sim.ws) {
    try { sim.ws.close(); } catch (_) {}
    sim.ws = null;
  }
  if (sim.micStream) {
    sim.micStream.getTracks().forEach((t) => t.stop());
    sim.micStream = null;
  }
  if (sim.audioCtx) {
    try { sim.audioCtx.close(); } catch (_) {}
    sim.audioCtx = null;
  }

  els.btnStartSim.classList.remove("ending");
  els.btnStartSim.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
    Start Call
  `;
  els.btnStartSim.disabled = false;
  els.simDot.className = "sim-dot";
  els.simStatusLabel.textContent = "Call Ended & Logged to History";

  if (sim.transcript.length > 0 && state.activeBiz) {
    const elapsedSeconds = Math.max(1, Math.floor((Date.now() - sim.startTime) / 1000));
    try {
      await fetch("/api/conversations/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: state.activeBiz.id,
          caller_name: sim.callerName || (state.owner ? state.owner.name : "Test Caller"),
          caller_email: sim.callerEmail || (state.owner ? state.owner.email : "caller@example.com"),
          started_at: new Date(sim.startTime).toISOString().replace("T", " ").slice(0, 19),
          ended_at: new Date().toISOString().replace("T", " ").slice(0, 19),
          duration_seconds: elapsedSeconds,
          status: "completed",
          outcome: sim.hasBooked ? "booked" : "inquiry",
          transcript: sim.transcript,
          tool_calls: sim.toolCalls
        })
      });
      loadConversations();
    } catch (e) {
      console.error("Failed to save conversation log:", e);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function fromBase64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

// Start
document.addEventListener("DOMContentLoaded", init);
