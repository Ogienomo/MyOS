import { create } from 'zustand'

export type TabId =
  | 'dashboard'
  | 'chat'
  | 'life'
  | 'goals'
  | 'finances'
  | 'insights'
  | 'calendar'
  | 'faith'
  | 'health'
  | 'career'
  | 'havilah'
  | 'relationships'
  | 'personalGrowth'
  | 'about'
  | 'journal'
  | 'moodLog'
  | 'habits'
  | 'weeklyReview'
  | 'settings'
  | 'more'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  checkInType?: string
  timestamp: string
  hasVoice?: boolean
  hasImage?: boolean
}

export interface LifeScore {
  faith: number
  health: number
  career: number
  havilah: number
  finances: number
  relationships: number
  personalGrowth: number
  overall: number
  date: string
}

export interface CheckIn {
  id: string
  type: string
  date: string
  data: string
  aiResponse: string | null
  createdAt: string
}

export interface Goal {
  id: string
  area: string
  title: string
  description: string | null
  tasks: Task[]
}

export interface Task {
  id: string
  title: string
  status: string
  difficulty: string | null
  estimatedCost: string | null
  notes: string | null
  dependency: string | null
  order: number
}

export interface FinanceEntry {
  id: string
  date: string
  type: string
  amount: number
  category: string
  purpose: string | null
  aligned: boolean | null
  notes: string | null
}

export interface DriftAlert {
  id: string
  area: string
  severity: string
  message: string
  resolved: boolean
  date: string
}

export interface Memory {
  id: string
  type: string
  area: string
  content: string
  date: string
}

export interface StreakData {
  type: string
  currentStreak: number
  longestStreak: number
  lastDate: string | null
}

export interface QuickLogData {
  id: string
  date: string
  time: string
  mood: number
  energy: number
  focus: number
  note: string | null
}

export interface CheckInWindow {
  morningEnabled: boolean
  morningTime: string  // HH:mm
  eveningEnabled: boolean
  eveningTime: string  // HH:mm
  windowMinutes: number // how many minutes before/after the scheduled time is acceptable
  strictMode: boolean   // if true, can only check in within window
}

export interface UserSettings {
  checkInWindows: CheckInWindow
  notificationsEnabled: boolean
  morningReminderEnabled: boolean
  eveningReminderEnabled: boolean
  driftAlertNotifications: boolean
  streakNotifications: boolean
  morningReminderMinutesBefore: number
  eveningReminderMinutesBefore: number
  voiceNotesEnabled: boolean
  imageUploadEnabled: boolean
  darkMode: boolean
  googleCalendarEnabled: boolean
  googleEmailReminders: boolean
  googleReminderEmail: string
}

export interface DashboardData {
  scores: LifeScore | null
  recentCheckIns: CheckIn[]
  nextCheckIn: { type: string; label: string; time: string; emoji: string; alreadyCompleted?: boolean } | null
  activeDriftAlerts: DriftAlert[]
  financialSummary: { totalReceived: number; totalSpent: number; net: number; weekReceived?: number; weekSpent?: number; weekNet?: number }
  goalStats: { total: number; completed: number; inProgress: number; notStarted: number }
  taskStats: { total: number; completed: number; inProgress: number; notStarted: number }
  scoreTrend: LifeScore[]
  streaks: StreakData[]
  todayQuickLog: QuickLogData | null
  completedCheckInTypes: string[]
}

export interface JournalEntry {
  id: string
  area: string
  title: string | null
  content: string
  mood: string | null
  tags: string | null
  date: string
  createdAt: string
  updatedAt: string
}

export interface MonthlySummary {
  id: string
  area: string
  month: string
  summary: string
  highlights: string | null
  score: number | null
  createdAt: string
  updatedAt: string
}

export interface LifeAreaProgress {
  id: string
  area: string
  currentStatus: string | null
  idealVision: string | null
  keyActions: string | null
  blockers: string | null
  motivation: string | null
  createdAt: string
  updatedAt: string
}

interface AppState {
  activeTab: TabId
  setActiveTab: (tab: TabId) => void

  // Auth
  isAuthenticated: boolean
  setIsAuthenticated: (val: boolean) => void

  // Chat
  chatMessages: ChatMessage[]
  chatLoading: boolean
  chatHistoryLoaded: boolean
  addChatMessage: (msg: ChatMessage) => void
  setChatMessages: (msgs: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void
  setChatLoading: (loading: boolean) => void
  setChatHistoryLoaded: (loaded: boolean) => void
  clearChat: () => void

  // Dashboard
  dashboardData: DashboardData | null
  dashboardLoading: boolean
  setDashboardData: (data: DashboardData) => void
  setDashboardLoading: (loading: boolean) => void

  // Goals
  goals: Goal[]
  goalsLoading: boolean
  setGoals: (goals: Goal[]) => void
  setGoalsLoading: (loading: boolean) => void

  // Finances
  finances: FinanceEntry[]
  financesLoading: boolean
  setFinances: (finances: FinanceEntry[]) => void
  setFinancesLoading: (loading: boolean) => void

  // Insights
  driftAlerts: DriftAlert[]
  memories: Memory[]
  insightsLoading: boolean
  setDriftAlerts: (alerts: DriftAlert[]) => void
  setMemories: (memories: Memory[]) => void
  setInsightsLoading: (loading: boolean) => void

  // Scores
  scores: LifeScore[]
  setScores: (scores: LifeScore[]) => void

  // Active check-in type
  activeCheckInType: string | null
  setActiveCheckInType: (type: string | null) => void

  // Journal
  journals: JournalEntry[]
  journalsLoading: boolean
  setJournals: (journals: JournalEntry[]) => void
  setJournalsLoading: (loading: boolean) => void

  // Life Area Progress
  lifeAreaProgress: LifeAreaProgress[]
  lifeAreaProgressLoading: boolean
  setLifeAreaProgress: (progress: LifeAreaProgress[]) => void
  setLifeAreaProgressLoading: (loading: boolean) => void

  // Streaks
  streaks: StreakData[]
  setStreaks: (streaks: StreakData[]) => void

  // Quick Log
  todayQuickLog: QuickLogData | null
  setTodayQuickLog: (log: QuickLogData | null) => void

  // Mood Logs
  moodLogs: QuickLogData[]
  setMoodLogs: (logs: QuickLogData[]) => void
  moodLogsLoading: boolean
  setMoodLogsLoading: (loading: boolean) => void

  // Settings
  userSettings: UserSettings | null
  setUserSettings: (settings: UserSettings) => void

  // Settings dialog
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void

  // Sync timestamp
  lastSyncTimestamp: number
  setLastSyncTimestamp: (ts: number) => void

  // Highlight item (for search navigation)
  highlightItemId: string | null
  highlightItemType: string | null
  setHighlightItem: (id: string | null, type: string | null) => void
  clearHighlightItem: () => void
}

const DEFAULT_SETTINGS: UserSettings = {
  checkInWindows: {
    morningEnabled: true,
    morningTime: '05:00',
    eveningEnabled: true,
    eveningTime: '20:30',
    windowMinutes: 60,
    strictMode: false,
  },
  notificationsEnabled: true,
  morningReminderEnabled: true,
  eveningReminderEnabled: true,
  driftAlertNotifications: true,
  streakNotifications: true,
  morningReminderMinutesBefore: 10,
  eveningReminderMinutesBefore: 10,
  voiceNotesEnabled: true,
  imageUploadEnabled: true,
  darkMode: false,
  googleCalendarEnabled: false,
  googleEmailReminders: false,
  googleReminderEmail: '',
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Auth
  isAuthenticated: false,
  setIsAuthenticated: (val) => set({ isAuthenticated: val }),

  chatMessages: [],
  chatLoading: false,
  chatHistoryLoaded: false,
  addChatMessage: (msg) => set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
  setChatMessages: (msgs) => set((state) => ({ chatMessages: typeof msgs === 'function' ? msgs(state.chatMessages) : msgs })),
  setChatLoading: (loading) => set({ chatLoading: loading }),
  setChatHistoryLoaded: (loaded) => set({ chatHistoryLoaded: loaded }),
  clearChat: () => set({ chatMessages: [], chatHistoryLoaded: false }),

  dashboardData: null,
  dashboardLoading: true,
  setDashboardData: (data) => set({ dashboardData: data }),
  setDashboardLoading: (loading) => set({ dashboardLoading: loading }),

  goals: [],
  goalsLoading: true,
  setGoals: (goals) => set({ goals }),
  setGoalsLoading: (loading) => set({ goalsLoading: loading }),

  finances: [],
  financesLoading: true,
  setFinances: (finances) => set({ finances }),
  setFinancesLoading: (loading) => set({ financesLoading: loading }),

  driftAlerts: [],
  memories: [],
  insightsLoading: true,
  setDriftAlerts: (alerts) => set({ driftAlerts: alerts }),
  setMemories: (memories) => set({ memories }),
  setInsightsLoading: (loading) => set({ insightsLoading: loading }),

  scores: [],
  setScores: (scores) => set({ scores }),

  activeCheckInType: null,
  setActiveCheckInType: (type) => set({ activeCheckInType: type }),

  // Journal
  journals: [],
  journalsLoading: false,
  setJournals: (journals) => set({ journals }),
  setJournalsLoading: (loading) => set({ journalsLoading: loading }),

  // Life Area Progress
  lifeAreaProgress: [],
  lifeAreaProgressLoading: false,
  setLifeAreaProgress: (progress) => set({ lifeAreaProgress: progress }),
  setLifeAreaProgressLoading: (loading) => set({ lifeAreaProgressLoading: loading }),

  // Streaks
  streaks: [],
  setStreaks: (streaks) => set({ streaks }),

  // Quick Log
  todayQuickLog: null,
  setTodayQuickLog: (log) => set({ todayQuickLog: log }),

  // Mood Logs
  moodLogs: [],
  setMoodLogs: (logs) => set({ moodLogs: logs }),
  moodLogsLoading: false,
  setMoodLogsLoading: (loading) => set({ moodLogsLoading: loading }),

  // Settings
  userSettings: DEFAULT_SETTINGS,
  setUserSettings: (settings) => set({ userSettings: settings }),

  // Settings dialog
  settingsOpen: false,
  setSettingsOpen: (open) => set({ settingsOpen: open }),

  // Sync timestamp
  lastSyncTimestamp: 0,
  setLastSyncTimestamp: (ts) => set({ lastSyncTimestamp: ts }),

  // Highlight item (for search navigation)
  highlightItemId: null,
  highlightItemType: null,
  setHighlightItem: (id, type) => set({ highlightItemId: id, highlightItemType: type }),
  clearHighlightItem: () => set({ highlightItemId: null, highlightItemType: null }),
}))
