import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

const AREA_MAP = {
  'goals_Career Tasks': 'career',
  'goals_Financial Tasks': 'finances',
  'goals_Health Tasks': 'health',
  'goals_Ministry & Spiritual Tasks': 'faith',
  'goals_Personal Tasks': 'personalGrowth',
  'goals_Relationship Tasks': 'relationships',
}

const OVERALL_AREA_MAP = {
  'overall_Career Goals': 'career',
  'overall_Financial Goals': 'finances',
  'overall_Health Goals': 'health',
  'overall_Ministry & Spiritual': 'faith',
  'overall_Personal Goals': 'personalGrowth',
  'overall_Relationship Goals': 'relationships',
}

const HAVILAH_KEYWORDS = ['havilah', 'hub', 'tutors', 'writers', 'partner']

function isHavilahGoal(title) {
  const lower = title.toLowerCase()
  return HAVILAH_KEYWORDS.some(k => lower.includes(k))
}

const VISION_DATA = {
  faith: {
    idealVision: "Grow deeper in relationship with God through consistent prayer, scripture study, devotion, and obedience. Be a woman of faith whose life reflects God's glory.",
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
    idealVision: 'Achieve sustainable health through regular exercise (gym 3x/week), better nutrition, consistent sleep schedule (10PM-5AM), and maintaining energy.',
    currentStatus: 'Working on establishing baseline measurements and habits. Need to register for gym and create meal plans.',
    keyActions: JSON.stringify([
      'Register for gym in Q1 and go 3x/week',
      'Record baseline weight, waist/hip, photos',
      'Maintain body weight under 60kg',
      'Daily fruit intake and healthy meals',
      'Consistent 10PM-5AM sleep schedule',
    ]),
    blockers: 'Lack of gym membership, no structured meal plan, inconsistent sleep.',
    motivation: 'Health is the vehicle for everything God has called Praise to do.',
  },
  career: {
    idealVision: 'Secure an international corporate role (preferably remote/hybrid) in research/strategy. Build professional portfolio, network strategically.',
    currentStatus: 'CV and LinkedIn need polishing. Need to create portfolio, build target company list, and start applying.',
    keyActions: JSON.stringify([
      'Audit and polish CV and LinkedIn',
      'Create two CV variants for different roles',
      'Build portfolio with 2-3 samples',
      'Make target list of 20 companies',
      'Prepare tailored cover letters and apply',
    ]),
    blockers: 'CV not polished, no portfolio yet, need to identify target companies.',
    motivation: 'An international role provides stability, growth, and the platform to fund all other areas.',
  },
  havilah: {
    idealVision: 'Build Havilah Learning Hub and Havilah Writers into revenue-generating businesses with systems, clients, and growth.',
    currentStatus: 'Havilah Learning Hub and Havilah Writers are operational but need systems, website, partnerships, and revenue growth.',
    keyActions: JSON.stringify([
      'Rent 3-bed Havilah Hub in Abuja',
      'Build website for Havilah Writers',
      'Find business partner(s) for Havilah',
      'Groom junior research writers',
      'Establish client onboarding systems',
    ]),
    blockers: 'No dedicated space, limited systems, no website for writers, need business partners.',
    motivation: "Havilah is the entrepreneurial expression of Praise's calling.",
  },
  finances: {
    idealVision: 'Become financially disciplined and aware. Track every naira. Build savings. Reduce wasteful spending. Align all spending with goals.',
    currentStatus: 'Need to establish ₦1,500,000 monthly revenue target and structured allocation system.',
    keyActions: JSON.stringify([
      'Break down ₦1.5M into service-level targets',
      'Implement daily and monthly income tracking',
      'Follow allocation rule: Tithe 10%, Savings 25%, Giving 10%, Wages 35%, Plough Back 20%',
      'Track every naira spent',
    ]),
    blockers: 'No structured tracking system, unclear revenue breakdown, undisciplined spending patterns.',
    motivation: 'Financial stewardship honors God and enables every other vision.',
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
    blockers: 'Lack of intentional scheduling, not showing up consistently.',
    motivation: 'Relationships are the context for life. Intentionality transforms connections from shallow to meaningful.',
  },
  personalGrowth: {
    idealVision: 'Commit to continuous learning - read 24+ books in 2026, journal consistently, develop emotional maturity, and grow in discipline and self-awareness.',
    currentStatus: 'Building daily habits. Need to establish reading, journaling, and learning routines.',
    keyActions: JSON.stringify([
      'Read one book every month (24+ in 2026)',
      'Journal every day',
      'Work from office in Abuja daily (Q1)',
      'Listen to a sermon every day',
      'Listen to a motivational podcast every day',
      'Build consistent social media voice',
    ]),
    blockers: 'Inconsistent routines, competing priorities, need for dedicated workspace.',
    motivation: 'Growth is non-negotiable. The person Praise becomes matters more than what she achieves.',
  },
}

async function seed() {
  console.log('Seeding database...')

  // 1. Seed auth code
  const existingAuth = await prisma.auth.findFirst()
  if (!existingAuth) {
    await prisma.auth.create({ data: { code: 'BUILDPRAISE' } })
    console.log('Auth code seeded')
  }

  // 2. Seed LifeAreaProgress
  for (const [area, data] of Object.entries(VISION_DATA)) {
    await prisma.lifeAreaProgress.upsert({
      where: { area },
      update: data,
      create: { area, ...data },
    })
  }
  console.log('Life area progress seeded')

  // 3. Read goals data
  const filePath = join(process.cwd(), 'upload', 'goals_data.json')
  const fileContent = readFileSync(filePath, 'utf-8')
  const goalsData = JSON.parse(fileContent)

  let goalsCreated = 0
  let tasksCreated = 0
  const goalMap = {}

  // Process overall goals
  for (const [sheetKey, sheetData] of Object.entries(goalsData)) {
    if (!sheetKey.startsWith('overall_')) continue
    if (!Array.isArray(sheetData)) continue

    const baseArea = OVERALL_AREA_MAP[sheetKey]
    if (!baseArea) continue

    const rows = sheetData
    if (rows.length < 2) continue

    const headers = rows[0]
    const headerMap = {}
    headers.forEach((h, idx) => { headerMap[h.trim().toLowerCase()] = idx })

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row || !row[0]) continue

      const goalTitle = row[0]
      let area = baseArea
      if (baseArea === 'career' && isHavilahGoal(goalTitle)) area = 'havilah'

      if (goalMap[goalTitle]) continue

      const goal = await prisma.goal.create({
        data: {
          area,
          title: goalTitle,
          description: headerMap['description'] !== undefined ? row[headerMap['description']] || null : null,
          whyItMatters: headerMap['why it matters'] !== undefined ? row[headerMap['why it matters']] || null : null,
          successMetric: headerMap['success metric'] !== undefined ? row[headerMap['success metric']] || null :
            headerMap['consistency metric'] !== undefined ? row[headerMap['consistency metric']] || null :
            headerMap['target'] !== undefined ? row[headerMap['target']] || null : null,
          targetDate: headerMap['target date'] !== undefined ? row[headerMap['target date']] || null : null,
          status: headerMap['status'] !== undefined ? row[headerMap['status']] || 'Not Started' : 'Not Started',
          notes: headerMap['notes'] !== undefined ? row[headerMap['notes']] || null : null,
          order: goalsCreated,
        },
      })

      goalMap[goalTitle] = goal.id
      goalsCreated++
    }
  }

  // Process tasks
  for (const [sheetKey, sheetData] of Object.entries(goalsData)) {
    if (!sheetKey.startsWith('goals_')) continue
    if (!Array.isArray(sheetData)) continue

    const rows = sheetData
    if (rows.length < 2) continue

    const headers = rows[0]
    const headerMap = {}
    headers.forEach((h, idx) => { headerMap[h.trim().toLowerCase()] = idx })

    let taskOrder = 0

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row || !row[0] || !row[1]) continue

      const parentGoalTitle = row[0]
      const taskTitle = row[1]

      if (!goalMap[parentGoalTitle]) {
        const baseArea = AREA_MAP[sheetKey] || 'career'
        let area = baseArea
        if (isHavilahGoal(parentGoalTitle)) area = 'havilah'

        const goal = await prisma.goal.create({
          data: { area, title: parentGoalTitle, status: 'Not Started', order: goalsCreated },
        })
        goalMap[parentGoalTitle] = goal.id
        goalsCreated++
      }

      await prisma.task.create({
        data: {
          goalId: goalMap[parentGoalTitle],
          title: taskTitle,
          dependency: headerMap['dependency'] !== undefined ? row[headerMap['dependency']] || null : null,
          difficulty: headerMap['difficulty'] !== undefined ? row[headerMap['difficulty']] || null : null,
          estimatedCost: headerMap['estimated cost (ngn)'] !== undefined ? row[headerMap['estimated cost (ngn)']] || null : null,
          status: headerMap['status'] !== undefined ? row[headerMap['status']] || 'Not Started' : 'Not Started',
          notes: headerMap['notes'] !== undefined ? row[headerMap['notes']] || null : null,
          order: taskOrder,
        },
      })

      taskOrder++
      tasksCreated++
    }
  }

  console.log(`Seeded: ${goalsCreated} goals, ${tasksCreated} tasks`)
  await prisma.$disconnect()
}

seed().catch(e => {
  console.error('Seed error:', e)
  process.exit(1)
})
