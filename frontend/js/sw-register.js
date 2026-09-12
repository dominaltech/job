/**
 * Dominal Technology Jobs - Service Worker Registration & PWA Install Manager
 * Handles network-first service worker lifecycle and native install prompts with iOS fallback.
 */

const PwaManager = (() => {
  let deferredInstallPrompt = null;
  let isAppInstalled = false;

  // Check if running in standalone mode (already installed)
  const isStandalone = () => {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://')
    );
  };

  // Detect iOS Safari
  const isIosSafari = () => {
    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isWebKit = /WebKit/i.test(ua);
    return isIos && isWebKit && !/CriOS|FxiOS|OPiOS|mercury/i.test(ua);
  };

  /**
   * Register Service Worker with automatic update listener
   */
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.log('[PWA] Service Worker not supported in this browser.');
      return;
    }

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js', { scope: './' })
        .then((registration) => {
          console.log('[PWA] Service Worker registered with scope:', registration.scope);

          // Listen for background updates
          registration.addEventListener('updatefound', () => {
            const installingWorker = registration.installing;
            if (!installingWorker) return;

            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content available, activate immediately
                installingWorker.postMessage({ action: 'skipWaiting' });
              }
            });
          });

          // Check for service worker updates every 30 minutes
          setInterval(() => {
            registration.update().catch(() => {});
          }, 30 * 60 * 1000);
        })
        .catch((error) => {
          console.warn('[PWA] Service Worker registration failed:', error);
        });

      // Reload window if the controller changes to fresh SW
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          // Silent refresh only if user triggered clearCache or on fresh load
          console.log('[PWA] Service worker updated to latest version.');
        }
      });
    });
  }

  /**
   * Setup PWA Install Listeners
   */
  function initInstallListeners() {
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent automatic mini-infobar
      e.preventDefault();
      deferredInstallPrompt = e;
      updateInstallButtonUI(true);
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      isAppInstalled = true;
      updateInstallButtonUI(false, true);
      console.log('[PWA] Dominal Technology Jobs app installed successfully.');
    });

    // Check initial standalone state
    if (isStandalone()) {
      isAppInstalled = true;
      updateInstallButtonUI(false, true);
    }
  }

  /**
   * Update install button state in the Settings page
   */
  function updateInstallButtonUI(canInstall, installed = false) {
    const installBtn = document.getElementById('btn-pwa-install');
    const installStatus = document.getElementById('pwa-install-status');

    if (!installBtn) return;

    if (installed || isStandalone()) {
      installBtn.disabled = true;
      installBtn.classList.add('btn-secondary');
      installBtn.innerHTML = `
        <svg class="svg-icon" viewBox="0 0 24 24"><use href="#icon-check-circle"></use></svg>
        <span>App Installed (Active)</span>
      `;
      if (installStatus) {
        installStatus.textContent = 'Dominal Jobs is currently running as an installed standalone application.';
      }
    } else if (canInstall && deferredInstallPrompt) {
      installBtn.disabled = false;
      installBtn.classList.remove('btn-secondary');
      installBtn.innerHTML = `
        <svg class="svg-icon" viewBox="0 0 24 24"><use href="#icon-download"></use></svg>
        <span>Install App on Device</span>
      `;
      if (installStatus) {
        installStatus.textContent = 'Install Dominal Jobs on your home screen for quick offline access and native experience.';
      }
    } else if (isIosSafari()) {
      installBtn.disabled = false;
      installBtn.innerHTML = `
        <svg class="svg-icon" viewBox="0 0 24 24"><use href="#icon-download"></use></svg>
        <span>Add to Home Screen (iOS)</span>
      `;
      if (installStatus) {
        installStatus.textContent = 'iOS Safari: Tap the Share button at bottom of Safari, then choose Add to Home Screen.';
      }
    } else {
      installBtn.disabled = false;
      installBtn.innerHTML = `
        <svg class="svg-icon" viewBox="0 0 24 24"><use href="#icon-download"></use></svg>
        <span>Install App / Shortcut</span>
      `;
      if (installStatus) {
        installStatus.textContent = 'Add Dominal Jobs to your device for instant launch and offline access.';
      }
    }
  }

  /**
   * Trigger the PWA installation prompt
   */
  async function promptInstall() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choiceResult = await deferredInstallPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted the install prompt');
        deferredInstallPrompt = null;
        updateInstallButtonUI(false, true);
      } else {
        console.log('[PWA] User dismissed the install prompt');
      }
    } else if (isIosSafari()) {
      // Show iOS modal guide
      const iosModal = document.getElementById('modal-ios-install');
      if (iosModal) {
        iosModal.classList.add('is-open');
      } else {
        alert("To install on iOS:\n1. Tap the Share button in Safari (box with up arrow)\n2. Scroll down and tap 'Add to Home Screen'\n3. Tap 'Add'");
      }
    } else {
      // General browser instructions
      alert("To install Dominal Jobs:\nOpen your browser menu (three dots) and tap 'Install app' or 'Add to Home screen'.");
    }
  }

  /**
   * Clear offline cache and re-fetch fresh data from network
   */
  async function clearOfflineCache() {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      console.log('[PWA] Offline cache cleared successfully.');
    }
    // Tell service worker if active
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ action: 'clearCache' });
    }
  }

  return {
    registerServiceWorker,
    initInstallListeners,
    promptInstall,
    clearOfflineCache,
    updateInstallButtonUI,
    isStandalone,
    isIosSafari
  };
})();
