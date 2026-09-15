/**
 * search-clinicians/index.ts — HTTP entry point.
 *
 * The whole pipeline lives in handler.ts (exported so the search-people
 * adapter can run the engine in-process behind the legacy wire contract).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleClinicianSearch } from "./handler.ts";

serve(handleClinicianSearch);
