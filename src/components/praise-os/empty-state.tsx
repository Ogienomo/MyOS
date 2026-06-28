'use client'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center mb-4 text-neutral-300 dark:text-neutral-600">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">{title}</h3>
      <p className="text-xs text-neutral-400 dark:text-neutral-500 max-w-[200px] mb-4">{description}</p>
      {action && (
        <button onClick={action.onClick} className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors">
          {action.label}
        </button>
      )}
    </div>
  )
}
