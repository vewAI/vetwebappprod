"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, Tag, ChevronRight } from "lucide-react"
import type { Case } from "@/features/case-selection/models/case"

type CaseCardProps = {
  caseItem: Case
}

export function CaseCard({ caseItem }: CaseCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <Card
      className="overflow-hidden transition-all duration-300 hover:shadow-lg"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative h-48 w-full overflow-hidden">
        <Image
          src={caseItem.imageUrl || "/placeholder.svg"}
          alt={caseItem.title}
          fill
          className={`object-cover transition-transform duration-500 ${isHovered ? "scale-105" : "scale-100"}`}
        />
        {caseItem.difficulty && (
          <div className="absolute right-3 top-3">
            <Badge
              variant={
                caseItem.difficulty === "Easy"
                  ? "success"
                  : caseItem.difficulty === "Medium"
                    ? "warning"
                    : "destructive"
              }
            >
              {caseItem.difficulty}
            </Badge>
          </div>
        )}
      </div>
      <CardHeader>
        <CardTitle>{caseItem.title}</CardTitle>
        <CardDescription>
          {caseItem.species} - {caseItem.category}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="line-clamp-2 text-sm text-muted-foreground">{caseItem.description}</p>
        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{caseItem.estimatedTime} min</span>
          </div>
          <div className="flex items-center gap-1">
            <Tag className="h-4 w-4" />
            <span>{caseItem.category}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Link href={`/${caseItem.id}`} className="w-full">
          <Button className="w-full">
            Start Case
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}
