import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
} from "docx";

export interface CandidateRow {
  rank: number;
  candidate_name: string | null;
  file_name: string;
  email: string | null;
  phone: string | null;
  score: number;
  years_experience: number | null;
  skills: string[];
  strengths: string[];
  gaps: string[];
  summary: string;
}

export function exportCsv(rows: CandidateRow[], title: string) {
  const headers = [
    "Rank",
    "Candidate",
    "File",
    "Email",
    "Phone",
    "Score",
    "Years Exp",
    "Skills",
    "Strengths",
    "Gaps",
    "Summary",
  ];
  const escape = (v: any) => {
    const s = String(v ?? "").replace(/"/g, '""');
    return `"${s}"`;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.rank,
        r.candidate_name,
        r.file_name,
        r.email,
        r.phone,
        r.score,
        r.years_experience,
        (r.skills || []).join("; "),
        (r.strengths || []).join("; "),
        (r.gaps || []).join("; "),
        r.summary,
      ]
        .map(escape)
        .join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  saveAs(blob, `${slug(title)}.csv`);
}

export function exportTxt(rows: CandidateRow[], title: string) {
  const lines: string[] = [`Candidate Ranking — ${title}`, "=".repeat(60), ""];
  for (const r of rows) {
    lines.push(
      `#${r.rank}  ${r.candidate_name || r.file_name}  —  Score ${r.score}/100`,
    );
    if (r.email || r.phone) lines.push(`  Contact: ${[r.email, r.phone].filter(Boolean).join(" · ")}`);
    if (r.years_experience != null) lines.push(`  Years experience: ${r.years_experience}`);
    if (r.skills?.length) lines.push(`  Skills: ${r.skills.join(", ")}`);
    if (r.strengths?.length) lines.push(`  Strengths: ${r.strengths.join("; ")}`);
    if (r.gaps?.length) lines.push(`  Gaps: ${r.gaps.join("; ")}`);
    if (r.summary) lines.push(`  Summary: ${r.summary}`);
    lines.push("");
  }
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  saveAs(blob, `${slug(title)}.txt`);
}

export function exportPdf(rows: CandidateRow[], title: string) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 48;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(`Candidate Ranking — ${title}`, margin, y);
  y += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(new Date().toLocaleString(), margin, y);
  y += 20;
  doc.setTextColor(0);

  for (const r of rows) {
    if (y > 720) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`#${r.rank}  ${r.candidate_name || r.file_name}`, margin, y);
    doc.setFontSize(12);
    doc.text(`${r.score}/100`, margin + width - 40, y, { align: "right" });
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110);
    const meta = [r.email, r.phone, r.years_experience != null ? `${r.years_experience} yrs` : null]
      .filter(Boolean).join(" · ");
    if (meta) { doc.text(meta, margin, y); y += 14; }
    doc.setTextColor(0);
    doc.setFontSize(10);
    const block = (label: string, val: string) => {
      if (!val) return;
      const lines = doc.splitTextToSize(`${label}: ${val}`, width);
      if (y + lines.length * 12 > 760) { doc.addPage(); y = margin; }
      doc.text(lines, margin, y);
      y += lines.length * 12 + 2;
    };
    block("Skills", (r.skills || []).join(", "));
    block("Strengths", (r.strengths || []).join("; "));
    block("Gaps", (r.gaps || []).join("; "));
    block("Summary", r.summary || "");
    y += 10;
  }
  doc.save(`${slug(title)}.pdf`);
}

export async function exportDocx(rows: CandidateRow[], title: string) {
  const children: Paragraph[] = [
    new Paragraph({ text: `Candidate Ranking — ${title}`, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ children: [new TextRun({ text: new Date().toLocaleString(), italics: true, color: "888888" })] }),
    new Paragraph(""),
  ];
  for (const r of rows) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        text: `#${r.rank}  ${r.candidate_name || r.file_name}  —  ${r.score}/100`,
      }),
    );
    const meta = [r.email, r.phone, r.years_experience != null ? `${r.years_experience} years` : null]
      .filter(Boolean).join(" · ");
    if (meta) children.push(new Paragraph(meta));
    if (r.skills?.length) children.push(new Paragraph({ children: [new TextRun({ text: "Skills: ", bold: true }), new TextRun(r.skills.join(", "))] }));
    if (r.strengths?.length) children.push(new Paragraph({ children: [new TextRun({ text: "Strengths: ", bold: true }), new TextRun(r.strengths.join("; "))] }));
    if (r.gaps?.length) children.push(new Paragraph({ children: [new TextRun({ text: "Gaps: ", bold: true }), new TextRun(r.gaps.join("; "))] }));
    if (r.summary) children.push(new Paragraph({ children: [new TextRun({ text: "Summary: ", bold: true }), new TextRun(r.summary)] }));
    children.push(new Paragraph(""));
  }
  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${slug(title)}.docx`);
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "ranking";
}
