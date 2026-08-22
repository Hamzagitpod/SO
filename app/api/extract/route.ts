import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYS = `Tu es un expert en extraction de menus de restaurant.
À partir du fichier (image ou PDF) fourni, renvoie UNIQUEMENT un JSON pur, un tableau d'objets "item".
Chaque item: {"category": string, "name": string, "description": string,
"priceDelivery": number, "pricePickup": number, "isAlcohol": boolean, "abv": number|null,
"groups": [{"name": string, "options": [{"name": string, "price": number}]}]}.
Règles:
- category = la section du menu (ex: "Pizzas", "Desserts", "Boissons").
- priceDelivery = pricePickup = prix affiché si un seul prix.
- Les variantes de produits distinctes (parfums/tailles vendus séparément) = items séparés, PAS un seul item.
- Les suppléments / accompagnements / choix de sauce = un "group" d'options sur l'item, pas des items.
- Mets le min/max dans le NOM du groupe: "(obligatoire, 1 à 2)", "(facultatif, max 3)".
- isAlcohol=true + abv pour bières/vins/spiritueux.
- price = nombre (ex 12.5). Pas de symbole.
Réponds par le JSON brut uniquement.`;

export async function POST(req: NextRequest) {
  try {
    const key = req.headers.get("x-gemini-key") || "";
    const model = req.headers.get("x-gemini-model") || "gemini-2.0-flash";
    if (!key) return NextResponse.json({ error: "Clé Gemini manquante (Réglages)." }, { status: 400 });
    const { fileBase64, mimeType, text } = await req.json();

    const parts: any[] = [{ text: SYS }];
    if (fileBase64) parts.push({ inline_data: { mime_type: mimeType || "image/png", data: fileBase64 } });
    if (text) parts.push({ text: "Menu (texte):\n" + text });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json", temperature: 0 } }),
    });
    const data = await r.json();
    if (!r.ok) return NextResponse.json({ error: "Gemini: " + (data?.error?.message || r.status) }, { status: 502 });

    let txt: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "";
    txt = txt.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
    let menu: any;
    try { menu = JSON.parse(txt); } catch { return NextResponse.json({ error: "JSON IA invalide." }, { status: 502 }); }
    if (!Array.isArray(menu) && Array.isArray(menu?.items)) menu = menu.items;
    if (!Array.isArray(menu)) return NextResponse.json({ error: "Format IA inattendu." }, { status: 502 });

    const clean = menu.map((it: any) => ({
      category: String(it.category || "Menu"),
      name: String(it.name || "").trim(),
      description: String(it.description || ""),
      priceDelivery: Number(it.priceDelivery ?? it.price ?? 0) || 0,
      pricePickup: Number(it.pricePickup ?? it.priceDelivery ?? it.price ?? 0) || 0,
      isAlcohol: !!it.isAlcohol,
      abv: it.abv === null || it.abv === undefined ? null : Number(it.abv),
      groups: Array.isArray(it.groups) ? it.groups.map((g: any) => ({
        name: String(g.name || "Options"),
        options: Array.isArray(g.options) ? g.options.map((o: any) => ({ name: String(o.name || ""), price: Number(o.price) || 0 })) : [],
      })) : [],
    })).filter((it: any) => it.name);

    return NextResponse.json({ menu: clean });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erreur serveur" }, { status: 500 });
  }
}
