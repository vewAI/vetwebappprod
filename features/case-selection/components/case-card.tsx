"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Tag, ChevronRight } from "lucide-react";
import type { Case } from "@/features/case-selection/models/case";

type CaseCardProps = {
  caseItem: Case;
};

export function CaseCard({ caseItem }: CaseCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Use gifUrl if available and hovered, otherwise fallback to imageUrl
  const displayImage = (isHovered && caseItem.gifUrl) ? caseItem.gifUrl : caseItem.imageUrl;

  return (
    <Card
      className="overflow-hidden transition-all duration-300 hover:shadow-lg"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      // Mobile focus handling
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      tabIndex={0} // Make focusable
    >
      <div className="relative h-48 w-full overflow-hidden bg-gray-100">
        <img
          src={
            /^https?:\/\//.test(String(displayImage ?? ""))
              ? String(displayImage)
              : "/placeholder.svg"
          }
          alt={caseItem.title}
          className={`w-full h-full object-contain object-center transition-transform duration-500 ${
            isHovered ? "scale-105" : "scale-100"
          }`}
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
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {caseItem.description}
        </p>
      </CardContent>
      <CardFooter>
        <Link href={`/case/${caseItem.id}/instructions`} className="w-full">
          <Button className="w-full">
            View Case
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
