import * as pdfjsLib from "pdfjs-dist";
// Vite-friendly worker setup
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text +=
      content.items
        .map((it: any) => ("str" in it ? it.str : ""))
        .join(" ") + "\n";
  }
  return text.replace(/\s+/g, " ").trim();
}
