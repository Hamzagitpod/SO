"use client";
import React, { useMemo, useRef, useState } from "react";
import {
  Menu, Item, OptionGroup, serialize, parseV3, parseTMS, validateMenu, stats, money,
} from "@/lib/v3";

// ---- light structured-text parser: "CATEGORY" headers + "Name — 12,00 € — desc" ----
function parseText(text: string): Menu {
  const menu: Menu = [];
  let cat = "Menu";
  const priceRe = /(\d+[.,]\d{1,2}|\d+)\s*€?\s*$/;
  for (let raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/\s+[—–-]\s+/); // "Name - price - desc"
    const m = line.match(priceRe);
    if (parts.length >= 2 && m) {
      const name = parts[0].trim();
      const price = parseFloat((parts[1].match(priceRe)?.[1] || m[1]).replace(",", "."));
      const desc = parts.slice(2).join(" — ").trim();
      menu.push({ category: cat, name, description: desc, priceDelivery: price, pricePickup: price, groups: [] });
    } else if (m && /\s/.test(line)) {
      const name = line.replace(priceRe, "").replace(/[—–-]\s*$/, "").trim();
      const price = parseFloat(m[1].replace(",", "."));
      if (name) menu.push({ category: cat, name, description: "", priceDelivery: price, pricePickup: price, groups: [] });
    } else {
      cat = line.replace(/[:•]/g, "").trim() || cat; // header line
    }
  }
  return menu;
}

function autoImport(text: string): { menu: Menu; how: string } {
  const t = text.trim();
  if (/\[sortid;/i.test(t)) return { menu: parseTMS(t), how: "TMS (jetms)" };
  if (/product type/i.test(t.split(/\r?\n/)[0] || "")) return { menu: parseV3(t), how: "CSV V3" };
  if (t.includes(",") && /\bITEM\b|Option-Group/.test(t)) return { menu: parseV3(t), how: "CSV V3" };
  return { menu: parseText(t), how: "texte" };
}

export default function Page() {
  const [menu, setMenu] = useState<Menu>([]);
  const [raw, setRaw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const issues = useMemo(() => validateMenu(menu), [menu]);
  const errs = issues.filter((i) => i.level === "error");
  const st = useMemo(() => stats(menu), [menu]);
  const cats = useMemo(() => {
    const o: string[] = [];
    menu.forEach((it) => { if (!o.includes(it.category)) o.push(it.category); });
    return o;
  }, [menu]);

  function up(i: number, patch: Partial<Item>) {
    setMenu((m) => m.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  }
  function upGroup(i: number, gi: number, patch: Partial<OptionGroup>) {
    setMenu((m) => m.map((it, k) => k !== i ? it : { ...it, groups: it.groups.map((g, j) => j === gi ? { ...g, ...patch } : g) }));
  }
  function upOpt(i: number, gi: number, oi: number, patch: any) {
    setMenu((m) => m.map((it, k) => k !== i ? it : { ...it, groups: it.groups.map((g, j) => j !== gi ? g : { ...g, options: g.options.map((o, x) => x === oi ? { ...o, ...patch } : o) }) }));
  }

  function doImport() {
    try {
      const { menu: mm, how } = autoImport(raw);
      if (!mm.length) { setMsg("Rien détecté. Vérifie le format collé."); return; }
      setMenu(mm); setMsg(`Importé (${how}) : ${mm.length} items.`);
    } catch (e: any) { setMsg("Erreur import: " + e.message); }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const isText = /\.(csv|txt)$/i.test(f.name) || f.type.startsWith("text");
    if (isText) {
      const txt = await f.text(); setRaw(txt);
      const { menu: mm, how } = autoImport(txt);
      setMenu(mm); setMsg(`Fichier ${f.name} → ${mm.length} items (${how}).`);
      return;
    }
    // PDF / image / docx → extraction IA (clé Gemini requise)
    const key = (typeof window !== "undefined" && localStorage.getItem("ccm.gemini_key")) || "";
    if (!key) { setMsg("Fichier non-texte: configure ta clé Gemini dans Réglages pour l'extraction IA, ou colle le texte."); return; }
    setBusy(true); setMsg("Extraction IA en cours…");
    try {
      const b64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(f); });
      const resp = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json", "x-gemini-key": key, "x-gemini-model": localStorage.getItem("ccm.gemini_model") || "gemini-2.0-flash" }, body: JSON.stringify({ fileBase64: b64, mimeType: f.type }) });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || ("HTTP " + resp.status));
      const mm: Menu = (data.menu || []).map((it: any) => ({ groups: [], pricePickup: it.priceDelivery, ...it }));
      setMenu(mm); setMsg(`Extraction IA: ${mm.length} items. Vérifie puis exporte.`);
    } catch (e: any) { setMsg("Échec extraction IA: " + e.message); } finally { setBusy(false); }
  }

  function exportCSV() {
    if (errs.length) { if (!confirm(`${errs.length} erreur(s) de validation. Exporter quand même ?`)) return; }
    const csv = serialize(menu);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "menu_v3.csv"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  }
  async function copyCSV() { try { await navigator.clipboard.writeText(serialize(menu)); setMsg("CSV V3 copié."); } catch { setMsg("Copie impossible."); } }

  return (
    <main>
      <div className="bar"><div className="wrap" style={{ padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="row"><span className="tag">V3</span><strong>Menu Builder</strong><span className="muted tiny">Cloud Consulting Mastery</span></div>
        <div className="row">
          <span className="pill">{st.items} items · {st.categories} cat · {st.optionGroups} groupes · {st.options} options</span>
          {errs.length ? <span className="pill issue-e">{errs.length} erreur(s)</span> : menu.length ? <span className="pill ok">✓ conforme</span> : null}
          <a className="btn btn-sm" href="/settings">Réglages</a>
          <button className="btn btn-sm" onClick={copyCSV} disabled={!menu.length}>Copier</button>
          <button className="btn btn-primary btn-sm" onClick={exportCSV} disabled={!menu.length}>Exporter CSV V3</button>
        </div>
      </div></div>

      <div className="wrap">
        <header style={{ marginBottom: 8 }}>
          <h1 className="h1">Menu Builder <span className="muted">/</span> V3</h1>
          <p className="sub">Importe (texte, CSV V3, export jetms TMS, ou PDF/image via IA) → édite → exporte un CSV V3 36 colonnes <b>parfait</b> (add-ons liés, min/max, suppléments, alcool). Logique appliquée automatiquement.</p>
        </header>

        <div className="card">
          <span className="label">Importer</span>
          <textarea className="field field-mono" placeholder="Colle ici: un menu en texte, un CSV V3, ou un export jetms ( [sortid;...]# )…" value={raw} onChange={(e) => setRaw(e.target.value)} />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn btn-primary" onClick={doImport} disabled={busy}>Importer le texte</button>
            <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>Importer un fichier (.csv/.txt/PDF/image)</button>
            <input ref={fileRef} type="file" accept=".csv,.txt,application/pdf,image/*,.docx" style={{ display: "none" }} onChange={onFile} />
            <button className="btn" onClick={() => { setMenu([]); setRaw(""); setMsg(""); }}>Vider</button>
            {msg && <span className="muted tiny">{msg}</span>}
          </div>
        </div>

        {issues.length > 0 && (
          <div className="card">
            <span className="label">Validation</span>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {issues.slice(0, 30).map((i, k) => (
                <li key={k} className={i.level === "error" ? "issue-e" : "issue-w"}>{i.level === "error" ? "✖ " : "⚠ "}{i.msg}</li>
              ))}
            </ul>
          </div>
        )}

        {cats.map((cat) => (
          <div className="cat" key={cat}>
            <div className="cat-h">
              <input className="field" style={{ fontWeight: 700, maxWidth: 320 }} value={cat}
                onChange={(e) => { const nv = e.target.value; setMenu((m) => m.map((it) => it.category === cat ? { ...it, category: nv } : it)); }} />
              <span className="muted tiny">{menu.filter((i) => i.category === cat).length} items</span>
              <div style={{ flex: 1 }} />
              <button className="btn btn-sm" onClick={() => setMenu((m) => [...m, { category: cat, name: "Nouvel item", description: "", priceDelivery: 0, pricePickup: 0, groups: [] }])}>+ item</button>
              <button className="btn btn-sm btn-danger" onClick={() => { if (confirm(`Supprimer la catégorie «${cat}» ?`)) setMenu((m) => m.filter((i) => i.category !== cat)); }}>suppr. cat.</button>
            </div>
            {menu.map((it, i) => it.category !== cat ? null : (
              <div className="item" key={i}>
                <div className="grid" style={{ gridTemplateColumns: "2fr 90px 90px auto", alignItems: "end" }}>
                  <div><span className="label">Nom</span><input className="field" value={it.name} onChange={(e) => up(i, { name: e.target.value })} /></div>
                  <div><span className="label">Prix livr.</span><input className="field field-mono" value={it.priceDelivery} onChange={(e) => up(i, { priceDelivery: parseFloat(e.target.value.replace(",", ".")) || 0 })} /></div>
                  <div><span className="label">Prix retrait</span><input className="field field-mono" value={it.pricePickup} onChange={(e) => up(i, { pricePickup: parseFloat(e.target.value.replace(",", ".")) || 0 })} /></div>
                  <div className="row">
                    <button className="btn btn-sm" onClick={() => setMenu((m) => { const c = { ...m[i], name: m[i].name + " (copie)" }; const a = [...m]; a.splice(i + 1, 0, c); return a; })}>dupliquer</button>
                    <button className="btn btn-sm btn-danger" onClick={() => setMenu((m) => m.filter((_, k) => k !== i))}>✕</button>
                  </div>
                </div>
                <div className="grid" style={{ gridTemplateColumns: "1fr", marginTop: 6 }}>
                  <div><span className="label">Description</span><input className="field" value={it.description || ""} onChange={(e) => up(i, { description: e.target.value })} /></div>
                </div>
                <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 90px 110px", marginTop: 6 }}>
                  <div><span className="label">Image URL</span><input className="field field-mono" value={it.imageUrl || ""} onChange={(e) => up(i, { imageUrl: e.target.value })} /></div>
                  <div><span className="label">GTIN</span><input className="field field-mono" value={it.gtin || ""} onChange={(e) => up(i, { gtin: e.target.value })} /></div>
                  <div><span className="label">Alcool</span><button className="btn" style={{ width: "100%", justifyContent: "center", background: it.isAlcohol ? "var(--ink)" : "#fff", color: it.isAlcohol ? "#fff" : "var(--ink)" }} onClick={() => up(i, { isAlcohol: !it.isAlcohol })}>{it.isAlcohol ? "✓ Oui" : "Non"}</button></div>
                  <div><span className="label">ABV %</span><input className="field field-mono" value={it.abv ?? ""} onChange={(e) => up(i, { abv: e.target.value === "" ? null : parseFloat(e.target.value.replace(",", ".")) })} /></div>
                </div>

                {(it.groups || []).map((g, gi) => (
                  <div className="og" key={gi}>
                    <div className="row">
                      <input className="field" style={{ fontWeight: 700, maxWidth: 420 }} value={g.name} onChange={(e) => upGroup(i, gi, { name: e.target.value })} placeholder="Nom du groupe — ex: Sauce (obligatoire, 1 à 2)" />
                      <div style={{ flex: 1 }} />
                      <button className="btn btn-sm" onClick={() => upGroup(i, gi, { options: [...g.options, { name: "", price: 0 }] })}>+ option</button>
                      <button className="btn btn-sm btn-danger" onClick={() => up(i, { groups: it.groups.filter((_, j) => j !== gi) })}>suppr. groupe</button>
                    </div>
                    {g.options.map((o, oi) => (
                      <div className="opt" key={oi}>
                        <input className="field" value={o.name} placeholder="option" onChange={(e) => upOpt(i, gi, oi, { name: e.target.value })} />
                        <input className="field field-mono" value={o.price} onChange={(e) => upOpt(i, gi, oi, { price: parseFloat(e.target.value.replace(",", ".")) || 0 })} />
                        <button className="btn btn-sm btn-danger" onClick={() => upGroup(i, gi, { options: g.options.filter((_, x) => x !== oi) })}>✕</button>
                      </div>
                    ))}
                    <div className="muted tiny" style={{ marginTop: 4 }}>Astuce: mets le min/max dans le nom — <span className="kbd">(obligatoire, 1 à 2)</span>, <span className="kbd">(facultatif, max 3)</span>. Même nom de groupe ⇒ options identiques partout.</div>
                  </div>
                ))}
                <div style={{ marginTop: 8 }}>
                  <button className="btn btn-sm" onClick={() => up(i, { groups: [...(it.groups || []), { name: "Suppléments (facultatif)", options: [{ name: "", price: 0 }] }] })}>+ groupe d'options</button>
                </div>
              </div>
            ))}
          </div>
        ))}

        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn" onClick={() => { const n = prompt("Nom de la catégorie:"); if (n) setMenu((m) => [...m, { category: n, name: "Nouvel item", description: "", priceDelivery: 0, pricePickup: 0, groups: [] }]); }}>+ Nouvelle catégorie</button>
          {menu.length > 0 && <button className="btn btn-primary" onClick={exportCSV}>Exporter CSV V3</button>}
        </div>

        <p className="muted tiny" style={{ marginTop: 24 }}>CSV V3 : 36 colonnes · UTF-8 sans BOM · CRLF · quoting minimal · Product Type ∈ {"{ Item · Option-Group · Option }"}. Règles auto: produits distincts = items séparés, suppléments = groupes d'options, noms de groupe cohérents (sinon nom unique), alcool marqué isAlcohol/ABV.</p>
      </div>
    </main>
  );
}
