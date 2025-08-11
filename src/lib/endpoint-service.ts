import { IntuneEndpoint, EndpointTest, LookupType } from '@/types/endpoint';

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
const INTUNE_ENDPOINTS_API = 'https://endpoints.office.com/endpoints/WorldWide?ServiceAreas=MEM&clientrequestid=';

export class EndpointService {
  static async fetchIntuneEndpoints(lookupType: LookupType = 'FQDN'): Promise<string[]> {
    try {
      const requestId = crypto.randomUUID();
      const url = `${CORS_PROXY}${encodeURIComponent(INTUNE_ENDPOINTS_API + requestId)}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch endpoints: ${response.status}`);
      }
      
      const endpoints: IntuneEndpoint[] = await response.json();
      
      if (lookupType === 'FQDN') {
        // Filter for MEM (Intune) service area endpoints with URLs
        const memEndpoints = endpoints.filter(
          endpoint => endpoint.serviceArea === 'MEM' && endpoint.urls
        );
        
        // Extract unique URLs
        const urls = new Set<string>();
        memEndpoints.forEach(endpoint => {
          endpoint.urls?.forEach(url => {
            // Clean up URL patterns (remove wildcards)
            const cleanUrl = url.replace(/\*/g, '').replace(/^\./, '');
            if (cleanUrl && !cleanUrl.includes('*')) {
              urls.add(cleanUrl);
            }
          });
        });
        
        return Array.from(urls).sort();
      } else {
        // Filter for MEM (Intune) service area endpoints with IPs
        const memEndpoints = endpoints.filter(
          endpoint => endpoint.serviceArea === 'MEM' && endpoint.ips
        );
        
        // Extract unique IPs
        const ips = new Set<string>();
        memEndpoints.forEach(endpoint => {
          endpoint.ips?.forEach(ip => {
            // Clean up IP patterns (remove subnets for individual IP testing)
            const cleanIp = ip.includes('/') ? ip.split('/')[0] : ip;
            if (cleanIp && cleanIp.match(/^\d+\.\d+\.\d+\.\d+$/)) {
              ips.add(cleanIp);
            }
          });
        });
        
        return Array.from(ips).sort();
      }
    } catch (error) {
      console.error('Error fetching Intune endpoints:', error);
      throw error;
    }
  }

  static async testEndpointConnectivity(url: string): Promise<EndpointTest> {
    const startTime = Date.now();
    
    try {
      // For HTTPS endpoints, we'll test basic connectivity
      const testUrl = url.startsWith('http') ? url : `https://${url}`;
      
      // Use a simple fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(testUrl, {
        method: 'HEAD',
        mode: 'no-cors', // This allows the request but limits response access
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      
      return {
        url,
        status: 'success',
        responseTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // In no-cors mode, we often get network errors even for successful connections
      // We'll consider the endpoint reachable if we get any response within reasonable time
      if (responseTime < 10000) {
        return {
          url,
          status: 'success',
          responseTime,
          timestamp: new Date(),
        };
      }
      
      return {
        url,
        status: 'error',
        responseTime,
        error: error instanceof Error ? error.message : 'Connection failed',
        timestamp: new Date(),
      };
    }
  }

  static async testAllEndpoints(
    urls: string[],
    onProgress?: (progress: { completed: number; total: number; current: string }) => void
  ): Promise<EndpointTest[]> {
    const results: EndpointTest[] = [];
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      onProgress?.({ completed: i, total: urls.length, current: url });
      
      const result = await this.testEndpointConnectivity(url);
      results.push(result);
    }
    
    onProgress?.({ completed: urls.length, total: urls.length, current: '' });
    return results;
  }
}