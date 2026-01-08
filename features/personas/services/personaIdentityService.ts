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
  voiceId: "alloy",
  names: [
    { first: "Alex", last: "Morgan" },
    { first: "Jordan", last: "Lee" },
    { first: "Taylor", last: "Quinn" },
    { first: "Riley", last: "Adams" },
  ],
};

const ROLE_CONFIG: Record<string, PersonaIdentityConfig> = {
  owner: {
    sex: "female",
    voiceId: "nova",
    names: [
      { first: "Sarah", last: "Bennett" },
      { first: "Emma", last: "Thompson" },
      { first: "Mary", last: "Williams" },
      { first: "Patricia", last: "Johnson" },
      { first: "Jennifer", last: "Brown" },
      { first: "Elizabeth", last: "Jones" },
      { first: "Linda", last: "Miller" },
      { first: "Barbara", last: "Davis" },
      { first: "Susan", last: "Garcia" },
      { first: "Jessica", last: "Rodriguez" },
      { first: "Karen", last: "Wilson" },
      { first: "Nancy", last: "Martinez" },
      { first: "Lisa", last: "Anderson" },
      { first: "Margaret", last: "Taylor" },
      { first: "Betty", last: "Thomas" },
      { first: "Sandra", last: "Hernandez" },
      { first: "Ashley", last: "Moore" },
      { first: "Dorothy", last: "Martin" },
      { first: "Kimberly", last: "Jackson" },
      { first: "Emily", last: "Thompson" },
      { first: "Donna", last: "White" },
      { first: "Michelle", last: "Lopez" },
      { first: "Carol", last: "Lee" },
      { first: "Amanda", last: "Gonzalez" },
      { first: "Melissa", last: "Harris" },
      { first: "Deborah", last: "Clark" },
      { first: "Stephanie", last: "Lewis" },
      { first: "Rebecca", last: "Robinson" },
      { first: "Sharon", last: "Walker" },
      { first: "Laura", last: "Perez" },
      { first: "Cynthia", last: "Hall" },
      { first: "Kathleen", last: "Young" },
      { first: "Amy", last: "Allen" },
      { first: "Shirley", last: "Sanchez" },
      { first: "Angela", last: "Wright" },
      { first: "Helen", last: "King" },
      { first: "Anna", last: "Scott" },
      { first: "Brenda", last: "Green" },
      { first: "Pamela", last: "Baker" },
      { first: "Nicole", last: "Adams" },
      { first: "Samantha", last: "Nelson" },
      { first: "Katherine", last: "Hill" },
      { first: "Christine", last: "Ramirez" },
      { first: "Debra", last: "Campbell" },
      { first: "Rachel", last: "Mitchell" },
      { first: "Carolyn", last: "Roberts" },
      { first: "Janet", last: "Carter" },
      { first: "Maria", last: "Phillips" },
      { first: "Heather", last: "Evans" },
      { first: "Diane", last: "Turner" },
    ],
  },
  "lab-technician": {
    sex: "male",
    voiceId: "onyx",
    names: [
      { first: "Andre", last: "Silva" },
      { first: "Jasper", last: "Hayes" },
      { first: "Malik", last: "Daniels" },
      { first: "Rowan", last: "Li" },
    ],
  },
  veterinarian: {
    sex: "male",
    voiceId: "verse",
    names: [
      { honorific: "Dr.", first: "Miguel", last: "Torres" },
      { honorific: "Dr.", first: "Noah", last: "Kim" },
      { honorific: "Dr.", first: "Luca", last: "Romero" },
      { honorific: "Dr.", first: "Aiden", last: "Forsyth" },
    ],
    defaultHonorific: "Dr.",
  },
  "veterinary-nurse": {
    sex: "female",
    voiceId: "shimmer",
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
    voiceId: "echo", // Changed from 'oliver' to 'echo' (neutral/male-ish)
    names: [
      { first: "Colin", last: "McDermott" },
      { first: "Rafael", last: "Santos" },
      { first: "Ethan", last: "Brooks" },
      { first: "Declan", last: "Murphy" },
    ],
  },
  "veterinary-assistant": {
    sex: "female",
    voiceId: "alloy",
    names: [
      { first: "Nina", last: "Zhao" },
      { first: "Priya", last: "Kulkarni" },
      { first: "Avery", last: "Lopez" },
      { first: "Juniper", last: "Ellis" },
    ],
  },
  professor: {
    sex: "female",
    voiceId: "sage",
    names: [
      { honorific: "Dr.", first: "Evelyn", last: "Hart" },
      { honorific: "Dr.", first: "Nalini", last: "Chandra" },
      { honorific: "Dr.", first: "Miranda", last: "Kingsley" },
      { honorific: "Dr.", first: "Sabine", last: "Dubois" },
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
