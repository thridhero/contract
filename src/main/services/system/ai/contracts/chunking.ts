export type ContractChunkSectionType =
  | 'header'
  | 'basic_info'
  | 'party_info'
  | 'subject_matter'
  | 'amount'
  | 'payment'
  | 'delivery'
  | 'acceptance'
  | 'invoice_tax'
  | 'validity'
  | 'signature'
  | 'general_clause'
  | 'unknown'

export interface ContractChunk {
  id: string
  index: number
  title: string
  sectionType: ContractChunkSectionType
  content: string
  compactContent: string
  keywords: string[]
  importanceScore: number
  isNoise: boolean
}

interface FieldRetrievalProfile {
  sectionTypes: ContractChunkSectionType[]
  keywords: string[]
  topK: number
}

const DEFAULT_TOP_K = 6
const MAX_CHUNK_LENGTH = 1800
const MIN_CHUNK_LENGTH = 220

const FIELD_RETRIEVAL_PROFILES: Record<string, FieldRetrievalProfile> = {
  contractName: {
    sectionTypes: ['header', 'basic_info', 'signature'],
    keywords: ['合同名称', '项目名称', '协议名称', '本合同', '合同'],
    topK: 3,
  },
  contractCode: {
    sectionTypes: ['header', 'basic_info', 'signature'],
    keywords: ['合同编号', '协议编号', '编号', '项目编号'],
    topK: 3,
  },
  signingDate: {
    sectionTypes: ['header', 'signature', 'basic_info', 'validity'],
    keywords: ['签订日期', '签约日期', '签署日期', '日期', '生效日期'],
    topK: 4,
  },
  contractType: {
    sectionTypes: ['header', 'basic_info', 'subject_matter'],
    keywords: ['采购', '服务', '委托', '运维', '开发', '合同'],
    topK: 4,
  },
  clientName: {
    sectionTypes: ['party_info', 'header', 'signature'],
    keywords: ['甲方', '采购方', '委托方', '发包方', '买方'],
    topK: 4,
  },
  partyBName: {
    sectionTypes: ['party_info', 'header', 'signature'],
    keywords: ['乙方', '供应方', '受托方', '承包方', '卖方'],
    topK: 4,
  },
  contractSummary: {
    sectionTypes: ['header', 'subject_matter', 'basic_info'],
    keywords: ['项目概况', '服务内容', '合同内容', '项目名称', '采购内容'],
    topK: 4,
  },
  contractAmount: {
    sectionTypes: ['amount', 'payment', 'basic_info'],
    keywords: ['合同总价', '合同金额', '总金额', '价税合计', '人民币', '含税'],
    topK: 4,
  },
  receiptPlans: {
    sectionTypes: ['payment', 'amount'],
    keywords: ['付款方式', '付款节点', '付款计划', '收款计划', '预付款', '进度款', '尾款'],
    topK: 6,
  },
  partyAContact: {
    sectionTypes: ['party_info', 'signature', 'basic_info', 'header'],
    keywords: ['甲方', '采购方', '委托方', '发包方', '联系人', '项目联系人', '联络人', '对接人', '经办人', '负责人'],
    topK: 5,
  },
  partyAContactMobile: {
    sectionTypes: ['party_info', 'signature', 'basic_info'],
    keywords: ['甲方', '联系人', '项目联系人', '手机号', '手机', '移动电话', '联系方式', '联系电话', '电话'],
    topK: 5,
  },
  partyAContactPhone: {
    sectionTypes: ['party_info', 'signature', 'basic_info'],
    keywords: ['甲方', '联系人', '项目联系人', '电话', '联系电话', '座机', '固话', '通讯地址'],
    topK: 5,
  },
  partyAContactEmail: {
    sectionTypes: ['party_info', 'signature', 'basic_info'],
    keywords: ['甲方', '联系人', '项目联系人', '邮箱', '电子信箱', 'Email', 'E-mail', '邮件'],
    topK: 4,
  },
  partyAContactIdNumber: {
    sectionTypes: ['party_info', 'signature', 'basic_info'],
    keywords: ['甲方', '联系人', '项目联系人', '身份证', '身份证号', '证件号码'],
    topK: 4,
  },
  partyBContact: {
    sectionTypes: ['party_info', 'signature', 'basic_info', 'header'],
    keywords: ['乙方', '供应方', '受托方', '承包方', '卖方', '联系人', '项目联系人', '联络人', '对接人', '经办人', '负责人'],
    topK: 5,
  },
  partyBContactMobile: {
    sectionTypes: ['party_info', 'signature', 'basic_info'],
    keywords: ['乙方', '联系人', '项目联系人', '手机号', '手机', '移动电话', '联系方式', '联系电话', '电话'],
    topK: 5,
  },
  partyBContactPhone: {
    sectionTypes: ['party_info', 'signature', 'basic_info'],
    keywords: ['乙方', '联系人', '项目联系人', '电话', '联系电话', '座机', '固话', '通讯地址'],
    topK: 5,
  },
  partyBContactEmail: {
    sectionTypes: ['party_info', 'signature', 'basic_info'],
    keywords: ['乙方', '联系人', '项目联系人', '邮箱', '电子信箱', 'Email', 'E-mail', '邮件'],
    topK: 4,
  },
  partyBContactIdNumber: {
    sectionTypes: ['party_info', 'signature', 'basic_info'],
    keywords: ['乙方', '联系人', '项目联系人', '身份证', '身份证号', '证件号码'],
    topK: 4,
  },
  partyALegalRepName: {
    sectionTypes: ['party_info', 'signature'],
    keywords: ['甲方', '法定代表人', '法人', '授权代表', '委托代理人'],
    topK: 4,
  },
  partyALegalRepMobile: {
    sectionTypes: ['party_info', 'signature'],
    keywords: ['甲方', '法定代表人', '法人', '手机号', '手机', '联系电话'],
    topK: 4,
  },
  partyALegalRepEmail: {
    sectionTypes: ['party_info', 'signature'],
    keywords: ['甲方', '法定代表人', '法人', '邮箱', '电子信箱', 'Email', 'E-mail'],
    topK: 3,
  },
  partyALegalRepIdNumber: {
    sectionTypes: ['party_info', 'signature'],
    keywords: ['甲方', '法定代表人', '法人', '身份证', '身份证号', '证件号码'],
    topK: 3,
  },
  partyAPhone: {
    sectionTypes: ['party_info', 'signature', 'basic_info'],
    keywords: ['甲方', '联系电话', '电话', '传真', '联系方式'],
    topK: 4,
  },
  partyAAddress: {
    sectionTypes: ['party_info', 'signature', 'basic_info'],
    keywords: ['甲方', '住所地', '地址', '通讯地址'],
    topK: 4,
  },
  partyATaxNumber: {
    sectionTypes: ['party_info', 'invoice_tax', 'signature'],
    keywords: ['甲方', '税号', '统一社会信用代码', '纳税人识别号'],
    topK: 4,
  },
  partyABankName: {
    sectionTypes: ['party_info', 'invoice_tax', 'payment', 'signature'],
    keywords: ['甲方', '开户行', '银行', '开户银行'],
    topK: 4,
  },
  partyABankAccount: {
    sectionTypes: ['party_info', 'invoice_tax', 'payment', 'signature'],
    keywords: ['甲方', '账号', '银行账号', '账户', '开户账号'],
    topK: 4,
  },
  partyAInvoiceType: {
    sectionTypes: ['invoice_tax', 'party_info'],
    keywords: ['甲方', '发票', '专用发票', '普通发票', '专票', '普票'],
    topK: 3,
  },
  partyBLegalRepName: {
    sectionTypes: ['party_info', 'signature'],
    keywords: ['乙方', '法定代表人', '法人', '授权代表', '委托代理人'],
    topK: 4,
  },
  partyBLegalRepMobile: {
    sectionTypes: ['party_info', 'signature'],
    keywords: ['乙方', '法定代表人', '法人', '手机号', '手机', '联系电话'],
    topK: 4,
  },
  partyBLegalRepEmail: {
    sectionTypes: ['party_info', 'signature'],
    keywords: ['乙方', '法定代表人', '法人', '邮箱', '电子信箱', 'Email', 'E-mail'],
    topK: 3,
  },
  partyBLegalRepIdNumber: {
    sectionTypes: ['party_info', 'signature'],
    keywords: ['乙方', '法定代表人', '法人', '身份证', '身份证号', '证件号码'],
    topK: 3,
  },
  partyBPhone: {
    sectionTypes: ['party_info', 'signature', 'basic_info'],
    keywords: ['乙方', '联系电话', '电话', '传真', '联系方式'],
    topK: 4,
  },
  partyBAddress: {
    sectionTypes: ['party_info', 'signature', 'basic_info'],
    keywords: ['乙方', '住所地', '地址', '通讯地址'],
    topK: 4,
  },
  partyBTaxNumber: {
    sectionTypes: ['party_info', 'invoice_tax', 'signature'],
    keywords: ['乙方', '税号', '统一社会信用代码', '纳税人识别号'],
    topK: 4,
  },
  partyBBankName: {
    sectionTypes: ['party_info', 'invoice_tax', 'payment', 'signature'],
    keywords: ['乙方', '开户行', '银行', '开户银行'],
    topK: 4,
  },
  partyBBankAccount: {
    sectionTypes: ['party_info', 'invoice_tax', 'payment', 'signature'],
    keywords: ['乙方', '账号', '银行账号', '账户', '开户账号'],
    topK: 4,
  },
  partyBInvoiceType: {
    sectionTypes: ['invoice_tax', 'party_info'],
    keywords: ['乙方', '发票', '专用发票', '普通发票', '专票', '普票'],
    topK: 3,
  },
}

const FALLBACK_SECTION_TYPES: ContractChunkSectionType[] = [
  'header',
  'basic_info',
  'party_info',
  'subject_matter',
  'amount',
  'payment',
  'delivery',
  'acceptance',
  'invoice_tax',
  'validity',
  'signature',
  'unknown',
]

const FALLBACK_KEYWORDS = [
  '标的', '服务内容', '项目概况', '采购内容', '工作内容', '合同内容',
  '金额', '价款', '费用', '付款', '支付', '结算', '收款', '发票', '税号', '开户行', '银行账号',
  '生效', '期限', '终止', '签订日期', '签署日期',
  '租赁', '租期', '租赁期限', '租金', '押金', '车牌', '车辆', '车型', '车架号', 'VIN', '发动机号', '里程', '交车', '取车', '还车', '归还', '保险', '违章',
]

const SECTION_RULES: Array<{
  type: ContractChunkSectionType
  title: RegExp[]
  content?: RegExp[]
  importance: number
  noise?: boolean
}> = [
  {
    type: 'general_clause',
    title: [/违约责任/, /争议解决/, /不可抗力/, /适用法律/, /保密/, /通知送达/, /附则/],
    content: [/违约责任/, /争议解决/, /不可抗力/, /适用法律/, /保密义务/],
    importance: 0.1,
    noise: true,
  },
  {
    type: 'signature',
    title: [/签署/, /签字/, /盖章/, /落款/, /签订/],
    content: [/法定代表人/, /委托代理人/, /盖章/, /签署日期/, /签订日期/],
    importance: 0.95,
  },
  {
    type: 'payment',
    title: [/付款/, /支付/, /结算/, /收款/],
    content: [/付款方式/, /支付方式/, /付款节点/, /进度款/, /预付款/, /尾款/, /收款计划/],
    importance: 0.95,
  },
  {
    type: 'amount',
    title: [/金额/, /价款/, /总价/, /费用/, /租金/, /押金/],
    content: [/合同总价/, /含税金额/, /人民币/, /价税合计/, /大写/, /租金/, /押金/, /超时费/, /超里程/, /超里程费/],
    importance: 0.92,
  },
  {
    type: 'party_info',
    title: [/合同双方/, /当事人/, /甲方/, /乙方/],
    content: [/甲方/, /乙方/, /采购方/, /供应方/, /委托方/, /受托方/],
    importance: 0.98,
  },
  {
    type: 'subject_matter',
    title: [/标的/, /服务内容/, /项目概况/, /采购内容/, /工作内容/, /租赁/, /车辆信息/, /租赁物/, /租赁车辆/],
    content: [/服务内容/, /项目概况/, /采购内容/, /工作内容/, /合同标的/, /租赁/, /承租/, /出租/, /车辆/, /车牌/, /车型/, /车架号/, /VIN/, /发动机号/],
    importance: 0.8,
  },
  {
    type: 'delivery',
    title: [/交付/, /实施/, /履行/, /交车/, /取车/, /还车/, /归还/],
    content: [/交付/, /履行期限/, /实施地点/, /项目周期/, /交车/, /取车/, /还车/, /归还/, /移交/, /验车/, /车辆交付/],
    importance: 0.7,
  },
  {
    type: 'acceptance',
    title: [/验收/, /检验/],
    content: [/验收标准/, /验收方式/, /检验/],
    importance: 0.72,
  },
  {
    type: 'invoice_tax',
    title: [/发票/, /税率/, /税费/, /税号/, /纳税人识别号/, /统一社会信用代码/, /开户行/, /开户银行/, /银行账号/],
    content: [/增值税/, /专用发票/, /普通发票/, /税率/, /税号/, /纳税人识别号/, /统一社会信用代码/, /开户行/, /开户银行/, /银行账号/, /账号/, /购方/, /销方/],
    importance: 0.65,
  },
  {
    type: 'validity',
    title: [/生效/, /期限/, /终止/, /租期/, /租赁期限/],
    content: [/生效日期/, /有效期/, /履行期限/, /终止/, /租期/, /租赁期限/, /起租/, /还车日期/, /归还日期/],
    importance: 0.68,
  },
  {
    type: 'basic_info',
    title: [/合同/, /协议/, /说明/],
    content: [/合同编号/, /合同名称/, /签订日期/, /项目名称/],
    importance: 0.88,
  },
]

const normalizeLine = (value: string) => String(value || '').replace(/\r/g, '').trim()

const splitParagraphs = (content: string): string[] => {
  return String(content || '')
    .split(/\n{2,}/)
    .map(item => item.split('\n').map(line => line.trim()).filter(Boolean).join('\n'))
    .map(item => item.trim())
    .filter(Boolean)
}

const isSectionHeading = (line: string): boolean => {
  const text = normalizeLine(line)
  if (!text) return false
  if (/^#{1,6}\s+/.test(text)) return true
  if (/^第[\d一二三四五六七八九十百千万零〇]+条/.test(text)) return true
  if (/^[一二三四五六七八九十]+[、.]/.test(text)) return true
  if (/^(合同双方|当事人信息|合同金额|付款方式|支付方式|结算方式|签署页|签字盖章|项目概况|服务内容|验收标准|争议解决|违约责任|不可抗力|附则|租赁期限|租期|车辆信息|租赁物|租金|押金|交车|取车|还车|归还|保险|违章处理)/.test(text)) return true
  return false
}

const extractHeadingTitle = (line: string): string => {
  return normalizeLine(line)
    .replace(/^#{1,6}\s+/, '')
    .replace(/^第[\d一二三四五六七八九十百千万零〇]+条[：:\s]*/, '')
    .trim()
}

const dedupe = (items: string[]): string[] => Array.from(new Set(items.filter(Boolean)))

const extractKeywords = (content: string): string[] => {
  const text = normalizeLine(content)
  const matched: string[] = []
  const patterns = [
    '合同编号', '合同名称', '签订日期', '甲方', '乙方', '采购方', '供应方', '委托方', '受托方',
    '合同总价', '金额', '人民币', '付款方式', '付款节点', '预付款', '进度款', '尾款',
    '发票', '税率', '税号', '纳税人识别号', '统一社会信用代码', '开户行', '开户银行', '银行账号', '账号', '购方', '销方',
    '交付', '验收', '生效日期', '履行期限', '违约责任', '争议解决',
    '租赁', '租期', '租赁期限', '租金', '押金', '车牌', '车辆', '车型', '车架号', 'VIN', '发动机号', '里程', '交车', '取车', '还车', '归还', '保险', '违章',
  ]
  for (const keyword of patterns) {
    if (text.includes(keyword)) matched.push(keyword)
  }
  return dedupe(matched)
}

const compactChunkContent = (content: string): string => {
  const lines = String(content || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
  const result: string[] = []
  let bodySkipped = 0
  for (const line of lines) {
    if (/^(双方同意|经协商一致|按照国家有关规定|本合同未尽事宜)/.test(line) || line.length > 140) {
      bodySkipped += 1
      continue
    }
    result.push(line)
    if (result.length >= 16) break
  }
  if (result.length === 0) {
    return lines.slice(0, 8).join('\n').slice(0, 1200)
  }
  if (bodySkipped > 0) {
    result.push(`（已省略 ${bodySkipped} 段冗长条款正文）`)
  }
  return result.join('\n').slice(0, 1600)
}

const classifyChunk = (title: string, content: string): {
  sectionType: ContractChunkSectionType
  importanceScore: number
  isNoise: boolean
} => {
  const target = `${title}\n${content}`
  for (const rule of SECTION_RULES) {
    const titleHit = rule.title.some(pattern => pattern.test(title))
    const contentHit = rule.content?.some(pattern => pattern.test(target)) ?? false
    if (titleHit || contentHit) {
      return {
        sectionType: rule.type,
        importanceScore: rule.importance,
        isNoise: rule.noise === true,
      }
    }
  }
  return {
    sectionType: 'unknown',
    importanceScore: 0.4,
    isNoise: false,
  }
}

const buildChunk = (index: number, title: string, content: string): ContractChunk => {
  const normalizedContent = normalizeLine(content)
  const normalizedTitle = normalizeLine(title) || `片段${index + 1}`
  const { sectionType, importanceScore, isNoise } = classifyChunk(normalizedTitle, normalizedContent)
  return {
    id: `chunk-${index + 1}`,
    index,
    title: normalizedTitle,
    sectionType,
    content: normalizedContent,
    compactContent: compactChunkContent(normalizedContent),
    keywords: extractKeywords(`${normalizedTitle}\n${normalizedContent}`),
    importanceScore,
    isNoise,
  }
}

const pushChunk = (chunks: ContractChunk[], title: string, lines: string[]) => {
  const content = lines.map(line => normalizeLine(line)).filter(Boolean).join('\n')
  if (!content) return

  if (content.length <= MAX_CHUNK_LENGTH) {
    chunks.push(buildChunk(chunks.length, title, content))
    return
  }

  const paragraphs = splitParagraphs(content)
  let buffer = ''
  let part = 1
  for (const paragraph of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph
    if (candidate.length > MAX_CHUNK_LENGTH && buffer) {
      chunks.push(buildChunk(chunks.length, `${title} ${part}`, buffer))
      part += 1
      buffer = paragraph
      continue
    }
    buffer = candidate
  }
  if (buffer) {
    chunks.push(buildChunk(chunks.length, part > 1 ? `${title} ${part}` : title, buffer))
  }
}

export function buildContractChunks(sourceText: string): ContractChunk[] {
  const lines = String(sourceText || '').replace(/\r/g, '').split('\n')
  const chunks: ContractChunk[] = []
  let currentTitle = '合同主信息'
  let currentLines: string[] = []

  for (const rawLine of lines) {
    const line = normalizeLine(rawLine)
    if (!line) {
      if (currentLines.length > 0) currentLines.push('')
      continue
    }

    if (isSectionHeading(line) && currentLines.length > 0) {
      pushChunk(chunks, currentTitle, currentLines)
      currentTitle = extractHeadingTitle(line) || line
      currentLines = []
      continue
    }

    if (isSectionHeading(line) && currentLines.length === 0) {
      currentTitle = extractHeadingTitle(line) || line
      continue
    }

    currentLines.push(line)
  }

  if (currentLines.length > 0) {
    pushChunk(chunks, currentTitle, currentLines)
  }

  const merged: ContractChunk[] = []
  for (const chunk of chunks) {
    const prev = merged[merged.length - 1]
    if (
      prev
      && prev.sectionType === chunk.sectionType
      && prev.content.length < MIN_CHUNK_LENGTH
      && chunk.content.length < MAX_CHUNK_LENGTH
    ) {
      prev.content = `${prev.content}\n${chunk.content}`.trim()
      prev.compactContent = compactChunkContent(prev.content)
      prev.keywords = dedupe([...prev.keywords, ...chunk.keywords])
      prev.importanceScore = Math.max(prev.importanceScore, chunk.importanceScore)
      prev.isNoise = prev.isNoise && chunk.isNoise
      continue
    }
    merged.push({ ...chunk, index: merged.length, id: `chunk-${merged.length + 1}` })
  }

  if (merged.length === 0) {
    return [buildChunk(0, '合同全文', String(sourceText || '').trim())].filter(item => item.content)
  }
  return merged
}

export function buildChunkedContext(chunks: ContractChunk[]): string {
  return chunks
    .map(chunk => `## [${chunk.sectionType}] ${chunk.title}\n${chunk.compactContent}`)
    .join('\n\n')
    .slice(0, 24000)
}

export function selectChunksForFields(
  chunks: ContractChunk[],
  targetFields: string[],
  options?: { includeGeneralClauses?: boolean },
): ContractChunk[] {
  if (!Array.isArray(chunks) || chunks.length === 0) return []
  const fields = Array.isArray(targetFields) && targetFields.length > 0
    ? dedupe(targetFields.map(item => String(item || '').trim()).filter(Boolean))
    : Object.keys(FIELD_RETRIEVAL_PROFILES)

  const scoreMap = new Map<string, { chunk: ContractChunk; score: number }>()
  const unknownFields = fields.filter(field => !FIELD_RETRIEVAL_PROFILES[field])

  for (const field of fields) {
    const profile = FIELD_RETRIEVAL_PROFILES[field]
    if (!profile) continue
    const ranked = chunks
      .map(chunk => {
        let score = chunk.importanceScore
        if (profile.sectionTypes.includes(chunk.sectionType)) score += 3
        const keywordHits = profile.keywords.filter(keyword => chunk.content.includes(keyword) || chunk.title.includes(keyword)).length
        score += keywordHits * 1.25
        if (chunk.sectionType === 'signature' && (field === 'signingDate' || field === 'clientName' || field === 'partyBName')) score += 1.2
        if (chunk.sectionType === 'general_clause') score -= 3
        if (chunk.isNoise) score -= 2
        if (chunk.content.length > 2000) score -= 0.5
        return { chunk, score }
      })
      .filter(item => item.score > 0 || profile.sectionTypes.includes(item.chunk.sectionType))
      .sort((a, b) => b.score - a.score)
      .slice(0, profile.topK)

    for (const item of ranked) {
      const existing = scoreMap.get(item.chunk.id)
      if (!existing || item.score > existing.score) {
        scoreMap.set(item.chunk.id, item)
      }
    }
  }

  if (unknownFields.length > 0) {
    const fallbackRanked = chunks
      .map(chunk => {
        let score = chunk.importanceScore
        if (FALLBACK_SECTION_TYPES.includes(chunk.sectionType)) score += 2
        const keywordHits = FALLBACK_KEYWORDS.filter(keyword => chunk.content.includes(keyword) || chunk.title.includes(keyword)).length
        score += keywordHits * 0.8
        if (chunk.sectionType === 'general_clause') score -= 3
        if (chunk.isNoise) score -= 2
        if (chunk.content.length > 2000) score -= 0.5
        return { chunk, score }
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(8, 3 + unknownFields.length))

    for (const item of fallbackRanked) {
      const existing = scoreMap.get(item.chunk.id)
      if (!existing || item.score > existing.score) {
        scoreMap.set(item.chunk.id, item)
      }
    }
  }

  const selected = Array.from(scoreMap.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.chunk.index - b.chunk.index
    })
    .map(item => item.chunk)

  if (selected.length === 0) {
    const fallback = chunks
      .filter(chunk => chunk.sectionType !== 'general_clause' && !chunk.isNoise)
      .map(chunk => ({
        chunk,
        score: chunk.importanceScore + (FALLBACK_SECTION_TYPES.includes(chunk.sectionType) ? 2 : 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, DEFAULT_TOP_K)
      .map(item => item.chunk)
    return fallback
  }

  const filtered = options?.includeGeneralClauses
    ? selected
    : selected.filter(chunk => chunk.sectionType !== 'general_clause' || fields.some(field => field === 'receiptPlans'))

  return filtered.slice(0, DEFAULT_TOP_K + Math.min(fields.length, 4) + Math.min(unknownFields.length, 4))
}
