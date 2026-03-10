import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Search,
  MessageSquareText,
  Database,
  Mail,
  BarChart3,
  FolderKanban,
  Users,
  Activity,
  Zap,
  Clock,
  Layers,
  ArrowRight,
  CheckCircle2,
  Newspaper,
  TrendingUp,
  Building2,
  Shield,
  Sparkles,
  Target,
  Phone,
  Globe,
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
      className={`py-20 md:py-28 px-4 ${elevated ? "bg-[hsl(222,47%,13%)]" : "bg-sidebar"} text-sidebar-foreground ${className}`}
    >
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
  },
  {
    icon: Layers,
    title: "Manual Workflows",
    desc: "Copy-pasting between tabs, building spreadsheets, hand-writing outreach emails. Your time should be spent recruiting, not doing data entry.",
  },
  {
    icon: Zap,
    title: "Fragmented Tools",
    desc: "One tool to search, another to find emails, another to send campaigns, another to read industry news. Context-switching kills productivity.",
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
  { icon: MessageSquareText, title: "Natural Language Search", desc: "Just describe who you're looking for. No Boolean strings, no complex filters." },
  { icon: Database, title: "Real-Time Data", desc: "Aggregated from LinkedIn, professional registries, and dozens of sources. Always current." },
  { icon: Phone, title: "Contact Enrichment", desc: "Verified emails, direct phone numbers, and professional details in one click." },
  { icon: Mail, title: "Email Sequences", desc: "Build personalized outreach templates with merge fields and send campaigns at scale." },
  { icon: Target, title: "Match Scoring", desc: "Every candidate scored on title match, location, data completeness, and relevance." },
  { icon: FolderKanban, title: "Hiring Projects", desc: "Organize candidates by role, department, or facility. Track your pipeline." },
  { icon: Users, title: "Team Collaboration", desc: "Invite your team, share projects, and track sourcing performance together." },
  { icon: BarChart3, title: "Analytics & Tracking", desc: "Monitor campaign performance, open rates, and recruiter activity." },
];

const NEWS_CATEGORIES = ["PE / M&A", "Policy", "Workforce", "Expansion", "Digital Health"];

const STATS = [
  { value: 1500, suffix: "M+", label: "Professional profiles" },
  { value: 200, suffix: "M+", label: "Verified contact records" },
  { value: 30, suffix: "+", label: "Real-time data sources" },
  { value: 100, suffix: "%", label: "Healthcare focused" },
];

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
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          navScrolled ? "bg-sidebar/95 backdrop-blur-md shadow-lg shadow-black/20 border-b border-white/5" : "bg-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/" className="font-display text-xl font-bold tracking-tight text-white">
            oslr
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-white/50">
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#intelligence" className="hover:text-white transition-colors">Intelligence</a>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10" asChild>
              <Link to="/auth">Log In</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/auth">Get Started Free</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* ---- HERO ---- */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 px-4 overflow-hidden">
        {/* bg blobs */}
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-primary/8 blur-[120px] animate-gradient-float pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-emerald-500/6 blur-[100px] animate-gradient-float-reverse pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-teal-400/4 blur-[80px] pointer-events-none" />

        {/* subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative max-w-4xl mx-auto text-center space-y-8">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] text-white"
          >
            The New Way to Source{" "}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-primary via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                Healthcare Talent
              </span>
              {/* Glow effect underneath */}
              <motion.span
                className="absolute -inset-x-4 -inset-y-2 rounded-2xl bg-gradient-to-r from-primary/30 via-emerald-400/20 to-teal-400/30 blur-2xl -z-10"
                animate={{
                  opacity: [0.4, 0.7, 0.4],
                  scale: [1, 1.05, 1],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.span
                className="absolute -inset-x-6 -inset-y-3 rounded-3xl bg-gradient-to-r from-emerald-500/15 via-primary/20 to-teal-500/15 blur-3xl -z-20"
                animate={{
                  opacity: [0.2, 0.5, 0.2],
                  scale: [1.05, 1, 1.05],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              />
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.7 }}
            className="text-white/60 text-lg md:text-xl max-w-2xl mx-auto"
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
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Button size="lg" className="bg-gradient-to-r from-primary to-emerald-500 text-primary-foreground font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:brightness-110 transition-all" asChild>
              <Link to="/auth">
                Get Started Free <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
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
      </section>

      {/* ---- PROBLEM ---- */}
      <Section elevated>
        <div className="text-center mb-14">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 text-white">
            Recruiting technology hasn't kept up with healthcare
          </h2>
          <p className="text-white/50 max-w-xl mx-auto">
            The tools most teams rely on were built for a different era. Here's what's holding you back.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {PAIN_POINTS.map((p) => (
            <div key={p.title} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-6 space-y-3 hover:bg-white/[0.05] transition-colors">
              <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
                <p.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display text-lg font-semibold text-white">{p.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---- HOW IT WORKS ---- */}
      <Section id="how-it-works">
        <div className="text-center mb-14">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 text-white">How It Works</h2>
          <p className="text-white/50 max-w-xl mx-auto">
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
              <span className="font-display text-5xl font-bold text-primary/10">{s.num}</span>
              <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <s.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold text-white">{s.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ---- FEATURES ---- */}
      <Section elevated id="features">
        <div className="text-center mb-14">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 text-white">
            Everything you need, nothing you don't
          </h2>
          <p className="text-white/50 max-w-xl mx-auto">
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
              className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5 space-y-3 hover:bg-white/[0.06] hover:border-primary/20 transition-all group"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <f.icon className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-sm text-white">{f.title}</h3>
              <p className="text-white/40 text-xs leading-relaxed">{f.desc}</p>
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
            <p className="text-white/50 leading-relaxed">
              Stay ahead with curated news from Becker's, Healthcare Dive, Modern Healthcare, and more. Track private equity moves, M&A activity, system expansions, and policy changes. Build your daily digest so you're always the most informed recruiter in the room.
            </p>
            <Button asChild>
              <Link to="/auth">
                Explore the News Feed <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
          {/* mock news cards */}
          <div className="space-y-3">
            {[
              { title: "HCA Healthcare announces $2.1B expansion across Southeast", cat: "Expansion" },
              { title: "Private equity activity in outpatient care hits record high", cat: "PE / M&A" },
              { title: "New CMS staffing mandates: what recruiters need to know", cat: "Policy" },
            ].map((article, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 space-y-2 hover:bg-white/[0.05] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Newspaper className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                    {article.cat}
                  </span>
                </div>
                <p className="text-sm font-medium leading-snug text-white/80">{article.title}</p>
              </motion.div>
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
              {NEWS_CATEGORIES.map((c) => (
                <span key={c} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/40 text-xs font-medium">
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
              <p className="font-display text-3xl md:text-4xl font-bold text-primary">
                <CountUp target={s.value} suffix={s.suffix} />
              </p>
              <p className="text-white/40 text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- FOR RECRUITERS ---- */}
      <Section>
        <div className="text-center mb-14">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 text-white">
            Built to make great recruiters{" "}
            <span className="bg-gradient-to-r from-primary via-emerald-400 to-teal-400 bg-clip-text text-transparent">
              unstoppable
            </span>
          </h2>
          <p className="text-white/50 max-w-2xl mx-auto">
            Whether you're an in-house talent acquisition team or an agency recruiter, Oslr gives you the data advantage. Find candidates your competitors can't, reach them faster, and close roles sooner. This isn't about replacing your expertise — it's about amplifying it.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: Zap, text: "10x faster sourcing with natural language" },
            { icon: CheckCircle2, text: "Verified contact info means no dead ends" },
            { icon: Globe, text: "One platform instead of six tabs" },
          ].map((p, i) => (
            <motion.div
              key={p.text}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              className="flex items-start gap-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 hover:bg-white/[0.05] transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <p.icon className="h-5 w-5 text-primary" />
              </div>
              <p className="font-medium text-sm text-white/80">{p.text}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ---- CTA ---- */}
      <Section elevated>
        <div className="text-center space-y-6 max-w-xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white">Stop sourcing the old way.</h2>
          <p className="text-white/50">
            Real-time data. AI search. Verified contacts. Email sequences. Market intelligence. All free to start.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/auth">
                Get Started Free <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
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
            <p className="font-display text-lg font-bold mb-1 text-white">oslr</p>
            <p className="text-white/40 text-sm">The modern healthcare sourcing platform.</p>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-white/30 uppercase text-xs tracking-wider mb-2">Product</p>
            <Link to="/search" className="block text-white/40 hover:text-white transition-colors">Search</Link>
            <Link to="/projects" className="block text-white/40 hover:text-white transition-colors">Projects</Link>
            <Link to="/campaigns" className="block text-white/40 hover:text-white transition-colors">Campaigns</Link>
            <Link to="/news" className="block text-white/40 hover:text-white transition-colors">News</Link>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-white/30 uppercase text-xs tracking-wider mb-2">Company</p>
            <Link to="/auth" className="block text-white/40 hover:text-white transition-colors">Log In</Link>
            <Link to="/auth" className="block text-white/40 hover:text-white transition-colors">Sign Up</Link>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-white/[0.04] text-center text-white/20 text-xs">
          © {new Date().getFullYear()} Oslr. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
