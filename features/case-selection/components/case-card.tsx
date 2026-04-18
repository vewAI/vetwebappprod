"use client";

import Link from "next/link";
import Image from "next/image";
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
import { ChevronRight } from "lucide-react";
import type { Case } from "@/features/case-selection/models/case";

type CaseCardProps = {
  caseItem: Case;
};

export function CaseCard({ caseItem }: CaseCardProps) {
  const imageSrc =
    /^https?:\/\//.test(String(caseItem.imageUrl ?? ""))
      ? String(caseItem.imageUrl)
      : "/placeholder.svg";

  return (
    <Card
      className="group pt-0 overflow-hidden transition-all duration-300 hover:shadow-lg"
      tabIndex={0}
    >
      <div className="relative h-48 w-full overflow-hidden bg-gray-100">
        <Image
          src={imageSrc}
          alt={caseItem.title}
          fill
          className="object-cover transition-[transform,filter] duration-700 ease-out group-hover:scale-110 group-hover:brightness-105"
          sizes="500px"
          priority={false}
        />
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <div className="absolute bottom-0 left-0 right-0 translate-y-2 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100 p-3">
          <p className="text-white text-xs line-clamp-2 font-medium drop-shadow-md">
            {caseItem.description}
          </p>
        </div>
        {caseItem.difficulty && (
          <div className="absolute right-3 top-3 z-10">
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
