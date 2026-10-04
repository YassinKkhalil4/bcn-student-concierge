// Runs inside the page. Finds the translatable "units" of a rendered guide page:
// an element whose children are all inline (so its innerHTML is one sentence with
// formatting), or a bare text node. mode "extract" returns them; mode "apply"
// replaces each with dict[key] (and returns the keys it could not find).
(function (mode, dict) {
  const INLINE = new Set(['b', 'strong', 'i', 'em', 'span', 'small', 'code', 'br', 'a', 'mark', 'u', 's']);
  const norm = (h) => h.replace(/\s+/g, ' ').trim();
  const hasLetters = (t) => /\p{L}{2,}/u.test(t.replace(/<[^>]+>/g, ''));
  const isInlineEl = (el) => INLINE.has(el.tagName.toLowerCase()) && getComputedStyle(el).display.startsWith('inline');
  const units = [];
  const missing = [];
  function visit(el) {
    if (['SVG', 'STYLE', 'SCRIPT'].includes(el.tagName.toUpperCase())) return;
    if (el.closest('svg')) return;
    const kids = [...el.childNodes];
    const els = kids.filter((n) => n.nodeType === 1);
    const hasText = kids.some((n) => n.nodeType === 3 && n.nodeValue.trim());
    const allInline = els.every(isInlineEl);
    if (hasText && allInline) return unit(el);
    if (!hasText && allInline && els.length && !el.children.length) return;
    for (const n of kids) {
      if (n.nodeType === 1) visit(n);
      else if (n.nodeType === 3 && n.nodeValue.trim()) {
        const key = norm(n.nodeValue);
        if (!hasLetters(key)) continue;
        if (mode === 'extract') units.push(key);
        else if (dict[key] !== undefined) n.nodeValue = n.nodeValue.replace(n.nodeValue.trim(), dict[key]);
        else missing.push(key);
      }
    }
  }
  function unit(el) {
    const key = norm(el.innerHTML);
    if (!hasLetters(key)) return;
    if (mode === 'extract') units.push(key);
    else if (dict[key] !== undefined) el.innerHTML = dict[key];
    else missing.push(key);
  }
  document.querySelectorAll('.page').forEach((pg) => visit(pg));
  return mode === 'extract' ? units : missing;
});
