import { IntuneEndpoint, EndpointTest, LookupType } from '@/types/endpoint';
import { ProxyDetectionService } from '@/lib/proxy-detection';

// Use a reliable CORS proxy for endpoint fetching (but not for connectivity testing)
const CORS_PROXY = 'https://corsproxy.io/?';

export class EndpointService {
  static async fetchIntuneEndpoints(lookupType: LookupType = 'FQDN'): Promise<string[]> {
    const requestId = crypto.randomUUID();
    const apiUrl = `https://endpoints.office.com/endpoints/WorldWide?ServiceAreas=MEM&clientrequestid=${requestId}`;
    
    try {
      // Use CORS proxy for endpoint fetching since Microsoft API doesn't support CORS
      const proxiedUrl = `${CORS_PROXY}${encodeURIComponent(apiUrl)}`;
      console.log('Fetching endpoints from:', proxiedUrl);
      
      const response = await fetch(proxiedUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`CORS proxy returned ${response.status}: ${response.statusText}`);
      }
      
      const endpoints: IntuneEndpoint[] = await response.json();
      console.log('Retrieved endpoints:', endpoints.length);
      
      return this.extractEndpointsFromAPI(endpoints, lookupType);
      
    } catch (error) {
      console.error('Error fetching Intune endpoints:', error);
      throw new Error(`Failed to fetch endpoints: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static extractEndpointsFromAPI(endpoints: IntuneEndpoint[], lookupType: LookupType): string[] {
    console.log('Extracting endpoints for lookup type:', lookupType);
    
    if (lookupType === 'FQDN') {
      // Filter for MEM (Intune) service area endpoints with URLs
      const memEndpoints = endpoints.filter(
        endpoint => endpoint.serviceArea === 'MEM' && endpoint.urls && endpoint.urls.length > 0
      );
      
      console.log('MEM endpoints with URLs:', memEndpoints.length);
      
      const urls = new Set<string>();
      memEndpoints.forEach(endpoint => {
        endpoint.urls?.forEach(url => {
          // Clean up URL patterns (remove wildcards but keep valid domains)
          let cleanUrl = url.replace(/^\*\./, '').replace(/\*/g, '');
          if (cleanUrl && !cleanUrl.includes('*') && cleanUrl.includes('.')) {
            // Remove any protocol prefix
            cleanUrl = cleanUrl.replace(/^https?:\/\//, '');
            urls.add(cleanUrl);
          }
        });
      });
      
      console.log('Extracted unique FQDNs:', urls.size);
      
      if (urls.size === 0) {
        throw new Error('No valid FQDN endpoints found in Microsoft API response');
      }
      
      return Array.from(urls).sort();
    } else {
      // Filter for MEM (Intune) service area endpoints with IPs
      const memEndpoints = endpoints.filter(
        endpoint => endpoint.serviceArea === 'MEM' && endpoint.ips && endpoint.ips.length > 0
      );
      
      console.log('MEM endpoints with IPs:', memEndpoints.length);
      
      const ips = new Set<string>();
      memEndpoints.forEach(endpoint => {
        endpoint.ips?.forEach(ip => {
          // Extract individual IPs from CIDR notation
          const cleanIp = ip.includes('/') ? ip.split('/')[0] : ip;
          if (cleanIp && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanIp)) {
            ips.add(cleanIp);
          }
        });
      });
      
      console.log('Extracted unique IPs:', ips.size);
      
      if (ips.size === 0) {
        throw new Error('No valid IP endpoints found in Microsoft API response');
      }
      
      return Array.from(ips).sort();
    }
  }

  static async testEndpointConnectivity(endpoint: string, timeoutMs: number = 10000): Promise<EndpointTest> {
    const startTime = Date.now();
    
    try {
      // Determine if this is an IP address or FQDN
      const isIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(endpoint);

      // Identify explicit scheme (non-HTTP/HTTPS)
      const schemeMatch = endpoint.match(/^([a-zA-Z][\w+.-]*):/);
      const scheme = schemeMatch?.[1]?.toLowerCase();
      const isNonHttpScheme = !!scheme && scheme !== 'http' && scheme !== 'https';

      // Parse hostname to detect UDP-only known services (e.g., NTP)
      let hostname = '';
      try {
        const parsed = /^[a-zA-Z][\w+.-]*:\/\//.test(endpoint) ? new URL(endpoint) : new URL(`https://${endpoint}`);
        hostname = parsed.hostname.toLowerCase();
      } catch {}

      const schemeIsUdpish = !!scheme && ['stun', 'stuns', 'turn', 'turns', 'ntp', 'udp'].includes(scheme);
      const hintUdpInString = /(^|\b)(ntp|udp)(\b|:)/i.test(endpoint) || /:123(\b|$)/.test(endpoint);
      const isKnownUdpService = hostname.endsWith('time.windows.com');

      if (isNonHttpScheme || schemeIsUdpish || hintUdpInString || isKnownUdpService) {
        // Use WebRTC STUN/ICE to infer UDP reachability for UDP/non-HTTP(S) checks
        const webrtcStart = Date.now();
        try {
          const detection = await ProxyDetectionService.detectProxy();
          const responseTime = Date.now() - webrtcStart;

          if (!detection.webrtc?.supported) {
            return {
              url: endpoint,
              status: 'error',
              responseTime,
              error: 'WebRTC not supported in this browser (cannot run UDP/STUN test)',
              timestamp: new Date(),
              method: 'webrtc-stun',
            };
          }

          if (detection.webrtc.stunSucceeded) {
            return {
              url: endpoint,
              status: 'success',
              responseTime,
              timestamp: new Date(),
              method: 'webrtc-stun',
            };
          }

          return {
            url: endpoint,
            status: 'error',
            responseTime,
            error: detection.webrtc.relayOnly
              ? 'Only TURN relay observed (UDP restricted or strict NAT)'
              : 'STUN failed (UDP likely blocked)',
            timestamp: new Date(),
            method: 'webrtc-stun',
          };
        } catch (e) {
          const responseTime = Date.now() - webrtcStart;
          return {
            url: endpoint,
            status: 'error',
            responseTime,
            error: e instanceof Error ? e.message : 'STUN/ICE probe failed',
            timestamp: new Date(),
            method: 'webrtc-stun',
          };
        }
      }
      
      // For client-side testing, construct the test URL
      let testUrl: string;
      
      if (isIP) {
        // For IP addresses, try HTTPS first
        testUrl = `https://${endpoint}`;
      } else {
        // For FQDNs, add https if not present
        testUrl = endpoint.startsWith('http') ? endpoint : `https://${endpoint}`;
      }
      
      // Create abort controller with reasonable timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      try {
        // Attempt connection test - client-side only, no proxy
        await fetch(testUrl, {
          method: 'HEAD',
          mode: 'no-cors', // Required for cross-origin requests from client
          signal: controller.signal,
          cache: 'no-cache',
          redirect: 'follow'
        });
        
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;
        
        // In no-cors mode, successful completion often indicates connectivity
        return {
          url: endpoint,
          status: 'success',
          responseTime,
          timestamp: new Date(),
          method: 'http-head',
        };
        
      } catch (fetchError) {
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;
        
        // Handle specific error types for client-side testing
        if (fetchError instanceof Error) {
          // Timeout indicates unreachable endpoint
          if (fetchError.name === 'AbortError') {
            return {
              url: endpoint,
              status: 'error',
              responseTime,
              error: `Connection timeout (${timeoutMs / 1000}s)`,
              timestamp: new Date(),
              method: 'http-head',
            };
          }
          
          // In no-cors mode, many "network errors" actually indicate the endpoint responded
          // This is a limitation of browser security, but we can infer connectivity
          if (responseTime < (timeoutMs * 0.8) && (
            fetchError.message.includes('Failed to fetch') ||
            fetchError.message.includes('NetworkError') ||
            fetchError.message.includes('blocked by CORS') ||
            fetchError.message.includes('CORS')
          )) {
            return {
              url: endpoint,
              status: 'success',
              responseTime,
              timestamp: new Date(),
              method: 'http-head',
            };
          }
        }
        
        // Other errors indicate actual connectivity issues
        return {
          url: endpoint,
          status: 'error',
          responseTime,
          error: fetchError instanceof Error ? fetchError.message : 'Connection failed',
          timestamp: new Date(),
          method: 'http-head',
        };
      }
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        url: endpoint,
        status: 'error',
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        method: 'http-head',
      };
    }
  }

  static async testAllEndpoints(
    endpoints: string[],
    onProgress?: (progress: { completed: number; total: number; current: string }) => void,
    timeoutMs: number = 10000
  ): Promise<EndpointTest[]> {
    const results: EndpointTest[] = [];
    
    // Test endpoints in parallel batches for better performance
    const batchSize = 10; // Increased batch size for client-side testing
    
    for (let i = 0; i < endpoints.length; i += batchSize) {
      const batch = endpoints.slice(i, i + batchSize);
      
      // Test current batch in parallel
      const batchPromises = batch.map(async (endpoint, batchIndex) => {
        const globalIndex = i + batchIndex;
        onProgress?.({ completed: globalIndex, total: endpoints.length, current: endpoint });
        
        const result = await this.testEndpointConnectivity(endpoint, timeoutMs);
        
        // Update progress after each endpoint completes
        onProgress?.({ completed: globalIndex + 1, total: endpoints.length, current: endpoint });
        
        return result;
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Short pause between batches to avoid overwhelming the browser
      if (i + batchSize < endpoints.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    onProgress?.({ completed: endpoints.length, total: endpoints.length, current: '' });
    return results;
  }
}
