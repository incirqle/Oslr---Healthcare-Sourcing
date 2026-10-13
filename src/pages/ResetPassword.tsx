import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) setReady(true);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return toast.error("The two passwords don't match.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Your password has been updated.");
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm shadow-lg border-border/60">
        <CardHeader className="text-center pb-4">
          <CardTitle className="font-display text-xl">Set a new password</CardTitle>
          <CardDescription className="text-xs">
            {ready ? "Choose a new password for your account." : "Open this page from the link in your reset email."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ready ? (
            <form onSubmit={submit} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="pw" className="text-xs">New password</Label>
                <Input id="pw" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw2" className="text-xs">Confirm new password</Label>
                <Input id="pw2" type="password" minLength={6} required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-9" />
              </div>
              <Button type="submit" className="w-full h-9" disabled={loading}>
                {loading ? "Saving..." : "Save new password"}
              </Button>
            </form>
          ) : (
            <Button variant="outline" className="w-full h-9" onClick={() => navigate("/auth")}>Back to sign in</Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
