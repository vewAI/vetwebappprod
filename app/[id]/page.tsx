"use client"

import { notFound } from "next/navigation"
import { cases } from "@/features/case-selection/data/card-data"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import { useParams } from "next/navigation"

export default function CaseChatPage() {
  // Get the ID from the URL using useParams hook
  const params = useParams()
  const id = params.id as string
  
  // Find the case by ID
  const caseItem = cases.find((c) => c.id === id)

  // If case not found, show 404
  if (!caseItem) {
    notFound()
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/">
          <Button variant="outline" size="sm">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Cases
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary">{caseItem.title}</h1>
        <p className="mt-2 text-muted-foreground">{caseItem.description}</p>
      </div>

      <div className="rounded-lg border p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold">Chat Interface Coming Soon</h2>
        <p>This is where the OSCE chat interface will be implemented.</p>
        <p className="mt-4 text-muted-foreground">You've selected: {caseItem.title}</p>
      </div>
    </div>
  )
}
