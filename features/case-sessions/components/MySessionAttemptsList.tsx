"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SessionAttemptRow } from "../models/caseSession";

type Props = {
  attempts: SessionAttemptRow[];
};

export function MySessionAttemptsList({ attempts }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My attempts ({attempts.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {attempts.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            You have not started an attempt in this session yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Time (s)</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2">Link</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.id} className="border-b border-muted">
                    <td className="py-2 pr-4 capitalize">
                      {a.completionStatus.replace("_", " ")}
                    </td>
                    <td className="py-2 pr-4">{a.timeSpentSeconds}</td>
                    <td className="py-2 pr-4">
                      {new Date(a.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2">
                      <Button variant="link" className="h-auto p-0" asChild>
                        <Link href={`/attempts/${a.id}`}>View</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
