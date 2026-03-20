import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Star, Loader2, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import { useCreateAgent, useSequences } from "@/hooks/useAgents";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ParsedPayload {
  clinical_role: string;
  specialty: string | null;
  practice_setting: string | null;
  employer: string | null;
  location: { city: string | null; metro: string | null; state: string | null };
  salary_min: number | null;
  salary_max: number | null;
  tenure_min_years: number | null;
  active_status: string;
}

interface AgentCreateWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CLINICAL_ROLES = [
  { value: "physician", label: "Physician" },
  { value: "np", label: "Nurse Practitioner" },
  { value: "pa", label: "Physician Assistant" },
  { value: "crna", label: "CRNA" },
  { value: "rn", label: "Registered Nurse" },
  { value: "allied_health", label: "Allied Health" },
  { value: "admin", label: "Admin" },
  { value: "general", label: "General" },
];

const PRACTICE_SETTINGS = [
  { value: "hospital", label: "Hospital" },
  { value: "ambulatory", label: "Ambulatory" },
  { value: "outpatient", label: "Outpatient" },
  { value: "private_practice", label: "Private Practice" },
  { value: "telehealth", label: "Telehealth" },
];

export function AgentCreateWizard({ open, onOpenChange }: AgentCreateWizardProps) {
  const [step, setStep] = useState(1);
  const [roleDescription, setRoleDescription] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedPayload | null>(null);
  const [pdlQuery, setPdlQuery] = useState<Record<string, unknown> | null>(null);
  const [pinnedCriteria, setPinnedCriteria] = useState<string[]>([]);

  // Step 2 editable fields
  const [clinicalRole, setClinicalRole] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [salaryMin, setSalaryMin] = useState<string>("");
  const [salaryMax, setSalaryMax] = useState<string>("");
  const [tenureMin, setTenureMin] = useState<string>("");
  const [practiceSetting, setPracticeSetting] = useState("");
  const [employer, setEmployer] = useState("");

  // Step 3
  const [sequenceMode, setSequenceMode] = useState("shortlist");
  const [sequenceId, setSequenceId] = useState("");
  const { data: sequences = [] } = useSequences();

  // Step 4
  const [dailyQuota, setDailyQuota] = useState(5);

  // Step 5
  const [agentName, setAgentName] = useState("");

  const createAgent = useCreateAgent();
  const navigate = useNavigate();

  const handleParse = async () => {
    if (!roleDescription.trim()) return;
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("agent-parse", {
        body: { role_description: roleDescription },
      });
      if (error) throw error;
      const p = data.parsed_payload as ParsedPayload;
      setParsed(p);
      setPdlQuery(data.pdl_query);

      // Pre-fill editable fields
      setClinicalRole(p.clinical_role || "");
      setSpecialty(p.specialty || "");
      setCity(p.location?.city || "");
      setState(p.location?.state || "");
      setSalaryMin(p.salary_min ? String(p.salary_min) : "");
      setSalaryMax(p.salary_max ? String(p.salary_max) : "");
      setTenureMin(p.tenure_min_years ? String(p.tenure_min_years) : "");
      setPracticeSetting(p.practice_setting || "");
      setEmployer(p.employer || "");

      // Auto-generate agent name
      const nameParts = [p.specialty || clinicalRole, p.location?.city].filter(Boolean);
      setAgentName(nameParts.join(" — ") || "New Agent");

      setStep(2);
    } catch (err: any) {
      toast.error(err.message || "Failed to parse role description");
    } finally {
      setParsing(false);
    }
  };

  const togglePin = (criterion: string) => {
    setPinnedCriteria((prev) =>
      prev.includes(criterion)
        ? prev.filter((c) => c !== criterion)
        : [...prev, criterion]
    );
  };

  const criteriaFields = [
    { key: "clinical_role", label: `Clinical role: ${clinicalRole}` },
    specialty && { key: "specialty", label: `Specialty: ${specialty}` },
    city && { key: "location", label: `Location: ${city}${state ? `, ${state}` : ""}` },
    salaryMin && { key: "salary", label: `Salary: $${salaryMin}${salaryMax ? `–$${salaryMax}` : "+"}` },
    tenureMin && { key: "tenure", label: `Min tenure: ${tenureMin} years` },
    practiceSetting && { key: "practice", label: `Setting: ${practiceSetting}` },
    employer && { key: "employer", label: `Employer: ${employer}` },
  ].filter(Boolean) as { key: string; label: string }[];

  const handleCreate = async () => {
    try {
      const finalPayload: ParsedPayload = {
        clinical_role: clinicalRole,
        specialty: specialty || null,
        practice_setting: practiceSetting || null,
        employer: employer || null,
        location: { city: city || null, metro: null, state: state || null },
        salary_min: salaryMin ? Number(salaryMin) : null,
        salary_max: salaryMax ? Number(salaryMax) : null,
        tenure_min_years: tenureMin ? Number(tenureMin) : null,
        active_status: "current",
      };

      const id = await createAgent.mutateAsync({
        name: agentName.trim() || "New Agent",
        role_description: roleDescription,
        parsed_payload: finalPayload as any,
        pdl_query: pdlQuery || undefined,
        criteria_pinned: pinnedCriteria,
        sequence_mode: sequenceMode,
        sequence_id: sequenceId || undefined,
        daily_lead_quota: dailyQuota,
      });

      toast.success("Agent created! Starting calibration...");
      onOpenChange(false);
      resetState();
      navigate(`/agents/${id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create agent");
    }
  };

  const resetState = () => {
    setStep(1);
    setRoleDescription("");
    setParsed(null);
    setPdlQuery(null);
    setPinnedCriteria([]);
    setClinicalRole("");
    setSpecialty("");
    setCity("");
    setState("");
    setSalaryMin("");
    setSalaryMax("");
    setTenureMin("");
    setPracticeSetting("");
    setEmployer("");
    setSequenceMode("shortlist");
    setSequenceId("");
    setDailyQuota(5);
    setAgentName("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetState();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Create Sourcing Agent
            <span className="text-xs text-muted-foreground ml-auto">Step {step}/5</span>
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Role Description */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Role Description</Label>
              <Textarea
                placeholder="Describe the role you're sourcing for in plain English. Example: 'Board-certified cardiologists in Nashville with at least 5 years in their current role, making $350k+'"
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
                rows={5}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {roleDescription.length}/500
              </p>
            </div>
            <Button
              className="w-full"
              onClick={handleParse}
              disabled={!roleDescription.trim() || parsing}
            >
              {parsing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  Parse & Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        )}

        {/* Step 2: Filter Review */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Clinical Role</Label>
                <Select value={clinicalRole} onValueChange={setClinicalRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CLINICAL_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Specialty</Label>
                <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="e.g. Cardiology" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Nashville" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">State</Label>
                <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="Tennessee" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Salary Min</Label>
                <Input type="number" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} placeholder="350000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Salary Max</Label>
                <Input type="number" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} placeholder="500000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Min Tenure (years)</Label>
                <Input type="number" value={tenureMin} onChange={(e) => setTenureMin(e.target.value)} placeholder="5" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Practice Setting</Label>
                <Select value={practiceSetting} onValueChange={setPracticeSetting}>
                  <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    {PRACTICE_SETTINGS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Employer (optional)</Label>
              <Input value={employer} onChange={(e) => setEmployer(e.target.value)} placeholder="e.g. Vanderbilt" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Pin non-negotiable criteria</Label>
              <div className="flex flex-wrap gap-1.5">
                {criteriaFields.map((c) => (
                  <Badge
                    key={c.key}
                    variant={pinnedCriteria.includes(c.label) ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => togglePin(c.label)}
                  >
                    <Star className={`h-3 w-3 mr-1 ${pinnedCriteria.includes(c.label) ? "fill-current" : ""}`} />
                    {c.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1">
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Sequence & Mode */}
        {step === 3 && (
          <div className="space-y-4">
            <RadioGroup value={sequenceMode} onValueChange={setSequenceMode}>
              <div className="flex items-center space-x-2 border rounded-lg p-3">
                <RadioGroupItem value="shortlist" id="shortlist" />
                <Label htmlFor="shortlist" className="text-sm cursor-pointer flex-1">
                  <span className="font-medium">Shortlist only</span>
                  <p className="text-xs text-muted-foreground mt-0.5">Agent finds and scores candidates — you review and reach out manually</p>
                </Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-lg p-3">
                <RadioGroupItem value="auto_sequence" id="auto_sequence" />
                <Label htmlFor="auto_sequence" className="text-sm cursor-pointer flex-1">
                  <span className="font-medium">Auto-sequence outreach</span>
                  <p className="text-xs text-muted-foreground mt-0.5">Agent sends personalized emails via your verified sending domain</p>
                </Label>
              </div>
            </RadioGroup>

            {sequenceMode === "auto_sequence" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Select sequence</Label>
                <Select value={sequenceId} onValueChange={setSequenceId}>
                  <SelectTrigger><SelectValue placeholder="Choose a sequence..." /></SelectTrigger>
                  <SelectContent>
                    {sequences.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  You can switch to auto-sequence later after verifying your sending domain
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />Back
              </Button>
              <Button onClick={() => setStep(4)} className="flex-1">
                Continue<ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Daily Quota */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-xs">New leads per day: <span className="font-semibold text-foreground">{dailyQuota}</span></Label>
              <Slider
                value={[dailyQuota]}
                onValueChange={([v]) => setDailyQuota(v)}
                min={1}
                max={25}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Your agent will source this many new candidates daily. Start with 5 and adjust based on your review capacity.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />Back
              </Button>
              <Button onClick={() => setStep(5)} className="flex-1">
                Continue<ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Name & Launch */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Agent Name</Label>
              <Input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="e.g. Cardiologist — Nashville"
              />
            </div>

            <div className="rounded-lg border p-3 space-y-2 text-xs">
              <p className="font-medium text-sm">Summary</p>
              <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                <span>Role:</span><span className="text-foreground">{clinicalRole}</span>
                {specialty && <><span>Specialty:</span><span className="text-foreground">{specialty}</span></>}
                {city && <><span>Location:</span><span className="text-foreground">{city}{state ? `, ${state}` : ""}</span></>}
                <span>Mode:</span><span className="text-foreground">{sequenceMode === "shortlist" ? "Shortlist only" : "Auto-sequence"}</span>
                <span>Daily quota:</span><span className="text-foreground">{dailyQuota} leads/day</span>
                {pinnedCriteria.length > 0 && (
                  <><span>Pinned:</span><span className="text-foreground">{pinnedCriteria.length} criteria</span></>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(4)} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />Back
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createAgent.isPending}
                className="flex-1"
              >
                {createAgent.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>
                ) : (
                  "Create & Start Calibration"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
