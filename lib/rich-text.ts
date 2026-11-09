// Mô tả sản phẩm dạng định dạng (HTML rút gọn). Không dùng thư viện ngoài:
// dựng lại HTML từ đầu theo danh sách thẻ cho phép, mọi thứ khác bị bỏ → an toàn khi hiển thị cho khách.

const ALLOWED = new Set(["p", "br", "h3", "h4", "ul", "ol", "li", "b", "strong", "i", "em", "u", "a", "span"]);
const RENAME: Record<string, string> = { div: "p", h1: "h3", h2: "h3", h5: "h4", h6: "h4", font: "span" };
const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "template", "svg", "math", "noscript", "title", "head"]);

const escapeText = (s: string) => s.replace(/&(?!(?:[a-z]+|#\d+|#x[0-9a-f]+);)/gi, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const attr = (raw: string, name: string) => {
  const m = raw.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[2] ?? m[3] ?? m[4] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim() : "";
};
const safeColor = (c: string) => {
  const m = c.trim().match(/^(#[0-9a-f]{3,8}|[a-z]{3,20}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/i);
  return m ? m[1] : "";
};
const safeHref = (h: string) => (/^(https?:\/\/|tel:|mailto:)/i.test(h) && !/[\s"<>]/.test(h) ? h : "");

export function sanitizeHtml(input: string, maxLen = 20000): string {
  const src = String(input ?? "").slice(0, maxLen * 2).replace(/<!--[\s\S]*?-->/g, "");
  let out = "";
  const stack: string[] = [];
  let dropDepth = 0;
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|([^<]+)|</g;
  for (let m; (m = re.exec(src)); ) {
    if (m[3] !== undefined || m[0] === "<") {
      if (!dropDepth) out += escapeText(m[3] ?? "&lt;");
      continue;
    }
    const closing = m[0].startsWith("</");
    let tag = m[1].toLowerCase();
    if (DROP_WITH_CONTENT.has(tag)) {
      dropDepth = Math.max(0, dropDepth + (closing ? -1 : 1));
      continue;
    }
    if (dropDepth) continue;
    const raw = m[2] ?? "";
    tag = RENAME[tag] ?? tag;
    if (!ALLOWED.has(tag)) continue;
    if (tag === "br") { out += "<br>"; continue; }
    if (closing) {
      const at = stack.lastIndexOf(tag);
      if (at < 0) continue;
      while (stack.length > at) out += `</${stack.pop()}>`;
      continue;
    }
    let attrs = "";
    if (tag === "a") {
      const href = safeHref(attr(raw, "href"));
      if (!href) continue;
      attrs = ` href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer nofollow"`;
    } else if (tag === "span") {
      const color = safeColor(attr(raw, "color") || (attr(raw, "style").match(/(?:^|;)\s*color\s*:\s*([^;]+)/i)?.[1] ?? ""));
      if (!color) continue;
      attrs = ` style="color:${escapeAttr(color)}"`;
    }
    stack.push(tag);
    out += `<${tag}${attrs}>`;
  }
  while (stack.length) out += `</${stack.pop()}>`;
  return out.replace(/<p>(\s|<br>)*<\/p>/g, "").trim().slice(0, maxLen);
}

// Chữ thường (Excel): mỗi dòng → một đoạn
export const textToHtml = (text: string) =>
  String(text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => `<p>${escapeText(l)}</p>`).join("");

// Ngược lại: HTML → chữ thường mỗi đoạn một dòng (để so sánh / xuất Excel)
export const htmlToText = (html: string) =>
  String(html ?? "")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|h3|h4|li)>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .split("\n").map((l) => l.trim()).filter(Boolean).join("\n");

// Thông số nhiều dòng: "Tên: giá trị" → hàng bảng; dòng không có ":" → gạch đầu dòng
export function parseSpecs(text: string): { rows: [string, string][]; notes: string[] } {
  const rows: [string, string][] = [];
  const notes: string[] = [];
  for (const line of String(text ?? "").split(/\r?\n/).map((l) => l.replace(/^[-•*·\s]+/, "").trim()).filter(Boolean)) {
    const i = line.indexOf(":");
    if (i > 0 && i < 60) rows.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
    else notes.push(line);
  }
  return { rows, notes };
}
