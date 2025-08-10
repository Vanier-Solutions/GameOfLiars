"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Users, Trophy, Swords, Play as PlayIcon, DoorOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function BanditLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="g" x1="0" x2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#g)" opacity="0.15" />
      <circle cx="32" cy="28" r="14" fill="#0f172a" stroke="#cbd5e1" strokeOpacity=".2" />
      <rect x="16" y="24" width="32" height="8" rx="4" fill="#1f2937" stroke="#cbd5e1" strokeOpacity=".25" />
      <circle cx="26" cy="28" r="2.5" fill="#e5e7eb" />
      <circle cx="38" cy="28" r="2.5" fill="#e5e7eb" />
      <path d="M22 40c6 4 14 4 20 0" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 18c4-4 20-4 24 0" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function HomePage() {
  const [leftName, setLeftName] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [joinName, setJoinName] = useState("")
  const canPlay = useMemo(() => leftName.trim().length > 0, [leftName])
  const canJoin = useMemo(() => joinCode.trim().length > 0 && joinName.trim().length > 0, [joinCode, joinName])

  const onPlay = () => {
    console.log("Play Teams", { name: leftName })
    alert(`Starting Teams room for ${leftName}`)
  }

  const onJoin = () => {
    console.log("Join Lobby", { code: joinCode, name: joinName })
    alert(`Joining lobby ${joinCode} as ${joinName}`)
  }

  const GamemodeCard = ({
    icon: Icon,
    title,
    subtitle,
    disabled,
    badge,
  }: {
    icon: any
    title: string
    subtitle: string
    disabled?: boolean
    badge?: string
  }) => (
    <div className="relative">
      {disabled && badge && (
        <span className="absolute -top-2 left-4 z-10 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-500/30">
          {badge}
        </span>
      )}
      <motion.div
        whileHover={disabled ? undefined : { y: -2 }}
        whileTap={disabled ? undefined : { y: 0 }}
        className={
          `flex h-24 items-center gap-3 rounded-2xl border border-white/10 p-4 text-left ` +
          (disabled ? "bg-slate-800/40 opacity-60 select-none" : "bg-slate-800/60")
        }
      >
        <div className={
          `flex h-10 w-10 items-center justify-center rounded-xl ` +
          (disabled ? "bg-slate-700/40 text-slate-400" : "bg-blue-500/15 text-blue-300")
        }>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="font-medium text-white">{title}</div>
          <div className="text-sm text-slate-300/80">{subtitle}</div>
        </div>
      </motion.div>
    </div>
  )

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[conic-gradient(from_210deg_at_50%_50%,rgba(255,255,255,0.04),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_600px_at_20%_-10%,rgba(59,130,246,0.10),transparent),radial-gradient(1000px_500px_at_90%_10%,rgba(16,185,129,0.10),transparent)]" />
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 relative">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BanditLogo className="h-8 w-8" />
            <span className="text-xl font-semibold tracking-wide text-white">Game of Liars</span>
          </div>
          <div className="text-sm text-slate-300/80">v0.1 • Let the bluffing begin ✨</div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="col-span-1 bg-slate-900/70 backdrop-blur border-white/10 lg:col-span-2 rounded-3xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-white">Start a new room</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <GamemodeCard icon={Users} title="Teams" subtitle="Split into squads and out-bluff the rest" />
                <GamemodeCard icon={Trophy} title="Tournament" subtitle="Bracket mayhem. Last liar standing" disabled badge="Under Construction" />
                <GamemodeCard icon={Swords} title="Duels" subtitle="1v1 mind-games at dawn" disabled badge="Under Construction" />
              </div>

              <div className="flex items-center gap-3">
                <Input value={leftName} onChange={(e) => setLeftName(e.target.value)} placeholder="Your name" className="h-12 bg-slate-900/60 border-white/10 text-white placeholder:text-slate-400" />
                <motion.div whileHover={{ scale: canPlay ? 1.02 : 1 }} whileTap={{ scale: canPlay ? 0.98 : 1 }}>
                  <Button onClick={onPlay} disabled={!canPlay} className="h-12 gap-2 bg-emerald-600 hover:bg-emerald-600/90">
                    <PlayIcon className="h-4 w-4" />
                    Play
                  </Button>
                </motion.div>
              </div>

              <div className="text-sm text-slate-300/70">Tournament and Duels are being built! For now, host a <span className="font-semibold text-white">Teams</span> room.</div>
            </CardContent>
          </Card>

          <Card className="col-span-1 rounded-3xl border-white/10 bg-slate-900/70 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-white">Join a lobby</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Enter code" className="h-11 bg-slate-900/60 border-white/10 text-white placeholder:text-slate-400" />
                <Input value={joinName} onChange={(e) => setJoinName(e.target.value)} placeholder="Your name" className="h-11 bg-slate-900/60 border-white/10 text-white placeholder:text-slate-400" />
              </div>
              <motion.div whileHover={{ scale: canJoin ? 1.02 : 1 }} whileTap={{ scale: canJoin ? 0.98 : 1 }}>
                <Button onClick={onJoin} disabled={!canJoin} className="h-11 w-full gap-2 bg-indigo-600 hover:bg-indigo-600/90">
                  <DoorOpen className="h-4 w-4" />
                  Join
                </Button>
              </motion.div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8 rounded-3xl border-white/10 bg-slate-900/70 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-white">How to Play</CardTitle>
          </CardHeader>
          <CardContent className="text-slate-200/90 space-y-3 leading-relaxed">
            <div>Game of Liars is a team-based bluffing quiz. Create or join a lobby and try to outplay the other team with confidence and cunning.</div>
            <ol className="list-decimal space-y-2 pl-5">
              <li><span className="font-semibold">Split into two teams.</span> Everyone can chat in their <span className="font-semibold">team chat</span> to decide an answer each round.</li>
              <li><span className="font-semibold">A question appears</span> (e.g., "What do cows drink?").</li>
              <li><span className="font-semibold">Teams confer.</span> Discuss in team chat. The <span className="font-semibold">captain</span> locks in the team’s answer—or chooses to <span className="font-semibold">steal</span> after seeing if the other team got it right.</li>
              <li><span className="font-semibold">Scoring:</span>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li><span className="font-semibold">Correct answer:</span> +1 point.</li>
                  <li><span className="font-semibold">Steal:</span> If the other team answered <span className="font-semibold">correctly</span>, a successful steal gives <span className="font-semibold">+2 points</span> to the stealing team.</li>
                  <li>If the other team answered <span className="font-semibold">incorrectly</span> and you try to steal, the team you stole from gets <span className="font-semibold">+2 points</span>.</li>
                </ul>
              </li>
              <li><span className="font-semibold">Bluff boldly.</span> Sometimes the best move is to sound confident with the wrong answer so the other team tries (and fails) to steal.</li>
            </ol>
            <div className="text-sm text-slate-300/80">Tip: "What do cows drink?" — Most people say milk. It’s actually <span className="italic">water</span>.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
