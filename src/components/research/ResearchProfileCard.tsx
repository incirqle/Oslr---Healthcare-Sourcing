import { ExternalLink } from "lucide-react";

export interface ResearchProfile {
  profile_url: string | null;
  designation: string | null;
  organisation: string | null;
  interests: string[];
  article_count: number;
  co_author_count: number;
  citations: number;
  citations_recent: number;
  recent_since_year: number | null;
  h_index: number;
  i10_index: number;
  top_articles: { title: string; url: string | null; year: string | null; citations: number; publication: string | null }[];
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function ResearchProfileCard({ profile }: { profile: ResearchProfile }) {
  const stats = [
    { label: "Citations", value: fmt(profile.citations) },
    { label: "h-index", value: fmt(profile.h_index) },
    { label: "i10-index", value: fmt(profile.i10_index) },
    { label: "Publications", value: fmt(profile.article_count) },
  ];
  return (
    <section className="space-y-4 rounded-xl border border-ui-border-light bg-ui-surface-subtle p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold uppercase tracking-[0.5px] text-ui-text-muted">Academic research</h3>
          {profile.designation && <p className="mt-1 text-[13px] text-ui-text-secondary">{profile.designation}</p>}
        </div>
        {profile.profile_url && (
          <a href={profile.profile_url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-mint-ink hover:underline">
            Author profile <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-ui-border-light bg-card px-3 py-2">
            <div className="text-[18px] font-semibold text-foreground">{s.value}</div>
            <div className="text-[11px] text-ui-text-tertiary">{s.label}</div>
          </div>
        ))}
      </div>
      {profile.recent_since_year && profile.citations_recent > 0 && (
        <p className="text-[12px] text-ui-text-tertiary">{fmt(profile.citations_recent)} citations since {profile.recent_since_year} · {fmt(profile.co_author_count)} co-authors</p>
      )}
      {profile.interests.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {profile.interests.map((i) => (
            <span key={i} className="rounded-md border border-ui-border-light bg-card px-2 py-0.5 text-[12px] text-ui-text-secondary">{i}</span>
          ))}
        </div>
      )}
      {profile.top_articles.length > 0 && (
        <div className="space-y-2">
          <p className="text-[12px] font-semibold text-ui-text-secondary">Most cited work</p>
          <ul className="space-y-2">
            {profile.top_articles.map((a) => (
              <li key={a.title} className="text-[13px] leading-snug">
                {a.url ? (
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline">{a.title}</a>
                ) : <span className="text-foreground">{a.title}</span>}
                <span className="block text-[12px] text-ui-text-tertiary">
                  {[a.publication, a.year, `${fmt(a.citations)} citations`].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
