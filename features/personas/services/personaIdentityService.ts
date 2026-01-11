import type {
  PersonaIdentity,
  PersonaPronouns,
  PersonaSeedContext,
  PersonaSex,
} from "@/features/personas/models/persona";

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

type NameEntry = {
  first: string;
  last: string;
  honorific?: string;
};

type PersonaIdentityConfig = {
  sex: PersonaSex;
  voiceId: string;
  names: NameEntry[];
  defaultHonorific?: string;
};

const DEFAULT_CONFIG: PersonaIdentityConfig = {
  sex: "female",
  voiceId: "alice", // British female (ElevenLabs)
  names: [
    { first: "Alexandra", last: "Morgan" },
    { first: "Victoria", last: "Lee" },
    { first: "Charlotte", last: "Quinn" },
    { first: "Olivia", last: "Adams" },
  ],
};

// Voice IDs aligned with voiceMap.ts:
// British Male: fable (OpenAI), charlie, george, harry (ElevenLabs)
// British Female: alice, charlotte, lily, matilda (ElevenLabs)
// American Male: onyx, echo (OpenAI)  
// American Female: shimmer, nova (OpenAI)
// Neutral: alloy (OpenAI)

const ROLE_CONFIG: Record<string, PersonaIdentityConfig> = {
  owner: {
    sex: "female",
    voiceId: "alice", // British female (ElevenLabs)
    names: [
      // British/UK-style names for coherence with British accent
      { first: "Sarah", last: "Bennett" },
      { first: "Emma", last: "Thompson" },
      { first: "Mary", last: "Williams" },
      { first: "Patricia", last: "Johnson" },
      { first: "Jennifer", last: "Brown" },
      { first: "Elizabeth", last: "Jones" },
      { first: "Linda", last: "Miller" },
      { first: "Barbara", last: "Davis" },
      { first: "Susan", last: "Clarke" },
      { first: "Jessica", last: "Wright" },
      { first: "Karen", last: "Wilson" },
      { first: "Nancy", last: "Hughes" },
      { first: "Lisa", last: "Anderson" },
      { first: "Margaret", last: "Taylor" },
      { first: "Betty", last: "Thomas" },
      { first: "Sandra", last: "Edwards" },
      { first: "Ashley", last: "Moore" },
      { first: "Dorothy", last: "Martin" },
      { first: "Kimberly", last: "Jackson" },
      { first: "Emily", last: "Thompson" },
      { first: "Donna", last: "White" },
      { first: "Michelle", last: "Roberts" },
      { first: "Carol", last: "Lee" },
      { first: "Amanda", last: "Harris" },
      { first: "Melissa", last: "Cooper" },
      { first: "Deborah", last: "Clark" },
      { first: "Stephanie", last: "Lewis" },
      { first: "Rebecca", last: "Robinson" },
      { first: "Sharon", last: "Walker" },
      { first: "Laura", last: "Hall" },
      { first: "Cynthia", last: "Young" },
      { first: "Kathleen", last: "Allen" },
      { first: "Amy", last: "King" },
      { first: "Shirley", last: "Scott" },
      { first: "Angela", last: "Green" },
      { first: "Helen", last: "Baker" },
      { first: "Anna", last: "Adams" },
      { first: "Brenda", last: "Nelson" },
      { first: "Pamela", last: "Hill" },
      { first: "Nicole", last: "Campbell" },
      { first: "Samantha", last: "Mitchell" },
      { first: "Katherine", last: "Carter" },
      { first: "Christine", last: "Phillips" },
      { first: "Debra", last: "Evans" },
      { first: "Rachel", last: "Turner" },
      { first: "Carolyn", last: "Parker" },
      { first: "Janet", last: "Collins" },
      { first: "Catherine", last: "Stewart" },
      { first: "Heather", last: "Morris" },
      { first: "Diane", last: "Murphy" },
    ],
  },
  "lab-technician": {
    sex: "male",
    voiceId: "george", // British male (ElevenLabs)
    names: [
      { first: "Andrew", last: "Silva" },
      { first: "James", last: "Hayes" },
      { first: "Michael", last: "Daniels" },
      { first: "Robert", last: "Li" },
      { first: "William", last: "Chen" },
      { first: "Thomas", last: "Foster" },
    ],
  },
  veterinarian: {
    sex: "male",
    voiceId: "charlie", // British male (ElevenLabs)
    names: [
      { honorific: "Dr.", first: "Michael", last: "Torres" },
      { honorific: "Dr.", first: "James", last: "Kim" },
      { honorific: "Dr.", first: "William", last: "Romero" },
      { honorific: "Dr.", first: "Alexander", last: "Forsyth" },
      { honorific: "Dr.", first: "Christopher", last: "Hughes" },
      { honorific: "Dr.", first: "Daniel", last: "Bennett" },
    ],
    defaultHonorific: "Dr.",
  },
  "veterinary-nurse": {
    sex: "female",
    voiceId: "charlotte", // British female (ElevenLabs)
    names: [
      { first: "Sarah", last: "Jenkins" },
      { first: "Emily", last: "Wilson" },
      { first: "Jessica", last: "Taylor" },
      { first: "Ashley", last: "Brown" },
      { first: "Amanda", last: "Davis" },
      { first: "Jennifer", last: "Miller" },
      { first: "Elizabeth", last: "Moore" },
      { first: "Megan", last: "Anderson" },
      { first: "Rachel", last: "Thomas" },
      { first: "Lauren", last: "Jackson" },
    ],
  },
  producer: {
    sex: "male",
    voiceId: "harry", // British male (ElevenLabs)
    names: [
      { first: "Colin", last: "McDermott" },
      { first: "Richard", last: "Santos" },
      { first: "Edward", last: "Brooks" },
      { first: "Patrick", last: "Murphy" },
      { first: "Thomas", last: "O'Brien" },
      { first: "Martin", last: "Walsh" },
    ],
  },
  "veterinary-assistant": {
    sex: "female",
    voiceId: "lily", // British female (ElevenLabs)
    names: [
      { first: "Nina", last: "Zhao" },
      { first: "Sophie", last: "Patel" },
      { first: "Grace", last: "Lopez" },
      { first: "Hannah", last: "Ellis" },
      { first: "Lucy", last: "Foster" },
      { first: "Chloe", last: "Bennett" },
    ],
  },
  professor: {
    sex: "female",
    voiceId: "matilda", // British female (ElevenLabs)
    names: [
      { honorific: "Dr.", first: "Evelyn", last: "Hart" },
      { honorific: "Dr.", first: "Victoria", last: "Chandra" },
      { honorific: "Dr.", first: "Miranda", last: "Kingsley" },
      { honorific: "Dr.", first: "Eleanor", last: "Dubois" },
      { honorific: "Dr.", first: "Catherine", last: "Ashworth" },
      { honorific: "Dr.", first: "Margaret", last: "Thornton" },
    ],
    defaultHonorific: "Dr.",
  },
};

function buildPronouns(sex: PersonaSex): PersonaPronouns {
  if (sex === "male") {
    return {
      subject: "he",
      object: "him",
      possessive: "his",
      determiner: "his",
    };
  }
  return {
    subject: "she",
    object: "her",
    possessive: "hers",
    determiner: "her",
  };
}

function pickNameEntry(config: PersonaIdentityConfig, seed: string): NameEntry {
  const pool = config.names.length ? config.names : DEFAULT_CONFIG.names;
  const index = hashString(seed) % pool.length;
  return pool[index];
}

export function resolvePersonaIdentity(
  caseId: string,
  roleKey: string,
  context?: PersonaSeedContext
): PersonaIdentity {
  if (roleKey === "owner" && context?.ownerName) {
    return buildOwnerIdentity(context.ownerName, caseId, roleKey);
  }

  const config = ROLE_CONFIG[roleKey] ?? DEFAULT_CONFIG;
  // Use caseId in the seed to ensure the identity is consistent and fixed for this specific case.
  // Fallback to species/role logic only if caseId is missing (unlikely) or for shared contexts.
  const seedBase = context?.sharedPersonaKey
    ? context.sharedPersonaKey
    : `${caseId}:${roleKey}`;
  const nameEntry = pickNameEntry(config, seedBase);
  const honorific = nameEntry.honorific ?? config.defaultHonorific;
  const firstName = nameEntry.first;
  const lastName = nameEntry.last;
  const fullName = honorific
    ? `${honorific} ${firstName} ${lastName}`
    : `${firstName} ${lastName}`;

  return {
    firstName,
    lastName,
    fullName,
    honorific,
    sex: config.sex,
    pronouns: buildPronouns(config.sex),
    voiceId: config.voiceId,
  };
}

function buildOwnerIdentity(ownerName: string, caseId: string, roleKey: string): PersonaIdentity {
  const cleaned = ownerName.replace(/[^A-Za-z'\-\s]/g, " ").replace(/\s+/g, " ").trim();
  const config = ROLE_CONFIG[roleKey] ?? DEFAULT_CONFIG;
  const backupNames = config.names.length ? config.names : DEFAULT_CONFIG.names;
  const base = `${caseId}:${roleKey}:owner`;
  const defaultEntry = pickNameEntry({ ...config, names: backupNames }, base);

  if (!cleaned) {
    return {
      firstName: defaultEntry.first,
      lastName: defaultEntry.last,
      fullName: `${defaultEntry.first} ${defaultEntry.last}`,
      honorific: defaultEntry.honorific ?? config.defaultHonorific,
      sex: config.sex,
      pronouns: buildPronouns(config.sex),
      voiceId: config.voiceId,
    };
  }

  const fragments = cleaned.split(" ").filter(Boolean);
  const firstName = fragments[0] ?? defaultEntry.first;
  const lastName = fragments.length > 1 ? fragments[fragments.length - 1] : defaultEntry.last;
  const honorific = defaultEntry.honorific ?? config.defaultHonorific;
  const fullName = honorific ? `${honorific} ${firstName} ${lastName}` : `${firstName} ${lastName}`;

  return {
    firstName,
    lastName,
    fullName,
    honorific,
    sex: config.sex,
    pronouns: buildPronouns(config.sex),
    voiceId: config.voiceId,
  };
}
