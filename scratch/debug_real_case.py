import sys
sys.path.append('/Users/mac/Documents/MEDEYEbot/RefMaster 2/refmaster 2/deploy')
from haigis import calc_haigis, haigis_constants_from_a

al = 29.29
acd = 3.2
k1 = 44.94
k2 = 47.6
a_const = 118.8
target = 0.0

h_consts = haigis_constants_from_a(a_const)
print(f"Constants for A={a_const}: {h_consts}")

res = calc_haigis(al, acd, k1, k2, target, h_consts)
if isinstance(res, dict): print(f"Error: {res['error']}")
else:
    print(f"Haigis Power: {res.iolPower} D")
    print(f"ELP: {res.elp} mm")
