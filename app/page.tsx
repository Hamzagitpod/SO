"use client";
import React, { useMemo, useRef, useState } from "react";
import {
  Menu, Item, OptionGroup, serialize, autoImport, validateMenu, stats, countGroupConflicts, uid,
} from "@/lib/v3";

const BIG_MENU = 40;       // au-delà: catégories repliées par défaut
const CAT_RENDER_CAP = 120; // items rendus max par catégorie dépliée (perf)

export default function Page() {
  const [menu, setMenu] = useState<Menu>([]);
  const [raw, setRaw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAllIn, setShowAllIn] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const issues = useMemo(() => validateMenu(menu), [menu]);
  const errs = issues.filter((i) => i.level === "error");
  const st = useMemo(() => stats(menu), [menu]);
  const conflicts = useMemo(() => countGroupConflicts(menu), [menu]);
  // catégories ordonnées + index globaux des items (perf: une seule passe)
  const cats = useMemo(() => {
    const map = new Map<string, { it: Item; i: number }[]>();
    menu.forEach((it, i) => {
      if (!map.has(it.category)) map.set(it.category, []);
      map.get(it.category)!.push({ it, i });
    });
    return [...map.entries()].map(([name, items]) => ({ name, items }));
  }, [menu]);

  function applyImport(mm: Menu, how: string, append: boolean) {
    setMenu((prev) => {
      const next = append ? [...prev, ...mm] : mm;
      // déplier auto seulement si petit menu
      const catNames = new Set(next.map((i) => i.category));
      setExpanded(next.length <= BIG_MENU ? catNames : new Set());
      return next;
    });
  }

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
      if (!mm.length) { setMsg("Rien détecté. Formats: CSV V3 (36 col), export JET (81 col), jetms TMS, ou texte."); return; }
      applyImport(mm, how, false);
      setMsg(`Importé (${how}) : ${mm.length} items.`);
    } catch (e: any) { setMsg("Erreur import: " + e.message); }
  }

  async function processFile(f: File): Promise<{ items: Menu; how: string }> {
    const isText = /\.(csv|txt|tsv)$/i.test(f.name) || f.type.startsWith("text");
    if (isText) {
      const txt = await f.text();
      const { menu: mm, how } = autoImport(txt);
      return { items: mm, how };
    }
    const key = (typeof window !== "undefined" && localStorage.getItem("ccm.gemini_key")) || "";
    if (!key) throw new Error("clé Gemini requise (Réglages) pour l'extraction IA");
    const b64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(f); });
    const resp = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json", "x-gemini-key": key, "x-gemini-model": localStorage.getItem("ccm.gemini_model") || "gemini-2.0-flash" }, body: JSON.stringify({ fileBase64: b64, mimeType: f.type }) });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || ("HTTP " + resp.status));
    const items: Menu = (data.menu || []).map((it: any) => ({ id: uid(), groups: [], pricePickup: it.priceDelivery, ...it }));
    return { items, how: "IA" };
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    try {
      const collected: Menu = [];
      const parts: string[] = [];
      for (const f of files) {
        try {
          setMsg(`Traitement ${f.name}…`);
          const { items, how } = await processFile(f);
          collected.push(...items);
          parts.push(`${f.name}: +${items.length} (${how})`);
        } catch (err: any) { parts.push(`${f.name}: ✗ ${err.message}`); }
      }
      if (collected.length) applyImport(collected, "fichiers", true);
      setMsg(`${files.length} fichier(s) → +${collected.length} items. ${parts.join(" · ")}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function exportCSV() {
    if (errs.length) { if (!confirm(`${errs.length} erreur(s) de validation. Exporter quand même ?`)) return; }
    const csv = serialize(menu); // auto-dédupe les groupes en conflit
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "menu_v3.csv"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
    setMsg(conflicts ? `Export OK — ${conflicts} groupe(s) en conflit renommé(s) automatiquement pour l'import JET.` : "Export OK.");
  }
  async function copyCSV() { try { await navigator.clipboard.writeText(serialize(menu)); setMsg("CSV V3 copié (conflits auto-corrigés)."); } catch { setMsg("Copie impossible."); } }

  const toggle = (cat: string) => setExpanded((s) => { const n = new Set(s); n.has(cat) ? n.delete(cat) : n.add(cat); return n; });
  const expandAll = () => setExpanded(new Set(cats.map((c) => c.name)));
  const collapseAll = () => setExpanded(new Set());

  return (
    <main>
      <div className="bar"><div className="wrap" style={{ padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="row"><span className="tag">V3</span><strong>Menu Builder</strong><span className="muted tiny">Cloud Consulting Mastery</span></div>
        <div className="row">
          <span className="pill">{st.items} items · {st.categories} cat · {st.optionGroups} groupes · {st.options} options</span>
          {errs.length ? <span className="pill issue-e">{errs.length} erreur(s)</span> : menu.length ? <span className="pill ok">✓ conforme</span> : null}
          {conflicts ? <span className="pill issue-w" title="Renommés automatiquement à l'export">{conflicts} conflit(s) groupe → auto</span> : null}
          <a className="btn btn-sm" href="/settings">Réglages</a>
          <button className="btn btn-sm" onClick={copyCSV} disabled={!menu.length}>Copier</button>
          <button className="btn btn-primary btn-sm" onClick={exportCSV} disabled={!menu.length}>Exporter CSV V3</button>
        </div>
      </div></div>

      <div className="wrap">
        <header style={{ marginBottom: 8 }}>
          <h1 className="h1">Menu Builder <span className="muted">/</span> V3</h1>
          <p className="sub">Importe (CSV V3 36 col, export JET 81 col, jetms TMS, texte, ou PDF/image via IA) → édite → exporte un CSV V3 <b>parfait</b>. Add-ons préservés, conflits de groupes corrigés à l'export, gros menus gérés (catégories repliables).</p>
        </header>

        <div className="card">
          <span className="label">Importer</span>
          <textarea className="field field-mono" placeholder="Colle ici: CSV V3 (36 col), export JET (81 col), export jetms ( [sortid;...]# ), ou un menu en texte…" value={raw} onChange={(e) => setRaw(e.target.value)} />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn btn-primary" onClick={doImport} disabled={busy}>Importer le texte</button>
            <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>Ajouter des fichiers (.csv/.txt/PDF/image)</button>
            <input ref={fileRef} type="file" multiple accept=".csv,.txt,.tsv,application/pdf,image/*,.docx" style={{ display: "none" }} onChange={onFile} />
            <button className="btn" onClick={() => { setMenu([]); setRaw(""); setMsg(""); setExpanded(new Set()); }}>Vider</button>
            {msg && <span className="muted tiny">{msg}</span>}
          </div>
        </div>

        {issues.length > 0 && (
          <div className="card">
            <span className="label">Validation ({issues.length})</span>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {issues.slice(0, 20).map((i, k) => (
                <li key={k} className={i.level === "error" ? "issue-e" : "issue-w"}>{i.level === "error" ? "✖ " : "⚠ "}{i.msg}</li>
              ))}
              {issues.length > 20 && <li className="muted tiny">… +{issues.length - 20} autres</li>}
            </ul>
          </div>
        )}

        {menu.length > 0 && (
          <div className="row" style={{ margin: "12px 0 4px" }}>
            <span className="muted tiny">{cats.length} catégorie(s)</span>
            <div style={{ flex: 1 }} />
            <button className="btn btn-sm" onClick={expandAll}>Tout déplier</button>
            <button className="btn btn-sm" onClick={collapseAll}>Tout replier</button>
          </div>
        )}

        {cats.map(({ name: cat, items }) => {
          const open = expanded.has(cat);
          const showAll = showAllIn.has(cat);
          const shown = open ? (showAll ? items : items.slice(0, CAT_RENDER_CAP)) : [];
          return (
          <div className="cat" key={cat}>
            <div className="cat-h">
              <button className="btn btn-sm" style={{ minWidth: 30 }} onClick={() => toggle(cat)}>{open ? "▾" : "▸"}</button>
              <input className="field" style={{ fontWeight: 700, maxWidth: 320 }} value={cat}
                onChange={(e) => { const nv = e.target.value; setMenu((m) => m.map((it) => it.category === cat ? { ...it, category: nv } : it)); }} />
              <span className="muted tiny">{items.length} items</span>
              <div style={{ flex: 1 }} />
              <button className="btn btn-sm" onClick={() => { setMenu((m) => [...m, { id: uid(), category: cat, name: "Nouvel item", description: "", priceDelivery: 0, pricePickup: 0, groups: [] }]); setExpanded((s) => new Set(s).add(cat)); }}>+ item</button>
              <button className="btn btn-sm btn-danger" onClick={() => { if (confirm(`Supprimer la catégorie «${cat}» (${items.length} items) ?`)) setMenu((m) => m.filter((i) => i.category !== cat)); }}>suppr. cat.</button>
            </div>
            {shown.map(({ it, i }) => (
              <div className="item" key={it.id || i}>
                <div className="grid" style={{ gridTemplateColumns: "2fr 90px 90px auto", alignItems: "end" }}>
                  <div><span className="label">Nom</span><input className="field" value={it.name} onChange={(e) => up(i, { name: e.target.value })} /></div>
                  <div><span className="label">Prix livr.</span><input className="field field-mono" value={it.priceDelivery} onChange={(e) => up(i, { priceDelivery: parseFloat(e.target.value.replace(",", ".")) || 0 })} /></div>
                  <div><span className="label">Prix retrait</span><input className="field field-mono" value={it.pricePickup} onChange={(e) => up(i, { pricePickup: parseFloat(e.target.value.replace(",", ".")) || 0 })} /></div>
                  <div className="row">
                    <button className="btn btn-sm" onClick={() => setMenu((m) => { const c = { ...m[i], id: uid(), name: m[i].name + " (copie)" }; const a = [...m]; a.splice(i + 1, 0, c); return a; })}>dupliquer</button>
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
                    <div className="muted tiny" style={{ marginTop: 4 }}>Astuce: min/max dans le nom — <span className="kbd">(obligatoire, 1 à 2)</span>. Même nom de groupe ⇒ options identiques (sinon renommé auto à l'export).</div>
                  </div>
                ))}
                <div style={{ marginTop: 8 }}>
                  <button className="btn btn-sm" onClick={() => up(i, { groups: [...(it.groups || []), { name: "Suppléments (facultatif)", options: [{ name: "", price: 0 }] }] })}>+ groupe d'options</button>
                </div>
              </div>
            ))}
            {open && !showAll && items.length > CAT_RENDER_CAP && (
              <button className="btn btn-sm" style={{ margin: 8 }} onClick={() => setShowAllIn((s) => new Set(s).add(cat))}>
                Afficher les {items.length - CAT_RENDER_CAP} items restants
              </button>
            )}
          </div>
          );
        })}

        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn" onClick={() => { const n = prompt("Nom de la catégorie:"); if (n) { setMenu((m) => [...m, { id: uid(), category: n, name: "Nouvel item", description: "", priceDelivery: 0, pricePickup: 0, groups: [] }]); setExpanded((s) => new Set(s).add(n)); } }}>+ Nouvelle catégorie</button>
          {menu.length > 0 && <button className="btn btn-primary" onClick={exportCSV}>Exporter CSV V3</button>}
        </div>

        <p className="muted tiny" style={{ marginTop: 24 }}>CSV V3 : 36 colonnes · UTF-8 sans BOM · CRLF · quoting minimal · Product Type ∈ {"{ ITEM · Option-Group · Option }"}. Import: CSV V3, export JET 81 col, jetms TMS, texte. Auto à l'export: groupes de même nom rendus uniques si options différentes (règle JET).</p>
      </div>
    </main>
  );
}
