// ============================================================================
// Menu Builder V3 — moteur de conversion (Takeaway / Just Eat Menu Builder)
// Format export: 36 colonnes, UTF-8 SANS BOM, CRLF, quoting minimal.
// Sait IMPORTER: CSV V3 (36 col), export JET brut (81 col dénormalisé),
//                export jetms TMS, ou texte libre.
// Règle JET clé: 2 groupes d'options de MÊME nom => options identiques,
//                sinon l'import JET échoue ("Incohérence de l'ensemble d'options").
//                -> dedupeGroupNames() rend les noms uniques automatiquement.
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

// 36-col indices
const C = {
  GTIN:0, TYPE:1, CAT:2, NAME:3, IMG:4, DESC:5, RP:6, PP:7, SKU:8,
  ALC:9, ABV:10, NETV:13, NETU:14, GROSSV:16, GROSSU:17,
};

export type Option = { name: string; price: number };
export type OptionGroup = { name: string; options: Option[] };
export type Item = {
  id?: string;
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

let _uid = 0;
export function uid(): string { _uid += 1; return "it_" + _uid + "_" + Math.random().toString(36).slice(2, 8); }

// ---- price formatting: no trailing zeros (2.50->2.5, 4.00->4) ----
export function money(x: number | string): string {
  if (x === "" || x === null || x === undefined) return "";
  const n = typeof x === "number" ? x : parseFloat(String(x).replace(",", "."));
  if (isNaN(n)) return "";
  return String(parseFloat(n.toFixed(4)));
}
function num(x: any): number {
  if (x === "" || x == null) return 0;
  const n = parseFloat(String(x).replace(/[$€\s]/g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

// ---- CSV field quoting (minimal, RFC4180) ----
function q(field: string): string {
  const s = field == null ? "" : String(field);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// ============================ SERIALIZE ============================
// Toujours dédupe les noms de groupes en conflit (sécurité import JET).
export function serialize(menuIn: Menu): string {
  const menu = dedupeGroupNames(menuIn);
  const rows: string[][] = [V3_HEADERS.slice()];
  for (const it of menu) {
    const r = new Array(NC).fill("");
    r[C.GTIN] = it.gtin || "";
    r[C.TYPE] = "ITEM";
    r[C.CAT] = it.category || "";
    r[C.NAME] = it.name || "";
    r[C.IMG] = it.imageUrl || "";
    r[C.DESC] = (it.description || "").replace(/\s*\r?\n\s*/g, ", ").trim();
    r[C.RP] = money(it.priceDelivery);
    r[C.PP] = money(it.pricePickup ?? it.priceDelivery);
    if (it.isAlcohol) r[C.ALC] = "TRUE";
    if (it.abv !== undefined && it.abv !== null && (it.abv as any) !== "")
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
  return rows.map((r) => r.map(q).join(",")).join("\r\n") + "\r\n"; // CRLF, no BOM
}

// ============================ CSV PARSE (generic) ============================
export function parseCSV(text: string): string[][] {
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

// ============================ PARSE V3 (36 col, round-trip) ============================
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
        id: uid(), category: (r[C.CAT] || "").trim(), name: (r[C.NAME] || "").trim(),
        description: r[C.DESC] || "", priceDelivery: num(r[C.RP]), pricePickup: num(r[C.PP]),
        gtin: r[C.GTIN] || "", imageUrl: r[C.IMG] || "",
        isAlcohol: (r[C.ALC] || "").toUpperCase() === "TRUE",
        abv: r[C.ABV] ? num(r[C.ABV]) : null, groups: [],
      };
      menu.push(cur); curGroup = null;
    } else if (t === "Option-Group" && cur) {
      curGroup = { name: (r[C.NAME] || "").trim(), options: [] }; cur.groups.push(curGroup);
    } else if (t === "Option" && curGroup) {
      curGroup.options.push({ name: (r[C.NAME] || "").trim(), price: num(r[C.RP]) });
    }
  }
  return menu;
}

// ============================ PARSE 81-col (export JET brut, dénormalisé) ============================
// En-tête: "Category Name","Category ID",...,"Item Name","Item ID",...,"OptionGroup Name",...
// Chaque ligne porte la catégorie + (option) l'item + (option) un OptionGroup+Option.
// Les items s'étendent sur plusieurs lignes (même Item ID), une option par ligne.
const C81 = { cat:0, itemName:34, itemId:35, itemDesc:36, reg:37, pick:38, gtin:43, abv:47, img:49, ogName:64, ogId:65, optName:69, optReg:71 };
export function is81col(text: string): boolean {
  const first = (text.split(/\r?\n/)[0] || "");
  return /(^|,)\s*"?Category Name"?\s*,/i.test(first) && /"?Item Name"?/i.test(first) && /"?OptionGroup Name"?/i.test(first);
}
export function parse81(text: string): Menu {
  const rows = parseCSV(text);
  if (!rows.length) return [];
  const menu: Menu = []; const byId = new Map<string, Item>();
  let cur: Item | null = null;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const itemId = (r[C81.itemId] || "").trim();
    if (itemId) {
      if (!cur || cur.id !== itemId) {
        cur = byId.get(itemId) || null;
        if (!cur) {
          cur = {
            id: itemId, category: (r[C81.cat] || "").trim(), name: (r[C81.itemName] || "").trim(),
            description: r[C81.itemDesc] || "", priceDelivery: num(r[C81.reg]), pricePickup: num(r[C81.pick]),
            gtin: (r[C81.gtin] || "").trim(), imageUrl: (r[C81.img] || "").trim(),
            isAlcohol: num(r[C81.abv]) > 0, abv: r[C81.abv] ? num(r[C81.abv]) : null, groups: [],
          };
          menu.push(cur); byId.set(itemId, cur);
        }
      }
      const ogName = (r[C81.ogName] || "").trim(), ogId = (r[C81.ogId] || "").trim();
      const optName = (r[C81.optName] || "").trim();
      if (ogName || ogId) {
        const key = ogId || ogName;
        let g = (cur as any)._g && (cur as any)._g.get(key);
        if (!g) {
          g = { name: ogName, options: [] };
          cur!.groups.push(g);
          (cur as any)._g = (cur as any)._g || new Map();
          (cur as any)._g.set(key, g);
        }
        if (optName) g.options.push({ name: optName, price: num(r[C81.optReg]) });
      }
    }
  }
  for (const it of menu) delete (it as any)._g;
  return menu;
}

// ============================ PARSE TMS (jetms export) ============================
export function parseTMS(text: string): Menu {
  const menu: Menu = [];
  const blocks = text.split(/\[sortid;[^\]]*\]#?/i).map((b) => b.trim()).filter(Boolean);
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
          id: uid(), category: cat, name,
          description: idx("description") >= 0 ? (f[idx("description")] || "").trim() : "",
          priceDelivery: num(f[idx("price_delivery")]),
          pricePickup: num(f[idx("price_pickup")]) || num(f[idx("price_delivery")]),
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

// ============================ AUTO-IMPORT (détection de format) ============================
export function autoImport(text: string): { menu: Menu; how: string } {
  const t = text.trim();
  if (!t) return { menu: [], how: "vide" };
  if (/\[sortid;/i.test(t)) return { menu: parseTMS(t), how: "jetms TMS" };
  if (is81col(t)) return { menu: parse81(t), how: "JET 81 colonnes" };
  if (/product type/i.test(t.split(/\r?\n/)[0] || "")) return { menu: parseV3(t), how: "CSV V3 (36 col)" };
  if (t.includes(",") && /(^|\n)\s*,?\s*"?(ITEM|Option-Group|Option)"?\s*,/m.test(t)) return { menu: parseV3(t), how: "CSV V3 (36 col)" };
  return { menu: parseTextMenu(t), how: "texte" };
}

// ---- parseur texte libre: "CATEGORIE" en titre + "Nom — 12,00 € — desc" ----
export function parseTextMenu(text: string): Menu {
  const menu: Menu = [];
  let cat = "Menu";
  const priceRe = /(\d+[.,]\d{1,2}|\d+)\s*€?\s*$/;
  for (let raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/\s+[—–-]\s+/);
    const m = line.match(priceRe);
    if (parts.length >= 2 && m) {
      const name = parts[0].trim();
      const price = parseFloat((parts[1].match(priceRe)?.[1] || m[1]).replace(",", "."));
      const desc = parts.slice(2).join(" — ").trim();
      menu.push({ id: uid(), category: cat, name, description: desc, priceDelivery: price, pricePickup: price, groups: [] });
    } else if (m && /\s/.test(line)) {
      const name = line.replace(priceRe, "").replace(/[—–-]\s*$/, "").trim();
      const price = parseFloat(m[1].replace(",", "."));
      if (name) menu.push({ id: uid(), category: cat, name, description: "", priceDelivery: price, pricePickup: price, groups: [] });
    } else {
      cat = line.replace(/[:•]/g, "").trim() || cat;
    }
  }
  return menu;
}

// ============================ DEDUPE GROUPES (règle JET) ============================
// Deux groupes de même nom doivent avoir des options identiques. Sinon JET rejette.
// On garde la signature dominante avec le nom d'origine et on suffixe les variantes.
function groupSig(g: OptionGroup): string {
  return (g.options || []).map((o) => o.name + "=" + money(o.price)).join(" | ");
}
export function countGroupConflicts(menu: Menu): number {
  const m = new Map<string, Set<string>>();
  for (const it of menu) for (const g of it.groups || []) {
    if (!m.has(g.name)) m.set(g.name, new Set());
    m.get(g.name)!.add(groupSig(g));
  }
  let n = 0; for (const s of m.values()) if (s.size > 1) n++;
  return n;
}
// Retourne une COPIE du menu avec les noms de groupes en conflit rendus uniques.
export function dedupeGroupNames(menu: Menu): Menu {
  // compter les signatures par nom
  const sigCount = new Map<string, Map<string, number>>();
  for (const it of menu) for (const g of it.groups || []) {
    const s = groupSig(g);
    if (!sigCount.has(g.name)) sigCount.set(g.name, new Map());
    const mm = sigCount.get(g.name)!; mm.set(s, (mm.get(s) || 0) + 1);
  }
  // construire la table de renommage (nom+sig -> nouveau nom)
  const rename = new Map<string, string>();
  for (const [name, mm] of sigCount) {
    if (mm.size <= 1) continue;
    const sorted = [...mm.entries()].sort((a, b) => b[1] - a[1]);
    const dom = sorted[0][0]; const domSet = new Set(dom.split(" | "));
    const used = new Set([name]);
    for (const [sig] of sorted) {
      if (sig === dom) continue;
      const distinct = (sig.split(" | ").find((o) => !domSet.has(o)) || "v").split("=")[0];
      let nn = name + " (" + distinct + ")"; let k = 2;
      while (used.has(nn)) { nn = name + " (" + distinct + " " + k + ")"; k++; }
      used.add(nn); rename.set(name + " " + sig, nn);
    }
  }
  if (!rename.size) return menu;
  return menu.map((it) => ({
    ...it,
    groups: (it.groups || []).map((g) => {
      const nn = rename.get(g.name + " " + groupSig(g));
      return nn ? { ...g, name: nn } : g;
    }),
  }));
}

// ============================ VALIDATION ============================
export type Issue = { level: "error" | "warn"; msg: string };
export function validate(menu: Menu): Issue[] {
  const issues: Issue[] = [];
  const seen = new Set<string>();
  for (const it of menu) {
    const k = it.category + "||" + it.name;
    if (!it.name.trim()) issues.push({ level: "error", msg: `Item sans nom dans «${it.category}»` });
    if (seen.has(k)) issues.push({ level: "error", msg: `Doublon d'item: «${it.name}» dans «${it.category}»` });
    seen.add(k);
    if (!(it.priceDelivery > 0) && !(it.pricePickup > 0))
      issues.push({ level: "warn", msg: `Prix 0 pour «${it.name}»` });
  }
  const sig = new Map<string, string>();
  for (const it of menu) for (const g of it.groups || []) {
    const s = groupSig(g);
    if (sig.has(g.name) && sig.get(g.name) !== s)
      issues.push({ level: "warn", msg: `Groupe «${g.name}»: options différentes selon les items → corrigé automatiquement à l'export (nom rendu unique).` });
    else sig.set(g.name, s);
    if (!g.options || !g.options.length) issues.push({ level: "warn", msg: `Groupe «${g.name}» sans option (sur «${it.name}»)` });
  }
  return issues;
}
export function validateMenu(menu: Menu): Issue[] {
  const all = validate(menu); const out: Issue[] = []; const seen = new Set<string>();
  for (const i of all) { const key = i.level + i.msg; if (!seen.has(key)) { seen.add(key); out.push(i); } }
  return out;
}

export function stats(menu: Menu) {
  const cats = new Set(menu.map((i) => i.category));
  let og = 0, opt = 0;
  for (const it of menu) for (const g of it.groups || []) { og++; opt += (g.options || []).length; }
  return { items: menu.length, categories: cats.size, optionGroups: og, options: opt };
}
