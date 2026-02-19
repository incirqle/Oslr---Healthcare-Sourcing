import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  ChevronDown,
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
      <div className="flex items-center rounded-xl border-2 border-primary/30 bg-card shadow-xl px-4 py-3 gap-3">
        <Search className="h-5 w-5 text-muted-foreground shrink-0" />
        <span className="text-base md:text-lg text-foreground truncate">
          {displayed}
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ repeat: Infinity, duration: 0.7 }}
            className="inline-block w-[2px] h-5 bg-primary ml-0.5 align-middle"
          />
        </span>
      </div>
      {/* filter chips */}
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
                className="px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-medium"
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
  dark = false,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  dark?: boolean;
  id?: string;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`py-20 md:py-28 px-4 ${dark ? "bg-sidebar text-sidebar-foreground" : "bg-background text-foreground"} ${className}`}
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
    <div className="min-h-screen bg-background">
      {/* ---- NAV ---- */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          navScrolled ? "bg-background/90 backdrop-blur-md shadow-sm" : "bg-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/" className="font-display text-xl font-bold tracking-tight text-foreground">
            oslr
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#intelligence" className="hover:text-foreground transition-colors">Intelligence</a>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/auth">Log In</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/auth">Get Started Free</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* ---- HERO ---- */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 px-4 overflow-hidden bg-background">
        {/* bg blobs */}
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-primary/10 blur-3xl animate-gradient-float pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-[400px] h-[400px] rounded-full bg-primary/8 blur-3xl animate-gradient-float-reverse pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center space-y-8">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]"
          >
            The New Way to Source{" "}
            <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              Healthcare Talent
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.7 }}
            className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto"
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
            <Button size="lg" asChild>
              <Link to="/auth">
                Get Started Free <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-xs font-medium"
              >
                <Sparkles className="h-3 w-3 text-primary" />
                {badge}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---- PROBLEM ---- */}
      <Section dark>
        <div className="text-center mb-14">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Recruiting technology hasn't kept up with healthcare
          </h2>
          <p className="text-sidebar-foreground/70 max-w-xl mx-auto">
            The tools most teams rely on were built for a different era. Here's what's holding you back.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {PAIN_POINTS.map((p) => (
            <div key={p.title} className="rounded-xl bg-sidebar-accent p-6 space-y-3">
              <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
                <p.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display text-lg font-semibold">{p.title}</h3>
              <p className="text-sidebar-foreground/70 text-sm leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---- HOW IT WORKS ---- */}
      <Section id="how-it-works">
        <div className="text-center mb-14">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            From search to outreach in three simple steps.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-10">
          {STEPS.map((s) => (
            <div key={s.num} className="relative space-y-4">
              <span className="font-display text-5xl font-bold text-primary/15">{s.num}</span>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <s.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold">{s.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---- FEATURES ---- */}
      <Section dark id="features">
        <div className="text-center mb-14">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Everything you need, nothing you don't
          </h2>
          <p className="text-sidebar-foreground/70 max-w-xl mx-auto">
            One platform that replaces six tabs.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl bg-sidebar-accent p-5 space-y-3 hover:bg-sidebar-accent/80 transition-colors"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center">
                <f.icon className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-sm">{f.title}</h3>
              <p className="text-sidebar-foreground/60 text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---- MARKET INTELLIGENCE ---- */}
      <Section id="intelligence">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="font-display text-3xl md:text-4xl font-bold leading-tight">
              More than sourcing.{" "}
              <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                Your daily healthcare intelligence briefing.
              </span>
            </h2>
            <p className="text-muted-foreground leading-relaxed">
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
                className="rounded-lg border bg-card p-4 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Newspaper className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {article.cat}
                  </span>
                </div>
                <p className="text-sm font-medium leading-snug">{article.title}</p>
              </motion.div>
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
              {NEWS_CATEGORIES.map((c) => (
                <span key={c} className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ---- STATS BAR ---- */}
      <Section dark className="py-14 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map((s) => (
            <div key={s.label} className="space-y-1">
              <p className="font-display text-3xl md:text-4xl font-bold text-primary">
                <CountUp target={s.value} suffix={s.suffix} />
              </p>
              <p className="text-sidebar-foreground/60 text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---- FOR RECRUITERS ---- */}
      <Section>
        <div className="text-center mb-14">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Built to make great recruiters{" "}
            <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              unstoppable
            </span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Whether you're an in-house talent acquisition team or an agency recruiter, Oslr gives you the data advantage. Find candidates your competitors can't, reach them faster, and close roles sooner. This isn't about replacing your expertise — it's about amplifying it.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: Zap, text: "10x faster sourcing with natural language" },
            { icon: CheckCircle2, text: "Verified contact info means no dead ends" },
            { icon: Globe, text: "One platform instead of six tabs" },
          ].map((p) => (
            <div key={p.text} className="flex items-start gap-4 rounded-xl border bg-card p-5">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <p.icon className="h-5 w-5 text-primary" />
              </div>
              <p className="font-medium text-sm">{p.text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---- CTA ---- */}
      <Section dark>
        <div className="text-center space-y-6 max-w-xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-bold">Stop sourcing the old way.</h2>
          <p className="text-sidebar-foreground/70">
            Real-time data. AI search. Verified contacts. Email sequences. Market intelligence. All free to start.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/auth">
                Get Started Free <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <p className="text-sidebar-foreground/50 text-xs">
            No credit card required. Start searching in under 60 seconds.
          </p>
        </div>
      </Section>

      {/* ---- FOOTER ---- */}
      <footer className="bg-sidebar text-sidebar-foreground border-t border-sidebar-border px-4 py-12">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
          <div>
            <p className="font-display text-lg font-bold mb-1">oslr</p>
            <p className="text-sidebar-foreground/50 text-sm">The modern healthcare sourcing platform.</p>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-sidebar-foreground/70 uppercase text-xs tracking-wider mb-2">Product</p>
            <Link to="/search" className="block text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">Search</Link>
            <Link to="/projects" className="block text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">Projects</Link>
            <Link to="/campaigns" className="block text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">Campaigns</Link>
            <Link to="/news" className="block text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">News</Link>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-sidebar-foreground/70 uppercase text-xs tracking-wider mb-2">Company</p>
            <Link to="/auth" className="block text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">Log In</Link>
            <Link to="/auth" className="block text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">Sign Up</Link>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-sidebar-border text-center text-sidebar-foreground/40 text-xs">
          © {new Date().getFullYear()} Oslr. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
