import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function GoogleSheetsReturn() {
  const [message, setMessage] = useState("Finishing your Google connection...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notify = (type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed", reason?: string) => {
      window.opener?.postMessage({ type, connectorId: "google_sheets", reason }, window.location.origin);
      window.close();
    };
    if (params.get("success") !== "true") {
      setMessage(params.get("error") ?? "Google did not finish connecting.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    const code = params.get("code");
    if (!code) {
      const reason = params.get("offline_access_allowed") === "false"
        ? "Google connected, but Oslr was not allowed to keep access. Ask your admin to turn on offline access."
        : "Google did not return a connection code.";
      setMessage(reason);
      window.opener?.postMessage({ type: "appUserConnectorOAuthFailed", connectorId: "google_sheets", reason }, window.location.origin);
      return;
    }
    void supabase.functions.invoke("exports", { body: { action: "google_complete", code } }).then(({ error }) => {
      if (error) throw error;
      notify("appUserConnectorOAuthComplete");
    }).catch(() => {
      setMessage("Could not finish the Google connection.");
      notify("appUserConnectorOAuthFailed");
    });
  }, []);

  return <div className="min-h-screen flex items-center justify-center p-6 text-sm text-muted-foreground">{message}</div>;
}
