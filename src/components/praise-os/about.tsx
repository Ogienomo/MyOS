'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sparkles,
  Heart,
  Activity,
  Briefcase,
  Building2,
  Wallet,
  Users,
  Sprout,
  Sun,
  Clock,
  Moon,
  TrendingUp,
  Compass,
  Star,
  Quote,
  Target,
  BarChart3,
  Zap,
  Camera,
  MapPin,
  Phone,
  Mail,
  Edit3,
  CheckCircle2,
  X,
  Plus,
  Loader2,
  Globe,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { getAreaConfig } from '@/lib/area-config'

const DEFAULT_VALUES = ['Purpose', 'Growth', 'Integrity', 'Discipline', 'Excellence', 'Service', 'Stewardship', 'Joy']

const cadence = [
  { label: 'Morning Alignment', time: 'Configurable', desc: 'Set the day with intention. Schedule, feelings, priorities.', icon: <Sun className="h-4 w-4 text-red-500" /> },
  { label: 'Midday Correction', time: '12:00 PM', desc: 'Reset focus. Completed, blockers, what\'s slipping.', icon: <Clock className="h-4 w-4 text-red-600" /> },
  { label: 'Evening Review', time: 'Configurable', desc: 'Close the day with honesty. Wins, lessons, drift.', icon: <Moon className="h-4 w-4 text-rose-500" /> },
  { label: 'Friday Strategic Review', time: '4:30 PM', desc: 'Serious weekly review across all life areas.', icon: <TrendingUp className="h-4 w-4 text-red-600" /> },
  { label: 'Sunday Planning', time: '6:00 PM', desc: 'Review upcoming week. Priorities, deadlines, focus blocks.', icon: <Compass className="h-4 w-4 text-rose-600" /> },
]

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
}

export function About() {
  const {
    userName,
    osName,
    businessName,
    businessDescription,
    profilePhoto,
    bio,
    location,
    phone,
    email,
    personalValues,
    missionStatement,
    setProfilePhoto,
    setBio,
    setLocation,
    setPhone,
    setEmail,
    setPersonalValues,
    setMissionStatement,
    setBusinessName,
    setBusinessDescription,
  } = useAppStore()

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newValueInput, setNewValueInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Local edit state
  const [editBio, setEditBio] = useState(bio)
  const [editLocation, setEditLocation] = useState(location)
  const [editPhone, setEditPhone] = useState(phone)
  const [editEmail, setEditEmail] = useState(email)
  const [editValues, setEditValues] = useState<string[]>(personalValues.length > 0 ? personalValues : DEFAULT_VALUES)
  const [editMission, setEditMission] = useState(missionStatement)
  const [editBizName, setEditBizName] = useState(businessName)
  const [editBizDesc, setEditBizDesc] = useState(businessDescription)
  const [editPhoto, setEditPhoto] = useState(profilePhoto)

  // Sync local state when entering edit mode
  useEffect(() => {
    if (editing) {
      setEditBio(bio)
      setEditLocation(location)
      setEditPhone(phone)
      setEditEmail(email)
      setEditValues(personalValues.length > 0 ? [...personalValues] : [...DEFAULT_VALUES])
      setEditMission(missionStatement)
      setEditBizName(businessName)
      setEditBizDesc(businessDescription)
      setEditPhoto(profilePhoto)
    }
  }, [editing, bio, location, phone, email, personalValues, missionStatement, businessName, businessDescription, profilePhoto])

  // Get dynamic business area config
  const businessArea = typeof window !== 'undefined' ? getAreaConfig('havilah') : { label: 'Business', desc: '' }

  const lifeAreas = [
    { label: 'Faith', desc: 'Prayer, scripture, devotion, spiritual growth', icon: <Heart className="h-4 w-4 text-red-500" /> },
    { label: 'Health', desc: 'Sleep, food, movement, gym, energy, rest', icon: <Activity className="h-4 w-4 text-rose-500" /> },
    { label: 'Career', desc: 'Applications, skills, CV, interviews, professional growth', icon: <Briefcase className="h-4 w-4 text-red-600" /> },
    { label: businessArea.label, desc: businessName ? businessDescription || 'Business, ventures, revenue, clients, systems' : 'Business, ventures, revenue, clients, systems', icon: <Building2 className="h-4 w-4 text-rose-600" /> },
    { label: 'Finances', desc: 'Money tracking, savings, giving, budgeting, stewardship', icon: <Wallet className="h-4 w-4 text-red-500" /> },
    { label: 'Relationships', desc: 'Family, friends, community, mentorship', icon: <Users className="h-4 w-4 text-rose-500" /> },
    { label: 'Personal Growth', desc: 'Learning, reading, journaling, reflection, discipline', icon: <Sprout className="h-4 w-4 text-red-700" /> },
  ]

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2MB')
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setEditPhoto(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleAddValue = () => {
    const val = newValueInput.trim()
    if (val && !editValues.includes(val)) {
      setEditValues([...editValues, val])
      setNewValueInput('')
    }
  }

  const handleRemoveValue = (val: string) => {
    setEditValues(editValues.filter(v => v !== val))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profilePhoto: editPhoto,
          bio: editBio,
          location: editLocation,
          phone: editPhone,
          email: editEmail,
          personalValues: editValues,
          missionStatement: editMission,
          businessName: editBizName,
          businessDescription: editBizDesc,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setProfilePhoto(data.profilePhoto || editPhoto)
        setBio(data.bio || editBio)
        setLocation(data.location || editLocation)
        setPhone(data.phone || editPhone)
        setEmail(data.email || editEmail)
        setPersonalValues(data.personalValues || editValues)
        setMissionStatement(data.missionStatement || editMission)
        setBusinessName(data.businessName || editBizName)
        setBusinessDescription(data.businessDescription || editBizDesc)

        // Sync to localStorage for dynamic labels
        if (data.businessName) localStorage.setItem('myos-business-name', data.businessName)
        else localStorage.removeItem('myos-business-name')
        if (data.businessDescription) localStorage.setItem('myos-business-description', data.businessDescription)
        else localStorage.removeItem('myos-business-description')

        setSaved(true)
        setTimeout(() => {
          setSaved(false)
          setEditing(false)
        }, 1200)
      }
    } catch (err) {
      console.error('Failed to save profile:', err)
    } finally {
      setSaving(false)
    }
  }

  const displayValues = personalValues.length > 0 ? personalValues : DEFAULT_VALUES
  const displayName = userName || 'User'
  const displayOsName = osName || 'MyOS'

  return (
    <div className="space-y-8">
      {/* Hero / Profile Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-black via-neutral-900 to-red-950/40 p-8 md:p-12"
      >
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-red-400/5 rounded-full blur-2xl" />

        <div className="relative z-10 flex flex-col items-center text-center">
          {/* Profile Photo */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="shrink-0 mb-6"
          >
            <div className="w-28 h-28 rounded-3xl overflow-hidden border-4 border-red-500/30 shadow-xl shadow-red-500/10 bg-red-600/15 flex items-center justify-center relative group">
              {profilePhoto ? (
                <img
                  src={profilePhoto}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl font-bold text-red-400">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
              {editing && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Camera className="h-6 w-6 text-white" />
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-red-400" />
              <span className="text-red-400 text-xs font-semibold uppercase tracking-wider">{displayOsName}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{displayName}</h1>

            {/* Contact details row */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-3 text-neutral-400 text-xs">
              {location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {location}
                </span>
              )}
              {phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {phone}
                </span>
              )}
              {email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {email}
                </span>
              )}
            </div>

            {/* Bio */}
            {bio && (
              <p className="text-neutral-300 text-sm md:text-base max-w-lg leading-relaxed mt-4">
                {bio}
              </p>
            )}
            {!bio && !editing && (
              <p className="text-neutral-500 text-sm max-w-lg leading-relaxed mt-4 italic">
                A person of purpose, discipline, and vision. Built to help you make thousands of small decisions
                that align with your deepest values until the life you want becomes the life you are actually living.
              </p>
            )}
          </motion.div>
        </div>
      </motion.div>

      {/* Edit Profile Button */}
      <div className="flex justify-end">
        {!editing ? (
          <Button
            onClick={() => setEditing(true)}
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 border-neutral-200 hover:bg-neutral-50"
          >
            <Edit3 className="h-3.5 w-3.5" /> Edit Profile
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setEditing(false)}
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              disabled={saving}
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
            <Button
              onClick={handleSave}
              size="sm"
              className="text-xs gap-1.5 bg-red-600 hover:bg-red-700 text-white"
              disabled={saving}
            >
              {saving ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</>
              ) : saved ? (
                <><CheckCircle2 className="h-3.5 w-3.5" /> Saved!</>
              ) : (
                <><CheckCircle2 className="h-3.5 w-3.5" /> Save Changes</>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Edit Mode */}
      {editing && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Photo preview in edit */}
          {editPhoto && editPhoto !== profilePhoto && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden border border-neutral-200">
                  <img src={editPhoto} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <span className="text-xs text-neutral-600">New photo selected. Click Save to apply.</span>
                <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => setEditPhoto('')}>
                  Remove
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Personal Details */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="text-sm font-medium text-neutral-800 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-red-500" /> Personal Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-neutral-500 mb-1 block">Location</label>
                  <Input
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="e.g., Lagos, Nigeria"
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 mb-1 block">Phone</label>
                  <Input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="e.g., +234 800 000 0000"
                    className="text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-neutral-500 mb-1 block">Email</label>
                  <Input
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="e.g., you@example.com"
                    className="text-sm"
                    type="email"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-neutral-500 mb-1 block">About You</label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Tell us about yourself — your journey, your passions, what drives you..."
                    rows={3}
                    className="flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:border-red-500 transition-all resize-none"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mission Statement */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="text-sm font-medium text-neutral-800 flex items-center gap-2">
                <Target className="h-4 w-4 text-red-500" /> Mission Statement
              </h3>
              <textarea
                value={editMission}
                onChange={(e) => setEditMission(e.target.value)}
                placeholder="What is your personal mission? What were you put on this earth to do?"
                rows={3}
                className="flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:border-red-500 transition-all resize-none"
              />
            </CardContent>
          </Card>

          {/* Core Values Editor */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="text-sm font-medium text-neutral-800 flex items-center gap-2">
                <Star className="h-4 w-4 text-red-500" /> Your Core Values
              </h3>
              <p className="text-xs text-neutral-500">Add or remove values that define who you are and what you stand for.</p>
              <div className="flex flex-wrap gap-2">
                {editValues.map((value) => (
                  <Badge
                    key={value}
                    variant="secondary"
                    className="text-sm py-1.5 px-3 bg-neutral-50 text-neutral-700 border border-neutral-200 hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-colors group cursor-pointer"
                    onClick={() => handleRemoveValue(value)}
                  >
                    {value}
                    <X className="h-3 w-3 ml-1 opacity-50 group-hover:opacity-100" />
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={newValueInput}
                  onChange={(e) => setNewValueInput(e.target.value)}
                  placeholder="Add a value..."
                  className="text-sm flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddValue()
                    }
                  }}
                />
                <Button
                  onClick={handleAddValue}
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1"
                  disabled={!newValueInput.trim()}
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Business Profile */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="text-sm font-medium text-neutral-800 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-amber-500" /> Business Profile
              </h3>
              <div>
                <label className="text-xs text-neutral-500 mb-1 block">Business Name</label>
                <Input
                  value={editBizName}
                  onChange={(e) => setEditBizName(e.target.value)}
                  placeholder="e.g., My Consulting Firm"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500 mb-1 block">What is your business about?</label>
                <textarea
                  value={editBizDesc}
                  onChange={(e) => setEditBizDesc(e.target.value)}
                  placeholder="Describe your business — what you do, who your clients are, what products/services you offer..."
                  rows={3}
                  className="flex w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:border-red-500 transition-all resize-none"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Mission Statement (non-edit) */}
      {!editing && missionStatement && (
        <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
          <Card className="shadow-sm bg-gradient-to-br from-neutral-50/80 to-red-50/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-5 w-5 text-red-500" />
                <h2 className="text-lg font-medium text-neutral-800">My Mission</h2>
              </div>
              <p className="text-sm text-neutral-700 leading-relaxed italic">
                &ldquo;{missionStatement}&rdquo;
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Core Values (non-edit) */}
      <motion.div {...fadeUp} transition={{ delay: 0.3 }}>
        <Card className="shadow-sm border-neutral-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Star className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-medium text-neutral-800">Core Values</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {displayValues.map((value, i) => (
                <motion.div
                  key={value}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + i * 0.05 }}
                >
                  <Badge variant="secondary" className="text-sm py-1.5 px-3 bg-neutral-50 text-neutral-700 border border-neutral-200 hover:bg-neutral-100">
                    {value}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Business Profile Card (non-edit) */}
      {!editing && businessName && (
        <motion.div {...fadeUp} transition={{ delay: 0.35 }}>
          <Card className="shadow-sm bg-gradient-to-br from-amber-50/50 to-neutral-50/80 border-amber-200/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="h-5 w-5 text-amber-600" />
                <h2 className="text-lg font-medium text-neutral-800">{businessName}</h2>
              </div>
              {businessDescription && (
                <p className="text-sm text-neutral-600 leading-relaxed">{businessDescription}</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* MyOS Mission */}
      <motion.div {...fadeUp} transition={{ delay: 0.4 }}>
        <Card className="shadow-sm border-neutral-200 bg-gradient-to-br from-neutral-50/80 to-red-50/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-red-600" />
              <h2 className="text-lg font-medium text-neutral-800">The {displayOsName} Mission</h2>
            </div>
            <p className="text-sm text-neutral-600 leading-relaxed mb-4">
              This is {displayName}&apos;s personal operating system — chief of staff, accountability partner, and strategic advisor.
              Built to help make thousands of small decisions that align with the deepest values until the life desired
              becomes the life actually lived.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: <Target className="h-5 w-5 text-red-500" />, label: 'Accountability Partner', desc: 'Keeps you honest and aligned' },
                { icon: <BarChart3 className="h-5 w-5 text-red-500" />, label: 'Strategic Advisor', desc: 'Analyzes patterns and surfaces insights' },
                { icon: <Zap className="h-5 w-5 text-red-500" />, label: 'Chief of Staff', desc: 'Manages your daily operating cadence' },
              ].map((item) => (
                <div key={item.label} className="p-3 bg-white/60 rounded-xl border border-neutral-100">
                  {item.icon}
                  <p className="text-xs font-medium text-neutral-700 mt-1">{item.label}</p>
                  <p className="text-[10px] text-neutral-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 7 Life Areas */}
      <motion.div {...fadeUp} transition={{ delay: 0.5 }}>
        <div className="flex items-center gap-2 mb-4">
          <Heart className="h-5 w-5 text-red-500" />
          <h2 className="text-lg font-medium text-neutral-800">7 Life Areas</h2>
        </div>
        <motion.div
          variants={stagger}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {lifeAreas.map((area, i) => (
            <motion.div
              key={area.label}
              variants={fadeUp}
              transition={{ delay: 0.5 + i * 0.05 }}
            >
              <Card className="shadow-sm border border-neutral-200 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-neutral-50 flex items-center justify-center shrink-0">
                      {area.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-neutral-800">{area.label}</h3>
                      <p className="text-xs text-neutral-500 mt-0.5">{area.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Operating Cadence */}
      <motion.div {...fadeUp} transition={{ delay: 0.6 }}>
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-medium text-neutral-800">Operating Cadence</h2>
            </div>
            <div className="space-y-3">
              {cadence.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + i * 0.08 }}
                  className="flex items-center gap-4 p-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-sm">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-neutral-800">{item.label}</span>
                    <p className="text-xs text-neutral-500 mt-0.5">{item.desc}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0 whitespace-nowrap">{item.time}</Badge>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Footer Quote */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="text-center py-4"
      >
        <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-neutral-50 to-red-50/30 border border-neutral-200">
          <Quote className="h-4 w-4 text-neutral-400" />
          <p className="text-sm font-medium text-neutral-600 italic">
            The life you want becomes the life you are actually living.
          </p>
        </div>
        <p className="text-[10px] text-neutral-400 mt-3">
          {displayOsName} &bull; Built with intention &bull; Aligned &bull; Disciplined &bull; Joyful
        </p>
      </motion.div>
    </div>
  )
}
