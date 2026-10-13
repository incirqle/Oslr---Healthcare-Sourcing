import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Users, FolderKanban, Download, Eye, EyeOff, Check } from "lucide-react";
import oslrWordmark from "@/assets/oslr-wordmark.svg";
import oslrLogo from "@/assets/oslr-logo.svg";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";

const features = [
  { icon: Search, title: "AI-Powered Search", desc: "Find healthcare professionals with natural language queries" },
  { icon: Users, title: "Candidate Management", desc: "Track and manage your recruiting pipeline in one place" },
  { icon: FolderKanban, title: "Project Organization", desc: "Organize candidates into hiring projects by role" },
  { icon: Download, title: "CSV Export", desc: "Export saved clinicians and contact details from your projects" },
];

export default function Auth() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const SIGNUPS_DISABLED = false;
  const [isSignUp, setIsSignUp] = useState(searchParams.get("mode") === "signup" || !!inviteToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<{ email: string; companyName: string } | null>(null);
  const navigate = useNavigate();

  // Resolve invite token through a locked-down lookup: it reveals only the
  // invited email and team name for that exact token.
  useEffect(() => {
    if (!inviteToken) return;
    (async () => {
      const { data } = await supabase.rpc("get_invite_by_token", { _token: inviteToken });
      const invite = Array.isArray(data) ? data[0] : null;
      if (!invite || invite.accepted) return;
      setInviteInfo({ email: invite.email, companyName: invite.company_name ?? "your team" });
      setEmail(invite.email);
    })();
  }, [inviteToken]);

  // Already signed in (including the return trip from Google): go into the app.
  const { user, loading: authLoading } = useAuth();
  useEffect(() => {
    if (!authLoading && user) navigate("/dashboard", { replace: true });
  }, [user, authLoading, navigate]);

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth`,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate("/dashboard");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: {
              full_name: fullName,
              ...(inviteToken ? { invite_token: inviteToken } : {}),
            },
          },
        });
        if (error) throw error;
        toast.success(
          inviteToken
            ? "Check your email to confirm your account and join the team!"
            : "Check your email to confirm your account!",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/dashboard");
      }
    } catch (error: any) {
      const msg = String(error?.message ?? "");
      if (/invalid login credentials/i.test(msg)) {
        toast.error("Email or password doesn't match. New here? Choose \"Create account\" at the top.");
      } else if (/already registered|already exists/i.test(msg)) {
        toast.error("You already have an account with this email. Choose \"Sign in\" at the top.");
        setIsSignUp(false);
      } else if (/email not confirmed/i.test(msg)) {
        toast.error("Please open the confirmation email we sent you, then sign in.");
      } else if (/password/i.test(msg)) {
        toast.error("Please use a password with at least 6 characters.");
      } else {
        toast.error(msg || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel - Feature highlights */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[hsl(222,47%,11%)] via-[hsl(222,47%,14%)] to-[hsl(199,89%,20%)]">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, hsl(199 89% 48% / 0.4) 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />
        {/* Glow accent */}
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-primary/10 blur-[120px]" />

        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16">
          <div className="flex items-center gap-3 mb-10">
            <img src={oslrWordmark} alt="Oslr" className="h-6" />
          </div>

          <h2 className="text-3xl xl:text-4xl font-bold font-display text-white leading-tight mb-3">
            Smarter{" "}
            <span className="bg-gradient-to-r from-primary via-emerald-400 to-teal-400 bg-clip-text text-transparent">
              healthcare talent sourcing
            </span>
          </h2>
          <p className="text-[hsl(213,31%,70%)] text-base mb-10 max-w-md">
            The modern recruiting platform built for healthcare staffing teams. Find nurses, doctors, and specialists with AI-powered search.
          </p>

          <div className="space-y-5">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(222,47%,18%)] border border-[hsl(222,30%,22%)]">
                  <f.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{f.title}</p>
                  <p className="text-xs text-[hsl(213,31%,55%)] mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - Auth form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-center mb-8 lg:hidden">
            <img src={oslrLogo} alt="Oslr" className="h-16 w-16 rounded-2xl" />
          </div>

          {inviteInfo && (
            <div className="mb-4 rounded-lg border border-primary/30 bg-primary/10 p-3 text-center">
              <p className="text-sm text-foreground">
                You've been invited to join <strong>{inviteInfo.companyName}</strong>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sign up with {inviteInfo.email} to accept
              </p>
            </div>
          )}

          {!SIGNUPS_DISABLED && (
            <div className="mb-4 grid grid-cols-2 rounded-xl border border-border bg-muted/40 p-1" role="tablist">
              {[{ v: false, l: "Sign in" }, { v: true, l: "Create account" }].map((t) => (
                <button
                  key={t.l}
                  type="button"
                  role="tab"
                  aria-selected={isSignUp === t.v}
                  onClick={() => setIsSignUp(t.v)}
                  className={`h-11 rounded-lg text-base font-semibold transition-colors ${isSignUp === t.v ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t.l}
                </button>
              ))}
            </div>
          )}
          <Card className="shadow-lg border-border/60">
            <CardHeader className="text-center pb-4">
              <CardTitle className="font-display text-xl">{isSignUp ? "Create an account" : "Welcome back"}</CardTitle>
              <CardDescription className="text-xs">
                {isSignUp
                  ? "Start sourcing healthcare professionals"
                  : "Sign in to your recruiting platform"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {isSignUp && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-sm font-medium">Full name</Label>
                    <Input
                      id="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Dr. Jane Smith"
                      required
                      className="h-11 text-base"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@hospital.com"
                    required
                    className="h-11 text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                    {!isSignUp && (
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={async () => {
                          if (!email) {
                            document.getElementById("email")?.focus();
                            return toast("Type your email above, then tap \"Forgot password?\" again.");
                          }
                          const { error } = await supabase.auth.resetPasswordForEmail(email, {
                            redirectTo: `${window.location.origin}/reset-password`,
                          });
                          if (error) return toast.error(error.message);
                          toast.success("Check your email for a link to reset your password.");
                        }}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isSignUp ? "At least 6 characters" : "Your password"}
                      minLength={6}
                      required
                      className="h-11 pr-16 text-base"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {isSignUp && (
                    <p className={`flex items-center gap-1.5 text-sm ${password.length >= 6 ? "text-primary" : "text-muted-foreground"}`}>
                      <Check className="h-4 w-4" />
                      {password.length >= 6 ? "Looks good" : "Any password with 6 or more characters works"}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                  {loading ? "Loading..." : isSignUp ? "Create account" : "Sign in"}
                </Button>
              </form>
              <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" />
              </div>
              <Button type="button" variant="outline" className="w-full h-11 text-base" onClick={handleGoogle} disabled={loading}>
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"/></svg>
                Continue with Google
              </Button>
              <div className="mt-4 text-center text-xs text-muted-foreground">
                {SIGNUPS_DISABLED ? (
                  <span>New sign-ups are currently closed.</span>
                ) : (
                  <>
                    {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                    <button
                      onClick={() => setIsSignUp(!isSignUp)}
                      className="text-primary hover:underline font-medium"
                    >
                      {isSignUp ? "Sign in" : "Sign up"}
                    </button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
