'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Types ───────────────────────────────────────────────────────────
type Screen = 'boot' | 'first-setup' | 'login' | 'user-setup' | 'shell'

interface FileSystemNode {
  type: 'file' | 'dir'
  content?: string
  children?: Record<string, FileSystemNode>
}

interface User {
  username: string
  passwordHash: string
}

// ─── Helper: simple SHA-256 hash (async) ─────────────────────────────
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── Virtual File System ─────────────────────────────────────────────
function createDefaultFS(): Record<string, FileSystemNode> {
  return {
    'home': {
      type: 'dir',
      children: {
        'documents': { type: 'dir', children: {} },
        'readme.txt': { type: 'file', content: 'Welcome to MyOS! Type "help" for commands.' },
      }
    }
  }
}

function resolvePath(cwd: string[], path: string): string[] | null {
  if (path === '/') return []
  if (path === '~' || path === '') return ['home']

  const parts = path.startsWith('/') ? path.split('/').filter(Boolean) : [...cwd, ...path.split('/').filter(Boolean)]
  const resolved: string[] = []

  for (const part of parts) {
    if (part === '..') {
      if (resolved.length > 0) resolved.pop()
    } else if (part !== '.') {
      resolved.push(part)
    }
  }
  return resolved
}

function getNode(fs: Record<string, FileSystemNode>, path: string[]): FileSystemNode | null {
  if (path.length === 0) return { type: 'dir', children: fs }
  let current: FileSystemNode | null = { type: 'dir', children: fs }
  for (const segment of path) {
    if (!current || current.type !== 'dir' || !current.children) return null
    current = current.children[segment] || null
  }
  return current
}

function setNode(fs: Record<string, FileSystemNode>, path: string[], node: FileSystemNode): boolean {
  if (path.length === 0) return false
  const parentPath = path.slice(0, -1)
  const name = path[path.length - 1]
  const parent = getNode(fs, parentPath)
  if (!parent || parent.type !== 'dir' || !parent.children) return false
  parent.children[name] = node
  return true
}

// ─── Command Handler ─────────────────────────────────────────────────
function executeCommand(
  cmd: string,
  args: string[],
  fs: Record<string, FileSystemNode>,
  cwd: string[],
  osName: string,
  username: string,
  setFs: (fs: Record<string, FileSystemNode>) => void,
  setCwd: (cwd: string[]) => void,
  addOutput: (lines: string[]) => void,
): void {
  const command = cmd.toLowerCase()

  switch (command) {
    case 'help': {
      addOutput([
        '',
        `  ${osName} — Available Commands:`,
        '',
        '  help       — Show this help message',
        '  calc       — Calculate a math expression (e.g. calc 2+2)',
        '  cat        — Read file contents (e.g. cat readme.txt)',
        '  cd         — Change directory (e.g. cd documents)',
        '  cls        — Clear the terminal screen',
        '  echo       — Print text to the terminal',
        '  exit       — Exit the current session',
        '  ls         — List directory contents',
        '  mkdir      — Create a directory (e.g. mkdir projects)',
        '  touch      — Create a file (e.g. touch notes.txt)',
        '  rm         — Remove a file (e.g. rm notes.txt)',
        '  pwd        — Print current working directory',
        '  whoami     — Show current username',
        '  sysinfo    — Show system information',
        '  neofetch   — Show system info with ASCII art',
        '  date       — Show current date and time',
        '  pip        — Simulated package manager (e.g. pip install numpy)',
        '  runpy      — Simulated Python runner (e.g. runpy script.py)',
        ''
      ])
      break
    }

    case 'calc': {
      const expr = args.join(' ')
      if (!expr) { addOutput(['Usage: calc <expression>']); break }
      try {
        // Safe math evaluation - only allow numbers and operators
        const safe = expr.replace(/[^0-9+\-*/().%^ ]/g, '')
        if (!safe) { addOutput(['Invalid expression']); break }
        const result = Function('"use strict"; return (' + safe.replace(/\^/g, '**') + ')')()
        addOutput([`= ${result}`])
      } catch {
        addOutput(['Improper Equation'])
      }
      break
    }

    case 'cat': {
      const filePath = args[0]
      if (!filePath) { addOutput(['Usage: cat <filename>']); break }
      const resolved = resolvePath(cwd, filePath)
      if (!resolved) { addOutput(['Invalid path']); break }
      const node = getNode(fs, resolved)
      if (!node) { addOutput([`Could not find file: ${filePath}`]); break }
      if (node.type !== 'file') { addOutput([`${filePath} is a directory`]); break }
      addOutput([node.content || ''])
      break
    }

    case 'cd': {
      const target = args[0] || '~'
      const resolved = resolvePath(cwd, target)
      if (!resolved) { addOutput([`Invalid path: ${target}`]); break }
      const node = getNode(fs, resolved)
      if (!node || node.type !== 'dir') { addOutput([`${target} does not exist or is not a directory`]); break }
      setCwd(resolved)
      break
    }

    case 'cls': {
      // Clear is handled specially in the main component
      break
    }

    case 'echo': {
      addOutput([args.join(' ')])
      break
    }

    case 'exit': {
      addOutput([`Logging out of ${osName}... Goodbye!`])
      // Will be handled by parent
      break
    }

    case 'ls': {
      const targetPath = args[0] ? resolvePath(cwd, args[0]) : cwd
      if (!targetPath) { addOutput(['Invalid path']); break }
      const node = getNode(fs, targetPath)
      if (!node || node.type !== 'dir' || !node.children) { addOutput([`Cannot list: directory not found`]); break }
      const entries = Object.entries(node.children)
      if (entries.length === 0) { addOutput(['(empty directory)']); break }
      const lines = entries.map(([name, n]) =>
        n.type === 'dir' ? `  📁 ${name}/` : `  📄 ${name}`
      )
      addOutput(lines)
      break
    }

    case 'mkdir': {
      const dirName = args[0]
      if (!dirName) { addOutput(['Usage: mkdir <directory_name>']); break }
      const resolved = resolvePath(cwd, dirName)
      if (!resolved) { addOutput(['Invalid name']); break }
      const existing = getNode(fs, resolved)
      if (existing) { addOutput([`${dirName} already exists`]); break }
      const newFs = JSON.parse(JSON.stringify(fs))
      setNode(newFs, resolved, { type: 'dir', children: {} })
      setFs(newFs)
      addOutput([`Created directory: ${dirName}`])
      break
    }

    case 'touch': {
      const fileName = args[0]
      if (!fileName) { addOutput(['Usage: touch <filename>']); break }
      const resolved = resolvePath(cwd, fileName)
      if (!resolved) { addOutput(['Invalid name']); break }
      const existing = getNode(fs, resolved)
      if (existing) { addOutput([`${fileName} already exists`]); break }
      const newFs = JSON.parse(JSON.stringify(fs))
      setNode(newFs, resolved, { type: 'file', content: '' })
      setFs(newFs)
      addOutput([`Created file: ${fileName}`])
      break
    }

    case 'rm': {
      const fileName = args[0]
      if (!fileName) { addOutput(['Usage: rm <filename>']); break }
      const resolved = resolvePath(cwd, fileName)
      if (!resolved) { addOutput(['Invalid path']); break }
      const node = getNode(fs, resolved)
      if (!node) { addOutput([`Could not find: ${fileName}`]); break }
      if (node.type === 'dir' && Object.keys(node.children || {}).length > 0) {
        addOutput([`Cannot remove non-empty directory: ${fileName}`]); break
      }
      const newFs = JSON.parse(JSON.stringify(fs))
      const parentPath = resolved.slice(0, -1)
      const name = resolved[resolved.length - 1]
      const parent = getNode(newFs, parentPath)
      if (parent?.children) delete parent.children[name]
      setFs(newFs)
      addOutput([`Removed: ${fileName}`])
      break
    }

    case 'pwd': {
      addOutput([`/${cwd.join('/')}`])
      break
    }

    case 'whoami': {
      addOutput([username])
      break
    }

    case 'sysinfo': {
      addOutput([
        '',
        `  OS:        ${osName} v1.0`,
        `  Kernel:    MyOS WebKernel 1.0.0`,
        `  Shell:     mysh 1.0`,
        `  User:      ${username}`,
        `  Terminal:  Web Terminal`,
        `  Runtime:   Browser (JavaScript)`,
        ''
      ])
      break
    }

    case 'neofetch': {
      addOutput([
        '',
        `       ████████       ${username}@${osName}`,
        `     ██        ██     ──────────────────`,
        `   ██    ████    ██   OS: ${osName} v1.0`,
        `   ██  ██    ██  ██   Kernel: WebKernel 1.0`,
        `   ██  ██    ██  ██   Shell: mysh 1.0`,
        `   ██    ████    ██   Terminal: Web Terminal`,
        `     ██        ██     Resolution: ${window.innerWidth}x${window.innerHeight}`,
        `       ████████       Theme: Dark`,
        ''
      ])
      break
    }

    case 'date': {
      addOutput([new Date().toString()])
      break
    }

    case 'pip': {
      const subcmd = args[0]
      const pkg = args[1]
      if (subcmd === 'install' && pkg) {
        addOutput([`Installing ${pkg}...`, `Successfully installed ${pkg}-1.0.0`])
      } else if (subcmd === 'list') {
        addOutput(['Package        Version', '─────────────  ───────', 'myos-core      1.0.0', 'webkernel      1.0.0', 'mysh           1.0.0'])
      } else {
        addOutput(['Usage: pip install <package> | pip list'])
      }
      break
    }

    case 'runpy': {
      const file = args[0]
      if (!file) { addOutput(['Usage: runpy <script.py>']); break }
      addOutput([`[Simulated] Running ${file}...`, 'Execution complete.'])
      break
    }

    default: {
      // Try as math expression
      const mathExpr = [cmd, ...args].join(' ')
      if (/^[\d+\-*/().%^ ]+$/.test(mathExpr)) {
        try {
          const result = Function('"use strict"; return (' + mathExpr.replace(/\^/g, '**') + ')')()
          addOutput([`= ${result}`])
        } catch {
          addOutput([`Command not found: ${cmd}. Type "help" for a list of commands.`])
        }
      } else {
        addOutput([`Command not found: ${cmd}. Type "help" for a list of commands.`])
      }
    }
  }
}

// ─── Boot Messages ───────────────────────────────────────────────────
const BOOT_MESSAGES = [
  { status: 'ok', text: 'Create System Users.' },
  { status: 'ok', text: 'Entropy Daemon based on the HAVEGE algorithm.' },
  { status: 'info', text: 'Starting Rule-based Manager for Device Events and Files.' },
  { status: 'ok', text: 'Reached target Encrypting Volumes.' },
  { status: 'ok', text: 'Listening on Process Core Dump Socket.' },
  { status: 'ok', text: 'Reached target Remote File Systems.' },
  { status: 'ok', text: 'Started Create list of required static device nodes.' },
  { status: 'ok', text: 'Waiting for udev To Complete Device Initialization.' },
  { status: 'ok', text: 'Started Apply Kernel Variables.' },
  { status: 'ok', text: 'Mounted Debug File System.' },
  { status: 'ok', text: 'Started Journal service.' },
  { status: 'ok', text: 'Started Remount Root and Kernel File Systems.' },
  { status: 'info', text: 'Starting udev Coldplug all Devices...' },
  { status: 'info', text: 'Starting Flush Journal to Persistent Storage...' },
  { status: 'ok', text: 'Started Load/Save Random Seed.' },
  { status: 'ok', text: 'Started udev Coldplug all Devices.' },
  { status: 'info', text: 'Starting udev Kernel Device Manager...' },
  { status: 'ok', text: 'Started udev Kernel Device Manager.' },
  { status: 'ok', text: 'Reached target Local File Systems (Pre).' },
  { status: 'ok', text: 'Started Flush Journal to Persistent Storage.' },
  { status: 'info', text: 'Mounting /boot...' },
]

// ─── Main Component ──────────────────────────────────────────────────
export default function MyOSWeb() {
  const [screen, setScreen] = useState<Screen>('boot')
  const [osName, setOsName] = useState('MyOS')
  const [ownerName, setOwnerName] = useState('')
  const [bootLines, setBootLines] = useState<string[]>([])
  const [bootDone, setBootDone] = useState(false)

  // First setup
  const [setupName, setSetupName] = useState('')
  const [setupStep, setSetupStep] = useState<'name' | 'confirm'>('name')

  // User system
  const [users, setUsers] = useState<User[]>([])
  const [currentUser, setCurrentUser] = useState('')

  // Login
  const [loginUser, setLoginUser] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginStep, setLoginStep] = useState<'select' | 'password'>('select')

  // User setup
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newConfirm, setNewConfirm] = useState('')
  const [setupError, setSetupError] = useState('')

  // Shell
  const [output, setOutput] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [cwd, setCwd] = useState<string[]>(['home'])
  const [fs, setFs] = useState<Record<string, FileSystemNode>>(createDefaultFS())
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [output, bootLines])

  // Boot sequence animation
  useEffect(() => {
    if (screen !== 'boot') return

    // Check localStorage for existing setup
    const saved = localStorage.getItem('myos-settings')
    if (saved) {
      try {
        const settings = JSON.parse(saved)
        if (settings.osName) {
          setOsName(settings.osName)
          setOwnerName(settings.ownerName || '')
        }
        if (settings.users) {
          setUsers(settings.users)
        }
      } catch { /* ignore */ }
    }

    let i = 0
    const timer = setInterval(() => {
      if (i < BOOT_MESSAGES.length) {
        const msg = BOOT_MESSAGES[i]
        const prefix = msg.status === 'ok'
          ? <span style={{ color: '#4ade80' }}>[  OK  ] </span>
          : <span>{'         '}</span>

        setBootLines(prev => [...prev, msg.text])

        i++
      } else {
        // Add personalized welcome
        const savedNow = localStorage.getItem('myos-settings')
        let name = 'MyOS'
        if (savedNow) {
          try { name = JSON.parse(savedNow).osName || 'MyOS' } catch { /* */ }
        }
        setBootLines(prev => [...prev, `Welcome to ${name}!`])
        clearInterval(timer)
        setTimeout(() => setBootDone(true), 800)
      }
    }, 80)

    return () => clearInterval(timer)
  }, [screen])

  // After boot, decide next screen
  useEffect(() => {
    if (!bootDone) return
    const saved = localStorage.getItem('myos-settings')
    if (saved) {
      try {
        const settings = JSON.parse(saved)
        if (settings.osName) {
          // Already set up, go to login
          setScreen('login')
          return
        }
      } catch { /* */ }
    }
    setScreen('first-setup')
  }, [bootDone])

  // Save settings
  const saveSettings = useCallback((newOsName: string, newOwner: string, newUsers: User[]) => {
    localStorage.setItem('myos-settings', JSON.stringify({
      osName: newOsName,
      ownerName: newOwner,
      users: newUsers,
    }))
  }, [])

  // Focus input
  useEffect(() => {
    if (screen === 'shell') {
      inputRef.current?.focus()
    }
  }, [screen])

  const addOutput = useCallback((lines: string[]) => {
    setOutput(prev => [...prev, ...lines])
  }, [])

  // Handle first setup
  const handleFirstSetup = () => {
    if (setupStep === 'name') {
      if (!setupName.trim()) return
      setSetupStep('confirm')
      return
    }
    // Confirm step
    const clean = setupName.trim().replace(/OS$/i, '').trim()
    const name = `${clean}OS`
    setOsName(name)
    setOwnerName(clean)
    saveSettings(name, clean, users)
    setScreen('login')
  }

  // Handle user creation
  const handleUserSetup = async () => {
    if (!newUsername.trim()) { setSetupError('Username cannot be empty'); return }
    if (!newPassword) { setSetupError('Password cannot be empty'); return }
    if (newPassword !== newConfirm) { setSetupError('Passwords do not match'); return }
    if (users.find(u => u.username === newUsername.trim())) { setSetupError('User already exists'); return }

    const hash = await hashPassword(newPassword)
    const updatedUsers = [...users, { username: newUsername.trim(), passwordHash: hash }]
    setUsers(updatedUsers)
    saveSettings(osName, ownerName, updatedUsers)

    setCurrentUser(newUsername.trim())
    setCwd(['home'])
    setOutput([
      '',
      `  Welcome to ${osName}, ${newUsername.trim()}!`,
      `  Type "help" for a list of commands.`,
      ''
    ])
    setScreen('shell')
  }

  // Handle login
  const handleLogin = async () => {
    const user = users.find(u => u.username === loginUser)
    if (!user) { setLoginError('User not found'); return }

    const hash = await hashPassword(loginPass)
    if (hash !== user.passwordHash) {
      setLoginError('Incorrect password')
      setLoginPass('')
      return
    }

    setCurrentUser(user.username)
    setCwd(['home'])
    setOutput([
      '',
      `  Welcome to ${osName}, ${user.username}!`,
      `  Type "help" for a list of commands.`,
      ''
    ])
    setScreen('shell')
  }

  // Handle shell input
  const handleCommand = () => {
    const trimmed = input.trim()
    if (!trimmed) return

    const parts = trimmed.split(/\s+/)
    const cmd = parts[0]
    const args = parts.slice(1)

    const prompt = `${currentUser}@${osName}:/${cwd.join('/').replace('home', '~') || '~'}$ `
    setOutput(prev => [...prev, `${prompt}${trimmed}`])
    setCommandHistory(prev => [...prev, trimmed])
    setHistoryIndex(-1)

    if (cmd === 'cls') {
      setOutput([])
    } else if (cmd === 'exit') {
      setScreen('login')
      setLoginStep('select')
      setLoginUser('')
      setLoginPass('')
      setLoginError('')
    } else {
      executeCommand(cmd, args, fs, cwd, osName, currentUser, setFs, setCwd, addOutput)
    }

    setInput('')
  }

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCommand()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1)
        setHistoryIndex(newIndex)
        setInput(commandHistory[newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1)
          setInput('')
        } else {
          setHistoryIndex(newIndex)
          setInput(commandHistory[newIndex])
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault()
      // Simple tab completion for commands
      const commands = ['help', 'calc', 'cat', 'cd', 'cls', 'echo', 'exit', 'ls', 'mkdir', 'touch', 'rm', 'pwd', 'whoami', 'sysinfo', 'neofetch', 'date', 'pip', 'runpy']
      const match = commands.filter(c => c.startsWith(input.toLowerCase()))
      if (match.length === 1) setInput(match[0])
    }
  }

  // ─── Boot Screen ─────────────────────────────────────────────────
  if (screen === 'boot') {
    return (
      <div className="min-h-screen bg-black text-green-400 font-mono p-4 text-sm leading-relaxed overflow-hidden">
        <div className="max-w-4xl mx-auto">
          {bootLines.map((line, i) => {
            const msg = BOOT_MESSAGES[i]
            const isOk = msg?.status === 'ok'
            return (
              <div key={i} className="flex">
                {isOk && <span className="text-green-400 mr-1">[  OK  ] </span>}
                {!isOk && i < BOOT_MESSAGES.length && <span className="mr-1">         </span>}
                <span>{i >= BOOT_MESSAGES.length ? line : (msg?.text || line)}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ─── First Run Setup ─────────────────────────────────────────────
  if (screen === 'first-setup') {
    return (
      <div className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <div className="border border-green-800 rounded-lg p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">MyOS</h1>
              <p className="text-green-600">Your Personal Virtual OS</p>
            </div>

            {setupStep === 'name' ? (
              <div>
                <p className="mb-4 text-green-300">
                  This is a one-time setup to personalise your OS.
                  Enter your name and the entire OS will be branded just for you.
                </p>
                <div className="mb-4 p-3 border border-green-900 rounded text-green-500 text-sm">
                  <p>Example: Name &quot;James&quot; → JamesOS</p>
                  <p>Example: Name &quot;Ada&quot; → AdaOS</p>
                </div>
                <div className="mb-6">
                  <label className="block mb-2 text-green-300">Enter your name:</label>
                  <input
                    type="text"
                    value={setupName}
                    onChange={(e) => setSetupName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFirstSetup()}
                    className="w-full bg-black border border-green-700 rounded px-3 py-2 text-green-400 focus:outline-none focus:border-green-500"
                    autoFocus
                    placeholder="Your name..."
                  />
                </div>
                <button
                  onClick={handleFirstSetup}
                  disabled={!setupName.trim()}
                  className="w-full bg-green-800 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-2 px-4 rounded transition-colors"
                >
                  Continue
                </button>
              </div>
            ) : (
              <div>
                <p className="mb-4 text-green-300">Your OS will be called:</p>
                <p className="text-4xl font-bold text-yellow-400 mb-6 text-center">
                  {setupName.trim().replace(/OS$/i, '').trim()}OS
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setSetupStep('name')}
                    className="flex-1 border border-green-700 hover:bg-green-900 text-green-400 py-2 px-4 rounded transition-colors"
                  >
                    Go Back
                  </button>
                  <button
                    onClick={handleFirstSetup}
                    className="flex-1 bg-green-800 hover:bg-green-700 text-black font-bold py-2 px-4 rounded transition-colors"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── Login Screen ────────────────────────────────────────────────
  if (screen === 'login') {
    return (
      <div className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="border border-green-800 rounded-lg p-8">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-2 text-yellow-400">{osName}</h1>
              <p className="text-green-600">{osName} LOGIN PAGE</p>
            </div>

            {users.length === 0 ? (
              <div>
                <p className="text-green-300 mb-4">No users found. Create your first user:</p>
                <button
                  onClick={() => setScreen('user-setup')}
                  className="w-full bg-green-800 hover:bg-green-700 text-black font-bold py-2 px-4 rounded transition-colors"
                >
                  Create New User
                </button>
              </div>
            ) : loginStep === 'select' ? (
              <div>
                <p className="text-green-300 mb-4">Select a user:</p>
                <div className="space-y-2 mb-4">
                  {users.map(user => (
                    <button
                      key={user.username}
                      onClick={() => { setLoginUser(user.username); setLoginStep('password') }}
                      className="w-full text-left border border-green-800 hover:bg-green-900 rounded px-4 py-2 transition-colors"
                    >
                      👤 {user.username}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setScreen('user-setup')}
                  className="w-full border border-green-700 hover:bg-green-900 text-green-400 py-2 px-4 rounded transition-colors"
                >
                  + Create New User
                </button>
              </div>
            ) : (
              <div>
                <p className="text-green-300 mb-2">
                  Enter password for <span className="text-yellow-400">{loginUser}</span>:
                </p>
                <input
                  type="password"
                  value={loginPass}
                  onChange={(e) => { setLoginPass(e.target.value); setLoginError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full bg-black border border-green-700 rounded px-3 py-2 text-green-400 mb-4 focus:outline-none focus:border-green-500"
                  autoFocus
                />
                {loginError && <p className="text-red-400 mb-4 text-sm">{loginError}</p>}
                <div className="flex gap-4">
                  <button
                    onClick={() => { setLoginStep('select'); setLoginPass(''); setLoginError('') }}
                    className="flex-1 border border-green-700 hover:bg-green-900 text-green-400 py-2 px-4 rounded transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleLogin}
                    className="flex-1 bg-green-800 hover:bg-green-700 text-black font-bold py-2 px-4 rounded transition-colors"
                  >
                    Login
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── User Setup Screen ───────────────────────────────────────────
  if (screen === 'user-setup') {
    return (
      <div className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="border border-green-800 rounded-lg p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2 text-yellow-400">{osName}</h1>
              <p className="text-green-600">{osName} USER SETUP</p>
            </div>

            <div className="mb-4">
              <label className="block mb-1 text-green-300">Username:</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => { setNewUsername(e.target.value); setSetupError('') }}
                className="w-full bg-black border border-green-700 rounded px-3 py-2 text-green-400 focus:outline-none focus:border-green-500"
                autoFocus
              />
            </div>

            <div className="mb-4">
              <label className="block mb-1 text-green-300">Password:</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setSetupError('') }}
                className="w-full bg-black border border-green-700 rounded px-3 py-2 text-green-400 focus:outline-none focus:border-green-500"
              />
            </div>

            <div className="mb-4">
              <label className="block mb-1 text-green-300">Confirm Password:</label>
              <input
                type="password"
                value={newConfirm}
                onChange={(e) => { setNewConfirm(e.target.value); setSetupError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleUserSetup()}
                className="w-full bg-black border border-green-700 rounded px-3 py-2 text-green-400 focus:outline-none focus:border-green-500"
              />
            </div>

            {setupError && <p className="text-red-400 mb-4 text-sm">{setupError}</p>}

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setScreen('login')
                  setNewUsername('')
                  setNewPassword('')
                  setNewConfirm('')
                  setSetupError('')
                }}
                className="flex-1 border border-green-700 hover:bg-green-900 text-green-400 py-2 px-4 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUserSetup}
                className="flex-1 bg-green-800 hover:bg-green-700 text-black font-bold py-2 px-4 rounded transition-colors"
              >
                Create User
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Shell Screen ────────────────────────────────────────────────
  const prompt = `${currentUser}@${osName}:/${cwd.join('/').replace('home', '~') || '~'}$ `

  return (
    <div
      className="min-h-screen bg-black text-green-400 font-mono flex flex-col"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Top bar */}
      <div className="bg-gray-900 border-b border-green-900 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        <span className="text-green-600 text-sm">{osName} Terminal</span>
        <span className="text-green-800 text-xs">{new Date().toLocaleDateString()}</span>
      </div>

      {/* Terminal output */}
      <div
        ref={terminalRef}
        className="flex-1 p-4 overflow-y-auto text-sm leading-relaxed"
        style={{ scrollBehavior: 'smooth' }}
      >
        {output.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-all">
            {line.startsWith(currentUser + '@') ? (
              <span>
                <span className="text-red-400">{line.split(':').shift()}</span>
                <span className="text-green-400">:{line.split(':').slice(1).join(':')}</span>
              </span>
            ) : (
              <span>{line}</span>
            )}
          </div>
        ))}

        {/* Input line */}
        <div className="flex items-center">
          <span className="text-red-400">{currentUser}@{osName}:</span>
          <span className="text-blue-400">/{cwd.join('/').replace('home', '~') || '~'}</span>
          <span className="text-green-400">$ </span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-green-400 focus:outline-none caret-green-400"
            autoFocus
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  )
}
