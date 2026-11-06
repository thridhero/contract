export interface CalendarEvent {
  id: string
  title: string
  projectName: string
  date: Date
  type: 'pending' | 'completed' | 'urgent'
  priority: '高优先级' | '普通' | '低优先级'
  icon: string
  partyA?: string
  partyB?: string
  contractType?: string
  sourceCategory?: 'contract' | 'product'
}

export interface CalendarDay {
  date: Date
  day: number
  isCurrentMonth: boolean
  isToday: boolean
  events: CalendarEvent[]
}
