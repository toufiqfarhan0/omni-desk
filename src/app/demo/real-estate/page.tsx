"use client";

import Link from "next/link";
import { VoiceWidget } from "@/components/voice-widget";
import { Building2, Compass, ShieldCheck, ArrowLeft, BedDouble, Bath, Maximize2, Calendar, Clock } from "lucide-react";

export default function RealEstateDemoPage() {
  return (
    <div className="min-h-screen bg-[#080b11] text-[#f1f5f9] font-sans antialiased selection:bg-blue-500 selection:text-white">
      {/* Top Demo Bar */}
      <div className="sticky top-0 z-40 bg-[#0d121d]/90 backdrop-blur-md border-b border-blue-500/10 px-4 py-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/demo"
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Demo Hub
          </Link>
          <span className="text-zinc-600">|</span>
          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-semibold">
            Live Client Showcase: Luxury Real Estate
          </span>
        </div>
        <div className="text-zinc-400 hidden sm:block">
          Notice the floating <span className="text-blue-400 font-semibold">OmniDesk Voice Widget</span> in the bottom right corner &rarr;
        </div>
      </div>

      {/* Navigation */}
      <header className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-400 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/20">
            A
          </div>
          <div>
            <div className="font-bold text-xl tracking-tight text-white uppercase">
              APEX ESTATES
            </div>
            <div className="text-[10px] tracking-widest text-blue-400 uppercase font-medium">
              Private Property Advisory
            </div>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm text-zinc-300 font-medium">
          <a href="#estates" className="hover:text-blue-400 transition-colors">Exclusive Portfolios</a>
          <a href="#services" className="hover:text-blue-400 transition-colors">Private Advisory</a>
          <a href="#advisors" className="hover:text-blue-400 transition-colors">Advisors</a>
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            Concierge Voice AI Active
          </span>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-6 pt-12 pb-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Prime Coastal & Skyline Portfolios</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-light tracking-tight leading-[1.08] text-white">
            Curated estates for the <br />
            <span className="font-semibold bg-gradient-to-r from-blue-400 via-indigo-300 to-white bg-clip-text text-transparent">
              discerning few.
            </span>
          </h1>

          <p className="text-lg text-zinc-300 max-w-xl leading-relaxed font-light">
            Access off-market residential acquisitions and architectural sanctuaries. Schedule confidential walkthroughs and buyer consultations with our 24/7 AI voice concierge.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <span className="flex items-center gap-1">
                <Compass className="w-4 h-4 text-blue-400" /> Private viewings
              </span>
              <span className="flex items-center gap-1">
                <Building2 className="w-4 h-4 text-blue-400" /> Off-market access
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4 text-blue-400" /> Direct calendar confirmation
              </span>
            </div>
          </div>
        </div>

        {/* Hero Card Visual */}
        <div className="lg:col-span-5 relative">
          <div className="relative rounded-3xl p-8 bg-gradient-to-b from-[#111726] to-[#0c101a] border border-blue-500/20 shadow-2xl shadow-blue-500/10">
            <div className="absolute -top-3 right-6 bg-blue-600 text-white font-bold text-xs px-3 py-1 rounded-full shadow-lg">
              VOICE ACTIVE
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>
                </div>
                <div>
                  <h3 className="font-bold text-xl text-white">Apex Advisory Desk</h3>
                  <div className="text-xs text-zinc-400 mt-1">
                    Direct Liaison for Private Showings & Acquisitions
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 py-2">
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <div className="text-xs text-zinc-400 flex items-center gap-1.5 mb-1">
                    <Clock className="w-3.5 h-3.5 text-blue-400" /> Viewing Hours
                  </div>
                  <div className="font-semibold text-sm text-white">10:00 AM – 6:00 PM</div>
                  <div className="text-[11px] text-blue-400">Tuesday through Saturday</div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <div className="text-xs text-zinc-400 flex items-center gap-1.5 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" /> Consultation
                  </div>
                  <div className="font-semibold text-sm text-white">60 Minutes</div>
                  <div className="text-[11px] text-zinc-400">Buyer or Seller Briefing</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-zinc-300 flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-blue-400 animate-ping flex-shrink-0" />
                <span>
                  <strong>Tip:</strong> Click the voice receptionist widget at the bottom right to request a viewing tour or ask about our portfolio.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Properties Section */}
      <section id="estates" className="max-w-7xl mx-auto px-6 py-16 border-t border-white/10">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
          <div className="text-xs font-semibold tracking-wider text-blue-400 uppercase">
            Exclusive Listings
          </div>
          <h2 className="text-3xl sm:text-4xl font-light text-white">
            Featured Architectural Estates
          </h2>
          <p className="text-sm text-zinc-400">
            Inquire directly by voice to book a private tour on our real-time calendar.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl bg-white/[0.02] border border-white/10 overflow-hidden hover:border-blue-500/40 transition-all group">
            <div className="p-6">
              <div className="text-xs font-semibold text-blue-400 mb-2">SKYLINE COLLECTION</div>
              <h3 className="font-bold text-lg text-white group-hover:text-blue-300 transition-colors">
                The Luminary Glass Penthouse
              </h3>
              <div className="text-2xl font-bold text-white mt-3">$3,850,000</div>
              <div className="flex items-center gap-4 text-xs text-zinc-400 mt-4 pt-4 border-t border-white/5">
                <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" /> 3 Beds</span>
                <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" /> 4 Baths</span>
                <span className="flex items-center gap-1"><Maximize2 className="w-3.5 h-3.5" /> 3,600 sq ft</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.02] border border-white/10 overflow-hidden hover:border-blue-500/40 transition-all group relative">
            <div className="p-6">
              <div className="text-xs font-semibold text-blue-400 mb-2">OFF-MARKET EXCLUSIVE</div>
              <h3 className="font-bold text-lg text-white group-hover:text-blue-300 transition-colors">
                Bel-Air Modern Architectural Villa
              </h3>
              <div className="text-2xl font-bold text-white mt-3">$5,400,000</div>
              <div className="flex items-center gap-4 text-xs text-zinc-400 mt-4 pt-4 border-t border-white/5">
                <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" /> 5 Beds</span>
                <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" /> 6 Baths</span>
                <span className="flex items-center gap-1"><Maximize2 className="w-3.5 h-3.5" /> 6,200 sq ft</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.02] border border-white/10 overflow-hidden hover:border-blue-500/40 transition-all group">
            <div className="p-6">
              <div className="text-xs font-semibold text-blue-400 mb-2">WATERFRONT PORTFOLIO</div>
              <h3 className="font-bold text-lg text-white group-hover:text-blue-300 transition-colors">
                Newport Coastal Sanctuary
              </h3>
              <div className="text-2xl font-bold text-white mt-3">$2,950,000</div>
              <div className="flex items-center gap-4 text-xs text-zinc-400 mt-4 pt-4 border-t border-white/5">
                <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" /> 4 Beds</span>
                <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" /> 4 Baths</span>
                <span className="flex items-center gap-1"><Maximize2 className="w-3.5 h-3.5" /> 4,100 sq ft</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10 text-center text-xs text-zinc-500">
        <p>&copy; 2026 Apex Luxury Property Advisory. Powered by OmniDesk & AssemblyAI Voice Agents.</p>
      </footer>

      {/* Live Voice Widget Embedded */}
      <VoiceWidget
        businessId="biz_demo_realestate"
        theme="dark"
        accent="blue"
        position="bottom-right"
        label="Schedule Private Tour"
      />
    </div>
  );
}
