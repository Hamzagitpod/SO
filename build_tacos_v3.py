import csv, io
OUT="/home/user/SO/Tacos_Menu_V3_FINAL.csv"
HEADER="GTIN,Product Type,Category,Product Name,Image URL,Description,Regular Price,Pickup Price,SKU,isAlcohol,ABV(%),Caffeine Quantity,Caffeine reference unit,Net Value,Net Unit,Net Quantity,Gross weight,Gross Unit,Size Description,Energy Content,Serving Size,Tax,Quantity Restriction,Product Types,Deposit Type,Deposit Amount,Allergen information,Additive information,Additional information,Quantitative declaration of ingredients (QUID),Nutritional declaration,Name of manufacturer,Address of manufacturer,Country of origin or place of provenance,Storage conditions,Preparation instructions".split(",")
NC=len(HEADER); assert NC==36
I_TYPE,I_CAT,I_NAME,I_DESC,I_RP,I_PP=1,2,3,5,6,7

def money(x): return ("%g"%float(x))

# ---- shared option sets (name, supplement price) ----
SAUCES=[("Algérienne",0),("Andalouse",0),("Barbecue",0),("Samouraï",0),("Ketchup",0),("Mayonnaise",0),("Brasil",0)]
VIANDE_TACOS=[("Cordon Bleu de Poulet",0),("Viande de Bœuf",0),("Merguez de Bœuf",0),("Poulet Mariné",0),("Nuggets de Poulet",5.99),("Onion Rings",0),("Tenders Croustillants",1.00),("Falafel",0)]
VIANDE_BOWL=[("Poulet Nature/Mariné",0),("Cordon Bleu de Poulet",0),("Viande de Bœuf",0),("Merguez de Bœuf",0),("Nuggets de Poulet",5.99),("Onion Rings",0),("Tenders Croustillants",1.00),("Falafel",0)]
FRITE=[("Avec Frite",0),("Sans Frite",0)]
SAUCE_FROM=[("Supplément",1.00),("Sans",0)]
CHEESE1=[("Mozzarella",1.50),("Oignons & Mozzarella",2.50),("Cheddar",1.50),("Oignons & Cheddar",2.50),("Raclette",1.50),("Oignons & Raclette",2.50)]
CHEESE2=[("Vache Qui Rit",1.50),("Gouda",1.50),("Oignons & Gouda",2.50),("Mozzarella",1.50),("Oignons & Mozzarella",2.50),("Cheddar",1.50),("Oignons & Cheddar",2.50),("Raclette",1.50),("Oignons & Raclette",2.50)]
BOISSON=[("Fanta Orange",2.50),("Fanta Exotic",2.50),("Fanta Citron",2.50),("Schweppes Agrumes",2.50),("Coca-Cola Zéro",2.50),("Coca-Cola",2.50),("Pepsi",2.50),("Sprite",2.50),("Lipton Ice Tea Pétillant",2.50),("Lipton Ice Tea Pêche",2.50),("Eau Christaline",2.50),("Red Bull 25cl",3.99)]
SNACKS_SUPP=[("Wings",5.99),("Nuggets",5.99),("Frites Normal",2.99),("Frites Sauce Fromagère",3.99),("Tenders",6.99)]
RIZFRITES=[("Riz",0),("Frites",0)]

# group name -> options.  Name encodes the min/max rule. Same name => identical options (V3 rule).
G={
 "Sauce (obligatoire, 1 à 2)":SAUCES,
 "Viande (obligatoire, 1)":VIANDE_TACOS,
 "Viande (obligatoire, 1 à 2)":VIANDE_TACOS,
 "Viande (obligatoire, 1 à 3)":VIANDE_TACOS,
 "Viande (obligatoire, 1 à 4)":VIANDE_TACOS,
 "Frite (obligatoire, 1)":FRITE,
 "Sauce fromagère (obligatoire, 1)":SAUCE_FROM,
 "Supplément fromage (facultatif, max 1)":CHEESE1,
 "Supplément fromage 2 (facultatif, max 1)":CHEESE2,
 "Boisson (facultatif, max 3)":BOISSON,
 "Supplément snacks (facultatif, max 3)":SNACKS_SUPP,
 "Viande bowl (obligatoire, 1)":VIANDE_BOWL,
 "Viande bowl (obligatoire, 2)":VIANDE_BOWL,
 "Riz ou Frites (obligatoire, 1)":RIZFRITES,
}
TACOS_COMMON=lambda viande:["Sauce (obligatoire, 1 à 2)",viande,"Frite (obligatoire, 1)","Sauce fromagère (obligatoire, 1)","Supplément fromage (facultatif, max 1)","Supplément fromage 2 (facultatif, max 1)","Boisson (facultatif, max 3)","Supplément snacks (facultatif, max 3)"]

# ---- menu: (category, name, price, description, [group names]) ----
MENU=[
 ("Tacos","Mos Tacos - M",7.99,"Bases garnies de frites et sauce fromagère mos tacos",TACOS_COMMON("Viande (obligatoire, 1)")),
 ("Tacos","Mos Tacos - L",9.99,"Bases garnies de frites et sauce fromagère mos tacos",TACOS_COMMON("Viande (obligatoire, 1 à 2)")),
 ("Tacos","Tacos XL",13.99,"",TACOS_COMMON("Viande (obligatoire, 1 à 3)")),
 ("Tacos","Tacos XXL",15.99,"",TACOS_COMMON("Viande (obligatoire, 1 à 4)")),
 ("Bowls","Bowls Taille M",9.99,"1 viande",["Sauce (obligatoire, 1 à 2)","Viande bowl (obligatoire, 1)","Frite (obligatoire, 1)","Sauce fromagère (obligatoire, 1)","Supplément fromage (facultatif, max 1)","Supplément fromage 2 (facultatif, max 1)","Boisson (facultatif, max 3)","Supplément snacks (facultatif, max 3)"]),
 ("Bowls","Bowls Taille L",10.99,"2 viandes",["Sauce (obligatoire, 1 à 2)","Viande bowl (obligatoire, 2)","Frite (obligatoire, 1)","Sauce fromagère (obligatoire, 1)","Supplément fromage (facultatif, max 1)","Supplément fromage 2 (facultatif, max 1)","Boisson (facultatif, max 3)","Supplément snacks (facultatif, max 3)"]),
 ("Poulet","Poulet mariné",13.99,"Avec riz ou frites au choix",["Riz ou Frites (obligatoire, 1)"]),
 ("Poulet","Complet poulet mariné",18.99,"Avec riz ou frites au choix",["Riz ou Frites (obligatoire, 1)"]),
 ("Snacks","Chicken Box",12.99,"3 tenders, 4 wings, 5 nuggets, frites, sauce au choix",["Boisson (facultatif, max 3)"]),
 ("Snacks","Tenders",6.99,"3 tenders",["Boisson (facultatif, max 3)"]),
 ("Snacks","Wings",5.99,"",["Boisson (facultatif, max 3)"]),
 ("Snacks","Nuggets",5.99,"5 nuggets",["Boisson (facultatif, max 3)"]),
 ("Snacks","Frites Normal",2.99,"",[]),
 ("Snacks","Frites Sauce Fromagère",3.99,"",[]),
 ("Petit Plus","Riz au thon",6.99,"Riz au thon, oignons séchés, vinaigrette fines herbes",[]),
 ("Petit Plus","Oignons Rings",4.99,"5 x oignons rings",[]),
 ("Desserts","Tiramisu Spéculoos",3.50,"",[]),
 ("Desserts","Tiramisu Oréo",3.50,"",[]),
 ("Desserts","Tiramisu Kinder Bueno",3.50,"",[]),
 ("Desserts","Mouhalabieh Pistaches",2.00,"",[]),
]
BOISSONS_SIMPLES=[("Coca-Cola 33cl",2.50),("Coca-Cola Zéro 33cl",2.50),("Coca-Cola 1,5L",4.00),("Coca-Cola Zéro 1,5L",4.00),
 ("Pepsi 33cl",2.50),("Fanta 33cl",2.50),("Fanta Exotic 33cl",2.50),("Fanta Citron 33cl",2.50),("Fanta 1,5L",4.00),
 ("Sprite 33cl",2.50),("Sprite 1,5L",4.00),("Schweppes Agrumes",2.50),("Lipton Ice Tea Pêche",2.50),("Lipton Ice Tea Pétillant",2.50),
 ("Red Bull 25cl",3.99),("Ayran (lait fermenté)",1.99),("Eau Plate Spa 50cl",2.50),("Eau Plate Spa 1,5L",3.00),
 ("Eau Pétillante Spa 50cl",2.50),("Eau Plate Christaline 50cl",2.00),("Eau Plate Christaline 1,5L",2.50)]
for n,p in BOISSONS_SIMPLES: MENU.append(("Boissons",n,p,"",[]))

def blank(): return [""]*NC
def item_row(cat,name,price,desc):
    r=blank(); r[I_TYPE]="ITEM"; r[I_CAT]=cat; r[I_NAME]=name; r[I_DESC]=desc; r[I_RP]=money(price); r[I_PP]=money(price); return r
def og_row(cat,gname):
    r=blank(); r[I_TYPE]="Option-Group"; r[I_CAT]=cat; r[I_NAME]=gname; return r
def opt_row(cat,oname,price):
    r=blank(); r[I_TYPE]="Option"; r[I_CAT]=cat; r[I_NAME]=oname; r[I_RP]=money(price); r[I_PP]=money(price); return r

rows=[HEADER]; ni=nog=nopt=0
for cat,name,price,desc,groups in MENU:
    rows.append(item_row(cat,name,price,desc)); ni+=1
    for gname in groups:
        rows.append(og_row(cat,gname)); nog+=1
        for oname,oprice in G[gname]:
            rows.append(opt_row(cat,oname,oprice)); nopt+=1

buf=io.StringIO()
w=csv.writer(buf,quoting=csv.QUOTE_MINIMAL,lineterminator='\r\n')
for r in rows: w.writerow(r)
open(OUT,'w',encoding='utf-8',newline='').write(buf.getvalue())
print("WROTE",OUT,"| items=%d option-groups=%d options=%d rows=%d"%(ni,nog,nopt,len(rows)-1))
