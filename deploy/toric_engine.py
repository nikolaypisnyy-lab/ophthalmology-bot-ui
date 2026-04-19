import math
from dataclasses import dataclass
from typing import List, Dict, Any, Optional

@dataclass
class AstigmatismVector:
    x: float
    y: float

    @classmethod
    def from_polar(cls, magnitude: float, axis_deg: float):
        # Векторный анализ использует удвоенный угол
        rad = math.radians(2 * axis_deg)
        return cls(x=magnitude * math.cos(rad), y=magnitude * math.sin(rad))

    def to_polar(self):
        magnitude = math.sqrt(self.x**2 + self.y**2)
        if magnitude < 0.0001:
            return 0.0, 0.0
        angle_rad = math.atan2(self.y, self.x)
        axis = math.degrees(angle_rad) / 2
        while axis < 0: axis += 180
        while axis >= 180: axis -= 180
        return round(magnitude, 4), round(axis, 2)

    def __add__(self, other):
        return AstigmatismVector(self.x + other.x, self.y + other.y)

    def __sub__(self, other):
        return AstigmatismVector(self.x - other.x, self.y - other.y)


def apply_abulafia_koch(cyl: float, axis: float, al: float = 23.5) -> (float, float):
    """
    Abulafia-Koch adjustment (2016).
    Corrects net corneal astigmatism for posterior corneal astigmatism (PCA).
    """
    v_net = AstigmatismVector.from_polar(cyl, axis)
    
    # Рекурсивная поправка (векторный сдвиг PCA)
    # По оси 180 (WTR) - добавляем 0.3 D по оси 90
    # По оси 90 (ATR) - добавляем 0.2 D по оси 90
    # Динамическая поправка PCA (зависит от длины глаза AL)
    # Среднее значение 0.38 D для нормальных глаз (AL=23.5)
    # На коротких глазах PCA чуть выше, на длинных чуть ниже.
    pca_base = 0.38
    pca_adj = pca_base - 0.015 * (al - 23.5)
    # Ограничения (0.25 - 0.50)
    pca_val = max(0.20, min(0.50, pca_adj))

    # Сдвиг в векторном пространстве (X - ось 180/90)
    # Добавляем к X, т.к. PCA всегда Against-the-rule (смещение к 180)
    x_adj = 0.98 * v_net.x + pca_val
    y_adj = 0.98 * v_net.y
    
    v_adj = AstigmatismVector(x=x_adj, y=y_adj)
    return v_adj.to_polar()


def apply_sia(cyl: float, axis: float, sia: float, inc_axis: float) -> (float, float):
    """
    Surgically Induced Astigmatism (SIA).
    Flattening along the incision axis.
    """
    v_cornea = AstigmatismVector.from_polar(cyl, axis)
    # SIA привносит астигматизм по оси 90 градусов к разрезу (или плоское меридиан по разрезу)
    # На практике SIA добавляет -SIA по оси разреза
    v_sia = AstigmatismVector.from_polar(-sia, inc_axis)
    
    v_final = v_cornea + v_sia
    return v_final.to_polar()


class AlconToricDB:
    # Модели Alcon SN6AT
    # cyl_iol: мощность на линзе
    # cyl_cornea_avg: примерная мощность на роговице (обычно ratio ~1.46)
    MODELS = [
        {"model": "T2", "cyl_iol": 1.00, "ratio": 1.46},
        {"model": "T3", "cyl_iol": 1.50, "ratio": 1.46},
        {"model": "T4", "cyl_iol": 2.25, "ratio": 1.46},
        {"model": "T5", "cyl_iol": 3.00, "ratio": 1.46},
        {"model": "T6", "cyl_iol": 3.75, "ratio": 1.46},
        {"model": "T7", "cyl_iol": 4.50, "ratio": 1.46},
        {"model": "T8", "cyl_iol": 5.25, "ratio": 1.46},
        {"model": "T9", "cyl_iol": 6.00, "ratio": 1.46},
    ]

    @staticmethod
    def get_cyl_at_cornea(cyl_iol: float, elp: float, km: float) -> float:
        # Более точный расчет ratio на основе вергенции
        # Ratio = ( (n-elp*K/n)^2 ) / n^2
        # Но для Alcon в литературе зафиксировано среднее 1.46 (или 0.685 в обратную сторону)
        return cyl_iol / 1.46


def calculate_autonomous_toric(
    k1: float, 
    k2: float, 
    k1_axis: float,
    sia: float,
    inc_axis: float,
    al: float = 23.5,
    elp: float = 5.5,
) -> Dict[str, Any]:
    # 1. Net Corneal Astigmatism (считаем цилиндр и ось крутого меридиана)
    cyl_net = abs(k2 - k1)
    # Если K2 > K1, то ось крутого — это k1_axis + 90
    # Если K1 > K2, то ось крутого — это k1_axis
    if k2 > k1:
        steep_axis = (k1_axis + 90) % 180
    else:
        steep_axis = k1_axis
    
    # 2. Abulafia-Koch (PCA)
    adj_cyl, adj_axis = apply_abulafia_koch(cyl_net, steep_axis, al)
    
    # 3. SIA
    final_cyl, final_axis = apply_sia(adj_cyl, adj_axis, sia, inc_axis)
    
    # 4. Векторный подбор линзы
    v_target = AstigmatismVector.from_polar(final_cyl, final_axis)
    
    suggestions = []
    min_residual = 99.0
    best_model = AlconToricDB.MODELS[0]["model"]

    # Добавляем вариант без торики (T0)
    v_none = AstigmatismVector(0,0)
    suggestions.append({
        "model": "None",
        "cyl_iol": 0,
        "cyl_cornea": 0,
        "residual": round(final_cyl, 2)
    })

    km = (k1 + k2) / 2
    best_clinical_model = None
    min_residual_magnitude = 99.0
    
    for m in AlconToricDB.MODELS:
        c_cornea = AlconToricDB.get_cyl_at_cornea(m["cyl_iol"], elp, km)
        v_lens = AstigmatismVector.from_polar(c_cornea, final_axis)
        v_res = v_target - v_lens
        res_mag, res_ax = v_res.to_polar()
        
        # Ось остаточного астигматизма (DISPLAY axis)
        disp_res_ax = (res_ax + 90) % 180
        if disp_res_ax == 0: disp_res_ax = 180

        is_wtr = 45 <= disp_res_ax <= 135
        
        suggestions.append({
            "model": m["model"],
            "cyl_iol": m["cyl_iol"],
            "cyl_cornea": round(c_cornea, 2),
            "residual": round(res_mag, 2),
            "res_axis": round(disp_res_ax, 0),
            "is_wtr": is_wtr
        })

    # ЛОГИКА ВЫБОРА ЛУЧШЕЙ ЛИНЗЫ:
    # 1. Сначала ищем адекватный WTR остаток (до 0.5)
    wtr_options = [s for s in suggestions if s["is_wtr"] and s["residual"] < 0.6]
    if wtr_options:
        # Берем тот WTR, который ближе всего к 0
        best_clinical_model = min(wtr_options, key=lambda x: x["residual"])["model"]
    else:
        # Если WTR вариантов нет или они огромные, берем просто минимальный остаток
        best_clinical_model = min(suggestions, key=lambda x: x["residual"])["model"]

    return {
        "net_corneal_cyl": round(cyl_net, 2),
        "total_corneal_cyl_adj": round(final_cyl, 2),
        "total_steep_axis": round(final_axis, 0),
        "best_model": best_clinical_model,
        "table": suggestions
    }
