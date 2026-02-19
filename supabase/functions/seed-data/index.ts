import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROJECTS = [
  { name: "ICU Nurses – Q1 Hiring", description: "Critical care nurses for the new ICU wing opening in March." },
  { name: "OR Technicians – Dallas Region", description: "Surgical techs and OR RNs across DFW metro." },
  { name: "Travel Nurses – Nationwide", description: "Contract & travel nursing positions, 13-week assignments." },
];

const CANDIDATES = [
  // ICU / Critical Care
  { full_name: "Sarah Mitchell", title: "ICU Registered Nurse", current_employer: "Baylor Scott & White Medical Center", location: "Dallas, TX", email: "s.mitchell@email.com", phone: "214-555-0101", skills: ["Critical Care", "Ventilator Management", "ACLS", "CCRN", "Hemodynamic Monitoring"], avg_tenure_months: 28, salary_min: 72000, salary_max: 95000, status: "new" },
  { full_name: "James Okonkwo", title: "Critical Care RN", current_employer: "UT Southwestern Medical Center", location: "Dallas, TX", email: "j.okonkwo@email.com", phone: "214-555-0102", skills: ["CCRN", "ACLS", "Sepsis Protocol", "ECMO", "Central Line Care"], avg_tenure_months: 36, salary_min: 78000, salary_max: 102000, status: "contacted" },
  { full_name: "Maria Gonzalez", title: "RN – Intensive Care", current_employer: "Methodist Health System", location: "Fort Worth, TX", email: "m.gonzalez@email.com", phone: "817-555-0103", skills: ["Ventilator", "ACLS", "Medication Administration", "CCRN", "Patient Assessment"], avg_tenure_months: 22, salary_min: 68000, salary_max: 88000, status: "interested" },
  { full_name: "Derek Thompson", title: "ICU Charge Nurse", current_employer: "Parkland Health", location: "Dallas, TX", email: "d.thompson@email.com", phone: "214-555-0104", skills: ["Team Leadership", "Critical Care", "ACLS", "TNCC", "Charge Nurse"], avg_tenure_months: 48, salary_min: 85000, salary_max: 110000, status: "new" },
  { full_name: "Priya Sharma", title: "Registered Nurse – CVICU", current_employer: "Texas Health Resources", location: "Arlington, TX", email: "p.sharma@email.com", phone: "817-555-0105", skills: ["Cardiac Surgery Recovery", "IABP", "CCRN", "ACLS", "Pacemaker Management"], avg_tenure_months: 31, salary_min: 80000, salary_max: 105000, status: "contacted" },
  { full_name: "Marcus Williams", title: "Neurocritical Care RN", current_employer: "Houston Methodist", location: "Houston, TX", email: "m.williams@email.com", phone: "713-555-0106", skills: ["Neuro ICU", "ICP Monitoring", "ACLS", "CCRN", "Stroke Protocol"], avg_tenure_months: 26, salary_min: 74000, salary_max: 98000, status: "new" },
  { full_name: "Ashley Park", title: "Float Pool ICU RN", current_employer: "HCA Healthcare", location: "San Antonio, TX", email: "a.park@email.com", phone: "210-555-0107", skills: ["Multi-unit Float", "ACLS", "Critical Care", "Medication Administration", "EMR – Epic"], avg_tenure_months: 18, salary_min: 70000, salary_max: 92000, status: "new" },
  { full_name: "Robert Castillo", title: "MICU Registered Nurse", current_employer: "Memorial Hermann", location: "Houston, TX", email: "r.castillo@email.com", phone: "713-555-0108", skills: ["Medical ICU", "Dialysis", "CRRT", "CCRN", "ACLS"], avg_tenure_months: 42, salary_min: 77000, salary_max: 101000, status: "hired" },
  { full_name: "Jennifer Lee", title: "ICU RN – Trauma", current_employer: "Parkland Health", location: "Dallas, TX", email: "j.lee@email.com", phone: "214-555-0109", skills: ["Trauma ICU", "ACLS", "TNCC", "Damage Control", "Critical Care"], avg_tenure_months: 33, salary_min: 79000, salary_max: 104000, status: "interested" },
  { full_name: "Anthony Brown", title: "Per Diem ICU Nurse", current_employer: "Staffing Solutions Healthcare", location: "Plano, TX", email: "a.brown@email.com", phone: "972-555-0110", skills: ["Per Diem", "CCRN", "ACLS", "Multi-system", "IV Therapy"], avg_tenure_months: 14, salary_min: 65000, salary_max: 85000, status: "new" },

  // OR Technicians
  { full_name: "Nicole Adams", title: "Surgical Technologist – CST", current_employer: "Texas Health Presbyterian", location: "Dallas, TX", email: "n.adams@email.com", phone: "214-555-0201", skills: ["Scrub Tech", "Sterile Technique", "CST", "General Surgery", "Orthopedic Assist"], avg_tenure_months: 38, salary_min: 48000, salary_max: 62000, status: "new" },
  { full_name: "Kevin Martinez", title: "OR Surgical Tech", current_employer: "Baylor University Medical Center", location: "Dallas, TX", email: "k.martinez@email.com", phone: "214-555-0202", skills: ["CST", "Laparoscopic", "Robotic Assist – DaVinci", "Sterile Field", "Instrument Count"], avg_tenure_months: 29, salary_min: 50000, salary_max: 65000, status: "contacted" },
  { full_name: "Tiffany Johnson", title: "Certified Surgical Tech", current_employer: "Medical City Healthcare", location: "Irving, TX", email: "t.johnson@email.com", phone: "972-555-0203", skills: ["Cardiac OR", "Perfusion Assist", "CST", "Sterile Technique", "Open Heart Prep"], avg_tenure_months: 45, salary_min: 55000, salary_max: 72000, status: "interested" },
  { full_name: "Brandon Clark", title: "OR Tech – Orthopedics", current_employer: "Baylor Scott & White", location: "Frisco, TX", email: "b.clark@email.com", phone: "469-555-0204", skills: ["Joint Replacement", "Arthroscopy Assist", "CST", "Implant Tracking", "Scrub Tech"], avg_tenure_months: 24, salary_min: 49000, salary_max: 64000, status: "new" },
  { full_name: "Samantha Nguyen", title: "Surgical First Assist", current_employer: "UT Southwestern", location: "Dallas, TX", email: "s.nguyen@email.com", phone: "214-555-0205", skills: ["First Assist", "CNFA", "Wound Closure", "Laparoscopic", "Retractor Techniques"], avg_tenure_months: 52, salary_min: 65000, salary_max: 85000, status: "contacted" },
  { full_name: "Daniel Rivera", title: "OR Surgical Technician", current_employer: "Christus Health", location: "Corpus Christi, TX", email: "d.rivera@email.com", phone: "361-555-0206", skills: ["General OR", "Sterile Processing", "CST", "Laparoscopic", "Supply Management"], avg_tenure_months: 20, salary_min: 45000, salary_max: 59000, status: "new" },
  { full_name: "Lauren Scott", title: "Neuro OR Technologist", current_employer: "Ascension Texas", location: "Austin, TX", email: "l.scott@email.com", phone: "512-555-0207", skills: ["Neuro Surgery Assist", "CST", "Microscope Setup", "Craniotomy Prep", "Sterile Technique"], avg_tenure_months: 35, salary_min: 52000, salary_max: 70000, status: "interested" },
  { full_name: "Christopher Hall", title: "Travel OR Tech", current_employer: "Aya Healthcare", location: "Fort Worth, TX", email: "c.hall@email.com", phone: "817-555-0208", skills: ["Travel Contract", "CST", "Multi-specialty", "Rapid Onboard", "Epic EMR"], avg_tenure_months: 16, salary_min: 58000, salary_max: 78000, status: "new" },
  { full_name: "Megan Torres", title: "OR Circulating Nurse", current_employer: "JPS Health Network", location: "Fort Worth, TX", email: "m.torres@email.com", phone: "817-555-0209", skills: ["Circulating RN", "CNOR", "Preop Assessment", "Instrument Count", "Patient Positioning"], avg_tenure_months: 40, salary_min: 68000, salary_max: 88000, status: "hired" },
  { full_name: "Jason Walker", title: "Surgical Tech – Cardiac", current_employer: "Heart Hospital of Austin", location: "Austin, TX", email: "j.walker@email.com", phone: "512-555-0210", skills: ["Cardiac Surgery", "Bypass Circuit", "CST", "Sterile Field", "CABG Assist"], avg_tenure_months: 30, salary_min: 56000, salary_max: 74000, status: "contacted" },

  // Travel Nurses
  { full_name: "Emily Carter", title: "Travel RN – Med/Surg", current_employer: "AMN Healthcare", location: "Phoenix, AZ", email: "e.carter@email.com", phone: "602-555-0301", skills: ["Med/Surg", "IV Therapy", "Patient Education", "ACLS", "Case Management"], avg_tenure_months: 12, salary_min: 78000, salary_max: 105000, status: "new" },
  { full_name: "David Kim", title: "Travel ICU Nurse", current_employer: "Cross Country Nurses", location: "Chicago, IL", email: "d.kim@email.com", phone: "312-555-0302", skills: ["Travel Nursing", "CCRN", "ACLS", "Critical Care", "Multiple EMRs"], avg_tenure_months: 10, salary_min: 88000, salary_max: 120000, status: "contacted" },
  { full_name: "Rachel Green", title: "Travel ED RN", current_employer: "Supplemental Health Care", location: "Miami, FL", email: "r.green@email.com", phone: "305-555-0303", skills: ["Emergency Nursing", "ACLS", "PALS", "Triage", "CEN"], avg_tenure_months: 8, salary_min: 82000, salary_max: 112000, status: "new" },
  { full_name: "Thomas Anderson", title: "Travel PACU Nurse", current_employer: "Trustaff", location: "Seattle, WA", email: "t.anderson@email.com", phone: "206-555-0304", skills: ["Post-Anesthesia Care", "Phase I PACU", "ACLS", "Airway Management", "Pain Management"], avg_tenure_months: 15, salary_min: 80000, salary_max: 108000, status: "interested" },
  { full_name: "Hannah White", title: "Travel L&D Nurse", current_employer: "Aya Healthcare", location: "Denver, CO", email: "h.white@email.com", phone: "720-555-0305", skills: ["Labor & Delivery", "Electronic Fetal Monitoring", "NRP", "High-Risk OB", "Epidural Assist"], avg_tenure_months: 11, salary_min: 76000, salary_max: 103000, status: "new" },
  { full_name: "Carlos Mendez", title: "Travel Telemetry RN", current_employer: "Maxim Healthcare", location: "Las Vegas, NV", email: "c.mendez@email.com", phone: "702-555-0306", skills: ["Telemetry", "Cardiac Monitoring", "ACLS", "12-Lead ECG", "Drip Management"], avg_tenure_months: 9, salary_min: 74000, salary_max: 100000, status: "contacted" },
  { full_name: "Olivia Turner", title: "Travel OR Nurse – CNOR", current_employer: "FlexCare Medical", location: "Boston, MA", email: "o.turner@email.com", phone: "617-555-0307", skills: ["CNOR", "Circulating", "Scrub", "Robotic Surgery", "ACLS"], avg_tenure_months: 13, salary_min: 85000, salary_max: 118000, status: "new" },
  { full_name: "Nathan Brooks", title: "Travel Neuro ICU RN", current_employer: "Stability Healthcare", location: "Portland, OR", email: "n.brooks@email.com", phone: "503-555-0308", skills: ["Neuro ICU", "ICP", "CCRN", "ACLS", "EVD Management"], avg_tenure_months: 14, salary_min: 90000, salary_max: 122000, status: "interested" },
  { full_name: "Sophia Evans", title: "Travel Float Pool RN", current_employer: "Fusion Medical Staffing", location: "Atlanta, GA", email: "s.evans@email.com", phone: "404-555-0309", skills: ["Multi-unit Float", "Med/Surg", "Tele", "ACLS", "Epic EMR"], avg_tenure_months: 7, salary_min: 72000, salary_max: 98000, status: "new" },
  { full_name: "Ethan Murphy", title: "Travel Cardiac Cath Lab RN", current_employer: "RNnetwork", location: "Charlotte, NC", email: "e.murphy@email.com", phone: "704-555-0310", skills: ["Cath Lab", "Interventional Cardiology", "ACLS", "Hemodynamics", "Contrast Administration"], avg_tenure_months: 18, salary_min: 92000, salary_max: 128000, status: "contacted" },

  // Extra candidates across projects
  { full_name: "Vanessa Reed", title: "RN – Step Down Unit", current_employer: "Baylor Scott & White", location: "Temple, TX", email: "v.reed@email.com", phone: "254-555-0401", skills: ["Step Down", "Telemetry", "ACLS", "Medication Administration", "Patient Teaching"], avg_tenure_months: 32, salary_min: 65000, salary_max: 84000, status: "new" },
  { full_name: "Ian Foster", title: "Registered Nurse – NICU", current_employer: "Cook Children's Health Care", location: "Fort Worth, TX", email: "i.foster@email.com", phone: "817-555-0402", skills: ["Neonatal ICU", "RNC-NIC", "Thermoregulation", "CPAP", "TPN Administration"], avg_tenure_months: 44, salary_min: 73000, salary_max: 96000, status: "new" },
  { full_name: "Chloe Peterson", title: "Pediatric ICU RN", current_employer: "Children's Health Dallas", location: "Dallas, TX", email: "c.peterson@email.com", phone: "214-555-0403", skills: ["PICU", "PALS", "CCRN", "Ventilator Peds", "Family-Centered Care"], avg_tenure_months: 27, salary_min: 70000, salary_max: 92000, status: "contacted" },
  { full_name: "Michael Hayes", title: "Certified CRNA", current_employer: "Anesthesia Partners of Texas", location: "Austin, TX", email: "m.hayes@email.com", phone: "512-555-0404", skills: ["Anesthesia", "CRNA", "Airway Management", "Regional Anesthesia", "Pain Management"], avg_tenure_months: 60, salary_min: 160000, salary_max: 210000, status: "new" },
  { full_name: "Natalie Dixon", title: "Nurse Practitioner – Hospitalist", current_employer: "Envision Healthcare", location: "Houston, TX", email: "n.dixon@email.com", phone: "713-555-0405", skills: ["NP", "Hospitalist", "Internal Medicine", "Procedures", "EHR Documentation"], avg_tenure_months: 38, salary_min: 110000, salary_max: 145000, status: "interested" },
  { full_name: "Aaron Price", title: "Clinical Nurse Specialist – Oncology", current_employer: "MD Anderson Cancer Center", location: "Houston, TX", email: "a.price@email.com", phone: "713-555-0406", skills: ["CNS", "Oncology", "Chemotherapy Administration", "OCN", "Patient Education"], avg_tenure_months: 55, salary_min: 95000, salary_max: 130000, status: "new" },
  { full_name: "Brittany Collins", title: "Home Health RN", current_employer: "LHC Group", location: "Lubbock, TX", email: "b.collins@email.com", phone: "806-555-0407", skills: ["Home Health", "Wound Care", "IV Therapy", "OASIS", "Case Management"], avg_tenure_months: 23, salary_min: 60000, salary_max: 78000, status: "new" },
  { full_name: "George Wright", title: "Dialysis RN", current_employer: "DaVita", location: "El Paso, TX", email: "g.wright@email.com", phone: "915-555-0408", skills: ["Hemodialysis", "Peritoneal Dialysis", "CDN", "Vascular Access", "Fluid Management"], avg_tenure_months: 41, salary_min: 63000, salary_max: 82000, status: "contacted" },
  { full_name: "Isabella Morgan", title: "ER Registered Nurse", current_employer: "Ascension Seton", location: "Austin, TX", email: "i.morgan@email.com", phone: "512-555-0409", skills: ["Emergency Medicine", "Triage", "CEN", "ACLS", "PALS"], avg_tenure_months: 29, salary_min: 72000, salary_max: 95000, status: "new" },
  { full_name: "Ryan Cooper", title: "Charge RN – Telemetry", current_employer: "Texas Health Harris Methodist", location: "Fort Worth, TX", email: "r.cooper@email.com", phone: "817-555-0410", skills: ["Charge RN", "Cardiac Telemetry", "ACLS", "Staff Scheduling", "Quality Improvement"], avg_tenure_months: 46, salary_min: 76000, salary_max: 99000, status: "interested" },
];

// Assign candidate index ranges to project indices
const PROJECT_ASSIGNMENTS: Record<number, number[]> = {
  0: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 30, 31, 32, 33],   // ICU Nurses
  1: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 34, 35],  // OR Techs
  2: [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 36, 37, 38, 39], // Travel Nurses
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get calling user from JWT
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get company_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: "No company found for user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const company_id = profile.company_id;

    // Create projects
    const createdProjectIds: string[] = [];
    for (const proj of PROJECTS) {
      const { data, error } = await supabase
        .from("projects")
        .insert({ ...proj, company_id, created_by: user.id })
        .select("id")
        .single();

      if (error) throw new Error(`Failed to create project: ${error.message}`);
      createdProjectIds.push(data.id);
    }

    // Insert candidates per project
    let totalInserted = 0;
    for (const [projIdx, candidateIndices] of Object.entries(PROJECT_ASSIGNMENTS)) {
      const projectId = createdProjectIds[Number(projIdx)];
      const rows = candidateIndices.map((ci) => ({
        ...CANDIDATES[ci],
        project_id: projectId,
        company_id,
        added_by: user.id,
        linkedin_url: `https://linkedin.com/in/${CANDIDATES[ci].full_name.toLowerCase().replace(/\s+/g, "-")}-demo`,
        pdl_id: `demo-${ci}-${crypto.randomUUID()}`,
      }));

      const { error, count } = await supabase
        .from("candidates")
        .insert(rows)
        .select("id", { count: "exact" });

      if (error) throw new Error(`Failed to insert candidates: ${error.message}`);
      totalInserted += count ?? rows.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        projects_created: createdProjectIds.length,
        candidates_inserted: totalInserted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Seed error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
