import sys
sys.path.append('/Users/mac/Documents/MEDEYEbot/RefMaster 2/refmaster 2/deploy')
from haigis import calc_haigis, haigis_constants_from_a

# ТЕСТОВЫЕ ДАННЫЕ (подставьте реальные, когда пришлют)
al = 31.0
acd = 3.5
k1 = 43.5
k2 = 44.5
a_const = 118.8
target = 0.0

h_consts = haigis_constants_from_a(a_const)
print(f"Constants: {h_consts}")

res = calc_haigis(al, acd, k1, k2, target, h_consts)
if isinstance(res, dict):
    print(f"Error: {res['error']}")
else:
    print(f"Haigis Power: {res.iolPower} D")
    print(f"ELP: {res.elp} mm")
    print(f"Table: {res.table[:3]}")
