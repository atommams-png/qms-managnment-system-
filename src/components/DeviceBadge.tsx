import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { getDeviceBadgeConfig } from '@/lib/deviceDetector';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Smartphone, Laptop, Tablet, AlertTriangle, Monitor, Cpu, Info, Layers } from 'lucide-react';

interface DeviceBadgeProps {
  deviceLabel?: string;
  deviceType?: string;
  deviceOs?: string;
  isDesktopMode?: boolean;
  deviceInfo?: any;
  showDetailsOnClick?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const DeviceBadge: React.FC<DeviceBadgeProps> = ({
  deviceLabel,
  deviceType,
  deviceOs,
  isDesktopMode,
  deviceInfo,
  showDetailsOnClick = true,
  className = '',
  size = 'md'
}) => {
  const [showModal, setShowModal] = useState(false);

  const rawInfo = typeof deviceInfo === 'string' ? (() => {
    try { return JSON.parse(deviceInfo); } catch { return null; }
  })() : deviceInfo;

  const resolvedLabel = deviceLabel || rawInfo?.deviceLabel || (
    isDesktopMode
      ? `${deviceOs || 'Mobile'} (Desktop Mode)`
      : `${deviceOs || deviceType || 'Desktop'}`
  );

  const resolvedOs = deviceOs || rawInfo?.os || '';
  const resolvedIsDesktopMode = Boolean(
    isDesktopMode ||
    rawInfo?.isDesktopMode ||
    resolvedLabel?.toLowerCase().includes('desktop mode')
  );

  const config = getDeviceBadgeConfig(resolvedLabel, resolvedIsDesktopMode, resolvedOs);

  const getIcon = () => {
    if (resolvedIsDesktopMode) return <AlertTriangle className="h-3 w-3 text-amber-600 animate-pulse shrink-0" />;
    if (resolvedLabel.includes('iPhone') || resolvedLabel.includes('Android') || resolvedLabel.includes('Mobile') || deviceType === 'mobile') {
      return <Smartphone className="h-3 w-3 text-emerald-600 shrink-0" />;
    }
    if (resolvedLabel.includes('iPad') || resolvedLabel.includes('Tablet') || deviceType === 'tablet') {
      return <Tablet className="h-3 w-3 text-indigo-600 shrink-0" />;
    }
    return <Laptop className="h-3 w-3 text-blue-600 shrink-0" />;
  };

  const handleClick = (e: React.MouseEvent) => {
    if (showDetailsOnClick && (rawInfo || resolvedLabel)) {
      e.stopPropagation();
      setShowModal(true);
    }
  };

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2'
  }[size];

  return (
    <>
      <span
        onClick={handleClick}
        title={`${config.description} (Click to view device hardware details)`}
        className={`inline-flex items-center font-medium rounded-full border shadow-2xs transition-all ${
          showDetailsOnClick ? 'cursor-pointer hover:shadow-xs hover:scale-[1.02]' : ''
        } ${config.bg} ${sizeClasses} ${className}`}
      >
        {getIcon()}
        <span className="font-semibold">{resolvedLabel || 'Unknown Device'}</span>
        {resolvedIsDesktopMode && (
          <span className="bg-amber-600 text-white font-bold text-[9px] px-1 rounded uppercase tracking-wider">
            Bypass Mode
          </span>
        )}
      </span>

      {showDetailsOnClick && (
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {getIcon()}
                <span>Device Fingerprint & Verification</span>
              </DialogTitle>
              <DialogDescription>
                Detailed hardware and browser telemetry captured during exam session.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2 text-sm">
              <div className={`p-3 rounded-lg border flex items-center justify-between ${config.bg}`}>
                <div>
                  <p className="text-xs text-muted-foreground">Detected Classification</p>
                  <p className="font-bold text-base">{resolvedLabel}</p>
                </div>
                {resolvedIsDesktopMode && (
                  <Badge variant="destructive" className="bg-amber-600 text-white hover:bg-amber-700">
                    Desktop Mode Spoofed
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted/50 p-2.5 rounded-lg border">
                  <span className="text-muted-foreground block">Operating System</span>
                  <span className="font-semibold text-gray-900">{resolvedOs || rawInfo?.os || 'Detected via heuristics'}</span>
                </div>
                <div className="bg-muted/50 p-2.5 rounded-lg border">
                  <span className="text-muted-foreground block">Browser</span>
                  <span className="font-semibold text-gray-900">{rawInfo?.browser || 'Web Browser'}</span>
                </div>
                <div className="bg-muted/50 p-2.5 rounded-lg border">
                  <span className="text-muted-foreground block">Screen Resolution</span>
                  <span className="font-semibold text-gray-900">
                    {rawInfo?.deviceDetails?.screenWidth && rawInfo?.deviceDetails?.screenHeight
                      ? `${rawInfo.deviceDetails.screenWidth} × ${rawInfo.deviceDetails.screenHeight} (DPR: ${rawInfo.deviceDetails.pixelRatio || 1})`
                      : rawInfo?.screenWidth
                      ? `${rawInfo.screenWidth} × ${rawInfo.screenHeight}`
                      : 'Standard'}
                  </span>
                </div>
                <div className="bg-muted/50 p-2.5 rounded-lg border">
                  <span className="text-muted-foreground block">Touchscreen Points</span>
                  <span className="font-semibold text-gray-900">
                    {rawInfo?.deviceDetails?.touchPoints ?? rawInfo?.touchPoints ?? (resolvedIsDesktopMode ? '> 1 (Multi-touch Mobile)' : '0 (Desktop/Laptop)')}
                  </span>
                </div>
              </div>

              {(rawInfo?.deviceDetails?.gpuRenderer || rawInfo?.gpuRenderer) && (
                <div className="bg-muted/40 p-2.5 rounded-lg border text-xs space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1 font-semibold">
                    <Cpu className="h-3 w-3" /> GPU Hardware Renderer:
                  </span>
                  <p className="font-mono text-[11px] text-gray-700 break-all">
                    {rawInfo?.deviceDetails?.gpuRenderer || rawInfo?.gpuRenderer}
                  </p>
                </div>
              )}

              {resolvedIsDesktopMode && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
                  <p className="font-bold flex items-center gap-1 text-amber-800">
                    <AlertTriangle className="h-3.5 w-3.5" /> Desktop Mode Detection Summary:
                  </p>
                  <p>
                    Student requested <strong>Desktop Version</strong> in their mobile browser settings. The system detected mobile touch coordinates, GPU chipset ({rawInfo?.deviceDetails?.gpuRenderer || 'Mobile GPU'}), and aspect ratios, verifying it is a mobile device.
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default DeviceBadge;
