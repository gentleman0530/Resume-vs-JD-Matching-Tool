import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Check, ChevronDown, Download, Search, Trophy, X } from "lucide-react";
import {
  exportCsv, exportDocx, exportPdf, exportTxt, type CandidateRow,
} from "@/lib/exports";

export interface Candidate {
  id: string;
  file_name: string;
  candidate_name: string | null;
  email: string | null;
  phone: string | null;
  score: number;
  years_experience: number | null;
  education: string[] | null;
  experience: any[] | null;
  skills: string[] | null;
  certifications: string[] | null;
  skill_match: { skill: string; matched: boolean; evidence?: string }[] | null;
  strengths: string[] | null;
  gaps: string[] | null;
  summary: string | null;
}

export interface Requirements {
  title?: string;
  required_skills?: string[];
  nice_to_have?: string[];
  min_years_experience?: number;
  education?: string[];
  certifications?: string[];
}

interface Props {
  title: string;
  requirements: Requirements | null;
  candidates: Candidate[];
}

export function RankingPanel({ title, requirements, candidates }: Props) {
  const [query, setQuery] = useState("");
  const [minYears, setMinYears] = useState<number | "">("");

  const ranked = useMemo(() => {
    const filtered = candidates.filter((c) => {
      const q = query.trim().toLowerCase();
      const matchesQ =
        !q ||
        (c.candidate_name || "").toLowerCase().includes(q) ||
        (c.skills || []).some((s) => s.toLowerCase().includes(q));
      const matchesYears =
        minYears === "" || (c.years_experience ?? 0) >= Number(minYears);
      return matchesQ && matchesYears;
    });
    return [...filtered].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }, [candidates, query, minYears]);

  const rows: CandidateRow[] = ranked.map((c, i) => ({
    rank: i + 1,
    candidate_name: c.candidate_name,
    file_name: c.file_name,
    email: c.email,
    phone: c.phone,
    score: Math.round(c.score ?? 0),
    years_experience: c.years_experience,
    skills: c.skills || [],
    strengths: c.strengths || [],
    gaps: c.gaps || [],
    summary: c.summary || "",
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Ranked candidates
          </h2>
          <p className="text-sm text-muted-foreground">
            {ranked.length} of {candidates.length} candidate{candidates.length === 1 ? "" : "s"}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={!rows.length}>
              <Download className="h-4 w-4 mr-2" /> Export <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportCsv(rows, title)}>CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportPdf(rows, title)}>PDF report</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportTxt(rows, title)}>Plain text (.txt)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportDocx(rows, title)}>Word (.docx)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {requirements && (
        <Card className="p-4 bg-accent/40 border-accent">
          <div className="text-xs font-medium text-accent-foreground mb-2 uppercase tracking-wider">
            Job requirements detected
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(requirements.required_skills || []).map((s) => (
              <Badge key={s} className="bg-primary/10 text-primary hover:bg-primary/15">{s}</Badge>
            ))}
            {(requirements.nice_to_have || []).map((s) => (
              <Badge key={s} variant="outline">{s}</Badge>
            ))}
            {requirements.min_years_experience ? (
              <Badge variant="secondary">{requirements.min_years_experience}+ yrs</Badge>
            ) : null}
          </div>
        </Card>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name or skill…"
            className="pl-9"
          />
        </div>
        <Input
          type="number"
          value={minYears}
          onChange={(e) => setMinYears(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="Min yrs"
          className="w-28"
          min={0}
        />
      </div>

      {ranked.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground border-dashed">
          No candidates yet. Upload resumes and run an analysis.
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {ranked.map((c, i) => (
            <AccordionItem
              key={c.id}
              value={c.id}
              className="border rounded-xl bg-card shadow-sm overflow-hidden"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-4 w-full">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                    i === 0 ? "bg-gradient-primary text-primary-foreground shadow-glow" :
                    i < 3 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}>
                    #{i + 1}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-semibold truncate">
                      {c.candidate_name || c.file_name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[c.email, c.phone, c.years_experience != null ? `${c.years_experience} yrs` : null]
                        .filter(Boolean).join(" · ") || c.file_name}
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-3 w-44">
                    <Progress value={c.score} className="h-2" />
                    <span className="text-sm font-semibold tabular-nums w-12 text-right">
                      {Math.round(c.score ?? 0)}
                    </span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                {c.summary && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{c.summary}</p>
                )}
                {!!(c.skill_match?.length) && (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                      Skill match
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {c.skill_match!.map((s, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className={s.matched
                            ? "border-success/40 bg-success/10 text-success"
                            : "border-destructive/30 bg-destructive/5 text-destructive"}
                          title={s.evidence}
                        >
                          {s.matched ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                          {s.skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid sm:grid-cols-2 gap-4">
                  {!!c.strengths?.length && (
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider text-success mb-1">Strengths</div>
                      <ul className="text-sm space-y-1 list-disc pl-4">
                        {c.strengths.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {!!c.gaps?.length && (
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider text-destructive mb-1">Gaps</div>
                      <ul className="text-sm space-y-1 list-disc pl-4">
                        {c.gaps.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
                {!!c.skills?.length && (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">All skills</div>
                    <div className="flex flex-wrap gap-1">
                      {c.skills.map((s, i) => <Badge key={i} variant="secondary">{s}</Badge>)}
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
