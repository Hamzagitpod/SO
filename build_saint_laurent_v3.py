import csv, io
OUT="/home/user/SO/Saint_Laurent_Menu_V3_FINAL.csv"
HEADER="GTIN,Product Type,Category,Product Name,Image URL,Description,Regular Price,Pickup Price,SKU,isAlcohol,ABV(%),Caffeine Quantity,Caffeine reference unit,Net Value,Net Unit,Net Quantity,Gross weight,Gross Unit,Size Description,Energy Content,Serving Size,Tax,Quantity Restriction,Product Types,Deposit Type,Deposit Amount,Allergen information,Additive information,Additional information,Quantitative declaration of ingredients (QUID),Nutritional declaration,Name of manufacturer,Address of manufacturer,Country of origin or place of provenance,Storage conditions,Preparation instructions".split(",")
NC=len(HEADER); assert NC==36
def money(x): return ("%g"%float(x))
def blank(): return [""]*NC
def item(cat,name,price,desc="",alc=False,abv=None,groups=None):
    r=blank(); r[1]="ITEM"; r[2]=cat; r[3]=name; r[5]=desc; r[6]=money(price); r[7]=money(price)
    if alc: r[9]="TRUE"
    if abv is not None: r[10]=money(abv)
    return (r,groups or [])
def og(cat,g):
    r=blank(); r[1]="Option-Group"; r[2]=cat; r[3]=g; return r
def opt(cat,n,p):
    r=blank(); r[1]="Option"; r[2]=cat; r[3]=n; r[6]=money(p); r[7]=money(p); return r

GROUPS={
 "Sauce (obligatoire, 1)":[("Andalouse",0),("Mayo",0),("Ketchup",0)],
 "Parfum Looza (obligatoire, 1)":[("Pomme",0),("Orange",0),("Cerise",0)],
}

DB=[]  # (item_row, [group names])
# --- PLATS 12 € ---
for n in ["Pâtes bolognaise","Pâtes 4 fromages","Boulette sauce tomate"]:
    DB.append(item("Plats",n,12))
DB.append(item("Plats","Hamburger frites",12,"Sauce au choix",groups=["Sauce (obligatoire, 1)"]))
# --- SALADES 9 € (avec demi-baguette) ---
for n in ["Thon pêche","Saumon","Américain","Crevette Rose","Tomate crevette","César","Asperge Jambon","Végétarien"]:
    DB.append(item("Salades",n,9,"Avec demi-baguette"))
# --- PETITE FAIM ---
DB.append(item("Petite Faim","Portion de fromage",4))
DB.append(item("Petite Faim","Assiette mixte",8))        # prix lu sous reflet -> à vérifier
DB.append(item("Petite Faim","Assiette brochette",10))   # prix lu sous reflet -> à vérifier
DB.append(item("Petite Faim","Gouda, biscuit ou cacahuètes",1.5))
# --- SNACKS ---
for n,p in [("Kinder Bueno",3),("Snickers",1.5),("Mentos",1.7),("M&M's",2.7),("Chips",2),("Frutella",1.8)]:
    DB.append(item("Snacks",n,p))
# --- SOFT ---
for n,p in [("Coca, coca zéro",2.5),("Sprite",2.5),("Fanta",2.5),("Ice-Tea pétillant, pêche ou Green",2.6),
            ("Shweppes tonic ou agrumes",2.7),("Shweppes Hibiscus",3.1),("Gini",2.6),("Oasis",2.8),
            ("Redbull",3.5),("Cécémel froid",3.1),("Eau plate ou pétillante",2.1)]:
    DB.append(item("Soft",n,p))
DB.append(item("Soft","Looza",2.8,groups=["Parfum Looza (obligatoire, 1)"]))
# --- BIÈRES (alcool, ABV best-effort; None = à confirmer) ---
BIERES=[("Jupiler 25cl",2.5,5.2),("Jupiler 33cl",3.0,5.2),("Jupiler 50cl",3.4,5.2),
 ("Leffe blonde 25cl",3.4,6.6),("Leffe blonde 33cl",4.0,6.6),("Scootch cts 25cl",3.5,None),("Scootch cts 33cl",4.3,None),
 ("Kriek belle vue",3.1,5.2),("Kriek",3.5,5.0),("Carlsberg",3.2,5.0),("Chimay Bleue",4.8,9.0),("Chimay dorée",4.1,4.8),
 ("Chimay triple",4.5,8.0),("Desperados",4.2,5.9),("Duvel",4.2,8.5),("Hoegaarden blanche",3.0,4.9),("Hoegaarden rosée",3.0,3.0),
 ("Jupiler 0%",2.5,0.0),("Triple Karmeliet",4.5,8.4),("Fram'bush",4.2,None),("Leffe brune",4.0,6.5),("Leffe Ruby",4.0,5.0),
 ("Orval",4.5,6.2),("Peche mel bush",4.2,None),("Paix dieu triple",4.7,10.0),("Quintine blonde",4.4,8.0),
 ("Saint feuillien",4.3,7.5),("Saint feuillien de Noël",4.3,9.0),("Westmalle triple",4.5,9.5),("Bass",4.5,5.0)]
for n,p,a in BIERES: DB.append(item("Bières",n,p,alc=True,abv=a))
# --- VIN (alcool) ---
for n in ["Rouge merlot","Blanc chardonnay","Rosé"]:
    DB.append(item("Vin",n,2.7,alc=True,abv=12.5))
# --- PETITE PANNE ? ---
DB.append(item("Petite Panne ?","Briquet",2))

rows=[HEADER]; ni=nog=nopt=0
for r,groups in DB:
    rows.append(r); ni+=1
    cat=r[2]
    for g in groups:
        rows.append(og(cat,g)); nog+=1
        for on,op in GROUPS[g]:
            rows.append(opt(cat,on,op)); nopt+=1

buf=io.StringIO(); w=csv.writer(buf,quoting=csv.QUOTE_MINIMAL,lineterminator='\r\n')
for r in rows: w.writerow(r)
open(OUT,'w',encoding='utf-8',newline='').write(buf.getvalue())
print("WROTE",OUT,"| items=%d option-groups=%d options=%d rows=%d"%(ni,nog,nopt,len(rows)-1))
