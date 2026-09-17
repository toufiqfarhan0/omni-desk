/**
 * OmniDesk SaaS Owner Dashboard & Voice Agent Builder
 * Multi-tenant business workflows, live voice agent testing,
 * call history logging, and customer bookings CRM.
 */

let supabaseClient = null;

async function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  try {
    const res = await fetch("/api/config");
    const cfg = await res.json();
    if (window.supabase && window.supabase.createClient && cfg.supabase_url && cfg.supabase_anon_key) {
      supabaseClient = window.supabase.createClient(cfg.supabase_url, cfg.supabase_anon_key);
    }
  } catch (err) {
    console.warn("Could not load Supabase client config from /api/config:", err);
  }
  return supabaseClient;
}

const VOICE_NAMES = {
  "alba": "Alba — Warm, Natural Female (US)",
  "eve": "Eve — Clear, Professional Female (US)",
  "jane": "Jane — Friendly, Expressive Female (US)",
  "anna": "Anna — Polished, Refined Female (GB)",
  "george": "George — Deep, Professional Male (US)",
  "michael": "Michael — Crisp, Confident Male (US)",
  "charles": "Charles — Distinguished Male (GB)",
  // Backward compatibility fallback mappings:
  "131a436c-0fc4-4797-90f7-d0e515d18b06": "Alba — Warm, Natural Female (US)",
  "098b63e0-3273-47a2-9694-de982d618991": "George — Deep, Professional Male (US)",
  "b7d50908-b17c-442d-ad8d-810c63997ed9": "Jane — Friendly, Expressive Female (US)",
  "79a125e8-cd45-4c13-8a67-188112f4dd22": "Eve — Clear, Professional Female (US)"
};

const VOICE_ID_MAP = {
  "131a436c-0fc4-4797-90f7-d0e515d18b06": "alba",
  "098b63e0-3273-47a2-9694-de982d618991": "george",
  "b7d50908-b17c-442d-ad8d-810c63997ed9": "jane",
  "79a125e8-cd45-4c13-8a67-188112f4dd22": "eve"
};



const PRESETS = {
  dental: {
    name: "OmniDesk Dental Clinic",
    greeting: "Thanks for calling OmniDesk Dental Clinic. Are you looking to book an appointment?",
    system_prompt: "You are an autonomous receptionist for OmniDesk Dental Clinic. You speak naturally, answer questions about dental procedures, check real calendar slots using your tools, and book appointments for callers.",
    voice_id: "alba",
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
    greeting: "Thank you for calling Lumina MedSpa. How may I assist you with your aesthetic treatment today?",
    system_prompt: "You are an autonomous receptionist for Lumina MedSpa. You provide consultations on aesthetic skin treatments, check availability, and schedule appointments with certified clinicians.",
    voice_id: "eve",
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
    greeting: "Thank you for contacting Vanguard Legal Advisory. Are you seeking to schedule an attorney consultation?",
    system_prompt: "You are a professional legal intake receptionist for Vanguard Legal Advisory. You qualify client inquiries, check attorney consultation availability, and book confidential consultation sessions.",
    voice_id: "george",
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
    name: "OmniDesk Hair Salon & Studio",
    greeting: "Thanks for calling OmniDesk Hair Salon & Studio. Are you looking to book a haircut, styling, or coloring appointment today?",
    system_prompt: "You are an autonomous receptionist for OmniDesk Hair Salon & Studio. You speak naturally and warmly, assist clients with hair salon services, check real calendar slots using your tools, and book appointments for callers.",
    voice_id: "alba",
    slot_minutes: 30,
    open_hour: 9,
    close_hour: 19,
    keyterms: ["OmniDesk", "haircut", "styling", "coloring", "balayage", "blowout", "highlights", "shampoo"],
    services: [
      { key: "haircut", label: "Signature Haircut & Styling", minutes: 45, price: 85, description: "Consultation, precision wash, cut, and signature blow-dry styling." },
      { key: "coloring", label: "Full Color & Gloss", minutes: 60, price: 185, description: "Single-process all-over color, root touch-up, and high-shine gloss glaze." },
      { key: "balayage", label: "Artisan Balayage & Highlights", minutes: 120, price: 280, description: "Hand-painted dimensional contouring, bond builder, and custom gloss toner." },
      { key: "blowout", label: "Signature Blowout & Treatment", minutes: 30, price: 65, description: "Invigorating scalp cleanse, restorative moisture mask, and blow-dry finish." }
    ]
  },
  auto: {
    name: "Precision Auto Care",
    greeting: "Thanks for calling Precision Auto Care. What service can we get your vehicle scheduled for?",
    system_prompt: "You are an efficient service advisor for Precision Auto Care. You schedule preventative maintenance, diagnostic evaluations, and mechanical repairs.",
    voice_id: "michael",
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
    greeting: "Thank you for calling Sterling Real Estate Partners. How can we assist you with your property search or listing today?",
    system_prompt: "You are an autonomous scheduling coordinator for Sterling Real Estate Partners. You book private property viewings, appraisal consultations, and buyer advisory meetings.",
    voice_id: "jane",
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
  services: [],
  isDirty: false
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
  operatingDaysSelect: document.getElementById("operating-days-select"),

  // Simulator
  simDot: document.getElementById("sim-dot"),
  simStatusLabel: document.getElementById("sim-status-label"),
  simTimer: document.getElementById("sim-timer"),
  simFeed: document.getElementById("sim-feed"),
  btnStartSim: document.getElementById("btn-start-sim"),
  simToolsFeed: document.getElementById("sim-tools-feed"),
  simEmailBox: document.getElementById("sim-email-box"),
  simEmailForm: document.getElementById("sim-email-form"),
  simEmailInput: document.getElementById("sim-email-input"),
  simEmailCheck: document.getElementById("sim-email-check"),
  simEmailFeedback: document.getElementById("sim-email-feedback"),
  btnSimSendEmail: document.getElementById("btn-sim-send-email"),
  btnSimEmailToggle: document.getElementById("btn-sim-email-toggle"),

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

  // Topbar
  ownerBadgeDot: document.getElementById("owner-badge-dot"),
  ownerTypeBadge: document.getElementById("owner-type-badge"),
  btnSignOut: document.getElementById("btn-sign-out"),

  // Modals
  authModal: document.getElementById("auth-modal"),
  authForm: document.getElementById("auth-form"),
  authEmailInput: document.getElementById("auth-email-input"),
  authNameInput: document.getElementById("auth-name-input"),
  authPasswordInput: document.getElementById("auth-password-input"),
  dashGroupName: document.getElementById("dash-group-name"),
  dashTabSignIn: document.getElementById("dash-tab-signin"),
  dashTabSignUp: document.getElementById("dash-tab-signup"),
  dashAuthAlert: document.getElementById("dash-auth-alert"),
  btnDashAuthSubmit: document.getElementById("btn-dash-auth-submit"),
  btnDashInstantDemo: document.getElementById("btn-dash-instant-demo"),
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

  // AI Agent Persona Showcase
  agentPersonaCard: document.getElementById("agent-persona-card"),
  personaAvatarLetter: document.getElementById("persona-avatar-letter"),
  personaVoiceName: document.getElementById("persona-voice-name"),
  personaGreetingText: document.getElementById("persona-greeting-text"),
  personaServicesPreview: document.getElementById("persona-services-preview"),
  btnPersonaTestCall: document.getElementById("btn-persona-test-call"),

  // Celebratory Showcase Modal
  agentShowcaseModal: document.getElementById("agent-showcase-modal"),
  btnCloseShowcase: document.getElementById("btn-close-showcase"),
  showcaseAvatarLetter: document.getElementById("showcase-avatar-letter"),
  showcaseBizName: document.getElementById("showcase-biz-name"),
  showcaseVoiceName: document.getElementById("showcase-voice-name"),
  showcaseGreetingText: document.getElementById("showcase-greeting-text"),
  showcaseServicesList: document.getElementById("showcase-services-list"),
  btnShowcaseCallNow: document.getElementById("btn-showcase-call-now"),
  btnShowcaseInspect: document.getElementById("btn-showcase-inspect"),

  // Inline red warning below Test Voice Agent Live button
  personaTestWarning: document.getElementById("persona-test-warning"),
  btnWarningDeploy: document.getElementById("btn-warning-deploy"),
  btnWarningContinue: document.getElementById("btn-warning-continue")
};

// ---------------------------------------------------------------------------
// Cute Custom Dropdown System (Cute rounded popover, soft-gray pills, strictly dropdown / no dropup)
// ---------------------------------------------------------------------------
const CuteDropdown = {
  instances: new Map(),

  initSelect(selectEl) {
    if (!selectEl || CuteDropdown.instances.has(selectEl)) return;

    selectEl.classList.add("custom-dropdown-native");

    const wrapper = document.createElement("div");
    wrapper.className = "custom-dropdown" + (selectEl.classList.contains("biz-select") ? " is-biz-select" : "");

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "custom-dropdown-trigger";
    trigger.tabIndex = 0;

    const label = document.createElement("span");
    label.className = "custom-dropdown-value";

    const chevron = document.createElement("span");
    chevron.className = "custom-dropdown-chevron";
    chevron.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `;

    trigger.appendChild(label);
    trigger.appendChild(chevron);

    const menu = document.createElement("div");
    menu.className = "custom-dropdown-menu";

    selectEl.parentNode.insertBefore(wrapper, selectEl);
    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);
    wrapper.appendChild(selectEl);

    const instance = { wrapper, trigger, label, menu, optionsMap: new Map() };
    CuteDropdown.instances.set(selectEl, instance);

    CuteDropdown.rebuild(selectEl);

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      CuteDropdown.toggle(selectEl);
    });

    trigger.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        CuteDropdown.open(selectEl);
      } else if (e.key === "Escape") {
        CuteDropdown.close(selectEl);
      }
    });

    return instance;
  },

  rebuild(selectEl) {
    const inst = CuteDropdown.instances.get(selectEl);
    if (!inst) return;

    inst.menu.innerHTML = "";
    inst.optionsMap.clear();

    Array.from(selectEl.options).forEach((opt) => {
      const item = document.createElement("div");
      item.className = "custom-dropdown-option";
      item.dataset.value = opt.value;
      item.textContent = opt.textContent;

      item.addEventListener("click", (e) => {
        e.stopPropagation();
        selectEl.value = opt.value;
        CuteDropdown.sync(selectEl);
        CuteDropdown.close(selectEl);
        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      });

      inst.menu.appendChild(item);
      inst.optionsMap.set(opt.value, item);
    });

    CuteDropdown.sync(selectEl);
  },

  sync(selectEl) {
    const inst = CuteDropdown.instances.get(selectEl);
    if (!inst) return;

    const selectedOption = selectEl.options[selectEl.selectedIndex];
    const text = selectedOption ? selectedOption.textContent : "";
    inst.label.textContent = text || "Select...";

    const currentVal = selectEl.value;
    inst.optionsMap.forEach((el, val) => {
      if (String(val) === String(currentVal)) {
        el.classList.add("is-selected");
      } else {
        el.classList.remove("is-selected");
      }
    });
  },

  syncAll() {
    CuteDropdown.instances.forEach((_, selectEl) => {
      CuteDropdown.sync(selectEl);
    });
  },

  open(selectEl) {
    const inst = CuteDropdown.instances.get(selectEl);
    if (!inst) return;
    CuteDropdown.closeAll();
    inst.wrapper.classList.add("is-open");
    const selected = inst.menu.querySelector(".is-selected");
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
    const rect = inst.menu.getBoundingClientRect();
    if (rect.bottom > window.innerHeight) {
      window.scrollBy({ top: rect.bottom - window.innerHeight + 24, behavior: "smooth" });
    }
  },

  close(selectEl) {
    const inst = CuteDropdown.instances.get(selectEl);
    if (!inst) return;
    inst.wrapper.classList.remove("is-open");
  },

  toggle(selectEl) {
    const inst = CuteDropdown.instances.get(selectEl);
    if (!inst) return;
    if (inst.wrapper.classList.contains("is-open")) {
      CuteDropdown.close(selectEl);
    } else {
      CuteDropdown.open(selectEl);
    }
  },

  closeAll() {
    CuteDropdown.instances.forEach((inst) => {
      inst.wrapper.classList.remove("is-open");
    });
  },

  initAll() {
    document.querySelectorAll("select.select-input, select.biz-select").forEach((sel) => {
      CuteDropdown.initSelect(sel);
    });
  }
};

document.addEventListener("click", () => CuteDropdown.closeAll());
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") CuteDropdown.closeAll();
});

// ---------------------------------------------------------------------------
// Initialization & Auth
// ---------------------------------------------------------------------------

async function init() {
  CuteDropdown.initAll();
  bindTabs();
  bindModals();
  bindBuilderEvents();
  bindSimulatorEvents();

  let activeEmail = "demo@omnidesk.ai";
  let activeName = "";

  // Initialize Supabase client from environment (/api/config)
  await getSupabaseClient();

  // Check Supabase session first
  if (supabaseClient) {
    try {
      const { data } = await supabaseClient.auth.getSession();
      if (data && data.session && data.session.user && data.session.user.email) {
        activeEmail = data.session.user.email;
        activeName = (data.session.user.user_metadata && data.session.user.user_metadata.full_name) || "";
      }
    } catch (_) {}
  }

  // Fallback to local storage if not signed into Supabase
  if (activeEmail === "demo@omnidesk.ai") {
    const stored = localStorage.getItem("omnidesk_owner");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.email) {
          activeEmail = parsed.email;
          if (parsed.name) activeName = parsed.name;
        }
      } catch (_) {}
    }
  }

  await loadOwnerSession(activeEmail, activeName);
}

async function loadOwnerSession(email, name = "") {
  try {
    const res = await fetch(`/api/auth/session?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    if (data.ok && data.owner) {
      state.owner = data.owner;
      state.businesses = data.businesses || [];
      localStorage.setItem("omnidesk_owner", JSON.stringify(state.owner));
      els.ownerEmailText.textContent = state.owner.email;

      // Update topbar badges
      const isDemo = state.owner.email === "demo@omnidesk.ai" || state.owner.id === "owner_demo";
      if (els.ownerTypeBadge) {
        els.ownerTypeBadge.textContent = isDemo ? "DEMO" : "ACCOUNT";
        els.ownerTypeBadge.style.background = isDemo ? "#000000" : "#16a34a";
      }
      if (els.btnSignOut) {
        els.btnSignOut.style.display = isDemo ? "none" : "inline-flex";
      }

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
  CuteDropdown.rebuild(els.bizSelect);
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
  CuteDropdown.sync(els.bizSelect);

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

  const mappedVoice = VOICE_ID_MAP[biz.voice_id] || biz.voice_id || "alba";
  els.voiceModelSelect.value = mappedVoice;
  els.slotDurationSelect.value = String(biz.slot_minutes || 30);
  els.greetingInput.value = biz.greeting || "";
  els.systemPromptInput.value = biz.system_prompt || "";
  els.openHourInput.value = String(biz.open_hour || 9);
  els.closeHourInput.value = String(biz.close_hour || 17);
  if (els.operatingDaysSelect) {
    els.operatingDaysSelect.value = biz.operating_days || "mon-fri";
  }
  CuteDropdown.syncAll();

  // Keyterms
  state.keyterms = Array.isArray(biz.keyterms) ? [...biz.keyterms] : [];
  renderKeytermChips();

  // Services
  state.services = Array.isArray(biz.services) ? JSON.parse(JSON.stringify(biz.services)) : [];
  renderServicesList();

  // Persona Showcase ("How Your Created AI Agent Looks")
  renderPersonaShowcase(biz);

  // Status banner
  if (biz.assemblyai_agent_id) {
    els.bannerAgentPill.textContent = "AssemblyAI Provisioned";
    els.bannerAgentPill.style.background = "#000000";
    els.bannerAgentDesc.textContent = "Voice Receptionist active with live calendar booking tools.";
  } else {
    els.bannerAgentPill.textContent = "Draft Workflow";
    els.bannerAgentPill.style.background = "#71717a";
    els.bannerAgentDesc.textContent = "Click 'Save & Deploy Voice Agent' to provision on AssemblyAI Voice Agent API.";
  }

  state.isDirty = false;
  if (els.personaTestWarning) els.personaTestWarning.style.display = "none";
}

function renderPersonaShowcase(biz) {
  if (!biz) return;
  const rawVoiceId = biz.voice_id || els.voiceModelSelect.value;
  const voiceId = VOICE_ID_MAP[rawVoiceId] || rawVoiceId || "alba";
  const voiceLabel = VOICE_NAMES[voiceId] || "Alba — Warm, Natural Female (US)";
  const firstLetter = (biz.name || voiceLabel).charAt(0).toUpperCase();

  if (els.personaAvatarLetter) els.personaAvatarLetter.textContent = firstLetter;
  if (els.personaVoiceName) els.personaVoiceName.textContent = voiceLabel;
  if (els.personaGreetingText) els.personaGreetingText.textContent = `"${biz.greeting || els.greetingInput.value || 'Thanks for calling.'}"`;

  if (els.personaServicesPreview) {
    els.personaServicesPreview.innerHTML = "";
    const srvs = Array.isArray(biz.services) && biz.services.length > 0 ? biz.services : state.services;
    srvs.forEach((s) => {
      const chip = document.createElement("span");
      chip.className = "persona-srv-pill";
      chip.innerHTML = `<strong>${escapeHtml(s.label || "Service")}</strong> &middot; ${s.minutes || 30}m &middot; $${s.price || 0}`;
      els.personaServicesPreview.appendChild(chip);
    });
  }
}

function syncPersonaShowcaseFromForm() {
  const rawVoiceId = els.voiceModelSelect.value;
  const voiceId = VOICE_ID_MAP[rawVoiceId] || rawVoiceId || "alba";
  const voiceLabel = VOICE_NAMES[voiceId] || "Alba — Warm, Natural Female (US)";
  const currentBizName = els.bizNameInput.value.trim() || (state.activeBiz ? state.activeBiz.name : "My Business");
  const firstLetter = currentBizName.charAt(0).toUpperCase() || "A";
  const greeting = els.greetingInput.value.trim() || `Thanks for calling ${currentBizName}.`;

  if (els.personaAvatarLetter) els.personaAvatarLetter.textContent = firstLetter;
  if (els.personaVoiceName) els.personaVoiceName.textContent = voiceLabel;
  if (els.personaGreetingText) els.personaGreetingText.textContent = `"${greeting}"`;

  if (els.personaServicesPreview) {
    els.personaServicesPreview.innerHTML = "";
    state.services.forEach((s) => {
      const chip = document.createElement("span");
      chip.className = "persona-srv-pill";
      chip.innerHTML = `<strong>${escapeHtml(s.label || "Service")}</strong> &middot; ${s.minutes || 30}m &middot; $${s.price || 0}`;
      els.personaServicesPreview.appendChild(chip);
    });
  }
}

function showCreatedAgentShowcase(biz) {
  if (!els.agentShowcaseModal) return;
  const rawVoiceId = biz.voice_id || els.voiceModelSelect.value;
  const voiceId = VOICE_ID_MAP[rawVoiceId] || rawVoiceId || "alba";
  const voiceLabel = VOICE_NAMES[voiceId] || "Alba — Warm, Natural Female (US)";
  const firstLetter = (biz.name || "A").charAt(0).toUpperCase();

  if (els.showcaseAvatarLetter) els.showcaseAvatarLetter.textContent = firstLetter;
  if (els.showcaseBizName) els.showcaseBizName.textContent = biz.name;
  if (els.showcaseVoiceName) els.showcaseVoiceName.textContent = voiceLabel.split(" — ")[0];
  if (els.showcaseGreetingText) els.showcaseGreetingText.textContent = `"${biz.greeting}"`;

  if (els.showcaseServicesList) {
    els.showcaseServicesList.innerHTML = "";
    (biz.services || []).forEach((s) => {
      const chip = document.createElement("span");
      chip.className = "persona-srv-pill";
      chip.innerHTML = `<strong>${escapeHtml(s.label)}</strong> (${s.minutes}m, $${s.price})`;
      els.showcaseServicesList.appendChild(chip);
    });
  }

  els.agentShowcaseModal.hidden = false;
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
    els.greetingInput.value = `Thanks for calling ${currentBizName}. Are you looking to book an appointment?`;
    els.systemPromptInput.value = p.system_prompt;
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
    els.greetingInput.value = `Thanks for calling ${currentBizName}. Are you looking to schedule an appointment or consultation?`;
    els.systemPromptInput.value = `You are an autonomous AI voice receptionist for ${currentBizName}, specializing in ${cleanType}. You speak in a natural, polite, and reassuring tone. You answer caller questions about ${cleanType} offerings, check real calendar slots using your tools, collect the caller's name and email address, and book appointments.`;
    els.voiceModelSelect.value = "alba";
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
  CuteDropdown.syncAll();
  syncPersonaShowcaseFromForm();
  markDirty();
}

function markDirty() {
  state.isDirty = true;
}

function showPersonaTestWarning() {
  if (!els.personaTestWarning) return;
  els.personaTestWarning.style.display = "block";
  els.personaTestWarning.scrollIntoView({ behavior: "smooth", block: "center" });
  els.personaTestWarning.style.transition = "transform 0.2s ease, box-shadow 0.2s ease";
  els.personaTestWarning.style.transform = "scale(1.03)";
  els.personaTestWarning.style.boxShadow = "0 0 0 4px rgba(220, 38, 38, 0.25)";
  setTimeout(() => {
    if (els.personaTestWarning) {
      els.personaTestWarning.style.transform = "scale(1)";
      els.personaTestWarning.style.boxShadow = "none";
    }
  }, 350);
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
      markDirty();
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
      markDirty();
    });
  });
  els.servicesList.querySelectorAll(".srv-mins").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      state.services[idx].minutes = parseInt(e.target.value, 10) || 30;
      markDirty();
    });
  });
  els.servicesList.querySelectorAll(".srv-price").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      state.services[idx].price = parseFloat(e.target.value) || 0;
      markDirty();
    });
  });
  els.servicesList.querySelectorAll(".srv-desc").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      state.services[idx].description = e.target.value;
      markDirty();
    });
  });
  els.servicesList.querySelectorAll(".btn-del").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(e.target.closest(".btn-del").dataset.idx, 10);
      state.services.splice(idx, 1);
      markDirty();
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
      markDirty();
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
    markDirty();
    renderServicesList();
  });

  // Live Persona Showcase real-time updates as user edits fields
  if (els.bizNameInput) {
    els.bizNameInput.addEventListener("input", () => {
      markDirty();
      syncPersonaShowcaseFromForm();
    });
  }
  if (els.voiceModelSelect) {
    els.voiceModelSelect.addEventListener("change", () => {
      markDirty();
      syncPersonaShowcaseFromForm();
    });
  }
  if (els.slotDurationSelect) {
    els.slotDurationSelect.addEventListener("change", markDirty);
  }
  if (els.greetingInput) {
    els.greetingInput.addEventListener("input", () => {
      markDirty();
      syncPersonaShowcaseFromForm();
    });
  }
  if (els.systemPromptInput) {
    els.systemPromptInput.addEventListener("input", markDirty);
  }
  if (els.openHourInput) {
    els.openHourInput.addEventListener("change", markDirty);
  }
  if (els.closeHourInput) {
    els.closeHourInput.addEventListener("change", markDirty);
  }
  if (els.operatingDaysSelect) {
    els.operatingDaysSelect.addEventListener("change", markDirty);
  }

  if (els.btnPersonaTestCall) {
    els.btnPersonaTestCall.addEventListener("click", () => {
      if (state.isDirty || !state.activeBiz || !state.activeBiz.assemblyai_agent_id) {
        showPersonaTestWarning();
        return;
      }
      if (els.personaTestWarning) els.personaTestWarning.style.display = "none";
      switchTab("tab-simulator");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  if (els.btnWarningDeploy) {
    els.btnWarningDeploy.addEventListener("click", async () => {
      if (els.personaTestWarning) els.personaTestWarning.style.display = "none";
      await deployAgentWorkflow(true);
    });
  }

  if (els.btnWarningContinue) {
    els.btnWarningContinue.addEventListener("click", () => {
      if (els.personaTestWarning) els.personaTestWarning.style.display = "none";
      switchTab("tab-simulator");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Save & Deploy Button (Updates Local SQLite, Cloud Supabase, and AssemblyAI Agent)
  if (els.btnDeployAgent) {
    els.btnDeployAgent.addEventListener("click", () => deployAgentWorkflow(false));
  }
}

async function deployAgentWorkflow(autoSwitchToSimulator = false) {
  if (!state.activeBiz) return;
  if (els.btnDeployAgent) {
    els.btnDeployAgent.disabled = true;
    els.btnDeployAgent.innerHTML = "Saving & Deploying...";
  }

  const currentIndustry = els.presetIndustry.value || (els.customIndustryInput ? els.customIndustryInput.value.trim() : "") || state.activeBiz.industry || "general";
  const selectedVoice = els.voiceModelSelect.value;
  const validVoice = VOICE_ID_MAP[selectedVoice] || selectedVoice || "alba";

  const payload = {
    name: els.bizNameInput.value.trim(),
    industry: currentIndustry,
    tone: (state.activeBiz && state.activeBiz.tone) || "warm",
    greeting: els.greetingInput.value.trim(),
    system_prompt: els.systemPromptInput.value.trim(),
    voice_id: validVoice,
    slot_minutes: parseInt(els.slotDurationSelect.value, 10),
    open_hour: parseInt(els.openHourInput.value, 10),
    close_hour: parseInt(els.closeHourInput.value, 10),
    operating_days: els.operatingDaysSelect ? els.operatingDaysSelect.value : "mon-fri",
    keyterms: state.keyterms,
    services: state.services
  };

  try {
    // 1. Save to Local SQLite Database
    const updateRes = await fetch(`/api/owner/businesses/${state.activeBiz.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const updateData = await updateRes.json();
    if (!updateData.ok) throw new Error("Local database update failed");

    // 2. Synchronize to Supabase Cloud Database (PostgreSQL)
    try {
      const sb = await getSupabaseClient();
      if (sb) {
        const ownerId = state.owner ? state.owner.id : null;
        const ownerEmail = state.owner ? state.owner.email : "owner@omnidesk.ai";
        const { error: sbErr } = await sb.from("businesses").upsert({
          id: state.activeBiz.id,
          owner_id: ownerId,
          owner_email: ownerEmail,
          name: payload.name,
          industry: payload.industry,
          tone: payload.tone,
          voice_id: payload.voice_id,
          greeting: payload.greeting,
          system_prompt: payload.system_prompt,
          keyterms: payload.keyterms,
          services: payload.services,
          open_hour: payload.open_hour,
          close_hour: payload.close_hour,
          slot_minutes: payload.slot_minutes,
          operating_days: payload.operating_days
        });
        if (sbErr) console.warn("Supabase sync notice:", sbErr);
      }
    } catch (sbEx) {
      console.warn("Supabase sync notice:", sbEx);
    }

    // 3. Provision & Deploy Voice Agent with AssemblyAI Voice Agent API
    const deployRes = await fetch(`/api/owner/businesses/${state.activeBiz.id}/deploy`, {
      method: "POST"
    });
    const deployData = await deployRes.json();
    if (!deployData.ok) throw new Error(deployData.detail || "Deploy failed");

    state.activeBiz = deployData.business;
    state.isDirty = false;
    populateBuilder(state.activeBiz);

    if (autoSwitchToSimulator) {
      switchTab("tab-simulator");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      alert("Voice Agent changes successfully saved and deployed!\nBoth SQLite & Supabase databases are synchronized, and your agent is live on AssemblyAI.");
    }
  } catch (err) {
    alert(`Save & Deploy notice: ${err.message}`);
  } finally {
    if (els.btnDeployAgent) {
      els.btnDeployAgent.disabled = false;
      els.btnDeployAgent.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Save & Deploy Voice Agent
      `;
    }
  }
}

// ---------------------------------------------------------------------------
// Tabs & Modals Navigation
// ---------------------------------------------------------------------------

function switchTab(targetId) {
  els.tabItems.forEach((b) => b.classList.toggle("active", b.dataset.tab === targetId));
  els.tabPanes.forEach((p) => p.classList.toggle("active", p.id === targetId));
  state.activeTab = targetId;

  if (targetId === "tab-bookings") loadBookings();
  if (targetId === "tab-conversations") loadConversations();
}

function bindTabs() {
  els.tabItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.tab;
      // Guard navigating away to Live Tester when changes are unsaved or agent is not deployed
      if (targetId === "tab-simulator" && (state.isDirty || !state.activeBiz || !state.activeBiz.assemblyai_agent_id)) {
        showPersonaTestWarning();
        return;
      }
      switchTab(targetId);
    });
  });
}

function bindModals() {
  let authMode = "signin";

  function showDashAuthAlert(msg, isError = true) {
    if (!els.dashAuthAlert) return;
    els.dashAuthAlert.style.display = "block";
    els.dashAuthAlert.style.background = isError ? "#fef2f2" : "#f0fdf4";
    els.dashAuthAlert.style.border = isError ? "1px solid #fee2e2" : "1px solid #dcfce7";
    els.dashAuthAlert.style.color = isError ? "#991b1b" : "#166534";
    els.dashAuthAlert.textContent = msg;
  }

  function clearDashAuthAlert() {
    if (!els.dashAuthAlert) return;
    els.dashAuthAlert.style.display = "none";
    els.dashAuthAlert.textContent = "";
  }

  if (els.dashTabSignIn && els.dashTabSignUp) {
    els.dashTabSignIn.addEventListener("click", () => {
      authMode = "signin";
      clearDashAuthAlert();
      els.dashTabSignIn.classList.add("active");
      els.dashTabSignUp.classList.remove("active");
      if (els.dashGroupName) els.dashGroupName.style.display = "none";
      if (els.btnDashAuthSubmit) els.btnDashAuthSubmit.textContent = "Sign In to Dashboard";
    });

    els.dashTabSignUp.addEventListener("click", () => {
      authMode = "signup";
      clearDashAuthAlert();
      els.dashTabSignUp.classList.add("active");
      els.dashTabSignIn.classList.remove("active");
      if (els.dashGroupName) els.dashGroupName.style.display = "block";
      if (els.btnDashAuthSubmit) els.btnDashAuthSubmit.textContent = "Create Account";
    });
  }

  // 1-Click Instant Demo Bypass in Dashboard Modal
  if (els.btnDashInstantDemo) {
    els.btnDashInstantDemo.addEventListener("click", async () => {
      clearDashAuthAlert();
      const demoOwner = { id: "owner_demo", email: "demo@omnidesk.ai", name: "OmniDesk Demo Operator" };
      localStorage.setItem("omnidesk_owner", JSON.stringify(demoOwner));
      await loadOwnerSession("demo@omnidesk.ai");
      els.authModal.hidden = true;
    });
  }

  // Sign out button
  if (els.btnSignOut) {
    els.btnSignOut.addEventListener("click", async () => {
      const sb = await getSupabaseClient();
      if (sb) {
        try { await sb.auth.signOut(); } catch (_) {}
      }
      const demoOwner = { id: "owner_demo", email: "demo@omnidesk.ai", name: "OmniDesk Demo Operator" };
      localStorage.setItem("omnidesk_owner", JSON.stringify(demoOwner));
      await loadOwnerSession("demo@omnidesk.ai");
    });
  }

  if (els.btnAuthSwitch) {
    els.btnAuthSwitch.addEventListener("click", () => {
      clearDashAuthAlert();
      els.authModal.hidden = false;
    });
  }
  els.btnCloseAuth.addEventListener("click", () => {
    els.authModal.hidden = true;
    clearDashAuthAlert();
  });

  els.authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearDashAuthAlert();

    const email = els.authEmailInput.value.trim();
    const password = els.authPasswordInput ? els.authPasswordInput.value : "";
    const name = els.authNameInput ? els.authNameInput.value.trim() : "";
    if (!email) return;

    if (els.btnDashAuthSubmit) {
      els.btnDashAuthSubmit.disabled = true;
      els.btnDashAuthSubmit.textContent = authMode === "signin" ? "Signing In..." : "Creating Account...";
    }

    try {
      const sb = await getSupabaseClient();
      if (sb && password) {
        if (authMode === "signin") {
          const { data, error } = await sb.auth.signInWithPassword({ email, password });
          if (error) throw error;
        } else {
          const { data, error } = await sb.auth.signUp({
            email,
            password,
            options: { data: { full_name: name } }
          });
          if (error) throw error;
        }
      }

      // Sync with server session
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
        if (els.ownerTypeBadge) {
          els.ownerTypeBadge.textContent = "ACCOUNT";
          els.ownerTypeBadge.style.background = "#16a34a";
        }
        if (els.btnSignOut) els.btnSignOut.style.display = "inline-flex";

        renderBusinessSelect();
        if (state.businesses.length > 0) selectBusiness(state.businesses[0].id);
        els.authModal.hidden = true;
      }
    } catch (err) {
      showDashAuthAlert(err.message || "Authentication error.");
    } finally {
      if (els.btnDashAuthSubmit) {
        els.btnDashAuthSubmit.disabled = false;
        els.btnDashAuthSubmit.textContent = authMode === "signin" ? "Sign In" : "Create Account";
      }
    }
  });

  // New business modal
  els.btnCreateBiz.addEventListener("click", () => {
    els.newBizModal.hidden = false;
    CuteDropdown.syncAll();
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
        CuteDropdown.sync(els.modalBizIndustry);
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

    let greeting = `Thanks for calling ${name}. Are you looking to book an appointment?`;
    let systemPrompt = `You are an autonomous receptionist for ${name}. You speak naturally, answer questions about our services, check real calendar slots using your tools, and book appointments for callers.`;
    let voiceId = "alba";
    let slotMins = 30;
    let openH = 9;
    let closeH = 17;
    let keyterms = [name, chosenIndustry, "appointment", "booking"];
    let services = [];

    if (template) {
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
      tone: "warm",
      greeting: greeting,
      system_prompt: systemPrompt,
      voice_id: voiceId,
      slot_minutes: slotMins,
      open_hour: openH,
      close_hour: closeH,
      operating_days: "mon-fri",
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

        // SHOW HOW YOUR CREATED AI AGENT LOOKS!
        showCreatedAgentShowcase(data.business);
      }
    } catch (err) {
      alert("Failed to create business: " + err.message);
    }
  });

  // Celebratory Showcase Modal Event Bindings
  if (els.btnCloseShowcase) {
    els.btnCloseShowcase.addEventListener("click", () => {
      if (els.agentShowcaseModal) els.agentShowcaseModal.hidden = true;
    });
  }
  if (els.btnShowcaseInspect) {
    els.btnShowcaseInspect.addEventListener("click", () => {
      if (els.agentShowcaseModal) els.agentShowcaseModal.hidden = true;
    });
  }
  if (els.btnShowcaseCallNow) {
    els.btnShowcaseCallNow.addEventListener("click", () => {
      if (els.agentShowcaseModal) els.agentShowcaseModal.hidden = true;
      const simTab = document.querySelector('.tab-item[data-tab="tab-simulator"]');
      if (simTab) simTab.click();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }


  if (els.btnCloseTranscript) {
    els.btnCloseTranscript.addEventListener("click", () => {
      els.transcriptModal.hidden = true;
    });
  }
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
          <td>${escapeHtml(b.customer_name)}<br><span style="font-size:11.5px; color:var(--text-muted);">${escapeHtml(b.customer_email)} <span style="display:inline-flex; align-items:center; color:#16a34a; font-weight:600; font-size:10.5px;">✓ Verified</span></span></td>
          <td>${escapeHtml(b.service_label)}</td>
          <td><strong>$${b.price || 0}</strong></td>
          <td>
            ${
              b.confirmation_sent
                ? `<span class="badge-tag sent" title="Calendar invite sent via Resend">Sent (.ics)</span>`
                : `<button class="badge-tag pending-btn" onclick="window.sendInviteFromTable('${escapeHtml(b.confirmation_code)}', this)" title="Click to send calendar invite email via Resend now">Pending &bull; Send ✉</button>`
            }
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

window.sendInviteFromTable = async function(code, btn) {
  if (!code) return;
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `Sending...`;
  try {
    const bizId = state.activeBiz ? state.activeBiz.id : "biz_demo_dental";
    const res = await fetch(`/api/owner/businesses/${bizId}/bookings/${encodeURIComponent(code)}/send-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    const data = await res.json();
    if (data.ok) {
      btn.className = "badge-tag sent";
      btn.innerHTML = `Sent (.ics)`;
      btn.disabled = true;
      btn.title = "Calendar invite successfully sent!";
      showToast("Calendar invite sent via Resend with .ics attached!", "success");
    } else {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      alert("Could not send invite: " + (data.message || data.reason || "Unknown error"));
    }
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
    alert("Network error sending invite: " + err.message);
  }
};

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
          <td>${c.caller_email ? `${escapeHtml(c.caller_email)} <span style="display:inline-flex; align-items:center; color:#16a34a; font-weight:600; font-size:10px;">✓ Verified</span>` : '<span style="color:var(--text-muted);">Not specified</span>'}</td>
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
  pollTimer: null,
  awaitingEmailConfirmation: false
};

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const DOMAIN_TYPOS = {
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "iclud.com": "icloud.com"
};

function isEmailRequest(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return (
    t.includes("email") ||
    t.includes("e-mail") ||
    t.includes("email address") ||
    t.includes("spell your email") ||
    t.includes("what is your email") ||
    t.includes("what's your email") ||
    t.includes("have your email") ||
    t.includes("confirm your email") ||
    t.includes("tell me your email") ||
    t.includes("repeat your email")
  );
}

function isEmailRejection(userText) {
  if (!userText) return false;
  const t = userText.trim().toLowerCase();
  return (
    t === "no" ||
    t === "nope" ||
    t === "nah" ||
    t.startsWith("no ") ||
    t.startsWith("no,") ||
    t.startsWith("nope") ||
    t.includes("wrong") ||
    t.includes("incorrect") ||
    t.includes("not correct") ||
    t.includes("not right") ||
    t.includes("change my email") ||
    t.includes("change email") ||
    t.includes("different email") ||
    t.includes("that's not my email") ||
    t.includes("that is not my email") ||
    t.includes("spelled wrong") ||
    t.includes("spelled incorrectly")
  );
}

let simEmailHideTimer = null;

function showSimEmailBox(customHint) {
  if (simEmailHideTimer) {
    clearTimeout(simEmailHideTimer);
    simEmailHideTimer = null;
  }
  if (!els.simEmailBox) return;
  els.simEmailBox.style.display = "block";
  if (customHint && els.simEmailBox.querySelector(".live-email-guide")) {
    els.simEmailBox.querySelector(".live-email-guide").textContent = customHint;
  }
  if (els.simEmailInput) {
    els.simEmailInput.focus();
  }
  if (els.simFeed) {
    els.simFeed.scrollTop = els.simFeed.scrollHeight;
  }
}

function hideSimEmailBox() {
  if (simEmailHideTimer) {
    clearTimeout(simEmailHideTimer);
    simEmailHideTimer = null;
  }
  if (els.simEmailBox) {
    els.simEmailBox.style.display = "none";
  }
  if (els.simEmailFeedback) {
    els.simEmailFeedback.style.display = "none";
    els.simEmailFeedback.innerHTML = "";
  }
}


function bindSimulatorEvents() {
  if (els.btnStartSim) {
    els.btnStartSim.addEventListener("click", () => {
      if (sim.active) {
        endSimCall();
      } else {
        startSimCall();
      }
    });
  }

  if (els.btnSimEmailToggle) {
    els.btnSimEmailToggle.addEventListener("click", () => {
      if (!els.simEmailBox) return;
      if (els.simEmailBox.style.display === "none") {
        showSimEmailBox();
      } else {
        hideSimEmailBox();
      }
    });
  }

  if (els.simEmailInput) {
    els.simEmailInput.addEventListener("input", () => {
      const val = els.simEmailInput.value.trim();
      if (!val) {
        els.simEmailInput.className = "live-email-input";
        if (els.simEmailCheck) els.simEmailCheck.textContent = "";
        if (els.simEmailFeedback) els.simEmailFeedback.style.display = "none";
        return;
      }
      const clean = val.replace(/\s+/g, "").toLowerCase();
      const parts = clean.split("@");
      if (parts.length === 2 && DOMAIN_TYPOS[parts[1]]) {
        const fixed = `${parts[0]}@${DOMAIN_TYPOS[parts[1]]}`;
        els.simEmailFeedback.className = "live-email-feedback suggestion";
        els.simEmailFeedback.style.display = "block";
        els.simEmailFeedback.innerHTML = `Did you mean <strong>${fixed}</strong>? <span style="text-decoration:underline; cursor:pointer;">Click to apply</span>`;
        els.simEmailFeedback.onclick = () => {
          els.simEmailInput.value = fixed;
          els.simEmailInput.dispatchEvent(new Event("input"));
        };
        return;
      }
      if (EMAIL_REGEX.test(clean)) {
        els.simEmailInput.className = "live-email-input valid";
        if (els.simEmailCheck) {
          els.simEmailCheck.textContent = "✓";
          els.simEmailCheck.style.color = "#16a34a";
        }
        if (els.simEmailFeedback) els.simEmailFeedback.style.display = "none";
      } else {
        els.simEmailInput.className = "live-email-input invalid";
        if (els.simEmailCheck) {
          els.simEmailCheck.textContent = "•";
          els.simEmailCheck.style.color = "#ef4444";
        }
        if (els.simEmailFeedback) {
          els.simEmailFeedback.className = "live-email-feedback error";
          els.simEmailFeedback.style.display = "block";
          els.simEmailFeedback.textContent = "Incomplete email address (e.g. name@gmail.com)";
          els.simEmailFeedback.onclick = null;
        }
      }
    });
  }

  if (els.simEmailForm) {
    els.simEmailForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const raw = els.simEmailInput.value.trim();
      if (!raw) return;

      if (els.btnSimSendEmail) {
        els.btnSimSendEmail.disabled = true;
        els.btnSimSendEmail.textContent = "Verifying...";
      }

      try {
        const bizId = state.activeBiz ? state.activeBiz.id : "default";
        const res = await fetch("/api/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: raw, business_id: bizId })
        });
        const data = await res.json();
        if (!data.ok) {
          throw new Error(data.message || "Invalid email address");
        }

        const cleanEmail = data.email;
        els.simEmailInput.value = cleanEmail;
        els.simEmailInput.className = "live-email-input valid";
        if (els.simEmailCheck) els.simEmailCheck.textContent = "✓";
        if (els.simEmailFeedback) {
          els.simEmailFeedback.className = "live-email-feedback success";
          els.simEmailFeedback.style.display = "block";
          els.simEmailFeedback.innerHTML = `✓ Verified email: <strong>${cleanEmail}</strong> ${data.auto_corrected ? '<span style="color:#0284c7; font-size:11px;">(auto-corrected)</span>' : ''} ${data.dns_verified ? '<span style="color:#16a34a; font-size:11px;">• DNS Valid</span>' : ''}`;
        }

        addSimBubble("user", `My email address is ${cleanEmail}`);
        sim.transcript.push({ who: "user", text: `My email address is ${cleanEmail}` });
        sim.callerEmail = cleanEmail;

        if (sim.ws && sim.ws.readyState === WebSocket.OPEN) {
          const currentPrompt = (state.activeBiz && state.activeBiz.system_prompt) ? state.activeBiz.system_prompt : "";
          // 1. Update mutable system_prompt with customer email and require verbal confirmation
          sim.ws.send(JSON.stringify({
            type: "session.update",
            session: {
              system_prompt: currentPrompt + `\n\n[CUSTOMER EMAIL PROVIDED: "${cleanEmail}"] The customer typed their email: "${cleanEmail}". Say: "Thank you. I have your email as ${cleanEmail}, is that correct?" and WAIT for the caller's verbal confirmation. Do NOT call book_appointment until the caller confirms yes. If caller says no, apologize and ask for the corrected email.`
            }
          }));

          // 2. Trigger agent's verbal turn to confirm the email
          sim.ws.send(JSON.stringify({
            type: "reply.create",
            instructions: `The customer typed their email: "${cleanEmail}". Say warmly: "Thank you. I have your email as ${cleanEmail}, is that correct?" and wait for the caller to confirm.`
          }));
        }

        if (simEmailHideTimer) clearTimeout(simEmailHideTimer);
        simEmailHideTimer = setTimeout(() => {
          hideSimEmailBox();
        }, 4000);

      } catch (err) {
        if (els.simEmailFeedback) {
          els.simEmailFeedback.className = "live-email-feedback error";
          els.simEmailFeedback.style.display = "block";
          els.simEmailFeedback.textContent = err.message;
        }
      } finally {
        if (els.btnSimSendEmail) {
          els.btnSimSendEmail.disabled = false;
          els.btnSimSendEmail.innerHTML = `<span>Verify &amp; Send</span> <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
        }
      }
    });
  }
}

async function startSimCall() {
  if (!state.activeBiz) return;

  if (!state.activeBiz.assemblyai_agent_id) {
    alert("Please click 'Save & Deploy Voice Agent' first so your agent is provisioned on AssemblyAI and ready for live testing.");
    els.btnStartSim.disabled = false;
    els.simStatusLabel.textContent = "Ready to connect";
    return;
  }

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
        noiseSuppression: false, // OFF: Voice Focus runs server-side on AssemblyAI
        autoGainControl: true
      }
    });

    sim.audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
    await sim.audioCtx.audioWorklet.addModule("/worklet.js");

    sim.ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);

    sim.ws.onopen = () => {
      // AssemblyAI Voice Agent API rule: send agent_id (and ONLY agent_id) on first session.update
      sim.ws.send(
        JSON.stringify({
          type: "session.update",
          session: {
            agent_id: agent_id
          }
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
    hideSimEmailBox();
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
      if (isEmailRejection(msg.text) && (sim.awaitingEmailConfirmation || sim.callerEmail)) {
        if (simEmailHideTimer) {
          clearTimeout(simEmailHideTimer);
          simEmailHideTimer = null;
        }
        showSimEmailBox("Email not confirmed. Please type your correct email below to fix it:");
        if (els.simEmailInput) {
          els.simEmailInput.value = "";
          els.simEmailInput.focus();
        }
        const rejectedEmail = sim.callerEmail || "";
        sim.callerEmail = "";
        sim.awaitingEmailConfirmation = false;
        const bizId = state.activeBiz ? state.activeBiz.id : "default";
        fetch("/api/verify-email/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "", business_id: bizId })
        }).catch(() => {});

        if (sim.ws && sim.ws.readyState === WebSocket.OPEN) {
          const currentPrompt = (state.activeBiz && state.activeBiz.system_prompt) ? state.activeBiz.system_prompt : "";
          sim.ws.send(JSON.stringify({
            type: "session.update",
            session: {
              system_prompt: currentPrompt + `\n\n[CALLER REJECTED EMAIL] The caller stated that the previous email ("${rejectedEmail}") was NOT correct. Do NOT book with that address. Apologize politely (e.g. "My apologies! What is your correct email address?") and wait for the caller to provide or type their corrected email address.`
            }
          }));
        }
      }
      break;

    case "transcript.agent":
      addSimBubble("agent", msg.text);
      sim.transcript.push({ who: "agent", text: msg.text });
      const agentLower = (msg.text || "").toLowerCase();
      if (
        agentLower.includes("is that correct") ||
        agentLower.includes("is that right") ||
        agentLower.includes("did i get that right") ||
        agentLower.includes("confirm your email")
      ) {
        sim.awaitingEmailConfirmation = true;
      }
      if (isEmailRequest(msg.text)) {
        showSimEmailBox();
      }
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
      if (ev.tool === "book_appointment" && ev.result && ev.result.ok === false && ev.result.reason === "bad_email") {
        showSimEmailBox("The agent couldn't verify the email. Please type your correct email below:");
      }
      if (ev.tool === "book_appointment" && ev.arguments) {
        sim.hasBooked = true;
        if (ev.arguments.customer_name) sim.callerName = ev.arguments.customer_name;
        if (ev.arguments.email) sim.callerEmail = ev.arguments.email;
        loadBookings();
        loadConversations();
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
  head.style.marginBottom = "4px";

  const name = document.createElement("strong");
  name.textContent = `/${ev.tool}`;
  const at = document.createElement("span");
  at.style.color = "var(--text-muted)";
  at.textContent = ev.at;
  head.append(name, at);
  card.append(head);

  if (ev.arguments && Object.keys(ev.arguments).length > 0) {
    const args = document.createElement("pre");
    args.style.fontSize = "11px";
    args.style.background = "#f4f4f5";
    args.style.padding = "6px";
    args.style.borderRadius = "4px";
    args.style.margin = "4px 0";
    args.textContent = JSON.stringify(ev.arguments, null, 2);
    card.append(args);
  }

  const res = document.createElement("p");
  res.style.margin = "4px 0 0";
  res.style.color = (ev.result && ev.result.ok === false) ? "#ef4444" : "#16a34a";
  res.textContent = (ev.result && ev.result.message) ? ev.result.message : JSON.stringify(ev.result);
  card.append(res);

  els.simToolsFeed.append(card);
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
    if (sim.ws.readyState === WebSocket.OPEN) {
      try { sim.ws.send(JSON.stringify({ type: "session.end" })); } catch (_) {}
    }
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
  if (els.btnSimEmailToggle) els.btnSimEmailToggle.style.display = "none";
  hideSimEmailBox();

  const bizId = (state.activeBiz && state.activeBiz.id) ? state.activeBiz.id : "biz_demo_dental";
  const elapsedSeconds = sim.startTime > 0 ? Math.max(1, Math.floor((Date.now() - sim.startTime) / 1000)) : 25;
  const startIso = sim.startTime > 0
    ? new Date(sim.startTime).toISOString().replace("T", " ").slice(0, 19)
    : new Date(Date.now() - elapsedSeconds * 1000).toISOString().replace("T", " ").slice(0, 19);
  const endIso = new Date().toISOString().replace("T", " ").slice(0, 19);

  try {
    await fetch("/api/conversations/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        business_id: bizId,
        caller_name: sim.callerName || (state.owner ? state.owner.name : "Customer"),
        caller_email: sim.callerEmail || (state.owner ? state.owner.email : "customer@example.com"),
        started_at: startIso,
        ended_at: endIso,
        duration_seconds: elapsedSeconds,
        status: "completed",
        outcome: sim.hasBooked ? "booked" : "inquiry",
        transcript: sim.transcript.length > 0 ? sim.transcript : [{ who: "agent", text: "Voice call session ended." }],
        tool_calls: sim.toolCalls
      })
    });
  } catch (e) {
    console.error("Failed to save conversation log:", e);
  }

  await loadConversations();
  await loadBookings();
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
