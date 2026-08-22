# Logique de conversion menu → CSV V3 (Takeaway / Just Eat Menu Builder)

Règles **retenues** depuis le 1ᵉʳ import réussi. À appliquer à TOUT nouveau menu.

## Format binaire (obligatoire)
- **36 colonnes**, en-tête exact :
  `GTIN,Product Type,Category,Product Name,Image URL,Description,Regular Price,Pickup Price,SKU,isAlcohol,ABV(%),Caffeine Quantity,Caffeine reference unit,Net Value,Net Unit,Net Quantity,Gross weight,Gross Unit,Size Description,Energy Content,Serving Size,Tax,Quantity Restriction,Product Types,Deposit Type,Deposit Amount,Allergen information,Additive information,Additional information,Quantitative declaration of ingredients (QUID),Nutritional declaration,Name of manufacturer,Address of manufacturer,Country of origin or place of provenance,Storage conditions,Preparation instructions`
- **UTF-8 SANS BOM**, fins de ligne **CRLF**, quoting **minimal** (uniquement les champs contenant `,`).
- Prix en nombre simple (`2.5`, `12`, `4`) — pas de symbole, pas de zéros inutiles.

## Structure add-ons
- Colonne `Product Type` ∈ {`ITEM`, `Option-Group`, `Option`}.
- **Ordre des lignes = liaison** : un `ITEM`, puis ses `Option-Group` (chacun suivi de ses `Option`), puis l'item suivant.
- Les groupes partagés sont **répétés** sous chaque item qui les utilise (options identiques).

## Règles de cohérence (sinon erreurs d'import)
- **Incohérence d'options** : un même *nom de groupe* doit avoir des **options identiques partout**. Si le max ou les options changent → **nom de groupe unique** (ex. `Viande (1 à 2)` vs `Viande (1 à 3)`).
- **min/max** encodés dans le **nom du groupe** (pas de colonne dédiée) : `(obligatoire, 1 à 2)`, `(obligatoire, 1)`, `(facultatif, max 1)`, `(facultatif, max 3)`…

## Logique produits vs options (« logique pure »)
- **Produits distincts vendus séparément = items séparés** — surtout les variantes de boissons.
  Ex. `Coca` / `Coca Zéro`, `Ice-Tea pétillant` / `pêche` / `Green`, `Eau plate` / `pétillante`, `Looza pomme/orange/cerise`. **Jamais** une ligne « X ou Y » en un seul item.
- **Suppléments / accompagnements / choix de condiment = Option-Group** avec options séparées.
  Ex. « Gouda, biscuit ou cacahuètes » = suppléments (3 options), pas un produit. Hamburger « sauce au choix » = groupe Sauce.

## Alcool
- `isAlcohol=TRUE` + `ABV(%)` pour bières et vins.
- Respecter les consignes de suppression (ex. retirer alcools forts : cocktails, whisky, bouteilles spiritueux).

## Validation avant livraison
En-tête exact · toutes lignes 36 col · 0 doublon d'item · 0 nom de groupe incohérent · 0 option orpheline · BOM/CRLF/quoting conformes.

---

## Deux formats à ne pas confondre (appris sur Sushi Shop, 03/06/2026)
- **Livrable / import partenaire = 36 colonnes** « Menu Builder V3 » (ci-dessus). C'est CE format qu'on importe dans JET.
- **Base / export JET brut = 81 colonnes** dénormalisé : en-tête `"Category Name","Category ID",…,"Item Name","Item ID",…,"OptionGroup Name","OptionGroup ID","Minimum","Maximum Total","Maximum Each","Option Name","Option ID",…`. Une catégorie/item répétés sur chaque ligne, **une option par ligne**, groupes distingués par **ID** (pas par nom). Prix en `$X.XX`.
- **Workflow type** : on reçoit la **base 81-col** (qui contient TOUS les add-ons) + un **sheet de modifications** → on sort le **36-col en conservant TOUS les add-ons**. Le site `lib/v3.ts` sait importer les deux (`parse81` / `parseV3`).

## Sheet de modifications (format client)
- Colonnes : `A=MODIFICATION` (`Modifier`/`Ajouter`/vide), `B=NOTES` (`MODIFIER PRIX`…), `C=section` (titre catégorie 🍱), `D=NOM`, `E=CATEGORIE`, `F=COMPOSITION`, `G=prix TTC`, `H=ID`.
- **Tout ce qu'il faut est en colonnes A et B** : A dit l'action (modifier/ajouter), B signale les changements de prix. Vide = inchangé (référence).
- Matching base↔sheet : **contraint par catégorie** + overrides explicites (le fuzzy seul fait des erreurs graves : ex. « Cali. Salmon Aburi » ≠ « Poke bowl salmon aburi »). Toujours vérifier les renames cross-catégories.

## ⚠️ Add-ons : NE JAMAIS les perdre
- Quand on part de la base 81-col, **chaque item garde ses option-groups** (Choix sauce, Voulez-vous des baguettes ?, Choix supplément, accompagnements, suppléments poke…). Une conversion qui ne ramène que les items = livrable cassé (cas réel : 46 groupes au lieu de 209).
- Vérif rapide : nombre de `Option-Group` du livrable ≈ celui de la base.

## Erreur JET « Incohérence de l'ensemble d'options » (bloque l'import)
- Message exact : *« Incohérence de l'ensemble d'options. Assurez-vous que les options sont identiques ou utilisez un nom de groupe unique »*.
- Cause : en 36-col, les groupes ne sont identifiés que par **nom** ; deux items avec un groupe de **même nom mais options différentes** → rejet.
- Exemples réels : `Choix quantité` yakitori (x2/x3/x5) vs gyoza (x3/x5/x8) ; `Choix sauce` rolls (sucrée/salée) vs poke (Ponzu/Teriyaki…) ; `Choix extra gratuit` standard vs Box for Two (avec baguettes).
- **Fix automatique** (`dedupeGroupNames` dans `lib/v3.ts`, appelé par `serialize`) : on garde la signature dominante avec le nom d'origine, les variantes prennent un suffixe distinctif (`Choix quantité (x2)`, `Choix sauce (Ponzu)`). À refaire pour tout futur menu.

## Gros menus (équipe VIP — Sushi Shop, grocery à venir)
- Les menus VIP sont **gros** (Sushi Shop = 138 items / 209 groupes / 631 options) et il y aura du **grocery très volumineux**.
- Le site gère : import 81-col, **catégories repliables** (on ne rend pas 1000 inputs d'un coup), cap de rendu par catégorie, ids stables. Pour du grocery 1000s+ items, prévoir virtualisation si besoin.
