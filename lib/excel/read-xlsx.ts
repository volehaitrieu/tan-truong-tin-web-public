// Đọc file .xlsx ngay trong trình duyệt, không cần thư viện ngoài:
// .xlsx là file zip chứa XML → tự đọc mục lục zip + giải nén bằng DecompressionStream("deflate-raw").

type Entry = { name: string; method: number; compSize: number; offset: number };

function readEntries(buf: ArrayBuffer): Entry[] {
  const v = new DataView(buf);
  // Tìm "End of central directory" (chữ ký 0x06054b50) từ cuối file
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("File không phải Excel (.xlsx) hợp lệ.");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out: Entry[] = [];
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("File Excel bị hỏng.");
    const method = v.getUint16(p + 10, true);
    const compSize = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true), extraLen = v.getUint16(p + 30, true), commentLen = v.getUint16(p + 32, true);
    const offset = v.getUint32(p + 42, true);
    out.push({ name: dec.decode(new Uint8Array(buf, p + 46, nameLen)), method, compSize, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

async function readFile(buf: ArrayBuffer, e: Entry): Promise<string> {
  const v = new DataView(buf);
  const start = e.offset + 30 + v.getUint16(e.offset + 26, true) + v.getUint16(e.offset + 28, true);
  const data = new Uint8Array(buf, start, e.compSize);
  if (e.method === 0) return new TextDecoder().decode(data);
  if (e.method !== 8) throw new Error("Kiểu nén không hỗ trợ.");
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(stream).text();
}

const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const colIndex = (ref: string) => [...ref.replace(/\d+/g, "")].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

/** Trả về { tên sheet: các dòng (mảng ô dạng chữ) } */
export async function readXlsx(file: File, onlySheets?: string[]): Promise<Record<string, string[][]>> {
  if (file.size > 20 * 1024 * 1024) throw new Error("File quá lớn (tối đa 20MB).");
  const buf = await file.arrayBuffer();
  const entries = readEntries(buf);
  const get = async (name: string) => {
    const e = entries.find((x) => x.name === name);
    return e ? new DOMParser().parseFromString(await readFile(buf, e), "application/xml") : null;
  };
  const shared: string[] = [];
  const ss = await get("xl/sharedStrings.xml");
  if (ss) for (const si of Array.from(ss.getElementsByTagNameNS(MAIN, "si")))
    shared.push(Array.from(si.getElementsByTagNameNS(MAIN, "t")).map((t) => t.textContent ?? "").join(""));
  const wb = await get("xl/workbook.xml");
  const rels = await get("xl/_rels/workbook.xml.rels");
  if (!wb || !rels) throw new Error("File Excel bị hỏng.");
  const target = new Map(Array.from(rels.getElementsByTagName("Relationship")).map((r) => [r.getAttribute("Id"), r.getAttribute("Target") ?? ""]));
  const result: Record<string, string[][]> = {};
  for (const s of Array.from(wb.getElementsByTagNameNS(MAIN, "sheet"))) {
    const name = s.getAttribute("name") ?? "";
    if (onlySheets && !onlySheets.includes(name)) continue;
    const rid = s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    let t = (target.get(rid) ?? "").replace(/^\//, "");
    if (!t.startsWith("xl/")) t = "xl/" + t;
    const doc = await get(t);
    if (!doc) continue;
    result[name] = Array.from(doc.getElementsByTagNameNS(MAIN, "row")).map((row) => {
      const cells: string[] = [];
      for (const c of Array.from(row.getElementsByTagNameNS(MAIN, "c"))) {
        const type = c.getAttribute("t");
        const vEl = c.getElementsByTagNameNS(MAIN, "v")[0];
        const val = type === "inlineStr" ? Array.from(c.getElementsByTagNameNS(MAIN, "t")).map((x) => x.textContent).join("")
          : type === "s" ? shared[Number(vEl?.textContent)] ?? "" : vEl?.textContent ?? "";
        cells[colIndex(c.getAttribute("r") ?? "A")] = String(val).trim();
      }
      return Array.from(cells, (x) => x ?? "");
    });
  }
  return result;
}
