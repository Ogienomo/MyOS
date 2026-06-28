# MyOS Worklog

---
Task ID: 1
Agent: Main
Task: Clone PraiseOS from Ogienomo/praise-os, de-personalise, add Danger Zone, deploy to Vercel

Work Log:
- Cloned source from private repo Ogienomo/praise-os using GitHub API (185 source files)
- Identified 31 files with Praise-specific references
- Performed two-pass rebranding: replaced all "Praise OS" → "MyOS", "Praise Obaje" → generic user references
- Replaced localStorage keys, custom events, notification tags, export filenames
- Made AI coaching prompts generic/user-focused instead of Praise-specific
- Removed FOUNDER.jpg reference, replaced with Sparkles icon
- Renamed component directory from praise-os to myos
- Added Danger Zone tab in Settings with Delete All Data feature (requires typing DELETE)
- Morning alignment time is user-configurable in Settings (was hardcoded to 5:00 AM)
- Goals are user-created (removed Praise's preset goals from seed data)
- Fixed function name corruption (the userOS → MyOSApp)
- Fixed conversational text references (", the user." → ".", etc.)
- Deployed to Vercel at https://myos-life.vercel.app (account: praiseobaje2001@gmail.com)
- Pushed to GitHub at https://github.com/Ogienomo/MyOS

Stage Summary:
- MyOS is live at https://myos-life.vercel.app
- GitHub: https://github.com/Ogienomo/MyOS
- Zero personal data from Praise remains in the codebase
- All PraiseOS features preserved: Dashboard, AI Coach, Life Areas, Goals, Finances, Journal, Habits, Insights, Calendar, etc.
- Danger Zone feature added with type-to-confirm deletion
- Build uses SQLite (data won't persist on Vercel without PostgreSQL - needs DATABASE_URL env var)
