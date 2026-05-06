import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface ResumeIn {
  file_name: string;
  text: string;
}

interface Body {
  job_description: string;
  title?: string;
  resumes: ResumeIn[];
}

const requirementsTool = {
  type: "function",
  function: {
    name: "extract_requirements",
    description: "Extract structured technical requirements from a job description.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        required_skills: { type: "array", items: { type: "string" } },
        nice_to_have: { type: "array", items: { type: "string" } },
        min_years_experience: { type: "number" },
        education: { type: "array", items: { type: "string" } },
        certifications: { type: "array", items: { type: "string" } },
      },
      required: ["required_skills"],
      additionalProperties: false,
    },
  },
};

const candidateTool = {
  type: "function",
  function: {
    name: "score_candidate",
    description:
      "Parse a resume and score it against the job requirements based purely on technical fit.",
    parameters: {
      type: "object",
      properties: {
        candidate_name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        years_experience: { type: "number" },
        education: { type: "array", items: { type: "string" } },
        experience: {
          type: "array",
          items: {
            type: "object",
            properties: {
              company: { type: "string" },
              role: { type: "string" },
              duration: { type: "string" },
            },
          },
        },
        skills: { type: "array", items: { type: "string" } },
        certifications: { type: "array", items: { type: "string" } },
        score: {
          type: "number",
          description: "Overall fit score 0-100 based on technical match.",
        },
        skill_match: {
          type: "array",
          items: {
            type: "object",
            properties: {
              skill: { type: "string" },
              matched: { type: "boolean" },
              evidence: { type: "string" },
            },
            required: ["skill", "matched"],
          },
        },
        strengths: { type: "array", items: { type: "string" } },
        gaps: { type: "array", items: { type: "string" } },
        summary: { type: "string" },
      },
      required: ["score", "skill_match", "strengths", "gaps", "summary"],
      additionalProperties: false,
    },
  },
};

async function callAI(messages: any[], tool: any) {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
      tools: [tool],
      tool_choice: { type: "function", function: { name: tool.function.name } },
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`AI ${r.status}: ${t}`);
  }
  const data = await r.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  return args ? JSON.parse(args) : {};
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    if (!body?.job_description || !Array.isArray(body.resumes) || body.resumes.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Extract requirements
    const requirements = await callAI(
      [
        {
          role: "system",
          content:
            "You extract precise technical requirements from job descriptions. Focus on hard skills, tools, and quantitative criteria.",
        },
        { role: "user", content: body.job_description },
      ],
      requirementsTool,
    );

    // 2. Create analysis row
    const { data: analysis, error: aErr } = await supabase
      .from("job_analyses")
      .insert({
        user_id: user.id,
        title: body.title || requirements.title || "Untitled Analysis",
        job_description: body.job_description,
        requirements,
        status: "processing",
      })
      .select()
      .single();
    if (aErr) throw aErr;

    // 3. Score each resume (sequentially to respect rate limits)
    const candidates: any[] = [];
    for (const r of body.resumes) {
      try {
        const scored = await callAI(
          [
            {
              role: "system",
              content:
                "You are an expert technical recruiter. Parse the resume and objectively score the candidate against the requirements. Score 0-100 reflecting technical fit only. Be strict and evidence-based.",
            },
            {
              role: "user",
              content: `JOB REQUIREMENTS:\n${JSON.stringify(requirements)}\n\nRESUME (${r.file_name}):\n${r.text.slice(0, 18000)}`,
            },
          ],
          candidateTool,
        );
        candidates.push({
          analysis_id: analysis.id,
          user_id: user.id,
          file_name: r.file_name,
          raw_text: r.text.slice(0, 50000),
          candidate_name: scored.candidate_name ?? null,
          email: scored.email ?? null,
          phone: scored.phone ?? null,
          years_experience: scored.years_experience ?? null,
          education: scored.education ?? [],
          experience: scored.experience ?? [],
          skills: scored.skills ?? [],
          certifications: scored.certifications ?? [],
          score: scored.score ?? 0,
          skill_match: scored.skill_match ?? [],
          strengths: scored.strengths ?? [],
          gaps: scored.gaps ?? [],
          summary: scored.summary ?? "",
        });
      } catch (e) {
        console.error("score error", r.file_name, e);
        candidates.push({
          analysis_id: analysis.id,
          user_id: user.id,
          file_name: r.file_name,
          raw_text: r.text.slice(0, 50000),
          score: 0,
          summary: `Failed to analyze: ${e instanceof Error ? e.message : String(e)}`,
          skill_match: [],
          strengths: [],
          gaps: [],
        });
      }
    }

    const { error: cErr } = await supabase.from("candidates").insert(candidates);
    if (cErr) throw cErr;

    await supabase
      .from("job_analyses")
      .update({ status: "complete" })
      .eq("id", analysis.id);

    return new Response(
      JSON.stringify({ analysis_id: analysis.id, requirements, count: candidates.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("429") ? 429 : msg.includes("402") ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
