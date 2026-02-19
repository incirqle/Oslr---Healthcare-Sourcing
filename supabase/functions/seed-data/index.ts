import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── PROJECTS ────────────────────────────────────────────────────────────────
const PROJECTS = [
  // Original 3
  { name: "ICU Nurses – Q1 Hiring", description: "Critical care nurses for the new ICU wing opening in March." },
  { name: "OR Technicians – Dallas Region", description: "Surgical techs and OR RNs across DFW metro." },
  { name: "Travel Nurses – Nationwide", description: "Contract & travel nursing positions, 13-week assignments." },
  // New physician / specialist projects
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
  { full_name: "Stephanie Collins, CRNA", title: "CRNA – Pain Management", current_employer: "Texas Pain Institute", location: "San Antonio, TX", email: "s.collins.crna@email.com", phone: "210-555-2006", skills: ["Chronic Pain Interventions", "Epidural Steroid Injection", "Spinal Cord Stimulation", "Nerve Blocks", "Fluoroscopy"], avg_tenure_months: 54, salary_min: 175000, salary_max: 225000, status: "contacted" },
  { full_name: "Jason Moore, CRNA", title: "CRNA – Outpatient Surgery Center", current_employer: "USAP Texas", location: "Frisco, TX", email: "j.moore.crna@email.com", phone: "469-555-2007", skills: ["Ambulatory Anesthesia", "MAC", "LMA Techniques", "Rapid Discharge", "Multi-specialty ASC"], avg_tenure_months: 36, salary_min: 170000, salary_max: 220000, status: "new" },
  { full_name: "Rebecca Simmons, CRNA", title: "CRNA – Locum / Travel", current_employer: "VISTA Staffing Solutions", location: "Nashville, TN", email: "r.simmons.crna@email.com", phone: "615-555-2008", skills: ["All Anesthesia Types", "Locum CRNA", "Flexible Placement", "Multi-State Licensure", "Rural & Urban Settings"], avg_tenure_months: 24, salary_min: 200000, salary_max: 290000, status: "interested" },
  { full_name: "David Choi, CRNA", title: "CRNA – Trauma Anesthesia", current_employer: "Memorial Hermann Trauma Center", location: "Houston, TX", email: "d.choi.crna@email.com", phone: "713-555-2009", skills: ["Trauma Anesthesia", "Damage Control", "Rapid Sequence Intubation", "Blood Product Management", "Critical Care"], avg_tenure_months: 42, salary_min: 195000, salary_max: 250000, status: "new" },
  { full_name: "Lisa Nakamura, CRNA", title: "CRNA – Thoracic Anesthesia", current_employer: "St. David's Medical Center", location: "Austin, TX", email: "l.nakamura.crna@email.com", phone: "512-555-2010", skills: ["One-Lung Ventilation", "Thoracoscopy", "Robotic Thoracic Anesthesia", "Lung Isolation", "VATS Procedures"], avg_tenure_months: 58, salary_min: 205000, salary_max: 265000, status: "contacted" },

  // ── Project 5: Locum Tenens ────────────────────────────────────────────────
  { full_name: "Dr. Charles Whitfield", title: "Locum Hospitalist – Internal Medicine", current_employer: "CompHealth", location: "Various", email: "c.whitfield.md@email.com", phone: "800-555-3001", skills: ["Inpatient Medicine", "Locum Tenens", "Multi-State Licenses", "Epic", "Rapid Onboarding"], avg_tenure_months: 6, salary_min: 200000, salary_max: 310000, status: "new" },
  { full_name: "Dr. Ingrid Petersen", title: "Locum Emergency Medicine Physician", current_employer: "Weatherby Healthcare", location: "Various", email: "i.petersen.md@email.com", phone: "800-555-3002", skills: ["Emergency Medicine", "ABEM Board Certified", "ACLS", "ATLS", "Rural EM Experience"], avg_tenure_months: 8, salary_min: 220000, salary_max: 360000, status: "contacted" },
  { full_name: "Dr. Raymond Brooks", title: "Locum General Surgeon", current_employer: "Staff Care", location: "Various", email: "r.brooks.md@email.com", phone: "800-555-3003", skills: ["Laparoscopic Surgery", "Appendectomy", "Cholecystectomy", "Hernia Repair", "Critical Access Hospital"], avg_tenure_months: 9, salary_min: 300000, salary_max: 460000, status: "interested" },
  { full_name: "Dr. Yolanda Fleming", title: "Locum OB/GYN Physician", current_employer: "Global Medical Staffing", location: "Various", email: "y.fleming.md@email.com", phone: "800-555-3004", skills: ["Obstetrics", "Gynecology", "C-Sections", "Laparoscopic GYN", "ABOG Board Certified"], avg_tenure_months: 7, salary_min: 250000, salary_max: 400000, status: "new" },
  { full_name: "Dr. Samuel Grant", title: "Locum Psychiatrist", current_employer: "Locum Leaders", location: "Various", email: "s.grant.md@email.com", phone: "800-555-3005", skills: ["Adult Psychiatry", "Inpatient Psych", "Child & Adolescent", "Telepsychiatry", "ABPN Board Certified"], avg_tenure_months: 12, salary_min: 220000, salary_max: 340000, status: "contacted" },
  { full_name: "Dr. Felicia Armstrong", title: "Locum Pediatrician", current_employer: "CompHealth", location: "Various", email: "f.armstrong.md@email.com", phone: "800-555-3006", skills: ["Pediatrics", "NICU Coverage", "Well-Child Visits", "PALS", "ABP Board Certified"], avg_tenure_months: 10, salary_min: 185000, salary_max: 270000, status: "new" },
  { full_name: "Dr. Trevor Mason", title: "Locum Radiologist", current_employer: "Teleradiology Specialists", location: "Remote", email: "t.mason.md@email.com", phone: "800-555-3007", skills: ["Diagnostic Radiology", "Teleradiology", "CT", "MRI", "Mammography ABR Certified"], avg_tenure_months: 5, salary_min: 350000, salary_max: 520000, status: "interested" },
  { full_name: "Dr. Nadia Petrov", title: "Locum Anesthesiologist", current_employer: "Barton Associates", location: "Various", email: "n.petrov.md@email.com", phone: "800-555-3008", skills: ["General Anesthesia", "Cardiac Anesthesia", "Regional Blocks", "ABA Board Certified", "Multi-State Licensed"], avg_tenure_months: 6, salary_min: 380000, salary_max: 580000, status: "new" },
  { full_name: "Dr. Marcus Jennings", title: "Locum Neurologist", current_employer: "Medical Staffing Network", location: "Various", email: "m.jennings.md@email.com", phone: "800-555-3009", skills: ["Neurology", "Stroke Response", "EEG Interpretation", "EMG/NCS", "AAN Board Certified"], avg_tenure_months: 8, salary_min: 240000, salary_max: 380000, status: "contacted" },
  { full_name: "Dr. Helen Sorensen", title: "Locum Family Medicine Physician", current_employer: "Jackson + Coker", location: "Various", email: "h.sorensen.md@email.com", phone: "800-555-3010", skills: ["Family Medicine", "Rural Health", "Minor Procedures", "ABFM Board Certified", "Independent Practice"], avg_tenure_months: 9, salary_min: 170000, salary_max: 250000, status: "new" },

  // ── Project 6: General Surgeons ───────────────────────────────────────────
  { full_name: "Dr. Gregory Holloway", title: "General Surgeon – Minimally Invasive", current_employer: "Baylor University Medical Center", location: "Dallas, TX", email: "g.holloway.md@email.com", phone: "214-555-4001", skills: ["Laparoscopic Surgery", "Robotic Surgery – DaVinci", "Hernia Repair", "Cholecystectomy", "ABS Board Certified"], avg_tenure_months: 96, salary_min: 380000, salary_max: 520000, status: "new" },
  { full_name: "Dr. Camille Dupont", title: "Colorectal Surgeon", current_employer: "UT Southwestern Medical Center", location: "Dallas, TX", email: "c.dupont.md@email.com", phone: "214-555-4002", skills: ["Colon Resection", "Proctology", "Inflammatory Bowel Disease", "Robotic Colorectal", "FASCRS Fellowship"], avg_tenure_months: 72, salary_min: 410000, salary_max: 560000, status: "contacted" },
  { full_name: "Dr. Anthony Reeves", title: "Bariatric Surgeon", current_employer: "Houston Methodist", location: "Houston, TX", email: "a.reeves.md@email.com", phone: "713-555-4003", skills: ["Gastric Bypass", "Sleeve Gastrectomy", "LAP-BAND", "Metabolic Surgery", "ASMBS Member"], avg_tenure_months: 60, salary_min: 390000, salary_max: 530000, status: "interested" },
  { full_name: "Dr. Jessica Thornton", title: "Breast Surgeon – Oncology", current_employer: "MD Anderson Cancer Center", location: "Houston, TX", email: "j.thornton.md@email.com", phone: "713-555-4004", skills: ["Mastectomy", "Breast Conservation", "Sentinel Node Biopsy", "Oncoplastic Surgery", "SSO Member"], avg_tenure_months: 84, salary_min: 420000, salary_max: 580000, status: "new" },
  { full_name: "Dr. Nathan Price", title: "Trauma & Acute Care Surgeon", current_employer: "Parkland Memorial Hospital", location: "Dallas, TX", email: "n.price.md@email.com", phone: "214-555-4005", skills: ["Damage Control Surgery", "Trauma Laparotomy", "FAST Exam", "ATLS", "Level I Trauma Experience"], avg_tenure_months: 48, salary_min: 430000, salary_max: 600000, status: "contacted" },
  { full_name: "Dr. Paula Mendez", title: "Endocrine Surgeon", current_employer: "Christus Health System", location: "San Antonio, TX", email: "p.mendez.md@email.com", phone: "210-555-4006", skills: ["Thyroidectomy", "Parathyroidectomy", "Adrenalectomy", "Pancreatic Surgery", "AAES Member"], avg_tenure_months: 66, salary_min: 400000, salary_max: 550000, status: "new" },
  { full_name: "Dr. Derek Olson", title: "Hepatopancreatobiliary Surgeon", current_employer: "Texas Liver Institute", location: "San Antonio, TX", email: "d.olson.md@email.com", phone: "210-555-4007", skills: ["Liver Resection", "Whipple Procedure", "Pancreatectomy", "Biliary Reconstruction", "HPB Fellowship"], avg_tenure_months: 78, salary_min: 480000, salary_max: 680000, status: "interested" },
  { full_name: "Dr. Alicia Fleming", title: "Vascular Surgeon", current_employer: "Memorial Hermann", location: "Houston, TX", email: "a.fleming.md@email.com", phone: "713-555-4008", skills: ["EVAR", "Carotid Endarterectomy", "Bypass Surgery", "Endovascular Procedures", "ABVS Board Certified"], avg_tenure_months: 90, salary_min: 460000, salary_max: 640000, status: "new" },
  { full_name: "Dr. Marcus Chen", title: "Thoracic Surgeon", current_employer: "St. Luke's Health", location: "Houston, TX", email: "m.chen.md@email.com", phone: "713-555-4009", skills: ["VATS Lobectomy", "Esophagectomy", "Robotic Thoracic", "Mesothelioma Surgery", "STS Member"], avg_tenure_months: 84, salary_min: 490000, salary_max: 700000, status: "contacted" },
  { full_name: "Dr. Sandra Ellis", title: "General Surgeon – Rural Critical Access", current_employer: "Community Health Systems", location: "Amarillo, TX", email: "s.ellis.md@email.com", phone: "806-555-4010", skills: ["General Surgery", "Trauma First Responder", "Endoscopy", "OB Emergency Coverage", "Critical Access Hospital"], avg_tenure_months: 54, salary_min: 340000, salary_max: 480000, status: "new" },

  // ── Project 7: Hospitalists & Internal Medicine ────────────────────────────
  { full_name: "Dr. Victor Huang", title: "Hospitalist – Internal Medicine", current_employer: "Sound Physicians", location: "Dallas, TX", email: "v.huang.md@email.com", phone: "214-555-5001", skills: ["Inpatient Medicine", "Care Coordination", "Epic EMR", "ABIM Board Certified", "Rapid Discharge Planning"], avg_tenure_months: 36, salary_min: 220000, salary_max: 290000, status: "new" },
  { full_name: "Dr. Lisa Okafor", title: "Nocturnist – Hospital Medicine", current_employer: "Envision Healthcare", location: "Houston, TX", email: "l.okafor.md@email.com", phone: "713-555-5002", skills: ["Nocturnist", "Rapid Response", "Critical Care Triage", "ABIM Certified", "Procedure Competency"], avg_tenure_months: 28, salary_min: 230000, salary_max: 310000, status: "contacted" },
  { full_name: "Dr. Aaron Simmons", title: "Internist – Geriatric Focus", current_employer: "Texas Health Resources", location: "Fort Worth, TX", email: "a.simmons.md@email.com", phone: "817-555-5003", skills: ["Geriatric Medicine", "Inpatient Internal Medicine", "Palliative Care", "Polypharmacy Management", "ABIM Certified"], avg_tenure_months: 54, salary_min: 215000, salary_max: 280000, status: "interested" },
  { full_name: "Dr. Melissa Park", title: "Hospitalist – Procedure Team", current_employer: "TeamHealth", location: "San Antonio, TX", email: "m.park.md@email.com", phone: "210-555-5004", skills: ["Central Lines", "Thoracentesis", "Paracentesis", "Lumbar Puncture", "Ultrasound Guidance"], avg_tenure_months: 40, salary_min: 235000, salary_max: 305000, status: "new" },
  { full_name: "Dr. James Reyes", title: "Infectious Disease Hospitalist", current_employer: "UT Health San Antonio", location: "San Antonio, TX", email: "j.reyes.md@email.com", phone: "210-555-5005", skills: ["Infectious Disease Consult", "Antibiotic Stewardship", "HIV Management", "Fungal Infections", "ABIM ID Subspecialty"], avg_tenure_months: 60, salary_min: 240000, salary_max: 320000, status: "contacted" },

  // ── Project 8: Emergency Medicine ─────────────────────────────────────────
  { full_name: "Dr. Brittany Lawson", title: "Emergency Medicine Physician", current_employer: "HCA Emergency Medicine", location: "Nashville, TN", email: "b.lawson.md@email.com", phone: "615-555-6001", skills: ["Emergency Medicine", "ACLS", "ATLS", "ABEM Board Certified", "Level I Trauma"], avg_tenure_months: 48, salary_min: 280000, salary_max: 380000, status: "new" },
  { full_name: "Dr. Kevin O'Brien", title: "EM Physician – Pediatric EM", current_employer: "Cincinnati Children's", location: "Cincinnati, OH", email: "k.obrien.md@email.com", phone: "513-555-6002", skills: ["Pediatric Emergency", "PALS", "ABEM Certified", "Pediatric Procedures", "Trauma Pediatrics"], avg_tenure_months: 66, salary_min: 290000, salary_max: 390000, status: "contacted" },
  { full_name: "Dr. Anita Gupta", title: "Emergency Physician – Ultrasound Director", current_employer: "Mount Sinai Health System", location: "New York, NY", email: "a.gupta.md@email.com", phone: "212-555-6003", skills: ["POCUS", "Bedside Ultrasound", "Ultrasound Teaching", "ABEM Certified", "Resuscitation"], avg_tenure_months: 72, salary_min: 340000, salary_max: 450000, status: "interested" },
  { full_name: "Dr. Marcus Riley", title: "Emergency Medicine – Rural/Critical Access", current_employer: "Benefis Health System", location: "Great Falls, MT", email: "m.riley.md@email.com", phone: "406-555-6004", skills: ["Rural Emergency Medicine", "Solo Coverage", "ACLS", "ATLS", "Independent Practice"], avg_tenure_months: 36, salary_min: 310000, salary_max: 420000, status: "new" },
  { full_name: "Dr. Patricia Stone", title: "Urgent Care Medical Director", current_employer: "CareNow Urgent Care", location: "Dallas, TX", email: "p.stone.md@email.com", phone: "214-555-6005", skills: ["Urgent Care", "Occupational Medicine", "Minor Procedures", "Medical Direction", "ABEM or ABFM Certified"], avg_tenure_months: 44, salary_min: 240000, salary_max: 320000, status: "contacted" },

  // ── Project 9: Anesthesiology ──────────────────────────────────────────────
  { full_name: "Dr. Richard Stanton", title: "Anesthesiologist – Cardiac", current_employer: "Texas Heart Institute", location: "Houston, TX", email: "r.stanton.md@email.com", phone: "713-555-7001", skills: ["Cardiac Anesthesia", "TEE", "TIVA", "Heart Failure Management", "ABA Board Certified"], avg_tenure_months: 120, salary_min: 460000, salary_max: 620000, status: "new" },
  { full_name: "Dr. Monica Walsh", title: "Anesthesiologist – Obstetric", current_employer: "Cedars-Sinai Medical Center", location: "Los Angeles, CA", email: "m.walsh.md@email.com", phone: "310-555-7002", skills: ["OB Anesthesia", "High-Risk Pregnancy", "Epidural Analgesia", "Spinal Anesthesia", "ABA Certified"], avg_tenure_months: 96, salary_min: 430000, salary_max: 590000, status: "contacted" },
  { full_name: "Dr. Philip Johansson", title: "Anesthesiologist – Pain Medicine", current_employer: "Cleveland Clinic Pain Center", location: "Cleveland, OH", email: "p.johansson.md@email.com", phone: "216-555-7003", skills: ["Interventional Pain", "SCS Implant", "Intrathecal Drug Delivery", "Nerve Ablation", "ABA Pain Subspecialty"], avg_tenure_months: 108, salary_min: 420000, salary_max: 580000, status: "interested" },
  { full_name: "Dr. Keiko Tanaka", title: "Pediatric Anesthesiologist", current_employer: "Boston Children's Hospital", location: "Boston, MA", email: "k.tanaka.md@email.com", phone: "617-555-7004", skills: ["Pediatric Anesthesia", "Neonatal Airway", "Congenital Heart Anesthesia", "Regional Peds", "ABA Pediatric Subspecialty"], avg_tenure_months: 84, salary_min: 440000, salary_max: 600000, status: "new" },
  { full_name: "Dr. Jorge Espinoza", title: "Anesthesiologist – Regional Anesthesia", current_employer: "Mayo Clinic", location: "Rochester, MN", email: "j.espinoza.md@email.com", phone: "507-555-7005", skills: ["Ultrasound-Guided Nerve Blocks", "Epidural Catheter", "Peripheral Nerve Block", "ERAS Protocols", "ABA Certified"], avg_tenure_months: 90, salary_min: 450000, salary_max: 610000, status: "contacted" },
];

// ── Project→Candidate index mapping ──────────────────────────────────────────
const PROJECT_ASSIGNMENTS: Record<number, number[]> = {
  0:  [0,1,2,3,4,5,6,7,8,9],          // ICU Nurses (10)
  1:  [10,11,12,13,14,15,16,17,18],    // OR Techs (9)
  2:  [19,20,21,22,23,24,25,26,27,28], // Travel Nurses (10)
  3:  [29,30,31,32,33,34,35,36,37,38], // Ortho Surgeons (10)
  4:  [39,40,41,42,43,44,45,46,47,48], // CRNAs (10)
  5:  [49,50,51,52,53,54,55,56,57,58], // Locums (10)
  6:  [59,60,61,62,63,64,65,66,67,68], // General Surgeons (10)
  7:  [69,70,71,72,73],                // Hospitalists (5)
  8:  [74,75,76,77,78],                // EM Physicians (5)
  9:  [79,80,81,82,83],                // Anesthesiologists (5)
};

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: "No company found for user" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const company_id = profile.company_id;

    // Create all projects
    const createdProjectIds: string[] = [];
    for (const proj of PROJECTS) {
      const { data, error } = await supabase
        .from("projects")
        .insert({ ...proj, company_id, created_by: user.id })
        .select("id")
        .single();
      if (error) throw new Error(`Failed to create project "${proj.name}": ${error.message}`);
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
        linkedin_url: `https://linkedin.com/in/${CANDIDATES[ci].full_name.toLowerCase().replace(/[\s,.]+/g, "-")}-demo`,
        pdl_id: `demo-${ci}-${crypto.randomUUID()}`,
      }));

      const { error, count } = await supabase
        .from("candidates")
        .insert(rows)
        .select("id", { count: "exact" });

      if (error) throw new Error(`Failed to insert candidates for project ${projIdx}: ${error.message}`);
      totalInserted += count ?? rows.length;
    }

    return new Response(
      JSON.stringify({ success: true, projects_created: createdProjectIds.length, candidates_inserted: totalInserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Seed error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
