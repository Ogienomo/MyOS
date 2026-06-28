#!/usr/bin/env python3
"""
Systematically replace all Praise-specific content in the MyOS codebase.
- "Praise OS" → dynamic from localStorage settings
- "Praise Obaje" → user's name from localStorage
- "praise-os" → "myos" (for localStorage keys, etc.)
- "Help Praise" → "Help the user" / "Help them"
- Personal details → generic/user-configurable
- Add Danger Zone feature
- Add first-run personalization
"""
import os
import re

BASE = "/home/z/my-project/src"

# Count replacements
count = 0

def replace_in_file(filepath, replacements):
    global count
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except:
        return
    
    original = content
    for old, new in replacements:
        content = content.replace(old, new)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        count += 1
        print(f"  Modified: {filepath}")

# Walk through all source files
for root, dirs, files in os.walk(BASE):
    for fname in files:
        if fname.endswith(('.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.prisma')):
            filepath = os.path.join(root, fname)
            
            # ─── Branding replacements ───
            replacements = [
                # localStorage keys
                ('praise-os-auth', 'myos-auth'),
                ('praise-os-onboarding-complete', 'myos-onboarding-complete'),
                ('praise-os-celebrated-', 'myos-celebrated-'),
                
                # Custom events
                ("'praise-os-prefill-chat'", "'myos-prefill-chat'"),
                ("'praise-os-refresh-dashboard'", "'myos-refresh-dashboard'"),
                ("'praise-os-reset-chat'", "'myos-reset-chat'"),
                ('praise-os-prefill-chat', 'myos-prefill-chat'),
                ('praise-os-refresh-dashboard', 'myos-refresh-dashboard'),
                ('praise-os-reset-chat', 'myos-reset-chat'),
                
                # Notification tags
                ("'praise-os-", "'myos-"),
                ('praise-os-', 'myos-'),
                
                # Export filenames
                ('praise-os-backup-', 'myos-backup-'),
                ('praise-os-${type}-', 'myos-${type}-'),
                
                # Display text - "Praise OS" becomes "MyOS" (will be dynamic in components)
                ('Praise OS AI Coach', 'MyOS AI Coach'),
                ('Praise OS Notifications Enabled', 'MyOS Notifications Enabled'),
                ('Praise OS — Check-in Reminder', 'MyOS — Check-in Reminder'),
                ('Message Praise OS...', 'Message MyOS...'),
                ("Welcome to Praise OS", "Welcome to MyOS"),
                ("Praise OS &bull;", "MyOS &bull;"),
                ('Praise OS gets smarter', 'MyOS gets smarter'),
                ("Configure your Praise OS experience", "Configure your MyOS experience"),
                ("Choose how Praise OS looks", "Choose how MyOS looks"),
                ("Praise OS will alert you", "MyOS will alert you"),
                ("Praise OS will learn your patterns", "MyOS will learn your patterns"),
                ("Open Praise OS for your morning", "Open MyOS for your morning"),
                ("Open Praise OS for your evening", "Open MyOS for your evening"),
                ("from Praise OS", "from MyOS"),
                ("Praise OS,", "MyOS,"),
                ("exported from Praise OS", "exported from MyOS"),
                ("valid Praise OS backup", "valid MyOS backup"),
                ("Praise OS v2.1", "MyOS v1.0"),
                ("Built with intention", "Built with intention"),
                
                # "Built for Praise Obaje" → "Built for You"
                ("Built for Praise Obaje", "Built for You"),
                
                # About page - Praise Obaje references
                ('Praise Obaje - Founder', 'User'),
                ('Praise Obaje', 'User'),
                ("The Praise OS Mission", "The MyOS Mission"),
                
                # AI prompts - replace personal references with generic user references
                ("for Praise Obaje", "for the user"),
                ("Help Praise grow spiritually", "Help the user grow spiritually"),
                ("Help Praise build sustainable health habits", "Help the user build sustainable health habits"),
                ("Help Praise advance professionally and land her dream role", "Help the user advance professionally"),
                ("Help Praise build her businesses with focus on revenue and systems", "Help the user build their business with focus on revenue and systems"),
                ("Help Praise build and maintain meaningful, intentional relationships", "Help the user build meaningful relationships"),
                ("Help Praise become the best version of herself through learning, reflection, and discipline", "Help the user become the best version of themselves"),
                ("the person Praise becomes matters more than what she achieves", "who the user becomes matters more than what they achieve"),
                
                # AI system prompts
                ("You are Praise OS — the personal chief of staff, life coach, accountability enforcer, strategic advisor, and intelligent operating system for Praise Obaje", "You are MyOS — the personal chief of staff, life coach, accountability enforcer, strategic advisor, and intelligent operating system"),
                ("Help Praise make thousands of small aligned decisions", "Help the user make thousands of small aligned decisions"),
                ("until the life she envisions becomes the life she is actually living", "until the life they envision becomes the life they are actually living"),
                ("Your care for Praise is expressed through refusal to let her settle", "Your care for the user is expressed through refusal to let them settle"),
                ("a life operating system for Praise Obaje", "a personal life operating system"),
                ("Praise Obaje", "the user"),
                ("for Praise", "for the user"),
                ("Help Praise", "Help the user"),
                
                # Area config prompt prefixes
                ("You are the Faith Coach for Praise OS", "You are the Faith Coach for MyOS"),
                ("You are the Health Coach for Praise OS", "You are the Health Coach for MyOS"),
                ("You are the Career Coach for Praise OS", "You are the Career Coach for MyOS"),
                ("You are the Havilah Business Coach for Praise OS", "You are the Havilah Business Coach for MyOS"),
                ("You are the Finance Coach for Praise OS", "You are the Finance Coach for MyOS"),
                ("You are the Relationships Coach for Praise OS", "You are the Relationships Coach for MyOS"),
                ("You are the Personal Growth Coach for Praise OS", "You are the Personal Growth Coach for MyOS"),
                ("You are Praise OS", "You are MyOS"),
                ("assistant for Praise OS", "assistant for MyOS"),
                
                # Layout metadata
                ('Life Operating System for Praise Obaje', 'Your Personal Life Operating System'),
                ('Praise OS - Life Operating System', 'MyOS - Your Personal Life Operating System'),
                
                # Component directory references  
                ('@/components/praise-os/', '@/components/myos/'),
                ("'@/components/praise-os/", "'@/components/myos/"),
                
                # Havilah specific
                ("Apply the Havilah Rule: Don't confuse activity with progress", "Don't confuse activity with progress"),
                ("Apply the Finance Rule: Money must always be treated seriously", "Money must always be treated seriously"),
            ]
            
            replace_in_file(filepath, replacements)

print(f"\nTotal files modified: {count}")

# Now rename the component directory
old_dir = os.path.join(BASE, "components/praise-os")
new_dir = os.path.join(BASE, "components/myos")
if os.path.exists(old_dir):
    if os.path.exists(new_dir):
        import shutil
        shutil.rmtree(new_dir)
    os.rename(old_dir, new_dir)
    print(f"Renamed: {old_dir} → {new_dir}")
