import csv, io, sys
src="/root/.claude/uploads/234326fb-b60a-4b7e-87b4-28831d249969/22261a05-Sushi_shop_BEFR_V3_CORRIGE.csv"
OUT="/home/user/SO/Sushi_shop_BEFR_V3_FINAL.csv"
R=list(csv.reader(open(src,newline='',encoding='utf-8-sig')))
hdr=R[0]
data=[r for r in R[1:] if any(c.strip() for c in r)]
assert len(hdr)==36 and all(len(r)==36 for r in data), "col mismatch"

# option source rows referenced by data index (0-based, header excluded) — verified against the file
GROUPS={
 'taille':("Selectionnez votre taille",[88,89]),
 'proteine1':("Selectionnez votre protéine (1 max)",[90,91,92,93,94,95]),
 'garnitures':("Selectionnez vos garnitures (3 max)",[96,97,98,99,100,101,102,103]),
 'sauce':("Selectionnez votre sauce (1 max)",[104,105,106,107,108,109]),
 'toppings':("Selectionnez vos toppings (3 max)",[110,111,112,113,114,115,116,117]),
 'extra_prot':("Ajoutez vos protéines supplémentaires (5 maximum)",[118,119,120,121]),
 'extra_acc':("Ajoutez vos accompagnements supplémentaires (5 maximum)",[122,123,124,125]),
 'extra_top':("Ajoutez vos toppings supplémentaires (5 maximum)",[126]),
 'yakitori':("Choix quantité",[135,136,137]),
 'gyoza':("Choix quantité",[141,142,143]),
 'chirashi':("Voulez-vous un supplément ?",[77]),
}
PARENT={
 'Poke by you':['proteine1','garnitures','sauce','toppings','extra_prot','extra_acc','extra_top'],
 'Poke Bowl Veggie':['taille','extra_prot','extra_acc','extra_top'],
 'Poke Bowl Salmon Teriyaki':['taille','extra_prot','extra_acc','extra_top'],
 'Poke Bowl Salmon Detox':['taille','extra_prot','extra_acc','extra_top'],
 'Poke Bowl Salmon Aburi':['taille','extra_prot','extra_acc','extra_top'],
 'Poke Bowl Fried Chicken':['taille','extra_prot','extra_acc','extra_top'],
 'Poke Bowl Thon Spicy':['taille','extra_prot','extra_acc','extra_top'],
 'Small bowl saumon avocat':['extra_prot','extra_acc','extra_top'],
 'Small Bowl Saumon Teriyaki':['extra_prot','extra_acc','extra_top'],
 'Yakitori Bœuf Fromage':['yakitori'],
 'Yakitori Poulet':['yakitori'],
 'Gyoza Bœuf':['gyoza'],
 'Gyoza Poulet':['gyoza'],
 'Gyoza Légumes':['gyoza'],
 'Chirashi saumon cheese':['chirashi'],
 'Chirashi Mixte Thon Saumon':['chirashi'],
 'Chirashi saumon avocat':['chirashi'],
 'Chirashi mariné':['chirashi'],
}
# indices that are options (removed from item list, re-emitted under parents)
opt_idx=set()
for _,idxs in GROUPS.values(): opt_idx.update(idxs)

# sanity: every option index currently is an ITEM in Poke Bowl/Offre Chaude/Chirashi
for i in opt_idx:
    assert data[i][1]=="ITEM" and data[i][2] in ("Poke Bowl","Offre Chaude","Chirashi"), (i,data[i][:4])

def og_row(cat,name):
    r=['']*36; r[1]="Option-Group"; r[2]=cat; r[3]=name; return r
def opt_row(src):
    r=list(src); r[1]="Option"; return r

out=[hdr]; n_item=n_og=n_opt=0
for i,row in enumerate(data):
    if i in opt_idx: continue
    out.append(row); n_item+=1
    name=row[3]
    if name in PARENT:
        for gk in PARENT[name]:
            gname,idxs=GROUPS[gk]
            out.append(og_row(row[2],gname)); n_og+=1
            for si in idxs:
                out.append(opt_row(data[si])); n_opt+=1

# write byte-format identical to source: UTF-8, NO BOM, CRLF, QUOTE_MINIMAL, trailing CRLF
buf=io.StringIO()
w=csv.writer(buf,quoting=csv.QUOTE_MINIMAL,lineterminator='\r\n')
for r in out: w.writerow(r)
open(OUT,'w',encoding='utf-8',newline='').write(buf.getvalue())
print("WROTE",OUT)
print(f"items={n_item}  option-groups={n_og}  options={n_opt}  total data rows={len(out)-1}")
