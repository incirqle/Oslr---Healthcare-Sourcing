import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── PROJECTS ────────────────────────────────────────────────────────────────
const PROJECTS = [
  { name: "ICU Nurses – Q1 Hiring", description: "Critical care nurses for the new ICU wing opening in March." },
  { name: "OR Technicians – Dallas Region", description: "Surgical techs and OR RNs across DFW metro." },
  { name: "Travel Nurses – Nationwide", description: "Contract & travel nursing positions, 13-week assignments." },
  { name: "Orthopedic Surgeons – Southwest", description: "Orthopedic surgeons and sports medicine physicians across TX, AZ, NM." },
  { name: "CRNA Placement – Nationwide", description: "Certified Registered Nurse Anesthetists for hospitals and ASCs." },
  { name: "Locum Tenens – All Specialties", description: "Short-term & long-term locum coverage for physician shortfalls." },
  { name: "General Surgery Division", description: "General, colorectal, bariatric, and minimally invasive surgeons." },
  { name: "Hospitalist & Internal Medicine", description: "Hospitalists, internists, and nocturnists for acute care facilities." },
  { name: "Emergency Medicine Physicians", description: "Emergency physicians and urgent care MDs." },
  { name: "Anesthesiology Group", description: "Anesthesiologists and pain management physicians." },
];

// ─── CANDIDATES ──────────────────────────────────────────────────────────────
const CANDIDATES: any[] = [
  // ── Project 0: ICU Nurses ──────────────────────────────────────────────────
  { full_name: "Sarah Mitchell", title: "ICU Registered Nurse", current_employer: "Baylor Scott & White Medical Center", location: "Dallas, TX", email: "s.mitchell@email.com", phone: "214-555-0101", skills: ["Critical Care", "Ventilator Management", "ACLS", "CCRN", "Hemodynamic Monitoring"], avg_tenure_months: 28, salary_min: 72000, salary_max: 95000, status: "new" },
  { full_name: "James Okonkwo", title: "Critical Care RN", current_employer: "UT Southwestern Medical Center", location: "Dallas, TX", email: "j.okonkwo@email.com", phone: "214-555-0102", skills: ["CCRN", "ACLS", "Sepsis Protocol", "ECMO", "Central Line Care"], avg_tenure_months: 36, salary_min: 78000, salary_max: 102000, status: "contacted" },
  { full_name: "Maria Gonzalez", title: "RN – Intensive Care", current_employer: "Methodist Health System", location: "Fort Worth, TX", email: "m.gonzalez@email.com", phone: "817-555-0103", skills: ["Ventilator", "ACLS", "Medication Administration", "CCRN", "Patient Assessment"], avg_tenure_months: 22, salary_min: 68000, salary_max: 88000, status: "interested" },
  { full_name: "Derek Thompson", title: "ICU Charge Nurse", current_employer: "Parkland Health", location: "Dallas, TX", email: "d.thompson@email.com", phone: "214-555-0104", skills: ["Team Leadership", "Critical Care", "ACLS", "TNCC", "Charge Nurse"], avg_tenure_months: 48, salary_min: 85000, salary_max: 110000, status: "new" },
  { full_name: "Priya Sharma", title: "CVICU Registered Nurse", current_employer: "Texas Health Resources", location: "Arlington, TX", email: "p.sharma@email.com", phone: "817-555-0105", skills: ["Cardiac Surgery Recovery", "IABP", "CCRN", "ACLS", "Pacemaker Management"], avg_tenure_months: 31, salary_min: 80000, salary_max: 105000, status: "contacted" },
  { full_name: "Marcus Williams", title: "Neurocritical Care RN", current_employer: "Houston Methodist", location: "Houston, TX", email: "m.williams@email.com", phone: "713-555-0106", skills: ["Neuro ICU", "ICP Monitoring", "ACLS", "CCRN", "Stroke Protocol"], avg_tenure_months: 26, salary_min: 74000, salary_max: 98000, status: "new" },
  { full_name: "Ashley Park", title: "Float Pool ICU RN", current_employer: "HCA Healthcare", location: "San Antonio, TX", email: "a.park@email.com", phone: "210-555-0107", skills: ["Multi-unit Float", "ACLS", "Critical Care", "Medication Administration", "EMR – Epic"], avg_tenure_months: 18, salary_min: 70000, salary_max: 92000, status: "new" },
  { full_name: "Robert Castillo", title: "MICU Registered Nurse", current_employer: "Memorial Hermann", location: "Houston, TX", email: "r.castillo@email.com", phone: "713-555-0108", skills: ["Medical ICU", "Dialysis", "CRRT", "CCRN", "ACLS"], avg_tenure_months: 42, salary_min: 77000, salary_max: 101000, status: "hired" },
  { full_name: "Jennifer Lee", title: "ICU RN – Trauma", current_employer: "Parkland Health", location: "Dallas, TX", email: "j.lee@email.com", phone: "214-555-0109", skills: ["Trauma ICU", "ACLS", "TNCC", "Damage Control", "Critical Care"], avg_tenure_months: 33, salary_min: 79000, salary_max: 104000, status: "interested" },
  { full_name: "Anthony Brown", title: "Per Diem ICU Nurse", current_employer: "Staffing Solutions Healthcare", location: "Plano, TX", email: "a.brown@email.com", phone: "972-555-0110", skills: ["Per Diem", "CCRN", "ACLS", "Multi-system", "IV Therapy"], avg_tenure_months: 14, salary_min: 65000, salary_max: 85000, status: "new" },

  // ── Project 1: OR Technicians ──────────────────────────────────────────────
  { full_name: "Nicole Adams", title: "Surgical Technologist – CST", current_employer: "Texas Health Presbyterian", location: "Dallas, TX", email: "n.adams@email.com", phone: "214-555-0201", skills: ["Scrub Tech", "Sterile Technique", "CST", "General Surgery", "Orthopedic Assist"], avg_tenure_months: 38, salary_min: 48000, salary_max: 62000, status: "new" },
  { full_name: "Kevin Martinez", title: "OR Surgical Tech", current_employer: "Baylor University Medical Center", location: "Dallas, TX", email: "k.martinez@email.com", phone: "214-555-0202", skills: ["CST", "Laparoscopic", "Robotic Assist – DaVinci", "Sterile Field", "Instrument Count"], avg_tenure_months: 29, salary_min: 50000, salary_max: 65000, status: "contacted" },
  { full_name: "Tiffany Johnson", title: "Certified Surgical Tech – Cardiac", current_employer: "Medical City Healthcare", location: "Irving, TX", email: "t.johnson@email.com", phone: "972-555-0203", skills: ["Cardiac OR", "Perfusion Assist", "CST", "Sterile Technique", "Open Heart Prep"], avg_tenure_months: 45, salary_min: 55000, salary_max: 72000, status: "interested" },
  { full_name: "Brandon Clark", title: "OR Tech – Orthopedics", current_employer: "Baylor Scott & White", location: "Frisco, TX", email: "b.clark@email.com", phone: "469-555-0204", skills: ["Joint Replacement", "Arthroscopy Assist", "CST", "Implant Tracking", "Scrub Tech"], avg_tenure_months: 24, salary_min: 49000, salary_max: 64000, status: "new" },
  { full_name: "Samantha Nguyen", title: "Surgical First Assist – CNFA", current_employer: "UT Southwestern", location: "Dallas, TX", email: "s.nguyen@email.com", phone: "214-555-0205", skills: ["First Assist", "CNFA", "Wound Closure", "Laparoscopic", "Retractor Techniques"], avg_tenure_months: 52, salary_min: 65000, salary_max: 85000, status: "contacted" },
  { full_name: "Daniel Rivera", title: "OR Surgical Technician", current_employer: "Christus Health", location: "Corpus Christi, TX", email: "d.rivera@email.com", phone: "361-555-0206", skills: ["General OR", "Sterile Processing", "CST", "Laparoscopic", "Supply Management"], avg_tenure_months: 20, salary_min: 45000, salary_max: 59000, status: "new" },
  { full_name: "Lauren Scott", title: "Neuro OR Technologist", current_employer: "Ascension Texas", location: "Austin, TX", email: "l.scott@email.com", phone: "512-555-0207", skills: ["Neuro Surgery Assist", "CST", "Microscope Setup", "Craniotomy Prep", "Sterile Technique"], avg_tenure_months: 35, salary_min: 52000, salary_max: 70000, status: "interested" },
  { full_name: "Megan Torres", title: "OR Circulating Nurse – CNOR", current_employer: "JPS Health Network", location: "Fort Worth, TX", email: "m.torres@email.com", phone: "817-555-0209", skills: ["Circulating RN", "CNOR", "Preop Assessment", "Instrument Count", "Patient Positioning"], avg_tenure_months: 40, salary_min: 68000, salary_max: 88000, status: "hired" },
  { full_name: "Jason Walker", title: "Surgical Tech – Cardiac", current_employer: "Heart Hospital of Austin", location: "Austin, TX", email: "j.walker@email.com", phone: "512-555-0210", skills: ["Cardiac Surgery", "Bypass Circuit", "CST", "Sterile Field", "CABG Assist"], avg_tenure_months: 30, salary_min: 56000, salary_max: 74000, status: "contacted" },

  // ── Project 2: Travel Nurses ───────────────────────────────────────────────
  { full_name: "Emily Carter", title: "Travel RN – Med/Surg", current_employer: "AMN Healthcare", location: "Phoenix, AZ", email: "e.carter@email.com", phone: "602-555-0301", skills: ["Med/Surg", "IV Therapy", "Patient Education", "ACLS", "Case Management"], avg_tenure_months: 12, salary_min: 78000, salary_max: 105000, status: "new" },
  { full_name: "David Kim", title: "Travel ICU Nurse", current_employer: "Cross Country Nurses", location: "Chicago, IL", email: "d.kim@email.com", phone: "312-555-0302", skills: ["Travel Nursing", "CCRN", "ACLS", "Critical Care", "Multiple EMRs"], avg_tenure_months: 10, salary_min: 88000, salary_max: 120000, status: "contacted" },
  { full_name: "Rachel Green", title: "Travel ED RN", current_employer: "Supplemental Health Care", location: "Miami, FL", email: "r.green@email.com", phone: "305-555-0303", skills: ["Emergency Nursing", "ACLS", "PALS", "Triage", "CEN"], avg_tenure_months: 8, salary_min: 82000, salary_max: 112000, status: "new" },
  { full_name: "Thomas Anderson", title: "Travel PACU Nurse", current_employer: "Trustaff", location: "Seattle, WA", email: "t.anderson@email.com", phone: "206-555-0304", skills: ["Post-Anesthesia Care", "Phase I PACU", "ACLS", "Airway Management", "Pain Management"], avg_tenure_months: 15, salary_min: 80000, salary_max: 108000, status: "interested" },
  { full_name: "Hannah White", title: "Travel L&D Nurse", current_employer: "Aya Healthcare", location: "Denver, CO", email: "h.white@email.com", phone: "720-555-0305", skills: ["Labor & Delivery", "EFM", "NRP", "High-Risk OB", "Epidural Assist"], avg_tenure_months: 11, salary_min: 76000, salary_max: 103000, status: "new" },
  { full_name: "Carlos Mendez", title: "Travel Telemetry RN", current_employer: "Maxim Healthcare", location: "Las Vegas, NV", email: "c.mendez@email.com", phone: "702-555-0306", skills: ["Telemetry", "Cardiac Monitoring", "ACLS", "12-Lead ECG", "Drip Management"], avg_tenure_months: 9, salary_min: 74000, salary_max: 100000, status: "contacted" },
  { full_name: "Olivia Turner", title: "Travel OR Nurse – CNOR", current_employer: "FlexCare Medical", location: "Boston, MA", email: "o.turner@email.com", phone: "617-555-0307", skills: ["CNOR", "Circulating", "Scrub", "Robotic Surgery", "ACLS"], avg_tenure_months: 13, salary_min: 85000, salary_max: 118000, status: "new" },
  { full_name: "Nathan Brooks", title: "Travel Neuro ICU RN", current_employer: "Stability Healthcare", location: "Portland, OR", email: "n.brooks@email.com", phone: "503-555-0308", skills: ["Neuro ICU", "ICP", "CCRN", "ACLS", "EVD Management"], avg_tenure_months: 14, salary_min: 90000, salary_max: 122000, status: "interested" },
  { full_name: "Sophia Evans", title: "Travel Float Pool RN", current_employer: "Fusion Medical Staffing", location: "Atlanta, GA", email: "s.evans@email.com", phone: "404-555-0309", skills: ["Multi-unit Float", "Med/Surg", "Tele", "ACLS", "Epic EMR"], avg_tenure_months: 7, salary_min: 72000, salary_max: 98000, status: "new" },
  { full_name: "Ethan Murphy", title: "Travel Cardiac Cath Lab RN", current_employer: "RNnetwork", location: "Charlotte, NC", email: "e.murphy@email.com", phone: "704-555-0310", skills: ["Cath Lab", "Interventional Cardiology", "ACLS", "Hemodynamics", "Contrast Administration"], avg_tenure_months: 18, salary_min: 92000, salary_max: 128000, status: "contacted" },

  // ── Project 3: Orthopedic Surgeons ────────────────────────────────────────
  { full_name: "Dr. William Harrington", title: "Orthopedic Surgeon – Joint Replacement", current_employer: "Texas Orthopedic Hospital", location: "Houston, TX", email: "w.harrington.md@email.com", phone: "713-555-1001", skills: ["Total Hip Replacement", "Total Knee Arthroplasty", "Robotic Surgery – Mako", "Revision Surgery", "ABOS Board Certified"], avg_tenure_months: 72, salary_min: 480000, salary_max: 680000, status: "new" },
  { full_name: "Dr. Sandra Chen", title: "Orthopedic Spine Surgeon", current_employer: "UT Southwestern Medical Center", location: "Dallas, TX", email: "s.chen.md@email.com", phone: "214-555-1002", skills: ["Lumbar Fusion", "Cervical Disc Replacement", "Minimally Invasive Spine", "Deformity Correction", "Fellowship Trained"], avg_tenure_months: 84, salary_min: 520000, salary_max: 750000, status: "contacted" },
  { full_name: "Dr. Marcus Webb", title: "Sports Medicine Orthopedic Surgeon", current_employer: "Andrews Sports Medicine Institute", location: "Birmingham, AL", email: "m.webb.md@email.com", phone: "205-555-1003", skills: ["ACL Reconstruction", "Shoulder Arthroscopy", "Tommy John Surgery", "Cartilage Restoration", "Team Physician Experience"], avg_tenure_months: 96, salary_min: 450000, salary_max: 620000, status: "interested" },
  { full_name: "Dr. Patricia Nguyen", title: "Orthopedic Trauma Surgeon", current_employer: "Ben Taub General Hospital", location: "Houston, TX", email: "p.nguyen.md@email.com", phone: "713-555-1004", skills: ["Pelvic Fracture", "Long Bone Fractures", "External Fixation", "Intramedullary Nailing", "Level I Trauma"], avg_tenure_months: 60, salary_min: 490000, salary_max: 700000, status: "new" },
  { full_name: "Dr. James Kowalski", title: "Foot & Ankle Orthopedic Surgeon", current_employer: "OrthoTexas", location: "Plano, TX", email: "j.kowalski.md@email.com", phone: "972-555-1005", skills: ["Achilles Tendon Repair", "Ankle Replacement", "Bunionectomy", "Flatfoot Reconstruction", "ABOS Certified"], avg_tenure_months: 48, salary_min: 420000, salary_max: 580000, status: "contacted" },
  { full_name: "Dr. Aisha Okafor", title: "Pediatric Orthopedic Surgeon", current_employer: "Cook Children's Health Care", location: "Fort Worth, TX", email: "a.okafor.md@email.com", phone: "817-555-1006", skills: ["Scoliosis Correction", "Hip Dysplasia", "Club Foot", "Fracture Management Peds", "Fellowship Trained Peds Ortho"], avg_tenure_months: 54, salary_min: 430000, salary_max: 600000, status: "new" },
  { full_name: "Dr. Robert Delgado", title: "Hand & Upper Extremity Surgeon", current_employer: "Southwest Hand Center", location: "Phoenix, AZ", email: "r.delgado.md@email.com", phone: "602-555-1007", skills: ["Carpal Tunnel", "Dupuytren's Contracture", "Nerve Repair", "Wrist Arthroscopy", "Microsurgery"], avg_tenure_months: 66, salary_min: 410000, salary_max: 560000, status: "interested" },
  { full_name: "Dr. Lauren Fitzgerald", title: "Orthopedic Oncology Surgeon", current_employer: "MD Anderson Cancer Center", location: "Houston, TX", email: "l.fitzgerald.md@email.com", phone: "713-555-1008", skills: ["Limb Salvage Surgery", "Bone Tumor Resection", "Endoprosthetics", "Soft Tissue Sarcoma", "Oncology Fellowship"], avg_tenure_months: 78, salary_min: 560000, salary_max: 780000, status: "new" },
  { full_name: "Dr. Christopher Park", title: "Orthopedic Surgeon – Shoulder & Elbow", current_employer: "Houston Methodist Orthopedics", location: "Houston, TX", email: "c.park.md@email.com", phone: "713-555-1009", skills: ["Total Shoulder Replacement", "Rotator Cuff Repair", "Reverse Shoulder Arthroplasty", "Elbow Arthroscopy", "ABOS Board Certified"], avg_tenure_months: 60, salary_min: 460000, salary_max: 640000, status: "contacted" },
  { full_name: "Dr. Michelle Tran", title: "Orthopedic Surgeon – Locum", current_employer: "CompHealth Locums", location: "Albuquerque, NM", email: "m.tran.md@email.com", phone: "505-555-1010", skills: ["General Orthopedics", "Joint Replacement", "Fracture Care", "Locum Tenens", "Flexible Scheduling"], avg_tenure_months: 18, salary_min: 520000, salary_max: 820000, status: "new" },

  // ── Project 4: CRNAs ──────────────────────────────────────────────────────
  { full_name: "Michael Hayes, CRNA", title: "Certified Registered Nurse Anesthetist", current_employer: "Anesthesia Partners of Texas", location: "Austin, TX", email: "m.hayes.crna@email.com", phone: "512-555-2001", skills: ["General Anesthesia", "Regional Anesthesia", "OB Anesthesia", "Cardiac Anesthesia", "Airway Management"], avg_tenure_months: 60, salary_min: 185000, salary_max: 240000, status: "new" },
  { full_name: "Diana Russo, CRNA", title: "CRNA – Cardiac Anesthesia", current_employer: "Texas Heart Institute", location: "Houston, TX", email: "d.russo.crna@email.com", phone: "713-555-2002", skills: ["Open Heart", "CABG Anesthesia", "TEE Certified", "Heart-Lung Bypass", "CRNA – Cardiac Fellowship"], avg_tenure_months: 84, salary_min: 210000, salary_max: 275000, status: "contacted" },
  { full_name: "Brandon Lee, CRNA", title: "CRNA – Neuro Anesthesia", current_employer: "UT Southwestern", location: "Dallas, TX", email: "b.lee.crna@email.com", phone: "214-555-2003", skills: ["Craniotomy Anesthesia", "Awake Craniotomy", "Neuro Monitoring", "Spinal Surgery Anesthesia", "ICP Management"], avg_tenure_months: 48, salary_min: 195000, salary_max: 255000, status: "new" },
  { full_name: "Karen Yates, CRNA", title: "CRNA – OB Anesthesia", current_employer: "Methodist Hospital for Women", location: "Houston, TX", email: "k.yates.crna@email.com", phone: "713-555-2004", skills: ["Labor Epidurals", "C-Section Anesthesia", "High-Risk OB", "Spinal Anesthesia", "Neonatal Resuscitation"], avg_tenure_months: 72, salary_min: 180000, salary_max: 230000, status: "interested" },
  { full_name: "Andre Washington, CRNA", title: "CRNA – Pediatric Anesthesia", current_employer: "Children's Health Dallas", location: "Dallas, TX", email: "a.washington.crna@email.com", phone: "214-555-2005", skills: ["Pediatric Airway", "Neonatal Anesthesia", "Congenital Heart", "Regional Peds", "Airway Rescue"], avg_tenure_months: 66, salary_min: 200000, salary_max: 260000, status: "new" },
  { full_name: "Stephanie Morris, CRNA", title: "CRNA – Pain Management", current_employer: "Texas Pain Physicians", location: "Dallas, TX", email: "s.morris.crna@email.com", phone: "214-555-2006", skills: ["Interventional Pain", "Epidural Steroid Injection", "Nerve Block", "Spinal Cord Stimulator", "Fluoroscopy"], avg_tenure_months: 54, salary_min: 175000, salary_max: 225000, status: "contacted" },
  { full_name: "James Holloway, CRNA", title: "CRNA – Ambulatory Surgery", current_employer: "USAP Texas", location: "Houston, TX", email: "j.holloway.crna@email.com", phone: "713-555-2007", skills: ["ASC Anesthesia", "Propofol TIVA", "Airway Management", "Regional Blocks", "ACLS"], avg_tenure_months: 42, salary_min: 170000, salary_max: 220000, status: "new" },
  { full_name: "Natalie Chen, CRNA", title: "CRNA – Trauma Anesthesia", current_employer: "Memorial Hermann Trauma", location: "Houston, TX", email: "n.chen.crna@email.com", phone: "713-555-2008", skills: ["Trauma Anesthesia", "Damage Control", "Rapid Sequence Intubation", "ACLS", "Critical Care"], avg_tenure_months: 36, salary_min: 190000, salary_max: 245000, status: "interested" },

  // ── Project 5: Locum Tenens ───────────────────────────────────────────────
  { full_name: "Dr. Kevin O'Brien", title: "Locum Hospitalist – Internal Medicine", current_employer: "CompHealth", location: "Nationwide", email: "k.obrien.md@email.com", phone: "800-555-3001", skills: ["Hospital Medicine", "Rapid Deployment", "Epic EMR", "Cerner", "Multi-state Licensed"], avg_tenure_months: 6, salary_min: 200000, salary_max: 310000, status: "new" },
  { full_name: "Dr. Alicia Summers", title: "Locum Emergency Physician", current_employer: "Weatherby Healthcare", location: "Nationwide", email: "a.summers.md@email.com", phone: "800-555-3002", skills: ["Emergency Medicine", "ACLS", "ATLS", "Ultrasound-Guided Procedures", "Multi-state Licensed"], avg_tenure_months: 8, salary_min: 220000, salary_max: 350000, status: "contacted" },
  { full_name: "Dr. Raymond Torres", title: "Locum General Surgeon", current_employer: "Staff Care", location: "Nationwide", email: "r.torres.md@email.com", phone: "800-555-3003", skills: ["General Surgery", "Laparoscopic", "Trauma Surgery", "Rural Surgery", "Flexible Scheduling"], avg_tenure_months: 9, salary_min: 300000, salary_max: 480000, status: "new" },
  { full_name: "Dr. Helen Park", title: "Locum Psychiatrist", current_employer: "Barton Associates", location: "Nationwide", email: "h.park.md@email.com", phone: "800-555-3004", skills: ["Adult Psychiatry", "Telepsychiatry", "Crisis Intervention", "Psychopharmacology", "Inpatient Psych"], avg_tenure_months: 5, salary_min: 230000, salary_max: 360000, status: "interested" },
  { full_name: "Dr. Gregory Miles", title: "Locum Radiologist", current_employer: "Global Staffing Partners", location: "Nationwide", email: "g.miles.md@email.com", phone: "800-555-3005", skills: ["Diagnostic Radiology", "Teleradiology", "CT", "MRI", "Interventional Radiology"], avg_tenure_months: 10, salary_min: 380000, salary_max: 580000, status: "new" },

  // ── Project 6: General Surgery ────────────────────────────────────────────
  { full_name: "Dr. Howard Blackwell", title: "General Surgeon – Bariatric", current_employer: "Baylor Scott & White", location: "Dallas, TX", email: "h.blackwell.md@email.com", phone: "214-555-4001", skills: ["Roux-en-Y Gastric Bypass", "Sleeve Gastrectomy", "Lap Band", "Revisional Bariatric", "ASMBS Fellowship"], avg_tenure_months: 84, salary_min: 350000, salary_max: 520000, status: "new" },
  { full_name: "Dr. Vanessa Patel", title: "Colorectal Surgeon", current_employer: "Houston Methodist", location: "Houston, TX", email: "v.patel.md@email.com", phone: "713-555-4002", skills: ["Robotic Colorectal", "Colon Cancer Resection", "IBD Surgery", "Anorectal Surgery", "DaVinci Certified"], avg_tenure_months: 72, salary_min: 400000, salary_max: 580000, status: "contacted" },
  { full_name: "Dr. Samuel Grant", title: "Minimally Invasive Surgeon", current_employer: "UT Southwestern", location: "Dallas, TX", email: "s.grant.md@email.com", phone: "214-555-4003", skills: ["Laparoscopic Cholecystectomy", "Hernia Repair", "Appendectomy", "SILS", "Robotic General Surgery"], avg_tenure_months: 60, salary_min: 320000, salary_max: 460000, status: "new" },
  { full_name: "Dr. Clara Reyes", title: "Breast Surgical Oncologist", current_employer: "MD Anderson", location: "Houston, TX", email: "c.reyes.md@email.com", phone: "713-555-4004", skills: ["Mastectomy", "Lumpectomy", "Sentinel Node Biopsy", "Oncoplastic Surgery", "Breast Reconstruction"], avg_tenure_months: 90, salary_min: 420000, salary_max: 620000, status: "interested" },
  { full_name: "Dr. Trevor Jackson", title: "Endocrine Surgeon", current_employer: "Ascension Texas", location: "Austin, TX", email: "t.jackson.md@email.com", phone: "512-555-4005", skills: ["Thyroidectomy", "Parathyroidectomy", "Adrenalectomy", "Minimally Invasive", "Endocrine Oncology"], avg_tenure_months: 66, salary_min: 380000, salary_max: 540000, status: "new" },

  // ── Project 7: Hospitalist & Internal Medicine ────────────────────────────
  { full_name: "Dr. Nia Coleman", title: "Hospitalist – Nocturnist", current_employer: "HCA Healthcare", location: "Nashville, TN", email: "n.coleman.md@email.com", phone: "615-555-5001", skills: ["Hospital Medicine", "Nocturnist", "Rapid Response", "Code Blue", "Epic EMR"], avg_tenure_months: 36, salary_min: 240000, salary_max: 310000, status: "new" },
  { full_name: "Dr. Frank Liu", title: "Academic Hospitalist", current_employer: "Vanderbilt Medical Center", location: "Nashville, TN", email: "f.liu.md@email.com", phone: "615-555-5002", skills: ["Academic Medicine", "Medical Education", "Quality Improvement", "Research", "Board Certified IM"], avg_tenure_months: 72, salary_min: 220000, salary_max: 290000, status: "contacted" },
  { full_name: "Dr. Isabel Torres", title: "Internal Medicine – Geriatrics", current_employer: "Methodist LeBonheur", location: "Memphis, TN", email: "i.torres.md@email.com", phone: "901-555-5003", skills: ["Geriatric Medicine", "Palliative Care", "Polypharmacy Management", "Dementia Care", "SNF/LTC"], avg_tenure_months: 54, salary_min: 210000, salary_max: 275000, status: "new" },
  { full_name: "Dr. Charles Bennett", title: "Chief Hospitalist", current_employer: "Ascension Saint Thomas", location: "Nashville, TN", email: "c.bennett.md@email.com", phone: "615-555-5004", skills: ["Hospital Medicine", "Physician Leadership", "Quality Metrics", "J-Commission", "Team Management"], avg_tenure_months: 96, salary_min: 280000, salary_max: 360000, status: "interested" },

  // ── Project 8: Emergency Medicine ─────────────────────────────────────────
  { full_name: "Dr. Tanya Wright", title: "Emergency Medicine Physician", current_employer: "EmCare", location: "Houston, TX", email: "t.wright.md@email.com", phone: "713-555-6001", skills: ["Emergency Medicine", "ATLS", "ACLS", "Ultrasound-Guided Procedures", "Trauma"], avg_tenure_months: 48, salary_min: 280000, salary_max: 380000, status: "new" },
  { full_name: "Dr. Marcus Johnson", title: "Emergency Physician – Pediatric EM", current_employer: "Texas Children's Hospital", location: "Houston, TX", email: "m.johnson.md@email.com", phone: "713-555-6002", skills: ["Pediatric Emergency", "Neonatal Resuscitation", "PALS", "Procedural Sedation", "Trauma Peds"], avg_tenure_months: 60, salary_min: 290000, salary_max: 400000, status: "contacted" },
  { full_name: "Dr. Leslie Chang", title: "EM Physician – Rural Critical Access", current_employer: "Envision Healthcare", location: "Rural TX", email: "l.chang.md@email.com", phone: "800-555-6003", skills: ["Rural Emergency Medicine", "Stabilization & Transfer", "Telemedicine", "Solo Coverage", "ACLS"], avg_tenure_months: 30, salary_min: 300000, salary_max: 420000, status: "new" },
  { full_name: "Dr. Andrew Rivera", title: "Emergency Medicine – Urgent Care", current_employer: "CityMD", location: "New York, NY", email: "a.rivera.md@email.com", phone: "212-555-6004", skills: ["Urgent Care", "Minor Procedures", "Point-of-Care Testing", "X-Ray Interpretation", "EMR – Athena"], avg_tenure_months: 24, salary_min: 200000, salary_max: 280000, status: "interested" },

  // ── Project 9: Anesthesiology ─────────────────────────────────────────────
  { full_name: "Dr. Patricia Huang", title: "Anesthesiologist – Cardiac", current_employer: "Texas Heart Institute", location: "Houston, TX", email: "p.huang.md@email.com", phone: "713-555-7001", skills: ["Cardiac Anesthesia", "TEE Board Certified", "Heart-Lung Bypass", "VAD Management", "Valve Surgery"], avg_tenure_months: 96, salary_min: 420000, salary_max: 580000, status: "new" },
  { full_name: "Dr. Leonard Marsh", title: "Anesthesiologist – Chronic Pain", current_employer: "Pain Management Institute", location: "Dallas, TX", email: "l.marsh.md@email.com", phone: "214-555-7002", skills: ["Interventional Pain", "Spinal Cord Stimulation", "Ketamine Infusion", "Radiofrequency Ablation", "Intrathecal Pump"], avg_tenure_months: 72, salary_min: 380000, salary_max: 520000, status: "contacted" },
  { full_name: "Dr. Grace Kim", title: "Pediatric Anesthesiologist", current_employer: "Children's Medical Center", location: "Dallas, TX", email: "g.kim.md@email.com", phone: "214-555-7003", skills: ["Pediatric Anesthesia", "Neonatal", "Congenital Heart Anesthesia", "Airway Management", "Fellowship Trained"], avg_tenure_months: 60, salary_min: 400000, salary_max: 560000, status: "new" },
  { full_name: "Dr. Victor Santos", title: "Regional Anesthesiologist", current_employer: "USAP", location: "Austin, TX", email: "v.santos.md@email.com", phone: "512-555-7004", skills: ["Ultrasound-Guided Nerve Blocks", "Peripheral Regional Anesthesia", "Spinal/Epidural", "Acute Pain Service", "ACLS"], avg_tenure_months: 48, salary_min: 360000, salary_max: 500000, status: "interested" },
];

// ─── PROJECT → CANDIDATE INDEX MAPPING ──────────────────────────────────────
// Each array entry = list of CANDIDATES[] indexes belonging to that project
const PROJECT_ASSIGNMENTS: number[][] = [
  [0,1,2,3,4,5,6,7,8,9],         // 0: ICU Nurses
  [10,11,12,13,14,15,16,17,18],   // 1: OR Technicians
  [19,20,21,22,23,24,25,26,27,28],// 2: Travel Nurses
  [29,30,31,32,33,34,35,36,37,38],// 3: Orthopedic Surgeons
  [39,40,41,42,43,44,45,46],      // 4: CRNAs
  [47,48,49,50,51],               // 5: Locum Tenens
  [52,53,54,55,56],               // 6: General Surgery
  [57,58,59,60],                  // 7: Hospitalist & Internal Medicine
  [61,62,63,64],                  // 8: Emergency Medicine
  [65,66,67,68],                  // 9: Anesthesiology
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // User-context client — used only to validate the JWT
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client — bypasses RLS for seeding
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Resolve or auto-create company ───────────────────────────────────────
    let company_id: string;
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (profile?.company_id) {
      company_id = profile.company_id;
      console.log(`Using existing company: ${company_id}`);
    } else {
      console.log("No company found — auto-creating one...");
      const { data: newCompany, error: companyError } = await supabase
        .from("companies")
        .insert({ name: "My Recruiting Firm" })
        .select("id")
        .single();

      if (companyError || !newCompany) {
        throw new Error(`Failed to create company: ${companyError?.message}`);
      }
      company_id = newCompany.id;

      // Link the profile to the new company
      await supabase
        .from("profiles")
        .update({ company_id })
        .eq("user_id", user.id);

      // Grant admin role
      await supabase
        .from("user_roles")
        .insert({ user_id: user.id, company_id, role: "admin" });

      console.log(`Created company ${company_id} and assigned admin role`);
    }

    // ── Check if data already exists (idempotent) ────────────────────────────
    const { count: existingProjects } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company_id);

    if (existingProjects && existingProjects > 0) {
      // Count candidates too
      const { count: existingCandidates } = await supabase
        .from("candidates")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company_id);
      console.log(`Data already exists: ${existingProjects} projects, ${existingCandidates} candidates`);
      return new Response(
        JSON.stringify({
          success: true,
          already_seeded: true,
          projects_created: existingProjects,
          candidates_inserted: existingCandidates ?? 0,
          message: "Sandbox data already loaded",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Create all projects in one batch ─────────────────────────────────────
    const projectRows = PROJECTS.map((proj) => ({ ...proj, company_id, created_by: user.id }));
    const { data: createdProjects, error: projectsError } = await supabase
      .from("projects")
      .insert(projectRows)
      .select("id");

    if (projectsError || !createdProjects) {
      throw new Error(`Failed to create projects: ${projectsError?.message}`);
    }
    const createdProjectIds = createdProjects.map((p: any) => p.id);
    console.log(`Created ${createdProjectIds.length} projects`);

    // ── Insert candidates in per-project batches ──────────────────────────────
    let totalInserted = 0;
    const candidateBatches: any[][] = [];

    for (let pi = 0; pi < createdProjectIds.length; pi++) {
      const projectId = createdProjectIds[pi];
      const idxList = PROJECT_ASSIGNMENTS[pi] ?? [];
      const batch = idxList
        .map((idx) => CANDIDATES[idx])
        .filter(Boolean)
        .map((candidate) => ({
          ...candidate,
          project_id: projectId,
          company_id,
          added_by: user.id,
          linkedin_url: `https://linkedin.com/in/${candidate.full_name.toLowerCase().replace(/[\s,.]+/g, "-")}-demo`,
        }));
      candidateBatches.push(batch);
    }

    // Insert all candidates in one shot
    const allCandidates = candidateBatches.flat();
    const { error: candidatesError } = await supabase.from("candidates").insert(allCandidates);
    if (candidatesError) {
      console.error("Candidates insert error:", candidatesError.message);
    } else {
      totalInserted = allCandidates.length;
    }
    console.log(`Inserted ${totalInserted} candidates`);

    console.log(`Seed complete — ${createdProjectIds.length} projects, ${totalInserted} candidates`);

    return new Response(
      JSON.stringify({ success: true, projects_created: createdProjectIds.length, candidates_inserted: totalInserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Seed error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
