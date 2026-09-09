/**
 * ============================================================================
 * Evolution API Gateway (Clean Architecture Interface & Adapters)
 * ============================================================================
 * Architecture Rule 1 & Rule 3:
 * - Domain layer communicates with external providers exclusively via interfaces.
 * - ZERO imports of external database clients in this file.
 * - Responses are strictly normalized to snake_case.
 * ============================================================================
 */

export interface EvolutionQrResult {
  instance_name: string;
  status: "connected" | "disconnected" | "connecting" | "pending";
  qr_base64: string | null;
  pairing_code: string | null;
  expires_in_seconds: number;
}

export interface EvolutionStateResult {
  instance_name: string;
  status: "connected" | "disconnected" | "connecting";
  phone_number?: string;
  latency_ms?: number;
}

export interface IEvolutionGateway {
  getQrCode(instanceName: string): Promise<EvolutionQrResult>;
  getConnectionState(instanceName: string): Promise<EvolutionStateResult>;
  disconnectInstance(instanceName: string): Promise<boolean>;
}

export class HttpEvolutionGateway implements IEvolutionGateway {
  constructor(
    private readonly apiUrl?: string,
    private readonly apiKey?: string
  ) {}

  async getQrCode(instanceName: string): Promise<EvolutionQrResult> {
    if (!this.apiUrl || !this.apiKey) {
      // Unconfigured in local/dev - return safe simulated QR result
      return {
        instance_name: instanceName,
        status: "pending",
        qr_base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        pairing_code: "1234-5678",
        expires_in_seconds: 30,
      };
    }

    try {
      // 1. Check if instance is already connected
      const state = await this.getConnectionState(instanceName);
      if (state.status === "connected") {
        return {
          instance_name: instanceName,
          status: "connected",
          qr_base64: null,
          pairing_code: null,
          expires_in_seconds: 0,
        };
      }

      // 2. Fetch or create instance QR from Evolution API
      let connectRes = await fetch(`${this.apiUrl}/instance/connect/${instanceName}`, {
        headers: {
          apikey: this.apiKey,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (connectRes.status === 404) {
        // Create instance if it doesn't exist yet
        await fetch(`${this.apiUrl}/instance/create`, {
          method: "POST",
          headers: {
            apikey: this.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            instanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
          }),
          signal: AbortSignal.timeout(8000),
        });

        connectRes = await fetch(`${this.apiUrl}/instance/connect/${instanceName}`, {
          headers: {
            apikey: this.apiKey,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(8000),
        });
      }

      if (!connectRes.ok) {
        throw new Error(`Evolution API connect returned ${connectRes.status}`);
      }

      const data = (await connectRes.json()) as {
        base64?: string;
        code?: string;
        pairingCode?: string;
        qrcode?: { base64?: string; code?: string; pairingCode?: string };
      };

      const rawBase64 = data.base64 || data.qrcode?.base64 || "";
      const pairing = data.pairingCode || data.code || data.qrcode?.pairingCode || data.qrcode?.code || null;

      const formattedBase64 = rawBase64.startsWith("data:image")
        ? rawBase64
        : rawBase64.length > 0
        ? `data:image/png;base64,${rawBase64}`
        : null;

      return {
        instance_name: instanceName,
        status: "pending",
        qr_base64: formattedBase64,
        pairing_code: pairing,
        expires_in_seconds: 30,
      };
    } catch {
      return {
        instance_name: instanceName,
        status: "disconnected",
        qr_base64: null,
        pairing_code: null,
        expires_in_seconds: 0,
      };
    }
  }

  async getConnectionState(instanceName: string): Promise<EvolutionStateResult> {
    if (!this.apiUrl || !this.apiKey) {
      return {
        instance_name: instanceName,
        status: "connected",
        phone_number: "+201099887766",
        latency_ms: 110,
      };
    }

    try {
      const startTime = performance.now();
      const res = await fetch(`${this.apiUrl}/instance/connectionState/${instanceName}`, {
        headers: {
          apikey: this.apiKey,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(5000),
      });

      const latencyMs = Math.round(performance.now() - startTime);

      if (!res.ok) {
        return {
          instance_name: instanceName,
          status: "disconnected",
          latency_ms: latencyMs,
        };
      }

      const data = (await res.json()) as {
        instance?: { state?: string; phone?: string; phoneNumber?: string };
        state?: string;
      };

      const stateStr = (data.instance?.state || data.state || "").toLowerCase();
      let status: "connected" | "disconnected" | "connecting" = "disconnected";
      if (stateStr === "open") status = "connected";
      else if (stateStr === "connecting") status = "connecting";

      return {
        instance_name: instanceName,
        status,
        phone_number: data.instance?.phoneNumber || data.instance?.phone,
        latency_ms: latencyMs,
      };
    } catch {
      return {
        instance_name: instanceName,
        status: "disconnected",
      };
    }
  }

  async disconnectInstance(instanceName: string): Promise<boolean> {
    if (!this.apiUrl || !this.apiKey) {
      return true;
    }

    try {
      const res = await fetch(`${this.apiUrl}/instance/logout/${instanceName}`, {
        method: "DELETE",
        headers: {
          apikey: this.apiKey,
        },
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export class FakeEvolutionGateway implements IEvolutionGateway {
  private instances = new Map<
    string,
    {
      status: "connected" | "disconnected" | "connecting" | "pending";
      qr_base64: string | null;
      pairing_code: string | null;
      phone_number?: string;
    }
  >();

  constructor(
    initialData: Record<
      string,
      {
        status?: "connected" | "disconnected" | "connecting" | "pending";
        phone_number?: string;
      }
    > = {}
  ) {
    for (const [name, val] of Object.entries(initialData)) {
      this.instances.set(name, {
        status: val.status || "connected",
        qr_base64: null,
        pairing_code: null,
        phone_number: val.phone_number || "+201012345678",
      });
    }
  }

  setInstanceState(
    instanceName: string,
    status: "connected" | "disconnected" | "connecting" | "pending",
    phoneNumber?: string
  ): void {
    const existing = this.instances.get(instanceName) || {
      status,
      qr_base64: null,
      pairing_code: null,
    };
    existing.status = status;
    if (phoneNumber) existing.phone_number = phoneNumber;
    this.instances.set(instanceName, existing);
  }

  async getQrCode(instanceName: string): Promise<EvolutionQrResult> {
    const inst = this.instances.get(instanceName);
    if (inst && inst.status === "connected") {
      return {
        instance_name: instanceName,
        status: "connected",
        qr_base64: null,
        pairing_code: null,
        expires_in_seconds: 0,
      };
    }

    const mockQr =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const mockPairing = "CENTRLY-2026";
    this.instances.set(instanceName, {
      status: "pending",
      qr_base64: mockQr,
      pairing_code: mockPairing,
      phone_number: inst?.phone_number,
    });

    return {
      instance_name: instanceName,
      status: "pending",
      qr_base64: mockQr,
      pairing_code: mockPairing,
      expires_in_seconds: 30,
    };
  }

  async getConnectionState(instanceName: string): Promise<EvolutionStateResult> {
    const inst = this.instances.get(instanceName);
    const status =
      inst?.status === "connected"
        ? "connected"
        : inst?.status === "connecting"
        ? "connecting"
        : "disconnected";
    return {
      instance_name: instanceName,
      status,
      phone_number: inst?.phone_number || "+201012345678",
      latency_ms: 45,
    };
  }

  async disconnectInstance(instanceName: string): Promise<boolean> {
    this.instances.set(instanceName, {
      status: "disconnected",
      qr_base64: null,
      pairing_code: null,
    });
    return true;
  }
}
