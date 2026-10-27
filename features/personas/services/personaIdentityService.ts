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
  sex?: PersonaSex;
  voiceId?: string;
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
    { first: "Alexandra", last: "Morgan", sex: "female", voiceId: "alice" },
    { first: "Victoria", last: "Lee", sex: "female", voiceId: "charlotte" },
    { first: "Charlotte", last: "Quinn", sex: "female", voiceId: "lily" },
    { first: "Olivia", last: "Adams", sex: "female", voiceId: "matilda" },
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
      // British/UK-style names with balanced representation of female and male owners
      { first: "Sarah", last: "Bennett", sex: "female", voiceId: "alice" },
      { first: "James", last: "Wright", sex: "male", voiceId: "george" },
      { first: "Emma", last: "Thompson", sex: "female", voiceId: "charlotte" },
      { first: "Oliver", last: "Taylor", sex: "male", voiceId: "charlie" },
      { first: "Mary", last: "Williams", sex: "female", voiceId: "lily" },
      { first: "William", last: "Hughes", sex: "male", voiceId: "harry" },
      { first: "Patricia", last: "Johnson", sex: "female", voiceId: "matilda" },
      { first: "Thomas", last: "Davis", sex: "male", voiceId: "fable" },
      { first: "Jennifer", last: "Brown", sex: "female", voiceId: "alice" },
      { first: "Alexander", last: "Clark", sex: "male", voiceId: "george" },
      { first: "Elizabeth", last: "Jones", sex: "female", voiceId: "charlotte" },
      { first: "Daniel", last: "Anderson", sex: "male", voiceId: "charlie" },
      { first: "Linda", last: "Miller", sex: "female", voiceId: "lily" },
      { first: "Michael", last: "Roberts", sex: "male", voiceId: "harry" },
      { first: "Barbara", last: "Davis", sex: "female", voiceId: "matilda" },
      { first: "David", last: "Campbell", sex: "male", voiceId: "fable" },
      { first: "Susan", last: "Clarke", sex: "female", voiceId: "alice" },
      { first: "Benjamin", last: "Green", sex: "male", voiceId: "george" },
      { first: "Jessica", last: "Wright", sex: "female", voiceId: "charlotte" },
      { first: "George", last: "Scott", sex: "male", voiceId: "charlie" },
      { first: "Karen", last: "Wilson", sex: "female", voiceId: "lily" },
      { first: "Edward", last: "Walker", sex: "male", voiceId: "harry" },
      { first: "Nancy", last: "Hughes", sex: "female", voiceId: "matilda" },
      { first: "Henry", last: "Robinson", sex: "male", voiceId: "george" },
      { first: "Carol", last: "Lee", sex: "female", voiceId: "alice" },
      { first: "Charles", last: "King", sex: "male", voiceId: "charlie" },
      { first: "Nicole", last: "Campbell", sex: "female", voiceId: "charlotte" },
      { first: "Richard", last: "Evans", sex: "male", voiceId: "harry" },
      { first: "Helen", last: "Baker", sex: "female", voiceId: "lily" },
      { first: "Arthur", last: "Young", sex: "male", voiceId: "george" },
      { first: "Amanda", last: "Harris", sex: "female", voiceId: "matilda" },
      { first: "Jack", last: "Mitchell", sex: "male", voiceId: "charlie" },
      { first: "Melissa", last: "Cooper", sex: "female", voiceId: "alice" },
      { first: "Samuel", last: "Turner", sex: "male", voiceId: "harry" },
      { first: "Deborah", last: "Clark", sex: "female", voiceId: "charlotte" },
      { first: "Lucas", last: "Morgan", sex: "male", voiceId: "george" },
      { first: "Stephanie", last: "Lewis", sex: "female", voiceId: "lily" },
      { first: "Noah", last: "Harrison", sex: "male", voiceId: "fable" },
      { first: "Rebecca", last: "Robinson", sex: "female", voiceId: "matilda" },
      { first: "Ethan", last: "Palmer", sex: "male", voiceId: "charlie" },
      { first: "Sharon", last: "Walker", sex: "female", voiceId: "alice" },
      { first: "Leo", last: "Phillips", sex: "male", voiceId: "harry" },
      { first: "Laura", last: "Hall", sex: "female", voiceId: "charlotte" },
      { first: "Isaac", last: "Edwards", sex: "male", voiceId: "george" },
      { first: "Cynthia", last: "Young", sex: "female", voiceId: "lily" },
      { first: "Liam", last: "Martin", sex: "male", voiceId: "fable" },
      { first: "Kathleen", last: "Allen", sex: "female", voiceId: "matilda" },
      { first: "Mason", last: "Foster", sex: "male", voiceId: "charlie" },
      { first: "Amy", last: "King", sex: "female", voiceId: "alice" },
      { first: "Dylan", last: "Bennett", sex: "male", voiceId: "harry" },
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

  const sex = nameEntry.sex ?? config.sex;
  const voiceId = nameEntry.voiceId ?? config.voiceId;

  return {
    firstName,
    lastName,
    fullName,
    honorific,
    sex,
    pronouns: buildPronouns(sex),
    voiceId,
  };
}

function buildOwnerIdentity(ownerName: string, caseId: string, roleKey: string): PersonaIdentity {
  const cleaned = ownerName.replace(/[^A-Za-z'\-\s]/g, " ").replace(/\s+/g, " ").trim();
  const config = ROLE_CONFIG[roleKey] ?? DEFAULT_CONFIG;
  const backupNames = config.names.length ? config.names : DEFAULT_CONFIG.names;
  const base = `${caseId}:${roleKey}:owner`;
  const defaultEntry = pickNameEntry({ ...config, names: backupNames }, base);
  const sex = defaultEntry.sex ?? config.sex;
  const voiceId = defaultEntry.voiceId ?? config.voiceId;

  if (!cleaned) {
    return {
      firstName: defaultEntry.first,
      lastName: defaultEntry.last,
      fullName: `${defaultEntry.first} ${defaultEntry.last}`,
      honorific: defaultEntry.honorific ?? config.defaultHonorific,
      sex,
      pronouns: buildPronouns(sex),
      voiceId,
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
    sex,
    pronouns: buildPronouns(sex),
    voiceId,
  };
}
