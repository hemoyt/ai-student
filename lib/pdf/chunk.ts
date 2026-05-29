import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { cleanPdfText } from "@/lib/pdf/clean";
import type { PdfPageText } from "@/lib/pdf/extract";

export type PdfChunk = {
  text: string;
  pageNumber: number;
  chapter: string | null;
  chunkIndex: number;
};

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1200,
  chunkOverlap: 200,
  separators: ["\n\n", "\n", "۔", ".", "؟", "!", " ", ""]
});

function inferChapter(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);

  return (
    lines.find((line) =>
      /^(الفصل|الوحدة|الدرس|الباب)\s+/.test(line.replace(/\s+/g, " "))
    ) || null
  );
}

export async function chunkPdfPages(pages: PdfPageText[]) {
  const chunks: PdfChunk[] = [];
  let chunkIndex = 0;

  for (const page of pages) {
    const pageText = cleanPdfText(page.text);
    if (!pageText) continue;

    const pageChunks = await splitter.splitText(pageText);
    const chapter = inferChapter(pageText);

    for (const text of pageChunks) {
      if (text.trim().length < 40) continue;

      chunks.push({
        text: cleanPdfText(text),
        pageNumber: page.pageNumber,
        chapter,
        chunkIndex
      });
      chunkIndex += 1;
    }
  }

  return chunks;
}
