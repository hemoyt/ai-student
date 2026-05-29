import fs from "node:fs/promises";
import path from "node:path";

const curriculumUrl = "https://www.mdl.edu.sd/SudaneseCurriculum";
const booksDir = path.join(process.cwd(), "books");
const manifestPath = path.join(booksDir, ".mdl-intermediate-manifest.json");

type GradeId = "grade1" | "grade2" | "grade3";

type MdlGradeSection = {
  grade: GradeId;
  startId: string;
  endId: string;
};

type MdlBookLink = {
  grade: GradeId;
  url: string;
  sourceFileName: string;
  sourceKey: string;
  targetFileName: string;
};

const sections: MdlGradeSection[] = [
  { grade: "grade1", startId: "moyen-eco", endId: "moyen-eco1" },
  { grade: "grade2", startId: "moyen-eco1", endId: "moyen-eco2" },
  { grade: "grade3", startId: "moyen-eco2", endId: "faible" }
];

function decodeFileName(fileName: string) {
  try {
    return decodeURIComponent(fileName);
  } catch {
    return fileName;
  }
}

function extractSection(html: string, startId: string, endId: string) {
  const start = html.indexOf(`id="${startId}"`);
  const end = html.indexOf(`id="${endId}"`, start + startId.length);

  if (start === -1) return "";
  return html.slice(start, end === -1 ? undefined : end);
}

function sourceKey(fileName: string) {
  const decoded = decodeFileName(fileName);
  const timestamp = decoded.match(/_(\d{10})(?:[^\d]|\.pdf$)/i)?.[1];
  if (timestamp) return timestamp;

  return decoded
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function classifySubject(decodedFileName: string) {
  const text = decodedFileName.toLowerCase();

  if (/رياض|math/.test(text)) return "math";
  if (/علوم|طبيعية|science/.test(text)) return "science";
  if (/عرب|arabic|qq1/.test(text)) return "arabic";
  if (/اسلام|إسلام|التجويد|islam/.test(text)) return "islamic";
  if (/english|انجليزي|إنجليزي|smile|zenda|prisoner/.test(text)) return "english";
  if (/تقنية|تكنولوجيا|اتصالات|إتصالات|الاتصالات/.test(text)) return "technology";
  if (/وطنية|جغراف|تاريخ|social/.test(text)) return "social";
  if (/فنية|art/.test(text)) return "art";

  return "general";
}

function targetFileNameFor(link: Omit<MdlBookLink, "targetFileName">) {
  const subject = classifySubject(link.sourceFileName);
  return `${link.grade}_mdl_${subject}_${link.sourceKey}.pdf`;
}

function parseIntermediateLinks(html: string) {
  const seen = new Set<string>();
  const links: MdlBookLink[] = [];

  for (const section of sections) {
    const htmlSection = extractSection(html, section.startId, section.endId);
    const matches = htmlSection.matchAll(/href=["']([^"']*\/img\/bookpdf\/[^"']+?\.pdf)["']/gi);

    for (const match of matches) {
      const url = new URL(match[1].replaceAll("&amp;", "&"), curriculumUrl).href;
      if (seen.has(`${section.grade}:${url}`)) continue;
      seen.add(`${section.grade}:${url}`);

      const rawFileName = url.slice(url.lastIndexOf("/") + 1);
      const sourceFileName = decodeFileName(rawFileName).normalize("NFKC").trim();
      const baseLink = {
        grade: section.grade,
        url,
        sourceFileName,
        sourceKey: sourceKey(rawFileName)
      };

      links.push({
        ...baseLink,
        targetFileName: targetFileNameFor(baseLink)
      });
    }
  }

  return links;
}

async function listLocalPdfNames(dir: string): Promise<string[]> {
  const names: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      names.push(...(await listLocalPdfNames(fullPath)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
      names.push(entry.name);
    }
  }

  return names;
}

async function downloadPdf(link: MdlBookLink) {
  const response = await fetch(link.url, {
    signal: AbortSignal.timeout(180_000)
  });
  if (!response.ok) {
    throw new Error(`Download failed ${response.status} for ${link.url}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const targetPath = path.join(booksDir, link.targetFileName);
  await fs.writeFile(targetPath, bytes);
  return bytes.length;
}

async function downloadPdfWithRetries(link: MdlBookLink, attempts = 3) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await downloadPdf(link);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        console.log(`Retrying ${link.targetFileName} (${attempt + 1}/${attempts})`);
        await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
      }
    }
  }

  throw lastError;
}

async function main() {
  await fs.mkdir(booksDir, { recursive: true });

  const response = await fetch(curriculumUrl);
  if (!response.ok) {
    throw new Error(`Could not read MDL curriculum page: ${response.status}`);
  }

  const html = await response.text();
  const links = parseIntermediateLinks(html);
  await fs.writeFile(
    manifestPath,
    JSON.stringify(
      {
        source: curriculumUrl,
        generatedAt: new Date().toISOString(),
        books: links
      },
      null,
      2
    )
  );

  const localNames = await listLocalPdfNames(booksDir);
  const missing = links.filter((link) => !localNames.includes(link.targetFileName));

  console.log(
    JSON.stringify(
      {
        officialIntermediateBooks: links.length,
        byGrade: {
          grade1: links.filter((link) => link.grade === "grade1").length,
          grade2: links.filter((link) => link.grade === "grade2").length,
          grade3: links.filter((link) => link.grade === "grade3").length
        },
        alreadyLocal: links.length - missing.length,
        missing: missing.length
      },
      null,
      2
    )
  );

  for (const link of missing) {
    console.log(`Downloading ${link.grade}/${link.targetFileName}`);
    const size = await downloadPdfWithRetries(link);
    console.log(`Downloaded ${link.grade}/${link.targetFileName} (${Math.round(size / 1024)} KB)`);
  }

  if (!missing.length) {
    console.log("No missing MDL intermediate PDFs.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
