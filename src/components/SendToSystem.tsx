import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";

type Conn = { id: string; provider_name: string | null; category: string };

/** Sends every person in a project to a connected ATS or CRM. Hidden when nothing is connected. */
export function SendToSystem({ projectId }: { projectId: string }) {
  const [conns, setConns] = useState<Conn[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.functions.invoke("merge-integrations", { body: { action: "status" } })
      .then(({ data }) => setConns(data?.allowed ? data.connections ?? [] : []));
  }, []);
  if (!conns.length) return null;
  const send = async (c: Conn) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("merge-integrations", { body: { action: "push", id: c.id, project_id: projectId } });
    setBusy(false);
    if (error) return toast.error(`Could not send to ${c.provider_name}.`);
    toast.success(`Sent ${data.sent} to ${c.provider_name}.${data.failed ? ` ${data.failed} did not go through.` : ""}`);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send to ATS or CRM</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Send this project to</DropdownMenuLabel>
        {conns.map((c) => <DropdownMenuItem key={c.id} onClick={() => send(c)}>{c.provider_name}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
