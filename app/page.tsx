"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/features/auth/services/authService";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Stethoscope,
  Users,
  GraduationCap,
  MessageSquare,
  BarChart3,
  HeartHandshake,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Send,
  Mic,
  BrainCircuit,
  Lock,
  Play,
  Quote,
  Info,
} from "lucide-react";

// Verified Student Testimonials from 2025 pilot evaluation of an earlier VEWAI version
const TESTIMONIALS = [
  {
    id: 1,
    quote: "Awesome tool, user friendly and engaging.",
    value: "User Experience",
    author: "Veterinary Student",
    affiliation: "University of Nottingham | 2025 Pilot Study",
  },
  {
    id: 2,
    quote: "I liked getting more information as you go along like in a real life case and that you had to ask specific questions in order to get the full picture.",
    value: "Clinical Reasoning",
    author: "Veterinary Student",
    affiliation: "University of Nottingham | 2025 Pilot Study",
  },
  {
    id: 3,
    quote: "Towards the end of the case I felt I was able to engage with it more and treat it as if it were a real scenario.",
    value: "Clinical Realism",
    author: "Veterinary Student",
    affiliation: "University of Nottingham | 2025 Pilot Study",
  },
  {
    id: 4,
    quote: "Really enjoyed using this and would use it again! The feedback was useful too.",
    value: "Engagement & Feedback",
    author: "Veterinary Student",
    affiliation: "University of Nottingham | 2025 Pilot Study",
  },
  {
    id: 5,
    quote: "This is a very interesting and beneficial use of AI and I feel it could be a very effective revision method for future vet students.",
    value: "Educational Value",
    author: "Veterinary Student",
    affiliation: "University of Nottingham | 2025 Pilot Study",
  },
  {
    id: 6,
    quote: "Overall really engaging and a good way to go through a case and get me thinking about on farm scenarios.",
    value: "Application of Knowledge",
    author: "Veterinary Student",
    affiliation: "University of Nottingham | 2025 Pilot Study",
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [whoWeAreDropdownOpen, setWhoWeAreDropdownOpen] = useState(false);
  const [mockupTab, setMockupTab] = useState<"video" | "dialogue">("video");

  // Testimonials carousel state (strictly manual navigation)
  const [testimonialIndex, setTestimonialIndex] = useState(0);

  // Founders detailed CV expansion state
  const [expandedMarco, setExpandedMarco] = useState(false);
  const [expandedIgnacio, setExpandedIgnacio] = useState(false);

  const nextTestimonial = () => {
    setTestimonialIndex((prev) => (prev + 1) % TESTIMONIALS.length);
  };
  const prevTestimonial = () => {
    setTestimonialIndex((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
  };

  // Form state
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    institution: "",
    role: "Faculty / Educator",
    email: "",
    message: "",
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
  };

  const navLinks = [
    { name: "The Challenge", href: "#challenge" },
    { name: "How VEWAI Works", href: "#solution" },
    { name: "Educator Insights", href: "#insights" },
    { name: "Student Feedback", href: "#testimonials" },
    { name: "Our Ethos", href: "#ethos" },
    { name: "Leadership & Team", href: "#team" },
    { name: "Privacy", href: "#privacy" },
    { name: "Register Interest", href: "#contact" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f2fbf7] via-[#f7fdfa] to-[#eef9f4] text-slate-900 selection:bg-emerald-200 selection:text-emerald-950 font-sans pt-20">
      {/* ─────────────────────────────────────────────────────────────
          LOCKED TOP NAVIGATION BAR
      ────────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-emerald-100 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="container mx-auto flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Logo - Official VEWAI™ with Tagline */}
          <Link href="/" className="flex items-center group py-1" title="VEWAI™ - Veterinary Education with AI">
            <div className="relative h-10 w-48 sm:h-12 sm:w-56 transition-transform duration-300 group-hover:scale-[1.02]">
              <Image
                src="/images/logo-full.png"
                alt="VEWAI™ - Vet Education with AI"
                width={1024}
                height={278}
                className="h-full w-auto object-contain object-left"
                priority
              />
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1.5 lg:gap-3">
            {/* Tab 1: Who We Are (Dropdown) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setWhoWeAreDropdownOpen(!whoWeAreDropdownOpen)}
                onBlur={() => setTimeout(() => setWhoWeAreDropdownOpen(false), 200)}
                className="flex items-center gap-1 px-3 py-2 text-sm font-semibold text-slate-700 hover:text-emerald-700 transition-colors rounded-lg hover:bg-emerald-50/70"
              >
                <span>Who We Are</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 text-slate-500 ${
                    whoWeAreDropdownOpen ? "rotate-180 text-emerald-600" : ""
                  }`}
                />
              </button>

              {whoWeAreDropdownOpen && (
                <div className="absolute left-0 mt-2 w-56 rounded-xl border border-emerald-100 bg-white p-2 shadow-xl shadow-emerald-950/10 z-50 animate-in fade-in-50 zoom-in-95">
                  {navLinks.map((item) => (
                    <a
                      key={item.name}
                      href={item.href}
                      onClick={() => setWhoWeAreDropdownOpen(false)}
                      className="block rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                    >
                      {item.name}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Direct Shortcut Nav Links */}
            <a
              href="#challenge"
              className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors"
            >
              The Challenge
            </a>
            <a
              href="#solution"
              className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors"
            >
              How VEWAI Works
            </a>
            <a
              href="#testimonials"
              className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors"
            >
              Student Feedback
            </a>
            <a
              href="#team"
              className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors"
            >
              Team
            </a>

            {/* Vertical separator */}
            <div className="h-5 w-px bg-emerald-200/80 mx-2" />

            {/* Tab 2: Platform Access (Sign in / Enter Dashboard) */}
            {user ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/25 transition-all"
              >
                <span>Platform Access (Dashboard)</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-600 hover:text-white transition-all shadow-xs"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Platform Access</span>
              </Link>
            )}

            <a
              href="#contact"
              className="hidden lg:inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors shadow-sm"
            >
              <span>Register your school&apos;s interest</span>
            </a>
          </nav>

          {/* Mobile Menu Hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-emerald-50"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-emerald-100 bg-white px-4 py-4 space-y-3 animate-in fade-in-50 shadow-lg">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Who We Are
            </div>
            {navLinks.map((item) => (
              <a
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block py-1.5 text-base font-medium text-slate-700 hover:text-emerald-700"
              >
                {item.name}
              </a>
            ))}
            <div className="pt-2 border-t border-emerald-100 flex flex-col gap-2">
              <Link
                href={user ? "/dashboard" : "/login"}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 shadow-sm"
              >
                {user ? "Enter Platform Dashboard" : "Platform Access (Log In)"}
              </Link>
              <a
                href="#contact"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              >
                Register Interest
              </a>
            </div>
          </div>
        )}
      </header>

      {/* ─────────────────────────────────────────────────────────────
          HERO SECTION (Light Mint & Emerald Theme)
      ────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-12 pb-18 md:pt-20 md:pb-24">
        {/* Subtle mint/emerald ambient glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-emerald-300/25 blur-[140px] rounded-full pointer-events-none" />

        {/* Shaded, 70-80% transparent V logo watermark in hero background (enlarged by 20%) */}
        <div className="absolute top-[26%] sm:top-[28%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[410px] sm:w-[625px] md:w-[840px] aspect-[1024/764] pointer-events-none select-none z-0 opacity-[0.20]">
          <Image
            src="/images/logo-v.png"
            alt=""
            fill
            sizes="(max-width: 768px) 410px, 840px"
            className="object-contain"
            priority
          />
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            {/* Status Pill Badge */}
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/80 bg-white/90 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800 shadow-xs backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              <span>AI-Powered Veterinary Communication Practice</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.15]">
              Practise the conversations that shape veterinary care.
            </h1>

            {/* Supporting Copy */}
            <p className="text-base sm:text-lg md:text-xl text-slate-700 max-w-3xl mx-auto leading-relaxed">
              VEWAI helps veterinary learners develop communication skills through realistic roleplay, structured feedback and repeat practice. From foundational interactions to complex consultations, clinical reasoning comes into focus when the scenario calls for it.
            </p>

            {/* Fixed Value Phrases */}
            <div className="pt-1">
              <p className="text-xs sm:text-sm font-semibold text-emerald-900/90 tracking-wide">
                Realistic roleplay · Specific feedback · Repeat practice
              </p>
            </div>

            {/* Status Note: Pilot testing secondary to value proposition */}
            <div className="pt-1">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50/90 border border-emerald-200/80 px-3.5 py-1 text-xs font-medium text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Currently in pilot evaluation with UK veterinary students · Authored by clinical faculty</span>
              </span>
            </div>

            {/* Two Clear CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-3">
              <a
                href="#contact"
                className="rounded-xl bg-emerald-600 px-6 py-3.5 text-base font-semibold text-white hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 hover:-translate-y-0.5 cursor-pointer"
              >
                Register your school&apos;s interest
              </a>
              <a
                href="#demo"
                className="rounded-xl border border-emerald-300 bg-white px-6 py-3.5 text-base font-semibold text-emerald-800 hover:bg-emerald-50 hover:border-emerald-400 transition-all hover:-translate-y-0.5 flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Play className="h-4 w-4 fill-emerald-600 text-emerald-600" />
                <span>See VEWAI in action</span>
              </a>
            </div>
          </div>

          {/* Interactive Consult Simulator Mockup */}
          <div id="demo" className="mt-14 max-w-4xl mx-auto scroll-mt-24">
            {/* Lead-in line near demonstration */}
            <div className="text-center mb-5">
              <p className="text-sm sm:text-base font-bold text-slate-800">
                Choose a scenario. Have the conversation. Review the feedback. Try again.
              </p>
            </div>

            <div className="relative rounded-2xl border border-emerald-200/90 bg-white shadow-2xl shadow-emerald-950/10 overflow-hidden backdrop-blur-xl">
              {/* Mockup Header Bar with Switchable Views */}
              <div className="flex flex-wrap items-center justify-between border-b border-emerald-100 px-4 sm:px-6 py-3 bg-emerald-50/70 gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 mr-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </div>
                  <div className="flex items-center bg-white rounded-lg p-0.5 border border-emerald-200/80 text-xs shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setMockupTab("video")}
                      className={`px-3 py-1 rounded-md font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                        mockupTab === "video"
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Play className="h-3 w-3 fill-current" />
                      <span>Live Simulation Recording</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMockupTab("dialogue")}
                      className={`px-3 py-1 rounded-md font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                        mockupTab === "dialogue"
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <MessageSquare className="h-3 w-3" />
                      <span>Consultation &amp; Feedback Sample</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    Clinical Consultation · Barnaby
                  </span>
                </div>
              </div>

              {/* Mockup Content Area: Conditional Video / Dialogue */}
              {mockupTab === "video" ? (
                <div className="relative bg-slate-950 overflow-hidden">
                  <video
                    src="/images/demo-loop.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-auto aspect-video object-cover"
                  />
                  <div className="p-3.5 bg-white border-t border-emerald-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
                    <span>Recording of active roleplay session within the VEWAI learning environment</span>
                    <button
                      type="button"
                      onClick={() => setMockupTab("dialogue")}
                      className="text-emerald-700 hover:underline font-semibold cursor-pointer"
                    >
                      View dialogue and structured feedback breakdown →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 md:p-8 space-y-6 bg-white">
                  {/* Step 1: Character interaction */}
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white font-bold text-sm shadow-md">
                      SO
                    </div>
                    <div className="space-y-1.5 max-w-xl">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-800">
                          Sarah (Barnaby&apos;s Owner)
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">Anxious &amp; Distressed</span>
                      </div>
                      <div className="rounded-2xl rounded-tl-none bg-amber-50/80 p-4 text-sm text-slate-900 border border-amber-200/80 leading-relaxed shadow-2xs">
                        &ldquo;Doctor, Barnaby hasn&apos;t eaten since yesterday afternoon and he kept rolling in the paddock. When I checked him this morning he broke out into a sweat. I&apos;m terrified... is he going to need surgery?&rdquo;
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Learner verbal response */}
                  <div className="flex items-start gap-4 flex-row-reverse">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white font-bold text-sm shadow-md">
                      VL
                    </div>
                    <div className="space-y-1.5 max-w-xl text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs font-bold text-emerald-800">
                          Veterinary Learner
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">Voice / Text Interaction</span>
                      </div>
                      <div className="rounded-2xl rounded-tr-none bg-emerald-50 border border-emerald-300 p-4 text-sm text-slate-900 text-left leading-relaxed shadow-2xs">
                        &ldquo;I completely understand how alarming this is, Sarah. Let&apos;s take a deep breath together. I will examine Barnaby right now to assess his vital signs and pain level, and I will explain every step to you before we make any decisions.&rdquo;
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Structured debrief feedback */}
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 md:p-5 mt-4">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <BrainCircuit className="h-4 w-4 text-emerald-700" />
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                          Structured Consultation Feedback · Calgary-Cambridge Framework
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-emerald-800 bg-emerald-200/70 px-2 py-0.5 rounded">
                        Formative Debrief
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="rounded-lg bg-white p-3 border border-emerald-100 shadow-2xs">
                        <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          Building Rapport
                        </div>
                        <p className="text-slate-600 leading-normal">
                          Acknowledged client anxiety directly before moving into clinical history and examination.
                        </p>
                      </div>
                      <div className="rounded-lg bg-white p-3 border border-emerald-100 shadow-2xs">
                        <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          Information Gathering
                        </div>
                        <p className="text-slate-600 leading-normal">
                          Clear open questions established onset and progression without medical jargon.
                        </p>
                      </div>
                      <div className="rounded-lg bg-white p-3 border border-emerald-100 shadow-2xs">
                        <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          Explanation &amp; Next Steps
                        </div>
                        <p className="text-slate-600 leading-normal">
                          Set transparent expectations for the physical exam and reassured the client regarding decision-making.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Short verified student quotation immediately below demonstration */}
            <div className="mt-4 rounded-xl border border-emerald-100 bg-white/90 p-4 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <Quote className="h-4 w-4 text-emerald-600 shrink-0" />
                <p className="text-xs sm:text-sm italic text-slate-700">
                  &ldquo;Awesome tool, user friendly and engaging.&rdquo;
                </p>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                — Veterinary student, 2025 pilot of an earlier VEWAI version
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION: RESEARCH EVIDENCE (WHY COMMUNICATION PRACTICE MATTERS)
      ────────────────────────────────────────────────────────────── */}
      <section id="evidence" className="py-20 md:py-24 border-t border-emerald-100 bg-gradient-to-b from-white via-emerald-50/40 to-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto rounded-3xl border border-emerald-200/90 bg-white p-8 sm:p-12 md:p-14 shadow-xl shadow-emerald-950/5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              {/* Prominent Figure Column */}
              <div className="lg:col-span-5 text-center flex flex-col items-center justify-center">
                <span className="inline-block text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/70 px-3 py-1 rounded-full mb-4">
                  Research Evidence
                </span>
                <div className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-emerald-700 tracking-tight leading-none">
                  80 <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-700">out of 100</span>
                </div>
                <div className="text-base sm:text-lg font-bold text-slate-800 mt-3 leading-snug max-w-sm mx-auto text-center">
                  Settled veterinary negligence cases stem from poor communication
                </div>
              </div>

              {/* Context & Description Column */}
              <div className="lg:col-span-7 space-y-4 border-t lg:border-t-0 lg:border-l border-emerald-100 pt-6 lg:pt-0 lg:pl-10">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Why communication practice matters
                </h2>

                <p className="text-base sm:text-lg text-slate-800 font-medium leading-relaxed">
                  In a study of 100 settled cases of alleged veterinary professional negligence involving canine patients, communication problems were identified in 80 cases.
                </p>

                <p className="text-sm text-slate-600 leading-relaxed">
                  The study examined communication with owners and within veterinary teams. It highlights the importance of practising these interactions; it does not evaluate VEWAI.
                </p>

                <div className="pt-2">
                  <a
                    href="https://doi.org/10.1002/vetr.1068"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                  >
                    <span>Russell, Mossop, Forbes, &amp; Oxtoby (2022) · Veterinary Record (DOI: 10.1002/vetr.1068)</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: THE CHALLENGE
      ────────────────────────────────────────────────────────────── */}
      <section id="challenge" className="py-20 border-t border-emerald-100/90 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              The Need for Practice
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-snug">
              Communication is a clinical skill <br />
              It develops with practice
            </h2>
            <p className="text-slate-700 text-base sm:text-lg leading-relaxed">
              Veterinary learners need opportunities to ask questions, listen, explain, respond to emotion and work with colleagues. These skills develop through practice, feedback and reflection, from the first years of training onwards.
            </p>
          </div>

          {/* 3 Concise Challenge Themes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="rounded-2xl border border-emerald-100 bg-[#f9fdfb] p-7 space-y-3 shadow-2xs hover:border-emerald-300 hover:shadow-md transition-all">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                <HeartHandshake className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Practice before the pressure</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Rehearse conversations before facing them in placements or practice.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-[#f9fdfb] p-7 space-y-3 shadow-2xs hover:border-emerald-300 hover:shadow-md transition-all">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Respond to realistic personas</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Work through uncertainty, emotion and different perspectives, not just scripted answers.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-[#f9fdfb] p-7 space-y-3 shadow-2xs hover:border-emerald-300 hover:shadow-md transition-all">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                <Stethoscope className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Communication in clinical practice</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                In advanced scenarios, learners practise taking a history, explaining options and discussing a plan with an owner, while applying their clinical reasoning.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: THE SOLUTION
      ────────────────────────────────────────────────────────────── */}
      <section id="solution" className="py-20 border-t border-emerald-100/90 bg-[#f4fbf7]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-white px-3 py-1 rounded-full border border-emerald-200">
              How VEWAI Works
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Realistic conversations. Useful feedback. Another chance to practise.
            </h2>
            <p className="text-slate-700 text-base sm:text-lg leading-relaxed">
              Learners interact with AI roleplay characters in educator-designed scenarios. They make choices, respond to what they hear and receive feedback they can use in their next attempt.
            </p>
          </div>

          {/* Step 1: Scenario Selection & Creation (Educator Choice) */}
          <div className="max-w-5xl mx-auto mb-10">
            <div className="rounded-3xl border border-emerald-200/90 bg-white p-7 sm:p-9 md:p-10 shadow-xs">
              <div className="flex items-start gap-4 mb-4">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 font-bold text-base shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Step 1 · Scenario Selection &amp; Creation
                  </span>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                    Your Learning Objectives. Your Choice of Scenarios.
                  </h3>
                </div>
              </div>

              <p className="text-sm sm:text-base text-slate-700 leading-relaxed mb-6">
                Create scenarios tailored to your teaching, or choose from VEWAI&apos;s specialist-authored cases.
              </p>

              {/* Two Equal Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Option 1: Create Your Own Scenarios */}
                <div className="rounded-2xl border border-emerald-100 bg-[#f9fdfb] p-6 space-y-3 hover:border-emerald-300 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <h4 className="text-base font-bold text-slate-900">
                      Create Your Own Scenarios
                    </h4>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Build scenarios around the communication skills, topics and learning objectives you want your students to practise. Tailor the conversation to their stage of training and your curriculum. Use guided templates to create new cases for your students. The templates prompt you for the information needed to build a complete, realistic conversation—no previous experience in scenario creation required.
                  </p>
                </div>

                {/* Option 2: Use Specialist-Authored Cases */}
                <div className="rounded-2xl border border-emerald-100 bg-[#f9fdfb] p-6 space-y-3 hover:border-emerald-300 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <h4 className="text-base font-bold text-slate-900">
                      Use Specialist-Authored Cases
                    </h4>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Choose ready-made clinical scenarios authored by veterinary specialists. These offer an additional practice resource, particularly for students in their final two years and during clinical rotations, or veterinary surgeons aiming to perfect their reasoning and communication skills or undergoing postgraduate clinical training (internship and residency).
                  </p>
                </div>
              </div>

              {/* Primary Focus Note */}
              <div className="mt-6 pt-5 border-t border-emerald-100 text-xs sm:text-sm text-slate-600 leading-relaxed flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Communication remains the primary focus across all scenarios, with clinical reasoning incorporated where relevant to the scenario and learning objectives.
                </span>
              </div>
            </div>
          </div>

          {/* Steps 2 & 3: Student Practice & Feedback */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-5xl mx-auto mb-16">
            {/* Step 2: Have the conversation */}
            <div className="rounded-2xl border border-emerald-200/90 bg-white p-7 space-y-3 shadow-xs hover:border-emerald-300 transition-all">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 font-bold text-base shrink-0">
                  2
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    Step 2 · Student Practice
                  </span>
                  <h3 className="text-lg font-bold text-slate-900">Have the conversation</h3>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Engage with an owner or member of the veterinary team and respond as the interaction develops through spoken speech or text dialogue.
              </p>
            </div>

            {/* Step 3: Review and repeat */}
            <div className="rounded-2xl border border-emerald-200/90 bg-white p-7 space-y-3 shadow-xs hover:border-emerald-300 transition-all">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 font-bold text-base shrink-0">
                  3
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    Step 3 · Reflection &amp; Feedback
                  </span>
                  <h3 className="text-lg font-bold text-slate-900">Review and repeat</h3>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                See specific feedback structured around established communication frameworks, reflect on your approach and try again.
              </p>
            </div>
          </div>

          {/* Supporting Implementation Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <div className="rounded-2xl border border-emerald-100 bg-white/90 p-6 space-y-2.5 shadow-2xs">
              <div className="h-9 w-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Specialist-Authored Scenarios</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Clinical cases and background details are authored by veterinary specialists to reflect realistic practice.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-white/90 p-6 space-y-2.5 shadow-2xs">
              <div className="h-9 w-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                <Users className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Roleplay Characters</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Learners interact with distinct owner profiles and clinical colleagues representing different communication challenges.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-white/90 p-6 space-y-2.5 shadow-2xs">
              <div className="h-9 w-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                <Mic className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Spoken &amp; Written Practice</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Supports speech input and text dialogue, allowing learners to practise realistic spoken pacing.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-white/90 p-6 space-y-2.5 shadow-2xs">
              <div className="h-9 w-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Repeatable Practice</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Learners can revisit cases at their own pace to test different approaches and apply feedback directly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2B: COMMUNICATION SKILLS
      ────────────────────────────────────────────────────────────── */}
      <section className="py-20 border-t border-emerald-100/90 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Communication Skills
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Communication practice that grows with the learner.
            </h2>
            <p className="text-slate-700 text-base sm:text-lg leading-relaxed">
              VEWAI brings communication skills together in realistic veterinary conversations. Educators can focus learning on individual skills or combine them within more demanding clinical consultations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Foundations */}
            <div className="rounded-2xl border border-emerald-200/90 bg-[#fbfdfc] p-7 space-y-3 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all">
              <h3 className="text-lg font-bold text-slate-900">Foundations</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Opening conversations, building rapport, listening, asking questions and explaining clearly.
              </p>
            </div>

            {/* Applied Conversations */}
            <div className="rounded-2xl border border-emerald-200/90 bg-[#fbfdfc] p-7 space-y-3 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all">
              <h3 className="text-lg font-bold text-slate-900">Applied Conversations</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Responding to concerns, exploring a client&apos;s perspective and discussing options.
              </p>
            </div>

            {/* Communication in Clinical Context */}
            <div className="rounded-2xl border border-emerald-200/90 bg-[#fbfdfc] p-7 space-y-3 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all">
              <h3 className="text-lg font-bold text-slate-900">Communication in Clinical Context</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Bringing communication and clinical reasoning together to gather information, explain decisions and agree next steps.
              </p>
            </div>
          </div>

          {/* Development note below cards */}
          <div className="max-w-3xl mx-auto text-center mt-10">
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed bg-emerald-50/70 border border-emerald-100 rounded-xl py-3 px-6 inline-block">
              We are developing additional activities for earlier years of veterinary school, allowing students to focus on communication with less emphasis on clinical knowledge.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: FEEDBACK & EDUCATOR INSIGHTS
      ────────────────────────────────────────────────────────────── */}
      <section id="insights" className="py-20 border-t border-emerald-100/90 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Structured Debrief
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Feedback learners can use. Insights educators can act on.
            </h2>
            <p className="text-slate-700 text-base sm:text-lg leading-relaxed">
              VEWAI turns a practice conversation into specific points for reflection. Educators can use patterns across learners to guide teaching and support.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Student Feedback Card */}
            <div className="rounded-2xl border border-emerald-100 bg-[#f9fdfb] p-8 space-y-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shadow-2xs">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">For the Veterinary Learner</h3>
                  <p className="text-xs text-emerald-800 font-semibold">Immediate debrief after each conversation</p>
                </div>
              </div>
              <ul className="space-y-3.5 text-sm text-slate-700">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>See what worked in the conversation.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Identify a specific communication skill to improve.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Try the scenario again and apply the feedback.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="text-slate-600 text-xs leading-relaxed">
                    <em>For scenarios that assess clinical reasoning:</em> Review diagnostic decision paths and investigation choices alongside communication feedback.
                  </span>
                </li>
              </ul>
              <div className="pt-2 border-t border-emerald-100/80">
                <p className="text-[11px] text-slate-500">
                  Feedback rubrics are informed by established clinical communication principles, including the Calgary–Cambridge guide.
                </p>
              </div>
            </div>

            {/* Educator Insights Card */}
            <div className="rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/60 via-white to-teal-50/40 p-8 space-y-5 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">For Veterinary Educators</h3>
                  <p className="text-xs text-emerald-800 font-bold">Cohort feedback &amp; teaching support</p>
                </div>
              </div>
              <ul className="space-y-3.5 text-sm text-slate-700">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>See where learners are progressing or struggling.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Use scenario results to focus teaching and discussion.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Align practice with course learning objectives.</span>
                </li>
              </ul>
              <div className="pt-2 border-t border-emerald-100/80">
                <span className="inline-block text-[11px] font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                  Cohort analytics dashboard in active pilot testing
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 4: STUDENT FEEDBACK & PILOT EVALUATION
      ────────────────────────────────────────────────────────────── */}
      <section id="testimonials" className="py-20 border-t border-emerald-100/90 bg-[#f4fbf7]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-white px-3 py-1 rounded-full border border-emerald-200">
              Pilot Evaluation Feedback
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Student feedback on earlier-version testing
            </h2>
            <p className="text-slate-700 text-base sm:text-lg leading-relaxed">
              Verbatim feedback collected during a 2025 student evaluation of an earlier VEWAI prototype at the University of Nottingham.
            </p>
          </div>

          {/* Carousel Container (Manual Navigation Only) */}
          <div className="max-w-6xl mx-auto">
            {/* Top Carousel Controls Bar */}
            <div className="flex items-center justify-between mb-6 px-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-full">
                  Showing {testimonialIndex + 1} to {Math.min(testimonialIndex + 3, TESTIMONIALS.length)} of {TESTIMONIALS.length} quotations
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={prevTestimonial}
                  className="p-2 rounded-full border border-emerald-200 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 transition-all shadow-2xs cursor-pointer"
                  aria-label="Previous testimonials"
                  title="Previous testimonials"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={nextTestimonial}
                  className="p-2 rounded-full border border-emerald-200 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 transition-all shadow-2xs cursor-pointer"
                  aria-label="Next testimonials"
                  title="Next testimonials"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* 3 Visible Testimonial Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[0, 1, 2].map((offset) => {
                const item = TESTIMONIALS[(testimonialIndex + offset) % TESTIMONIALS.length];
                return (
                  <div
                    key={`${item.id}-${testimonialIndex}`}
                    className="flex flex-col justify-between rounded-2xl border border-emerald-100 bg-white p-7 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all duration-300 animate-in fade-in"
                  >
                    <div>
                      {/* Card Header: Quote icon & Value badge */}
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <div className="h-9 w-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                          <Quote className="h-4 w-4" />
                        </div>
                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                          {item.value}
                        </span>
                      </div>

                      {/* Quotation text (Verbatim student words preserved) */}
                      <p className="text-base font-medium text-slate-800 leading-relaxed italic my-2">
                        &ldquo;{item.quote}&rdquo;
                      </p>
                    </div>

                    {/* Attribution footer */}
                    <div className="pt-5 mt-4 border-t border-emerald-100/80">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 shrink-0 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center border border-emerald-200">
                          VS
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{item.author}</div>
                          <div className="text-[11px] text-slate-600 font-medium">
                            {item.affiliation}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Indicator Dots */}
            <div className="flex items-center justify-center gap-2 mt-8">
              {TESTIMONIALS.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTestimonialIndex(idx)}
                  className={`h-2.5 rounded-full transition-all cursor-pointer ${
                    idx === testimonialIndex
                      ? "w-8 bg-emerald-600 shadow-xs"
                      : "w-2.5 bg-emerald-200 hover:bg-emerald-300"
                  }`}
                  aria-label={`Go to testimonial ${idx + 1}`}
                  title={item.value}
                />
              ))}
            </div>

            {/* Evaluation & Research Context Note */}
            <div className="max-w-3xl mx-auto mt-10 rounded-2xl border border-emerald-200/90 bg-white p-5 text-xs text-slate-700 flex items-start gap-3.5 shadow-2xs">
              <Info className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <span className="font-bold text-slate-900 text-xs block">
                  Evaluation and research note
                </span>
                <p className="leading-relaxed text-slate-600">
                  These quotations represent selected feedback collected during a 2025 student evaluation of an earlier VEWAI version. They do not claim universal consensus or clinical outcome improvements. Full study findings and academic publications will be shared following formal peer review.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 5: OUR ETHOS
      ────────────────────────────────────────────────────────────── */}
      <section id="ethos" className="py-20 border-t border-emerald-100/90 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              OUR ETHOS
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Better conversations start with meaningful practice.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-5xl mx-auto">
            {/* 1. Communication matters. */}
            <div className="rounded-2xl border border-emerald-100 bg-[#f9fdfb] p-7 space-y-3 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Communication matters.</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Listening, understanding and explaining clearly are essential veterinary skills. We put them at the heart of learning.
              </p>
            </div>

            {/* 2. Improvement takes practice. */}
            <div className="rounded-2xl border border-emerald-100 bg-[#f9fdfb] p-7 space-y-3 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Improvement takes practice.</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Students need opportunities to try, receive feedback, reflect and try again—building confidence before real consultations.
              </p>
            </div>

            {/* 3. Learning should feel real. */}
            <div className="rounded-2xl border border-emerald-100 bg-[#f9fdfb] p-7 space-y-3 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Learning should feel real.</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Engaging, realistic conversations bring learning to life, helping students prepare for the human side of veterinary practice.
              </p>
            </div>

            {/* 4. AI should support the learning process. */}
            <div className="rounded-2xl border border-emerald-100 bg-[#f9fdfb] p-7 space-y-3 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                <BrainCircuit className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">AI should support the learning process.</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Learning happens through doing, thinking and reflecting. We believe AI should create opportunities for students to practise and receive feedback, while keeping them actively responsible for their own learning.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 6: LEADERSHIP & THE TEAM
      ────────────────────────────────────────────────────────────── */}
      <section id="team" className="py-20 border-t border-emerald-100/90 bg-[#f4fbf7]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Founders &amp; Leadership
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Conceived by Veterinary Clinical Educators
            </h2>
            {/* Highly visible, bold and clear contrast subtitle */}
            <p className="text-slate-800 font-semibold text-base sm:text-lg max-w-2xl mx-auto">
              VewAI is created by European Veterinary Specialists and clinical educators with decades of university teaching and international specialist practice.
            </p>
            <p className="text-slate-600 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed pt-1">
              Following discussions with the relevant University of Nottingham teams, VEWAI is working towards formal spin-out status. Internal rollout and evaluation are the next steps towards formalisation, which remains subject to university approval.
            </p>
          </div>

          {/* Featured Founders Showcase: Field Photo on Left (half page), Profiles & Dropdown CVs on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start max-w-6xl mx-auto mb-16">
            {/* Left Column: Authentic Photo Feature (Half page on desktop) */}
            <div className="w-full">
              <div className="rounded-3xl border border-emerald-200/90 bg-white p-3 shadow-md lg:sticky lg:top-28">
                <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-emerald-50 shadow-inner">
                  <Image
                    src="/images/founders-field.jpg"
                    alt="Marco Duz and Ignacio Corradini in the field with Mango at the University of Nottingham"
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover object-center"
                    priority
                  />
                </div>
                <div className="p-4 pt-3.5 space-y-2 text-xs leading-relaxed">
                  <p className="font-semibold text-slate-900">
                    Marco (left) and Ignacio (right) with &ldquo;Mango&rdquo; (centre).
                  </p>
                  <p className="text-slate-600">
                    Marco and Ignacio have known each other for over 20 years, sharing a close friendship both at work and privately. Both have a natural knack for technology and educational innovation, united by the conviction that AI offers enormous potential to support veterinary teaching and clinical learning.
                  </p>
                  <p className="italic text-slate-500 text-[11px] pt-1 border-t border-emerald-50">
                    * Mango is not directly involved in VEWAI, having shown a firm preference for real rather than simulated carrots.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Co-Founder Biographies with Dropdown CVs */}
            <div className="w-full space-y-6">
              {/* Dr. Marco Duz Card */}
              <div className="rounded-2xl border border-emerald-100 bg-[#f9fdfb] p-6 sm:p-7 space-y-4 shadow-sm hover:border-emerald-300 transition-all">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-extrabold text-lg shadow-md">
                    MD
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <h3 className="text-xl font-bold text-slate-900">Dr. Marco Duz</h3>
                      <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full border border-emerald-200">
                        Co-Founder &amp; Clinical Lead
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800 font-mono font-bold mt-0.5">
                      MedVet MVM(Res) PhD DipECEIM RCVS Specialist SFHEA
                    </p>
                    <p className="text-xs text-slate-600 font-medium">
                      Clinical Associate Professor in Equine Internal Medicine
                    </p>
                  </div>
                </div>

                <p className="text-sm text-slate-700 leading-relaxed">
                  Clinical Associate Professor at the University of Nottingham. EBVS® European and RCVS Recognised Specialist in Equine Internal Medicine, Senior Fellow of the Higher Education Academy (SFHEA), and Treasurer of the ECEIM Executive Committee, with over 20 years of clinical and university educational experience worldwide.
                </p>

                {/* Dropdown CV Menu Button */}
                <button
                  type="button"
                  onClick={() => setExpandedMarco((prev) => !prev)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-emerald-50/80 hover:bg-emerald-100/80 border border-emerald-200 text-xs font-semibold text-emerald-900 transition-colors"
                  aria-expanded={expandedMarco}
                >
                  <span className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-emerald-700" />
                    <span>{expandedMarco ? "Hide Curriculum Vitae (CV)" : "View Curriculum Vitae (CV)"}</span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-emerald-700 transition-transform duration-200 ${
                      expandedMarco ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Expanded CV Drawer */}
                {expandedMarco && (
                  <div className="pt-3 border-t border-emerald-100 space-y-3.5 text-xs text-slate-700 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="space-y-1">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        Academic &amp; Clinical Appointments:
                      </span>
                      <p className="text-slate-600 pl-3 leading-relaxed">
                        Clinical Associate Professor in Equine Internal Medicine, School of Veterinary Medicine and Science, University of Nottingham. Leads undergraduate and postgraduate clinical teaching across the curriculum—from one-to-one patient-side instruction to whole-cohort lectures, guiding learners from their preliminary pre-veterinary year through to their final days before graduation. In clinical practice, Marco has mentored numerous junior veterinary surgeons (interns) and trained residents to become European specialists themselves.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        Specialist Qualifications &amp; Royal College:
                      </span>
                      <ul className="text-slate-600 pl-5 space-y-0.5 list-disc leading-relaxed">
                        <li>EBVS® European Veterinary Specialist in Equine Internal Medicine (Diplomate ECEIM)</li>
                        <li>RCVS Recognised Specialist in Equine Internal Medicine</li>
                        <li>Doctor of Philosophy (PhD) in Equine Epidemiology</li>
                        <li>Member of the Royal College of Veterinary Surgeons (MRCVS)</li>
                      </ul>
                    </div>

                    <div className="space-y-1">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        Educational Leadership &amp; Fellowships:
                      </span>
                      <p className="text-slate-600 pl-3 leading-relaxed">
                        Over 20 years of experience educating veterinary students across academic institutions and clinical referral settings, with a core pedagogical focus on clinical reasoning in simulated and authentic clinical environments. Co-convenor of the embedded Artificial Intelligence module at the University of Nottingham, leading faculty training to foster ethical, proficient AI use. Actively engaged in international veterinary education through the organisation of major international conferences. Senior Fellow of the Higher Education Academy (SFHEA).
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        International College Governance:
                      </span>
                      <p className="text-slate-600 pl-3 leading-relaxed">
                        Treasurer and elected Executive Board Committee Member of the European College of Equine Internal Medicine (ECEIM). Recipient of the prestigious 2022 ECEIM Recognition Award honouring his outstanding contribution to the specialty of equine internal medicine.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        Research &amp; Scholarly Innovation:
                      </span>
                      <p className="text-slate-600 pl-3 leading-relaxed">
                        Marco’s research portfolio spans clinical equine investigations and veterinary epidemiology. In educational scholarship, he leads initiatives to pioneer more engaging, interactive, and modern pedagogies—actively transforming traditional, static veterinary teaching paradigms into responsive, simulation-enhanced learning environments.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Dr. Ignacio Corradini Card */}
              <div className="rounded-2xl border border-emerald-100 bg-[#f9fdfb] p-6 sm:p-7 space-y-4 shadow-sm hover:border-emerald-300 transition-all">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-700 text-white font-extrabold text-lg shadow-md">
                    IC
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <h3 className="text-xl font-bold text-slate-900">Dr. Ignacio Corradini</h3>
                      <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full border border-emerald-200">
                        Co-Founder &amp; AI Educational Strategy
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800 font-mono font-bold mt-0.5">
                      MV MSc PhD DipECEIM RCVS Specialist FHEA
                    </p>
                    <p className="text-xs text-slate-600 font-medium">
                      Clinical Assistant Professor in Equine Internal Medicine
                    </p>
                  </div>
                </div>

                <p className="text-sm text-slate-700 leading-relaxed">
                  Clinical Assistant Professor in Equine Internal Medicine at the University of Nottingham. EBVS® European and RCVS Recognised Specialist in Equine Internal Medicine, Fellow of the Higher Education Academy (FHEA), and Chair of the School&apos;s Digital Learning Group, pioneering AI integration and clinical simulation.
                </p>

                {/* Dropdown CV Menu Button */}
                <button
                  type="button"
                  onClick={() => setExpandedIgnacio((prev) => !prev)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-emerald-50/80 hover:bg-emerald-100/80 border border-emerald-200 text-xs font-semibold text-emerald-900 transition-colors"
                  aria-expanded={expandedIgnacio}
                >
                  <span className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-emerald-700" />
                    <span>{expandedIgnacio ? "Hide Curriculum Vitae (CV)" : "View Curriculum Vitae (CV)"}</span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-emerald-700 transition-transform duration-200 ${
                      expandedIgnacio ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Expanded CV Drawer */}
                {expandedIgnacio && (
                  <div className="pt-3 border-t border-emerald-100 space-y-3.5 text-xs text-slate-700 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="space-y-1">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        Academic &amp; Clinical Appointments:
                      </span>
                      <p className="text-slate-600 pl-3 leading-relaxed">
                        Clinical Assistant Professor in Equine Internal Medicine, School of Veterinary Medicine and Science, University of Nottingham. Oversees clinical hospital caseloads, small-group patient-side coaching, and advanced clinical reasoning seminars for veterinary students.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        Specialist Qualifications &amp; Royal College:
                      </span>
                      <ul className="text-slate-600 pl-5 space-y-0.5 list-disc leading-relaxed">
                        <li>EBVS® European Veterinary Specialist in Equine Internal Medicine (Diplomate ECEIM)</li>
                        <li>RCVS Recognised Specialist in Equine Internal Medicine</li>
                        <li>Doctor of Philosophy (PhD) in Equine Ophthalmology and Metabolomics</li>
                        <li>Member of the Royal College of Veterinary Surgeons (MRCVS)</li>
                        <li>Master of Science (MSc)</li>
                      </ul>
                    </div>

                    <div className="space-y-1">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        Pedagogic Fellowship &amp; Inclusive Teaching:
                      </span>
                      <p className="text-slate-600 pl-3 leading-relaxed">
                        Fellow of the Higher Education Academy (FHEA), committed to experiential, inquiry-led clinical teaching and reflective veterinary practice. Active co-investigator on educational initiatives improving curricular accessibility for students with colour vision deficiencies. Ignacio has taught veterinary students across diverse international environments—from Central America and Spain to the United Kingdom—gaining deep insight into how students communicate and reason clinically in varied educational contexts.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        Institutional Digital Strategy:
                      </span>
                      <p className="text-slate-600 pl-3 leading-relaxed">
                        Chair of the Digital Learning Group at the School of Veterinary Medicine and Science, leading pedagogical innovation, interactive technology integration, and institutional AI curriculum strategy.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        AI Simulation &amp; Pedagogical Architecture:
                      </span>
                      <p className="text-slate-600 pl-3 leading-relaxed">
                        Conception and pedagogical design of dynamic conversational personas, structured feedback frameworks, and AI-assisted clinical simulation that mirrors authentic client-facing encounters.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Technical Team */}
          <div className="max-w-3xl mx-auto rounded-2xl border border-emerald-100 bg-[#f4fbf7] p-6 md:p-8">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-6 text-center">
              Engineering &amp; Technical Development
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex items-start gap-3 bg-white p-4 rounded-xl border border-emerald-100 shadow-2xs">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 font-bold text-sm">
                  SC
                </div>
                <div>
                  <h5 className="text-sm font-bold text-slate-900">Dr. Sebastian Corradini</h5>
                  <p className="text-xs text-emerald-700 font-semibold">Technical Lead</p>
                  <p className="text-xs text-slate-600 mt-1 leading-normal">
                    Medical Doctor and certified AI developer specializing in clinical simulation architecture and healthcare NLP.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white p-4 rounded-xl border border-emerald-100 shadow-2xs">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 font-bold text-sm">
                  NC
                </div>
                <div>
                  <h5 className="text-sm font-bold text-slate-900">Nick Coleman</h5>
                  <p className="text-xs text-emerald-700 font-semibold">Senior Full-Stack Developer</p>
                  <p className="text-xs text-slate-600 mt-1 leading-normal">
                    Lead platform engineer architecting responsive interactive interfaces, database infrastructure, and pedagogical scoring modules.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 7: PRIVACY & DATA MINIMISATION
      ────────────────────────────────────────────────────────────── */}
      <section id="privacy" className="py-16 border-t border-emerald-100/90 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto rounded-3xl border border-emerald-200/90 bg-[#f9fdfb] p-8 sm:p-10 shadow-xs">
            <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 w-fit mb-4">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Platform Privacy</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-5">
              Designed to minimise personal information
            </h2>
            <div className="space-y-4 text-slate-700 text-sm sm:text-base leading-relaxed">
              <p>
                Students verify their university affiliation by email, then create a separate username and password. VEWAI does not retain their verification email address or require their real name. Their year of study determines which learning resources they can access.
              </p>
              <p>
                Audio recordings and conversation transcripts are not retained. Feedback is accessible only to the individual student, allowing them to review their practice and track their progress while their account remains active, up to graduation.
              </p>
              <p className="pt-2 text-xs sm:text-sm text-slate-600 border-t border-emerald-100">
                VEWAI LTD is registered with the Information Commissioner’s Office. Registration reference:{" "}
                <a
                  href="https://ico.org.uk/ESDWebPages/Entry/ZB996913"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-emerald-700 hover:text-emerald-800 underline underline-offset-2 inline-flex items-center gap-1"
                >
                  <span>ZB996913</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 8: REGISTER INTEREST / EARLY ADOPTERS CONTACT
      ────────────────────────────────────────────────────────────── */}
      <section id="contact" className="py-20 border-t border-emerald-100/90 bg-gradient-to-b from-[#eef9f4] via-[#f7fdfa] to-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto rounded-3xl border border-emerald-200/90 bg-white p-8 md:p-10 shadow-xl shadow-emerald-950/5">
            <div className="text-center space-y-3 mb-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-800">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                <span>Early Academic Partnership</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Bring VEWAI to your veterinary school.
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Tell us about your teaching needs and we&apos;ll discuss how VEWAI could support your learners, including current pilot opportunities.
              </p>
            </div>

            {formSubmitted ? (
              <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-8 text-center space-y-4 animate-in fade-in-50">
                <div className="h-14 w-14 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Thank you for registering your interest!</h3>
                <p className="text-sm text-slate-700 max-w-md mx-auto leading-relaxed">
                  Our clinical education leads (Dr Marco Duz &amp; Dr Ignacio Corradini) have received your details. We will be in touch via <strong>{formData.email}</strong> to discuss your learners&apos; needs and current pilot opportunities.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormSubmitted(false);
                      setFormData({
                        name: "",
                        institution: "",
                        role: "Faculty / Educator",
                        email: "",
                        message: "",
                      });
                    }}
                    className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                  >
                    Submit another enquiry
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-xs font-bold text-slate-700 mb-1">
                    Your Name *
                  </label>
                  <input
                    id="name"
                    required
                    type="text"
                    placeholder="Type your first and last name here"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl border border-emerald-200 bg-[#fcfdfd] px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="institution" className="block text-xs font-bold text-slate-700 mb-1">
                      University / Institution *
                    </label>
                    <input
                      id="institution"
                      required
                      type="text"
                      placeholder="eg. University of Nottingham"
                      value={formData.institution}
                      onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                      className="w-full rounded-xl border border-emerald-200 bg-[#fcfdfd] px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label htmlFor="role" className="block text-xs font-bold text-slate-700 mb-1">
                      Your Role *
                    </label>
                    <select
                      id="role"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full rounded-xl border border-emerald-200 bg-[#fcfdfd] px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <option value="Dean / School Director">Dean / School Director</option>
                      <option value="Faculty / Educator">Faculty / Educator</option>
                      <option value="Veterinary Student">Veterinary Student</option>
                      <option value="Postgraduate / Resident">Postgraduate / Resident</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-xs font-bold text-slate-700 mb-1">
                    Work / Academic Email *
                  </label>
                  <input
                    id="email"
                    required
                    type="email"
                    placeholder="eg. name.lastname@yourinstitution.edu"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-xl border border-emerald-200 bg-[#fcfdfd] px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-xs font-bold text-slate-700 mb-1">
                    Message or Cohort Size (Optional)
                  </label>
                  <textarea
                    id="message"
                    rows={3}
                    placeholder="Tell us about your teaching focus or number of students..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full rounded-xl border border-emerald-200 bg-[#fcfdfd] px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                  <span>Register your school&apos;s interest</span>
                </button>

                <p className="text-[11px] text-center text-slate-500 pt-2">
                  Direct email enquiries:{" "}
                  <a
                    href="mailto:vewai.education@gmail.com"
                    className="font-bold text-emerald-700 hover:underline"
                  >
                    vewai.education@gmail.com
                  </a>
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          FOOTER (Clean Mint with Official Brand Mark & Tagline)
      ────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-emerald-200 bg-[#f4fbf7] py-12 text-slate-600 text-xs">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-48 sm:h-11 sm:w-52">
                <Image
                  src="/images/logo-full.png"
                  alt="VEWAI™ - Vet Education with AI"
                  width={220}
                  height={52}
                  className="h-full w-auto object-contain"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-end gap-6 text-slate-600 font-medium">
              <a href="#challenge" className="hover:text-emerald-700 transition-colors">
                The Challenge
              </a>
              <a href="#solution" className="hover:text-emerald-700 transition-colors">
                How VEWAI Works
              </a>
              <a href="#testimonials" className="hover:text-emerald-700 transition-colors">
                Student Feedback
              </a>
              <a href="#team" className="hover:text-emerald-700 transition-colors">
                Team
              </a>
              <a href="#privacy" className="hover:text-emerald-700 transition-colors">
                Privacy
              </a>
              <Link href="/login" className="hover:text-emerald-700 transition-colors font-bold text-emerald-800">
                Platform Access
              </Link>
              <a
                href="mailto:vewai.education@gmail.com"
                className="hover:text-emerald-700 transition-colors"
              >
                Contact: vewai.education@gmail.com
              </a>
            </div>
          </div>

          {/* Company Registration & Legal Details */}
          <div className="pt-6 border-t border-emerald-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-center sm:text-left">
              <span className="font-semibold text-slate-700">VEWAI LTD</span>
              <span>VAT: 530 1735 26</span>
              <span>
                ICO reference:{" "}
                <a
                  href="https://ico.org.uk/ESDWebPages/Entry/ZB996913"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
                >
                  ZB996913
                </a>
              </span>
            </div>

            <div className="text-center sm:text-right">
              &copy; 2025 VEWAI Ltd. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
