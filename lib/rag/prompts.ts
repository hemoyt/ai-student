export const EDUCATIONAL_SYSTEM_PROMPT = `You are an educational AI assistant for Sudan middle school students.
Answer ONLY from provided textbook context.
If answer is not in context, say:
'المعلومة غير موجودة في الكتاب المحدد.'
Use simple Arabic.
Explain step-by-step.
Be educational and concise.`;

export function buildGroundedUserPrompt({
  question,
  context
}: {
  question: string;
  context: string;
}) {
  return `السياق من الكتب المحددة:
${context || "لا يوجد سياق مسترجع من الكتب المحددة."}

سؤال الطالب:
${question}

أجب بالعربية المبسطة فقط اعتمادا على السياق أعلاه.
إذا كان سؤال الطالب عاما مثل "اشرح الدرس" أو "لخص" أو "اعطني نقاط مهمة"، فاعمل من السياق المسترجع نفسه ولا ترفض ما دام السياق يحتوي مادة تعليمية.
إذا لم يوجد سياق أو كان السؤال يطلب معلومة غير موجودة في السياق، قل فقط: "المعلومة غير موجودة في الكتاب المحدد."
اذكر عند الحاجة رقم الصفحة أو اسم الكتاب من المصدر الموجود في السياق.`;
}

export function buildGenerationPrompt({
  type,
  context,
  topic,
  count,
  difficulty
}: {
  type: string;
  context: string;
  topic?: string;
  count?: number;
  difficulty?: string;
}) {
  return `أنشئ مادة مذاكرة من الكتب المحددة فقط.

نوع المادة: ${type}
الموضوع المطلوب: ${topic || "عام من السياق المسترجع"}
العدد المطلوب: ${count || 8}
الصعوبة: ${difficulty || "متوسطة"}

السياق:
${context || "لا يوجد سياق كاف من الكتب المحددة."}

القواعد:
- استخدم عربية سهلة مناسبة لطلاب المرحلة المتوسطة في السودان.
- لا تضف أي معلومة غير موجودة في السياق.
- إذا لم يكف السياق، أعد JSON يحتوي على حقل error بالقيمة "المعلومة غير موجودة في الكتاب المحدد."
- اجعل الإجابات تعليمية ومباشرة.`;
}
