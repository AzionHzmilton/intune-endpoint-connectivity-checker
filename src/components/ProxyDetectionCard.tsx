import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Shield, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { ProxyDetectionService, ProxyDetectionResult } from '@/lib/proxy-detection';

export const ProxyDetectionCard = () => {
  const [detection, setDetection] = useState<ProxyDetectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const runDetection = async () => {
    setIsLoading(true);
    try {
      const result = await ProxyDetectionService.detectProxy();
      setDetection(result);
    } catch (error) {
      console.error('Proxy detection failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runDetection();
  }, []);

  const getStatusIcon = () => {
    if (!detection) return <Shield className="h-4 w-4" />;
    
    if (detection.isProxyDetected) {
      return detection.confidence === 'high' ? 
        <AlertTriangle className="h-4 w-4 text-amber-500" /> :
        <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
    
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getConfidenceBadge = () => {
    if (!detection?.isProxyDetected) return null;
    
    const colorMap = {
      high: 'bg-red-500/10 text-red-500 border-red-500/20',
      medium: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      low: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
    };

    return (
      <Badge variant="outline" className={colorMap[detection.confidence]}>
        {detection.confidence} confidence
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <CardTitle className="text-sm font-medium">Proxy Detection</CardTitle>
        </div>
        <div className="flex items-center space-x-2">
          {getConfidenceBadge()}
          <Button
            variant="outline"
            size="sm"
            onClick={runDetection}
            disabled={isLoading}
            className="h-8 w-8 p-0"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Analyzing network configuration...</span>
          </div>
        ) : detection ? (
          <div className="space-y-3">
            <CardDescription>
              {detection.isProxyDetected 
                ? `Proxy usage detected with ${detection.confidence} confidence`
                : 'No proxy detected - direct connection'
              }
            </CardDescription>
            
            {detection.detectionMethods.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Detection Methods:</p>
                <div className="space-y-1">
                  {detection.detectionMethods.map((method, index) => (
                    <div key={index} className="text-xs text-muted-foreground flex items-center space-x-1">
                      <div className="w-1 h-1 bg-muted-foreground rounded-full" />
                      <span>{method}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detection.details.externalIP && (
              <div className="text-xs">
                <span className="font-medium text-muted-foreground">External IP: </span>
                <span className="font-mono">{detection.details.externalIP}</span>
              </div>
            )}

            {detection.details.localIPs && detection.details.localIPs.length > 0 && (
              <div className="text-xs">
                <span className="font-medium text-muted-foreground">Local IPs: </span>
                <span className="font-mono">{detection.details.localIPs.join(', ')}</span>
              </div>
            )}

            {Object.keys(detection.details.headers || {}).length > 0 && (
              <div className="text-xs">
                <p className="font-medium text-muted-foreground mb-1">Proxy Headers:</p>
                {Object.entries(detection.details.headers!).map(([key, value]) => (
                  <div key={key} className="font-mono text-xs">
                    <span className="text-muted-foreground">{key}:</span> {value}
                  </div>
                ))}
              </div>
            )}

            {detection.details.timing && (
              <div className="text-xs">
                <span className="font-medium text-muted-foreground">Network timing: </span>
                <span className="font-mono">{Math.round(detection.details.timing)}ms</span>
                <span className="text-muted-foreground ml-1">
                  ({detection.details.timing > 1000 ? 'slow response - possible proxy' : 'direct connection speed'})
                </span>
              </div>
            )}

            {detection.sslInspection && detection.sslInspection.details.length > 0 && (
              <div className="text-xs">
                <p className="font-medium text-muted-foreground mb-1">
                  SSL Inspection {detection.sslInspection.detected ? '(Detected)' : '(Tests)'}:
                </p>
                <div className="space-y-1">
                  {detection.sslInspection.details.map((detail, index) => (
                    <div key={index} className="text-xs text-muted-foreground flex items-center space-x-1">
                      <div className={`w-1 h-1 rounded-full ${detection.sslInspection?.detected ? 'bg-amber-500' : 'bg-muted-foreground'}`} />
                      <span>{detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detection.webrtc && (
              <div className="text-xs">
                <p className="font-medium text-muted-foreground mb-1">UDP via WebRTC (STUN):</p>
                <div className="space-y-1 text-muted-foreground">
                  <div>
                    Supported: <span className="font-mono">{detection.webrtc.supported ? 'yes' : 'no'}</span>
                  </div>
                  {detection.webrtc.supported && (
                    <>
                      <div>
                        STUN succeeded: <span className="font-mono">{detection.webrtc.stunSucceeded ? 'yes' : 'no'}</span>
                      </div>
                      <div>
                        Candidate types: <span className="font-mono">{detection.webrtc.candidateTypes.length ? detection.webrtc.candidateTypes.join(', ') : 'none'}</span>
                      </div>
                      <div>
                        Protocols: <span className="font-mono">{detection.webrtc.candidateProtocols.length ? detection.webrtc.candidateProtocols.join(', ') : 'none'}</span>
                      </div>
                      {detection.webrtc.relayOnly && (
                        <div className="text-xs">Only TURN relay observed (strict NAT or UDP restricted)</div>
                      )}
                      {detection.webrtc.details.map((d, i) => (
                        <div key={i} className="text-xs">{d}</div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}

            {detection.quic && (
              <div className="text-xs">
                <p className="font-medium text-muted-foreground mb-1">QUIC/WebTransport:</p>
                <div className="space-y-1 text-muted-foreground">
                  <div>
                    API supported: <span className="font-mono">{detection.quic.supported ? 'yes' : 'no'}</span>
                  </div>
                  {detection.quic.details.map((d, i) => (
                    <div key={i} className="text-xs">{d}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <CardDescription>Click refresh to check for proxy usage</CardDescription>
        )}
      </CardContent>
    </Card>
  );
};