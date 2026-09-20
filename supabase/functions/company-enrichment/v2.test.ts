import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  growthFromTimeseries,
  identifyCandidates,
  mapEnrichment,
  mapHeadcount,
  mapLeader,
  mapTalentFlowPerson,
  mapWebTraffic,
} from "./v2.ts";
import { pickBestCandidate } from "./matching.ts";

// Fixtures are lifted from the 2025-11-01 /company/enrich spec examples.
const serve = {
  matched_on: "serverobotics.com",
  match_type: "domain",
  matches: [{
    confidence_score: 1,
    company_data: {
      crustdata_company_id: 628895,
      basic_info: {
        crustdata_company_id: 628895,
        name: "Serve Robotics",
        primary_domain: "serverobotics.com",
        all_domains: ["serverobotics.com"],
        website: "https://www.serverobotics.com/",
        professional_network_url: "https://www.linkedin.com/company/serverobotics",
        logo_permalink: "https://crustdata-media.s3.us-east-2.amazonaws.com/company/x.jpg",
        description: "Serve Robotics (NASDAQ:SERV) develops delivery robots.",
        company_type: "Public Company",
        year_founded: 2021,
        employee_count_range: "51-200",
        industries: ["Technology, Information and Internet", "Technology, Information and Media"],
      },
      headcount: {
        total: 381,
        growth_percent: { mom: 3.81, qoq: 8.24, six_months: 24.92, yoy: 94.39, two_years: 269.9 },
        growth_absolute: { mom: 14, qoq: 29, six_months: 76, yoy: 185, two_years: 278 },
        by_function_timeseries: {
          CURRENT_FUNCTION: {
            Engineering: [
              { date: "2025-01-01", employee_count: 100 },
              { date: "2025-07-01", employee_count: 120 },
              { date: "2026-01-01", employee_count: 150 },
            ],
          },
        },
      },
      funding: { total_investment_usd: 394000000, last_round_type: "post_ipo_equity" },
      employee_reviews: {
        overall_rating: { rating: 4.1, total_count: 37 },
        company_ceo: { ceo_rating: 88 },
        business_outlook_rating: 71,
        recommend_to_friend_rating: 79,
      },
      software_reviews: { review_count: 12, average_rating: 4.4 },
      web_traffic: {
        domain_traffic: {
          "serverobotics.com": { domain: "serverobotics.com", monthly_visitors: 52000, mom_pct: 6.5 },
          "other.example": { monthly_visitors: 999999, mom_pct: 1 },
        },
      },
      competitors: { all_domains: ["starship.xyz", "coco.delivery"] },
      taxonomy: { professional_network_industry: "Robotics Engineering" },
      locations: { headquarters: "Redwood City, California, United States", state: "California", country: "United States" },
      people: {
        cxos: [{
          crustdata_person_id: 14540,
          basic_profile: { name: "Ali Kashani", current_title: "Co-Founder & CEO", profile_picture_permalink: "https://img/ali.jpg" },
          social_handles: { professional_network_identifier: { profile_url: "https://www.linkedin.com/in/alikashani" } },
        }],
        decision_makers: [{ basic_profile: { name: "Dana Ops", headline: "VP Operations at Serve" }, experience: { employment_details: { current: [{ employee_title: "VP Operations" }] } } }],
        founders: [],
      },
    },
  }],
};

Deno.test("enrichment maps v2 headcount onto the panel's v1 key names", () => {
  const m = mapEnrichment(serve.matches[0].company_data);
  const hc = m.headcount as Record<string, unknown>;
  assertEquals(hc.linkedin_headcount, 381);
  assertEquals((hc.linkedin_headcount_total_growth_percent as Record<string, number>).yoy, 94.39);
  assertEquals((hc.linkedin_headcount_total_growth_absolute as Record<string, number>).two_years, 278);
  // by-role growth derived from the function timeseries: 120→150 over 6mo = 25%, 100→150 over 12mo = 50%
  assertEquals((hc.linkedin_headcount_by_role_six_months_growth_percent as Record<string, number>).Engineering, 25);
  assertEquals((hc.linkedin_headcount_by_role_yoy_growth_percent as Record<string, number>).Engineering, 50);
  assert(hc.linkedin_headcount_by_function_timeseries);
});

Deno.test("enrichment maps basic_info, locations, taxonomy, reviews, traffic, funding, leaders", () => {
  const m = mapEnrichment(serve.matches[0].company_data);
  assertEquals(m.company_name, "Serve Robotics");
  assertEquals(m.company_website_domain, "serverobotics.com");
  assertEquals(m.linkedin_profile_url, "https://www.linkedin.com/company/serverobotics");
  assertEquals(m.linkedin_logo_url?.endsWith("x.jpg"), true);
  assertEquals(m.year_founded, 2021);
  assertEquals(m.employee_count_range, "51-200");
  assertEquals(m.hq_city, "Redwood City");
  assertEquals(m.hq_state, "California");
  assertEquals(m.hq_country, "United States");
  assertEquals(m.industry, "Robotics Engineering");
  assertEquals(m.glassdoor?.overall_rating, 4.1);
  assertEquals(m.glassdoor?.review_count, 37);
  assertEquals(m.glassdoor?.ceo_approval, 88);
  assertEquals(m.g2?.average_rating, 4.4);
  // web traffic picks the company's own domain, not the biggest entry
  assertEquals(m.web_traffic?.monthly_visitors, 52000);
  assertEquals(m.web_traffic?.growth_mom_percent, 6.5);
  assertEquals((m.funding as Record<string, unknown>).last_round_type, "post_ipo_equity");
  assertEquals(m.competitor_domains, ["starship.xyz", "coco.delivery"]);
  assertEquals(m.cxos.length, 1);
  assertEquals(m.cxos[0].name, "Ali Kashani");
  assertEquals(m.cxos[0].title, "Co-Founder & CEO");
  assertEquals(m.cxos[0].linkedin_url, "https://www.linkedin.com/in/alikashani");
  assertEquals(m.cxos[0].profile_picture_url, "https://img/ali.jpg");
  // title falls back to the current employment row, then the headline
  assertEquals(m.decision_makers[0].title, "VP Operations");
});

Deno.test("empty sections map to null / [] rather than throwing", () => {
  const m = mapEnrichment({ crustdata_company_id: 1, basic_info: { name: "Tiny Practice" } });
  assertEquals(m.company_name, "Tiny Practice");
  assertEquals(m.headcount, null);
  assertEquals(m.glassdoor, null);
  assertEquals(m.web_traffic, null);
  assertEquals(m.cxos, []);
  assertEquals(m.competitor_domains, []);
  assertEquals(mapHeadcount(null), null);
  assertEquals(mapLeader({ basic_profile: {} }), null);
  assertEquals(mapWebTraffic({ domain_traffic: {} }, "x.com"), null);
});

Deno.test("growthFromTimeseries needs a point old enough, and never divides by zero", () => {
  assertEquals(growthFromTimeseries([{ date: "2026-01-01", employee_count: 10 }], 6), null);
  assertEquals(growthFromTimeseries([{ date: "2025-12-01", employee_count: 10 }, { date: "2026-01-01", employee_count: 12 }], 6), null);
  assertEquals(growthFromTimeseries([{ date: "2025-01-01", employee_count: 0 }, { date: "2026-01-01", employee_count: 12 }], 6), null);
  assertEquals(growthFromTimeseries([{ date: "2025-01-01", employee_count: 80 }, { date: "2026-01-01", employee_count: 100 }], 6), 25);
});

Deno.test("identify by name: the real company wins over fuzzy name-alikes (spec: Serve Robotics)", () => {
  const byName = {
    matched_on: "Serve Robotics",
    match_type: "name",
    matches: [
      { confidence_score: 11, company_data: { crustdata_company_id: 628895, basic_info: { name: "Serve Robotics", primary_domain: "serverobotics.com", employee_count_range: "51-200" } } },
      { confidence_score: 4, company_data: { crustdata_company_id: 5825197, basic_info: { name: "Site Serve Robotics", primary_domain: "siteserverobotics.co.uk", employee_count_range: "2-10" } } },
      { confidence_score: 4, company_data: { crustdata_company_id: 25592234, basic_info: { name: "iServe Robotics", primary_domain: "iserve.ai", employee_count_range: "2-10" } } },
    ],
  };
  const cands = identifyCandidates(byName);
  assertEquals(cands.length, 3);
  assertEquals(pickBestCandidate(cands, "Serve Robotics", null)?.company_id, 628895);
});

Deno.test("identify by domain: exact domain evidence beats a bigger sibling on the same domain (spec: Cashfree)", () => {
  const byDomain = {
    matched_on: "cashfree.com",
    match_type: "domain",
    matches: [
      { confidence_score: 15, company_data: { crustdata_company_id: 622934, basic_info: { name: "Cashfree Payments", primary_domain: "cashfree.com", employee_count_range: "501-1000" } } },
      { confidence_score: 4, company_data: { crustdata_company_id: 908846, basic_info: { name: "Cashfree Tech", primary_domain: "cashfree.com", employee_count_range: "51-200" } } },
      { confidence_score: 2, company_data: { crustdata_company_id: 10956299, basic_info: { name: "WTFraud", primary_domain: "cashfree.com" } } },
    ],
  };
  const cands = identifyCandidates(byDomain, "https://www.cashfree.com/");
  assert(cands.every((c) => c.is_full_domain_match));
  assertEquals(pickBestCandidate(cands, "Cashfree", "cashfree.com")?.company_id, 622934);
});

Deno.test("talent flow: a v2 person row maps to the panel's TalentFlowPerson", () => {
  const person = {
    basic_profile: { name: "Jane Doe", first_name: "Jane", last_name: "Doe", headline: "ICU RN", profile_picture_permalink: "https://img/j.jpg" },
    social_handles: { professional_network_identifier: { profile_url: "https://www.linkedin.com/in/janedoe" } },
    experience: {
      employment_details: {
        current: [{ crustdata_company_id: 42, company_name: "UCHealth", title: "ICU Nurse", start_date: "2026-03-01", seniority_level: "Senior" }],
        past: [{ crustdata_company_id: 7, name: "HCA Healthcare", title: "Med/Surg RN", end_date: "2026-02-15" }],
      },
    },
  };
  const hire = mapTalentFlowPerson(person, new Set([42]), "hires");
  assertEquals(hire.name, "Jane Doe");
  assertEquals(hire.current_company, "UCHealth");
  assertEquals(hire.current_title, "ICU Nurse");
  assertEquals(hire.current_company_start_date, "2026-03-01");
  assertEquals(hire.previous_company, "HCA Healthcare");
  assertEquals(hire.previous_end_date, "2026-02-15");
  assertEquals(hire.seniority_level, "Senior");
  assertEquals(hire.linkedin_profile_url, "https://www.linkedin.com/in/janedoe");
  const departure = mapTalentFlowPerson(person, new Set([7]), "departures");
  assertEquals(departure.previous_company, "HCA Healthcare");
  assertEquals(departure.current_company, "UCHealth");
});
