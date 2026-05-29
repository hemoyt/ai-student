from __future__ import annotations

import math
from pathlib import Path

from PIL import Image
from pdf2image import convert_from_path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    Image as RLImage,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "deliverables"
ASSETS = OUT / "assets"
SYSTEM_PDF = OUT / "sudan_ai_system_design_document.pdf"
DECK_PDF = OUT / "sudan_ai_product_deck.pdf"

BRAND = "IBRAHEM AHMED HASSAN"
WEBSITE = "ibrahemahmed.com"
EMAIL = "hello@brahemahmed.com"
LINKEDIN = "https://www.linkedin.com/in/ibrahem-ahmed-hassan/"
DATE = "May 30, 2026"

INK = colors.HexColor("#082231")
MUTED = colors.HexColor("#596870")
TEAL = colors.HexColor("#007E6D")
GREEN = colors.HexColor("#0F8953")
BLUE = colors.HexColor("#144E7C")
LIGHT = colors.HexColor("#F2F7F6")
LIGHT_BLUE = colors.HexColor("#EAF2F7")
LIGHT_GREEN = colors.HexColor("#EAF7F1")
BORDER = colors.HexColor("#D8E2E1")
RED = colors.HexColor("#D71920")
BLACK = colors.HexColor("#111111")


def register_fonts() -> tuple[str, str]:
    regular = Path("C:/Windows/Fonts/arial.ttf")
    bold = Path("C:/Windows/Fonts/arialbd.ttf")
    if regular.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont("AppFont", str(regular)))
        pdfmetrics.registerFont(TTFont("AppFont-Bold", str(bold)))
        return "AppFont", "AppFont-Bold"
    return "Helvetica", "Helvetica-Bold"


FONT, FONT_BOLD = register_fonts()


def styles():
    base = getSampleStyleSheet()
    return {
        "Title": ParagraphStyle(
            "Title",
            parent=base["Title"],
            fontName=FONT_BOLD,
            fontSize=27,
            leading=32,
            textColor=INK,
            spaceAfter=8,
            alignment=TA_LEFT,
        ),
        "Subtitle": ParagraphStyle(
            "Subtitle",
            parent=base["BodyText"],
            fontName=FONT,
            fontSize=13,
            leading=18,
            textColor=MUTED,
            spaceAfter=14,
        ),
        "Kicker": ParagraphStyle(
            "Kicker",
            parent=base["BodyText"],
            fontName=FONT_BOLD,
            fontSize=9.5,
            leading=12,
            textColor=TEAL,
            spaceAfter=6,
        ),
        "H1": ParagraphStyle(
            "H1",
            parent=base["Heading1"],
            fontName=FONT_BOLD,
            fontSize=16,
            leading=20,
            textColor=TEAL,
            spaceBefore=14,
            spaceAfter=7,
        ),
        "H2": ParagraphStyle(
            "H2",
            parent=base["Heading2"],
            fontName=FONT_BOLD,
            fontSize=12.5,
            leading=16,
            textColor=BLUE,
            spaceBefore=9,
            spaceAfter=5,
        ),
        "Body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName=FONT,
            fontSize=10.2,
            leading=13.6,
            textColor=INK,
            spaceAfter=6,
        ),
        "Small": ParagraphStyle(
            "Small",
            parent=base["BodyText"],
            fontName=FONT,
            fontSize=8.6,
            leading=11,
            textColor=MUTED,
            spaceAfter=3,
        ),
        "Table": ParagraphStyle(
            "Table",
            parent=base["BodyText"],
            fontName=FONT,
            fontSize=8.2,
            leading=10.2,
            textColor=INK,
        ),
        "TableHeader": ParagraphStyle(
            "TableHeader",
            parent=base["BodyText"],
            fontName=FONT_BOLD,
            fontSize=8.4,
            leading=10.5,
            textColor=INK,
        ),
    }


S = styles()


def p(text: str, style: str = "Body") -> Paragraph:
    return Paragraph(text.replace("&", "&amp;"), S[style])


def bullets(items: list[str]) -> ListFlowable:
    return ListFlowable(
        [ListItem(p(item, "Body"), leftIndent=12) for item in items],
        bulletType="bullet",
        start="circle",
        leftIndent=18,
        bulletFontName=FONT,
        bulletFontSize=7,
        bulletColor=TEAL,
    )


def clean_table_data(data: list[list[str]], header=True):
    out = []
    for ridx, row in enumerate(data):
        style = "TableHeader" if header and ridx == 0 else "Table"
        out.append([p(str(cell), style) for cell in row])
    return out


def table(data: list[list[str]], col_widths: list[float], header=True) -> Table:
    t = Table(clean_table_data(data, header), colWidths=col_widths, hAlign="LEFT", repeatRows=1 if header else 0)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), LIGHT_BLUE if header else colors.white),
                ("GRID", (0, 0), (-1, -1), 0.55, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return t


def page_footer(c: canvas.Canvas, doc, title="Sudan AI Learning Platform"):
    c.saveState()
    w, h = letter
    # Sudan-inspired strip.
    c.setFillColor(RED)
    c.rect(0.72 * inch, h - 0.37 * inch, 2.1 * inch, 0.035 * inch, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.rect(2.82 * inch, h - 0.37 * inch, 2.1 * inch, 0.035 * inch, stroke=0, fill=1)
    c.setFillColor(GREEN)
    c.rect(4.92 * inch, h - 0.37 * inch, 2.1 * inch, 0.035 * inch, stroke=0, fill=1)
    c.setFillColor(BLACK)
    c.rect(7.02 * inch, h - 0.37 * inch, 0.78 * inch, 0.035 * inch, stroke=0, fill=1)
    c.setFont(FONT, 8)
    c.setFillColor(MUTED)
    c.drawString(0.72 * inch, 0.42 * inch, f"Made by {BRAND} | {WEBSITE} | {EMAIL}")
    c.drawRightString(7.78 * inch, 0.42 * inch, f"{title} | Page {doc.page}")
    c.restoreState()


def build_system_pdf() -> None:
    doc = SimpleDocTemplate(
        str(SYSTEM_PDF),
        pagesize=letter,
        rightMargin=0.72 * inch,
        leftMargin=0.72 * inch,
        topMargin=0.72 * inch,
        bottomMargin=0.68 * inch,
        title="Sudan AI Learning Platform - System Design Document",
        author=BRAND,
    )

    story = []
    story.append(p("SYSTEM DESIGN DOCUMENT", "Kicker"))
    story.append(p("Sudan Middle School AI Learning Platform", "Title"))
    story.append(
        p(
            "Production architecture, RAG pipeline, data management, scale plan, and future product roadmap.",
            "Subtitle",
        )
    )
    story.append(Spacer(1, 8))
    meta = [
        ["Prepared by", BRAND],
        ["Website", WEBSITE],
        ["Email", EMAIL],
        ["LinkedIn", LINKEDIN],
        ["Date", DATE],
    ]
    story.append(table(meta, [1.35 * inch, 5.65 * inch], header=False))
    story.append(Spacer(1, 14))
    story.append(
        p(
            "Purpose: document the current production-ready AI education platform and the practical path to expand it across more subjects, classes, stages, and school deployments."
        )
    )
    story.append(PageBreak())

    story.append(p("1. Executive Summary", "H1"))
    story.append(
        p(
            "The platform is an Arabic-first AI learning product for Sudan middle school students. Students select a grade and one or more textbooks, then ask questions or generate study material grounded only in those selected books."
        )
    )
    story.append(
        bullets(
            [
                "Current verified corpus: 46 total books in the database, including 30 official MDL intermediate books.",
                "Official distribution: grade1 has 9 books, grade2 has 13 books, and grade3 has 8 books.",
                "Vector corpus: 6,292 total chunks, including 4,780 official-curriculum chunks.",
                "Core AI boundary: retrieval is filtered by selected_book_ids before the model receives any context.",
            ]
        )
    )

    story.append(p("2. Product Scope", "H1"))
    story.append(
        table(
            [
                ["Area", "Implemented Capability", "Product Value"],
                ["Auth", "Supabase email/password auth with protected student/admin routes.", "Saved chats, flashcards, quizzes, and profile data stay private per user."],
                ["Library", "Grade filters, book search, PDF links, and multi-book selection.", "Students study by class and subject without a complex LMS."],
                ["AI Chat", "Streaming RAG chat over selected books only.", "Simple Arabic explanations with reduced hallucination risk."],
                ["Study Tools", "Flashcards, MCQ, exams, summaries, key points, notes, and Q/A drills.", "Turns textbooks into active-recall practice."],
                ["Dashboard", "Progress, flashcards, quiz scores, and previous chats.", "Makes study history useful beyond one session."],
                ["Admin", "Upload books, reprocess embeddings, inspect jobs, manage users and roles.", "Supports ongoing curriculum operations."],
            ],
            [0.9 * inch, 3.1 * inch, 3.0 * inch],
        )
    )

    story.append(p("3. High-Level Architecture", "H1"))
    story.append(
        p(
            "The architecture keeps the user experience in Next.js while Supabase owns authentication, database, vector retrieval, and storage. AI providers are isolated behind reusable services."
        )
    )
    story.append(RLImage(str(ASSETS / "architecture.png"), width=6.9 * inch, height=4.03 * inch))

    story.append(PageBreak())
    story.append(p("4. Runtime Components", "H1"))
    story.append(
        table(
            [
                ["Component", "Technology", "Responsibility"],
                ["Frontend", "Next.js 15, TypeScript, TailwindCSS, shadcn-style UI, Framer Motion", "Arabic RTL app shell, landing page, library, study workspace, dashboard, history, and admin."],
                ["API routes", "Next.js route handlers", "Books, RAG chat, study generation, chat history, quiz score, admin upload/reprocess/users."],
                ["Auth", "Supabase Auth plus middleware", "Protects dashboard, library, study, history, flashcards, and admin routes."],
                ["Database", "Supabase PostgreSQL", "Stores books, documents, profiles, chats, flashcards, quizzes, bookmarks, progress, and ingestion jobs."],
                ["Vector DB", "Supabase pgvector", "Stores 768-dimensional embeddings and supports HNSW vector search."],
                ["AI", "OpenRouter chat abstraction", "Allows switching among DeepSeek, Claude, GPT, Gemini, Qwen, and other supported chat models."],
                ["Embeddings", "OpenRouter Gemini Embedding 2 Preview with Gemini/Jina fallback paths", "Embeds document chunks and query text for retrieval."],
                ["Storage", "Supabase Storage bucket books", "Stores validated PDF textbooks and public PDF URLs."],
            ],
            [1.0 * inch, 2.6 * inch, 3.4 * inch],
        )
    )

    story.append(PageBreak())
    story.append(p("5. RAG Pipeline", "H1"))
    story.append(RLImage(str(ASSETS / "rag_pipeline.png"), width=6.9 * inch, height=3.45 * inch))
    story.append(
        bullets(
            [
                "Ingestion scans PDFs, detects title/grade/subject where possible, uploads the PDF, extracts pages, cleans text, and chunks with size 1200 and overlap 200.",
                "Embedding is batched and stored in documents.embedding as vector(768), with metadata for book, subject, grade, page, source file, and official status.",
                "At query time the API embeds the student question, calls match_documents with selected_book_ids, builds a cited context block, and sends only that context to OpenRouter.",
                "The system prompt instructs the assistant to answer only from context and refuse missing information.",
            ]
        )
    )

    story.append(PageBreak())
    story.append(p("6. Database and Data Ownership", "H1"))
    story.append(
        table(
            [
                ["Table", "Owner", "Purpose"],
                ["classes, subjects", "Admin/public read", "Curriculum taxonomy and grade navigation."],
                ["books, chapters", "Admin writes, students read", "Book catalog, subject, grade, cover/PDF metadata."],
                ["documents", "Admin/service writes", "Chunk text, vector embedding, page number, metadata, search vector."],
                ["profiles", "User/admin", "Student name, grade, and admin role."],
                ["chat_sessions, chat_messages", "User", "Saved per-user chat history with selected book IDs and citations."],
                ["flashcards", "User", "Saved active-recall cards generated from selected books."],
                ["quizzes, quiz_questions", "User", "MCQ/exam records, score, explanations, difficulty."],
                ["bookmarks, study_progress", "User", "Lesson notes, progress, completed lessons."],
                ["ingestion_jobs", "Admin", "Operational status for uploads and reprocessing."],
            ],
            [2.0 * inch, 1.45 * inch, 3.55 * inch],
        )
    )

    story.append(p("7. Security and Authorization", "H1"))
    story.append(
        bullets(
            [
                "Supabase Row Level Security is enabled across application tables.",
                "Students manage only their own flashcards, quizzes, progress, bookmarks, chat sessions, and chat messages.",
                "Admin endpoints use route-level admin guards and service-role operations only where required.",
                "The public books API exposes official books, while scope=all is admin-only.",
                "AI requests are rate limited per user to control abuse and cost.",
                "Uploads validate MIME type, file size, and PDF requirement before storage or processing.",
                "Secrets stay in environment variables: Supabase service key, OpenRouter API key, embedding keys, and admin emails.",
            ]
        )
    )

    story.append(PageBreak())
    story.append(p("8. Data Management Model", "H1"))
    story.append(
        p(
            "Textbooks should be managed as versioned curriculum assets. Every PDF should carry structured metadata, stable naming, ingest status, and retrievable text quality signals."
        )
    )
    story.append(
        table(
            [
                ["Concern", "Recommended Practice", "Reason"],
                ["Book identity", "Use grade, subject, normalized title, source URL, curriculum year/version.", "Prevents duplicates as more stages are added."],
                ["Text quality", "Store extraction method, OCR status, page count, chunk count, failed pages.", "Makes scanned/image PDFs visible to admins."],
                ["Reprocessing", "Keep ingestion_jobs and allow forced reprocess by book/version.", "Admins can improve OCR, embeddings, or chunking without losing the catalog."],
                ["Metadata", "Standardize subject slugs and grade/stage IDs.", "Supports all classes and subjects later without UI rewrites."],
                ["Backups", "Export Supabase schema, storage manifest, and ingestion logs regularly.", "Protects curriculum data and supports migration."],
            ],
            [1.3 * inch, 3.0 * inch, 2.7 * inch],
        )
    )

    story.append(PageBreak())
    story.append(p("9. Scaling Plan", "H1"))
    story.append(
        table(
            [
                ["Layer", "Next Step", "Scale Benefit"],
                ["Curriculum", "Generalize classes into stages, grades, subjects, terms, and curriculum versions.", "Allows primary, secondary, and future curricula without special-case UI."],
                ["Ingestion", "Move PDF processing to background workers with queue retries.", "Keeps admin uploads responsive and avoids serverless timeouts."],
                ["OCR", "Add Arabic OCR using Tesseract, PaddleOCR, Google Document AI, or Azure Document Intelligence.", "Unlocks image-only books that currently have no retrievable text chunks."],
                ["Retrieval", "Partition or filter indexes by grade/subject/book and tune HNSW parameters.", "Maintains low-latency search as vectors grow from thousands to millions."],
                ["Caching", "Cache embeddings for repeated queries and common generation outputs.", "Reduces AI spend and improves perceived speed."],
                ["Observability", "Log retrieval score, model, latency, token cost, and refusal rate.", "Supports quality tuning and cost control."],
                ["Product", "Add teacher analytics, premium exports, PWA/offline reading, and school accounts.", "Creates stronger retention and monetization paths."],
            ],
            [1.15 * inch, 3.35 * inch, 2.5 * inch],
        )
    )

    story.append(p("10. Future Roadmap", "H1"))
    story.append(p("Add other subjects and classes", "H2"))
    story.append(
        bullets(
            [
                "Expand from grade1/grade2/grade3 to stage -> grade -> term -> subject -> book.",
                "Add all remaining subjects for each class, then add primary and secondary school stages using the same ingestion pipeline.",
                "Build an admin mapping screen for subject aliases, source URLs, and version labels.",
                "Add curriculum completeness dashboards: expected books vs uploaded books vs chunked books vs OCR-needed books.",
            ]
        )
    )
    story.append(p("Product enhancements", "H2"))
    story.append(
        bullets(
            [
                "Teacher mode: assign exams, view class results, and publish recommended study sets.",
                "Premium mode: advanced exam builder, printable study packs, PDF exports, analytics, and priority AI quota.",
                "Mobile PWA: offline saved flashcards, recent chats, and low-bandwidth mode.",
                "Quality controls: answer citations, source-page viewer, feedback, and admin review of weak answers.",
            ]
        )
    )
    story.append(p("Engineering enhancements", "H2"))
    story.append(
        bullets(
            [
                "Add background orchestration for ingestion, OCR, embedding, and reprocessing.",
                "Create automated E2E tests for signup, library selection, RAG chat, flashcards, MCQ scoring, history, and admin upload.",
                "Add model routing so easy questions use cheaper models and exam generation can use stronger models.",
                "Add analytics events for book opens, chat success, generation type, quiz completion, and retention.",
            ]
        )
    )

    story.append(PageBreak())
    story.append(p("11. Deployment and Operations", "H1"))
    story.append(
        bullets(
            [
                "Frontend and API: deploy Next.js to Vercel with environment variables for Supabase and OpenRouter.",
                "Backend services: Supabase hosts Auth, PostgreSQL, pgvector, Storage, RLS, and SQL RPC functions.",
                "Operational commands: npm run build, npm run lint, npm run typecheck, npm run sync:mdl, npm run ingest:mdl, npm run ingest:books.",
                "Runbooks should include key rotation, failed ingestion recovery, OCR reprocessing, and monthly cost review.",
            ]
        )
    )
    story.append(p("12. Key Risks and Mitigations", "H1"))
    story.append(
        table(
            [
                ["Risk", "Impact", "Mitigation"],
                ["Scanned PDFs with no extractable text", "AI cannot answer from those books.", "Add OCR and mark OCR-needed books in admin."],
                ["Large vector growth", "Retrieval latency and storage cost increase.", "Use metadata filters, index tuning, partitioning, and archival policy."],
                ["Model hallucination", "Student trust and academic accuracy risk.", "Keep selected-book filtering, refusal prompt, citations, and answer feedback loop."],
                ["API key leakage", "Cost and security exposure.", "Keep keys server-side, rotate regularly, never expose service role to the client."],
                ["Curriculum changes", "Old answers may mismatch new editions.", "Version books and associate chunks with source/year/version metadata."],
            ],
            [2.25 * inch, 2.15 * inch, 2.6 * inch],
        )
    )

    doc.build(story, onFirstPage=page_footer, onLaterPages=page_footer)


def draw_flag_strip(c: canvas.Canvas, w: float, h: float) -> None:
    y = h - 7
    c.setFillColor(RED)
    c.rect(0, y, w * 0.34, 7, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.rect(w * 0.34, y, w * 0.28, 7, stroke=0, fill=1)
    c.setFillColor(GREEN)
    c.rect(w * 0.62, y, w * 0.28, 7, stroke=0, fill=1)
    c.setFillColor(BLACK)
    c.rect(w * 0.90, y, w * 0.10, 7, stroke=0, fill=1)


def wrap_lines(c: canvas.Canvas, text: str, font: str, size: float, max_width: float) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if c.stringWidth(candidate, font, size) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_wrapped(c: canvas.Canvas, text: str, x: float, y: float, max_width: float, font=FONT, size=12, leading=15, color=INK) -> float:
    c.setFont(font, size)
    c.setFillColor(color)
    for line in wrap_lines(c, text, font, size, max_width):
        c.drawString(x, y, line)
        y -= leading
    return y


def slide_footer(c: canvas.Canvas, w: float, num: int):
    c.setFont(FONT, 8.5)
    c.setFillColor(MUTED)
    c.drawRightString(w - 34, 20, f"{num:02d} | Made by {BRAND} | {WEBSITE}")


def slide_title(c: canvas.Canvas, kicker: str, title: str, subtitle: str | None = None):
    c.setFont(FONT_BOLD, 10.5)
    c.setFillColor(TEAL)
    c.drawString(42, 558, kicker.upper())
    c.setFont(FONT_BOLD, 25.5)
    c.setFillColor(INK)
    c.drawString(42, 524, title)
    if subtitle:
        draw_wrapped(c, subtitle, 42, 495, 680, FONT, 12.5, 16, MUTED)


def draw_card(c: canvas.Canvas, x: float, y: float, w: float, h: float, title: str, body: str, fill=LIGHT):
    c.setStrokeColor(BORDER)
    c.setFillColor(fill)
    c.roundRect(x, y, w, h, 8, stroke=1, fill=1)
    c.setFillColor(TEAL)
    c.setFont(FONT_BOLD, 13)
    c.drawString(x + 14, y + h - 24, title)
    draw_wrapped(c, body, x + 14, y + h - 47, w - 28, FONT, 10.2, 13, INK)


def draw_card_grid(c: canvas.Canvas, cards: list[tuple[str, str]], cols: int, top: float, card_h: float):
    gap = 12
    x0 = 42
    max_w = 708
    card_w = (max_w - gap * (cols - 1)) / cols
    for idx, (title, body) in enumerate(cards):
        row = idx // cols
        col = idx % cols
        x = x0 + col * (card_w + gap)
        y = top - row * (card_h + gap) - card_h
        draw_card(c, x, y, card_w, card_h, title, body, LIGHT_GREEN if idx % 2 == 0 else LIGHT_BLUE)


def draw_table(c: canvas.Canvas, data: list[list[str]], x: float, y: float, widths: list[float], row_h: float = 42):
    for r, row in enumerate(data):
        cy = y - r * row_h
        for col, text in enumerate(row):
            cx = x + sum(widths[:col])
            c.setFillColor(LIGHT_BLUE if r == 0 else colors.white)
            c.setStrokeColor(BORDER)
            c.rect(cx, cy - row_h, widths[col], row_h, stroke=1, fill=1)
            font = FONT_BOLD if r == 0 else FONT
            size = 9.2 if r == 0 else 8.6
            draw_wrapped(c, text, cx + 7, cy - 15, widths[col] - 14, font, size, 10.5, INK)


def build_deck_pdf() -> None:
    w, h = landscape(letter)
    c = canvas.Canvas(str(DECK_PDF), pagesize=landscape(letter))

    # 1
    draw_flag_strip(c, w, h)
    hero = ROOT / "public" / "images" / "landing-hero.png"
    if hero.exists():
        c.drawImage(str(hero), 425, 92, width=320, height=275, preserveAspectRatio=True, mask="auto")
    c.setFont(FONT_BOLD, 10.5)
    c.setFillColor(TEAL)
    c.drawString(42, 545, "PRODUCT DECK")
    c.setFont(FONT_BOLD, 31)
    c.setFillColor(INK)
    c.drawString(42, 500, "Sudan Middle School")
    c.drawString(42, 463, "AI Learning Platform")
    draw_wrapped(c, "A grounded Arabic AI study assistant built from Sudanese curriculum books.", 42, 420, 340, FONT, 14, 18, MUTED)
    y = 330
    for line in [f"Made by {BRAND}", WEBSITE, EMAIL, LINKEDIN]:
        c.setFont(FONT_BOLD if line.startswith("Made") else FONT, 11)
        c.setFillColor(INK if line.startswith("Made") else MUTED)
        c.drawString(42, y, line)
        y -= 19
    slide_footer(c, w, 1)
    c.showPage()

    slides = [
        ("Problem", "Students need trusted help from the actual textbook", None, [
            ("Fragmented materials", "Students move between PDFs, notes, search results, and informal explanations."),
            ("Hallucination risk", "Generic AI can answer outside the Sudan curriculum and confuse students."),
            ("Low active recall", "Students need flashcards, MCQs, and exams, not only passive summaries."),
            ("Admin overhead", "Schools and operators need a repeatable way to add books and keep data clean."),
        ], 4),
        ("Solution", "A ChatPDF plus Quizlet experience for Sudan middle school", None, [
            ("Choose class", "First, second, or third intermediate grade."),
            ("Pick books", "Select one book or multiple books at the same time."),
            ("Ask AI", "The assistant answers only from selected textbook chunks."),
            ("Generate study tools", "Flashcards, MCQ, exams, summaries, key points, notes, and drills."),
            ("Save progress", "Previous chats, cards, quizzes, scores, and bookmarks stay attached to the user."),
            ("Admin controls", "Upload, rename, reprocess, and inspect ingestion status."),
        ], 3),
    ]
    num = 2
    for kicker, title, subtitle, cards, cols in slides:
        draw_flag_strip(c, w, h)
        slide_title(c, kicker, title, subtitle)
        draw_card_grid(c, cards, cols, top=440, card_h=118)
        slide_footer(c, w, num)
        c.showPage()
        num += 1

    draw_flag_strip(c, w, h)
    slide_title(c, "Current Build", "Production-ready architecture already implemented")
    draw_table(
        c,
        [
            ["Metric", "Current State"],
            ["Official books", "30 MDL intermediate books"],
            ["Grade distribution", "grade1: 9, grade2: 13, grade3: 8"],
            ["Vector corpus", "6,292 total chunks, 4,780 official-curriculum chunks"],
            ["Core routes", "dashboard, library, study, history, admin, flashcards export, landing page"],
            ["AI providers", "OpenRouter chat, OpenRouter Gemini Embedding 2 Preview, Gemini/Jina fallback paths"],
        ],
        42,
        450,
        [205, 500],
        row_h=53,
    )
    slide_footer(c, w, 4)
    c.showPage()

    draw_flag_strip(c, w, h)
    slide_title(c, "How RAG Works", "Selected-book filtering is the product moat")
    c.drawImage(str(ASSETS / "rag_pipeline.png"), 48, 102, width=690, height=345, preserveAspectRatio=True, mask="auto")
    slide_footer(c, w, 5)
    c.showPage()

    draw_flag_strip(c, w, h)
    slide_title(c, "Student Experience", "Simple Arabic workflows for daily study")
    draw_card_grid(
        c,
        [
            ("Explain lessons", "Ask for step-by-step Arabic explanation from the selected book."),
            ("Summarize chapters", "Turn long textbook sections into concise study summaries."),
            ("Practice recall", "Generate flashcards and Q/A drills for quick revision."),
            ("Test readiness", "Create MCQs and timed practice exams with scoring and explanations."),
        ],
        4,
        top=440,
        card_h=135,
    )
    slide_footer(c, w, 6)
    c.showPage()

    draw_flag_strip(c, w, h)
    slide_title(c, "Admin and Data Operations", "A repeatable path to manage curriculum data")
    draw_card_grid(
        c,
        [
            ("Upload PDFs", "Validate PDF type and size, store in Supabase Storage."),
            ("Metadata control", "Edit book title, grade, subject, source file, and official scope."),
            ("Reprocess embeddings", "Regenerate chunks and vectors when extraction, OCR, or metadata improves."),
            ("Ingestion status", "Track queued, running, completed, and failed jobs for operations."),
            ("Data quality", "Monitor chunk count, OCR-needed PDFs, failed pages, and duplicate titles."),
            ("Role management", "Use admin-only routes and RLS to separate operators from students."),
        ],
        3,
        top=440,
        card_h=116,
    )
    slide_footer(c, w, 7)
    c.showPage()

    draw_flag_strip(c, w, h)
    slide_title(c, "Expansion Plan", "Add every subject, every class, and later every stage")
    draw_card_grid(
        c,
        [
            ("Taxonomy upgrade", "Move from grade IDs to stage -> grade -> term -> subject -> book version."),
            ("Curriculum completeness", "Show expected vs uploaded vs processed vs OCR-needed books."),
            ("OCR layer", "Add Arabic OCR for scanned PDFs so image-only books become searchable."),
            ("Teacher mode", "Assignments, class analytics, recommended cards, and exam publishing."),
            ("Premium exports", "Printable PDF study packs, advanced exams, and priority AI quota."),
            ("PWA/mobile", "Low-bandwidth mobile study, offline flashcards, and saved recent chats."),
        ],
        3,
        top=440,
        card_h=116,
    )
    slide_footer(c, w, 8)
    c.showPage()

    draw_flag_strip(c, w, h)
    slide_title(c, "Scaling Strategy", "From one curriculum stage to a national learning graph")
    draw_table(
        c,
        [
            ["Scale Area", "Plan"],
            ["Vectors", "Use metadata filters, HNSW tuning, and partitioning by stage/grade/subject as corpus grows."],
            ["Ingestion", "Move heavy PDF, OCR, and embedding work to background queues with retry and audit logs."],
            ["AI cost", "Cache repeated embeddings, route easy tasks to cheaper models, and track token spend per feature."],
            ["Quality", "Store answer feedback, retrieval scores, refusal rates, and reviewed weak-answer examples."],
            ["Data governance", "Version every curriculum edition and keep source URL, file hash, OCR status, and chunk count."],
        ],
        42,
        450,
        [190, 515],
        row_h=58,
    )
    slide_footer(c, w, 9)
    c.showPage()

    draw_flag_strip(c, w, h)
    slide_title(c, "Next 90 Days", "Turn the platform into a stronger education product")
    draw_card_grid(
        c,
        [
            ("1. Complete OCR", "Process scanned/image PDFs and expose OCR status in admin."),
            ("2. Expand curriculum", "Add all remaining subjects and prepare primary/secondary stage taxonomy."),
            ("3. Improve learning loops", "Teacher mode, assignments, analytics, and personalized revision."),
            ("4. Monetize carefully", "Premium study packs, advanced exams, school accounts, and priority AI usage."),
        ],
        4,
        top=440,
        card_h=135,
    )
    c.setFont(FONT_BOLD, 12)
    c.setFillColor(TEAL)
    c.drawString(42, 108, f"Contact: {BRAND} | {WEBSITE} | {EMAIL}")
    c.setFont(FONT, 10.5)
    c.setFillColor(MUTED)
    c.drawString(42, 88, LINKEDIN)
    slide_footer(c, w, 10)
    c.save()


def render_pdf(pdf: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    pages = convert_from_path(str(pdf), dpi=120)
    thumbs = []
    for i, page in enumerate(pages, start=1):
        path = out_dir / f"page-{i}.png"
        page.save(path)
        thumb = page.copy()
        thumb.thumbnail((420, 560))
        thumbs.append((i, thumb))
    if thumbs:
        cols = 2 if len(thumbs) <= 8 else 3
        rows = math.ceil(len(thumbs) / cols)
        cell_w, cell_h = 460, 610
        sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), "white")
        for idx, (num, thumb) in enumerate(thumbs):
            x = (idx % cols) * cell_w + 20
            y = (idx // cols) * cell_h + 34
            sheet.paste(thumb, (x, y))
        sheet.save(out_dir / "contact-sheet.png")


def main() -> None:
    OUT.mkdir(exist_ok=True)
    build_system_pdf()
    build_deck_pdf()
    render_pdf(SYSTEM_PDF, OUT / "qa_system_pdf")
    render_pdf(DECK_PDF, OUT / "qa_deck_pdf")
    print(SYSTEM_PDF)
    print(DECK_PDF)


if __name__ == "__main__":
    main()
