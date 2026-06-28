import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCSVRow(fields: (string | null | undefined)[]): string {
  return fields.map(escapeCSV).join(',')
}

function getDateString(): string {
  return new Date().toISOString().split('T')[0]
}

async function getFinancesData() {
  return db.financeEntry.findMany({ orderBy: { date: 'desc' } })
}

async function getJournalData() {
  return db.journalEntry.findMany({ orderBy: { date: 'desc' } })
}

async function getGoalsData() {
  return db.goal.findMany({ orderBy: { order: 'asc' } })
}

async function getMemoriesData() {
  return db.memory.findMany({ orderBy: { date: 'desc' } })
}

async function getScoresData() {
  return db.lifeAreaScore.findMany({ orderBy: { date: 'desc' } })
}

async function getCheckinsData() {
  return db.checkIn.findMany({ orderBy: { date: 'desc' } })
}

function financesToCSV(data: Awaited<ReturnType<typeof getFinancesData>>): string {
  const headers = ['Date', 'Type', 'Amount', 'Category', 'Purpose', 'Aligned', 'Notes']
  const rows = data.map(e => toCSVRow([e.date, e.type, String(e.amount), e.category, e.purpose, e.aligned != null ? String(e.aligned) : '', e.notes]))
  return [headers.join(','), ...rows].join('\n')
}

function journalToCSV(data: Awaited<ReturnType<typeof getJournalData>>): string {
  const headers = ['Date', 'Area', 'Title', 'Content', 'Mood', 'Tags']
  const rows = data.map(e => toCSVRow([e.date, e.area, e.title, e.content, e.mood, e.tags]))
  return [headers.join(','), ...rows].join('\n')
}

function goalsToCSV(data: Awaited<ReturnType<typeof getGoalsData>>): string {
  const headers = ['Area', 'Title', 'Description', 'Status', 'Target Date', 'Why It Matters', 'Success Metric']
  const rows = data.map(e => toCSVRow([e.area, e.title, e.description, e.status, e.targetDate, e.whyItMatters, e.successMetric]))
  return [headers.join(','), ...rows].join('\n')
}

function memoriesToCSV(data: Awaited<ReturnType<typeof getMemoriesData>>): string {
  const headers = ['Date', 'Type', 'Area', 'Content']
  const rows = data.map(e => toCSVRow([e.date, e.type, e.area, e.content]))
  return [headers.join(','), ...rows].join('\n')
}

function scoresToCSV(data: Awaited<ReturnType<typeof getScoresData>>): string {
  const headers = ['Date', 'Faith', 'Health', 'Career', 'Havilah', 'Finances', 'Relationships', 'PersonalGrowth', 'Overall']
  const rows = data.map(e => toCSVRow([e.date, String(e.faith), String(e.health), String(e.career), String(e.havilah), String(e.finances), String(e.relationships), String(e.personalGrowth), String(e.overall)]))
  return [headers.join(','), ...rows].join('\n')
}

function checkinsToCSV(data: Awaited<ReturnType<typeof getCheckinsData>>): string {
  const headers = ['Date', 'Type', 'Data', 'AI Response']
  const rows = data.map(e => toCSVRow([e.date, e.type, e.data, e.aiResponse]))
  return [headers.join(','), ...rows].join('\n')
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const type = searchParams.get('type') || 'all'
  const format = searchParams.get('format') || 'csv'
  const dateStr = getDateString()

  if (!['csv', 'json'].includes(format)) {
    return NextResponse.json({ error: 'Invalid format. Use csv or json.' }, { status: 400 })
  }

  if (!['finances', 'journal', 'goals', 'memories', 'scores', 'checkins', 'all'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type. Use finances, journal, goals, memories, scores, checkins, or all.' }, { status: 400 })
  }

  try {
    if (type === 'all') {
      const [finances, journal, goals, memories, scores, checkins] = await Promise.all([
        getFinancesData(),
        getJournalData(),
        getGoalsData(),
        getMemoriesData(),
        getScoresData(),
        getCheckinsData(),
      ])

      if (format === 'json') {
        const allData = { finances, journal, goals, memories, scores, checkins }
        const jsonStr = JSON.stringify(allData, null, 2)
        return new NextResponse(jsonStr, {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="myos-all-${dateStr}.json"`,
          },
        })
      } else {
        // CSV for "all" — combine all into a single CSV with section headers
        const parts: string[] = []
        parts.push('=== FINANCES ===')
        parts.push(financesToCSV(finances))
        parts.push('')
        parts.push('=== JOURNAL ===')
        parts.push(journalToCSV(journal))
        parts.push('')
        parts.push('=== GOALS ===')
        parts.push(goalsToCSV(goals))
        parts.push('')
        parts.push('=== MEMORIES ===')
        parts.push(memoriesToCSV(memories))
        parts.push('')
        parts.push('=== SCORES ===')
        parts.push(scoresToCSV(scores))
        parts.push('')
        parts.push('=== CHECK-INS ===')
        parts.push(checkinsToCSV(checkins))

        const csvStr = parts.join('\n')
        return new NextResponse(csvStr, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="myos-all-${dateStr}.csv"`,
          },
        })
      }
    }

    // Single type export
    let csvContent: string
    let jsonData: unknown

    switch (type) {
      case 'finances': {
        const data = await getFinancesData()
        csvContent = financesToCSV(data)
        jsonData = data
        break
      }
      case 'journal': {
        const data = await getJournalData()
        csvContent = journalToCSV(data)
        jsonData = data
        break
      }
      case 'goals': {
        const data = await getGoalsData()
        csvContent = goalsToCSV(data)
        jsonData = data
        break
      }
      case 'memories': {
        const data = await getMemoriesData()
        csvContent = memoriesToCSV(data)
        jsonData = data
        break
      }
      case 'scores': {
        const data = await getScoresData()
        csvContent = scoresToCSV(data)
        jsonData = data
        break
      }
      case 'checkins': {
        const data = await getCheckinsData()
        csvContent = checkinsToCSV(data)
        jsonData = data
        break
      }
      default:
        return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
    }

    if (format === 'csv') {
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="myos-${type}-${dateStr}.csv"`,
        },
      })
    } else {
      const jsonStr = JSON.stringify(jsonData, null, 2)
      return new NextResponse(jsonStr, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="myos-${type}-${dateStr}.json"`,
        },
      })
    }
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
