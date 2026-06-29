import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userid'

// POST /api/dedup - Find and remove duplicate goals/tasks
export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request)
    let goalsRemoved = 0
    let tasksRemoved = 0

    // Find all goals grouped by area+title (case-insensitive)
    const allGoals = await db.goal.findMany({
      where: { userId },
      include: { tasks: true },
      orderBy: { createdAt: 'asc' },
    })

    // Group by area + normalized title
    const goalGroups: Record<string, typeof allGoals> = {}
    for (const goal of allGoals) {
      const key = `${goal.area}:${goal.title.toLowerCase().trim()}`
      if (!goalGroups[key]) goalGroups[key] = []
      goalGroups[key].push(goal)
    }

    // For each group with duplicates, keep the best one and delete the rest
    for (const [, goals] of Object.entries(goalGroups)) {
      if (goals.length <= 1) continue

      // Sort: prefer goals with more tasks, then more recent
      const sorted = [...goals].sort((a, b) => {
        if (b.tasks.length !== a.tasks.length) return b.tasks.length - a.tasks.length
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })

      // Keep the first one (best), delete the rest
      const toDelete = sorted.slice(1)
      for (const goal of toDelete) {
        // If the duplicate has metadata that the keeper doesn't have, merge it first
        const keeper = sorted[0]
        const updates: Record<string, string> = {}

        if (!keeper.description && goal.description) updates.description = goal.description
        if (!keeper.whyItMatters && goal.whyItMatters) updates.whyItMatters = goal.whyItMatters
        if (!keeper.successMetric && goal.successMetric) updates.successMetric = goal.successMetric

        if (Object.keys(updates).length > 0) {
          await db.goal.update({
            where: { id: keeper.id },
            data: updates,
          })
        }

        // Delete the duplicate (cascade will delete its tasks too)
        await db.goal.delete({ where: { id: goal.id } })
        goalsRemoved++
      }
    }

    // Now check for duplicate tasks within each goal
    const allRemainingGoals = await db.goal.findMany({
      where: { userId },
      include: { tasks: true },
    })

    for (const goal of allRemainingGoals) {
      const taskGroups: Record<string, typeof goal.tasks> = {}
      for (const task of goal.tasks) {
        const key = task.title.toLowerCase().trim()
        if (!taskGroups[key]) taskGroups[key] = []
        taskGroups[key].push(task)
      }

      for (const [, tasks] of Object.entries(taskGroups)) {
        if (tasks.length <= 1) continue

        // Keep the first one (oldest), delete the rest
        const toDelete = tasks.slice(1)
        for (const task of toDelete) {
          await db.task.delete({ where: { id: task.id } })
          tasksRemoved++
        }
      }
    }

    return NextResponse.json({
      success: true,
      goalsRemoved,
      tasksRemoved,
      message: `Removed ${goalsRemoved} duplicate goals and ${tasksRemoved} duplicate tasks`,
    })
  } catch (error) {
    console.error('Dedup error:', error)
    return NextResponse.json({ error: 'Failed to deduplicate' }, { status: 500 })
  }
}
