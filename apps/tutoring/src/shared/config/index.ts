import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const booleanFlag = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((val) => {
    if (typeof val === "boolean") return val;
    if (typeof val === "string") {
      const lower = val.toLowerCase().trim();
      return lower === "true" || lower === "1" || lower === "yes";
    }
    return false;
  })
  .default(false);

export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  SUPABASE_URL: z.string().url({ message: "SUPABASE_URL must be a valid URL" }),
  SUPABASE_ANON_KEY: z
    .string()
    .min(10, { message: "SUPABASE_ANON_KEY is required and must be a valid key" }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(""),
  INTERNAL_API_SECRET: z
    .string()
    .min(8, { message: "INTERNAL_API_SECRET is required and must be at least 8 characters" }),
  FOUNDER_WHATSAPP_PHONE: z.string().default("01000000000"),
  FOUNDER_ALERT_EMAIL: z.string().email().default("admin@centrly.app"),
  RESEND_API_KEY: z.string().optional().default(""),
  EVOLUTION_API_URL: z.string().url().optional().or(z.literal("")).default(""),
  EVOLUTION_API_KEY: z.string().optional().default(""),
  EVOLUTION_INSTANCE_NAME: z.string().optional().default("centrly-main"),
  // DEV-71: Feature Flags (Default false for MVP-override / in-progress features)
  FEATURE_BUSINESS_DASHBOARD: booleanFlag,
  FEATURE_BEHAVIOR_TRACKING: booleanFlag,
  FEATURE_TEACHER_CALENDAR: booleanFlag,
});

export function validateEnv(
  rawEnv: Record<string, string | undefined> = process.env,
  exitOnError = false
) {
  // Safe test-only dummy fallbacks: Active ONLY when NODE_ENV is explicitly 'test' or running under test runner
  const isTest =
    (rawEnv.NODE_ENV || process.env.NODE_ENV) === "test" ||
    process.execArgv.some((arg) => arg.includes("test")) ||
    process.argv.some((arg) => arg.includes("test"));

  const effectiveEnv = { ...rawEnv };

  if (isTest) {
    process.env.NODE_ENV = "test";
    effectiveEnv.NODE_ENV = "test";
    if (!effectiveEnv.SUPABASE_URL) {
      effectiveEnv.SUPABASE_URL = "https://placeholder-test-project.supabase.co";
    }
    if (!effectiveEnv.SUPABASE_ANON_KEY) {
      effectiveEnv.SUPABASE_ANON_KEY = "test-placeholder-anon-key-min10chars";
    }
    if (!effectiveEnv.INTERNAL_API_SECRET || rawEnv === process.env) {
      effectiveEnv.INTERNAL_API_SECRET = "dev-shared-secret-change-in-production";
    }
    if (rawEnv === process.env) {
      delete effectiveEnv.FEATURE_BUSINESS_DASHBOARD;
      delete effectiveEnv.FEATURE_BEHAVIOR_TRACKING;
      delete effectiveEnv.FEATURE_TEACHER_CALENDAR;
    }
  }

  const parsed = envSchema.safeParse(effectiveEnv);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    if (exitOnError) {
      console.error(`\n❌ [FATAL] Environment configuration error at startup:\n${errorDetails}\n`);
      process.exit(1);
    }
    throw new Error(`Environment validation failed:\n${errorDetails}`);
  }

  return parsed.data;
}

const env = validateEnv(process.env, process.env.NODE_ENV === "production");

export const config = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  supabaseUrl: env.SUPABASE_URL,
  supabaseAnonKey: env.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  internalApiSecret: env.INTERNAL_API_SECRET,
  founderPhone: env.FOUNDER_WHATSAPP_PHONE,
  founderEmail: env.FOUNDER_ALERT_EMAIL,
  resendApiKey: env.RESEND_API_KEY,
  evolutionApiUrl: env.EVOLUTION_API_URL,
  evolutionApiKey: env.EVOLUTION_API_KEY,
  evolutionInstanceName: env.EVOLUTION_INSTANCE_NAME,
  features: {
    businessDashboard: env.FEATURE_BUSINESS_DASHBOARD,
    behaviorTracking: env.FEATURE_BEHAVIOR_TRACKING,
    teacherCalendar: env.FEATURE_TEACHER_CALENDAR,
  },
};

export type FeatureFlagName = keyof typeof config.features;

export function isFeatureEnabled(feature: FeatureFlagName): boolean {
  return Boolean(config.features[feature]);
}
