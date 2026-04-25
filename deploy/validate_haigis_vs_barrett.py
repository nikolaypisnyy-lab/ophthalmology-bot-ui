#!/usr/bin/env python3
"""
Валидация Haigis vs Barrett Universal II
==========================================
Запускать на СЕРВЕРЕ в папке /root/medeye/api/

  cd /root/medeye/api
  python3 validate_haigis_vs_barrett.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from calculators import scrape_barrett_universal2_both
from haigis import calc_haigis, haigis_constants_from_a

A_CONSTANT = 118.99
TARGET_RX = 0.0

CASES = [
    ("Короткий AL=21.5",       21.5, 2.8, 44.50, 45.50),
    ("Умер. короткий AL=22.0", 22.0, 3.0, 43.50, 44.50),
    ("Норма AL=23.5",          23.5, 3.2, 43.25, 44.00),
    ("Норма AL=24.0",          24.0, 3.4, 43.00, 43.75),
    ("Умер. длинный AL=25.0",  25.0, 3.5, 43.00, 43.75),
    ("Длинный AL=27.0",        27.0, 3.8, 42.50, 43.25),
    ("Экстремальный AL=30.0",  30.0, 4.0, 42.00, 42.50),
]


def main():
    constants = haigis_constants_from_a(A_CONSTANT)

    print("=" * 100)
    print(f"ВАЛИДАЦИЯ: Haigis (наш код) vs Barrett Universal II (APACRS)")
    print(f"ИОЛ: Alcon SN60WF, A-const = {A_CONSTANT}, target = {TARGET_RX} D")
    print(f"Haigis: a0={constants.a0:.4f}, a1={constants.a1}, a2={constants.a2}")
    print("=" * 100)
    print()

    results = []

    for label, al, acd, k1, k2 in CASES:
        k_mean = (k1 + k2) / 2
        print(f"[{label}] AL={al}, ACD={acd}, K1={k1}, K2={k2}, Km={k_mean:.2f}")

        # 1. Haigis
        hres = calc_haigis(al, acd, k1, k2, TARGET_RX, constants)
        if isinstance(hres, dict):
            print(f"  Haigis ERROR: {hres}")
            continue
        haigis_p = hres.iolPower
        print(f"  Haigis:  {haigis_p:6.2f} D   (ELP={hres.elp:.2f})")

        # 2. Barrett (через webscrape)
        barrett_req = {
            "patient_name": "Validation",
            "od": {
                "al": al,
                "k1": k1,
                "k2": k2,
                "acd": acd,
                "a_const": A_CONSTANT,
                "target": TARGET_RX,
                "k1_ax": 0,
            },
        }

        try:
            bresp = scrape_barrett_universal2_both(barrett_req)
        except Exception as e:
            print(f"  Barrett EXCEPTION: {e}")
            continue

        if "error" in bresp:
            print(f"  Barrett ERROR: {bresp['error']}")
            continue

        bod = bresp.get("result", {}).get("od", {})
        if not bod:
            print(f"  Barrett: пустой результат. Raw: {bresp}")
            continue

        barrett_p = bod.get("p_emmetropia")
        if barrett_p is None:
            print(f"  Barrett: p_emmetropia не найден. Raw: {bod}")
            continue

        delta = haigis_p - barrett_p
        print(f"  Barrett: {barrett_p:6.2f} D")
        print(f"  Δ (H − B): {'+' if delta >= 0 else ''}{delta:.2f} D")
        print()

        results.append({
            "label": label, "al": al,
            "haigis": haigis_p, "barrett": barrett_p, "delta": delta,
        })

    print("=" * 100)
    print("СВОДНАЯ ТАБЛИЦА")
    print("=" * 100)
    print(f"{'Кейс':<28}{'AL':>6}{'Haigis':>10}{'Barrett':>10}{'Δ':>8}")
    print("-" * 62)
    for r in results:
        sign = "+" if r["delta"] >= 0 else ""
        print(f"{r['label']:<28}{r['al']:>6.1f}{r['haigis']:>10.2f}{r['barrett']:>10.2f}{sign}{r['delta']:>7.2f}")

    if not results:
        print("НЕТ УСПЕШНЫХ РЕЗУЛЬТАТОВ")
        return

    deltas = [r["delta"] for r in results]
    abs_deltas = [abs(d) for d in deltas]
    mean_abs = sum(abs_deltas) / len(abs_deltas)
    mean_delta = sum(deltas) / len(deltas)

    print()
    print(f"  n = {len(results)}")
    print(f"  mean Δ   = {'+' if mean_delta >= 0 else ''}{mean_delta:.2f} D")
    print(f"  mean |Δ| = {mean_abs:.2f} D")

    normal = [r for r in results if 22 <= r["al"] <= 25]
    if normal:
        n_abs = sum(abs(r["delta"]) for r in normal) / len(normal)
        print(f"\n  На нормальных глазах (AL 22–25, n={len(normal)}): mean |Δ| = {n_abs:.2f} D")
        if n_abs < 0.75:
            print("  ✓ ОТЛИЧНО: Haigis и Barrett согласованы на нормальной выборке.")
        elif n_abs < 1.5:
            print("  ~ ПРИЕМЛЕМО: расхождение в пределах ожидаемого для двух разных формул.")
        else:
            print("  ✗ ТРЕВОГА: расхождение > 1.5 D — возможен баг в Haigis.")


if __name__ == "__main__":
    main()
