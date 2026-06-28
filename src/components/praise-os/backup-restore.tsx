'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Download, Upload, Database, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface RestoreResult {
  success: boolean
  message: string
  restored?: Record<string, number>
}

export function BackupRestore() {
  const [exporting, setExporting] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null)

  const handleExport = async (format: 'json' | 'csv') => {
    setExporting(true)
    try {
      const res = await fetch(`/api/export?section=all&format=${format}`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `myos-backup-${new Date().toISOString().split('T')[0]}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export error:', err)
      alert('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.json')) {
      alert('Please select a JSON backup file (exported from MyOS).')
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      alert('File too large. Maximum backup size is 50 MB.')
      return
    }

    setRestoring(true)
    setRestoreResult(null)

    try {
      const text = await file.text()
      let data: Record<string, unknown>
      try {
        data = JSON.parse(text)
      } catch {
        setRestoreResult({ success: false, message: 'Invalid JSON file. Please select a valid MyOS backup.' })
        return
      }

      const res = await fetch('/api/export/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()

      if (res.ok && result.success) {
        setRestoreResult({ success: true, message: result.message || 'Data restored successfully.', restored: result.restored })
      } else {
        setRestoreResult({ success: false, message: result.error || 'Restore failed. Please try again.' })
      }
    } catch (err) {
      console.error('Restore error:', err)
      setRestoreResult({ success: false, message: 'Restore failed. Please try again.' })
    } finally {
      setRestoring(false)
      e.target.value = ''
    }
  }

  return (
    <Card className="shadow-sm border-neutral-200 dark:border-neutral-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Database className="h-4 w-4 text-red-500" />
          Backup & Restore
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Export section */}
        <div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Export all your data as a backup</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => handleExport('json')}
              disabled={exporting}
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Export JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => handleExport('csv')}
              disabled={exporting}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="border-t border-neutral-100 dark:border-neutral-800" />

        {/* Restore section */}
        <div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Restore from a JSON backup file</p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">Warning: restoring will merge backup data with existing data.</p>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled={restoring}>
                {restoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Restore from Backup
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Restore Data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will import data from your backup file and merge it with your existing data.
                  Duplicate entries may be created. Proceed only with a backup file from MyOS.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => document.getElementById('restore-file-input')?.click()}
                >
                  Choose Backup File
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <input
            id="restore-file-input"
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleRestore}
          />
        </div>

        {/* Result */}
        {restoreResult && (
          <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${
            restoreResult.success
              ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}>
            {restoreResult.success
              ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            }
            <div>
              <p className="font-medium">{restoreResult.message}</p>
              {restoreResult.restored && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.entries(restoreResult.restored).map(([key, count]) => (
                    <Badge key={key} variant="outline" className="text-xs">
                      {key}: {count}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
