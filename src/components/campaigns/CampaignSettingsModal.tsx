import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export function CampaignSettingsModal({
  open,
  onOpenChange,
  useMultipleSenders,
  newThreadPerSender,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  useMultipleSenders: boolean;
  newThreadPerSender: boolean;
  onChange: (s: { useMultipleSenders: boolean; newThreadPerSender: boolean }) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Campaign Settings</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Configure sender and threading options for this campaign.
          </p>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="flex gap-3">
            <Switch
              checked={useMultipleSenders}
              onCheckedChange={(v) =>
                onChange({ useMultipleSenders: v, newThreadPerSender })
              }
            />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">Use multiple senders</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Allow different mailboxes to send emails in this campaign. Each email
                step can have its own sender. When disabled, all emails will be sent
                from the primary sender.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Switch
              checked={newThreadPerSender}
              onCheckedChange={(v) =>
                onChange({ useMultipleSenders, newThreadPerSender: v })
              }
            />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">New thread per sender</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                When OFF: All senders participate in the same email thread. Each
                additional sender in the campaign will be CC'd on steps.
                <br />
                When ON: Each sender starts their own separate email thread with a
                unique subject line that you can customize per sender.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
