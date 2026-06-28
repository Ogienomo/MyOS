import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Map sheet names to area identifiers
const AREA_MAP: Record<string, string> = {
  'goals_Career Tasks': 'career',
  'goals_Financial Tasks': 'finances',
  'goals_Health Tasks': 'health',
  'goals_Ministry & Spiritual Tasks': 'faith',
  'goals_Personal Tasks': 'personalGrowth',
  'goals_Relationship Tasks': 'relationships',
}

const OVERALL_AREA_MAP: Record<string, string> = {
  'overall_Career Goals': 'career',
  'overall_Financial Goals': 'finances',
  'overall_Health Goals': 'health',
  'overall_Ministry & Spiritual': 'faith',
  'overall_Personal Goals': 'personalGrowth',
  'overall_Relationship Goals': 'relationships',
}

// Havilah-related goals that are in the Career sheet but belong to Havilah area
const HAVILAH_GOAL_KEYWORDS = [
  'havilah',
  'hub',
  'tutors',
  'writers',
  'partner',
]

function isHavilahGoal(goalTitle: string): boolean {
  const lower = goalTitle.toLowerCase()
  return HAVILAH_GOAL_KEYWORDS.some((keyword) => lower.includes(keyword))
}

// Praise's 2026 vision for each area
const VISION_DATA: Record<string, { idealVision: string; currentStatus: string; keyActions: string; blockers: string; motivation: string }> = {
  faith: {
    idealVision: 'Grow deeper in relationship with God through consistent prayer, scripture study, devotion, and obedience. Be a woman of faith whose life reflects God\'s glory.',
    currentStatus: 'Building consistency in devotion. Desire for deeper prayer life and more structured scripture study.',
    keyActions: JSON.stringify([
      'Maintain 4am-6am, 12pm-12:20pm, 8pm-9pm devotion blocks',
      'Study scripture daily with a reading plan',
      'Submit to a spiritual authority',
      'Participate in Fotia Network crusade',
      'Partner with children/teens ministry',
    ]),
    blockers: 'Inconsistent sleep schedule affects morning devotion; competing priorities during the day.',
    motivation: 'A strong spiritual foundation is the bedrock of everything else. When faith is strong, all other areas align.',
  },
  health: {
    idealVision: 'Achieve sustainable health through regular exercise (gym 3x/week), better nutrition, consistent sleep schedule (10PM-5AM), and maintaining energy for all God has called her to.',
    currentStatus: 'Working on establishing baseline measurements and habits. Need to register for gym and create meal plans.',
    keyActions: JSON.stringify([
      'Register for gym in Q1 and go 3x/week',
      'Record baseline weight, waist/hip, photos',
      'Maintain body weight under 60kg',
      'Daily fruit intake and healthy meals',
      'Consistent 10PM-5AM sleep schedule',
      'Zero sick days target',
    ]),
    blockers: 'Lack of gym membership, no structured meal plan, inconsistent sleep.',
    motivation: 'Health is the vehicle for everything God has called Praise to do. Energy and vitality enable her to serve and build.',
  },
  career: {
    idealVision: 'Secure an international corporate role (preferably remote/hybrid) in research/strategy. Build professional portfolio, network strategically, and position for leadership.',
    currentStatus: 'CV and LinkedIn need polishing. Need to create portfolio, build target company list, and start applying.',
    keyActions: JSON.stringify([
      'Audit and polish CV and LinkedIn',
      'Create two CV variants for different roles',
      'Build portfolio with 2-3 samples',
      'Make target list of 20 companies',
      'Prepare tailored cover letters and apply',
      'Apply for Masters Overseas for 2027',
      'Complete online courses & certifications',
    ]),
    blockers: 'CV not polished, no portfolio yet, need to identify target companies, lack of international network.',
    motivation: 'An international role provides stability, growth, and the platform to fund and support all other areas of vision.',
  },
  havilah: {
    idealVision: 'Build Havilah Learning Hub and Havilah Writers into revenue-generating businesses with systems, clients, and growth. Move from side project to sustainable enterprise.',
    currentStatus: 'Havilah Learning Hub and Havilah Writers are operational but need systems, website, partnerships, and revenue growth.',
    keyActions: JSON.stringify([
      'Rent 3-bed Havilah Hub in Abuja',
      'Build website for Havilah Writers',
      'Find business partner(s) for Havilah',
      'Groom junior research writers',
      'Establish client onboarding systems',
      'Create revenue targets per service',
    ]),
    blockers: 'No dedicated space, limited systems, no website for writers, need business partners.',
    motivation: 'Havilah is the entrepreneurial expression of Praise\'s calling. Building it well creates sustainable income and impact.',
  },
  finances: {
    idealVision: 'Become financially disciplined and aware. Track every naira. Build savings. Reduce wasteful spending. Align all spending with goals. Achieve financial stewardship.',
    currentStatus: 'Need to establish ₦1,500,000 monthly revenue target and structured allocation system.',
    keyActions: JSON.stringify([
      'Break down ₦1.5M into service-level targets',
      'Implement daily and monthly income tracking',
      'Follow allocation rule: Tithe 10%, Savings 25%, Giving 10%, Wages 35%, Plough Back 20%',
      'Give ₦100,000 monthly church offering',
      'Track every naira spent',
    ]),
    blockers: 'No structured tracking system, unclear revenue breakdown, undisciplined spending patterns.',
    motivation: 'Financial stewardship honors God and enables every other vision. Every naira must serve a purpose.',
  },
  relationships: {
    idealVision: 'Deepen family bonds, build meaningful friendships, engage in church community, and seek/give mentorship. Be intentional about every relationship.',
    currentStatus: 'Desire to be more intentional with family, friends, and church. Need to create structured meeting rhythms.',
    keyActions: JSON.stringify([
      'Schedule bi-monthly family meetings with agenda',
      'RSVP and attend church events weekly',
      'Host catch-ups with friends regularly',
      'Pursue romantic relationship intentionally',
      'Seek and give mentorship',
    ]),
    blockers: 'Lack of intentional scheduling, not showing up consistently, no family meeting structure.',
    motivation: 'Relationships are the context for life. Intentionality transforms connections from shallow to meaningful.',
  },
  personalGrowth: {
    idealVision: 'Commit to continuous learning - read 24+ books in 2026, journal consistently, develop emotional maturity, and grow in discipline and self-awareness.',
    currentStatus: 'Building daily habits. Need to establish reading, journaling, and learning routines.',
    keyActions: JSON.stringify([
      'Read one book every month (24+ in 2026)',
      'Journal every day',
      'Work from office in Abuja daily (Q1)',
      'Complete fencing and foundation (₦8M property project)',
      'Listen to a sermon every day',
      'Listen to a motivational podcast every day',
      'Build consistent social media voice',
      'Score a song every day',
      'Register for a gym in Q1',
    ]),
    blockers: 'Inconsistent routines, competing priorities, need for dedicated workspace.',
    motivation: 'Growth is non-negotiable. The person Praise becomes matters more than what she achieves.',
  },
}

// Sample goals for when goals_data.json is not available (e.g., on Vercel)
const SAMPLE_GOALS: Record<string, { title: string; description: string }[]> = {
  faith: [
    { title: 'Maintain consistent devotion blocks', description: '4am-6am, 12pm-12:20pm, 8pm-9pm devotion blocks daily' },
    { title: 'Study scripture daily with a reading plan', description: 'Follow a structured Bible reading plan' },
    { title: 'Submit to a spiritual authority', description: 'Find and commit to spiritual mentorship' },
    { title: 'Participate in Fotia Network crusade', description: 'Active participation in crusade activities' },
    { title: 'Partner with children/teens ministry', description: 'Serve in children or teens ministry' },
  ],
  health: [
    { title: 'Register for gym and go 3x/week', description: 'Register for gym in Q1 and maintain 3x/week schedule' },
    { title: 'Record baseline health measurements', description: 'Weight, waist/hip, photos for tracking' },
    { title: 'Maintain body weight under 60kg', description: 'Through exercise and nutrition' },
    { title: 'Consistent 10PM-5AM sleep schedule', description: 'Build disciplined sleep routine' },
    { title: 'Daily fruit intake and healthy meals', description: 'Nutrition goal for sustainable health' },
  ],
  career: [
    { title: 'Audit and polish CV and LinkedIn', description: 'Professional profile refresh' },
    { title: 'Create two CV variants for different roles', description: 'Tailored CVs for research and strategy positions' },
    { title: 'Build portfolio with 2-3 samples', description: 'Showcase work for job applications' },
    { title: 'Make target list of 20 companies', description: 'Strategic job target list' },
    { title: 'Prepare tailored cover letters and apply', description: 'Systematic application process' },
    { title: 'Apply for Masters Overseas for 2027', description: 'Graduate school applications' },
    { title: 'Complete online courses & certifications', description: 'Continuous professional development' },
  ],
  havilah: [
    { title: 'Rent 3-bed Havilah Hub in Abuja', description: 'Secure physical space for the learning hub' },
    { title: 'Build website for Havilah Writers', description: 'Professional web presence for the writing business' },
    { title: 'Find business partner(s) for Havilah', description: 'Strategic partnership for growth' },
    { title: 'Groom junior research writers', description: 'Build a team of skilled writers' },
    { title: 'Establish client onboarding systems', description: 'Professional systems for client management' },
  ],
  finances: [
    { title: 'Break down ₦1.5M into service-level targets', description: 'Revenue breakdown by service offering' },
    { title: 'Implement daily and monthly income tracking', description: 'Track every naira earned' },
    { title: 'Follow allocation rule consistently', description: 'Tithe 10%, Savings 25%, Giving 10%, Wages 35%, Plough Back 20%' },
    { title: 'Track every naira spent', description: 'Zero unaccounted spending' },
  ],
  relationships: [
    { title: 'Schedule bi-monthly family meetings', description: 'Structured family time with agenda' },
    { title: 'Attend church events weekly', description: 'RSVP and show up consistently' },
    { title: 'Host catch-ups with friends regularly', description: 'Intentional friendship maintenance' },
    { title: 'Seek and give mentorship', description: 'Both as mentor and mentee' },
  ],
  personalGrowth: [
    { title: 'Read one book every month', description: '24+ books in 2026' },
    { title: 'Journal every day', description: 'Daily reflection and gratitude' },
    { title: 'Work from office in Abuja daily (Q1)', description: 'Establish dedicated work routine' },
    { title: 'Listen to a sermon every day', description: 'Daily spiritual nourishment' },
    { title: 'Build consistent social media voice', description: 'Professional and authentic online presence' },
  ],
}

// Stop words for fuzzy matching
const STOP_WORDS = new Set([
  'with', 'for', 'from', 'that', 'this', 'have', 'been', 'they',
  'their', 'which', 'would', 'about', 'other', 'into', 'could',
  'than', 'its', 'over', 'such', 'after', 'also', 'some', 'them',
  'when', 'what', 'will', 'each', 'make', 'like', 'been', 'long',
  'very', 'just', 'much', 'more', 'and', 'the', 'a', 'an', 'in',
  'on', 'of', 'to', 'is', 'it', 'or', 'as', 'at', 'by',
])

// Fuzzy match: check if searchWords are all contained in the target
function fuzzyMatchTitle(searchTitle: string, targetTitle: string): boolean {
  const searchLower = searchTitle.trim().toLowerCase()
  const targetLower = targetTitle.trim().toLowerCase()

  if (searchLower === targetLower) return true

  const searchWords = searchLower.split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w))
  if (searchWords.length === 0) return searchLower.includes(targetLower) || targetLower.includes(searchLower)

  return searchWords.every(word => targetLower.includes(word))
}

// Find an existing goal in goalMap that fuzzy matches the given title
function findFuzzyMatchInGoalMap(
  title: string,
  goalMap: Record<string, string>
): string | null {
  const normalizedTitle = title.trim().toLowerCase()

  // Exact match first
  if (goalMap[normalizedTitle] || goalMap[title]) {
    return goalMap[normalizedTitle] || goalMap[title]
  }

  // Fuzzy match
  for (const [existingTitle, existingId] of Object.entries(goalMap)) {
    if (existingTitle === normalizedTitle) continue
    if (fuzzyMatchTitle(title, existingTitle)) {
      return existingId
    }
    if (fuzzyMatchTitle(existingTitle, title)) {
      return existingId
    }
  }

  return null
}

// Try to read goals_data.json from the upload folder (local only)
async function tryReadGoalsData(): Promise<Record<string, unknown> | null> {
  try {
    const { existsSync, readFileSync } = await import('fs')
    const { join } = await import('path')
    const filePath = join(process.cwd(), 'upload', 'goals_data.json')
    if (!existsSync(filePath)) return null
    const fileContent = readFileSync(filePath, 'utf-8')
    return JSON.parse(fileContent)
  } catch {
    // File not found or can't be read (e.g., on Vercel)
    return null
  }
}

// Seed sample goals from VISION_DATA
async function seedSampleGoals(): Promise<number> {
  let goalsCreated = 0
  for (const [area, sampleGoals] of Object.entries(SAMPLE_GOALS)) {
    for (const sg of sampleGoals) {
      await db.goal.create({
        data: {
          area,
          title: sg.title,
          description: sg.description,
          status: 'Not Started',
          order: goalsCreated,
        },
      })
      goalsCreated++
    }
  }
  return goalsCreated
}

// Process goals_data.json with task sheets and overall sheets
async function processGoalsData(goalsData: Record<string, unknown>): Promise<{ goalsCreated: number; tasksCreated: number; goalsUpdated: number }> {
  let goalsCreated = 0
  let tasksCreated = 0
  let goalsUpdated = 0

  const goalMap: Record<string, string> = {} // goalTitle -> goalId

  // Process task sheets first
  for (const [sheetKey, sheetData] of Object.entries(goalsData)) {
    if (!sheetKey.startsWith('goals_')) continue
    if (!Array.isArray(sheetData)) continue

    const rows = sheetData as string[][]
    if (rows.length < 2) continue

    const headers = rows[0]
    const headerMap: Record<string, number> = {}
    headers.forEach((h: string, idx: number) => {
      headerMap[h.trim().toLowerCase()] = idx
    })

    let taskOrder = 0

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.length < 2 || !row[0] || !row[1]) continue

      const parentGoalTitle = String(row[0])
      const taskTitle = String(row[1])

      // Find the parent goal ID (normalized + fuzzy lookup)
      const normalizedParent = parentGoalTitle.trim().toLowerCase()
      let foundGoalId = goalMap[normalizedParent] || goalMap[parentGoalTitle]

      // Fuzzy match: if exact match not found, try to find an existing goal
      if (!foundGoalId) {
        foundGoalId = findFuzzyMatchInGoalMap(parentGoalTitle, goalMap) || undefined
        if (foundGoalId) {
          goalMap[normalizedParent] = foundGoalId
          goalMap[parentGoalTitle] = foundGoalId
        }
      }

      if (!foundGoalId) {
        const baseArea = AREA_MAP[sheetKey] || 'career'
        let area = baseArea
        if (isHavilahGoal(parentGoalTitle)) {
          area = 'havilah'
        }

        const goal = await db.goal.create({
          data: {
            area,
            title: parentGoalTitle,
            status: 'Not Started',
            order: goalsCreated,
          },
        })
        goalMap[parentGoalTitle] = goal.id
        goalMap[normalizedParent] = goal.id
        goalsCreated++
        foundGoalId = goal.id
      }

      const dependency = headerMap['dependency'] !== undefined ? row[headerMap['dependency']] || null : null
      const difficulty = headerMap['difficulty'] !== undefined ? row[headerMap['difficulty']] || null : null
      const estimatedCost = headerMap['estimated cost (ngn)'] !== undefined ? row[headerMap['estimated cost (ngn)']] || null : null
      const status = headerMap['status'] !== undefined ? row[headerMap['status']] || 'Not Started' : 'Not Started'
      const notes = headerMap['notes'] !== undefined ? row[headerMap['notes']] || null : null

      await db.task.create({
        data: {
          goalId: foundGoalId,
          title: taskTitle,
          dependency: dependency ? String(dependency) : null,
          difficulty: difficulty ? String(difficulty) : null,
          estimatedCost: estimatedCost ? String(estimatedCost) : null,
          status: status ? String(status) : 'Not Started',
          notes: notes ? String(notes) : null,
          order: taskOrder,
        },
      })

      taskOrder++
      tasksCreated++
    }
  }

  // Process overall goals sheets AFTER task sheets
  for (const [sheetKey, sheetData] of Object.entries(goalsData)) {
    if (!sheetKey.startsWith('overall_')) continue
    if (!Array.isArray(sheetData)) continue

    const baseArea = OVERALL_AREA_MAP[sheetKey]
    if (!baseArea) continue

    const rows = sheetData as string[][]
    if (rows.length < 2) continue

    const headers = rows[0]

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.length < 1 || !row[0]) continue

      const goalTitle = String(row[0])

      let area = baseArea
      if (baseArea === 'career' && isHavilahGoal(goalTitle)) {
        area = 'havilah'
      }

      const headerMap: Record<string, number> = {}
      headers.forEach((h: string, idx: number) => {
        headerMap[h.trim().toLowerCase()] = idx
      })

      const description = headerMap['description'] !== undefined ? row[headerMap['description']] || '' : ''
      const whyItMatters = headerMap['why it matters'] !== undefined ? row[headerMap['why it matters']] || '' : ''
      const successMetric = headerMap['success metric'] !== undefined ? row[headerMap['success metric']] || '' :
        headerMap['consistency metric'] !== undefined ? row[headerMap['consistency metric']] || '' :
        headerMap['target'] !== undefined ? row[headerMap['target']] || '' :
        headerMap['minimum standard'] !== undefined ? row[headerMap['minimum standard']] || '' : ''
      const targetDate = headerMap['target date'] !== undefined ? row[headerMap['target date']] || '' : ''
      const status = headerMap['status'] !== undefined ? row[headerMap['status']] || 'Not Started' : 'Not Started'
      const notes = headerMap['notes'] !== undefined ? row[headerMap['notes']] || '' : ''

      // Check for duplicates (normalized exact match)
      const normalizedTitle = goalTitle.trim().toLowerCase()
      if (goalMap[normalizedTitle] || goalMap[goalTitle]) continue

      // Fuzzy match: check if a similar goal already exists from task sheets
      const existingGoalId = findFuzzyMatchInGoalMap(goalTitle, goalMap)

      if (existingGoalId) {
        const existingGoal = await db.goal.findUnique({ where: { id: existingGoalId } })
        if (existingGoal) {
          const updateData: Record<string, string> = {}
          if (description && !existingGoal.description) {
            updateData.description = String(description)
          }
          if (whyItMatters && !existingGoal.whyItMatters) {
            updateData.whyItMatters = String(whyItMatters)
          }
          if (successMetric && !existingGoal.successMetric) {
            updateData.successMetric = String(successMetric)
          }
          if (targetDate && !existingGoal.targetDate) {
            updateData.targetDate = String(targetDate)
          }
          if (notes && !existingGoal.notes) {
            updateData.notes = String(notes)
          }

          if (Object.keys(updateData).length > 0) {
            await db.goal.update({
              where: { id: existingGoalId },
              data: updateData,
            })
            goalsUpdated++
          }

          goalMap[goalTitle] = existingGoalId
          goalMap[normalizedTitle] = existingGoalId
        }
      } else {
        const goal = await db.goal.create({
          data: {
            area,
            title: goalTitle,
            description: description ? String(description) : null,
            whyItMatters: whyItMatters ? String(whyItMatters) : null,
            successMetric: successMetric ? String(successMetric) : null,
            targetDate: targetDate ? String(targetDate) : null,
            status: status ? String(status) : 'Not Started',
            notes: notes ? String(notes) : null,
            order: goalsCreated,
          },
        })

        goalMap[goalTitle] = goal.id
        goalMap[normalizedTitle] = goal.id
        goalsCreated++
      }
    }
  }

  return { goalsCreated, tasksCreated, goalsUpdated }
}

// GET /api/seed - Seeds the database (accessible via browser)
export async function GET() {
  return POST()
}

// POST /api/seed - Seeds the database
export async function POST() {
  try {
    // Check if already seeded
    const existingGoals = await db.goal.count()
    if (existingGoals > 0) {
      return NextResponse.json({
        message: 'Database already seeded. Skipping.',
        existingGoals,
      })
    }

    // 1. Seed initial auth code
    const existingAuth = await db.auth.findFirst()
    if (!existingAuth) {
      await db.auth.create({ data: { code: 'BUILDMyOS' } })
    }

    // 2. Seed LifeAreaProgress for each area
    for (const [area, data] of Object.entries(VISION_DATA)) {
      await db.lifeAreaProgress.upsert({
        where: { area },
        update: {
          currentStatus: data.currentStatus,
          idealVision: data.idealVision,
          keyActions: data.keyActions,
          blockers: data.blockers,
          motivation: data.motivation,
        },
        create: {
          area,
          currentStatus: data.currentStatus,
          idealVision: data.idealVision,
          keyActions: data.keyActions,
          blockers: data.blockers,
          motivation: data.motivation,
        },
      })
    }

    // 3. Try to read goals_data.json (local only), fall back to sample goals
    const goalsData = await tryReadGoalsData()

    if (goalsData) {
      // Process full goals data from file
      const { goalsCreated, tasksCreated, goalsUpdated } = await processGoalsData(goalsData)

      return NextResponse.json({
        success: true,
        message: 'Database seeded successfully from goals_data.json',
        goalsCreated,
        goalsUpdatedFromOverall: goalsUpdated,
        tasksCreated,
        lifeAreasSeeded: Object.keys(VISION_DATA).length,
        authSeeded: true,
      })
    } else {
      // Fallback: seed sample goals (for Vercel or when file is missing)
      const goalsCreated = await seedSampleGoals()

      return NextResponse.json({
        success: true,
        message: 'Database seeded with sample goals (goals_data.json not found - this is normal on Vercel)',
        goalsCreated,
        tasksCreated: 0,
        goalsUpdatedFromOverall: 0,
        lifeAreasSeeded: Object.keys(VISION_DATA).length,
        authSeeded: true,
        fallbackSeed: true,
      })
    }
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({
      error: 'Failed to seed database',
      details: error instanceof Error ? error.message : String(error),
      hint: 'Make sure your DATABASE_URL is correctly set and the database schema has been pushed (prisma db push).',
    }, { status: 500 })
  }
}
