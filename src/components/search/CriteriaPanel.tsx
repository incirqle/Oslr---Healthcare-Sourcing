import { useEffect, useRef, useState } from "react";
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Lock, LockOpen, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { scoredCriteria, shortTitle, weightPercent, type RankingCriterion } from "@/lib/ranking";

const PLACEHOLDERS = [
  "Trained at an adult reconstruction fellowship",
  "Not currently at a hospital-owned group",
  "Started practice after 2015",
];

export function newCriterionId(): string {
  return "u" + Math.random().toString(36).slice(2, 10).padEnd(8, "0");
}

export function prefersReducedMotion(): boolean {
  try { return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false; } catch { return false; }
}

const reindex = (list: RankingCriterion[]) => list.map((c, i) => ({ ...c, position: i }));

export function CriteriaPanel({
  open,
  onOpenChange,
  ranking,
  onChange,
  suggestions,
  onApply,
  checking = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ranking: RankingCriterion[];
  onChange: (next: RankingCriterion[]) => void;
  suggestions: string[];
  /** Check added or edited criteria (rank_criteria). */
  onApply?: () => void;
  checking?: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 6 } }),
  );
  const [draft, setDraft] = useState("");
  const [ph, setPh] = useState(0);
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setPh((p) => (p + 1) % PLACEHOLDERS.length), 3500);
    return () => clearInterval(t);
  }, [open]);

  const scored = scoredCriteria(ranking);
  const pos = new Map(scored.map((c, i) => [c.id, i]));
  const pendingCount = ranking.length - scored.length;
  const taken = new Set(ranking.map((c) => c.text.toLowerCase().trim()));
  const openSuggestions = suggestions.filter((s) => !taken.has(s.toLowerCase().trim()));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= ranking.length || from === to) return;
    onChange(reindex(arrayMove(ranking, from, to)));
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    move(ranking.findIndex((c) => c.id === e.active.id), ranking.findIndex((c) => c.id === e.over!.id));
  };
  const add = (text: string, origin: "user" | "suggested") => {
    const t = text.trim();
    if (!t || taken.has(t.toLowerCase())) return;
    onChange(reindex([...ranking, { id: newCriterionId(), text: t, title: shortTitle(t), position: ranking.length, must_have: false, origin, pending: true }]));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b border-border px-6 py-5 text-left">
          <DialogTitle className="font-display text-xl">Rank your results</DialogTitle>
          <DialogDescription className="text-[14px]">
            Tell Oslr what matters most. Drag to put the most important first; candidates who match the top items rise to the top.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-y-auto md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:overflow-hidden">
          <section className="space-y-3 px-6 py-5 md:overflow-y-auto md:border-r md:border-border" aria-label="Your ranking">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Your ranking</p>
            {ranking.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-5 text-[14px] text-muted-foreground">
                Nothing added yet. Pick a suggestion or type your own on the right.
              </p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={ranking.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  <ol className="space-y-2">
                    {ranking.map((c, i) => (
                      <CriterionRow
                        key={c.id}
                        c={c}
                        index={i}
                        weight={c.pending ? null : weightPercent(pos.get(c.id)!, scored.length)}
                        onMove={(d) => move(i, i + d)}
                        onEdit={(text) => onChange(ranking.map((x) => (x.id === c.id ? { ...x, text, title: shortTitle(text), pending: true } : x)))}
                        onToggleMust={() => onChange(ranking.map((x) => (x.id === c.id ? { ...x, must_have: !x.must_have } : x)))}
                        onRemove={() => onChange(reindex(ranking.filter((x) => x.id !== c.id)))}
                      />
                    ))}
                  </ol>
                </SortableContext>
              </DndContext>
            )}
          </section>

          <section className="space-y-5 bg-muted/30 px-6 py-5 md:overflow-y-auto" aria-label="Add to your ranking">
            <div className="space-y-2">
              <label htmlFor="add-criterion" className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Add your own</label>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(draft, "user"); setDraft(""); }}>
                <Input id="add-criterion" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={PLACEHOLDERS[ph]} className="h-10 bg-card text-[14px]" />
                <Button type="submit" variant="outline" className="h-10 bg-card" disabled={!draft.trim()}>
                  <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
              </form>
            </div>

            {openSuggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Suggested for this search</p>
                <ul className="space-y-1.5">
                  {openSuggestions.map((s) => (
                    <li key={s}>
                      <button type="button" onClick={() => add(s, "suggested")}
                        className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-[14px] text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5">
                        <Plus className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-muted-foreground">
            {pendingCount > 0
              ? `${pendingCount} new ${pendingCount === 1 ? "item" : "items"} will be checked against these candidates.`
              : "Changes to the order apply right away."}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            <Button disabled={checking} onClick={() => { if (pendingCount > 0) onApply?.(); onOpenChange(false); }}>
              {checking ? "Checking..." : "Rank results"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CriterionRow({
  c, index, weight, onMove, onEdit, onToggleMust, onRemove,
}: {
  c: RankingCriterion;
  index: number;
  weight: number | null;
  onMove: (delta: number) => void;
  onEdit: (text: string) => void;
  onToggleMust: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: c.id,
    transition: prefersReducedMotion() ? null : { duration: 180, easing: "ease-out" },
  });
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.text);
  const handleRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => setText(c.text), [c.text]);

  const commit = () => {
    setEditing(false);
    const t = text.trim();
    if (t && t !== c.text) onEdit(t);
    else setText(c.text);
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-start gap-2 rounded-lg border border-border bg-card px-2.5 py-2.5", isDragging && "relative z-10 shadow-md")}
    >
      <button
        ref={handleRef}
        type="button"
        {...attributes}
        {...listeners}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") { e.preventDefault(); onMove(-1); requestAnimationFrame(() => handleRef.current?.focus()); }
          if (e.key === "ArrowDown") { e.preventDefault(); onMove(1); requestAnimationFrame(() => handleRef.current?.focus()); }
        }}
        aria-label={`Move ${c.title}. Position ${index + 1}. Use Up and Down arrow keys.`}
        className="mt-0.5 cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="mt-1 w-5 shrink-0 text-[14px] font-semibold tabular-nums text-foreground/70">{index + 1}</span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setText(c.text); setEditing(false); }
            }}
            className="h-8 text-sm"
            aria-label="Criterion text"
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="w-full rounded text-left text-[14px] font-medium text-foreground hover:bg-muted/60" aria-label={`Edit ${c.text}`}>
            {c.text}
          </button>
        )}
        <div className="mt-1.5 flex items-center gap-2 text-[13px]">
          <span className="tabular-nums text-muted-foreground">{weight === null ? "Not checked yet" : `${weight}% of the score`}</span>
          <button
            type="button"
            onClick={onToggleMust}
            aria-pressed={c.must_have}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-medium",
              c.must_have ? "border-primary/40 bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {c.must_have ? <Lock className="h-3 w-3" aria-hidden="true" /> : <LockOpen className="h-3 w-3" aria-hidden="true" />}
            Must-have
          </button>
        </div>
      </div>
      <button type="button" onClick={onRemove} aria-label={`Remove ${c.title}`} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}
