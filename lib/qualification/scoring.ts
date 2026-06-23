// lib/qualification/scoring.ts
// Replică exactă a logicii din TaxFlow_Formular_Calificare_Client_v2.xlsx

export interface QualificationField {
  key: string
  label: string
  options: { value: string; score: number; note?: string }[]
}

export const QUALIFICATION_FIELDS: QualificationField[] = [
  {
    key: 'employees', label: 'Angajați',
    options: [
      { value: '0–2', score: 1, note: 'Micro / startup foarte mic' },
      { value: '3–8', score: 2, note: 'Echipă mică, apar fluxuri recurente' },
      { value: '9–20', score: 3, note: 'Companie în creștere, complexitate reală' },
      { value: '21–50', score: 4, note: 'Companie matură, structură extinsă' },
    ],
  },
  {
    key: 'revenue', label: 'Cifră de afaceri (MDL/an)',
    options: [
      { value: '< 1.500.000', score: 1, note: 'Sub prag START' },
      { value: '1.500.000 – 4.000.000', score: 2, note: 'Interval GROW' },
      { value: '4.000.000 – 20.000.000', score: 3, note: 'Interval CONTROL' },
      { value: '20.000.000 – 40.000.000', score: 4, note: 'Interval STRATEGIC' },
    ],
  },
  {
    key: 'vat_regime', label: 'Regim TVA',
    options: [
      { value: 'Fără TVA', score: 1, note: 'Simplu' },
      { value: 'TVA recent', score: 2, note: 'Tranziție, risc de erori' },
      { value: 'TVA stabil', score: 3, note: 'Cerințe recurente de control' },
      { value: 'Mai multe regimuri / entități', score: 4, note: 'Necesită politici și control avansat' },
    ],
  },
  {
    key: 'activities_count', label: 'Număr activități',
    options: [
      { value: '1', score: 1, note: 'Simplu' },
      { value: '2–4', score: 3, note: 'Diversificare (control, marje)' },
      { value: 'Multiple / mixte', score: 4, note: 'Complexitate ridicată' },
    ],
  },
  {
    key: 'monthly_documents', label: 'Volum documente lunar',
    options: [
      { value: 'Redus', score: 1, note: 'Gestionabil fără procese complexe' },
      { value: 'Mediu', score: 2, note: 'Necesită ritm și disciplină' },
      { value: 'Mare / fluctuant', score: 3, note: 'Necesită standardizare + vizibilitate' },
    ],
  },
  {
    key: 'current_reporting', label: 'Raportare curentă',
    options: [
      { value: 'Nu există', score: 1, note: 'Black box' },
      { value: 'Simplă (profit/taxe/cash)', score: 2, note: 'Minim util' },
      { value: 'KPI / marje / cash-flow', score: 3, note: 'Management reporting' },
      { value: 'Bugete & scenarii', score: 4, note: 'Planificare financiară' },
    ],
  },
  {
    key: 'financial_decision_basis', label: 'Baza deciziei financiare',
    options: [
      { value: 'Instinct / sold cont', score: 1, note: 'Reactiv' },
      { value: 'Profit contabil', score: 2, note: 'Parțial' },
      { value: 'Cash-flow & marje', score: 3, note: 'Decizie sănătoasă' },
      { value: 'Date consolidate / scenarii', score: 4, note: 'Decizie strategică' },
    ],
  },
  {
    key: 'financial_manager', label: 'Cine gestionează financiarul',
    options: [
      { value: 'Nimeni clar', score: 2, note: 'Nevoie de structurare imediată' },
      { value: 'Contabil reactiv', score: 2, note: 'Risc de latență' },
      { value: 'Persoană internă suprasolicitată', score: 3, note: 'Necesită sistem și delegare' },
      { value: 'CFO / responsabil financiar', score: 4, note: 'Poate absorbi STRATEGIC' },
    ],
  },
  {
    key: 'main_expectation', label: 'Așteptare principală',
    options: [
      { value: 'Conformitate & liniște', score: 1, note: 'START' },
      { value: 'Ordine & control', score: 2, note: 'GROW' },
      { value: 'Claritate decizională & optimizare', score: 3, note: 'CONTROL' },
      { value: 'CFO extern / partener strategic', score: 4, note: 'STRATEGIC' },
    ],
  },
  {
    key: 'delegation_level', label: 'Nivel de delegare acceptat',
    options: [
      { value: 'Minim (doar execuție)', score: 1, note: 'Fit slab pentru modelul TaxFlow' },
      { value: 'Mediu (clarificări punctuale)', score: 2, note: 'Fit moderat' },
      { value: 'Ridicat (decizii ghidate)', score: 3, note: 'Fit bun' },
    ],
  },
  {
    key: 'structure_reaction', label: 'Reacție la structură (procese, reguli)',
    options: [
      { value: 'Rezistență', score: 0, note: 'Risc major de implementare' },
      { value: 'Acceptare', score: 2, note: 'Ok' },
      { value: 'Cere explicit', score: 3, note: 'Fit foarte bun' },
    ],
  },
  {
    key: 'special_project', label: 'Proiect special (Transformation)',
    options: [
      { value: 'Nu', score: 0 },
      { value: 'Da', score: 1, note: 'Restructurare / haos sever / setup' },
    ],
  },
]

export interface QualificationAnswers {
  employees?: string
  revenue?: string
  vat_regime?: string
  activities_count?: string
  monthly_documents?: string
  current_reporting?: string
  financial_decision_basis?: string
  financial_manager?: string
  main_expectation?: string
  delegation_level?: string
  structure_reaction?: string
  special_project?: string
}

export interface QualificationResult {
  scoreDimension: number | null
  scoreComplexity: number | null
  scoreMaturity: number | null
  scoreFit: number | null
  overallScore: number | null
  recommendedPackage: string
  riskFlags: string[]
}

function scoreOf(fieldKey: string, answer?: string): number | null {
  if (!answer) return null
  const field = QUALIFICATION_FIELDS.find(f => f.key === fieldKey)
  const opt = field?.options.find(o => o.value === answer)
  return opt ? opt.score : null
}

function roundUpAverage(scores: (number | null)[]): number | null {
  const valid = scores.filter((s): s is number => s !== null)
  if (valid.length === 0) return null
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length
  return Math.ceil(avg)
}

const PACKAGE_BY_SCORE: Record<number, string> = {
  1: 'TAXFLOW START',
  2: 'TAXFLOW GROW',
  3: 'TAXFLOW CONTROL',
  4: 'TAXFLOW STRATEGIC',
}

export function computeQualification(answers: QualificationAnswers): QualificationResult {
  const sEmployees = scoreOf('employees', answers.employees)
  const sRevenue = scoreOf('revenue', answers.revenue)
  const sVat = scoreOf('vat_regime', answers.vat_regime)
  const sActivities = scoreOf('activities_count', answers.activities_count)
  const sDocuments = scoreOf('monthly_documents', answers.monthly_documents)
  const sReporting = scoreOf('current_reporting', answers.current_reporting)
  const sDecisionBasis = scoreOf('financial_decision_basis', answers.financial_decision_basis)
  const sFinManager = scoreOf('financial_manager', answers.financial_manager)
  const sExpectation = scoreOf('main_expectation', answers.main_expectation)
  const sDelegation = scoreOf('delegation_level', answers.delegation_level)
  const sStructure = scoreOf('structure_reaction', answers.structure_reaction)
  const sSpecialProject = scoreOf('special_project', answers.special_project)

  // Scoruri agregate — ROUNDUP(AVERAGE(...))
  const scoreDimension = roundUpAverage([sEmployees, sRevenue, sVat])
  const scoreComplexity = roundUpAverage([sActivities, sDocuments])
  const scoreMaturity = roundUpAverage([sReporting, sDecisionBasis, sFinManager])
  const scoreFit = roundUpAverage([sExpectation, sDelegation, sStructure])

  // OverallScore — necesită minim 4 răspunsuri completate + grupurile maturitate/fit complete
  const answeredCount = Object.values(answers).filter(v => v).length
  const maturityComplete = answers.current_reporting && answers.financial_decision_basis && answers.financial_manager
  const fitComplete = answers.main_expectation && answers.delegation_level && answers.structure_reaction

  let overallScore: number | null = null
  if (answeredCount >= 4 && maturityComplete && fitComplete) {
    const candidates = [scoreDimension, scoreComplexity, scoreMaturity, scoreFit].filter((s): s is number => s !== null)
    if (candidates.length > 0) overallScore = Math.max(...candidates)
  }

  // Recomandare pachet
  let recommendedPackage = ''
  if (sSpecialProject === 1) {
    recommendedPackage = 'TAXFLOW TRANSFORMATION'
  } else if (overallScore !== null) {
    recommendedPackage = PACKAGE_BY_SCORE[overallScore] || ''
  }

  // Flaguri risc
  const riskFlags: string[] = []
  if (overallScore !== null) {
    if (sStructure === 0) riskFlags.push('Risc: rezistență la structură')
    if (sDelegation === 1) riskFlags.push('Risc: delegare minimă (fit slab)')
    if (overallScore >= 3 && scoreFit !== null && scoreFit <= 2) riskFlags.push('Risc: scor mare dar fit moderat (aliniere necesară)')
    if (overallScore === 4 && sExpectation !== null && sExpectation < 4) riskFlags.push('Risc: STRATEGIC fără cerere explicită de CFO')
  }

  return {
    scoreDimension, scoreComplexity, scoreMaturity, scoreFit,
    overallScore, recommendedPackage, riskFlags,
  }
}

// Mapare recomandare → package_type (pentru a găsi template-ul corect în offer_templates)
export const PACKAGE_NAME_TO_TYPE: Record<string, string> = {
  'TAXFLOW START': 'start',
  'TAXFLOW GROW': 'grow',
  'TAXFLOW CONTROL': 'control',
  'TAXFLOW STRATEGIC': 'strategic',
  'TAXFLOW TRANSFORMATION': 'transformation',
}
