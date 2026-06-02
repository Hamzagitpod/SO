import csv, io
OUT="/home/user/SO/Signore_Pizza_Menu_V3_FINAL.csv"
HEADER="GTIN,Product Type,Category,Product Name,Image URL,Description,Regular Price,Pickup Price,SKU,isAlcohol,ABV(%),Caffeine Quantity,Caffeine reference unit,Net Value,Net Unit,Net Quantity,Gross weight,Gross Unit,Size Description,Energy Content,Serving Size,Tax,Quantity Restriction,Product Types,Deposit Type,Deposit Amount,Allergen information,Additive information,Additional information,Quantitative declaration of ingredients (QUID),Nutritional declaration,Name of manufacturer,Address of manufacturer,Country of origin or place of provenance,Storage conditions,Preparation instructions".split(",")
NC=len(HEADER); assert NC==36
def money(x): return ("%g"%float(x))
def blank(): return [""]*NC
def item(cat,name,deliv,pick,desc="",gtin="",img="",alc=False,abv=None,groups=None):
    r=blank(); r[0]=gtin; r[1]="ITEM"; r[2]=cat; r[3]=name; r[4]=img; r[5]=desc
    r[6]=money(deliv); r[7]=money(pick)
    if alc: r[9]="TRUE"
    if abv is not None: r[10]=money(abv)
    return (r,groups or [])
def og(cat,g):
    r=blank(); r[1]="Option-Group"; r[2]=cat; r[3]=g; return r
def opt(cat,n,p):
    r=blank(); r[1]="Option"; r[2]=cat; r[3]=n; r[6]=money(p); r[7]=money(p); return r

IMG="images/restaurants/be/R5RQ0503/products/"
SUPP=[("Origan",2.5),("Champignons",2.5),("Poivrons",2.5),("Câpres",2.5),("Oignons rouges",2.5),
 ("Artichauts",2.5),("Olives",2.5),("Légumes frais",2.5),("Aubergines",2.5),("Jambon",3.0),("Jambon de Parme",3.0)]
GROUPS={"Suppléments (facultatif)":SUPP}
DB=[]
# ENTRÉES
DB.append(item("Entrées","Pain à l'ail",8,8,"",img=IMG+"be_10169653_signorepizza_pizza_a_lail_550x440.png"))
DB.append(item("Entrées","Aubergines à la parmigiana",16,16))
DB.append(item("Entrées","Pain à l'ail et miel",10,10))
# PIZZAS (deliv, pick, desc, img-suffix) — toutes avec groupe Suppléments
PIZ=[
("Pizza pepperoni",25,18,"Tomate, mozzarella, salami et origan.","pizza_peperoni_550x440.png"),
("Pizza Regina",24,17,"Tomate, mozzarella, champignons, jambon et origan.","pizza_regina_550x440.png"),
("Pizza romana",23,18,"Tomate, mozzarella, champignons, poivrons, olives et origan.","pizza_romana_550x440.png"),
("Pizza tonno",25,18,"Tomate, mozzarella, thon, câpres, olives et origan.","pizza_tonno_550x440.png"),
("Pizza calzone",24,13.5,"Tomate, mozzarella, jambon, champignons et origan.",""),
("Pizza Hawaï",26,13.5,"Tomate, mozzarella, jambon et ananas.","pizza_hawai_550x440.png"),
("Pizza gourmet",26,14,"Tomate, mozzarella, jambon, salami, Gorgonzola et origan.","pizza_gourmet_550x440.png"),
("Pizza funghi",23,12,"Tomate, mozzarella, champignons et origan.","pizza_funghi_550x440.png"),
("Pizza vegetariana",24,13,"Tomate, mozzarella et légumes frais.","pizza_vegetarienne_550x440.png"),
("Pizza quattro stagioni",26,14,"Tomate, mozzarella, champignons, jambon, artichauts, olives et origan.","food_4_stagione_1x1.png"),
("Pizza Signore",26,14,"Tomate, mozzarella, aubergines et jambon de Parme.","food_signore_1x1.png"),
("Pizza capricciosa",25,14,"Tomate, mozzarella, jambon, salami, poivrons, olives et origan.","food_capricciossa_1x1.png"),
("Pizza Lettona",25,15,"Tomate, mozzarella, jambon, salami, champignons et origan.","food_lettona_1x1.png"),
("Pizza quattro formaggi",22,18,"Tomate, mozzarella, Gorgonzola, Taleggio et Parmesan.","pizza_4_fromges_550x440.png"),
("Pizza prosciutto",21,18,"Tomate, mozzarella, jambon et origan.","pizza_proscuito_550x440.png"),
("Pizza tartufata",26,20,"Pizza avec une base de truffe tartufata avec une crème onctueuse et des champignons.","pizza_tartufata_550x440.png"),
("Pizza Margherita",20,10,"Tomate, mozzarella et origan.","pizza_margherita_550x440.png"),
("Pizza Napoli",23,18,"Tomate, mozzarella, anchois, câpres, olives et origan.","food_napoli_1x1.png"),
("Pizza du chef",30,16,"Tomate, mozzarella, bœuf haché, oignons et mascarpone du chef.","pizza_du_chef_550x440.png"),
("Pizza salmone",17,17,"Tomate, mozzarella, saumon fumé et Parmesan.","pizza_salmone_550x440.png"),
("Pizza burrata",24,16,"Tomate, mozzarella, saucisse italienne, oignons rouges et piment.","pizza_burrata_550x440.png"),
("Pizza siciliana",25,14,"Tomate, mozzarella, jambon et salami piquant.","pizza_siciliano_550x440.png"),
("Pizza Lucifero",25,13,"Tomate, mozzarella, salami, piment, poivrons et œuf.","food_lucifero_1x1.png"),
("Pizza pulada",26,13.5,"Tomate, mozzarella, poulet et oignons.","pizza_pulada_550x440.png"),
("Pizza primavera",25,15,"Tomate, mozzarella, artichauts, olives et origan.","food_primavera_1x1.png"),
("Pizza Rustica",25,18,"Tomate, mozzarella, champignons, gorgonzola.","food_rustica_1x1.png"),
]
for n,d,p,desc,sfx in PIZ:
    DB.append(item("Pizzas",n,d,p,desc,img=(IMG+"be_10169653_signorepizza_"+sfx) if sfx else "",groups=["Suppléments (facultatif)"]))
# DESSERTS
DB.append(item("Desserts","Tiramisu au speculoos",8,8,"",img=IMG+"be_10169653_signorepizza_pizza_tiramisu_speculoos_550x440.png"))
DB.append(item("Desserts","Profiterole",8,8))
DB.append(item("Desserts","Mousse au chocolat",10,10,"",img=IMG+"be_10169653_signorepizza_mousseau_chocolat_550x440.png"))
DB.append(item("Desserts","Tiramisu Oreo",8,8))
# BOISSONS SOFTS (ordre sortid)
DB.append(item("Boissons softs","Eau",2,2))
DB.append(item("Boissons softs","Coca-Cola 33cl",2,2,gtin="5449000000996",img="images/databank/be/5449000000996/-788509986.jpg"))
DB.append(item("Boissons softs","Coca-Cola Zero 33cl",2,2,gtin="5449000131805",img="images/databank/be/5449000131805/424797245.jpg"))
DB.append(item("Boissons softs","Lipton Ice-Tea",2,2))
DB.append(item("Boissons softs","Perrier",2,2))
# BOISSONS ALCOOLISÉES (ordre sortid) — isAlcohol
DB.append(item("Boissons alcoolisées","Jupiler",2.5,2.5,alc=True,abv=5.2))
DB.append(item("Boissons alcoolisées","Vin blanc",15,15,alc=True,abv=12.5))
DB.append(item("Boissons alcoolisées","Vin rouge",15,15,alc=True,abv=12.5))
DB.append(item("Boissons alcoolisées","Vin rosé",15,15,alc=True,abv=12.5))

rows=[HEADER]; ni=nog=nopt=0
for r,groups in DB:
    rows.append(r); ni+=1; cat=r[2]
    for g in groups:
        rows.append(og(cat,g)); nog+=1
        for on,op in GROUPS[g]:
            rows.append(opt(cat,on,op)); nopt+=1
buf=io.StringIO(); w=csv.writer(buf,quoting=csv.QUOTE_MINIMAL,lineterminator='\r\n')
for r in rows: w.writerow(r)
open(OUT,'w',encoding='utf-8',newline='').write(buf.getvalue())
print("WROTE",OUT,"| items=%d option-groups=%d options=%d rows=%d"%(ni,nog,nopt,len(rows)-1))
