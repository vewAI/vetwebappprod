import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import chalk from "chalk";
import { resolvePersonaIdentity } from "@/features/personas/services/personaIdentityService";
import { personaTemplates } from "@/features/personas/data/persona-templates";
import type { PersonaSeedContext } from "@/features/personas/models/persona";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error(chalk.red("Missing Supabase credentials in .env.local"));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

// --- Configuration ---
const NUM_NURSES = 5;
const NUM_OWNERS = 60;

// Helper to generate random names
const FIRST_NAMES_FEMALE = ["Emma", "Olivia", "Ava", "Isabella", "Sophia", "Mia", "Charlotte", "Amelia", "Harper", "Evelyn", "Abigail", "Emily", "Ella", "Elizabeth", "Camila", "Luna", "Sofia", "Avery", "Mila", "Aria", "Scarlett", "Penelope", "Layla", "Chloe", "Victoria", "Madison", "Eleanor", "Grace", "Nora", "Riley", "Zoey", "Hannah", "Hazel", "Lily", "Ellie", "Violet", "Lillian", "Zoe", "Stella", "Aurora", "Natalie", "Emilia", "Everly", "Leah", "Aubrey", "Willow", "Addison", "Lucy", "Audrey", "Bella"];
const FIRST_NAMES_MALE = ["Liam", "Noah", "Oliver", "Elijah", "William", "James", "Benjamin", "Lucas", "Henry", "Alexander", "Mason", "Michael", "Ethan", "Daniel", "Jacob", "Logan", "Jackson", "Levi", "Sebastian", "Mateo", "Jack", "Owen", "Theodore", "Aiden", "Samuel", "Joseph", "John", "David", "Wyatt", "Matthew", "Luke", "Asher", "Carter", "Julian", "Grayson", "Leo", "Jayden", "Gabriel", "Isaac", "Lincoln", "Anthony", "Hudson", "Dylan", "Ezra", "Thomas", "Charles", "Christopher", "Jaxon", "Maverick", "Josiah"];
const SURNAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts"];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateIdentity(role: "owner" | "nurse", index: number) {
  const sex = Math.random() > 0.5 ? "female" : "male";
  const firstName = sex === "female" ? getRandomElement(FIRST_NAMES_FEMALE) : getRandomElement(FIRST_NAMES_MALE);
  const lastName = getRandomElement(SURNAMES);
  const fullName = `${firstName} ${lastName}`;
  
  // Simple voice ID mapping (placeholders, assuming system handles mapping or generation)
  const voiceId = sex === "female" ? "alloy" : "echo"; 

  return {
    fullName,
    sex,
    voiceId,
    age: Math.floor(Math.random() * (65 - 25) + 25), // 25-65
    role,
  };
}

async function seedPersonas() {
  console.log(chalk.cyan("Starting persona seeding..."));

  // --- Seed Nurses ---
  console.log(chalk.yellow(`Seeding ${NUM_NURSES} nurses...`));
  for (let i = 0; i < NUM_NURSES; i++) {
    const identity = generateIdentity("nurse", i);
    const roleKey = "veterinary-nurse";
    
    // Create a unique key for this specific nurse variant
    // We use the standard role_key but rely on the fact that we are inserting new rows
    // Actually, global_personas usually has unique role_key. 
    // If we want multiple nurses, we might need to use a different strategy or just insert them.
    // The schema for global_personas might enforce unique role_key? 
    // Let's check if we can have multiple rows with same role_key or if we need unique keys.
    // If unique, we'll append an index.
    
    const uniqueRoleKey = `veterinary-nurse-${i + 1}`;

    const metadata = {
      identity: {
        fullName: identity.fullName,
        sex: identity.sex,
        voiceId: identity.voiceId,
        age: identity.age,
      },
      sex: identity.sex,
      voiceId: identity.voiceId,
    };

    const prompt = `A hyper-realistic portrait of ${identity.fullName}, a ${identity.age}-year-old ${identity.sex} veterinary nurse. Professional attire, scrubs, clinical setting. European descent.`;

    const { error } = await supabase.from("global_personas").upsert({
      role_key: uniqueRoleKey,
      display_name: identity.fullName,
      prompt: prompt,
      metadata: metadata,
      generated_by: "seed-script",
      status: "pending", // Mark as pending so image generation picks it up if configured
    }, { onConflict: "role_key" });

    if (error) {
      console.error(chalk.red(`Failed to insert nurse ${identity.fullName}: ${error.message}`));
    } else {
      console.log(chalk.green(`Inserted nurse: ${identity.fullName} (${uniqueRoleKey})`));
    }
  }

  // --- Seed Owners ---
  // For owners, we want them available in the pool. 
  // The AvatarSelector fetches owners from `case_personas`.
  // To make them available globally without being attached to a specific case, 
  // we can insert them into `global_personas` with role_key starting with 'owner-'.
  // AND we need to update AvatarSelector to look there (which I will do next).
  
  console.log(chalk.yellow(`Seeding ${NUM_OWNERS} owners...`));
  for (let i = 0; i < NUM_OWNERS; i++) {
    const identity = generateIdentity("owner", i);
    const uniqueRoleKey = `owner-pool-${i + 1}`;

    const metadata = {
      identity: {
        fullName: identity.fullName,
        sex: identity.sex,
        voiceId: identity.voiceId,
        age: identity.age,
      },
      sex: identity.sex,
      voiceId: identity.voiceId,
    };

    const prompt = `A hyper-realistic portrait of ${identity.fullName}, a ${identity.age}-year-old ${identity.sex} pet owner. Casual attire, natural lighting. European descent.`;

    const { error } = await supabase.from("global_personas").upsert({
      role_key: uniqueRoleKey,
      display_name: identity.fullName,
      prompt: prompt,
      metadata: metadata,
      generated_by: "seed-script",
      status: "pending",
    }, { onConflict: "role_key" });

    if (error) {
      console.error(chalk.red(`Failed to insert owner ${identity.fullName}: ${error.message}`));
    } else {
      // console.log(chalk.green(`Inserted owner: ${identity.fullName}`));
      process.stdout.write("."); // Minimal output for 60 items
    }
  }
  console.log("\n");
  console.log(chalk.green("Seeding complete."));
}

seedPersonas();
