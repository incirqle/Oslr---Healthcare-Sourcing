import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useInvites } from "@/hooks/useInvites";
import { useOnboarding } from "@/hooks/useOnboarding";
import { toast } from "sonner";

type Role = "admin" | "recruiter" | "viewer";
interface Pending {
  email: string;
  role: Role;
}

export function Step3Invites({ onComplete }: { onComplete: () => void }) {
  const { create } = useInvites();
  const { completeStep } = useOnboarding();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [sending, setSending] = useState(false);

  const addEmail = () => {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      toast.error("Enter a valid email");
      return;
    }
    if (pending.find((p) => p.email === e)) return;
    setPending((p) => [...p, { email: e, role: "recruiter" }]);
    setEmail("");
  };

  const updateRole = (e: string, role: Role) =>
    setPending((p) => p.map((x) => (x.email === e ? { ...x, role } : x)));
  const removeEmail = (e: string) => setPending((p) => p.filter((x) => x.email !== e));

  const handleSend = async () => {
    if (pending.length === 0) return;
    setSending(true);
    try {
      for (const p of pending) {
        await create.mutateAsync(p);
      }
      await completeStep.mutateAsync("invites");
      toast.success(`Sent ${pending.length} invite${pending.length === 1 ? "" : "s"}`);
      setPending([]);
      onComplete();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send invites");
    } finally {
      setSending(false);
    }
  };

  const handleSkip = async () => {
    await completeStep.mutateAsync("invites");
    onComplete();
  };

  return (
    <div className="space-y-4 pl-10">
      <div className="space-y-2">
        <Label htmlFor="invite-email" className="text-sm">
          Invite by email
        </Label>
        <div className="flex gap-2">
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail())}
            placeholder="teammate@hospital.com"
          />
          <Button type="button" variant="outline" onClick={addEmail}>
            Add
          </Button>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="space-y-2">
          {pending.map((p) => (
            <div
              key={p.email}
              className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
            >
              <Badge variant="secondary" className="font-normal">
                {p.email}
              </Badge>
              <div className="flex-1" />
              <Select value={p.role} onValueChange={(v) => updateRole(p.email, v as Role)}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="recruiter">Recruiter</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => removeEmail(p.email)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={handleSend} disabled={pending.length === 0 || sending}>
          {sending ? "Sending…" : "Send invites"}
        </Button>
        <Button variant="ghost" onClick={handleSkip}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}
