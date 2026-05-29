import pdfParse from "pdf-parse";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { cleanPdfText } from "@/lib/pdf/clean";

export type PdfPageText = {
  pageNumber: number;
  text: string;
};

const execFileAsync = promisify(execFile);

async function withTempPdf<T>(buffer: Buffer, action: (filePath: string) => Promise<T>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sudan-ai-pdf-"));
  const filePath = path.join(dir, `${crypto.randomUUID()}.pdf`);

  try {
    await fs.writeFile(filePath, buffer);
    return await action(filePath);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function splitPopplerPages(stdout: string): PdfPageText[] {
  return stdout
    .split("\f")
    .map((text, index) => ({
      pageNumber: index + 1,
      text: cleanPdfText(text)
    }))
    .filter((page) => page.text.length > 0);
}

async function extractWithPoppler(filePath: string, firstPageOnly = false) {
  const args = [
    ...(firstPageOnly ? ["-f", "1", "-l", "1"] : []),
    "-enc",
    "UTF-8",
    "-layout",
    filePath,
    "-"
  ];

  const { stdout } = await execFileAsync("pdftotext", args, {
    encoding: "utf8",
    maxBuffer: 150 * 1024 * 1024,
    windowsHide: true
  });

  return splitPopplerPages(stdout);
}

export async function extractPdfPagesFromBuffer(buffer: Buffer): Promise<PdfPageText[]> {
  try {
    const pages = await withTempPdf(buffer, (filePath) => extractWithPoppler(filePath));
    if (pages.length) return pages;
  } catch {
    // Poppler is optional in production; pdf-parse remains the portable fallback.
  }

  const pages: PdfPageText[] = [];

  await pdfParse(buffer, {
    pagerender: async (pageData: {
      pageNumber?: number;
      getTextContent: (options?: Record<string, unknown>) => Promise<{
        items: Array<{ str?: string }>;
      }>;
    }) => {
      const content = await pageData.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false
      });
      const text = cleanPdfText(
        content.items
          .map((item) => item.str || "")
          .join(" ")
      );

      pages.push({
        pageNumber: pageData.pageNumber || pages.length + 1,
        text
      });

      return text;
    }
  });

  return pages
    .filter((page) => page.text.length > 0)
    .sort((a, b) => a.pageNumber - b.pageNumber);
}

export async function extractFirstPageText(buffer: Buffer) {
  try {
    const [page] = await withTempPdf(buffer, (filePath) => extractWithPoppler(filePath, true));
    if (page?.text) return page.text;
  } catch {
    // Fall back below when Poppler is unavailable.
  }

  const data = await pdfParse(buffer, { max: 1 });
  return cleanPdfText(data.text || "");
}
