import sys
sys.path.append('/Users/mac/Documents/MEDEYEbot/RefMaster 2/refmaster 2/deploy')
from toric_engine import calculate_autonomous_toric

# Данные пользователя (предположим 1D астигматизма)
k1 = 43.0
k2 = 44.0
k1_ax = 90
sia = 0.1
inc = 120

res = calculate_autonomous_toric(k1, k2, k1_ax, sia, inc)
print(f"Net Cyl: {res['net_corneal_cyl']}")
print(f"Total Adj Cyl: {res['total_corneal_cyl_adj']}")
print(f"Best Model: {res['best_model']}")
for row in res['table'][:4]:
    print(f"  Model {row['model']}: Cyl IOL {row['cyl_iol']} -> Cornea {row['cyl_cornea']} (Residual: {row['residual']})")
