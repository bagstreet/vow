// Deterministic output guard applied after every model reply: models drift on style rules, code does not.
export function guardReply(text, { maxSentences = 4, maxChars = 700 } = {}) {
  let t = String(text ?? '').replace(/\r/g, '');
  t = t.replace(/^\s*[-*•]\s+/gm, '').replace(/^\s*\d+[.)]\s+/gm, '').replace(/^#+\s*/gm, '').replace(/[*_`]{1,3}([^*_`]+)[*_`]{1,3}/g, '$1').replace(/^\|.*\|$/gm, '').replace(/\n{2,}/g, ' ').replace(/\n/g, '. ').replace(/\.\s*\./g, '.').replace(/:\s*\./g, ':').replace(/\s{2,}/g, ' ').trim();
  const parts = t.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (parts && parts.length > maxSentences) t = parts.slice(0, maxSentences).join('').trim();
  if (t.length > maxChars) { const cut = t.slice(0, maxChars); t = cut.slice(0, Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! ')) + 1 || maxChars).trim(); }
  return t;
}
