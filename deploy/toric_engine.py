"""
Toric IOL Calculator — RefMaster 2.0
Расчёт торической ИОЛ с учётом рефракционного индекса и реальной ELP.

Ключевые формулы:
  BVR (Back Vertex Ratio) = (n_aq / (n_aq - ELP_m × Km))²
  C_cornea = C_IOL / BVR

Поддерживаемые линзы:
  Alcon SN6AT, Alcon SNAT (Clareon Toric), Rayner EMV Toric, Hoya XY1 Toric
"""
import math
from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Tuple


# ── Рефракционные индексы (n_aq — показатель преломления водянистой влаги) ──
REFRACTIVE_INDICES = {
    "Standard (1.336)": 1.336,   # Стандарт, большинство калькуляторов
    "Gullstrand (1.333)": 1.333, # Модель Гульстранда
    "Alcon (1.3375)": 1.3375,    # Используется Alcon
}

# ── Базы линз ────────────────────────────────────────────────────────────────
IOL_DATABASES: Dict[str, List[Dict]] = {
    "Alcon SN6AT": [
        {"model": "T2", "cyl_iol": 1.00},
        {"model": "T3", "cyl_iol": 1.50},
        {"model": "T4", "cyl_iol": 2.25},
        {"model": "T5", "cyl_iol": 3.00},
        {"model": "T6", "cyl_iol": 3.75},
        {"model": "T7", "cyl_iol": 4.50},
        {"model": "T8", "cyl_iol": 5.25},
        {"model": "T9", "cyl_iol": 6.00},
    ],
    "Alcon Clareon Toric": [
        {"model": "T2", "cyl_iol": 1.00},
        {"model": "T3", "cyl_iol": 1.50},
        {"model": "T4", "cyl_iol": 2.25},
        {"model": "T5", "cyl_iol": 3.00},
        {"model": "T6", "cyl_iol": 3.75},
        {"model": "T7", "cyl_iol": 4.50},
        {"model": "T8", "cyl_iol": 5.25},
        {"model": "T9", "cyl_iol": 6.00},
    ],
    "Rayner EMV Toric": [
        {"model": "1.0D",  "cyl_iol": 1.00},
        {"model": "1.5D",  "cyl_iol": 1.50},
        {"model": "2.0D",  "cyl_iol": 2.00},
        {"model": "2.5D",  "cyl_iol": 2.50},
        {"model": "3.0D",  "cyl_iol": 3.00},
        {"model": "3.5D",  "cyl_iol": 3.50},
        {"model": "4.0D",  "cyl_iol": 4.00},
        {"model": "5.0D",  "cyl_iol": 5.00},
        {"model": "6.0D",  "cyl_iol": 6.00},
    ],
    "Hoya XY1 Toric": [
        {"model": "T1.5", "cyl_iol": 1.50},
        {"model": "T2.0", "cyl_iol": 2.00},
        {"model": "T2.5", "cyl_iol": 2.50},
        {"model": "T3.0", "cyl_iol": 3.00},
        {"model": "T4.0", "cyl_iol": 4.00},
        {"model": "T5.0", "cyl_iol": 5.00},
        {"model": "T6.0", "cyl_iol": 6.00},
    ],
}


# ── Векторный анализ астигматизма (Power Vector, двойной угол) ───────────────

@dataclass
class AstigVector:
    """
    Вектор астигматизма в пространстве двойного угла.
    x = C × cos(2α),  y = C × sin(2α)
    где C — цилиндр, α — ось КРУТОГО меридиана (0–180°).
    """
    x: float
    y: float

    @classmethod
    def from_polar(cls, cyl: float, steep_axis_deg: float) -> "AstigVector":
        """Создать вектор из цилиндра и оси крутого меридиана."""
        rad = math.radians(2.0 * steep_axis_deg)
        return cls(x=cyl * math.cos(rad), y=cyl * math.sin(rad))

    def to_polar(self) -> Tuple[float, float]:
        """Вернуть (цилиндр, ось крутого меридиана 0–180°)."""
        mag = math.sqrt(self.x ** 2 + self.y ** 2)
        if mag < 1e-4:
            return 0.0, 0.0
        angle_rad = math.atan2(self.y, self.x)
        axis = math.degrees(angle_rad) / 2.0
        while axis < 0:
            axis += 180.0
        while axis >= 180.0:
            axis -= 180.0
        return round(mag, 4), round(axis, 2)

    def __add__(self, other: "AstigVector") -> "AstigVector":
        return AstigVector(self.x + other.x, self.y + other.y)

    def __sub__(self, other: "AstigVector") -> "AstigVector":
        return AstigVector(self.x - other.x, self.y - other.y)


# ── Поправки ─────────────────────────────────────────────────────────────────

def steep_axis_from_k(k1: float, k2: float, k_ax: float, k_ax_is_steep: bool = False) -> Tuple[float, float]:
    """
    Определить цилиндр и ось крутого меридиана из кератометрии.

    k_ax_is_steep=False (по умолчанию): k_ax — ось K1 (плоского меридиана)
                                        стандарт IOLMaster / Lenstar
    k_ax_is_steep=True:                 k_ax — ось K2 (крутого меридиана)
                                        используется в части оборудования
    """
    cyl = abs(k2 - k1)
    if cyl < 0.01:
        return 0.0, 0.0

    if k_ax_is_steep:
        # k_ax уже является осью крутого меридиана
        if k2 >= k1:
            steep = k_ax              # K2 — крутой, k_ax его ось
        else:
            steep = (k_ax + 90.0) % 180.0  # K1 — крутой, k_ax ось K2
    else:
        # k_ax — ось K1 (плоского меридиана) — стандарт IOLMaster
        if k2 >= k1:
            steep = (k_ax + 90.0) % 180.0  # K2 крутой, перпендикуляр K1
        else:
            steep = k_ax              # K1 сам крутой

    return cyl, steep


def apply_abulafia_koch(cyl: float, steep_axis: float, al: float = 23.5) -> Tuple[float, float]:
    """
    Поправка Abulafia-Koch 2016 — учёт задней роговичной астигматизации (PCA).
    PCA всегда обратная (ATR, x > 0), добавляем её к вектору.

    Формула из оригинальной статьи (векторный вариант):
      TCA_x = 0.98 × simK_x + pca_x   (pca_x ≈ 0.30–0.45D ATR)
      TCA_y = 0.97 × simK_y
    Magnitude PCA слегка зависит от AL.
    """
    pca_mag = 0.38 - 0.015 * (al - 23.5)
    pca_mag = max(0.20, min(0.50, pca_mag))

    v = AstigVector.from_polar(cyl, steep_axis)
    # PCA — чистый ATR (x > 0, y = 0)
    x_adj = 0.98 * v.x + pca_mag
    y_adj = 0.97 * v.y
    return AstigVector(x_adj, y_adj).to_polar()


def apply_sia(cyl: float, steep_axis: float, sia: float, inc_axis: float) -> Tuple[float, float]:
    """
    Учёт хирургически-индуцированного астигматизма (SIA).
    Разрез по оси inc_axis уплощает роговицу вдоль inc_axis,
    т.е. добавляет ATR-компонент по оси inc_axis+90°.

    Суммируем вектор роговичного астигматизма с вектором SIA.
    v_sia = from_polar(+sia, inc_axis+90°) = from_polar(-sia, inc_axis)
    """
    v_cornea = AstigVector.from_polar(cyl, steep_axis)
    # Разрез создаёт уплощение вдоль inc_axis → SIA-вектор по inc_axis+90°
    v_sia = AstigVector.from_polar(-sia, inc_axis)   # = +sia @ inc_axis+90°
    return (v_cornea + v_sia).to_polar()


# ── Расчёт BVR (Back Vertex Ratio) ───────────────────────────────────────────

def compute_bvr(km: float, elp_mm: float, n_aq: float = 1.336) -> float:
    """
    Back Vertex Ratio — коэффициент пересчёта цилиндра из плоскости ИОЛ
    в плоскость роговицы.

    BVR = (n_aq / (n_aq - ELP_m × Km))²
    C_cornea = C_IOL / BVR   →   C_IOL = C_cornea × BVR

    Args:
        km:     средняя кератометрия (D)
        elp_mm: эффективная позиция линзы (мм)
        n_aq:   показатель преломления водянистой влаги (по умолчанию 1.336)
    """
    elp_m = elp_mm / 1000.0
    denom = n_aq - elp_m * km
    if abs(denom) < 1e-6:
        return 1.46   # fallback
    bvr = (n_aq / denom) ** 2
    # Разумные пределы
    return max(1.20, min(2.00, bvr))


def estimate_elp(acd: float, al: float, lens: str = "Alcon SN6AT") -> float:
    """
    Приближённая ELP (Effective Lens Position) — позиция главной плоскости ИОЛ
    относительно передней роговицы (мм).

    ELP = ACD_anatomical + IOL_offset
    IOL_offset ≈ 1.8 мм для большинства современных монофокальных ИОЛ.
    Дополнительная поправка на AL (длинные глаза → чуть глубже).
    Диапазон: 4.0–6.5 мм.
    """
    # Базовый смещение ИОЛ от передней роговицы относительно ACD
    offsets = {
        "Alcon SN6AT":       1.8,
        "Alcon Clareon Toric": 1.9,
        "Rayner EMV Toric":  1.7,
        "Hoya XY1 Toric":    1.75,
    }
    offset = offsets.get(lens, 1.8)
    elp = acd + offset + 0.04 * max(0.0, al - 23.5)
    return round(max(4.0, min(6.5, elp)), 2)


# ── Основная функция расчёта ─────────────────────────────────────────────────

def calculate_autonomous_toric(
    k1: float,
    k2: float,
    k1_axis: float,          # ось K1 (плоского меридиана) — стандарт IOLMaster
    sia: float = 0.1,
    inc_axis: float = 90.0,
    al: float = 23.5,
    acd: float = 3.2,
    n_aq: float = 1.336,
    iol_db: str = "Alcon SN6AT",
    k_ax_is_steep: bool = False,  # True если введена ось K2 (крутого)
) -> Dict[str, Any]:
    """
    Рассчитать рекомендацию торической ИОЛ.

    Параметры:
        k1, k2:       кератометрия (D); K1 < K2 — стандарт IOLMaster
        k1_axis:      ось K1 (плоского меридиана) 0–180°
        sia:          хирургически-индуцированный астигматизм (D)
        inc_axis:     ось разреза 0–180°
        al:           длина глаза (мм)
        acd:          глубина передней камеры (мм)
        n_aq:         показатель преломления водянистой влаги
        iol_db:       база линз (см. IOL_DATABASES)
        k_ax_is_steep: True если k1_axis — ось K2 (крутого меридиана)

    Возвращает:
        net_corneal_cyl:       исходный роговичный цилиндр (D)
        total_corneal_cyl_adj: скорректированный цилиндр после PCA + SIA (D)
        total_steep_axis:      ось имплантации ИОЛ (= крутой меридиан, 0–180°)
        bvr:                   коэффициент BVR
        elp_mm:                использованная ELP (мм)
        best_model:            рекомендованная модель
        table:                 полная таблица вариантов
    """
    # 1. Определяем крутой меридиан и цилиндр
    net_cyl, steep_ax = steep_axis_from_k(k1, k2, k1_axis, k_ax_is_steep)

    if net_cyl < 0.1:
        return {
            "net_corneal_cyl": 0.0,
            "total_corneal_cyl_adj": 0.0,
            "total_steep_axis": 0.0,
            "bvr": 1.46,
            "elp_mm": acd,
            "best_model": "None",
            "table": [{"model": "None", "cyl_iol": 0, "cyl_cornea": 0,
                        "residual": 0, "res_axis": 0, "is_wtr": True}],
        }

    # 2. Поправка Abulafia-Koch (PCA)
    adj_cyl, adj_axis = apply_abulafia_koch(net_cyl, steep_ax, al)

    # 3. SIA
    final_cyl, final_axis = apply_sia(adj_cyl, adj_axis, sia, inc_axis)

    # 4. Вычисляем BVR из реальной биометрии
    km = (k1 + k2) / 2.0
    elp_mm = estimate_elp(acd, al, iol_db)
    bvr = compute_bvr(km, elp_mm, n_aq)

    # 5. Подбираем линзу
    db = IOL_DATABASES.get(iol_db, IOL_DATABASES["Alcon SN6AT"])
    v_target = AstigVector.from_polar(final_cyl, final_axis)

    suggestions = [{
        "model": "None",
        "cyl_iol": 0.0,
        "cyl_cornea": 0.0,
        "residual": round(final_cyl, 2),
        "res_axis": round(final_axis, 0),
        "is_wtr": True,
    }]

    best_model = "None"
    min_residual = 99.0

    for m in db:
        c_iol = m["cyl_iol"]
        # Пересчёт из плоскости ИОЛ в плоскость роговицы
        c_cornea = c_iol / bvr

        # Вектор коррекции — ИОЛ корректирует вдоль крутого меридиана
        v_lens = AstigVector.from_polar(c_cornea, final_axis)
        v_res = v_target - v_lens
        res_mag, res_ax = v_res.to_polar()

        # Ось остаточного астигматизма в клинической нотации
        # (перпендикулярная ось для minus-cylinder display)
        res_display_ax = (res_ax + 90.0) % 180.0
        if res_display_ax == 0:
            res_display_ax = 180.0
        is_wtr = 45.0 <= res_display_ax <= 135.0

        suggestions.append({
            "model": m["model"],
            "cyl_iol":   round(c_iol, 2),
            "cyl_cornea": round(c_cornea, 2),
            "residual":   round(res_mag, 2),
            "res_axis":   round(res_display_ax, 0),
            "is_wtr":     is_wtr,
        })

        if res_mag < min_residual:
            min_residual = res_mag
            best_model = m["model"]

    # Предпочитаем WTR-остаток < 0.5D, иначе просто минимум
    wtr_ok = [s for s in suggestions if s.get("is_wtr") and s["residual"] < 0.5]
    if wtr_ok:
        best_model = min(wtr_ok, key=lambda s: s["residual"])["model"]

    return {
        "net_corneal_cyl":       round(net_cyl, 2),
        "total_corneal_cyl_adj": round(final_cyl, 2),
        "total_steep_axis":      round(final_axis, 0),
        "bvr":                   round(bvr, 3),
        "elp_mm":                round(elp_mm, 2),
        "best_model":            best_model,
        "table":                 suggestions,
    }
