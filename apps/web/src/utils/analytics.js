/**
 * Centrly Product Behavior & Telemetry Tracker (DEV-55)
 * Lightweight, privacy-respecting client analytics adapter.
 * Tracks signup funnel, feature usage, and product events without coupling to business logic.
 */

class TelemetryTracker {
  constructor(endpoint = "/api/telemetry/events", options = {}) {
    this.endpoint = endpoint;
    this.batchSize = options.batchSize || 10;
    this.flushIntervalMs = options.flushIntervalMs || 5000;
    this.queue = [];
    this.timer = null;
    this.sessionId = this._getOrCreateSessionId();
  }

  _getOrCreateSessionId() {
    try {
      let sid = sessionStorage.getItem("centrly_sid");
      if (!sid) {
        sid = "csid_" + Math.random().toString(36).substring(2, 12) + "_" + Date.now();
        sessionStorage.setItem("centrly_sid", sid);
      }
      return sid;
    } catch {
      return "csid_fallback_" + Date.now();
    }
  }

  track(eventName, properties = {}) {
    const event = {
      event_name: eventName,
      properties,
      page_path: typeof window !== "undefined" ? window.location.pathname : "/",
      session_id: this.sessionId,
      timestamp: new Date().toISOString(),
    };

    this.queue.push(event);

    if (this.queue.length >= this.batchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushIntervalMs);
    }
  }

  async flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.queue.length === 0) return;

    const batch = [...this.queue];
    this.queue = [];

    try {
      const payload = JSON.stringify({ events: batch });
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const sent = navigator.sendBeacon(
          this.endpoint,
          new Blob([payload], { type: "application/json" })
        );
        if (sent) return;
      }

      await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
    } catch {
      // Telemetry failures fail silently to never disrupt user experience
    }
  }

  // Core Funnel Event Helpers
  trackPageView(path, title) {
    this.track("page_view", { path, title });
  }

  trackSignupStarted(step = 1) {
    this.track("signup_started", { step });
  }

  trackSignupCompleted(tenantId) {
    this.track("signup_completed", { tenant_id: tenantId });
  }

  trackWhatsAppConnect(status) {
    this.track("whatsapp_connect", { status });
  }

  trackSessionAction(action, metadata = {}) {
    this.track(`session_${action}`, metadata);
  }
}

export const analytics = new TelemetryTracker();
