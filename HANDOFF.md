# HANDOFF — Reprise sur PC perso → déploiement Vercel

> But : déployer le site reconstruit **Menu Builder V3** sur le projet Vercel
> **ccm-menu-builder** (https://ccm-menu-builder.vercel.app).
> Le sandbox cloud bloquait le réseau Vercel (`Host not in allowlist`) ; ce PC a l'accès complet.
> **Tout est committé + poussé, `next build` vérifié ✓ (aucune erreur).**

## Où est le code
- Repo : **Hamzagitpod/SO**
- Branche : **`claude/compassionate-keller-xjEzI`**
- Projet Vercel déjà lié via `.vercel/project.json` :
  - projectId : `prj_y8WnsLPMH2LvCj0Lxwhu7mB3vjUW`
  - orgId (team) : `team_cud61CilcVtepsIfVoZMBaAa`
  - → `vercel --prod` cible automatiquement **ccm-menu-builder**.

## Déployer (terminal sur ce PC)
```bash
# récupérer la branche
git fetch origin
git checkout claude/compassionate-keller-xjEzI
git pull

# build + déploiement
npm install
npx next build            # doit afficher "✓ Compiled successfully"
vercel --prod             # déploie sur ccm-menu-builder.vercel.app
# si demande l'auth : `vercel login` puis relancer `vercel --prod`
```

## (Optionnel) auto-deploy permanent — plus rien à faire ensuite
Vercel → projet **ccm-menu-builder** → **Settings → Git → Connect** le repo `Hamzagitpod/SO`,
branche `claude/compassionate-keller-xjEzI`. Ensuite chaque `git push` redéploie tout seul.

## Contenu = avancement du jour
| Élément | Rôle |
|---|---|
| `app/` (`page.tsx`, `layout.tsx`, `settings/`, `api/extract/route.ts`) | Le site Next.js (éditeur + import + export + extraction IA Gemini optionnelle) |
| `lib/v3.ts` | **Moteur** : parse (TMS jetms / CSV V3 / texte) → modèle → export **CSV V3 36 colonnes parfait** (CRLF, sans BOM, quoting minimal) + validation (incohérence d'options, doublons…) |
| `V3_LOGIC.md` | Toutes les règles de conversion retenues (à respecter) |
| `samples/` | Menus déjà générés et validés : Sushi Shop, Tacos, Pâtes, Saint Laurent, Signore Pizza |
| `build_*.py` | Générateurs déterministes (référence/preuve de chaque menu) |
| `legacy/` | Ancien convertisseur TMS (archivé, non déployé) |

## Détails techniques
- Framework : Next.js 14.2.x (app router). Node 24.x (déjà réglé sur le projet Vercel).
- L'export CSV V3 est **100 % déterministe côté client** (pas de dépendance à l'IA).
- L'extraction IA (PDF/image → menu) est **optionnelle** : clé Gemini saisie dans `/settings`, stockée dans le navigateur, envoyée en header `x-gemini-key` à `/api/extract`. Le site fonctionne sans clé.

## Connecteur jetms (déjà authentifié dans la session cloud)
Le MCP `jetms` expose `import_menu_csv_v3`, `validate_menu_csv_v3`, `list_menu_v3_headers`, etc.
→ permet d'importer/valider un menu **directement** dans le JET Menu Builder, sans passer par le site.
NB : la version officielle jetms du CSV a **24 en-têtes** (`item_id, item_sku, item_gtin, item_name, …`)
≠ format **36 colonnes** "Menu Builder V3" (celui qui s'importe côté partenaire). À confirmer selon la cible exacte avant un import live.
