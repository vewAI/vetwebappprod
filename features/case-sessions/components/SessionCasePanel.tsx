"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CaseSession } from "../models/caseSession";

type Props = {
  session: CaseSession;
};

export function SessionCasePanel({ session }: Props) {
  const caseInfo = session.case;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Case</CardTitle>
      </CardHeader>
      <CardContent className="flex gap-4 flex-wrap">
        {caseInfo?.imageUrl && (
          <div className="relative w-32 h-32 shrink-0 border rounded">
            <Image
              src={caseInfo.imageUrl}
              alt={caseInfo.title}
              width={128}
              height={128}
              className="object-cover rounded"
            />
          </div>
        )}
        <div>
          <h2 className="text-xl font-bold">
            {caseInfo?.title ?? session.caseId}
          </h2>
          <p className="text-sm text-muted-foreground">
            {caseInfo?.species} · {caseInfo?.difficulty}
          </p>
          <Button variant="link" className="px-0 h-auto mt-2" asChild>
            <Link href={`/case/${session.caseId}/instructions`}>
              Open case page
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
