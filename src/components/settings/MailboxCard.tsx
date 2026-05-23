import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mailbox, CheckCircle2, AlertTriangle, Loader2, Plug, Unplug } from "lucide-react";
import {
  useMyMailboxes,
  useConnectMailbox,
  useDisconnectMailbox,
  type UserMailbox,
} from "@/hooks/useMailbox";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

function ProviderLabel({ provider }: { provider: string }) {
  if (provider === "google") return <span>Gmail</span>;
  if (provider === "microsoft") return <span>Outlook</span>;
  return <span className="capitalize">{provider}</span>;
}

export function MailboxCard() {
  const { data: mailboxes = [], isLoading } = useMyMailboxes();
  const connect = useConnectMailbox();
  const disconnect = useDisconnectMailbox();
  const [params, setParams] = useSearchParams();

  // Handle callback redirect state (?mailbox=connected | ?mailbox=error&reason=...)
  useEffect(() => {
    const status = params.get("mailbox");
    if (!status) return;
    if (status === "connected") toast.success("Mailbox connected");
    if (status === "error") toast.error(params.get("reason") || "Failed to connect mailbox");
    const next = new URLSearchParams(params);
    next.delete("mailbox");
    next.delete("reason");
    setParams(next, { replace: true });
  }, [params, setParams]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0 mt-0.5">
            <Mailbox className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base font-display">Sending Mailbox</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Connect your Gmail or Outlook account so campaign emails are sent from your real
              inbox. Required for outreach campaigns.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading mailboxes…
          </div>
        ) : mailboxes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 p-4 text-xs text-muted-foreground">
            No mailbox connected yet. Connect one to enable campaign sending.
          </div>
        ) : (
          <div className="space-y-2">
            {mailboxes.map((mb) => (
              <MailboxRow
                key={mb.id}
                mailbox={mb}
                onDisconnect={() =>
                  disconnect
                    .mutateAsync(mb.id)
                    .then(() => toast.success("Mailbox disconnected"))
                    .catch((e) => toast.error(e.message || "Disconnect failed"))
                }
                disabled={disconnect.isPending}
              />
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              connect.mutateAsync("google").catch((e) => toast.error(e.message || "Connect failed"))
            }
            disabled={connect.isPending}
          >
            {connect.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Plug className="h-3.5 w-3.5 mr-1.5" />
            )}
            Connect Gmail
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              connect
                .mutateAsync("microsoft")
                .catch((e) => toast.error(e.message || "Connect failed"))
            }
            disabled={connect.isPending}
          >
            <Plug className="h-3.5 w-3.5 mr-1.5" />
            Connect Outlook
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MailboxRow({
  mailbox,
  onDisconnect,
  disabled,
}: {
  mailbox: UserMailbox;
  onDisconnect: () => void;
  disabled: boolean;
}) {
  const isActive = mailbox.status === "active";
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{mailbox.email}</span>
          <Badge variant="outline" className="text-[10px] py-0 h-4">
            <ProviderLabel provider={mailbox.provider} />
          </Badge>
          {isActive ? (
            <Badge className="text-[10px] py-0 h-4 bg-primary/15 text-primary border-primary/30">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
            </Badge>
          ) : (
            <Badge variant="destructive" className="text-[10px] py-0 h-4">
              <AlertTriangle className="h-3 w-3 mr-1" /> {mailbox.status}
            </Badge>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          Connected {formatDistanceToNow(new Date(mailbox.connected_at), { addSuffix: true })}
          {mailbox.last_error ? ` · ${mailbox.last_error}` : ""}
        </div>
      </div>
      <Button size="sm" variant="ghost" onClick={onDisconnect} disabled={disabled}>
        <Unplug className="h-3.5 w-3.5 mr-1.5" />
        Disconnect
      </Button>
    </div>
  );
}
