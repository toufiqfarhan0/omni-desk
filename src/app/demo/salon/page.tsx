"use client";

import Link from "next/link";
import { VoiceWidget } from "@/components/voice-widget";
import { Sparkles, Clock, MapPin, Calendar, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function SalonDemoPage() {
  return (
    <div className="min-h-screen bg-[#fafaf9] text-zinc-900 font-sans antialiased selection:bg-emerald-600 selection:text-white">
      {/* Top Demo Bar */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-200 px-4 py-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/demo"
            className="flex items-center gap-1.5 text-zinc-600 hover:text-zinc-900 transition-colors font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Demo Hub
          </Link>
          <span className="text-zinc-300">|</span>
          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2.5 py-0.5 rounded-full font-semibold">
            Live Client Showcase: Hair Salon
          </span>
        </div>
        <div className="text-zinc-500 hidden sm:block">
          Notice the floating <span className="text-emerald-700 font-semibold">OmniDesk Voice Widget</span> in the bottom right corner &rarr;
        </div>
      </div>

      {/* Navigation */}
      <header className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white font-serif font-bold text-lg shadow-md shadow-emerald-500/20">
            L
          </div>
          <div>
            <div className="font-serif font-bold text-xl tracking-tight text-zinc-950">
              LUXE & MANE
            </div>
            <div className="text-[10px] tracking-widest text-emerald-700 uppercase font-semibold">
              Hair Studio & Color Lounge
            </div>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm text-zinc-600 font-medium">
          <a href="#services" className="hover:text-emerald-700 transition-colors">Services</a>
          <a href="#stylists" className="hover:text-emerald-700 transition-colors">Stylists</a>
          <a href="#philosophy" className="hover:text-emerald-700 transition-colors">About</a>
          <a href="#reviews" className="hover:text-emerald-700 transition-colors">Reviews</a>
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 font-medium shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            AI Receptionist Online
          </span>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-6 pt-12 pb-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Award-Winning Beverly Hills Salon</span>
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-light tracking-tight leading-[1.08] text-zinc-950">
            Effortless beauty, <br />
            <span className="italic font-serif bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-900 bg-clip-text text-transparent">
              tailored to you.
            </span>
          </h1>

          <p className="text-lg text-zinc-600 max-w-xl leading-relaxed font-normal">
            Experience bespoke cuts, artisan hand-painted balayage, and restorative keratin therapies. Our 24/7 autonomous voice receptionist is always ready to check schedule availability and book your visit instantly.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 text-xs text-zinc-600 font-medium">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> No wait times
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Instant calendar sync
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Automated .ics invites
              </span>
            </div>
          </div>
        </div>

        {/* Hero Card Visual */}
        <div className="lg:col-span-5 relative">
          <div className="relative rounded-3xl p-8 bg-white border border-zinc-200 shadow-xl shadow-zinc-950/5">
            <div className="absolute -top-3 right-6 bg-emerald-600 text-white font-bold text-xs px-3.5 py-1 rounded-full shadow-md">
              VOICE INTEGRATED
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="6" cy="6" r="3"/>
                    <circle cx="6" cy="18" r="3"/>
                    <line x1="20" x2="8.12" y1="4" y2="15.88"/>
                    <line x1="14.47" x2="20" y1="14.48" y2="20"/>
                    <line x1="8.12" x2="12" y1="8.12" y2="12"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-serif font-bold text-xl text-zinc-950">Luxe & Mane Studio</h3>
                  <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" /> 450 N Canon Dr, Beverly Hills, CA
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 py-2">
                <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80">
                  <div className="text-xs text-zinc-500 flex items-center gap-1.5 mb-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" /> Opening Hours
                  </div>
                  <div className="font-semibold text-sm text-zinc-950">9:00 AM – 5:00 PM</div>
                  <div className="text-[11px] text-emerald-700 font-medium">Monday through Friday</div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80">
                  <div className="text-xs text-zinc-500 flex items-center gap-1.5 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Slot Length
                  </div>
                  <div className="font-semibold text-sm text-zinc-950">30 – 120 Minutes</div>
                  <div className="text-[11px] text-zinc-500">Custom tailored</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping flex-shrink-0" />
                <span>
                  <strong>Tip:</strong> Click the voice receptionist widget at the bottom right to schedule an appointment via voice right now!
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Menu Section */}
      <section id="services" className="max-w-7xl mx-auto px-6 py-16 border-t border-zinc-200">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
          <div className="text-xs font-semibold tracking-wider text-emerald-700 uppercase">
            Signature Treatments
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-light text-zinc-950">
            Curated Services & Pricing
          </h2>
          <p className="text-sm text-zinc-500">
            All services can be booked instantly through our autonomous voice assistant.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white border border-zinc-200 shadow-sm hover:border-emerald-500 hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-serif font-bold text-lg text-zinc-950 group-hover:text-emerald-700 transition-colors">
                  Signature Haircut & Styling
                </h3>
                <div className="text-xs text-zinc-500 mt-1">45 Minutes</div>
              </div>
              <div className="text-2xl font-serif font-bold text-emerald-700">$85</div>
            </div>
            <p className="text-sm text-zinc-600 leading-relaxed">
              Custom consultation, precision cut, wash, and our signature luxury botanical blowout.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-zinc-200 shadow-sm hover:border-emerald-500 hover:shadow-md transition-all group relative">
            <div className="absolute -top-2.5 right-6 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
              MOST POPULAR
            </div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-serif font-bold text-lg text-zinc-950 group-hover:text-emerald-700 transition-colors">
                  Artisan Balayage & Highlights
                </h3>
                <div className="text-xs text-zinc-500 mt-1">120 Minutes</div>
              </div>
              <div className="text-2xl font-serif font-bold text-emerald-700">$280</div>
            </div>
            <p className="text-sm text-zinc-600 leading-relaxed">
              Hand-painted dimensional highlights, bespoke toner formulation, and bond-building finish.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-zinc-200 shadow-sm hover:border-emerald-500 hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-serif font-bold text-lg text-zinc-950 group-hover:text-emerald-700 transition-colors">
                  Keratin Smoothing Therapy
                </h3>
                <div className="text-xs text-zinc-500 mt-1">120 Minutes</div>
              </div>
              <div className="text-2xl font-serif font-bold text-emerald-700">$250</div>
            </div>
            <p className="text-sm text-zinc-600 leading-relaxed">
              Deep conditioning and frizz-free sealing therapy that maintains silky smoothness for up to 5 months.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-10 text-center text-xs text-zinc-500 bg-white">
        <p>&copy; 2026 Luxe & Mane Hair Studio. Powered by OmniDesk & AssemblyAI Voice Agents.</p>
      </footer>

      {/* Live Voice Widget Embedded */}
      <VoiceWidget
        businessId="biz_demo_dental"
        theme="light"
        accent="emerald"
        position="bottom-right"
        label="Talk to Receptionist"
        businessName="Luxe & Mane Hair Studio"
      />
    </div>
  );
}
