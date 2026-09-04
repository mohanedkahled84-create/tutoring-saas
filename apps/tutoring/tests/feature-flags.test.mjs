import test from "node:test";
import assert from "node:assert/strict";
import {
  config,
  isFeatureEnabled,
  validateEnv,
  requireFeatureFlag,
} from "../dist/shared/index.js";

test("DEV-71: Feature flags default to disabled (false)", () => {
  assert.equal(isFeatureEnabled("businessDashboard"), false);
  assert.equal(isFeatureEnabled("behaviorTracking"), false);
  assert.equal(isFeatureEnabled("teacherCalendar"), false);
});

test("DEV-71: validateEnv correctly parses boolean flag strings and booleans", () => {
  const customEnv = validateEnv({
    FEATURE_BUSINESS_DASHBOARD: "true",
    FEATURE_BEHAVIOR_TRACKING: "1",
    FEATURE_TEACHER_CALENDAR: "false",
  });

  assert.equal(customEnv.FEATURE_BUSINESS_DASHBOARD, true);
  assert.equal(customEnv.FEATURE_BEHAVIOR_TRACKING, true);
  assert.equal(customEnv.FEATURE_TEACHER_CALENDAR, false);
});

test("DEV-71: requireFeatureFlag middleware rejects when feature is disabled", () => {
  const middleware = requireFeatureFlag("businessDashboard");

  let statusSent = 0;
  let jsonSent = null;

  const res = {
    status: (code) => {
      statusSent = code;
      return {
        json: (body) => {
          jsonSent = body;
        },
      };
    },
  };

  let nextCalled = false;
  middleware({}, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(statusSent, 404);
  assert.equal(jsonSent?.error?.code, "FEATURE_DISABLED");
});
