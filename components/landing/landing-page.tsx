"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Library,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  UploadCloud
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const features = [
  {
    title: "إجابات من الكتب فقط",
    description:
      "المساعد يبحث داخل الكتب المحددة فقط ويعرض إجابة عربية مبسطة بدون خروج عن محتوى المنهج.",
    icon: MessageSquare
  },
  {
    title: "اختيار أكثر من كتاب",
    description:
      "يمكن للطالب فتح كتاب واحد أو مجموعة كتب، ثم تشغيل RAG على نفس الاختيار مباشرة.",
    icon: Library
  },
  {
    title: "تدريبات جاهزة",
    description:
      "بطاقات مراجعة، MCQ، امتحانات تدريبية، ملخصات، نقاط مهمة، ومذكرات مذاكرة من النصوص المسترجعة.",
    icon: ClipboardCheck
  },
  {
    title: "لوحة تقدم محفوظة",
    description:
      "المحادثات، البطاقات، ونتائج الاختبارات محفوظة لكل طالب داخل حسابه.",
    icon: ShieldCheck
  }
];

const workflow = [
  "اختر الصف الأول أو الثاني أو الثالث المتوسط",
  "حدد كتابا واحدا أو عدة كتب من المكتبة",
  "اسأل المساعد أو أنشئ تدريبات للمراجعة",
  "راجع سجلك ونتائجك في أي وقت"
];

const adminItems = [
  {
    title: "رفع الكتب",
    description: "لوحة الإدارة تدعم رفع كتب PDF ومتابعة حالة المعالجة.",
    icon: UploadCloud
  },
  {
    title: "فهرسة ذكية",
    description: "تنظيف النص، تقسيمه إلى chunks، ثم حفظ embeddings في Supabase Vector.",
    icon: Brain
  },
  {
    title: "إدارة المنهج",
    description: "تعديل عنوان الكتاب والمادة والصف وإعادة المعالجة عند الحاجة.",
    icon: BookOpen
  }
];

export function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <LandingHeader />
      <HeroSection />
      <TrustStrip />
      <FeatureSection />
      <WorkflowSection />
      <AdminSection />
      <LandingFooter />
    </main>
  );
}

function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-xl">
      <div className="sudan-flag-strip" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold sm:text-base">
              منصة السودان التعليمية
            </span>
            <span className="block text-xs text-primary">AI للمرحلة المتوسطة</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <a className="transition hover:text-foreground" href="#features">
            المزايا
          </a>
          <a className="transition hover:text-foreground" href="#workflow">
            طريقة العمل
          </a>
          <a className="transition hover:text-foreground" href="#admin">
            الإدارة
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <ModeToggle />
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="/login">تسجيل الدخول</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard">افتح المنصة</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative isolate min-h-[78svh] overflow-hidden">
      <Image
        src="/images/landing-hero.png"
        alt="مكتب دراسة حديث يعرض كتب المنهج السوداني وجهازا لوحيا للمذاكرة الذكية"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.18),rgba(255,255,255,0.9)_42%,rgba(255,255,255,0.98)_100%)] dark:bg-[linear-gradient(90deg,rgba(6,24,38,0.28),rgba(6,24,38,0.86)_42%,rgba(6,24,38,0.98)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-[78svh] max-w-7xl items-center px-4 py-12 sm:px-6 lg:py-16">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-2xl"
        >
          <div className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
            <Sparkles className="h-4 w-4" />
            مبني على كتب المنهج السوداني الرسمية
          </div>
          <h1 className="text-4xl font-bold leading-[1.18] tracking-normal text-foreground sm:text-5xl lg:text-6xl">
            منصة السودان التعليمية الذكية
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-muted-foreground sm:text-lg">
            مساعد تعلّم عربي لطلاب المرحلة المتوسطة في السودان. اختر الصف والكتب،
            ثم اسأل الذكاء الاصطناعي واحصل على شرح، ملخصات، بطاقات، وأسئلة من
            نفس الكتب المحددة فقط.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 px-6 text-base">
              <Link href="/signup">
                ابدأ كطالب
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 bg-background/80 px-6 text-base backdrop-blur"
            >
              <Link href="/library">استعرض المكتبة</Link>
            </Button>
          </div>

          <dl className="mt-9 grid max-w-xl grid-cols-3 gap-3">
            {[
              ["30", "كتاب رسمي"],
              ["3", "صفوف متوسطة"],
              ["RAG", "من الكتب فقط"]
            ].map(([value, label]) => (
              <div
                key={label}
                className="border-r border-primary/30 pr-4 first:border-r-0 first:pr-0 sm:first:border-r sm:first:pr-4"
              >
                <dt className="text-2xl font-bold text-foreground">{value}</dt>
                <dd className="text-xs font-medium text-muted-foreground sm:text-sm">
                  {label}
                </dd>
              </div>
            ))}
          </dl>
        </motion.div>
      </div>
    </section>
  );
}

function TrustStrip() {
  return (
    <section className="border-y bg-card/80">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 text-sm text-muted-foreground sm:grid-cols-3 sm:px-6">
        {[
          "الصف الأول المتوسط",
          "الصف الثاني المتوسط",
          "الصف الثالث المتوسط"
        ].map((grade) => (
          <div key={grade} className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>{grade}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeatureSection() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
      <SectionHeading
        eyebrow="تجربة مذاكرة كاملة"
        title="كل أدوات المراجعة في مكان واحد"
        description="الواجهة مصممة للقراءة العربية والهواتف أولا، مع مسار واضح من اختيار الكتاب إلى حفظ نتيجة التدريب."
      />

      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {features.map((feature) => (
          <InfoCard key={feature.title} {...feature} />
        ))}
      </div>
    </section>
  );
}

function WorkflowSection() {
  return (
    <section id="workflow" className="bg-card/70 py-16 lg:py-20">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <SectionHeading
          eyebrow="رحلة الطالب"
          title="من الكتاب إلى الإجابة خلال ثوان"
          description="التدفق قصير وواضح: الصف، الكتب، السؤال، ثم المخرجات التعليمية المحفوظة داخل حساب الطالب."
          align="start"
        />

        <div className="grid gap-3">
          {workflow.map((item, index) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: index * 0.06, duration: 0.35 }}
              className="flex items-center gap-4 rounded-md border bg-background p-4 shadow-sm"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary text-sm font-bold text-primary">
                {index + 1}
              </span>
              <p className="font-medium leading-7">{item}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AdminSection() {
  return (
    <section id="admin" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
      <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-start">
        <SectionHeading
          eyebrow="جاهز للإدارة"
          title="إدخال كتب جديدة بدون كسر تجربة الطالب"
          description="لوحة الإدارة تربط رفع PDF، تنظيف النص، إنشاء embeddings، ومراقبة حالة المعالجة في مسار واحد."
          align="start"
        />

        <div className="grid gap-4">
          {adminItems.map((item) => (
            <InfoCard key={item.title} {...item} compact />
          ))}
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t bg-card/80">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>منصة السودان التعليمية الذكية للمرحلة المتوسطة</p>
        <div className="flex items-center gap-4">
          <Link className="hover:text-foreground" href="/login">
            تسجيل الدخول
          </Link>
          <Link className="hover:text-foreground" href="/dashboard">
            لوحة الدراسة
          </Link>
        </div>
      </div>
    </footer>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center"
}: {
  eyebrow: string;
  title: string;
  description: string;
  align?: "center" | "start";
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" ? "mx-auto text-center" : "text-right"
      )}
    >
      <p className="text-sm font-bold text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold leading-tight tracking-normal sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-8 text-muted-foreground">{description}</p>
    </div>
  );
}

function InfoCard({
  title,
  description,
  icon: Icon,
  compact = false
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  compact?: boolean;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.35 }}
      className={cn(
        "rounded-md border bg-card p-5 shadow-soft",
        compact && "flex items-start gap-4"
      )}
    >
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-secondary text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="text-lg font-bold leading-7">{title}</h3>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">{description}</p>
      </div>
    </motion.article>
  );
}
