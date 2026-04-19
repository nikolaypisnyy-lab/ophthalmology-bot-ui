"""
Haigis IOL Power Calculation Formula — Python port
===================================================
Полностью идентично TypeScript-версии (haigis.ts).

Основано на: Haigis W. "The Haigis Formula" в Shammas HJ, ed.
Intraocular Lens Power Calculations. Slack Inc., 2004. Ch. 41.

Ссылки на уравнения:
  Eq. 41.1 — тонколинзовая vergence-формула
  Eq. 41.3 — d(Haigis) = a0 + a1*ACD + a2*AL
  Eq. 41.5 — ACDconst -> a0 (при a1=0.4, a2=0.1)
  Eq. 41.6 — A-constant -> a0
"""

from dataclasses import dataclass
from typing import Optional, List, Union, Dict


# =============================================================================
# КОНСТАНТЫ
# =============================================================================

N_AQUEOUS = 1.336            # показатель преломления влаги/стекловидного тела
N_CORNEA_HAIGIS = 1.3315     # "cornea index" по Haigis (не путать с 1.3375!)
VERTEX_DISTANCE_MM = 12      # стандартная vertex distance
KERATOMETRIC_INDEX = 1.3375  # для перевода K (D) -> R (мм)

DEFAULT_A1 = 0.4
DEFAULT_A2 = 0.1

MEAN_ACD = 3.37
MEAN_AL = 23.39


# =============================================================================
# ТИПЫ
# =============================================================================

@dataclass
class HaigisConstants:
    a0: float
    a1: float = DEFAULT_A1
    a2: float = DEFAULT_A2


@dataclass
class HaigisTableRow:
    power: float
    refraction: float


@dataclass
class HaigisResult:
    iolPower: float
    elp: float
    kMean: float
    cornealRadius: float
    cornealPower: float
    table: List[HaigisTableRow]
    constantsUsed: HaigisConstants


# =============================================================================
# ПЕРЕВОД КОНСТАНТ
# =============================================================================

def a0_from_acdconst(acd_const: float) -> float:
    """Eq. 41.5: a0 = ACDconst - (a1*mean_AC + a2*mean_AL)"""
    return acd_const - (DEFAULT_A1 * MEAN_ACD + DEFAULT_A2 * MEAN_AL)


def a0_from_a_constant(a_constant: float) -> float:
    """Eq. 41.6: стандартная связь ACDconst = 0.62467*A - 68.747"""
    acd_const = 0.62467 * a_constant - 68.747
    return a0_from_acdconst(acd_const)


def haigis_constants_from_a(a_constant: float) -> HaigisConstants:
    """Стандартный режим: a1=0.4, a2=0.1, a0 из A-константы"""
    return HaigisConstants(
        a0=a0_from_a_constant(a_constant),
        a1=DEFAULT_A1,
        a2=DEFAULT_A2,
    )


# =============================================================================
# ЯДРО: VERGENCE-ТРАССИРОВКА
# =============================================================================

def compute_elp(c: HaigisConstants, acd: float, al: float) -> float:
    """Eq. 41.3: d = a0 + a1*ACD + a2*AL"""
    return c.a0 + c.a1 * acd + c.a2 * al


def compute_corneal_power(k_mean: float):
    """
    Радиус роговицы:  R = 337.5 / K   (keratometric index 1.3375)
    Сила роговицы:   DC = (nC - 1) / R * 1000   (nC = 1.3315 по Haigis)
    """
    R = 337.5 / k_mean
    DC = ((N_CORNEA_HAIGIS - 1) / R) * 1000
    return R, DC


def refraction_at_cornea(rx_spectacle: float, vertex_mm: float) -> float:
    """Rx_cornea = Rx_spec / (1 - vertex_m * Rx_spec)"""
    vertex_m = vertex_mm / 1000
    return rx_spectacle / (1 - vertex_m * rx_spectacle)


def compute_iol_power(AL: float, d: float, DC: float, rx_cornea: float) -> float:
    """
    Vergence-трассировка:
      V1 = rx_cornea + DC                             (сразу после роговицы)
      V2 = V1 / (1 - (d_m/n) * V1)                     (перенос через AC до ИОЛ)
      V3_required = n / (AL_m - d_m)                   (фокус на сетчатке)
      P = V3_required - V2
    """
    n = N_AQUEOUS
    AL_m = AL / 1000
    d_m = d / 1000

    V1 = rx_cornea + DC
    V2 = V1 / (1 - (d_m / n) * V1)
    V3_required = n / (AL_m - d_m)

    return V3_required - V2


def expected_refraction_at_cornea(AL: float, d: float, DC: float, P: float) -> float:
    """Обратная vergence-трассировка (для построения таблицы)"""
    n = N_AQUEOUS
    AL_m = AL / 1000
    d_m = d / 1000

    V3 = n / (AL_m - d_m)
    V2 = V3 - P
    V1 = V2 / (1 + (d_m / n) * V2)
    return V1 - DC


def refraction_at_spectacle(rx_cornea: float, vertex_mm: float) -> float:
    vertex_m = vertex_mm / 1000
    return rx_cornea / (1 + vertex_m * rx_cornea)


# =============================================================================
# ГЛАВНАЯ ФУНКЦИЯ
# =============================================================================

def apply_wang_koch_adjustment(al: float) -> float:
    """
    Поправка Ванга-Коха (Wang-Koch adjustment) для длинных глаз.
    Применяется, когда AL > 25.0 мм.
    Используется уточненная формула для оптимизации расчетов по Haigis/Holladay/SRK/T.
    """
    if al <= 25.0:
        return al
    # Формула: AL_adj = -0.00062 * AL^2 + 1.01630 * AL - 0.32305
    return -0.00062 * (al ** 2) + 1.01630 * al - 0.32305


def calc_haigis(
    al: float,
    acd: float,
    k1: float,
    k2: float,
    target_rx: float,
    constants: HaigisConstants,
    vertex: Optional[float] = None,
) -> Union[HaigisResult, Dict[str, str]]:
    """Расчёт силы ИОЛ по Haigis с поправкой Ванга-Коха для длинных глаз."""

    # Валидация
    if not (15 <= al <= 40):
        return {"error": f"Некорректная AL={al}"}
    
    # Применяем поправку Ванга-Коха для длинных глаз
    original_al = al
    al = apply_wang_koch_adjustment(al)
    
    if not (1.5 <= acd <= 6.0):
        return {"error": f"Некорректная ACD={acd}"}
    if not (30 <= k1 <= 60):
        return {"error": f"Некорректная K1={k1}"}
    if not (30 <= k2 <= 60):
        return {"error": f"Некорректная K2={k2}"}

    v = vertex if vertex is not None else VERTEX_DISTANCE_MM

    k_mean = (k1 + k2) / 2
    R, DC = compute_corneal_power(k_mean)
    d = compute_elp(constants, acd, al)

    if not (2.0 <= d <= 7.5):
        return {"error": f"Нефизичная ELP={d:.2f} мм (AL_adj={al:.2f})"}

    rx_cornea = refraction_at_cornea(target_rx, v)
    iol_power = compute_iol_power(al, d, DC, rx_cornea)

    # Таблица
    base = round(iol_power * 2) / 2
    table = []
    for step in [1.5, 1.0, 0.5, 0.0, -0.5, -1.0, -1.5]:
        P = base + step
        z_cornea = expected_refraction_at_cornea(al, d, DC, P)
        rx_spec = refraction_at_spectacle(z_cornea, v)
        table.append(HaigisTableRow(
            power=round(P, 2),
            refraction=round(rx_spec, 2),
        ))

    return HaigisResult(
        iolPower=round(iol_power, 2),
        elp=round(d, 2),
        kMean=round(k_mean, 2),
        cornealRadius=round(R, 2),
        cornealPower=round(DC, 2),
        table=table,
        constantsUsed=constants,
    )
