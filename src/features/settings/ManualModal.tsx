import React from 'react';
import { C, F } from '../../constants/design';
import { useClinicStore } from '../../store/useClinicStore';

interface ManualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ManualModal({ isOpen, onClose }: ManualModalProps) {
  const { language } = useClinicStore();

  if (!isOpen) return null;

  const isRu = language === 'ru';

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ 
        fontFamily: F.sans, fontSize: 16, fontWeight: 800, color: C.indigo, 
        textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 10
      }}>
        <div style={{ width: 4, height: 16, background: C.indigo, borderRadius: 2 }} />
        {title}
      </h3>
      <div style={{ fontFamily: F.sans, fontSize: 14, lineHeight: 1.6, color: C.text, opacity: 0.9 }}>
        {children}
      </div>
    </div>
  );

  const Bullet = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.muted, marginTop: 8, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );

  return (
    <div 
      style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(5,5,10,0.9)', backdropFilter: 'blur(15px)', display: 'flex', flexDirection: 'column' }}
      onClick={onClose}
    >
      <div 
        style={{ 
          width: '100%', maxWidth: 500, height: '92vh', margin: 'auto auto 0',
          background: C.surface, borderRadius: '32px 32px 0 0', borderTop: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '24px 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}40` }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: F.sans, fontSize: 20, fontWeight: 900, color: C.text }}>
              {isRu ? 'Инструкция' : 'User Manual'}
            </h2>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted2, textTransform: 'uppercase', marginTop: 2 }}>
              RefMaster Surgical Assistant
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{ 
              width: 36, height: 36, borderRadius: '50%', background: C.surface2, border: 'none', 
              color: C.text, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' 
            }}
          >✕</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 60px', WebkitOverflowScrolling: 'touch' }}>
          
          <Section title={isRu ? 'Обзор' : 'Overview'}>
            <p style={{ marginTop: 0 }}>
              {isRu 
                ? 'RefMaster — это профессиональный трекер ваших результатов и хирургический ассистент. Он объединяет расчеты, базу данных и аналитику в одном интерфейсе.' 
                : 'RefMaster is a professional results tracker and surgical assistant. It combines calculations, database, and analytics in one interface.'}
            </p>
          </Section>

          <Section title={isRu ? 'AI-Сканер (OCR)' : 'AI-Scanner (OCR)'}>
            <Bullet>
              {isRu 
                ? 'Нажмите [📸 OCR] в карте пациента, чтобы мгновенно распознать данные с чеков ИОЛ-Мастера или авторефа.' 
                : 'Tap [📸 OCR] in the patient card to instantly recognize data from IOL-Master or Autoref printouts.'}
            </Bullet>
            <Bullet>
              {isRu 
                ? 'Система автоматически заполнит AL, ACD, LT и данные рефракции.' 
                : 'The system automatically fills AL, ACD, LT, and refraction data.'}
            </Bullet>
          </Section>

          <Section title={isRu ? 'Расчет ИОЛ' : 'IOL Calculation'}>
            <Bullet>
              {isRu 
                ? 'Haigis — вшитая офлайн-формула (работает без интернета).' 
                : 'Haigis — built-in offline formula (works without internet).'}
            </Bullet>
            <Bullet>
              {isRu 
                ? 'Barrett и Kane — облачные формулы (требуют интернет).' 
                : 'Barrett and Kane — cloud formulas (require internet).'}
            </Bullet>
            <Bullet>
              {isRu 
                ? '⚠️ Сверяйте торические расчеты с официальными калькуляторами производителей.' 
                : '⚠️ Always cross-check toric results with official manufacturer calculators.'}
            </Bullet>
          </Section>

          <Section title={isRu ? 'Pentacam и Астигматизм' : 'Pentacam & Astigmatism'}>
            {isRu 
              ? 'Для максимальной точности вводите Anterior и Posterior данные вручную. Система рассчитает Total Astigmatism, который является эталоном для ЛКЗ.' 
              : 'For maximum precision, enter Anterior and Posterior data manually. The system will calculate Total Astigmatism, the gold standard for LVC.'}
          </Section>

          <Section title={isRu ? 'Методы коррекции (Астигматизм)' : 'Correction Methods (Astigmatism)'}>
            <Bullet>
              <b style={{ color: C.indigo }}>Manifest:</b> {isRu ? 'Расчеты по данным манифестной (субъективной) рефракции.' : 'Calculations based on manifest (subjective) refraction.'}
            </Bullet>
            <Bullet>
              <b style={{ color: C.indigo }}>Corneal:</b> {isRu ? 'Ориентация на топографию роговицы для устранения неровностей.' : 'Focus on corneal topography to eliminate irregularities.'}
            </Bullet>
            <Bullet>
              <b style={{ color: C.indigo }}>Vector:</b> {isRu ? 'Комплексный анализ: объединяет оси манифеста, кератометрии и AR (узкий/широкий зрачок).' : 'Comprehensive analysis: combines manifest, keratometry, and AR (narrow/wide) axes.'}
            </Bullet>
            <Bullet>
              <b style={{ color: C.indigo }}>Wavefront:</b> {isRu ? 'Ручной ввод данных аберрометрии (Wavefront-guided) для точного отслеживания аберраций.' : 'Manual entry of wavefront-guided data for precise aberration tracking.'}
            </Bullet>
          </Section>

          <Section title={isRu ? 'Операционный день' : 'Surgical Day'}>
            <Bullet>
              {isRu 
                ? 'Назначайте дату операции в карте пациента, чтобы он попал в список «План».' 
                : 'Set a surgery date in the patient card to add them to the "Plan" list.'}
            </Bullet>
            <Bullet>
              {isRu 
                ? <><b style={{ color: C.indigo }}>Очередь:</b> В списке «План» используйте долгое нажатие (long-press) на пациента, чтобы перетащить его и изменить порядок в очереди.</>
                : <><b style={{ color: C.indigo }}>Queue:</b> In the "Plan" list, use long-press on a patient to drag and reorder them in the surgical queue.</>}
            </Bullet>
            <Bullet>
              {isRu 
                ? <><b style={{ color: C.indigo }}>Печать:</b> Нажмите иконку принтера в шапке списка «План», чтобы сформировать и распечатать бумажный список операций на день.</>
                : <><b style={{ color: C.indigo }}>Print:</b> Tap the printer icon in the "Plan" list header to generate and print a physical surgery list for the day.</>}
            </Bullet>
          </Section>

          <Section title={isRu ? 'Безопасность (PTA/RSB)' : 'Safety (PTA/RSB)'}>
            {isRu 
              ? 'Интерактивный стек роговицы показывает реальное соотношение слоев. Следите за PTA: индикатор станет красным при превышении порога в 47%.' 
              : 'Interactive corneal stack shows real layer ratios. Monitor PTA: indicator turns red when exceeding the 47% threshold.'}
          </Section>

          <Section title={isRu ? 'Лайфхаки и Жесты' : 'Pro Tips & Gestures'}>
            <Bullet>
              <b style={{ color: C.indigo }}>{isRu ? 'Смена глаза' : 'Eye Switch'}:</b> {isRu ? 'Свайп влево/вправо в любой области экрана.' : 'Swipe left/right anywhere on the screen.'}
            </Bullet>
            <Bullet>
              <b style={{ color: C.indigo }}>{isRu ? 'Деактивация' : 'Deactivate'}:</b> {isRu ? 'Зажмите (long-press) кнопку OD/OS в шапке.' : 'Long-press the OD/OS button in the header.'}
            </Bullet>
            <Bullet>
              <b style={{ color: C.indigo }}>{isRu ? 'Назад' : 'Back'}:</b> {isRu ? 'Свайп от левого края экрана.' : 'Swipe from the left edge of the screen.'}
            </Bullet>
          </Section>

          <Section title={isRu ? 'Аналитика и Номограммы' : 'Analytics & Nomograms'}>
            <p style={{ marginTop: 0 }}>
              {isRu 
                ? 'При достижении 100 выполненных операций (статус Done) система автоматически активирует аналитический блок.' 
                : 'Upon reaching 100 completed operations (status Done), the system automatically activates the analytical engine.'}
            </p>
            <Bullet>
              {isRu 
                ? 'RefMaster начнет выдавать персональные подсказки по номограммам для ИОЛ и лазерной коррекции на основе ваших реальных результатов.' 
                : 'RefMaster will begin providing personalized nomogram tips for IOL and laser correction based on your actual surgical outcomes.'}
            </Bullet>
          </Section>

          <div style={{ 
            marginTop: 40, padding: 20, borderRadius: 20, background: `${C.indigo}10`, 
            border: `1px solid ${C.indigo}30`, textAlign: 'center' 
          }}>
            <div style={{ fontSize: 18, marginBottom: 8 }}>💎</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.indigo }}>RefMaster Surgical OCR v2.3.1</div>
            <div style={{ fontSize: 11, color: C.muted2, marginTop: 4 }}>by MedEye Team</div>
          </div>

        </div>
      </div>
    </div>
  );
}
