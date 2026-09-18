"use client";

import Link from "next/link";
import { VoiceWidget } from "@/components/voice-widget";
import { Sparkles, Clock, MapPin, Phone, Calendar, ArrowLeft, Star, CheckCircle2 } from "lucide-react";

export default function SalonDemoPage() {
  return (
    <div className="min-h-screen bg-[#0d0f12] text-[#f4f4f5] font-sans antialiased selection:bg-emerald-500 selection:text-black">
      {/* Top Demo Bar */}
      <div className="sticky top-0 z-40 bg-[#12151b]/90 backdrop-blur-md border-b border-white/10 px-4 py-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/demo"
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Demo Hub
          </Link>
          <span className="text-zinc-600">|</span>
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
            Live Client Showcase: Hair Salon
          </span>
        </div>
        <div className="text-zinc-400 hidden sm:block">
          Notice the floating <span className="text-emerald-400 font-semibold">OmniDesk Voice Widget</span> in the bottom right corner &rarr;
        </div>
      </div>

      {/* Navigation */}
      <header className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-300 flex items-center justify-center text-black font-serif font-bold text-lg shadow-lg shadow-emerald-500/20">
            L
          </div>
          <div>
            <div className="font-serif font-bold text-xl tracking-tight text-white">
              LUXE & MANE
            </div>
            <div className="text-[10px] tracking-widest text-emerald-400 uppercase font-medium">
              Hair Studio & Color Lounge
            </div>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm text-zinc-300 font-medium">
          <a href="#services" className="hover:text-emerald-400 transition-colors">Services</a>
          <a href="#stylists" className="hover:text-emerald-400 transition-colors">Stylists</a>
          <a href="#philosophy" className="hover:text-emerald-400 transition-colors">About</a>
          <a href="#reviews" className="hover:text-emerald-400 transition-colors">Reviews</a>
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            AI Receptionist Online
          </span>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-6 pt-12 pb-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Award-Winning Beverly Hills Salon</span>
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-light tracking-tight leading-[1.08] text-white">
            Effortless beauty, <br />
            <span className="italic font-serif bg-gradient-to-r from-emerald-300 via-teal-200 to-white bg-clip-text text-transparent">
              tailored to you.
            </span>
          </h1>

          <p className="text-lg text-zinc-300 max-w-xl leading-relaxed font-light">
            Experience bespoke cuts, artisan hand-painted balayage, and restorative keratin therapies. Our 24/7 autonomous voice receptionist is always ready to check schedule availability and book your visit instantly.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> No wait times
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Instant calendar sync
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Automated .ics invites
              </span>
            </div>
          </div>
        </div>

        {/* Hero Card Visual */}
        <div className="lg:col-span-5 relative">
          <div className="relative rounded-3xl p-8 bg-gradient-to-b from-[#181c24] to-[#12151b] border border-white/10 shadow-2xl shadow-emerald-500/5">
            <div className="absolute -top-3 right-6 bg-emerald-500 text-black font-bold text-xs px-3 py-1 rounded-full shadow-lg">
              VOICE INTEGRATED
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-2xl">
                  ✂️
                </div>
                <div>
                  <h3 className="font-serif font-bold text-xl text-white">Luxe & Mane Studio</h3>
                  <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" /> 450 N Canon Dr, Beverly Hills, CA
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 py-2">
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <div className="text-xs text-zinc-400 flex items-center gap-1.5 mb-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" /> Opening Hours
                  </div>
                  <div className="font-semibold text-sm text-white">9:00 AM – 5:00 PM</div>
                  <div className="text-[11px] text-emerald-400">Monday through Friday</div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <div className="text-xs text-zinc-400 flex items-center gap-1.5 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Slot Length
                  </div>
                  <div className="font-semibold text-sm text-white">30 – 120 Minutes</div>
                  <div className="text-[11px] text-zinc-400">Custom tailored</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-zinc-300 flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping flex-shrink-0" />
                <span>
                  <strong>Tip:</strong> Click the voice receptionist widget at the bottom right to schedule an appointment via voice right now!
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Menu Section */}
      <section id="services" className="max-w-7xl mx-auto px-6 py-16 border-t border-white/10">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
          <div className="text-xs font-semibold tracking-wider text-emerald-400 uppercase">
            Signature Treatments
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-light text-white">
            Curated Services & Pricing
          </h2>
          <p className="text-sm text-zinc-400">
            All services can be booked instantly through our autonomous voice assistant.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-emerald-500/40 transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-serif font-bold text-lg text-white group-hover:text-emerald-300 transition-colors">
                  Signature Haircut & Styling
                </h3>
                <div className="text-xs text-zinc-400 mt-1">45 Minutes</div>
              </div>
              <div className="text-2xl font-serif font-bold text-emerald-400">$85</div>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Custom consultation, precision cut, wash, and our signature luxury botanical blowout.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-emerald-500/40 transition-all group relative">
            <div className="absolute -top-2.5 right-6 bg-emerald-500 text-black text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              MOST POPULAR
            </div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-serif font-bold text-lg text-white group-hover:text-emerald-300 transition-colors">
                  Artisan Balayage & Highlights
                </h3>
                <div className="text-xs text-zinc-400 mt-1">120 Minutes</div>
              </div>
              <div className="text-2xl font-serif font-bold text-emerald-400">$280</div>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Hand-painted dimensional highlights, bespoke toner formulation, and bond-building finish.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-emerald-500/40 transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-serif font-bold text-lg text-white group-hover:text-emerald-300 transition-colors">
                  Keratin Smoothing Therapy
                </h3>
                <div className="text-xs text-zinc-400 mt-1">120 Minutes</div>
              </div>
              <div className="text-2xl font-serif font-bold text-emerald-400">$250</div>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Deep conditioning and frizz-free sealing therapy that maintains silky smoothness for up to 5 months.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10 text-center text-xs text-zinc-500">
        <p>&copy; 2026 Luxe & Mane Hair Studio. Powered by OmniDesk & AssemblyAI Voice Agents.</p>
      </footer>

      {/* Live Voice Widget Embedded */}
      <VoiceWidget
        businessId="biz_demo_dental"
        theme="dark"
        accent="emerald"
        position="bottom-right"
        label="Book Appointment"
      />
    </div>
  );
}
