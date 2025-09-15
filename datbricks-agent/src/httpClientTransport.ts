import axios, { AxiosInstance } from "axios";

export class HttpClientTransport {
  async start(): Promise<void> {
    // No-op for HTTP transport
    return;
  }
  private axios: AxiosInstance;

  constructor(url: string) {
    this.axios = axios.create({
      baseURL: url,
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });
  }

  async send(data: Record<string, unknown>): Promise<void> {
    // Send as JSON-RPC POST
    await this.axios.post("", data);
    // Response is handled by MCP Client
    return;
  }

  async close(): Promise<void> {
    // No persistent connection to close
    return;
  }
}
