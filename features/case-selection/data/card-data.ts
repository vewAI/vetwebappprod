import type {Case} from '@/features/case-selection/models/case';

export const cases: Case[] = [
    {
      id: "case-1",
      title: "Equine High temperature",
      description:
        "A 3-year-old Cob Mare called Catalina presents with a fever and decreased appetite for the past 24 hours.",
      species: "Equine",
      condition: "Strangles",
      category: "Large Animal",
      difficulty: "Easy",
      estimatedTime: 15,
      imageUrl: "/placeholder.svg",
    },
    {
      id: "case-2",
      title: "Feline Urinary Obstruction",
      description:
        "An 8-year-old male neutered domestic shorthair cat presents with stranguria, vocalization, and frequent trips to the litter box without producing urine.",
      species: "Feline",
      condition: "Urinary Obstruction",
      category: "Emergency",
      difficulty: "Medium",
      estimatedTime: 20,
      imageUrl: "/placeholder.svg",
    },
    {
      id: "case-3",
      title: "Equine Colic",
      description:
        "A 12-year-old Quarter Horse gelding presents with signs of abdominal pain, including pawing, rolling, and looking at its flank. The horse has not passed manure in 12 hours.",
      species: "Equine",
      condition: "Colic",
      category: "Large Animal",
      difficulty: "Hard",
      estimatedTime: 30,
      imageUrl: "/placeholder.svg",
    },
    {
      id: "case-4",
      title: "Canine Cruciate Ligament Rupture",
      description:
        "A 7-year-old overweight Rottweiler presents with acute non-weight-bearing lameness of the right hind limb after playing at the dog park.",
      species: "Canine",
      condition: "Orthopedic",
      category: "Surgery",
      difficulty: "Medium",
      estimatedTime: 25,
      imageUrl: "/placeholder.svg",
    },
    {
      id: "case-5",
      title: "Feline Hyperthyroidism",
      description:
        "A 13-year-old domestic longhair cat presents with weight loss despite increased appetite, hyperactivity, and occasional vomiting.",
      species: "Feline",
      condition: "Endocrine",
      category: "Internal Medicine",
      difficulty: "Medium",
      estimatedTime: 20,
      imageUrl: "/placeholder.svg",
    },
    {
      id: "case-6",
      title: "Bovine Mastitis",
      description:
        "A 4-year-old Holstein dairy cow presents with a swollen, warm, and painful right front quarter. The milk from this quarter appears abnormal with clots.",
      species: "Bovine",
      condition: "Mastitis",
      category: "Large Animal",
      difficulty: "Easy",
      estimatedTime: 15,
      imageUrl: "/placeholder.svg",
    },
  ]