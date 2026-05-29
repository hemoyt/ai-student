const arabicDiacritics = /[\u064B-\u065F\u0670]/g;

export function normalizeArabicText(text: string) {
  return text
    .replace(arabicDiacritics, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\u0640/g, "")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

export function cleanPdfText(text: string) {
  return text
    .normalize("NFKC")
    .replace(/\u0000/g, "")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{4,}/g, "\n\n")
    .replace(/([^\S\r\n]){2,}/g, " ")
    .replace(/صفحة\s*\d+\s*من\s*\d+/gi, "")
    .trim();
}

export function compactForSearch(text: string) {
  return normalizeArabicText(cleanPdfText(text)).toLowerCase();
}
