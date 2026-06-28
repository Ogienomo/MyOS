#!/usr/bin/env python3
"""
Bulk rebrand script: Replace Praise OS → MyOS (dynamic), Praise Obaje → user (dynamic)
This handles the straightforward text replacements across the codebase.
"""
import os
import re

BASE = '/home/z/my-project/src'

def process_file(filepath):
    """Process a single file, return True if modified."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except (UnicodeDecodeError, PermissionError):
        return False
    
    original = content
    
    # ─── Client-side dynamic replacements ───
    # These are in .tsx/.ts files that run on the client
    
    # Replace "Praise OS" with a dynamic call - but only in JSX/text contexts
    # For client components, we'll use a helper function getOSName()
    # For now, let's do simple text replacements and handle the dynamic parts separately
    
    # Replace hardcoded "Praise OS" in display text with "MyOS" 
    # (will be made dynamic later via store)
    # But we need to keep the localStorage keys and event names working
    
    # ─── Server-side replacements (API routes) ───
    # These can't use client-side store, so we use generic "MyOS" text
    
    # Replace "praise-os-salt" with "myos-salt" in auth
    content = content.replace("praise-os-salt", "myos-salt")
    
    # Replace "BUILDPRAISE" with "BUILDMyOS" master reset code
    content = content.replace("BUILDPRAISE", "BUILDMyOS")
    
    # Replace localStorage keys
    content = content.replace("'praise-os-auth'", "'myos-auth'")
    content = content.replace('"praise-os-auth"', '"myos-auth"')
    content = content.replace("'praise-os-voice-btn-pos'", "'myos-voice-btn-pos'")
    content = content.replace("'praise-os-voice-tooltip-dismissed'", "'myos-voice-tooltip-dismissed'")
    content = content.replace("'praise-os-commitment-", "'myos-commitment-")
    content = content.replace("'praise-os-celebrated-'", "'myos-celebrated-'")
    content = content.replace("'praise-os-onboarding-complete'", "'myos-onboarding-complete'")
    
    # Replace custom event names
    content = content.replace("'praise-os-reset-chat'", "'myos-reset-chat'")
    content = content.replace("'praise-os-prefill-chat'", "'myos-prefill-chat'")
    content = content.replace("'praise-os-refresh-dashboard'", "'myos-refresh-dashboard'")
    
    # Replace notification tags
    content = content.replace("`praise-os-${type}-${Date.now()}`", "`myos-${type}-${Date.now()}`")
    
    # Replace backup filenames
    content = content.replace("`praise-os-backup-${", "`myos-backup-${")
    content = content.replace("`praise-os-${type}-${", "`myos-${type}-${")
    content = content.replace("`praise-os-all-${", "`myos-all-${")
    
    # Replace "Praise OS" in notification text
    content = content.replace("'Morning Alignment — Praise OS'", "'Morning Alignment — MyOS'")
    content = content.replace("'Midday Correction — Praise OS'", "'Midday Correction — MyOS'")
    content = content.replace("'Evening Review — Praise OS'", "'Evening Review — MyOS'")
    content = content.replace("'Friday Strategic Review — Praise OS'", "'Friday Strategic Review — MyOS'")
    content = content.replace("'Sunday Weekly Planning — Praise OS'", "'Sunday Weekly Planning — MyOS'")
    
    # Replace backup restore text references
    content = content.replace("exported from Praise OS", "exported from MyOS")
    content = content.replace("valid Praise OS backup", "valid MyOS backup")
    content = content.replace("backup file from Praise OS", "backup file from MyOS")
    
    # Replace "Praise OS" display text with "MyOS" (will be made dynamic in key places)
    content = content.replace("Praise OS AI Coach", "MyOS AI Coach")
    content = content.replace("Praise OS Notifications Enabled", "MyOS Notifications Enabled")
    content = content.replace("Search Praise OS", "Search MyOS")
    content = content.replace("Welcome to Praise OS", "Welcome to MyOS")
    content = content.replace("The Praise OS Mission", "The MyOS Mission")
    content = content.replace("Message Praise OS", "Message MyOS")
    content = content.replace("Praise OS — Check-in Reminder", "MyOS — Check-in Reminder")
    content = content.replace("Praise OS will alert you", "MyOS will alert you")
    content = content.replace("Praise OS will learn your patterns", "MyOS will learn your patterns")
    content = content.replace("Open Praise OS for your morning", "Open MyOS for your morning")
    content = content.replace("Open Praise OS for your evening", "Open MyOS for your evening")
    content = content.replace("from Praise OS AI Coach", "from MyOS AI Coach")
    
    # Replace "PraiseOS" function name
    content = content.replace("export default function PraiseOS()", "export default function MyOSApp()")
    
    # Replace "for Praise Obaje" references in footer and elsewhere
    content = content.replace("Life Operating System for Praise Obaje", "Life Operating System")
    content = content.replace("Built for Praise Obaje", "Your Life Operating System")
    
    # Replace "Aligned &bull; Disciplined &bull; Joyful" with generic
    # Keep this - it's a nice motto
    
    # Replace "Praise Obaje" in description and other text
    content = content.replace("life operating system for Praise Obaje", "personal life operating system")
    content = content.replace("Praise Obaje is: a woman of faith, an entrepreneur, a builder, a learner, a researcher, a writer, and a high-potential leader. She wants to glorify God, spread light and beauty, build meaningful businesses, live with structure, and create a life of impact and joy.", "You are the owner of this life operating system — a person of purpose, discipline, and vision.")
    
    # Replace in AI prompts - coaching phrases
    content = content.replace("Praise, you're avoiding this for a reason", "You're avoiding this for a reason")
    content = content.replace("Praise.", ".")
    content = content.replace(", Praise.", ".")
    
    # Replace coaching prompt prefixes
    content = content.replace("Help Praise grow spiritually", "Help you grow spiritually")
    content = content.replace("Help Praise build sustainable health habits", "Help build sustainable health habits")
    content = content.replace("Help Praise advance professionally and land her dream role", "Help advance professionally and achieve career goals")
    content = content.replace("Help Praise build her businesses with focus on revenue and systems", "Help build businesses with focus on revenue and systems")
    content = content.replace("Help Praise build and maintain meaningful, intentional relationships", "Help build and maintain meaningful, intentional relationships")
    content = content.replace("Help Praise become the best version of herself through learning, reflection, and discipline", "Become the best version of yourself through learning, reflection, and discipline")
    content = content.replace("analyzing data to generate actionable insights for Praise Obaje", "analyzing data to generate actionable insights")
    content = content.replace("generating a concise weekly insight summary for Praise Obaje", "generating a concise weekly insight summary")
    content = content.replace("from Praise OS (the AI coach) to Praise Obaje about her", "from MyOS (the AI coach) about your")
    content = content.replace("a personal life operating system for Praise Obaje", "a personal life operating system")
    content = content.replace("Praise Obaje\\'s life goals", "your life goals")
    content = content.replace("Praise Obaje's life goals", "your life goals")
    
    # Replace "About Praise" with "About"
    content = content.replace("About Praise", "About")
    
    # Replace "the woman behind the OS" with generic
    content = content.replace("Learn about the woman behind the OS", "About your Life Operating System")
    
    # Replace "She wants to glorify God" etc in about page
    content = content.replace("A woman of faith, an entrepreneur, a builder, a learner, a researcher, a writer, and a high-potential leader. She wants to glorify God, spread light and beauty, build meaningful businesses, live with structure, and create a life of impact and joy.", "A person of purpose, discipline, and vision. Built to help you make thousands of small decisions that align with your deepest values until the life you want becomes the life you are actually living.")
    
    # Replace "her personal operating system"
    content = content.replace("her personal operating system", "your personal operating system")
    content = content.replace("her chief of staff", "your chief of staff")
    content = content.replace("her daily operating cadence", "your daily operating cadence")
    content = content.replace("Keeps Praise honest", "Keeps you honest")
    content = content.replace("Manages her daily", "Manages your daily")
    content = content.replace("the life she wants becomes the life she is actually living", "the life you want becomes the life you are actually living")
    
    # Replace "Configure your Praise OS experience"
    content = content.replace("Configure your Praise OS experience", "Configure your MyOS experience")
    content = content.replace("Choose how Praise OS looks", "Choose how MyOS looks")
    
    # Replace VLM route
    content = content.replace("in the context of Praise Obaje\\'s life goals and operating system", "in the context of life goals and operating system")
    
    # Replace AI system prompt name
    content = content.replace("PRAISE_OS_SYSTEM_PROMPT", "MYOS_SYSTEM_PROMPT")
    
    # Replace "You are Praise OS"
    content = content.replace("You are Praise OS — the personal chief of staff", "You are MyOS — the personal chief of staff")
    content = content.replace("You are Praise OS,", "You are MyOS,")
    content = content.replace("You are Praise OS.", "You are MyOS.")
    content = content.replace("a data extraction assistant for Praise OS", "a data extraction assistant for MyOS")
    content = content.replace("the AI assistant for Praise OS", "the AI assistant for MyOS")
    
    # Replace calendar sync text
    content = content.replace("from Praise OS.", "from MyOS.")
    
    # Escalation message
    content = content.replace("Praise, this is the 3rd time you're trying to skip", "This is the 3rd time you're trying to skip")
    
    # Replace "Praise OS" remaining in display text
    content = content.replace("Praise OS", "MyOS")
    
    # Replace any remaining "praise-os" in code identifiers/keys
    content = content.replace("praise-os-", "myos-")
    
    # Replace "About Praise" button labels
    content = content.replace('"About Praise"', '"About"')
    
    # Replace component directory references
    # Keep the directory name "praise-os" for compatibility but update display text
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

count = 0
for root, dirs, files in os.walk(BASE):
    # Skip node_modules and .next
    dirs[:] = [d for d in dirs if d not in ('node_modules', '.next', '.git')]
    for filename in files:
        if filename.endswith(('.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.md')):
            filepath = os.path.join(root, filename)
            if process_file(filepath):
                count += 1
                print(f"  Modified: {filepath}")

print(f"\nTotal files modified: {count}")
