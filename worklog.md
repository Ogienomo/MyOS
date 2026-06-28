# MyOS Worklog

---
Task ID: 1
Agent: Main
Task: Clone PraiseOS, de-personalise, add dynamic branding, push as MyOS

Work Log:
- Cloned PraiseOS from GitHub (PraiseOS/PraiseOS)
- Analyzed all 15+ source files for personal references
- Identified 6 files with hardcoded "PraiseOS" branding and personal contact info
- Created new MyOS project with same core structure
- Added first_run_setup.pyw — asks user for name on first launch
- Modified utils.py to read dynamic OS name from data.json
- Updated all display files (bootscreen, bootmanager, bootloader, login, setup, home) to use dynamic name
- Removed Discord link and praisedevteam@gmail.com
- Kept only attribution credit in README.md (required by AGPL-3.0)
- All Python files pass syntax checks
- Unit tests pass: default name "MyOS", dynamic name "JamesOS" works correctly
- Created GitHub repo: Ogienomo/MyOS
- Pushed to main branch

Stage Summary:
- MyOS is live at https://github.com/Ogienomo/MyOS
- Zero personal data from Praise remains (except attribution in README)
- User enters name → OS becomes [Name]OS dynamically
- Full original functionality preserved
