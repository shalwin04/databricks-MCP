import axios, { AxiosInstance } from "axios";
import { ClientTransport } from "@modelcontextprotocol/sdk/client/index.js";

export class HttpClientTransport implements ClientTransport {
  private axios: AxiosInstance;
  private url: string;

  constructor(url: string) {
    this.url = url;
    this.axios = axios.create({
      baseURL: url,
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });
  }

  async send(data: any): Promise<any> {
    // Send as JSON-RPC POST
    const response = await this.axios.post("", data);
    return response.data;
  }

  async close(): Promise<void> {
    // No persistent connection to close
    return;
  }
}
