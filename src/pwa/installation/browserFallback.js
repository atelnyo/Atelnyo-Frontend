/**
 * src/pwa/installation/browserFallback.js
 *
 * BROWSER FALLBACK — HOW to install Atelnyo through THIS browser's OWN
 * install mechanism. "No programmatic prompt" is NOT "cannot be
 * installed": most browsers expose an install action in their native UI
 * (address-bar icon, ⋮ menu, Share sheet, Apps menu…).
 *
 * The fallback is NEVER a single hard-coded message — this module
 * returns a structured description of the exact mechanism for a given
 * browser+platform combination:
 *
 *   {
 *     platform,     // 'ios' | 'android' | 'desktop'
 *     browser,      // BROWSERS bucket ('chrome' | 'edge' | …)
 *     method,       // copy key naming the mechanism (e.g. Share
 *                   // sheet, address-bar icon, ⋯ Apps menu)
 *     instructions, // copy keys for the step-by-step path
 *   }
 *
 * Different browsers get different wording AND different paths —
 * Android+Chrome → browser menu “Add to Home screen”, Android+
 * Samsung → three-line menu “Add page to”, Edge → ⋯ Apps menu,
 * macOS Safari → Share → Add to Dock, etc.
 *
 * ``getInstallationInstructions(browser, platform)`` returns null when
 * this browser genuinely has no install mechanism (Firefox desktop
 * stable, in-app webviews) — the UI then routes to the UNSUPPORTED
 * surface which suggests a capable browser.
 */
import {
  PLATFORMS,
  BROWSERS,
} from './installationTypes.js';

/**
 * Per-browser+platform instruction sets. Each entry describes the exact
 * user-visible install mechanism (``method``) and the steps (as copy
 * keys the UI renders). NEVER a single hard-coded message:
 *   • Android + Chrome        → browser menu → “Add to Home screen”
 *   • Android + Samsung       → three-line menu → “Add page to” → Home
 *   • iOS Safari              → Share sheet → “Add to Home Screen”
 *   • macOS Safari            → Share → “Add to Dock”
 *   • Chrome desktop          → address-bar icon → “Install page as app”
 *   • Edge desktop            → ⋯ menu → “Apps” → “Install this site…”
 *   • Opera desktop           → menu → “Install page as app…”
 *   • Firefox desktop         → (no entry) → genuinely no path
 */
const INSTRUCTION_SETS = {
  [PLATFORMS.IOS]: {
    [BROWSERS.SAFARI]: {
      method: 'methodShareSheet',
      steps: ['iosStep1', 'iosStep2', 'iosStep3'],
    },
  },
  [PLATFORMS.ANDROID]: {
    [BROWSERS.CHROME]: {
      method: 'methodBrowserMenu',
      steps: ['browserMenuStep1', 'browserMenuStep2', 'browserMenuStep3'],
    },
    [BROWSERS.SAMSUNG]: {
      method: 'methodSamsungMenu',
      steps: ['samsungStep1', 'samsungStep2', 'samsungStep3'],
    },
    [BROWSERS.EDGE]: {
      method: 'methodBrowserMenu',
      steps: ['browserMenuStep1', 'browserMenuStep2', 'browserMenuStep3'],
    },
  },
  [PLATFORMS.DESKTOP]: {
    [BROWSERS.CHROME]: {
      method: 'methodAddressBar',
      steps: ['desktopStep1', 'desktopStep2', 'desktopStep3'],
    },
    [BROWSERS.EDGE]: {
      method: 'methodAppsMenu',
      steps: ['edgeStep1', 'edgeStep2', 'edgeStep3'],
    },
    [BROWSERS.OPERA]: {
      method: 'methodBrowserMenu',
      steps: ['operaStep1', 'operaStep2', 'operaStep3'],
    },
    [BROWSERS.SAFARI]: {
      method: 'methodShareDock',
      steps: ['macStep1', 'macStep2', 'macStep3'],
    },
    // (No SAMSUNG entry — Samsung Internet is Android-only, covered above.)
  },
};

/** Platform-level default fallbacks for unrecognized browsers. */
const DEFAULT_INSTRUCTION_SET = {
  [PLATFORMS.IOS]: {
    method: 'methodShareSheet',
    steps: ['iosStep1', 'iosStep2', 'iosStep3'],
  },
  [PLATFORMS.ANDROID]: {
    method: 'methodBrowserMenu',
    steps: ['browserMenuStep1', 'browserMenuStep2', 'browserMenuStep3'],
  },
  [PLATFORMS.DESKTOP]: {
    method: 'methodBrowserMenu',
    steps: ['desktopStep1', 'desktopStep2', 'desktopStep3'],
  },
};

/**
 * Resolve the fallback instruction set for a browser+platform pair.
 *
 * Returns the structured description ({ platform, browser, method,
 * instructions }) or null when this browser genuinely has no install
 * mechanism (Firefox desktop stable, in-app webviews).
 */
export function getInstallationInstructions(browser, platform) {
  if (browser === BROWSERS.FIREFOX && platform === PLATFORMS.DESKTOP) {
    return null; // no native PWA install on Firefox stable
  }
  const set = (INSTRUCTION_SETS[platform] && INSTRUCTION_SETS[platform][browser])
    || DEFAULT_INSTRUCTION_SET[platform];
  if (!set) return null;
  return {
    platform,
    browser,
    method: set.method,
    instructions: set.steps.map((label) => ({ label })),
  };
}
