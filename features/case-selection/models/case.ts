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
};