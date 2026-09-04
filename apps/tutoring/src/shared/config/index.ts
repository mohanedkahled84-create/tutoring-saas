import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

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
    .min(8, { message: "INTERNAL_API_SECRET must be at least 8 characters" })
    .default("dev-shared-secret-change-in-production"),
  FOUNDER_WHATSAPP_PHONE: z.string().default("01000000000"),
  FOUNDER_ALERT_EMAIL: z.string().email().default("admin@centrly.app"),
  RESEND_API_KEY: z.string().optional().default(""),
  EVOLUTION_API_URL: z.string().url().optional().or(z.literal("")).default(""),
  EVOLUTION_API_KEY: z.string().optional().default(""),
  EVOLUTION_INSTANCE_NAME: z.string().optional().default("centrly-main"),
});

export function validateEnv(
  rawEnv: Record<string, string | undefined> = process.env,
  exitOnError = false
) {
  // Inject default project credentials for development/testing if missing
  const effectiveEnv = {
    SUPABASE_URL: "https://ofaraxqrpcdiregxjyyb.supabase.co",
    SUPABASE_ANON_KEY:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mYXJheHFycGNkaXJlZ3hqeXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyOTg3MTMsImV4cCI6MjEwMzg3NDcxM30.UQ6WtcdS7zwBasNOM4FUyFOq1QMJuoYPzLqPOE767yM",
    ...rawEnv,
  };

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
};
