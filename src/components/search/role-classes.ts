/**
 * Role classes the engine can gate on, for the criteria editor. Keys mirror
 * ROLE_CLASSES in supabase/functions/_shared/clinician-engine/clinical-vocabulary.ts;
 * an unknown key is dropped server-side, so this list must stay in step.
 */
export const ROLE_CLASS_OPTIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "surgeon", label: "Surgeons" },
  { key: "physician", label: "Physicians" },
  { key: "resident", label: "Residents" },
  { key: "fellow", label: "Fellows" },
  { key: "nurse", label: "Nurses" },
  { key: "nurse_practitioner", label: "Nurse Practitioners" },
  { key: "physician_assistant", label: "Physician Assistants" },
  { key: "crna", label: "CRNAs" },
  { key: "srna", label: "SRNAs (Nurse Anesthesia Students)" },
  { key: "therapist", label: "Therapists" },
  { key: "pharmacist", label: "Pharmacists" },
  { key: "dentist", label: "Dentists" },
  { key: "podiatrist", label: "Podiatrists" },
  { key: "tech", label: "Techs & Technologists" },
];

export function roleClassLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return ROLE_CLASS_OPTIONS.find((o) => o.key === key)?.label ?? key;
}
