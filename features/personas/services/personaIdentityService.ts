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
      { first: "Charlotte", last: "Bennett" },
      { first: "Amelia", last: "Montrose" },
      { first: "Imogen", last: "Lovelace" },
      { first: "Beatrice", last: "Hollingsworth" },
      { first: "Eleanor", last: "Vance" },
      { first: "Sophia", last: "Russo" },
      { first: "Isabella", last: "Moretti" },
      { first: "Olivia", last: "Chen" },
      { first: "Ava", last: "Patel" },
      { first: "Mia", last: "Kim" },
      { first: "Harper", last: "Sullivan" },
      { first: "Evelyn", last: "O'Connor" },
      { first: "Abigail", last: "Fitzgerald" },
      { first: "Emily", last: "Walsh" },
      { first: "Elizabeth", last: "Doyle" },
      { first: "Mila", last: "Ivanova" },
      { first: "Ella", last: "Schmidt" },
      { first: "Avery", last: "Mueller" },
      { first: "Sofia", last: "Weber" },
      { first: "Camila", last: "Wagner" },
      { first: "Aria", last: "Becker" },
      { first: "Scarlett", last: "Hoffman" },
      { first: "Victoria", last: "Schulz" },
      { first: "Madison", last: "Koch" },
      { first: "Luna", last: "Richter" },
      { first: "Grace", last: "Klein" },
      { first: "Chloe", last: "Wolf" },
      { first: "Penelope", last: "Schroeder" },
      { first: "Layla", last: "Neumann" },
      { first: "Riley", last: "Schwarz" },
      { first: "Zoey", last: "Zimmermann" },
      { first: "Nora", last: "Braun" },
      { first: "Lily", last: "Krüger" },
      { first: "Eleanor", last: "Hofmann" },
      { first: "Hannah", last: "Hartmann" },
      { first: "Lillian", last: "Lange" },
      { first: "Addison", last: "Schmitt" },
      { first: "Aubrey", last: "Werner" },
      { first: "Ellie", last: "Schmitz" },
      { first: "Stella", last: "Krause" },
      { first: "Natalie", last: "Meier" },
      { first: "Zoe", last: "Lehmann" },
      { first: "Leah", last: "Schmid" },
      { first: "Hazel", last: "Schulze" },
      { first: "Violet", last: "Maier" },
      { first: "Aurora", last: "Köhler" },
      { first: "Savannah", last: "Herrmann" },
      { first: "Audrey", last: "König" },
      { first: "Brooklyn", last: "Walter" },
      { first: "Bella", last: "Mayer" },
      { first: "Claire", last: "Huber" },
      { first: "Skylar", last: "Kaiser" },
      { first: "Lucy", last: "Fuchs" },
      { first: "Paisley", last: "Peters" },
      { first: "Everly", last: "Lang" },
      { first: "Anna", last: "Scholz" },
      { first: "Caroline", last: "Möller" },
      { first: "Nova", last: "Weiss" },
      { first: "Genesis", last: "Jung" },
      { first: "Emilia", last: "Hahn" },
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
      { first: "Sierra", last: "Holland" },
      { first: "Imani", last: "Carson" },
      { first: "Freya", last: "Bennett" },
      { first: "Alina", last: "Popescu" },
      { first: "Zara", last: "Moyo" },
      { first: "Kiana", last: "Reeves" },
      { first: "Elara", last: "Vance" },
      { first: "Nia", last: "Okoro" },
      { first: "Maya", last: "Patel" },
      { first: "Leila", last: "Hassan" },
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
  const seedBase = context?.sharedPersonaKey
    ? context.sharedPersonaKey
    : `${roleKey}:${context?.species ?? "shared"}`;
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
