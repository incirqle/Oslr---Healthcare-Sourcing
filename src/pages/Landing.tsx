import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import oslrLogo from "@/assets/oslr-logo.svg";
import {
  Search,
  MessageSquareText,
  Database,
  Mail,
  BarChart3,
  FolderKanban,
  Users,
  Zap,
  Clock,
  Layers,
  ArrowRight,
  CheckCircle2,
  Newspaper,
  Shield,
  Sparkles,
  Target,
  Phone,
  Globe,
  MapPin,
  Star,
  TrendingUp,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Animated search bar queries                                        */
/* ------------------------------------------------------------------ */
const EXAMPLE_QUERIES = [
  "Orthopedic surgeons completing fellowship in Miami",
  "ICU nurses in Dallas with CCRN certification",
  "Pediatric cardiologists within 50 miles of Boston",
  "Family medicine residents graduating 2026 in Texas",
];

function TypingSearch() {
  const [queryIndex, setQueryIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const full = EXAMPLE_QUERIES[queryIndex];
    let timeout: ReturnType<typeof setTimeout>;

    if (!deleting) {
      if (displayed.length < full.length) {
        timeout = setTimeout(() => setDisplayed(full.slice(0, displayed.length + 1)), 38);
      } else {
        timeout = setTimeout(() => setDeleting(true), 2200);
      }
    } else {
      if (displayed.length > 0) {
        timeout = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 18);
      } else {
        setDeleting(false);
        setQueryIndex((i) => (i + 1) % EXAMPLE_QUERIES.length);
      }
    }
    return () => clearTimeout(timeout);
  }, [displayed, deleting, queryIndex]);

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="flex items-center rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm shadow-2xl shadow-primary/5 px-5 py-4 gap-3">
        <Search className="h-5 w-5 text-white/40 shrink-0" />
        <span className="text-base md:text-lg text-white/90 truncate">
          {displayed}
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ repeat: Infinity, duration: 0.7 }}
            className="inline-block w-[2px] h-5 bg-primary ml-0.5 align-middle"
          />
        </span>
      </div>
      <AnimatePresence>
        {!deleting && displayed === EXAMPLE_QUERIES[queryIndex] && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.35 }}
            className="flex flex-wrap gap-2 mt-3 justify-center"
          >
            {["Job Title", "Location", "Training Stage", "Specialty"].map((chip) => (
              <span
                key={chip}
                className="px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-medium border border-primary/20"
              >
                {chip}
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Product mockup component                                           */
/* ------------------------------------------------------------------ */
function ProductMockup() {
  const mockCandidates = [
    { name: "Dr. Sarah Chen", title: "Orthopedic Surgeon", location: "Miami, FL", score: 97, status: "New" },
    { name: "Dr. James Rivera", title: "Orthopedic Surgeon", location: "Fort Lauderdale, FL", score: 94, status: "New" },
    { name: "Dr. Michelle Park", title: "Sports Medicine", location: "Miami, FL", score: 91, status: "Contacted" },
    { name: "Dr. David Okafor", title: "Orthopedic Surgeon", location: "West Palm Beach, FL", score: 88, status: "New" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, duration: 0.8, ease: "easeOut" }}
      className="relative w-full max-w-4xl mx-auto mt-16"
    >
      {/* Glow behind mockup */}
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-b from-primary/20 via-emerald-500/10 to-transparent blur-2xl -z-10" />

      {/* Browser chrome */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md overflow-hidden shadow-2xl shadow-black/40">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-white/10" />
            <div className="w-3 h-3 rounded-full bg-white/10" />
            <div className="w-3 h-3 rounded-full bg-white/10" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-2 px-4 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-xs text-white/40">
              <Search className="h-3 w-3" />
              app.oslr.io/search
            </div>
          </div>
        </div>

        {/* App content */}
        <div className="p-4 md:p-6">
          {/* Search bar in app */}
          <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 mb-5">
            <Search className="h-4 w-4 text-primary" />
            <span className="text-sm text-white/80">Orthopedic surgeons in South Florida</span>
            <span className="ml-auto text-xs text-primary font-medium bg-primary/15 px-2 py-0.5 rounded-full">247 results</span>
          </div>

          {/* Results table */}
          <div className="space-y-0 rounded-lg border border-white/[0.06] overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-white/[0.03] text-xs text-white/40 font-medium">
              <div className="col-span-4">Candidate</div>
              <div className="col-span-3 hidden md:block">Title</div>
              <div className="col-span-2 hidden md:block">Location</div>
              <div className="col-span-1 hidden md:block text-center">Score</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            {/* Rows */}
            {mockCandidates.map((c, i) => (
              <motion.div
                key={c.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.0 + i * 0.12, duration: 0.4 }}
                className="grid grid-cols-12 gap-3 px-4 py-3 border-t border-white/[0.04] hover:bg-white/[0.02] items-center"
              >
                <div className="col-span-4 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/30 to-emerald-500/20 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">
                    {c.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <span className="text-sm font-medium text-white/90 truncate">{c.name}</span>
                </div>
                <div className="col-span-3 hidden md:block text-sm text-white/60 truncate">{c.title}</div>
                <div className="col-span-2 hidden md:flex items-center gap-1 text-sm text-white/50">
                  <MapPin className="h-3 w-3 shrink-0" />{c.location}
                </div>
                <div className="col-span-1 hidden md:flex justify-center">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.score >= 95 ? 'text-emerald-400 bg-emerald-400/10' : c.score >= 90 ? 'text-primary bg-primary/10' : 'text-white/60 bg-white/5'}`}>
                    {c.score}
                  </span>
                </div>
                <div className="col-span-2 flex justify-end">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${c.status === 'Contacted' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'bg-primary/15 text-primary border border-primary/20'}`}>
                    {c.status}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Count-up number                                                    */
/* ------------------------------------------------------------------ */
function CountUp({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = Math.ceil(target / 40);
    const interval = setInterval(() => {
      start += step;
      if (start >= target) {
        start = target;
        clearInterval(interval);
      }
      setValue(start);
    }, 30);
    return () => clearInterval(interval);
  }, [inView, target]);

  return (
    <span ref={ref}>
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Section wrapper with fade-in                                       */
/* ------------------------------------------------------------------ */
function Section({
  children,
  className = "",
  elevated = false,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  id?: string;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`relative py-24 md:py-32 px-4 ${elevated ? "bg-[hsl(222,47%,11%)]" : "bg-sidebar"} text-sidebar-foreground ${className}`}
    >
      {/* Subtle top edge highlight for elevated sections */}
      {elevated && <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />}
      <div className="max-w-6xl mx-auto">{children}</div>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const PAIN_POINTS = [
  {
    icon: Clock,
    title: "Stale Data",
    desc: "Most sourcing tools rely on databases that are months or years out of date. You need to know where a physician is training right now, not where they were two years ago.",
    color: "from-red-500/20 to-orange-500/10",
    iconColor: "text-red-400",
    iconBg: "bg-red-500/15 border-red-500/20",
  },
  {
    icon: Layers,
    title: "Manual Workflows",
    desc: "Copy-pasting between tabs, building spreadsheets, hand-writing outreach emails. Your time should be spent recruiting, not doing data entry.",
    color: "from-amber-500/20 to-yellow-500/10",
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/15 border-amber-500/20",
  },
  {
    icon: Zap,
    title: "Fragmented Tools",
    desc: "One tool to search, another to find emails, another to send campaigns, another to read industry news. Context-switching kills productivity.",
    color: "from-violet-500/20 to-purple-500/10",
    iconColor: "text-violet-400",
    iconBg: "bg-violet-500/15 border-violet-500/20",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Search in plain English",
    desc: 'Type "ICU nurses in Dallas with CCRN certification" and Oslr\'s AI instantly translates it into structured filters across real-time data sources.',
    icon: MessageSquareText,
  },
  {
    num: "02",
    title: "Enrich and verify",
    desc: "One click gives you verified emails, phone numbers, work history, education, residency and fellowship details, and certifications.",
    icon: Shield,
  },
  {
    num: "03",
    title: "Sequence, track, and recruit",
    desc: "Save candidates to hiring projects, build personalized email sequences with merge fields, and track open rates and responses.",
    icon: Mail,
  },
];

const FEATURES = [
  { icon: MessageSquareText, title: "Natural Language Search", desc: "Just describe who you're looking for. No Boolean strings, no complex filters.", accent: "from-emerald-500/20 to-teal-500/10" },
  { icon: Database, title: "Real-Time Data", desc: "Aggregated from LinkedIn, professional registries, and dozens of sources. Always current.", accent: "from-blue-500/20 to-cyan-500/10" },
  { icon: Phone, title: "Contact Enrichment", desc: "Verified emails, direct phone numbers, and professional details in one click.", accent: "from-violet-500/20 to-purple-500/10" },
  { icon: Mail, title: "Email Sequences", desc: "Build personalized outreach templates with merge fields and send campaigns at scale.", accent: "from-amber-500/20 to-orange-500/10" },
  { icon: Target, title: "Match Scoring", desc: "Every candidate scored on title match, location, data completeness, and relevance.", accent: "from-rose-500/20 to-pink-500/10" },
  { icon: FolderKanban, title: "Hiring Projects", desc: "Organize candidates by role, department, or facility. Track your pipeline.", accent: "from-sky-500/20 to-indigo-500/10" },
  { icon: Users, title: "Team Collaboration", desc: "Invite your team, share projects, and track sourcing performance together.", accent: "from-teal-500/20 to-green-500/10" },
  { icon: BarChart3, title: "Analytics & Tracking", desc: "Monitor campaign performance, open rates, and recruiter activity.", accent: "from-fuchsia-500/20 to-pink-500/10" },
];

const NEWS_CATEGORIES = ["PE / M&A", "Policy", "Workforce", "Expansion", "Digital Health"];

const STATS = [
  { value: 1500, suffix: "M+", label: "Professional profiles" },
  { value: 200, suffix: "M+", label: "Verified contact records" },
  { value: 30, suffix: "+", label: "Real-time data sources" },
  { value: 100, suffix: "%", label: "Healthcare focused" },
];

/* ------------------------------------------------------------------ */
/*  Animated CTA button with glow                                      */
/* ------------------------------------------------------------------ */
function GlowButton({ children, size = "lg", className = "", ...props }: { children: React.ReactNode; size?: "default" | "lg"; className?: string; [key: string]: any }) {
  return (
    <motion.div className="relative group inline-flex" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
      {/* Subtle glow underneath only */}
      <div className="absolute -inset-1 rounded-xl bg-primary/30 blur-xl opacity-0 group-hover:opacity-60 transition-opacity duration-500 -z-10" />
      <Button
        size={size}
        className={`relative bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 transition-all ${className}`}
        {...props}
      >
        {children}
      </Button>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Landing Page                                                       */
/* ------------------------------------------------------------------ */

export default function Landing() {
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-sidebar text-sidebar-foreground">
      {/* ---- NAV ---- */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
          navScrolled
            ? "bg-[hsl(222,47%,9%)]/90 backdrop-blur-xl shadow-2xl shadow-black/40 border-b border-white/[0.08]"
            : "bg-[hsl(222,47%,9%)]/60 backdrop-blur-md border-b border-white/[0.04]"
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={oslrLogo} alt="Oslr" className="h-9 w-9 rounded-lg shadow-lg shadow-primary/20" />
            <span className="font-display text-xl font-bold tracking-tight text-white">oslr</span>
          </Link>
          <div className="hidden md:flex items-center gap-1 text-base font-medium">
            {[
              { label: "How It Works", href: "#how-it-works" },
              { label: "Features", href: "#features" },
              { label: "Intelligence", href: "#intelligence" },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-4 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-all"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10 text-base" asChild>
              <Link to="/auth">Log In</Link>
            </Button>
            <Button className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90 text-base px-5 shadow-lg shadow-primary/20" asChild>
              <Link to="/auth">Get Started Free</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* ---- HERO ---- */}
      <section className="relative pt-36 pb-8 md:pt-48 md:pb-12 px-4 overflow-hidden">
        {/* bg blobs */}
        <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-primary/12 blur-[140px] animate-gradient-float pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-emerald-500/10 blur-[120px] animate-gradient-float-reverse pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-teal-400/8 blur-[100px] pointer-events-none" />

        {/* subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative max-w-5xl mx-auto text-center space-y-10">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] text-white"
          >
            The New Way to Source{" "}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-primary via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                Healthcare Talent
              </span>
              <motion.span
                className="absolute -inset-x-4 -inset-y-2 rounded-2xl bg-gradient-to-r from-primary/30 via-emerald-400/20 to-teal-400/30 blur-2xl -z-10"
                animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.span
                className="absolute -inset-x-6 -inset-y-3 rounded-3xl bg-gradient-to-r from-emerald-500/15 via-primary/20 to-teal-500/15 blur-3xl -z-20"
                animate={{ opacity: [0.2, 0.5, 0.2], scale: [1.05, 1, 1.05] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              />
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.7 }}
            className="text-white/70 text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed"
          >
            Real-time data. Natural language AI. Verified contact info. Email sequences. Market intelligence. All in one platform built for healthcare recruiting.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
          >
            <TypingSearch />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.7 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <GlowButton size="lg" asChild>
              <Link to="/auth">
                Get Started Free <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </GlowButton>
            <Button size="lg" variant="outline" className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:border-white/40 hover:text-white backdrop-blur-sm" asChild>
              <a href="#how-it-works">See How It Works</a>
            </Button>
          </motion.div>

          {/* proof badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.7 }}
            className="flex flex-wrap justify-center gap-4 pt-4"
          >
            {["1.5B+ professional profiles", "Real-time data aggregation", "AI-powered matching"].map((badge) => (
              <span
                key={badge}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 text-xs font-medium"
              >
                <Sparkles className="h-3 w-3 text-primary" />
                {badge}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Product mockup */}
        <ProductMockup />
      </section>

      {/* ---- PROBLEM ---- */}
      <Section elevated>
        <div className="text-center mb-14">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-5 text-white">
            Recruiting technology hasn't kept up with healthcare
          </h2>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            The tools most teams rely on were built for a different era. Here's what's holding you back.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {PAIN_POINTS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.5 }}
              className="relative rounded-2xl border border-white/[0.10] bg-white/[0.04] backdrop-blur-sm p-8 space-y-4 hover:border-white/[0.18] hover:bg-white/[0.07] shadow-xl shadow-black/20 transition-all group overflow-hidden"
            >
              {/* Gradient background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${p.color} opacity-50 group-hover:opacity-80 transition-opacity`} />
              <div className="relative">
                <div className={`h-12 w-12 rounded-xl ${p.iconBg} border flex items-center justify-center`}>
                  <p.icon className={`h-6 w-6 ${p.iconColor}`} />
                </div>
                <h3 className="font-display text-xl font-semibold text-white mt-4">{p.title}</h3>
                <p className="text-white/60 text-base leading-relaxed mt-2">{p.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ---- HOW IT WORKS ---- */}
      <Section id="how-it-works">
        <div className="text-center mb-14">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-5 text-white">How It Works</h2>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            From search to outreach in three simple steps.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-10">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="relative space-y-4"
            >
              <span className="font-display text-6xl font-bold text-primary/15">{s.num}</span>
              <div className="h-14 w-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <s.icon className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-display text-2xl font-semibold text-white">{s.title}</h3>
              <p className="text-white/60 text-base leading-relaxed">{s.desc}</p>
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-16 -right-5 w-10 border-t border-dashed border-primary/20" />
              )}
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ---- FEATURES ---- */}
      <Section elevated id="features">
        <div className="text-center mb-14">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-5 text-white">
            Everything you need, nothing you don't
          </h2>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            One platform that replaces six tabs.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              className="relative rounded-2xl border border-white/[0.10] bg-white/[0.04] backdrop-blur-sm p-6 space-y-3 hover:border-primary/30 shadow-xl shadow-black/20 transition-all group overflow-hidden"
            >
              {/* Unique gradient accent per card */}
              <div className={`absolute inset-0 bg-gradient-to-br ${f.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              <div className="relative">
                <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/25 group-hover:border-primary/40 transition-all duration-300">
                  <f.icon className="h-5 w-5 text-primary group-hover:scale-110 transition-transform duration-300" />
                </div>
                <h3 className="font-display font-semibold text-base text-white mt-4">{f.title}</h3>
                <p className="text-white/55 text-sm leading-relaxed mt-2">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ---- MARKET INTELLIGENCE ---- */}
      <Section id="intelligence">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="font-display text-3xl md:text-4xl font-bold leading-tight text-white">
              More than sourcing.{" "}
              <span className="bg-gradient-to-r from-primary via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                Your daily healthcare intelligence briefing.
              </span>
            </h2>
            <p className="text-white/65 leading-relaxed">
              Stay ahead with curated news from Becker's, Healthcare Dive, Modern Healthcare, and more. Track private equity moves, M&A activity, system expansions, and policy changes. Build your daily digest so you're always the most informed recruiter in the room.
            </p>
            <GlowButton asChild>
              <Link to="/auth">
                Explore the News Feed <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </GlowButton>
          </div>
          {/* mock news cards */}
          <div className="space-y-3">
            {[
              { title: "HCA Healthcare announces $2.1B expansion across Southeast", cat: "Expansion", catColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
              { title: "Private equity activity in outpatient care hits record high", cat: "PE / M&A", catColor: "bg-violet-500/15 text-violet-400 border-violet-500/20" },
              { title: "New CMS staffing mandates: what recruiters need to know", cat: "Policy", catColor: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
            ].map((article, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                className="rounded-xl border border-white/[0.10] bg-white/[0.05] backdrop-blur-sm p-5 space-y-2.5 hover:bg-white/[0.08] hover:border-white/[0.15] shadow-lg shadow-black/15 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Newspaper className="h-4 w-4 text-primary" />
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${article.catColor}`}>
                    {article.cat}
                  </span>
                </div>
                <p className="text-base font-medium leading-snug text-white/90">{article.title}</p>
              </motion.div>
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
              {NEWS_CATEGORIES.map((c) => (
                <span key={c} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/50 text-xs font-medium">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ---- STATS BAR ---- */}
      <section className="py-14 md:py-16 px-4 bg-[hsl(222,47%,13%)] border-y border-white/[0.04]">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map((s) => (
            <div key={s.label} className="space-y-1">
              <p className="font-display text-4xl md:text-5xl font-bold text-primary">
                <CountUp target={s.value} suffix={s.suffix} />
              </p>
              <p className="text-white/60 text-base">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- FOR RECRUITERS ---- */}
      <Section>
        <div className="text-center mb-14">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-5 text-white">
            Built to make great recruiters{" "}
            <span className="bg-gradient-to-r from-primary via-emerald-400 to-teal-400 bg-clip-text text-transparent">
              unstoppable
            </span>
          </h2>
          <p className="text-white/65 text-lg max-w-2xl mx-auto">
            Whether you're an in-house talent acquisition team or an agency recruiter, Oslr gives you the data advantage. Find candidates your competitors can't, reach them faster, and close roles sooner.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: Zap, text: "10x faster sourcing with natural language", iconColor: "text-amber-400", iconBg: "bg-amber-500/15 border-amber-500/20" },
            { icon: CheckCircle2, text: "Verified contact info means no dead ends", iconColor: "text-emerald-400", iconBg: "bg-emerald-500/15 border-emerald-500/20" },
            { icon: Globe, text: "One platform instead of six tabs", iconColor: "text-sky-400", iconBg: "bg-sky-500/15 border-sky-500/20" },
          ].map((p, i) => (
            <motion.div
              key={p.text}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              className="flex items-start gap-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all"
            >
              <div className={`h-12 w-12 rounded-xl ${p.iconBg} border flex items-center justify-center shrink-0`}>
                <p.icon className={`h-6 w-6 ${p.iconColor}`} />
              </div>
              <p className="font-medium text-base text-white/90">{p.text}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ---- CTA ---- */}
      <Section elevated>
        <div className="text-center space-y-8 max-w-2xl mx-auto">
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white">Stop sourcing the old way.</h2>
          <p className="text-white/65 text-lg">
            Real-time data. AI search. Verified contacts. Email sequences. Market intelligence. All free to start.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <GlowButton size="lg" asChild>
              <Link to="/auth">
                Get Started Free <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </GlowButton>
          </div>
          <p className="text-white/30 text-xs">
            No credit card required. Start searching in under 60 seconds.
          </p>
        </div>
      </Section>

      {/* ---- FOOTER ---- */}
      <footer className="bg-[hsl(222,47%,6%)] text-sidebar-foreground border-t border-white/[0.04] px-4 py-12">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <img src={oslrLogo} alt="Oslr" className="h-7 w-7 rounded-md" />
              <span className="font-display text-lg font-bold text-white">oslr</span>
            </div>
            <p className="text-white/50 text-sm">The modern healthcare sourcing platform.</p>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-white/30 uppercase text-xs tracking-wider mb-2">Product</p>
            <Link to="/search" className="block text-white/50 hover:text-white transition-colors">Search</Link>
            <Link to="/projects" className="block text-white/50 hover:text-white transition-colors">Projects</Link>
            <Link to="/campaigns" className="block text-white/50 hover:text-white transition-colors">Campaigns</Link>
            <Link to="/news" className="block text-white/50 hover:text-white transition-colors">News</Link>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-white/30 uppercase text-xs tracking-wider mb-2">Company</p>
            <Link to="/auth" className="block text-white/50 hover:text-white transition-colors">Log In</Link>
            <Link to="/auth" className="block text-white/50 hover:text-white transition-colors">Sign Up</Link>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-white/[0.04] text-center text-white/25 text-xs">
          © {new Date().getFullYear()} Oslr. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
