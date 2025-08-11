export interface MicrosoftEndpoint {
  id: number;
  serviceArea: string;
  serviceAreaDisplayName: string;
  urls?: string[];
  ips?: string[];
  tcpPorts?: string;
  udpPorts?: string;
  expressRoute?: boolean;
  category: string;
  required?: boolean;
  notes?: string;
}

export interface EndpointTest {
  url: string;
  status: 'pending' | 'testing' | 'success' | 'error';
  responseTime?: number;
  error?: string;
  timestamp?: Date;
}

export interface TestStats {
  total: number;
  tested: number;
  successful: number;
  failed: number;
  pending: number;
}