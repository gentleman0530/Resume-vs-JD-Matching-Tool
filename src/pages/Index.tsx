import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { extractPdfText } from "@/lib/pdf";
import { RankingPanel, type Candidate, type Requirements } from "@/components/RankingPanel";
import { FileText, LogOut, Sparkles, Trash2, Upload } from "lucide-react";

interface Pending {
  file: File;
  text?: string;
  status: "pending" | "parsing" | "ready" | "error";
  error?: string;
}

const Index = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [jd, setJd] = useState("");
  const [files, setFiles] = useState<Pending[]>([]);
  const [running, setRunning] = useState(false);

  const [requirements, setRequirements] = useState<Requirements | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [analysisTitle, setAnalysisTitle] = useState("Untitled Analysis");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate("/auth", { replace: true });
      else setEmail(session.user.email ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate("/auth", { replace: true });
      else { setEmail(data.session.user.email ?? null); setChecking(false); }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const onPick = async (list: FileList | null) => {
    if (!list) return;
    const incoming: Pending[] = Array.from(list)
      .filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"))
      .map((f) => ({ file: f, status: "parsing" as const }));
    if (incoming.length === 0) return toast.error("Please select PDF files.");
    setFiles((prev) => [...prev, ...incoming]);
    for (const item of incoming) {
      try {
        const text = await extractPdfText(item.file);
        setFiles((prev) => prev.map((p) => p.file === item.file ? { ...p, text, status: "ready" } : p));
      } catch (e) {
        setFiles((prev) => prev.map((p) => p.file === item.file ? { ...p, status: "error", error: String(e) } : p));
      }
    }
  };

  const removeFile = (f: File) =>
    setFiles((prev) => prev.filter((p) => p.file !== f));

  const analyze = async () => {
    if (!jd.trim()) return toast.error("Add a job description.");
    const ready = files.filter((f) => f.status === "ready" && f.text);
    if (ready.length === 0) return toast.error("Add at least one PDF resume.");
    setRunning(true);
    setCandidates([]);
    setRequirements(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-resumes", {
        body: {
          job_description: jd,
          title: title || undefined,
          resumes: ready.map((r) => ({ file_name: r.file.name, text: r.text! })),
        },
      });
      if (error) throw error;
      const analysisId = (data as any).analysis_id as string;
      const reqs = (data as any).requirements as Requirements;
      setRequirements(reqs);

      const { data: rows, error: cErr } = await supabase
        .from("candidates")
        .select("*")
        .eq("analysis_id", analysisId)
        .order("score", { ascending: false });
      if (cErr) throw cErr;
      setCandidates(rows as any);
      setAnalysisTitle(title || reqs?.title || "Untitled Analysis");
      toast.success(`Analyzed ${rows?.length ?? 0} candidates`);
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || "Analysis failed";
      if (msg.includes("429")) toast.error("Rate limit reached. Try again shortly.");
      else if (msg.includes("402")) toast.error("AI credits exhausted. Add credits in Settings.");
      else toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  if (checking) return <div className="min-h-screen bg-gradient-subtle" />;

  const readyCount = files.filter((f) => f.status === "ready").length;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b bg-background/70 backdrop-blur sticky top-0 z-20">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">ResumeRank</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground hidden sm:inline">{email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-1.5" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="bg-gradient-hero -mx-4 px-4 -mt-8 pt-8 pb-6 mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight max-w-3xl">
            Find the strongest candidates from a stack of resumes — in seconds.
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Batch upload PDF resumes, paste a job description, and let AI rank every candidate
            based purely on technical fit.
          </p>
        </div>

        <div className="grid lg:grid-cols-[420px_1fr] gap-6">
          {/* Left panel */}
          <div className="space-y-4">
            <Card className="p-5 space-y-4 shadow-soft">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Step 1</Label>
                <h3 className="font-semibold">Upload resumes</h3>
              </div>
              <label className="block border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors">
                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <div className="text-sm font-medium">Click to select PDFs</div>
                <div className="text-xs text-muted-foreground mt-0.5">Multiple files supported</div>
                <input
                  type="file"
                  accept="application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => { onPick(e.target.files); e.target.value = ""; }}
                />
              </label>
              {files.length > 0 && (
                <div className="space-y-1.5 max-h-64 overflow-auto pr-1">
                  {files.map((f) => (
                    <div key={f.file.name + f.file.size} className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-2.5 py-1.5">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{f.file.name}</span>
                      <span className={`text-xs ${
                        f.status === "ready" ? "text-success" :
                        f.status === "error" ? "text-destructive" :
                        "text-muted-foreground"
                      }`}>
                        {f.status === "parsing" ? "parsing…" : f.status === "ready" ? "ready" : f.status === "error" ? "error" : ""}
                      </span>
                      <button onClick={() => removeFile(f.file)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="text-xs text-muted-foreground pt-1">
                    {readyCount} of {files.length} ready
                  </div>
                </div>
              )}
            </Card>

            <Card className="p-5 space-y-3 shadow-soft">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Step 2</Label>
                <h3 className="font-semibold">Job description</h3>
              </div>
              <Input
                placeholder="Job title (optional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Textarea
                placeholder="Paste the full job description here. Include required skills, years of experience, and qualifications…"
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                rows={10}
                className="resize-none"
              />
            </Card>

            <Button
              onClick={analyze}
              disabled={running || readyCount === 0 || !jd.trim()}
              size="lg"
              className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-elegant"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {running ? `Analyzing ${readyCount} resumes…` : `Analyze ${readyCount || ""} resume${readyCount === 1 ? "" : "s"}`.trim()}
            </Button>
          </div>

          {/* Right panel */}
          <div>
            <RankingPanel
              title={analysisTitle}
              requirements={requirements}
              candidates={candidates}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
