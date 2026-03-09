import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Mail, Users, Send, Loader2 } from "lucide-react";
import { useDailySendUsage, useCompanyEmailSettings, type CampaignRow } from "@/hooks/useCampaigns";

interface SendCampaignConfirmDialogProps {
  campaign: CampaignRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isSending: boolean;
}

export function SendCampaignConfirmDialog({
  campaign,
  open,
  onOpenChange,
  onConfirm,
  isSending,
}: SendCampaignConfirmDialogProps) {
  const { data: sentToday = 0 } = useDailySendUsage();
  const { data: emailSettings } = useCompanyEmailSettings();

  if (!campaign) return null;

  const dailyLimit = emailSettings?.daily_email_limit ?? 200;
  const recipientCount = campaign.recipient_count || 0;
  const remaining = Math.max(0, dailyLimit - sentToday);
  const willSend = Math.min(recipientCount, remaining);
  const willSkip = recipientCount - willSend;
  const isPartial = willSkip > 0;
  const isBlocked = remaining === 0;

  const usagePercent = dailyLimit > 0 ? (sentToday / dailyLimit) * 100 : 0;
  const afterSendPercent = dailyLimit > 0 ? ((sentToday + willSend) / dailyLimit) * 100 : 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Send Campaign
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-2">
              {/* Campaign summary */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">{campaign.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {recipientCount} recipients
                  </p>
                </div>
              </div>

              {/* Daily usage */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Daily sending quota</span>
                  <span className="font-medium text-foreground">
                    {sentToday.toLocaleString()} / {dailyLimit.toLocaleString()}
                  </span>
                </div>
                <div className="relative">
                  <Progress value={usagePercent} className="h-2" />
                  {willSend > 0 && (
                    <div
                      className="absolute top-0 h-2 bg-primary/40 rounded-r-full transition-all"
                      style={{
                        left: `${usagePercent}%`,
                        width: `${Math.min(afterSendPercent - usagePercent, 100 - usagePercent)}%`,
                      }}
                    />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {remaining.toLocaleString()} emails remaining today
                </p>
              </div>

              {/* Warnings */}
              {isBlocked && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-destructive">
                    <p className="font-medium">Daily limit reached</p>
                    <p className="opacity-80">
                      You've sent {sentToday} emails today. Try again tomorrow or increase your daily limit in settings.
                    </p>
                  </div>
                </div>
              )}

              {isPartial && !isBlocked && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-warning">
                    <p className="font-medium">Partial send warning</p>
                    <p className="opacity-80">
                      Only {willSend} of {recipientCount} emails will be sent. {willSkip} will be skipped due to your daily limit.
                    </p>
                  </div>
                </div>
              )}

              {!isPartial && !isBlocked && (
                <p className="text-sm text-muted-foreground">
                  This will send <span className="font-medium text-foreground">{recipientCount}</span> personalized emails immediately.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isSending || isBlocked}
            className="gap-2"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {isPartial ? `Send ${willSend} Emails` : "Send Campaign"}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
