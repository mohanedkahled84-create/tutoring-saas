import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  supabaseUrl: process.env.SUPABASE_URL || "https://ofaraxqrpcdiregxjyyb.supabase.co",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mYXJheHFycGNkaXJlZ3hqeXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyOTg3MTMsImV4cCI6MjEwMzg3NDcxM30.UQ6WtcdS7zwBasNOM4FUyFOq1QMJuoYPzLqPOE767yM",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  internalApiSecret: process.env.INTERNAL_API_SECRET || "dev-shared-secret-change-in-production",
  founderPhone: process.env.FOUNDER_WHATSAPP_PHONE || "01000000000",
  founderEmail: process.env.FOUNDER_ALERT_EMAIL || "mohaned@example.com",
};
