import csv, io
OUT="/home/user/SO/Pates_Menu_V3_FINAL.csv"
HEADER="GTIN,Product Type,Category,Product Name,Image URL,Description,Regular Price,Pickup Price,SKU,isAlcohol,ABV(%),Caffeine Quantity,Caffeine reference unit,Net Value,Net Unit,Net Quantity,Gross weight,Gross Unit,Size Description,Energy Content,Serving Size,Tax,Quantity Restriction,Product Types,Deposit Type,Deposit Amount,Allergen information,Additive information,Additional information,Quantitative declaration of ingredients (QUID),Nutritional declaration,Name of manufacturer,Address of manufacturer,Country of origin or place of provenance,Storage conditions,Preparation instructions".split(",")
NC=len(HEADER); assert NC==36
def money(x): return ("%g"%float(x))
def blank(): return [""]*NC

SUPP=[("Parmesan petit",1),("Parmesan grand",2),("Sauce crème",1),("Sauce tomate",1),("Sauce bolognaise",1),
 ("Burrata",5),("Poulet",2.5),("Merguez",2.5),("Poissons",2.5),("Gratinée au four",2),
 ("Ail",0.5),("Basilic",0.5),("Pili-pili",0.5),("Pâtes SANS GLUTEN",2),("Crème SANS LACTOSE",2),
 ("Chorizo",2),("Jambon",2),("Jambon de parme",2),("Lardons",2),
 ("Gorgonzola",2),("Raclette",2),("Reblochon",2),("Fêta",2),("Légumes",1),("Huile de truffe",2)]
SUPP_NAME="Suppléments (facultatif)"

MENU=[
("Les Classiques","Bolognaise maison",8,"tomate, viande hachée porc/boeuf, persil"),
("Les Classiques","Crème jambon",9,"crème, jambon à l'os, parmesan, persil"),
("Les Classiques","4 fromages",10,"crème, gorgonzola, mozzarella, parmesan, tallegio, persil"),
("Les Classiques","Carbonara",10,"crème, lardons, oeuf battu, parmesan, persil"),
("Les Classiques","Campagnola",12,"crème tomatée, lardons, champignons, basilic, ail"),
("Les Classiques","Arrabiata",10,"tomate, chorizo, oignons, piments, basilic, ail"),
("Les Classiques","Crème tomate",9,"crème tomate, basilic, ail"),
("Les Classiques","Crème tomate poulet",11,"crème tomatée, poulet, basilic, ail"),
("Les Gratinées","Nandrinoise",13,"bolo, crème, lardons, jambon, petits pois, champignons, basilic, ail"),
("Les Gratinées","Pennes du Chef",12,"bolo, crème, jambon à l'os, champignons, parmesan, basilic, ail"),
("Les Gratinées","Standard",13,"bolognaise, quatre fromages, pili-pili, basilic, ail"),
("Les Gratinées","Chicon du Chef",13,"crème tomatée, chicons, jambon à l'os, cheddar, estragon"),
("Les Gratinées","Mont-Blanc",13,"crème, jambon, jambon de parme, fromage à raclette, champignons, ail"),
("Les Gratinées","Tartiflette",13,"crème, lardons, reblochon, oignons, basilic, ail"),
("Le Tour du Monde","Pastaella (pour 2 pers.)",32,"crème safranée, fruits de mer, calamars, moules, scampis, poulet, chorizo, petits pois, poivrons, basilic, ail"),
("Le Tour du Monde","Catalane",13,"crème safranée, scampis, chorizo, poivrons, petits pois, basilic, ail"),
("Le Tour du Monde","Parisienne",11,"crème, champignons, huile de truffe, basilic, ail"),
("Le Tour du Monde","Périgord",13,"crème tomatée, poulet, champignons, huile de truffe, moutarde, basilic, ail"),
("Le Tour du Monde","New-York",13,"crème, poulet, lardons, asperges, brocolis"),
("Le Tour du Monde","Angolaise",13,"bolognaise, crème, poulet, merguez, poivrons, oignons, basilic, ail"),
("Le Tour du Monde","Casablanca",12,"crème tomatée, merguez, piments, cumin, basilic, ail"),
("Le Tour du Monde","Jamaïca",12,"crème tomatée, poulet, ananas, curry, basilic"),
("Le Tour du Monde","Mexicaine",12,"bolognaise, poivrons, maïs, haricots, petits pois, pili-pili, basilic, ail"),
("Le Tour du Monde","Ecossaise",13,"crème, saumon fumé, brocolis, asperges, basilic, ail"),
("Le Tour du Monde","Zorba",13,"crème tomatée, poulet, feta, olives, piments, basilic, ail"),
("Le Tour du Monde","Tzigane",12,"crème, lardons, oeuf battu, poivrons, paprika, persil, ail"),
("Le Tour du Monde","Bali",12,"crème, poulet, légumes croquants asiatiques, épices asiatiques, basilic, ail"),
("Les Spéciales","Burrata",13,"crème tomatée, burrata, pesto, basilic, ail"),
("Les Spéciales","Nachos",13,"bolognaise, sauce 3 fromages, poivrons, oignons, piments, basilic, ail"),
("Les Spéciales","Chicon",12,"crème tomatée, poulet, chicons, estragon, parmesan"),
("Les Spéciales","Jérôme",13,"bolognaise, filet de crème, chorizo, merguez, piments, pili-pili, basilic, ail"),
("Les Spéciales","Catherine",11,"bolognaise, crème, jambon à l'os, petits pois, parmesan, basilic, ail"),
("Les Spéciales","Boscaïola",11,"tomate, jambon à l'os, champignons, olives noires, basilic, ail"),
("Les Spéciales","Parmigiana",12,"tomate, jambon de parme, aubergines, roquette, balsamique, parmesan, basilic, ail"),
("Les Spéciales","Végé",12,"tomate, champignons, brocolis, petits pois, tomates cerises, courgettes, aubergines, ail"),
("Les Spéciales","Maurane",12,"crème tomatée, aubergines, mascarpone, parmesan, basilic, ail"),
("Les Spéciales","Brocolis",10,"crème, jambon à l'os, brocolis, mozzarella, persil"),
("Les Spéciales","Kristina",13,"crème, mascarpone, gorgonzola, jambon de parme, courgettes, basilic, ail"),
("Les Spéciales","Basse-cour",13,"crème, gorgonzola, poulet, poireaux, basilic"),
("Les Spéciales","Pesto",10,"crème, roquette, pesto, basilic, ail"),
("Les Spéciales","Boris",12,"crème, lardons, oeuf battu, chicons, estragon, roquette, parmesan, persil"),
("Les Spéciales","Luxure",13,"crème, foie gras d'oie, jambon de parme, champignons, huile de truffe, basilic, ail"),
("Les Spéciales","Maya",12,"crème, poulet, miel, raisins secs, moutarde, cannelle, basilic"),
("Les Spéciales","Laura",12,"huile d'olive, jambon de parme, tomates cerises, roquette, pesto, basilic, ail"),
("Les Spéciales","Poulet pesto",13,"huile d'olive, poulet, aubergines, poivrons, olives noires, pesto, basilic, ail"),
("Les Spéciales","Lorenzo",12,"huile, lardons, petits pois, câpres, olives, tomates cerises, courgettes, aubergines, champignons, parmesan, basilic, ail"),
("Les Marin","Scampis",12,"crème tomatée, scampis, basilic, ail"),
("Les Marin","Scampis Thaï",12,"crème, scampis, épices asiatiques, pili-pili, curry, basilic, ail"),
("Les Marin","Scampis du Chef",13,"crème tomatée, scampis, courgettes, pesto, basilic, ail"),
("Les Marin","Tartufo",13,"crème, scampis, champignons, huile de truffe, basilic, ail"),
("Les Marin","Saumon",13,"crème tomatée, saumon fumé, tomates cerises, oignons, basilic, ail"),
("Les Marin","Calamars",13,"crème tomatée, calamars, tomates cerises, piments, oignons, basilic, ail"),
("Les Marin","Fruits de mer",13,"crème tomatée, fruits de mer, tomates cerises, piments, oignons, basilic, ail"),
("Les Marin","Vongoles",13,"huile d'olive, vongoles, tomates cerises, oignons, basilic, ail"),
("Les Marin","Abuelita",13,"huile d'olive, vongoles, calamars, scampis, tomates cerises, oignons, basilic, ail"),
]

def item_row(cat,name,price,desc):
    r=blank(); r[1]="ITEM"; r[2]=cat; r[3]=name; r[5]=desc; r[6]=money(price); r[7]=money(price); return r
def og_row(cat,g):
    r=blank(); r[1]="Option-Group"; r[2]=cat; r[3]=g; return r
def opt_row(cat,n,p):
    r=blank(); r[1]="Option"; r[2]=cat; r[3]=n; r[6]=money(p); r[7]=money(p); return r

rows=[HEADER]; ni=nog=nopt=0
for cat,name,price,desc in MENU:
    rows.append(item_row(cat,name,price,desc)); ni+=1
    rows.append(og_row(cat,SUPP_NAME)); nog+=1
    for n,p in SUPP:
        rows.append(opt_row(cat,n,p)); nopt+=1

buf=io.StringIO(); w=csv.writer(buf,quoting=csv.QUOTE_MINIMAL,lineterminator='\r\n')
for r in rows: w.writerow(r)
open(OUT,'w',encoding='utf-8',newline='').write(buf.getvalue())
print("WROTE",OUT,"| items=%d option-groups=%d options=%d rows=%d"%(ni,nog,nopt,len(rows)-1))
