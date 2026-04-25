import type { EyeData, RefractionPlan, AstigSource } from '../types/refraction';
import type { LaserType } from '../types/refraction';
import {
  astigVector, vectorMag, vectorAxis, vectorDiff,
  sumCylinders, angleDiff, roundQ,
} from './astigmatism';
import { getNomogramTarget } from './nomogram';
import { calcEx500 } from './ex500';

/**
 * Рассчитать план ЛКЗ для одного глаза.
 *
 * @param eye           данные глаза (рефракция + кератометрия)
 * @param laser         тип лазера
 * @param useCorneal    (legacy) использовать роговичный астигматизм — переопределяется astigStrategy
 * @param doRound       округлять результат до 0.25 D
 * @param age           возраст пациента (для возрастных номограмм)
 * @param noNomogram    не применять номограммы (использовать чистый манифест)
 * @param astigStrategy стратегия астигматизма: 'manifest' | 'corneal' | 'vector'
 */
export function computeRefPlan(
  eye: EyeData,
  laser: LaserType,
  useCorneal: boolean,
  doRound: boolean,
  age: number,
  noNomogram: boolean = false,
  astigStrategy?: 'manifest' | 'corneal' | 'vector',
  userOffset: number = 0,
): RefractionPlan | null {
  try {
    const v = (f: keyof EyeData): number | null => {
      const n = parseFloat(eye[f] as string);
      return isNaN(n) ? null : n;
    };

    // Resolve effective strategy (astigStrategy takes precedence over legacy useCorneal)
    const effectiveStrategy = astigStrategy ?? (useCorneal ? 'corneal' : 'manifest');
    const useCorneaEffective = effectiveStrategy === 'corneal';
    const useVectorCompromise = effectiveStrategy === 'vector';

    const mSph = v('man_sph'), mCyl = v('man_cyl'), mAx = v('man_ax');
    const nSph = v('n_sph'),   nCyl = v('n_cyl'),   nAx = v('n_ax');
    const cSph = v('c_sph'),   cCyl = v('c_cyl'),   cAx = v('c_ax');
    const k1   = v('k1'),      k2   = v('k2'),       kAx = v('k_ax');
    const nKerCyl = v('kercyl'), nKerAx = v('kerax');
    const pTotC = v('p_tot_c'), pTotA = v('p_tot_a');
    const pAntC = v('p_ant_c'), pAntA = v('p_ant_a');
    const pPostC = v('p_post_c'), pPostA = v('p_post_a');

    // ── Взвешенная рефракция: 70% субъективная + 30% циклоплегия ─────────────
    const primarySph = mSph !== null ? mSph : (nSph !== null ? nSph : null);
    const primaryCyl = mCyl !== null ? mCyl : (nCyl !== null ? nCyl : null);

    let sph = primarySph ?? 0;
    let refCyl = primaryCyl ?? 0;

    // ── Взвешенная рефракция: 70% субъективная + 30% циклоплегия ─────────────
    if (!noNomogram) {
      if (primarySph !== null && cSph !== null) {
        sph = primarySph * 0.7 + cSph * 0.3;
      }
      // Цилиндр берем на 100% из манифеста (не взвешиваем с широким зрачком)
      refCyl = primaryCyl ?? 0;
    }

    // Приоритет оси: Манифест > Узкий > Циклоплегия
    let refAx = mAx ?? (nAx ?? (cAx ?? 0));

    // Предупреждение о значительном расхождении
    let deltaWarning: string | null = null;
    if (primarySph !== null && cSph !== null && Math.abs(primarySph - cSph) > 1.0) {
      deltaWarning = `⚠️ Значительный сдвиг сферы (${Math.abs(primarySph - cSph).toFixed(2)}D). Проверьте аккомодацию.`;
    } else if (primaryCyl !== null && cCyl !== null && Math.abs(primaryCyl - cCyl) > 0.75) {
      deltaWarning = `⚠️ Сдвиг цилиндра (${Math.abs(primaryCyl - cCyl).toFixed(2)}D). Возможна нестабильность оси.`;
    }

    // Нормализация в минусовую нотацию
    if (refCyl > 0) {
      sph += refCyl;
      refCyl = -refCyl;
      refAx = ((refAx ?? 0) + 90) % 180;
      if (refAx === 0) refAx = 180;
    }
    if (!refCyl) refCyl = 0;
    if (!refAx) refAx = 0;

    const refSE = sph + refCyl / 2.0;

    let cyl = refCyl, ax = refAx;
    let corCyl: number | null = null, corAx: number | null = null;
    let refrCyl: number | null = refCyl, refrAx: number | null = refAx;
    let dAxUsed: number | null = null;
    let cornCylUsed: number | null = null, cornAxUsed: number | null = null;

    let astigSrc: AstigSource = mAx !== null
      ? 'Субъективно (Манифест)'
      : nAx !== null
        ? 'Автореф (Узкий)'
        : cAx !== null
          ? 'Циклоплегия (Широкий)'
          : 'Нет данных';

    // ── Роговичный астигматизм — resolve corneal source ───────────────────────
    let cornealCc: number | null = null, cornealCa: number | null = null;
    let cornealSrcLabel: AstigSource = 'Нет данных';
    if (pTotC !== null && pTotA !== null) {
      cornealCc = pTotC; cornealCa = pTotA; cornealSrcLabel = 'Pentacam Total';
    } else if (pAntC !== null) {
      const pAx = pAntA ?? (kAx ?? ax);
      if (pPostC !== null) {
        // Суммируем векторы: передний (минус) + задний (плюс) = вычитание при совпадении осей
        const s = sumCylinders(-Math.abs(pAntC), pAx, Math.abs(pPostC), pPostA ?? 90);
        cornealCc = s.cyl; cornealCa = s.ax; cornealSrcLabel = 'Pentacam Ant+Post';
      } else {
        const s = sumCylinders(pAntC, pAx, 0, 0);
        cornealCc = s.cyl; cornealCa = s.ax; cornealSrcLabel = 'Pentacam Ant';
      }
    } else if (k1 !== null && k2 !== null && k1 > 0 && k2 > 0) {
      cornealCc = -Math.abs(k1 - k2); cornealCa = kAx ?? nKerAx ?? ax; cornealSrcLabel = 'K1/K2';
    } else if (nKerCyl !== null && nKerCyl !== 0) {
      cornealCc = nKerCyl > 0 ? -nKerCyl : nKerCyl; cornealCa = nKerAx ?? kAx ?? ax; cornealSrcLabel = 'Keratometry';
    }

    if (useCorneaEffective && cornealCc !== null && cornealCa !== null) {
      corCyl = cornealCc; corAx = cornealCa;
      cornCylUsed = cornealCc; cornAxUsed = cornealCa;
      cyl = cornealCc; ax = cornealCa;
      sph = refSE - cyl / 2.0;
      dAxUsed = refrAx !== null ? angleDiff(refrAx, cornealCa) : null;
      astigSrc = cornealSrcLabel;
    } else if (useVectorCompromise && cornealCc !== null && cornealCa !== null && refrCyl !== null && refrAx !== null) {
      // 50/50 vector average of manifest and corneal astigmatism
      const refV = astigVector(refrCyl, refrAx);
      const corV = astigVector(cornealCc, cornealCa);
      if (refV && corV) {
        const blendV = { x: (refV.x + corV.x) / 2, y: (refV.y + corV.y) / 2 };
        const blendMag = vectorMag(blendV);
        const blendAx = vectorAxis(blendV);
        const blendCyl = -blendMag;
        corCyl = cornealCc; corAx = cornealCa;
        cornCylUsed = blendCyl; cornAxUsed = blendAx;
        cyl = blendCyl; ax = blendAx;
        sph = refSE - cyl / 2.0;
        dAxUsed = angleDiff(refrAx, cornealCa);
        astigSrc = cornealSrcLabel;
      }
    }

    // ── Тип астигматизма и целевой остаток ────────────────────────────────────
    let astigType: RefractionPlan['astigType'] = null;
    let astigTarget = '0.00 D (цель астигматизма)';
    let isCompromise = false;

    if (cyl < 0) {
      let normAx = ax % 180;
      if (normAx <= 0) normAx += 180;
      const isWTR = (normAx >= 160 && normAx <= 180) || (normAx >= 0 && normAx <= 20);
      const isATR = normAx >= 70 && normAx <= 110;

      if (!noNomogram) {
        if (isWTR) {
          astigType = 'WTR';
          astigTarget = '-0.50 D @ 180°';
          // Поправку на WTR делаем для всех, КРОМЕ Visx (у него своя номограмма)
          if (laser !== 'visx_s4ir') {
            cyl += 0.50;
            sph -= 0.250;
          }
          if (cyl > 0) cyl = 0;
        } else if (isATR) {
          astigType = 'ATR';
          astigTarget = '0.00 D (полная коррекция)';
        } else {
          astigType = 'Oblique';
          astigTarget = '0.00 D (полная коррекция)';
          // Для косого астигматизма ограничиваем коррекцию роговичным пределом (кроме Visx)
          if (laser !== 'visx_s4ir' && cornealCc !== null && cyl < cornealCc) {
            const diff = cornealCc - cyl; 
            cyl = cornealCc;
            sph -= diff / 2.0;
          }
        }
      } else {
        if (isWTR) astigType = 'WTR';
        else if (isATR) astigType = 'ATR';
        else astigType = 'Oblique';
        astigTarget = '0.00 D (без поправок)';
      }
    }

    // ── Лазерная номограмма ───────────────────────────────────────────────────
    let pSph = sph, pCyl = cyl;
    const a = age || 0;

    if (!noNomogram) {
        if (laser === 'visx_s4ir') {
            if (a > 0) pSph = getNomogramTarget(a, sph);
            // Убрали добавку на высокий цилиндр, так как она приводила к гиперкоррекции
        } else if (laser === 'ex500') {
            if (sph <= 0 && cyl <= 0) {
                const r = calcEx500(sph, cyl, a);
                pSph = r.sph; pCyl = r.cyl;
            } else if (a > 0 && a < 30) {
                pSph = sph * 1.10;
            }
        } else if (laser === 'visumax_800') {
            pSph = sph * 1.05; pCyl = cyl * 1.07;
        } else if (laser === 'visumax_500') {
            pSph = sph * 1.10; pCyl = cyl * 1.15;
        } else if (laser === 'smartsight') {
            pSph = sph * 1.10; pCyl = cyl * 1.10;
        } else if (laser === 'silk') {
            pSph = sph * 1.05; pCyl = cyl * 1.05;
        } else if (laser === 'mel90') {
            let sc = 1.03;
            if (a < 25) sc += 0.02;
            else if (a > 40) sc -= 0.03;
            pSph = sph * sc;
        }
    }

    pSph += userOffset;
    
    pSph = roundQ(pSph, doRound);
    pCyl = roundQ(pCyl, doRound);

    // ── КЛИНИЧЕСКОЕ ПРАВИЛО: Если астигматизм роговицы ничтожен (<=0.25), 
    // а в рефракции он есть — НЕ ТРОГАЕМ ЦИЛИНДР лазером.
    if (cornealCc !== null && Math.abs(cornealCc) <= 0.25) {
      pCyl = 0;
    }

    // ── Alpins векторный анализ ───────────────────────────────────────────────
    let oraMag: number | null = null, oraAx: number | null = null;
    if (corCyl !== null && corAx !== null && refrCyl !== null && refrAx !== null) {
      // ORA = манифест − роговица (внутриглазной компонент астигматизма)
      const corV = astigVector(corCyl, corAx);
      const refV = astigVector(refrCyl, refrAx);
      const oraV = vectorDiff(corV, refV);
      oraMag = vectorMag(oraV);
      oraAx = vectorAxis(oraV);
    }

    const tiaCyl = useCorneaEffective && corCyl !== null ? corCyl : refrCyl;
    const tiaAx  = useCorneaEffective && corAx  !== null ? corAx  : refrAx;
    const siaCyl = pCyl;
    const siaAx  = Math.round(ax);

    const tiaAstig = tiaCyl !== null && tiaAx !== null ? astigVector(tiaCyl, tiaAx) : null;
    const siaAstig = siaCyl !== null ? astigVector(siaCyl, siaAx) : null;
    const dvAstig  = vectorDiff(siaAstig, tiaAstig);

    const tiaMag = vectorMag(tiaAstig);
    const siaMag = vectorMag(siaAstig);
    const dvMag  = vectorMag(dvAstig);

    const ci = tiaMag > 0 ? Math.round((siaMag / tiaMag) * 100) / 100 : null;
    const me = Math.round((siaMag - tiaMag) * 100) / 100;
    const ae = tiaAx !== null ? angleDiff(siaAx, tiaAx) : null;

    // ── Роговичный астигматизм (информационно) ────────────────────────────────
    let kAstig: RefractionPlan['kAstig'] = null;
    if (pTotC !== null) {
      kAstig = { val: Math.abs(pTotC).toFixed(2), ax: pTotA, src: 'Pentacam Total' };
    } else if (k1 !== null && k2 !== null && k1 > 0 && k2 > 0) {
      kAstig = { val: Math.abs(k1 - k2).toFixed(2), ax: kAx, src: 'K1/K2' };
    } else if (nKerCyl !== null && nKerCyl !== 0) {
      kAstig = { val: Math.abs(nKerCyl).toFixed(2), ax: nKerAx, src: 'Keratometry' };
    }

    // --- ФИНАЛЬНАЯ НОРМАЛИЗАЦИЯ (Принудительный минус-цилиндр для плана) ---
    if (pCyl > 0) {
        pSph = pSph + pCyl;
        pCyl = -pCyl;
        ax = (ax + 90) % 180;
        if (ax <= 0) ax += 180;
    }

    return {
      sph: pSph, cyl: pCyl, ax: Math.round(ax),
      astigSrc, astigType, astigTarget, isCompromise,
      cornCyl: cornCylUsed, cornAx: cornAxUsed, dAx: dAxUsed,
      kAstig,
      bcva: eye.bcva || null, uva: eye.uva || null,
      nSph, nCyl: nCyl !== null ? nCyl : null,
      cSph, cCyl: cCyl !== null ? cCyl : null,
      corCyl, corAx, refrCyl, refrAx,
      tiaCyl, tiaAx, siaCyl, siaAx,
      tiaMag: tiaMag ? tiaMag.toFixed(2) : null,
      siaMag: siaMag ? siaMag.toFixed(2) : null,
      dvMag:  dvMag  ? dvMag.toFixed(2)  : null,
      ora:    oraMag !== null ? oraMag.toFixed(2) : null,
      oraAx:  oraAx  !== null ? Math.round(oraAx) : null,
      ci, me, ae,
      deltaWarning,
    };
  } catch (err) {
    console.error('computeRefPlan error', err);
    return null;
  }
}
