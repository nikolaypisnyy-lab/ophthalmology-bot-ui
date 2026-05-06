import type { IOLLens } from '../types/iol';

// ULIB-оптимизированные константы Haigis (ocusoft.de/ulib)
const H = (a0: number, a1: number, a2: number) => ({ a0, a1, a2 });
// Для Tecnis-семейства (ZCB00/ZCT/ZCU/ZXR/etc.) — используем данные AMO Tecnis 1 ZCB00 (n=2041)
const TECNIS = H(-1.302, 0.21, 0.251);

export const IOL_DB: IOLLens[] = [
  { name: 'Personal Constant',              a: 0,      a_kane: 0      },
  { name: 'Alcon DFTx',                     a: 119.15, a_kane: 119.06, haigis: H(1.397, 0.222, 0.126) },
  { name: 'Alcon MN60MA',                   a: 119.2,  a_kane: 119.24, haigis: H(5.78,  0.4,   0.12 ) },
  { name: 'Alcon SA60AT',                   a: 118.53, a_kane: 118.7,  haigis: H(-0.111, 0.249, 0.179) },
  { name: 'Alcon SN60WF',                   a: 118.99, a_kane: 118.98, haigis: H(-0.769, 0.234, 0.217) },
  { name: 'Alcon SN6AD',                    a: 119.01, a_kane: 118.92, haigis: H(-0.385, 0.197, 0.204) },
  { name: 'Alcon SN6ATx',                   a: 119.26, a_kane: 119.28, haigis: H(-0.323, 0.213, 0.208) },
  { name: 'Alcon SND1Tx',                   a: 119.36, a_kane: 119.27, haigis: H(-0.341, 0.241, 0.204) },
  { name: 'Alcon SV25Tx',                   a: 119.51, a_kane: 119.42, haigis: H(1.66,  0.4,   0.1  ) },
  { name: 'Alcon TFNTx',                    a: 119.26, a_kane: 119.17, haigis: H(1.39,  0.4,   0.1  ) },
  { name: 'AST Asqelio EDOF Toric',         a: 0,      a_kane: 119.23, haigis: H(1.54,  0.4,   0.12 ) },
  { name: 'AST Asqelio Monofocal Toric',    a: 0,      a_kane: 119.23, haigis: H(1.54,  0.4,   0.11 ) },
  { name: 'AST Asqelio Trifocal Toric',     a: 0,      a_kane: 119.34, haigis: H(1.66,  0.4,   0.11 ) },
  { name: 'B+L LuxGood',                    a: 0,      a_kane: 119.24, haigis: H(1.659, 0.4,   0.13 ) },
  { name: 'B+L LuxGood Toric',              a: 0,      a_kane: 119.24, haigis: H(1.659, 0.4,   0.13 ) },
  { name: 'B+L LuxLife',                    a: 0,      a_kane: 118.69, haigis: H(0.669, 0.322, 0.131) },
  { name: 'B+L LuxLife Toric',              a: 0,      a_kane: 118.69, haigis: H(0.669, 0.322, 0.131) },
  { name: 'B+L LuxSmart',                   a: 0,      a_kane: 118.45, haigis: H(0.518, 0.371, 0.120) },
  { name: 'B+L LuxSmart Toric',             a: 0,      a_kane: 118.45, haigis: H(0.518, 0.371, 0.120) },
  { name: 'B+L enVista',                    a: 0,      a_kane: 119.31, haigis: H(1.46,  0.4,   0.1  ) },
  { name: 'B+L enVista Aspire',             a: 0,      a_kane: 119.1,  haigis: H(1.46,  0.4,   0.11 ) },
  { name: 'B+L enVista Aspire Toric',       a: 0,      a_kane: 119.1,  haigis: H(1.46,  0.4,   0.11 ) },
  { name: 'B+L enVista Envy',               a: 0,      a_kane: 119.33, haigis: H(1.64,  0.4,   0.11 ) },
  { name: 'B+L enVista Envy Toric',         a: 0,      a_kane: 119.33, haigis: H(1.64,  0.4,   0.11 ) },
  { name: 'B+L enVista Toric',              a: 0,      a_kane: 119.25, haigis: H(1.46,  0.4,   0.1  ) },
  { name: 'Bausch & Lomb BL1UT',            a: 119.2,  a_kane: 119.11, haigis: H(1.94,  1.01,  0.10 ) },
  { name: 'Bausch & Lomb LI60AO',           a: 118.57, a_kane: 118.48, haigis: H(0.057, 0.186, 0.171) },
  { name: 'Bausch & Lomb MX60',             a: 119.15, a_kane: 119.06, haigis: H(1.46,  0.4,   0.1  ) },
  { name: 'Bausch & Lomb MX60ET',           a: 119.15, a_kane: 119.06, haigis: H(1.46,  0.4,   0.1  ) },
  { name: 'Bausch & Lomb MX60ET(USA)',      a: 119.15, a_kane: 119.06, haigis: H(1.46,  0.4,   0.1  ) },
  { name: 'Bausch & Lomb MX60T',            a: 119.15, a_kane: 119.06, haigis: H(1.46,  0.4,   0.1  ) },
  { name: 'Hoya iSert 251',                 a: 118.48, a_kane: 118.39, haigis: H(-0.831, 0.281, 0.198) },
  { name: 'Hoya iSert 351',                 a: 118.48, a_kane: 118.39, haigis: H(-0.542, 0.161, 0.204) },
  { name: 'HumanOptics TORICA',             a: 0,      a_kane: 118.3,  haigis: H(1.18,  0.4,   0.1  ) },
  { name: 'HumanOptics TrivaT',             a: 0,      a_kane: 119.21, haigis: H(1.426, 0.4,   0.11 ) },
  { name: 'J&J AR40M',                      a: 118.71, a_kane: 118.62, haigis: H(0.472, 0.077, 0.174) },
  { name: 'J&J AR40e',                      a: 118.71, a_kane: 118.62, haigis: H(0.472, 0.077, 0.174) },
  { name: 'J&J DIU',                        a: 119.39, a_kane: 119.3,  haigis: TECNIS },
  { name: 'J&J ZCB00',                      a: 119.39, a_kane: 119.3,  haigis: TECNIS },
  { name: 'J&J ZCT',                        a: 119.39, a_kane: 119.3,  haigis: TECNIS },
  { name: 'J&J ZCT(USA)',                   a: 119.39, a_kane: 119.3,  haigis: TECNIS },
  { name: 'J&J ZCU',                        a: 119.39, a_kane: 119.3,  haigis: TECNIS },
  { name: 'J&J ZHR00V',                     a: 119.39, a_kane: 119.3,  haigis: TECNIS },
  { name: 'J&J ZHW',                        a: 119.39, a_kane: 119.3,  haigis: TECNIS },
  { name: 'J&J ZKU',                        a: 119.39, a_kane: 119.3,  haigis: TECNIS },
  { name: 'J&J ZLU',                        a: 119.39, a_kane: 119.3,  haigis: TECNIS },
  { name: 'J&J ZXR00',                      a: 119.39, a_kane: 119.3,  haigis: TECNIS },
  { name: 'J&J ZXT',                        a: 119.39, a_kane: 119.3,  haigis: TECNIS },
  { name: 'J+J AR40e',                      a: 0,      a_kane: 118.7,  haigis: H(0.472, 0.077, 0.174) },
  { name: 'J+J ZCB00',                      a: 0,      a_kane: 119.36, haigis: TECNIS },
  { name: 'J+J ZCTx',                       a: 0,      a_kane: 119.36, haigis: TECNIS },
  { name: 'Lenstec SBL-3',                  a: 117.77, a_kane: 117.68, haigis: H(0.537, 0.333, 0.126) },
  { name: 'MBI T302A',                      a: 118.65, a_kane: 118.56, haigis: H(1.67,  0.4,   0.10 ) },
  { name: 'Ophtec 565',                     a: 118.48, a_kane: 118.39, haigis: H(1.57,  0.4,   0.10 ) },
  { name: 'Primus-HD Toric',                a: 0,      a_kane: 119.2,  haigis: H(1.499, 0.4,   0.13 ) },
  { name: 'Rayner RayOne EMV',              a: 118.29, a_kane: 118.2,  haigis: H(1.044, 0.4,   0.11 ) },
  { name: 'SIFI Mini Toric',                a: 0,      a_kane: 118.94, haigis: H(-2.906, 0.493, 0.271) },
  { name: 'SIFI Mini WELL',                 a: 118.74, a_kane: 118.65, haigis: H(1.33,  0.4,   0.1  ) },
  { name: 'SIFI Mini WELL Toric',           a: 0,      a_kane: 118.72, haigis: H(1.33,  0.4,   0.1  ) },
  { name: 'Sensar AAB00',                   a: 119.0,  a_kane: 119.0,  haigis: H(-1.004, 0.182, 0.232) },
  { name: 'Sensar AR40e',                   a: 118.71, a_kane: 118.62, haigis: H(0.472, 0.077, 0.174) },
  { name: 'Sensar AR40M',                   a: 118.71, a_kane: 118.62, haigis: H(0.472, 0.077, 0.174) },
  { name: 'Zeiss 409M',                     a: 118.32, a_kane: 118.34, haigis: H(0.322, 0.162, 0.158) },
  { name: 'Zeiss 709M',                     a: 118.5,  a_kane: 118.41, haigis: H(1.13,  0.4,   0.12 ) },
];

/** Поиск ИОЛ по подстроке (case-insensitive) */
export function searchIOL(query: string): IOLLens[] {
  const q = query.toLowerCase().trim();
  if (!q) return IOL_DB;
  return IOL_DB.filter(l => l.name.toLowerCase().includes(q));
}

/** Точный поиск по имени */
export function findIOL(name: string): IOLLens | undefined {
  return IOL_DB.find(l => l.name === name);
}

/** Является ли линза торической */
export function isToricIOL(lens: IOLLens): boolean {
  return lens.name.toLowerCase().includes('toric') ||
    lens.name.toLowerCase().includes('tct') ||
    lens.name.toLowerCase().includes('zct') ||
    lens.name.toLowerCase().includes('sn6at') ||
    lens.name.toLowerCase().includes('snd1t') ||
    lens.name.toLowerCase().includes('sv25t') ||
    lens.name.toLowerCase().includes('tfnt');
}
