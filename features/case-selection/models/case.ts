import type { CaseMediaItem } from "@/features/cases/models/caseMedia";

export type Case = {
    id: string
    title: string
    description: string
    species: string
    condition: string
    category: string
    difficulty: "Easy" | "Medium" | "Hard"
    estimatedTime: number
    imageUrl: string
    gifUrl?: string
    tags?: string[]
    isPublished?: boolean
    createdAt?: string
    creatorUserId?: string
    creatorName?: string
    media?: CaseMediaItem[]
    ownerBackground?: string
    physicalExamFindings?: string
    learningObjectives?: string
    diagnosticFindings?: string
    details?: string
    patientName?: string
    patientAge?: string
    patientSex?: string
};
