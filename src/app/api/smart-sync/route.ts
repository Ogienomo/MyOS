import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userid'
import { getZAI } from '@/lib/ai'

const SMART_SYNC_SYSTEM_PROMPT = `You are a data extraction assistant for MyOS, a personal life operating system.

Your job is to analyze the user's message and extract SEVEN types of structured information:

1. GOAL UPDATES: If the user mentions completing or making progress on any goals or tasks, identify them.
2. FINANCE ENTRIES: If the user mentions receiving or spending money, extract the details.
3. MOOD INDICATORS: If the user mentions how they're feeling, their energy level, or focus, extract mood data. Look for keywords like: tired, exhausted, drained, energized, pumped, focused, distracted, happy, sad, anxious, stressed, calm, motivated, unmotivated, sluggish, sharp, foggy, great, terrible, wonderful, awful, etc. Also infer from context (e.g., "I've been grinding all night" → low energy, "I crushed that presentation" → high mood/focus).
4. PATTERN OBSERVATIONS: If you notice repeated behaviors, strengths, weaknesses, or emerging patterns in what the user says, flag them. For example: "I keep procrastinating on X", "I always feel drained after Y", "I'm getting better at Z", "I notice I struggle with W".
5. LIFE EVENTS: Detect specific life events mentioned across ALL areas of life. This is the most important new category — be AGGRESSIVE about extracting these:
   - Schedule/plan items that could become tasks (e.g., "I need to finish the report by Friday", "Meeting with client tomorrow")
   - Health-related mentions: sleep quality ("didn't sleep well", "slept 8 hours"), exercise ("went to the gym", "did a 5k run"), meals ("skipped breakfast", "ate junk food"), illness symptoms ("headache", "feeling sick")
   - Relationship mentions: who they spent time with, relationship quality ("had a great conversation with mom", "argument with my friend", "dinner with the team")
   - Learning/reading mentions: books read, courses taken, skills practiced, new knowledge gained ("reading Atomic Habits", "learned about React hooks", "finished that online course")
   - Spiritual practice mentions: prayer, scripture, devotion, worship, church attendance ("prayed this morning", "went to church", "read Psalm 23", "had a powerful worship time")
6. SUGGESTED TASKS: If the user mentions things they need to do or plan to do that aren't covered by goal updates, extract them as potential tasks.
7. HABIT COMPLETIONS: If the user mentions completing a recurring activity or habit (e.g., "I went to the gym", "I read for 30 minutes", "I meditated today", "I prayed this morning", "I did my workout", "I journaled"), check if it matches any of their tracked habits. Be AGGRESSIVE about matching — if the user describes doing something that sounds like one of their habits, flag it. Match based on the habit title and the activity described.

You MUST return ONLY valid JSON in this exact format (no markdown, no explanation, just JSON):
{
  "goalUpdates": [
    {
      "title": "the goal title (approximate match is ok)",
      "status": "Completed" or "In Progress",
      "taskUpdates": [
        {
          "title": "the task title (approximate match is ok)",
          "status": "Completed" or "In Progress"
        }
      ]
    }
  ],
  "financeEntries": [
    {
      "type": "received" or "spent",
      "amount": 150000,
      "category": "category like Salary, Client Payment, Transport, Food, etc.",
      "purpose": "what it was for"
    }
  ],
  "moodEntries": [
    {
      "mood": 7,
      "energy": 5,
      "focus": 6,
      "note": "Brief context of why this mood/energy/focus rating"
    }
  ],
  "patterns": [
    {
      "type": "strength" or "weakness" or "pattern" or "correction" or "win",
      "area": "faith" or "health" or "career" or "havilah" or "finances" or "relationships" or "personalGrowth",
      "content": "Description of the pattern observed"
    }
  ],
  "lifeEvents": [
    {
      "area": "faith" or "health" or "career" or "havilah" or "finances" or "relationships" or "personalGrowth",
      "event": "Description of what happened",
      "significance": "high" or "medium" or "low"
    }
  ],
  "suggestedTasks": [
    {
      "title": "Task description",
      "area": "faith" or "health" or "career" or "havilah" or "finances" or "relationships" or "personalGrowth",
      "priority": "high" or "medium" or "low"
    }
  ],
  "habitCompletions": [
    {
      "habitTitle": "The title of the matching habit (exact or close match)",
      "confidence": "high" or "medium" or "low"
    }
  ]
}

Rules:
- Only include entries that are clearly mentioned or strongly implied in the message. Do NOT hallucinate.
- For mood entries: mood/energy/focus should be 1-10. Infer from language and context.
  - Very negative words (terrible, awful, exhausted, broken) → mood 1-3
  - Mildly negative (tired, stressed, okay, meh) → mood 4-5
  - Neutral (fine, alright, normal) → mood 6
  - Positive (good, productive, motivated) → mood 7-8
  - Very positive (great, amazing, fantastic, on fire) → mood 9-10
  - Same scale applies to energy and focus independently.
- For patterns: only flag if the message explicitly mentions a recurring behavior or the user reflects on a pattern.
- For life events: be AGGRESSIVE — extract ANY mention of activities, interactions, habits, or occurrences across all life areas. Even casual mentions count. "Had lunch with Sarah" → relationship event. "Slept at 2am" → health event. "Read a chapter of the Bible" → faith event.
- For goal updates, use the title as closely as possible - the system will do fuzzy matching.
- For finance entries, amounts should be numbers (no currency symbols or commas).
- If nothing relevant is found in a category, return an empty array for that category.
- For habit completions: match the user's described activity against the habit titles listed in the CURRENT HABITS section. Use fuzzy matching — e.g., "I hit the gym" matches a habit titled "Gym workout", "I read my Bible" matches "Morning devotion". Only include if you have at least medium confidence.
- Return ONLY the JSON object, nothing else.`

interface SmartSyncRequest {
  message: string
  checkInType?: string
}

interface GoalUpdate {
  title: string
  status: string
  taskUpdates: Array<{ title: string; status: string }>
}

interface FinanceEntryInput {
  type: string
  amount: number
  category: string
  purpose: string
}

interface MoodEntryInput {
  mood: number
  energy: number
  focus: number
  note: string
}

interface PatternInput {
  type: string
  area: string
  content: string
}

interface LifeEventInput {
  area: string
  event: string
  significance: string
}

interface SuggestedTaskInput {
  title: string
  area: string
  priority: string
}

interface HabitCompletionInput {
  habitTitle: string
  confidence: string
}

interface SmartSyncResult {
  goalUpdates: GoalUpdate[]
  financeEntries: FinanceEntryInput[]
  moodEntries: MoodEntryInput[]
  patterns: PatternInput[]
  lifeEvents: LifeEventInput[]
  suggestedTasks: SuggestedTaskInput[]
  habitCompletions: HabitCompletionInput[]
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request)
    const body: SmartSyncRequest = await request.json()
    const { message } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Call AI to analyze the message
    const zai = await getZAI()

    // Get all current goals with tasks for context
    const allGoals = await db.goal.findMany({
      where: { userId },
      include: { tasks: true },
    })

    const goalsContext = allGoals
      .map(
        (g) =>
          `[${g.area}] "${g.title}" (status: ${g.status}) — Tasks: ${g.tasks.map((t) => `"${t.title}" (${t.status})`).join(', ')}`
      )
      .join('\n')

    // Get recent mood logs for context
    const recentLogs = await db.quickLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 3,
    })
    const moodContext = recentLogs.length > 0
      ? recentLogs.map(l => `  ${l.date} ${l.time}: mood=${l.mood} energy=${l.energy} focus=${l.focus}${l.note ? ` note="${l.note}"` : ''}`).join('\n')
      : 'No recent mood logs.'

    // Get active habits for context
    const activeHabits = await db.habit.findMany({
      where: { userId, active: true },
    })
    const habitsContext = activeHabits.length > 0
      ? activeHabits.map(h => `  - "${h.title}" [${h.area}] (${h.frequency})`).join('\n')
      : 'No active habits.'

    const response = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: SMART_SYNC_SYSTEM_PROMPT },
        {
          role: 'system',
          content: `CURRENT GOALS IN DATABASE:\n${goalsContext}`,
        },
        {
          role: 'system',
          content: `RECENT MOOD LOGS:\n${moodContext}`,
        },
        {
          role: 'system',
          content: `CURRENT HABITS:\n${habitsContext}`,
        },
        {
          role: 'user',
          content: `Analyze this message for goal completions, financial data, mood indicators, patterns, and habit completions:\n\n"${message}"`,
        },
      ],
      stream: false,
    })

    const content =
      response?.choices?.[0]?.message?.content ||
      response?.choices?.[0]?.content ||
      ''

    // Parse the AI response as JSON
    let syncData: SmartSyncResult
    try {
      // Try to extract JSON from the response (in case it has markdown wrapping)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return NextResponse.json({
          goalUpdates: [],
          financeEntries: [],
          moodEntries: [],
          patterns: [],
          rawResponse: content,
        })
      }
      syncData = JSON.parse(jsonMatch[0]) as SmartSyncResult
    } catch {
      console.error('Failed to parse smart-sync AI response:', content)
      return NextResponse.json({
        goalUpdates: [],
        financeEntries: [],
        moodEntries: [],
        patterns: [],
        rawResponse: content,
      })
    }

    // Now apply the updates to the database
    const goalsUpdated: string[] = []
    const tasksUpdated: string[] = []
    const financeEntriesCreated: string[] = []
    const moodEntriesCreated: string[] = []
    const memoriesCreated: string[] = []
    const lifeEventsCreated: string[] = []
    const suggestedTasksCreated: string[] = []
    const habitsCompleted: string[] = []

    // Process goal updates
    for (const goalUpdate of syncData.goalUpdates || []) {
      // Find matching goal by fuzzy title match
      const matchingGoal = findMatchingGoal(goalUpdate.title, allGoals)

      if (matchingGoal) {
        // Update goal status if it changed
        if (
          goalUpdate.status &&
          goalUpdate.status !== matchingGoal.status
        ) {
          await db.goal.update({
            where: { id: matchingGoal.id },
            data: { status: goalUpdate.status },
          })
          goalsUpdated.push(matchingGoal.id)
        }

        // Update tasks
        for (const taskUpdate of goalUpdate.taskUpdates || []) {
          const matchingTask = matchingGoal.tasks.find((t) =>
            fuzzyMatch(taskUpdate.title, t.title)
          )

          if (matchingTask && taskUpdate.status !== matchingTask.status) {
            await db.task.update({
              where: { id: matchingTask.id },
              data: { status: taskUpdate.status },
            })
            tasksUpdated.push(matchingTask.id)
          }
        }
      }
    }

    // Process finance entries
    const today = new Date().toISOString().split('T')[0]
    for (const entry of syncData.financeEntries || []) {
      if (entry.amount > 0) {
        const financeEntry = await db.financeEntry.create({
          data: {
            userId,
            date: today,
            type: entry.type || 'received',
            amount: entry.amount,
            category: entry.category || 'General',
            purpose: entry.purpose || null,
            aligned: entry.type === 'spent' ? null : null,
            notes: 'Auto-detected from chat',
          },
        })
        financeEntriesCreated.push(financeEntry.id)
      }
    }

    // Process mood entries - create QuickLog entries
    for (const moodEntry of syncData.moodEntries || []) {
      const now = new Date()
      const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
      const quickLog = await db.quickLog.create({
        data: {
          userId,
          date: today,
          time,
          mood: Math.min(10, Math.max(1, Number(moodEntry.mood))),
          energy: Math.min(10, Math.max(1, Number(moodEntry.energy))),
          focus: Math.min(10, Math.max(1, Number(moodEntry.focus))),
          note: moodEntry.note ? `AI-detected: ${moodEntry.note}` : 'AI-detected from chat',
        },
      })
      moodEntriesCreated.push(quickLog.id)
    }

    // Process patterns - create Memory entries
    for (const pattern of syncData.patterns || []) {
      const validAreas = ['faith', 'health', 'career', 'havilah', 'finances', 'relationships', 'personalGrowth']
      const validTypes = ['win', 'distraction', 'weakness', 'strength', 'correction', 'decision', 'pattern']
      const area = validAreas.includes(pattern.area) ? pattern.area : 'personalGrowth'
      const type = validTypes.includes(pattern.type) ? pattern.type : 'pattern'

      const memory = await db.memory.create({
        data: {
          userId,
          type,
          area,
          content: pattern.content,
          date: today,
        },
      })
      memoriesCreated.push(memory.id)
    }

    // Process life events - store as memories with type "event"
    for (const lifeEvent of syncData.lifeEvents || []) {
      const validAreas = ['faith', 'health', 'career', 'havilah', 'finances', 'relationships', 'personalGrowth']
      const area = validAreas.includes(lifeEvent.area) ? lifeEvent.area : 'personalGrowth'

      const memory = await db.memory.create({
        data: {
          userId,
          type: 'event',
          area,
          content: `${lifeEvent.event}${lifeEvent.significance === 'high' ? ' [HIGH]' : lifeEvent.significance === 'medium' ? ' [MED]' : ''}`,
          date: today,
        },
      })
      lifeEventsCreated.push(memory.id)
    }

    // Process suggested tasks - store as memories with type "decision" (actionable items)
    for (const task of syncData.suggestedTasks || []) {
      const validAreas = ['faith', 'health', 'career', 'havilah', 'finances', 'relationships', 'personalGrowth']
      const area = validAreas.includes(task.area) ? task.area : 'personalGrowth'

      const memory = await db.memory.create({
        data: {
          userId,
          type: 'decision',
          area,
          content: `Suggested: ${task.title}${task.priority === 'high' ? ' [URGENT]' : task.priority === 'medium' ? ' [TODO]' : ''}`,
          date: today,
        },
      })
      suggestedTasksCreated.push(memory.id)
    }

    // Process habit completions - auto-check-off habits
    for (const habitCompletion of syncData.habitCompletions || []) {
      if (habitCompletion.confidence === 'low') continue // Skip low-confidence matches

      const matchingHabit = findMatchingHabit(habitCompletion.habitTitle, activeHabits)
      if (matchingHabit) {
        // Check if already logged today
        const existingLog = await db.habitLog.findUnique({
          where: { habitId_date: { habitId: matchingHabit.id, date: today } },
        })

        if (!existingLog) {
          await db.habitLog.create({
            data: {
              habitId: matchingHabit.id,
              date: today,
              completed: true,
              note: 'Auto-detected from chat',
            },
          })
          habitsCompleted.push(matchingHabit.id)
        }
      }
    }

    return NextResponse.json({
      goalUpdates: syncData.goalUpdates || [],
      financeEntries: syncData.financeEntries || [],
      moodEntries: syncData.moodEntries || [],
      patterns: syncData.patterns || [],
      lifeEvents: syncData.lifeEvents || [],
      suggestedTasks: syncData.suggestedTasks || [],
      habitCompletions: syncData.habitCompletions || [],
      applied: {
        goalsUpdated: goalsUpdated.length,
        tasksUpdated: tasksUpdated.length,
        financeEntriesCreated: financeEntriesCreated.length,
        moodEntriesCreated: moodEntriesCreated.length,
        memoriesCreated: memoriesCreated.length,
        lifeEventsCreated: lifeEventsCreated.length,
        suggestedTasksCreated: suggestedTasksCreated.length,
        habitsCompleted: habitsCompleted.length,
      },
    })
  } catch (error) {
    console.error('Smart-sync error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze message', details: String(error) },
      { status: 500 }
    )
  }
}

// Fuzzy match helper - check if two strings are similar enough to be considered the same goal
function findMatchingGoal(
  searchTitle: string,
  goals: Array<{ id: string; title: string; tasks: Array<{ id: string; title: string; status: string }> }>
) {
  const searchLower = searchTitle.trim().toLowerCase()

  // Exact match first
  const exact = goals.find((g) => g.title.trim().toLowerCase() === searchLower)
  if (exact) return exact

  // Fuzzy: check if search words (excluding short common words) are all contained in the goal title
  const stopWords = new Set([
    'with', 'for', 'from', 'that', 'this', 'have', 'been', 'they',
    'their', 'which', 'would', 'about', 'other', 'into', 'could',
    'than', 'its', 'over', 'such', 'after', 'also', 'some', 'them',
    'when', 'what', 'will', 'each', 'make', 'like', 'long', 'very',
    'just', 'much', 'more', 'and', 'the', 'a', 'an', 'in', 'on',
    'of', 'to', 'is', 'it', 'or', 'as', 'at', 'by',
  ])
  const searchWords = searchLower
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))

  if (searchWords.length === 0) return null

  let bestMatch: typeof goals[0] | null = null
  let bestScore = 0

  for (const goal of goals) {
    const goalLower = goal.title.trim().toLowerCase()
    const matchCount = searchWords.filter((w) => goalLower.includes(w)).length
    const score = matchCount / searchWords.length

    if (score > bestScore && score >= 0.6) {
      bestScore = score
      bestMatch = goal
    }
  }

  return bestMatch
}

// Fuzzy match helper for habits
function findMatchingHabit(
  searchTitle: string,
  habits: Array<{ id: string; title: string; area: string; frequency: string }>
) {
  const searchLower = searchTitle.trim().toLowerCase()

  // Exact match first
  const exact = habits.find((h) => h.title.trim().toLowerCase() === searchLower)
  if (exact) return exact

  // Fuzzy match using keyword overlap
  const stopWords = new Set([
    'with', 'for', 'from', 'that', 'this', 'have', 'been', 'they',
    'their', 'which', 'would', 'about', 'other', 'into', 'could',
    'than', 'its', 'over', 'such', 'after', 'also', 'some', 'them',
    'when', 'what', 'will', 'each', 'make', 'like', 'long', 'very',
    'just', 'much', 'more', 'and', 'the', 'a', 'an', 'in', 'on',
    'of', 'to', 'is', 'it', 'or', 'as', 'at', 'by', 'my', 'i',
  ])
  const searchWords = searchLower
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))

  if (searchWords.length === 0) return null

  let bestMatch: typeof habits[0] | null = null
  let bestScore = 0

  for (const habit of habits) {
    const habitLower = habit.title.trim().toLowerCase()
    const matchCount = searchWords.filter((w) => habitLower.includes(w)).length
    const score = matchCount / searchWords.length

    if (score > bestScore && score >= 0.5) {
      bestScore = score
      bestMatch = habit
    }
  }

  return bestMatch
}

function fuzzyMatch(search: string, target: string): boolean {
  const searchLower = search.trim().toLowerCase()
  const targetLower = target.trim().toLowerCase()

  if (searchLower === targetLower) return true

  // Check if key words from search are in target
  const searchWords = searchLower.split(/\s+/).filter((w) => w.length > 3)
  if (searchWords.length === 0) return searchLower.includes(targetLower) || targetLower.includes(searchLower)

  const matchCount = searchWords.filter((w) => targetLower.includes(w)).length
  return matchCount / searchWords.length >= 0.5
}
