import test from "node:test";
import assert from "node:assert/strict";
import { SupabasePlatformBuilderRepository } from "../dist/features/platform-builder/repository.js";

function repositoryWithLegacySettings(messageBody, status = "published") {
  const client = {
    from(table) {
      const query = {
        select() { return this; },
        eq() { return this; },
        ilike() { return this; },
        order() { return this; },
        limit() { return this; },
        async maybeSingle() {
          return table === "tenant_platform_settings"
            ? { data: null, error: null }
            : { data: { message_body: messageBody, status, updated_at: "2026-10-26T14:47:28.025Z" }, error: null };
        },
      };
      return query;
    },
  };
  return new SupabasePlatformBuilderRepository(client, client);
}

test("public platform settings preserve the stored legacy theme", async () => {
  const repo = repositoryWithLegacySettings(JSON.stringify({
    subdomain: "mr-omar",
    display_title: "منصة المعلم",
    subject_title: "فيزياء",
    theme_preset: "slate",
    custom_primary_color: "#3b82f6",
    is_published: true,
  }));

  const result = await repo.getPublicBySubdomain("MR-OMAR");
  assert.equal(result?.theme_preset, "slate");
  assert.equal(result?.custom_primary_color, "#3b82f6");
  assert.equal(result?.display_title, "منصة المعلم");
});

test("legacy platform settings reject inactive or mismatched subdomains", async () => {
  const inactive = repositoryWithLegacySettings(JSON.stringify({ subdomain: "mr-omar", is_active: false }));
  const mismatched = repositoryWithLegacySettings(JSON.stringify({ subdomain: "another-teacher", is_active: true }));
  assert.equal(await inactive.getPublicBySubdomain("mr-omar"), null);
  assert.equal(await mismatched.getPublicBySubdomain("mr-omar"), null);
});
