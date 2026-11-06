export const weekDays = ['日', '一', '二', '三', '四', '五', '六']

export const months = [
  { label: '1月', value: 0 }, { label: '2月', value: 1 },
  { label: '3月', value: 2 }, { label: '4月', value: 3 },
  { label: '5月', value: 4 }, { label: '6月', value: 5 },
  { label: '7月', value: 6 }, { label: '8月', value: 7 },
  { label: '9月', value: 8 }, { label: '10月', value: 9 },
  { label: '11月', value: 10 }, { label: '12月', value: 11 }
]

export function getYearOptions(centerYear?: number) {
  const currentYear = typeof centerYear === 'number' ? centerYear : new Date().getFullYear()
  return Array.from({ length: 21 }, (_, i) => currentYear - 10 + i)
}

export const recentOptions = [
  { label: '今天', value: 'today' },
  { label: '本周', value: 'this_week' },
  { label: '本月', value: 'this_month' },
  { label: '近三个月', value: 'last_3_months' }
]

export const dateOptions = [
  { label: '过去', value: 'past' },
  { label: '未来', value: 'future' }
]
