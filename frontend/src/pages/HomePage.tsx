"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function HomePage() {
  const [name, setName] = useState("")
  const [code, setCode] = useState("")

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-900 to-red-900/20"></div>

      <Card className="w-full max-w-md bg-slate-800/90 border-slate-700 backdrop-blur-sm shadow-2xl">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-4xl font-bold text-white tracking-wide">Game Of Liars</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Name</label>
              <Input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Code</label>
              <Input
                type="text"
                placeholder="Enter game code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 shadow-lg hover:shadow-emerald-500/25 transition-all duration-200"
              disabled={!name.trim()}
            >
              JOIN
            </Button>

            <Button
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 shadow-lg hover:shadow-blue-500/25 transition-all duration-200"
              disabled={!name.trim()}
            >
              HOST
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
