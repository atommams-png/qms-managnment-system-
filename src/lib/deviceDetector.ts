// ============================================================
// ATOM QMS - ADVANCED DEVICE DETECTION SYSTEM
// ============================================================
// Accurately detects:
// 1. Android Mobile (Normal)
// 2. Android Mobile in Desktop Mode ("Request Desktop Site" enabled)
// 3. iPhone (Normal)
// 4. iPhone in Desktop Mode ("Request Desktop Website" enabled)
// 5. iPad (Normal & Desktop Mode)
// 6. Android Tablet (Normal & Desktop Mode)
// 7. Laptop / Desktop (Windows, macOS, Linux, ChromeOS)
// ============================================================

export type DeviceCategory = 'mobile' | 'desktop' | 'tablet' | 'unknown';
export type DeviceOS = 'Android' | 'iOS' | 'Windows' | 'macOS' | 'Linux' | 'ChromeOS' | 'Unknown';
export type DeviceBrowser = 'Chrome' | 'Safari' | 'Firefox' | 'Edge' | 'Opera' | 'Samsung Internet' | 'UC Browser' | 'Brave' | 'Unknown';

export interface DeviceInfo {
  deviceType: DeviceCategory;
  os: DeviceOS;
  browser: DeviceBrowser;
  isDesktopMode: boolean; // True if mobile/tablet running in Desktop Site mode
  isMobile: boolean;      // True if physically mobile or tablet
  deviceLabel: string;    // Clean display name (e.g. "Android (Desktop Mode)", "iPhone (Mobile Mode)", "Laptop (Windows)")
  deviceDetails: {
    platform: string;
    userAgent: string;
    screenWidth: number;
    screenHeight: number;
    windowWidth: number;
    windowHeight: number;
    pixelRatio: number;
    touchPoints: number;
    hasTouch: boolean;
    pointerCoarse: boolean;
    hoverNone: boolean;
    orientation: string;
    gpuRenderer: string;
    gpuVendor: string;
    clientHints?: any;
    detectedAt: string;
  };
}

/**
 * Extract WebGL GPU information safely
 */
function getWebGlInfo(): { renderer: string; vendor: string } {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return { renderer: '', vendor: '' };

    const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) {
      const renderer = (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).RENDERER) || '';
      const vendor = (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).VENDOR) || '';
      return { renderer: String(renderer), vendor: String(vendor) };
    }

    const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
    const vendor = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
    return { renderer: String(renderer), vendor: String(vendor) };
  } catch {
    return { renderer: '', vendor: '' };
  }
}

/**
 * Check if the GPU renderer belongs to a mobile chipset
 */
function isMobileGpu(renderer: string, vendor: string): { isMobileGpu: boolean; isAndroidGpu: boolean; isAppleGpu: boolean } {
  const r = (renderer + ' ' + vendor).toLowerCase();

  // Qualcomm Adreno (Snapdragon), ARM Mali (MediaTek/Exynos), PowerVR (MediaTek/Unisoc), Immortalis, Xclipse (Samsung)
  const isAndroidGpu = (
    r.includes('adreno') ||
    r.includes('mali') ||
    r.includes('powervr') ||
    r.includes('immortalis') ||
    r.includes('xclipse') ||
    r.includes('vivante') ||
    r.includes('videocore') ||
    r.includes('qualcomm')
  );

  // Apple mobile GPU
  const isAppleGpu = (
    r.includes('apple') && (
      r.includes('a1') || r.includes('a2') || r.includes('a3') || r.includes('a4') ||
      r.includes('a5') || r.includes('a6') || r.includes('a7') || r.includes('a8') ||
      r.includes('a9') || r.includes('a10') || r.includes('a11') || r.includes('a12') ||
      r.includes('a13') || r.includes('a14') || r.includes('a15') || r.includes('a16') ||
      r.includes('a17') || r.includes('a18') || r.includes('apple gpu')
    )
  );

  return {
    isMobileGpu: isAndroidGpu || isAppleGpu,
    isAndroidGpu,
    isAppleGpu
  };
}

/**
 * Detect browser name from User Agent and navigator
 */
function detectBrowser(ua: string): DeviceBrowser {
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
  if (/UCBrowser|UCWEB/i.test(ua)) return 'UC Browser';
  if (/Edg|Edge|EdgA|EdgiOS/i.test(ua)) return 'Edge';
  if (/OPR|Opera|OPT/i.test(ua)) return 'Opera';
  if (/Brave/i.test(ua) || (typeof (navigator as any).brave !== 'undefined')) return 'Brave';
  if (/Firefox|FxiOS/i.test(ua)) return 'Firefox';
  if (/CriOS|Chrome/i.test(ua)) return 'Chrome';
  if (/Safari/i.test(ua) && !/Chrome|CriOS/i.test(ua)) return 'Safari';
  return 'Unknown';
}

/**
 * Synchronous Comprehensive Device Detection
 */
export function detectDevice(): DeviceInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      deviceType: 'unknown',
      os: 'Unknown',
      browser: 'Unknown',
      isDesktopMode: false,
      isMobile: false,
      deviceLabel: 'Unknown Device',
      deviceDetails: {
        platform: '',
        userAgent: '',
        screenWidth: 0,
        screenHeight: 0,
        windowWidth: 0,
        windowHeight: 0,
        pixelRatio: 1,
        touchPoints: 0,
        hasTouch: false,
        pointerCoarse: false,
        hoverNone: false,
        orientation: '',
        gpuRenderer: '',
        gpuVendor: '',
        detectedAt: new Date().toISOString()
      }
    };
  }

  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const hasTouch = 'ontouchstart' in window || maxTouchPoints > 0;
  
  // Media queries
  const pointerCoarse = window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
  const pointerFine = window.matchMedia ? window.matchMedia('(pointer: fine)').matches : false;
  const hoverNone = window.matchMedia ? window.matchMedia('(hover: none)').matches : false;
  const hoverHover = window.matchMedia ? window.matchMedia('(hover: hover)').matches : false;

  const screenWidth = window.screen?.width || window.innerWidth || 0;
  const screenHeight = window.screen?.height || window.innerHeight || 0;
  const minDimension = Math.min(screenWidth, screenHeight);
  const maxDimension = Math.max(screenWidth, screenHeight);
  const pixelRatio = window.devicePixelRatio || 1;
  const orientation = (window.screen?.orientation?.type) || (minDimension === screenWidth ? 'portrait' : 'landscape');

  const { renderer: gpuRenderer, vendor: gpuVendor } = getWebGlInfo();
  const { isMobileGpu: hasMobileGpu, isAndroidGpu, isAppleGpu } = isMobileGpu(gpuRenderer, gpuVendor);
  const browser = detectBrowser(ua);

  // Client hints check if present synchronously
  const uaData = (navigator as any).userAgentData;
  const uaDataPlatform = uaData?.platform || '';
  const uaDataMobile = typeof uaData?.mobile === 'boolean' ? uaData.mobile : null;

  // Flags for analysis
  let deviceType: DeviceCategory = 'desktop';
  let os: DeviceOS = 'Unknown';
  let isDesktopMode = false;
  let isMobile = false;
  let deviceLabel = 'Laptop / Desktop';

  // ============================================================
  // 1. DIRECT ANDROID DETECTION (Mobile Mode)
  // ============================================================
  if (/Android/i.test(ua) || uaDataPlatform === 'Android') {
    isMobile = true;
    os = 'Android';
    if (/Mobile/i.test(ua) || minDimension < 600) {
      deviceType = 'mobile';
      deviceLabel = 'Android (Mobile Mode)';
    } else {
      deviceType = 'tablet';
      deviceLabel = 'Android Tablet (Mobile Mode)';
    }
  }
  // ============================================================
  // 2. DIRECT IPHONE / IPAD DETECTION (Mobile Mode)
  // ============================================================
  else if (/iPhone/i.test(ua)) {
    isMobile = true;
    os = 'iOS';
    deviceType = 'mobile';
    deviceLabel = 'iPhone (Mobile Mode)';
  }
  else if (/iPad/i.test(ua) || (/iPod/i.test(ua))) {
    isMobile = true;
    os = 'iOS';
    deviceType = 'tablet';
    deviceLabel = 'iPad (Mobile Mode)';
  }
  // ============================================================
  // 3. IPHONE / IPAD IN DESKTOP MODE
  // ============================================================
  // When iPhone / iPad requests desktop site, Safari / Chrome changes UA to "Macintosh; Intel Mac OS X ..."
  // and platform to "MacIntel".
  // BUT: Real Macs NEVER have touchscreens (maxTouchPoints = 0, no ontouchstart).
  // On iOS, maxTouchPoints > 1 (usually 5) and 'ontouchstart' is in window!
  else if (/Macintosh|Mac OS X/i.test(ua) || platform === 'MacIntel' || platform === 'Macintosh') {
    if (maxTouchPoints > 1 || (hasTouch && (pointerCoarse || hoverNone))) {
      // It is an Apple mobile / tablet device masquerading as a Mac desktop!
      isMobile = true;
      isDesktopMode = true;
      os = 'iOS';

      // Distinguish iPhone vs iPad by physical screen dimensions / aspect ratio
      const aspectRatio = maxDimension / (minDimension || 1);
      // iPhones have long aspect ratio (>= 1.8 e.g. 19.5:9, 16:9), iPads are ~ 4:3 (1.33 to 1.45)
      // Also physical width on iPhone is usually <= 480 CSS points
      if (minDimension <= 480 || aspectRatio >= 1.75) {
        deviceType = 'mobile';
        deviceLabel = 'iPhone (Desktop Mode)';
      } else {
        deviceType = 'tablet';
        deviceLabel = 'iPad (Desktop Mode)';
      }
    } else {
      // Real Mac computer
      deviceType = 'desktop';
      os = 'macOS';
      isMobile = false;
      isDesktopMode = false;
      deviceLabel = 'Laptop / Desktop (macOS)';
    }
  }
  // ============================================================
  // 4. ANDROID IN DESKTOP MODE
  // ============================================================
  // When Android Chrome / Samsung Browser requests desktop site:
  // UA changes to "X11; Linux x86_64" or "Windows NT 10.0" without "Android" or "Mobile".
  // BUT:
  // - GPU renderer is Adreno / Mali / PowerVR / Immortalis / Xclipse
  // - maxTouchPoints > 0 with pointerCoarse or hoverNone
  // - client hints may reveal Android
  // - platform is often Linux armv8l / aarch64
  else if (
    isAndroidGpu ||
    (hasMobileGpu && hasTouch) ||
    uaDataPlatform === 'Android' ||
    (/Linux/i.test(platform) && hasTouch && (pointerCoarse || hoverNone) && maxTouchPoints > 0) ||
    (/Linux/i.test(ua) && hasTouch && isAndroidGpu) ||
    (/Windows NT/i.test(ua) && isAndroidGpu)
  ) {
    isMobile = true;
    isDesktopMode = true;
    os = 'Android';

    if (minDimension < 600) {
      deviceType = 'mobile';
      deviceLabel = 'Android (Desktop Mode)';
    } else {
      deviceType = 'tablet';
      deviceLabel = 'Android Tablet (Desktop Mode)';
    }
  }
  // ============================================================
  // 5. WINDOWS PC / LAPTOP
  // ============================================================
  else if (/Windows NT|Win64|Win32/i.test(ua) || platform.startsWith('Win')) {
    deviceType = 'desktop';
    os = 'Windows';
    isMobile = false;
    isDesktopMode = false;
    deviceLabel = 'Laptop / Desktop (Windows)';
  }
  // ============================================================
  // 6. LINUX PC / LAPTOP
  // ============================================================
  else if (/Linux/i.test(ua) || /Linux/i.test(platform)) {
    // Check if it's ChromeOS
    if (/CrOS/i.test(ua)) {
      deviceType = 'desktop';
      os = 'ChromeOS';
      isMobile = false;
      isDesktopMode = false;
      deviceLabel = 'Laptop / Desktop (ChromeOS)';
    } else {
      // If Linux has high touch points and coarse pointer and mobile GPU, could be Android
      if (hasTouch && (pointerCoarse || hoverNone) && maxTouchPoints >= 5) {
        isMobile = true;
        isDesktopMode = true;
        os = 'Android';
        deviceType = 'mobile';
        deviceLabel = 'Android (Desktop Mode)';
      } else {
        deviceType = 'desktop';
        os = 'Linux';
        isMobile = false;
        isDesktopMode = false;
        deviceLabel = 'Laptop / Desktop (Linux)';
      }
    }
  }
  // ============================================================
  // 7. FALLBACK WITH TOUCH / SCREEN METRICS
  // ============================================================
  else {
    if (hasTouch && pointerCoarse && minDimension < 600) {
      isMobile = true;
      deviceType = 'mobile';
      deviceLabel = 'Mobile Device';
    } else {
      deviceType = 'desktop';
      deviceLabel = 'Laptop / Desktop';
    }
  }

  return {
    deviceType,
    os,
    browser,
    isDesktopMode,
    isMobile,
    deviceLabel,
    deviceDetails: {
      platform,
      userAgent: ua,
      screenWidth,
      screenHeight,
      windowWidth: window.innerWidth || 0,
      windowHeight: window.innerHeight || 0,
      pixelRatio,
      touchPoints: maxTouchPoints,
      hasTouch,
      pointerCoarse,
      hoverNone,
      orientation,
      gpuRenderer,
      gpuVendor,
      clientHints: uaData ? { platform: uaData.platform, mobile: uaData.mobile } : undefined,
      detectedAt: new Date().toISOString()
    }
  };
}

/**
 * Async Device Detection (with High Entropy Client Hints if available)
 */
export async function detectDeviceAsync(): Promise<DeviceInfo> {
  const initial = detectDevice();

  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return initial;
  }

  try {
    const uaData = (navigator as any).userAgentData;
    if (uaData && typeof uaData.getHighEntropyValues === 'function') {
      const hints = await uaData.getHighEntropyValues([
        'platform',
        'platformVersion',
        'architecture',
        'model',
        'mobile',
        'bitness'
      ]);

      const clientPlatform = String(hints.platform || '');
      const clientModel = String(hints.model || '');
      const isMobileHint = Boolean(hints.mobile);

      // If hints report Android platform or a known phone model while UA looked like Linux or Windows
      if (clientPlatform.toLowerCase() === 'android' || clientModel.length > 0 && !clientPlatform.toLowerCase().includes('windows')) {
        const isDesktopMode = !isMobileHint || initial.isDesktopMode || !/Android/i.test(navigator.userAgent);
        const minDim = Math.min(window.screen?.width || 0, window.screen?.height || 0);
        const isTablet = minDim >= 600;

        return {
          ...initial,
          os: 'Android',
          isMobile: true,
          isDesktopMode,
          deviceType: isTablet ? 'tablet' : 'mobile',
          deviceLabel: isTablet
            ? (isDesktopMode ? 'Android Tablet (Desktop Mode)' : 'Android Tablet (Mobile Mode)')
            : (isDesktopMode ? 'Android (Desktop Mode)' : 'Android (Mobile Mode)'),
          deviceDetails: {
            ...initial.deviceDetails,
            clientHints: hints
          }
        };
      }
    }
  } catch {
    // Ignore client hints failure, fallback to sync detection
  }

  return initial;
}

/**
 * Returns badge styling and icon color for a given device label / state
 */
export function getDeviceBadgeConfig(deviceLabel?: string, isDesktopMode?: boolean, os?: string) {
  const label = deviceLabel || '';

  if (label.includes('Android (Desktop Mode)') || (isDesktopMode && os === 'Android')) {
    return {
      bg: 'bg-amber-100 text-amber-900 border-amber-300',
      tagBg: 'bg-amber-600 text-white',
      icon: '⚡',
      shortLabel: 'Android (Desktop)',
      isWarning: true,
      description: 'Android device running in "Desktop Site" mode'
    };
  }

  if (label.includes('iPhone (Desktop Mode)') || (isDesktopMode && os === 'iOS')) {
    return {
      bg: 'bg-orange-100 text-orange-900 border-orange-300',
      tagBg: 'bg-orange-600 text-white',
      icon: '⚡',
      shortLabel: 'iPhone (Desktop)',
      isWarning: true,
      description: 'iPhone device running in "Desktop Website" mode'
    };
  }

  if (label.includes('iPad (Desktop Mode)')) {
    return {
      bg: 'bg-orange-100 text-orange-900 border-orange-300',
      tagBg: 'bg-orange-600 text-white',
      icon: '⚡',
      shortLabel: 'iPad (Desktop)',
      isWarning: false,
      description: 'iPad tablet in Desktop Website mode'
    };
  }

  if (label.includes('Android') || os === 'Android') {
    return {
      bg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      tagBg: 'bg-emerald-600 text-white',
      icon: '📱',
      shortLabel: 'Android Mobile',
      isWarning: false,
      description: 'Android Mobile Device'
    };
  }

  if (label.includes('iPhone') || os === 'iOS') {
    return {
      bg: 'bg-sky-100 text-sky-900 border-sky-300',
      tagBg: 'bg-sky-600 text-white',
      icon: '🍎',
      shortLabel: 'iPhone Mobile',
      isWarning: false,
      description: 'iPhone Mobile Device'
    };
  }

  if (label.includes('iPad') || label.includes('Tablet')) {
    return {
      bg: 'bg-indigo-100 text-indigo-900 border-indigo-300',
      tagBg: 'bg-indigo-600 text-white',
      icon: '📱',
      shortLabel: 'Tablet',
      isWarning: false,
      description: 'Tablet Device'
    };
  }

  if (label.includes('macOS') || os === 'macOS') {
    return {
      bg: 'bg-slate-100 text-slate-900 border-slate-300',
      tagBg: 'bg-slate-700 text-white',
      icon: '💻',
      shortLabel: 'Mac (Laptop/PC)',
      isWarning: false,
      description: 'Apple Mac Laptop / Desktop'
    };
  }

  if (label.includes('Windows') || os === 'Windows') {
    return {
      bg: 'bg-blue-100 text-blue-900 border-blue-300',
      tagBg: 'bg-blue-600 text-white',
      icon: '💻',
      shortLabel: 'Windows (Laptop/PC)',
      isWarning: false,
      description: 'Windows Laptop / Desktop'
    };
  }

  if (label.includes('Linux') || os === 'Linux') {
    return {
      bg: 'bg-purple-100 text-purple-900 border-purple-300',
      tagBg: 'bg-purple-600 text-white',
      icon: '💻',
      shortLabel: 'Linux (Laptop/PC)',
      isWarning: false,
      description: 'Linux Laptop / Desktop'
    };
  }

  return {
    bg: 'bg-gray-100 text-gray-800 border-gray-300',
    tagBg: 'bg-gray-600 text-white',
    icon: '💻',
    shortLabel: label || 'Laptop / Desktop',
    isWarning: false,
    description: label || 'Desktop / Laptop'
  };
}
