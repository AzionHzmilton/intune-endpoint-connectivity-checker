export interface IntuneEndpoint {
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
  method?: 'http-head' | 'http-head-https' | 'http-head-http' | 'webrtc-stun';
}

export interface TestStats {
  total: number;
  tested: number;
  successful: number;
  failed: number;
  pending: number;
}

export type LookupType = 'FQDN' | 'IP';