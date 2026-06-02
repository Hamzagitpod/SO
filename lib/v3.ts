// ============================================================================
// Menu Builder V3 — moteur de conversion (Takeaway / Just Eat Menu Builder)
// Logique retenue depuis le 1er import réussi (cf. V3_LOGIC.md).
// Format: 36 colonnes, UTF-8 SANS BOM, CRLF, quoting minimal.
// ============================================================================

export const V3_HEADERS = [
  "GTIN","Product Type","Category","Product Name","Image URL","Description",
  "Regular Price","Pickup Price","SKU","isAlcohol","ABV(%)","Caffeine Quantity",
  "Caffeine reference unit","Net Value","Net Unit","Net Quantity","Gross weight",
  "Gross Unit","Size Description","Energy Content","Serving Size","Tax",
  "Quantity Restriction","Product Types","Deposit Type","Deposit Amount",
  "Allergen information","Additive information","Additional information",
  "Quantitative declaration of ingredients (QUID)","Nutritional declaration",
  "Name of manufacturer","Address of manufacturer",
  "Country of origin or place of provenance","Storage conditions",
  "Preparation instructions",
];
const NC = V3_HEADERS.length; // 36

// column indices
const C = {
  GTIN:0, TYPE:1, CAT:2, NAME:3, IMG:4, DESC:5, RP:6, PP:7, SKU:8,
  ALC:9, ABV:10, NETV:13, NETU:14, GROSSV:16, GROSSU:17,
};

export type Option = { name: string; price: number };
export type OptionGroup = { name: string; options: Option[] };
export type Item = {
  category: string;
  name: string;
  description?: string;
  priceDelivery: number;
  pricePickup: number;
  gtin?: string;
  imageUrl?: string;
  isAlcohol?: boolean;
  abv?: number | null;
  groups: OptionGroup[];
};
export type Menu = Item[];

// ---- price formatting: like python "%g" (no trailing zeros) ----
export function money(x: number | string): string {
  if (x === "" || x === null || x === undefined) return "";
  const n = typeof x === "number" ? x : parseFloat(String(x).replace(",", "."));
  if (isNaN(n)) return "";
  return String(Number(n.toFixed(4)) + 0); // strips trailing zeros: 2.50->2.5, 4.00->4
}

// ---- CSV field quoting (minimal, RFC4180) ----
function q(field: string): string {
  const s = field == null ? "" : String(field);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// ============================ SERIALIZE ============================
export function serialize(menu: Menu): string {
  const rows: string[][] = [V3_HEADERS.slice()];
  for (const it of menu) {
    const r = new Array(NC).fill("");
    r[C.GTIN] = it.gtin || "";
    r[C.TYPE] = "ITEM";
    r[C.CAT] = it.category || "";
    r[C.NAME] = it.name || "";
    r[C.IMG] = it.imageUrl || "";
    r[C.DESC] = it.description || "";
    r[C.RP] = money(it.priceDelivery);
    r[C.PP] = money(it.pricePickup ?? it.priceDelivery);
    if (it.isAlcohol) r[C.ALC] = "TRUE";
    if (it.abv !== undefined && it.abv !== null && it.abv !== ("" as any))
      r[C.ABV] = money(it.abv as number);
    rows.push(r);
    for (const g of it.groups || []) {
      const gr = new Array(NC).fill("");
      gr[C.TYPE] = "Option-Group";
      gr[C.CAT] = it.category || "";
      gr[C.NAME] = g.name;
      rows.push(gr);
      for (const o of g.options || []) {
        const or = new Array(NC).fill("");
        or[C.TYPE] = "Option";
        or[C.CAT] = it.category || "";
        or[C.NAME] = o.name;
        or[C.RP] = money(o.price);
        or[C.PP] = money(o.price);
        rows.push(or);
      }
    }
  }
  // CRLF, trailing CRLF, no BOM
  return rows.map((r) => r.map(q).join(",")).join("\r\n") + "\r\n";
}

// ============================ CSV PARSE (generic) ============================
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", i = 0, inQ = false;
  text = text.replace(/^﻿/, "");
  while (i < text.length) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } inQ = false; i++; continue; }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQ = true; i++; continue; }
    if (ch === ",") { row.push(field); field = ""; i++; continue; }
    if (ch === "\r") { i++; continue; }
    if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += ch; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => (c || "").trim() !== ""));
}

// ============================ PARSE V3 (round-trip) ============================
export function parseV3(text: string): Menu {
  const rows = parseCSV(text);
  if (!rows.length) return [];
  const start = rows[0][C.TYPE] === "Product Type" || /product type/i.test(rows[0].join(",")) ? 1 : 0;
  const menu: Menu = [];
  let cur: Item | null = null, curGroup: OptionGroup | null = null;
  for (let i = start; i < rows.length; i++) {
    const r = rows[i]; const t = (r[C.TYPE] || "").trim();
    if (t === "ITEM") {
      cur = {
        category: (r[C.CAT] || "").trim(), name: (r[C.NAME] || "").trim(),
        description: r[C.DESC] || "", priceDelivery: parseFloat(r[C.RP]) || 0,
        pricePickup: parseFloat(r[C.PP]) || 0, gtin: r[C.GTIN] || "", imageUrl: r[C.IMG] || "",
        isAlcohol: (r[C.ALC] || "").toUpperCase() === "TRUE",
        abv: r[C.ABV] ? parseFloat(r[C.ABV]) : null, groups: [],
      };
      menu.push(cur); curGroup = null;
    } else if (t === "Option-Group" && cur) {
      curGroup = { name: (r[C.NAME] || "").trim(), options: [] }; cur.groups.push(curGroup);
    } else if (t === "Option" && curGroup) {
      curGroup.options.push({ name: (r[C.NAME] || "").trim(), price: parseFloat(r[C.RP]) || 0 });
    }
  }
  return menu;
}

// ============================ PARSE TMS (jetms export) ============================
// Format: header line "[sortid;extid;gtin;name;price_delivery;price_pickup;description;photo_url;...]#"
// puis enregistrements séparés par "#". Chaque bloc = une catégorie (à nommer).
export function parseTMS(text: string): Menu {
  const menu: Menu = [];
  const blocks = text.split(/\[sortid;[^\]]*\]#?/i).map((b) => b.trim()).filter(Boolean);
  // recover header order from first header
  const hm = text.match(/\[sortid;([^\]]*)\]/i);
  const cols = hm ? ("sortid;" + hm[1]).split(";").map((s) => s.trim()) : ["sortid","extid","gtin","name","price_delivery","price_pickup","description","photo_url"];
  const idx = (k: string) => cols.indexOf(k);
  let bi = 0;
  for (const block of blocks) {
    bi++;
    const cat = "Catégorie " + bi;
    const records = block.split("#").map((r) => r.trim()).filter((r) => r && r.includes(";"));
    const rowItems: { sort: number; it: Item }[] = [];
    for (const rec of records) {
      const f = rec.split(";");
      const name = (f[idx("name")] || "").trim();
      if (!name) continue;
      rowItems.push({
        sort: parseInt(f[idx("sortid")]) || 0,
        it: {
          category: cat, name,
          description: idx("description") >= 0 ? (f[idx("description")] || "").trim() : "",
          priceDelivery: parseFloat(f[idx("price_delivery")]) || 0,
          pricePickup: parseFloat(f[idx("price_pickup")]) || parseFloat(f[idx("price_delivery")]) || 0,
          gtin: idx("gtin") >= 0 ? (f[idx("gtin")] || "").trim() : "",
          imageUrl: idx("photo_url") >= 0 ? (f[idx("photo_url")] || "").trim() : "",
          groups: [],
        },
      });
    }
    rowItems.sort((a, b) => a.sort - b.sort);
    rowItems.forEach((x) => menu.push(x.it));
  }
  return menu;
}

// ============================ VALIDATION ============================
export type Issue = { level: "error" | "warn"; msg: string };
export function validate(menu: Menu): Issue[] {
  const issues: Issue[] = [];
  // duplicate (category, item name)
  const seen = new Set<string>();
  for (const it of menu) {
    const k = it.category + "||" + it.name;
    if (!it.name.trim()) issues.push({ level: "error", msg: `Item sans nom dans «${it.category}»` });
    if (seen.has(k)) issues.push({ level: "error", msg: `Doublon d'item: «${it.name}» dans «${it.category}»` });
    seen.add(k);
    if (!(it.priceDelivery > 0) && !(it.pricePickup > 0))
      issues.push({ level: "warn", msg: `Prix 0 pour «${it.name}»` });
  }
  // group name consistency: same name => identical option set (name+price) everywhere
  const sig = new Map<string, string>();
  for (const it of menu) for (const g of it.groups || []) {
    const s = JSON.stringify((g.options || []).map((o) => [o.name, o.price]));
    if (sig.has(g.name) && sig.get(g.name) !== s)
      issues.push({ level: "error", msg: `Incohérence d'options: le groupe «${g.name}» a des options différentes selon les items → renomme-le ou aligne les options.` });
    else sig.set(g.name, s);
    if (!g.options || !g.options.length) issues.push({ level: "warn", msg: `Groupe «${g.name}» sans option (sur «${it.name}»)` });
  }
  return issues;
}

// dedupe identical errors
export function validateMenu(menu: Menu): Issue[] {
  const all = validate(menu); const out: Issue[] = []; const seen = new Set<string>();
  for (const i of all) { const k = i.level + i.msg; if (!seen.has(k)) { seen.add(k); out.push(i); } }
  return out;
}

export function stats(menu: Menu) {
  const cats = new Set(menu.map((i) => i.category));
  let og = 0, opt = 0;
  for (const it of menu) for (const g of it.groups || []) { og++; opt += (g.options || []).length; }
  return { items: menu.length, categories: cats.size, optionGroups: og, options: opt };
}
