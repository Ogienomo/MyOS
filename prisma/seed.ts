import { db } from '../src/lib/db';
import * as fs from 'fs';
import * as path from 'path';

interface JsonData {
  [key: string]: string[][];
}

// Area mapping from sheet names to Prisma area values
const AREA_MAP: Record<string, string> = {
  'Career': 'career',
  'Financial': 'finances',
  'Personal': 'personalGrowth',
  'Health': 'health',
  'Relationship': 'relationships',
  'Ministry & Spiritual': 'ministry',
};

// Havilah-related keywords to detect entrepreneurship goals
const HAVILAH_KEYWORDS = ['havilah', 'hub', 'tutors', 'writers'];

function isHavilahGoal(title: string): boolean {
  const lower = title.toLowerCase();
  return HAVILAH_KEYWORDS.some(kw => lower.includes(kw));
}

// Normalize a word for comparison: lowercase, strip punctuation
function normalizeWord(w: string): string {
  return w.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Extract meaningful words from a string
function extractWords(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[()\/\-_,.]/g, ' ')
      .split(/\s+/)
      .map(normalizeWord)
      .filter(w => w.length >= 2) // Include 2+ char words
  );
}

// Better similarity score using Jaccard-like index on key words
function similarity(a: string, b: string): number {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return 1;

  // Substring containment check
  if (la.includes(lb) || lb.includes(la)) return 0.85;

  const wordsA = extractWords(a);
  const wordsB = extractWords(b);

  // Jaccard similarity: intersection / union
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  if (union === 0) return 0;

  const jaccard = intersection / union;

  // Also compute overlap ratio (how much of the shorter string is covered)
  const minLen = Math.min(wordsA.size, wordsB.size);
  const overlapRatio = minLen > 0 ? intersection / minLen : 0;

  // Use the max of Jaccard and overlap ratio (weighted)
  return Math.max(jaccard, overlapRatio * 0.7);
}

function findClosestGoal(parentGoal: string, goalTitles: string[]): string | null {
  let bestMatch: string | null = null;
  let bestScore = 0;
  for (const title of goalTitles) {
    const score = similarity(parentGoal, title);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = title;
    }
  }
  return bestScore >= 0.25 ? bestMatch : null;
}

async function main() {
  console.log('🌱 Starting database seed...');

  // Read JSON data
  const jsonPath = path.join(__dirname, '..', 'upload', 'goals_data.json');
  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const data: JsonData = JSON.parse(rawData);

  // Delete existing data (in correct order for foreign keys)
  console.log('🗑️  Clearing existing data...');
  await db.task.deleteMany();
  await db.goal.deleteMany();
  await db.memory.deleteMany();
  await db.lifeAreaScore.deleteMany();
  await db.driftAlert.deleteMany();
  await db.checkIn.deleteMany();
  await db.financeEntry.deleteMany();
  await db.chatMessage.deleteMany();

  // Store created goals: title -> { id, area }
  const goalMap = new Map<string, { id: string; area: string }>();
  const goalTitleByArea = new Map<string, string[]>(); // area -> [titles]

  // Process each area
  const areas = ['Career', 'Financial', 'Personal', 'Health', 'Relationship', 'Ministry & Spiritual'];

  let goalOrder = 0;

  for (const area of areas) {
    const overallKey = `overall_${area}${area === 'Ministry & Spiritual' ? '' : ' Goals'}`;
    const tasksKey = `goals_${area} Tasks`;
    const prismaArea = AREA_MAP[area];

    const overallRows = data[overallKey];
    if (!overallRows || overallRows.length < 2) {
      console.log(`⚠️  No overall data for ${area}, skipping goals`);
      continue;
    }

    const rows = overallRows.slice(1); // skip header
    const goalTitlesThisArea: string[] = [];

    console.log(`📋 Processing ${area} goals (${rows.length} rows)...`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 1 || !row[0]?.trim()) continue;

      const title = row[0].trim();

      // Determine area: if it's a Havilah goal, use 'havilah' area
      const effectiveArea = isHavilahGoal(title) ? 'havilah' : prismaArea;

      // Extract fields based on sheet structure
      let description: string | null = null;
      let whyItMatters: string | null = null;
      let successMetric: string | null = null;
      let targetDate: string | null = null;
      let status = 'Not Started';
      let notes: string | null = null;

      if (area === 'Career') {
        // [Goal, Description, Why it Matters, Success Metric, Start Date, Target Date, Status, Notes]
        description = row[1]?.trim() || null;
        whyItMatters = row[2]?.trim() || null;
        successMetric = row[3]?.trim() || null;
        targetDate = row[5]?.trim() || null;
        status = row[6]?.trim() || 'Not Started';
        notes = row[7]?.trim() || null;
      } else if (area === 'Financial') {
        // [Goal, Monthly Target, Allocation Rule, Tracking Tool, Review Frequency, Status, Notes]
        description = row[1]?.trim() ? `Monthly Target: ${row[1].trim()}` : null;
        if (row[2]?.trim()) description = description ? `${description}; Allocation: ${row[2].trim()}` : `Allocation: ${row[2].trim()}`;
        successMetric = row[3]?.trim() || null;
        if (row[4]?.trim()) notes = `Review: ${row[4].trim()}`;
        status = row[5]?.trim() || 'Not Started';
        if (row[6]?.trim()) notes = notes ? `${notes}; ${row[6].trim()}` : row[6].trim();
      } else if (area === 'Personal') {
        // [Goal, Habit Type, Minimum Standard, Tracking Method, Status, Notes]
        description = row[1]?.trim() || null;
        successMetric = row[2]?.trim() || null;
        if (row[3]?.trim()) notes = `Tracking: ${row[3].trim()}`;
        status = row[4]?.trim() || 'Not Started';
        if (row[5]?.trim()) notes = notes ? `${notes}; ${row[5].trim()}` : row[5].trim();
      } else if (area === 'Health') {
        // [Goal, Measurement, Baseline, Target, Tracking Method, Status, Notes]
        description = row[1]?.trim() || null;
        if (row[2]?.trim()) description = description ? `${description}; Baseline: ${row[2].trim()}` : `Baseline: ${row[2].trim()}`;
        successMetric = row[3]?.trim() || null;
        if (row[4]?.trim()) notes = `Tracking: ${row[4].trim()}`;
        status = row[5]?.trim() || 'Not Started';
        if (row[6]?.trim()) notes = notes ? `${notes}; ${row[6].trim()}` : row[6].trim();
      } else if (area === 'Relationship') {
        // [Goal, People Involved, Frequency, Action Plan, Status, Notes]
        description = row[1]?.trim() ? `People: ${row[1].trim()}` : null;
        if (row[2]?.trim()) description = description ? `${description}; Frequency: ${row[2].trim()}` : `Frequency: ${row[2].trim()}`;
        successMetric = row[3]?.trim() || null;
        status = row[4]?.trim() || 'Not Started';
        notes = row[5]?.trim() || null;
      } else if (area === 'Ministry & Spiritual') {
        // [Goal, Spiritual Discipline, Schedule, Consistency Metric, Status, Notes]
        description = row[1]?.trim() || null;
        if (row[2]?.trim()) description = description ? `${description}; Schedule: ${row[2].trim()}` : `Schedule: ${row[2].trim()}`;
        successMetric = row[3]?.trim() || null;
        status = row[4]?.trim() || 'Not Started';
        notes = row[5]?.trim() || null;
      }

      // Normalize status values
      const validStatuses = ['Not Started', 'In Progress', 'Completed', 'Paused'];
      if (!validStatuses.includes(status)) status = 'Not Started';

      const goal = await db.goal.create({
        data: {
          area: effectiveArea,
          title,
          description,
          whyItMatters,
          successMetric,
          targetDate,
          status,
          notes,
          order: goalOrder++,
        },
      });

      goalMap.set(title, { id: goal.id, area: effectiveArea });
      goalTitlesThisArea.push(title);
      console.log(`  ✅ Goal: "${title}" (${effectiveArea})`);
    }

    goalTitleByArea.set(area, goalTitlesThisArea);

    // Now process tasks for this area
    const taskRows = data[tasksKey];
    if (!taskRows || taskRows.length < 2) {
      console.log(`⚠️  No task data for ${area}, skipping tasks`);
      continue;
    }

    const taskData = taskRows.slice(1); // skip header
    console.log(`  📝 Processing ${area} tasks (${taskData.length} rows)...`);

    let taskOrder = 0;
    for (const row of taskData) {
      if (!row || row.length < 2 || !row[1]?.trim()) continue;

      const parentGoalRaw = row[0]?.trim() || '';
      const taskTitle = row[1].trim();
      const dependency = row[2]?.trim() || null;
      const difficultyRaw = row[3]?.trim() || null;
      const estimatedCost = row[4]?.trim() || null;
      const taskStatus = row[5]?.trim() || 'Not Started';
      const taskNotes = row[6]?.trim() || null;

      // Normalize difficulty
      let difficulty: string | null = null;
      if (difficultyRaw) {
        const dl = difficultyRaw.toLowerCase();
        if (dl.includes('low')) difficulty = 'Low';
        else if (dl.includes('medium')) difficulty = 'Medium';
        else if (dl.includes('high')) difficulty = 'High';
      }

      // Normalize status
      const validTaskStatuses = ['Not Started', 'In Progress', 'Completed', 'Skipped'];
      const normalizedTaskStatus = validTaskStatuses.includes(taskStatus) ? taskStatus : 'Not Started';

      // Find the matching goal - first try exact match
      let goalEntry = goalMap.get(parentGoalRaw);
      let matchedTitle: string | null = null;

      if (!goalEntry) {
        // Try to find closest match from all areas (not just current area)
        // because Havilah goals might be in a different area category
        const allGoalTitles = Array.from(goalMap.keys());
        const closestMatch = findClosestGoal(parentGoalRaw, allGoalTitles);

        if (closestMatch) {
          goalEntry = goalMap.get(closestMatch);
          matchedTitle = closestMatch;
          console.log(`  🔗 Matched "${parentGoalRaw}" -> "${closestMatch}" (score: ${similarity(parentGoalRaw, closestMatch).toFixed(2)})`);
        }
      }

      if (!goalEntry) {
        // Create a new goal for this parent
        const effectiveArea = isHavilahGoal(parentGoalRaw) ? 'havilah' : prismaArea;
        const newGoal = await db.goal.create({
          data: {
            area: effectiveArea,
            title: parentGoalRaw,
            status: 'Not Started',
            order: goalOrder++,
          },
        });
        goalEntry = { id: newGoal.id, area: effectiveArea };
        goalMap.set(parentGoalRaw, goalEntry);
        const areaTitles = goalTitleByArea.get(area) || [];
        areaTitles.push(parentGoalRaw);
        goalTitleByArea.set(area, areaTitles);
        console.log(`  🆕 Created missing goal: "${parentGoalRaw}" (${effectiveArea})`);
      }

      await db.task.create({
        data: {
          goalId: goalEntry.id,
          title: taskTitle,
          dependency,
          difficulty,
          estimatedCost,
          status: normalizedTaskStatus,
          notes: taskNotes,
          order: taskOrder++,
        },
      });
    }
  }

  // Seed LifeAreaScore for today
  const today = new Date().toISOString().split('T')[0];
  console.log(`📊 Creating LifeAreaScore for ${today}...`);
  await db.lifeAreaScore.create({
    data: {
      date: today,
      faith: 5,
      health: 5,
      career: 5,
      havilah: 5,
      finances: 5,
      relationships: 5,
      personalGrowth: 5,
      overall: 5,
    },
  });

  // Seed sample Memory entries
  console.log('🧠 Creating sample Memory entries...');
  const sampleMemories = [
    {
      type: 'win',
      area: 'career',
      content: 'Completed CV audit and highlighted transferable skills for international roles',
      date: today,
    },
    {
      type: 'strength',
      area: 'ministry',
      content: 'Consistent morning devotion pattern established - waking at 4am naturally',
      date: today,
    },
    {
      type: 'decision',
      area: 'finances',
      content: 'Decided to use money manager app for daily income tracking starting January',
      date: today,
    },
    {
      type: 'pattern',
      area: 'health',
      content: 'Noticed tendency to skip meals during busy work days - need to plan ahead',
      date: today,
    },
    {
      type: 'distraction',
      area: 'personalGrowth',
      content: 'Social media scrolling consuming 1+ hours daily - need to set boundaries',
      date: today,
    },
  ];

  for (const mem of sampleMemories) {
    await db.memory.create({ data: mem });
  }

  // Print summary
  const goalCount = await db.goal.count();
  const taskCount = await db.task.count();
  const memoryCount = await db.memory.count();
  const scoreCount = await db.lifeAreaScore.count();

  // Count goals by area
  const goalsByArea = await db.goal.groupBy({
    by: ['area'],
    _count: { id: true },
  });

  // Count tasks per goal
  const goalsWithTasks = await db.goal.findMany({
    include: { _count: { select: { tasks: true } } },
    orderBy: { order: 'asc' },
  });

  console.log('\n🎉 Seed complete!');
  console.log(`   Goals: ${goalCount}`);
  console.log(`   Tasks: ${taskCount}`);
  console.log(`   Memories: ${memoryCount}`);
  console.log(`   LifeAreaScores: ${scoreCount}`);
  console.log('   Goals by area:');
  for (const g of goalsByArea) {
    console.log(`     ${g.area}: ${g._count.id}`);
  }
  console.log('   Goals with 0 tasks:');
  for (const g of goalsWithTasks) {
    if (g._count.tasks === 0) {
      console.log(`     [${g.area}] ${g.title}`);
    }
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
