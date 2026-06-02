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
