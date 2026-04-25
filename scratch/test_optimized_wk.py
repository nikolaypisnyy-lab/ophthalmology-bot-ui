import math

def wang_koch_new(al):
    if al <= 25.2: return al
    # Оптимизированная поправка для IOLMaster
    return 0.922 * al + 2.394

def haigis_power(al, acd, k1, k2, a0, a1, a2):
    n_cornea = 1.3315
    n_aqueous = 1.336
    km = (k1 + k2) / 2
    r_mm = 337.5 / km
    dc = (n_cornea - 1) / r_mm * 1000
    d = a0 + a1 * acd + a2 * al
    
    # Vergence formula
    al_m = al / 1000
    d_m = d / 1000
    v1 = dc # emmetropia target
    v2 = v1 / (1 - (d_m / n_aqueous) * v1)
    v3 = n_aqueous / (al_m - d_m)
    return v3 - v2

al = 29.29
acd = 3.2
k1 = 44.94
k2 = 47.6
# a0 optimized for long eyes often differs.
# But let's try just WK adjustment
al_adj = wang_koch_new(al)
print(f"AL Adj: {al_adj:.2f}")

# Using standard constants derived from 118.8
a0, a1, a2 = 1.777, 0.4, 0.1
p = haigis_power(al_adj, acd, k1, k2, a0, a1, a2)
print(f"Power with New WK: {p:.2f} D")
