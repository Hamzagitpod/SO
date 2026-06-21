# Lookbook Render — capture frame-par-frame → MP4 H.264

Capture l'animation **Lookbook CCM × Orion** image par image avec Playwright,
puis assemble les frames en un **MP4 H.264** de qualité maximale avec FFmpeg.

La capture est **synchronisée sur la timeline de l'animation**, pas sur le temps
réel : aucune frame n'est manquée ni dupliquée, quel que soit le temps que prend
chaque capture d'écran. Le résultat est une **boucle parfaite**.

## Comment ça marche

L'animation du lookbook est pilotée par `requestAnimationFrame` + `performance.now()`
(chaque visuel est une fonction pure d'une horloge interne `elapsed`). Le script
injecte une **horloge virtuelle** *avant* l'exécution des scripts de la page :
`performance.now()` et `requestAnimationFrame` sont remplacés pour que l'animation
n'avance **que** lorsqu'on la fait avancer — d'exactement `1/fps` par frame capturée.

Séquence par frame `i` :

1. `__vc.tick(i * 1000/fps)` → place la timeline pile sur la frame `i` ;
2. `page.screenshot()` → capture cette frame exacte ;
3. le PNG est envoyé directement dans `stdin` de FFmpeg (aucun fichier temporaire).

Le script détecte aussi automatiquement la **durée** de la boucle (`this.TOTAL`,
soit 43,6 s) et la **résolution native** (1920×1080), attend le chargement complet
des polices et des images, et masque le bouton `❚❚ PAUSE`.

## Prérequis

- **Node.js** 18+
- **Playwright** + Chromium : `npm install && npx playwright install chromium`
- **FFmpeg** compilé avec **libx264** (`ffmpeg -encoders | grep libx264`)
  - Ubuntu/Debian : `sudo apt-get install -y ffmpeg`
  - macOS : `brew install ffmpeg`

## Installation

```bash
cd tools/lookbook-render
npm install
npx playwright install chromium
```

## Utilisation

```bash
# Rendu natif 1920x1080 @ 60fps, CRF 18, yuv420p (valeurs par défaut)
node capture-lookbook.cjs /chemin/vers/Lookbook_CCM_x_Orion.html

# Sortie personnalisée
OUT=ccm-orion.mp4 node capture-lookbook.cjs ./Lookbook.html
```

## Options (variables d'environnement)

| Variable        | Défaut             | Description                                            |
|-----------------|--------------------|-------------------------------------------------------|
| `LOOKBOOK_HTML` | (1er argument CLI) | Chemin du fichier HTML                                 |
| `OUT`           | `./lookbook.mp4`   | Fichier MP4 de sortie                                  |
| `FPS`           | `60`               | Images par seconde                                     |
| `WIDTH`         | `1920`             | Largeur de sortie                                      |
| `HEIGHT`        | `1080`             | Hauteur de sortie                                      |
| `SCALE`         | `1`                | `deviceScaleFactor` (mettre `2` pour suréchantillonner) |
| `DURATION`      | auto (43.6)        | Durée à capturer, en secondes                          |
| `CRF`           | `18`               | Qualité x264 (0 = sans perte, 18 ≈ visuellement parfait) |
| `PRESET`        | `slow`             | Preset x264 (`veryslow` pour la compression maximale)  |
| `SHOW_CONTROLS` | (masqué)           | `1` pour garder les overlays `❚❚ PAUSE` / `▯ 9:16`     |
| `FORCE_FORMAT`  | (aucun)            | `9:16` ou `16:9` — force la mise en page (voir ci-dessous) |
| `FFMPEG`        | `ffmpeg`           | Chemin du binaire ffmpeg                               |
| `VENDOR_DIR`    | (désactivé)        | Dossier de dépendances CDN locales (rendu hors-ligne)  |

## Rendu hors-ligne (CDN bloqué)

Le lookbook charge **React, ReactDOM et Babel depuis `unpkg.com`** au runtime. Si
ce CDN est inaccessible (réseau restreint, build reproductible), récupérez ces
fichiers depuis npm puis pointez `VENDOR_DIR` dessus — le script intercepte les
requêtes CDN et les sert localement :

```bash
# 1) Récupérer les dépendances depuis le registre npm
mkdir -p vendor && cd vendor && npm init -y >/dev/null
npm install react@18.3.1 react-dom@18.3.1 @babel/standalone@7.26.4
cp node_modules/react/umd/react.production.min.js \
   node_modules/react-dom/umd/react-dom.production.min.js \
   node_modules/@babel/standalone/babel.min.js .
cd ..

# 2) Lancer le rendu hors-ligne
VENDOR_DIR=./vendor node capture-lookbook.cjs ./Lookbook.html
```

### Exemples

```bash
# Qualité maximale, suréchantillonnage x2 puis downscale Lanczos -> 1080p net
SCALE=2 PRESET=veryslow node capture-lookbook.cjs ./Lookbook.html

# Format vertical 9:16 — vrai re-layout (1080x1920 auto)
FORCE_FORMAT=9:16 node capture-lookbook.cjs ./Lookbook.html

# Master sans perte (CRF 0) pour archivage / réencodage ultérieur
CRF=0 OUT=master.mp4 node capture-lookbook.cjs ./Lookbook.html
```

## Format 9:16 (vertical) vs 16:9

Le composant choisit sa mise en page via `this.props.format`. Mais dans l'export
« standalone », le runtime expose chaque prop sous la forme de son **objet
descripteur** (`{editor, options, default, …}`) et non de sa valeur : `this.props.format`
n'est donc jamais la chaîne `'9:16'`, et la mise en page **retombe toujours sur 16:9**
(le `"default":"9:16"` du fichier n'est qu'un indice d'éditeur).

`FORCE_FORMAT=9:16` corrige cela : le script charge une copie patchée du HTML où
l'expression `this.props.format || '16:9'` est remplacée par `'9:16'`, ce qui déclenche
le vrai `reflowVertical()` du composant (image plein cadre en haut, titres en bas) et
fixe automatiquement la résolution native **1080×1920**. Le fichier d'origine n'est
jamais modifié. Utilisez `FORCE_FORMAT=16:9` pour forcer l'inverse.
