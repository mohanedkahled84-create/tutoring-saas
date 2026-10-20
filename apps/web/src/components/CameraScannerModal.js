import { escapeHtml } from '../utils/escapeHtml.js';
import { getIcon } from '../utils/icons.js';
import { playBeep, unlockAudio } from '../utils/beepAudio.js';

/**
 * Camera Scanner & Audio Feedback Suite (DEV-SCAN)
 * Extracted from app.js monolith for clean modular architecture.
 */
export function registerCameraScannerActions(app) {
  // ==========================================================================
  // Audio Feedback & Hardware / Camera Scanner Suite (DEV-SCAN)
  // ==========================================================================

  app.playScanBeep = function(type = 'success') {
    playBeep(type);
  }

  app.openCameraScannerModal = function(mode = 'session') {
    unlockAudio();
    const existing = document.getElementById('cameraScannerModal');
    if (existing) existing.remove();

    this._cameraScanCount = 0;
    this._cameraFacingMode = this._cameraFacingMode || 'environment';
    this._cameraTorchOn = false;
    this._cameraZoomLevel = 1.0;

    const modeTitle = mode === 'center' 
      ? 'بوابة استقبال السنتر (توجيه وحضور عام)' 
      : 'تسجيل حضور الحصة الجارية';

    const modalHtml = `
      <div id="cameraScannerModal" class="modal-overlay" style="display: flex; position: fixed; inset: 0; background: rgba(15,23,42,0.75); backdrop-filter: blur(4px); align-items: center; justify-content: center; z-index: 9999; padding: 0.75rem;" dir="rtl">
        <div class="card" style="width: 100%; max-width: 480px; margin: 0; padding: 1.1rem; border-radius: 16px; background: #ffffff; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3); font-family: 'Cairo', sans-serif; max-height: calc(100dvh - 1.5rem); overflow-y: auto;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; border-bottom: 1px solid var(--centrly-line); padding-bottom: 0.65rem;">
            <div>
              <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--centrly-ink); display: flex; align-items: center; gap: 0.4rem;">
                ${getIcon('camera', 20, 'var(--centrly-blue-700)')}
                <span>المسح الفوري بكاميرا الموبايل / اللابتوب</span>
              </h3>
              <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.15rem; font-weight: 600;">
                ${modeTitle}
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.closeCameraScannerModal()" style="border: none; cursor: pointer; padding: 0.35rem 0.6rem; display: flex; align-items: center;">${getIcon('close', 16, '#64748b')}</button>
          </div>

          <!-- Camera Viewport Container -->
          <div style="position: relative; width: 100%; border-radius: 12px; overflow: hidden; background: #0f172a; border: 2px solid #334155; min-height: 250px;">
            <div id="centrlyCameraViewport" style="width: 100%; min-height: 250px;"></div>

            <!-- Target Reticle Box overlay with animated laser line -->
            <div style="pointer-events: none; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
              <div style="width: 86%; max-width: 310px; height: 125px; border: 2.5px solid #10b981; border-radius: 12px; box-shadow: 0 0 0 9999px rgba(15,23,42,0.52); position: relative; overflow: hidden;">
                <div class="scanner-laser-line"></div>
                <div style="position: absolute; top: -26px; left: 0; right: 0; text-align: center; color: #6ee7b7; font-size: 0.75rem; font-weight: 800; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">
                  وجّه الخط الأخضر أفقياً على كود الباركود
                </div>
              </div>
            </div>

            <!-- Live Status & Feedback Banner inside camera -->
            <div id="cameraScanFeedback" style="display: none; position: absolute; bottom: 12px; left: 12px; right: 12px; z-index: 20; padding: 0.65rem; border-radius: 8px; font-weight: 800; font-size: 0.85rem; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: all 0.2s ease;"></div>
          </div>

          <!-- Controls and Counter -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--centrly-text);">
              تم تسجيل: <strong id="cameraScanCount" style="color: #16a34a; font-size: 1.05rem;">0</strong> طلاب
            </div>

            <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; align-items: center;">
              <button type="button" id="cameraSnapBtn" class="btn btn-primary btn-sm" onclick="window.centrlyApp.captureHighResFrameAndScan('${mode}')" style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.78rem; font-weight: 800; background: #059669; border-color: #059669; color: #fff; box-shadow: 0 2px 4px rgba(5,150,105,0.25);" title="التقاط فوري للصورة ومسح الباركود بأعلى دقة">
                ${getIcon('camera', 13, '#fff')}
                <span>مسح فوري</span>
              </button>
              <input type="file" id="cameraBarcodeFileInput" accept="image/*" capture="environment" style="display: none;" onchange="window.centrlyApp.handleBarcodeFileScan(this.files[0], '${mode}')">
              <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('cameraBarcodeFileInput').click()" style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.78rem; font-weight: 700;" title="اختيار صورة كارت الطالب أو التقاط صورة بكاميرا الهاتف">
                ${getIcon('upload', 13)}
                <span>صورة الكارت</span>
              </button>
              <button type="button" id="cameraZoomBtn" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.toggleCameraZoom()" style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.78rem; font-weight: 700;" title="تكبير الكاميرا للقراءة عن بعد بدون تقريب الهاتف">
                ${getIcon('search', 13)}
                <span id="cameraZoomBtnText">1x</span>
              </button>
              <button type="button" id="cameraTorchBtn" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.toggleCameraTorch()" style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.78rem; font-weight: 700;" title="تشغيل الكشاف للإضاءة الضعيفة">
                ${getIcon('lightbulb', 13)}
                <span id="cameraTorchBtnText">الفلاش</span>
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.toggleCameraFacingMode('${mode}')" style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.78rem; font-weight: 700;">
                ${getIcon('refresh', 13)}
                <span>تبديل</span>
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.closeCameraScannerModal()" style="font-size: 0.78rem; font-weight: 700;">
                إغلاق
              </button>
            </div>
          </div>

          <!-- Quick Tip for Lightning Fast Barcode Scanning -->
          <div style="margin-top: 0.75rem; font-size: 0.75rem; color: #475569; background: #f8fafc; padding: 0.6rem 0.8rem; border-radius: 8px; border: 1px solid #e2e8f0; line-height: 1.5;">
            <div style="font-weight: 800; color: #1e293b; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.35rem;">
              ${getIcon('lightbulb', 14, '#f59e0b')}
              <span>نصائح للمسح الفوري خلال ثانية واحدة:</span>
            </div>
            <ul style="margin: 0; padding-right: 1.2rem; display: flex; flex-direction: column; gap: 0.2rem;">
              <li>اجعل خطوط الباركود موازية أفقياً لخط الليزر الأخضر.</li>
              <li>أمسك الموبايل على مسافة 15-20 سم ولا تقترب جداً لتفادي ضبابية العدسة.</li>
              <li>في القاعات خافتة الإضاءة، اضغط على زر <b>الفلاش</b> لتوضيح الخطوط فورياً.</li>
            </ul>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    setTimeout(() => {
      this.startCameraScanner(mode);
    }, 100);
  }

  app.ensureHtml5QrcodeLoaded = async function() {
    if (typeof Html5Qrcode !== 'undefined') return true;
    const sources = [
      '/apps/web/src/vendor/html5-qrcode.min.js',
      '/src/vendor/html5-qrcode.min.js',
      './src/vendor/html5-qrcode.min.js',
      'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js'
    ];

    for (const src of sources) {
      if (typeof Html5Qrcode !== 'undefined') return true;
      const loaded = await new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve(true);
        script.onerror = () => {
          script.remove();
          resolve(false);
        };
        document.head.appendChild(script);
      });
      if (loaded && typeof Html5Qrcode !== 'undefined') return true;
    }

    return typeof Html5Qrcode !== 'undefined';
  }

  app.startCameraScanner = async function(mode = 'session') {
    unlockAudio();
    const viewport = document.getElementById('centrlyCameraViewport');
    if (typeof Html5Qrcode === 'undefined') {
      if (viewport) {
        viewport.innerHTML = `
          <div style="color: #cbd5e1; padding: 3rem 1rem; text-align: center; font-size: 0.9rem;">
            جارٍ تجهيز الكاميرا ومكتبة المسح...
          </div>
        `;
      }
      await this.ensureHtml5QrcodeLoaded();
    }

    if (typeof Html5Qrcode === 'undefined') {
      if (viewport) {
        viewport.innerHTML = `
          <div style="color: #f87171; padding: 2.5rem 1rem; text-align: center; font-size: 0.88rem; line-height: 1.6;">
            <div style="display: flex; justify-content: center; margin-bottom: 0.5rem;">${getIcon('alertTriangle', 32, '#ef4444')}</div>
            <strong>تعذر تحميل قارئ الباركود:</strong><br>
            يرجى التأكد من اتصال الإنترنت ثم إعادة المحاولة.<br><br>
            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.startCameraScanner('${mode}')" style="margin: 0 auto; display: inline-flex; align-items: center; gap: 0.3rem;">
              ${getIcon('refresh', 14)} إعادة المحاولة
            </button>
          </div>
        `;
      }
      return;
    }

    try {
      if (this._activeHtml5QrCode) {
        await this._activeHtml5QrCode.stop().catch(() => {});
        this._activeHtml5QrCode = null;
      }
      if (this._nativeBarcodeInterval) {
        clearInterval(this._nativeBarcodeInterval);
        this._nativeBarcodeInterval = null;
      }
      this._cameraTorchOn = false;
      this._cameraZoomLevel = 1.0;

      // Supported barcode formats focused on student IDs (Code 128, QR, Code 39, EAN-13)
      // Restricting to the 4 actual formats boosts JS decoding speed per frame by ~2.5x!
      const formatsToSupport = (typeof Html5QrcodeSupportedFormats !== 'undefined') ? [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
      ] : [5, 0, 3, 9];

      // CRITICAL: useBarCodeDetectorIfSupported MUST be FALSE!
      // In Chrome for Android / Windows, the experimental native BarcodeDetector API
      // only supports "qr_code" by default and completely drops Code 128 linear barcodes.
      // Setting this to false forces the battle-tested pure-JS ZXing engine to run!
      const html5QrCode = new Html5Qrcode('centrlyCameraViewport', {
        formatsToSupport,
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: false,
        },
      });
      this._activeHtml5QrCode = html5QrCode;

      const facingMode = this._cameraFacingMode || 'environment';

      const isLowEndDevice = (typeof navigator !== 'undefined') && (
        (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
        (navigator.deviceMemory && navigator.deviceMemory <= 2)
      );
      const config = {
        fps: isLowEndDevice ? 15 : 24,
        qrbox: (viewfinderWidth, viewfinderHeight) => ({
          width: Math.min(460, Math.floor(viewfinderWidth * 0.95)),
          height: Math.min(320, Math.floor(viewfinderHeight * 0.85)),
        }),
        videoConstraints: {
          facingMode: { ideal: facingMode },
          width: { ideal: isLowEndDevice ? 640 : 1280 },
          height: { ideal: isLowEndDevice ? 480 : 720 },
        },
        disableFlip: false,
      };

      const scanSuccess = (decodedText) => {
        this.handleCameraScanDetected(decodedText, mode);
      };

      // Try initial camera start with automatic fallback if facingMode isn't available
      try {
        await html5QrCode.start({ facingMode }, config, scanSuccess, () => {});
      } catch (firstErr) {
        console.warn('Initial camera facingMode failed, retrying fallback:', firstErr);
        const altFacing = facingMode === 'environment' ? 'user' : 'environment';
        try {
          await html5QrCode.start(
            { facingMode: altFacing },
            { ...config, videoConstraints: undefined },
            scanSuccess,
            () => {}
          );
          this._cameraFacingMode = altFacing;
        } catch (secondErr) {
          console.warn('Alternative facingMode failed, querying available cameras:', secondErr);
          const cameras = await Html5Qrcode.getCameras().catch(() => []);
          if (cameras && cameras.length > 0) {
            const chosenId = cameras[0].id;
            await html5QrCode.start(
              chosenId,
              { ...config, videoConstraints: undefined },
              scanSuccess,
              () => {}
            );
          } else {
            throw firstErr;
          }
        }
      }

      // Mobile Safari / Chrome video attributes & hardware continuous autofocus
      setTimeout(() => {
        const video = document.querySelector('#centrlyCameraViewport video');
        if (video) {
          video.setAttribute('playsinline', 'true');
          video.setAttribute('webkit-playsinline', 'true');
          video.setAttribute('muted', 'true');
          video.muted = true;
          video.style.maxWidth = '100%';
          video.style.height = 'auto';
          video.style.display = 'block';
          video.style.margin = '0 auto';
          video.style.borderRadius = '12px';

          try {
            const track = video.srcObject?.getVideoTracks()?.[0];
            if (track && track.getCapabilities) {
              const caps = track.getCapabilities();
              const adv = [];
              if (caps.focusMode && caps.focusMode.includes('continuous')) {
                adv.push({ focusMode: 'continuous' });
              }
              if (adv.length > 0 && track.applyConstraints) {
                track.applyConstraints({ advanced: adv }).catch(() => {});
              }
            }
          } catch (_) {}
        }
      }, 150);

      // HIGH-PRECISION AUXILIARY SCANNER:
      // Polls every 160ms directly from the high-res video frame!
      // Crops the center region (where the green box is) onto an 800x360 canvas and feeds it to ZXing & BarcodeDetector.
      this._nativeBarcodeInterval = setInterval(async () => {
        const video = document.querySelector('#centrlyCameraViewport video');
        if (!video || video.readyState < 2 || video.paused) return;

        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (!vw || !vh || vw < 100 || vh < 100) return;

        // 1. Try native BarcodeDetector directly on video if supported
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            const supported = await window.BarcodeDetector.getSupportedFormats().catch(() => []);
            const valid = ['code_128', 'code_39', 'qr_code', 'ean_13', 'upc_a'].filter(f => supported.includes(f));
            if (valid.length > 0) {
              const nativeDetector = new window.BarcodeDetector({ formats: valid });
              const barcodes = await nativeDetector.detect(video);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                scanSuccess(barcodes[0].rawValue);
                return;
              }
            }
          } catch (_) {}
        }

        // 2. Crisp center-crop for Code 128 (800x360 canvas)
        try {
          if (!this._auxScanCanvas) {
            this._auxScanCanvas = document.createElement('canvas');
          }
          this._auxScanCanvas.width = 800;
          this._auxScanCanvas.height = 360;
          const ctx = this._auxScanCanvas.getContext('2d', { willReadFrequently: true });
          const cropW = Math.round(vw * 0.85);
          const cropH = Math.round(vh * 0.45);
          const cropX = Math.round((vw - cropW) / 2);
          const cropY = Math.round((vh - cropH) / 2);
          ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, 800, 360);

          if (this._activeHtml5QrCode?.qrcode) {
            const res = await this._activeHtml5QrCode.qrcode.decodeRobustlyAsync(this._auxScanCanvas).catch(() => null);
            if (res && res.text) {
              scanSuccess(res.text);
              return;
            }
          }
        } catch (_) {}
      }, 160);

    } catch (err) {
      const viewport = document.getElementById('centrlyCameraViewport');
      if (viewport) {
        viewport.innerHTML = `
          <div style="color: #f87171; padding: 2.5rem 1rem; text-align: center; font-size: 0.88rem; line-height: 1.6;">
            <div style="display: flex; justify-content: center; margin-bottom: 0.5rem;">${getIcon('alertTriangle', 32, '#ef4444')}</div>
            <strong>تعذر فتح الكاميرا:</strong><br>
            ${err.name === 'NotAllowedError' ? 'تم رفض إذن الكاميرا. يرجى السماح للمتصفح باستخدام الكاميرا من إعدادات الموقع.' : (err.message || 'يرجى التأكد من تشغيل الكاميرا وتوصيلها بالمتصفح.')}<br><br>
            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.startCameraScanner('${mode}')" style="margin: 0 auto; display: inline-flex; align-items: center; gap: 0.3rem;">
              ${getIcon('refresh', 14)} إعادة المحاولة
            </button>
          </div>
        `;
      }
    }
  }

  app.toggleCameraFacingMode = async function(mode = 'session') {
    this._cameraFacingMode = this._cameraFacingMode === 'environment' ? 'user' : 'environment';
    await this.startCameraScanner(mode);
  }

  app.toggleCameraZoom = async function() {
    if (!this._activeHtml5QrCode) return;
    try {
      const video = document.querySelector('#centrlyCameraViewport video');
      const track = video?.srcObject?.getVideoTracks()?.[0];
      const caps = track?.getCapabilities ? track.getCapabilities() : {};

      if (caps.zoom) {
        const min = caps.zoom.min || 1;
        const max = caps.zoom.max || 2;
        // Step to 1.7x (ideal barcode reading distance) or back to 1x
        const targetZoom = (this._cameraZoomLevel <= 1.05) ? Math.min(1.7, max) : min;
        this._cameraZoomLevel = targetZoom;

        await this._activeHtml5QrCode.applyVideoConstraints({
          advanced: [{ zoom: targetZoom }],
        });

        const text = document.getElementById('cameraZoomBtnText');
        const btn = document.getElementById('cameraZoomBtn');
        if (text) text.innerText = targetZoom > 1.05 ? `${targetZoom.toFixed(1)}x` : '1x';
        if (btn) {
          btn.style.background = targetZoom > 1.05 ? '#eff6ff' : '';
          btn.style.borderColor = targetZoom > 1.05 ? '#3b82f6' : '';
          btn.style.color = targetZoom > 1.05 ? '#1d4ed8' : '';
        }
      } else {
        this.showToast('الكاميرا لا تدعم الزووم الرقمي من المتصفح', 'info');
      }
    } catch (err) {
      console.warn('Zoom failed:', err);
    }
  }

  app.toggleCameraTorch = async function() {
    if (!this._activeHtml5QrCode) return;
    try {
      this._cameraTorchOn = !this._cameraTorchOn;
      await this._activeHtml5QrCode.applyVideoConstraints({
        advanced: [{ torch: this._cameraTorchOn }],
      });
      const btn = document.getElementById('cameraTorchBtn');
      const text = document.getElementById('cameraTorchBtnText');
      if (btn) {
        btn.style.background = this._cameraTorchOn ? '#fef3c7' : '';
        btn.style.borderColor = this._cameraTorchOn ? '#f59e0b' : '';
        btn.style.color = this._cameraTorchOn ? '#b45309' : '';
      }
      if (text) {
        text.innerText = this._cameraTorchOn ? 'إطفاء الفلاش' : 'الفلاش';
      }
    } catch (err) {
      this._cameraTorchOn = false;
      this.showToast('الفلاش غير مدعوم على هذه الكاميرا أو وضع الكاميرا الحالي', 'info');
    }
  }

  app.closeCameraScannerModal = async function() {
    this._cameraTorchOn = false;
    this._cameraZoomLevel = 1.0;
    if (this._nativeBarcodeInterval) {
      clearInterval(this._nativeBarcodeInterval);
      this._nativeBarcodeInterval = null;
    }
    if (this._activeHtml5QrCode) {
      try {
        await this._activeHtml5QrCode.stop();
      } catch (_) {}
      this._activeHtml5QrCode = null;
    }
    const modal = document.getElementById('cameraScannerModal');
    if (modal) modal.remove();
    this.focusScanInput();
  }

  app.captureHighResFrameAndScan = async function(mode = 'session') {
    const snapBtn = document.getElementById('cameraSnapBtn');
    const feedback = document.getElementById('cameraScanFeedback');
    const originalContent = snapBtn ? snapBtn.innerHTML : '';
    if (snapBtn) {
      snapBtn.disabled = true;
      snapBtn.innerHTML = `${getIcon('refresh', 13, '#fff')} <span>جارٍ الفحص...</span>`;
    }
    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.background = '#3b82f6';
      feedback.style.color = '#fff';
      feedback.innerHTML = `<span>جارٍ تحليل صورة الكارت بأعلى دقة...</span>`;
    }

    try {
      const video = document.querySelector('#centrlyCameraViewport video');
      if (!video || !video.videoWidth || !video.videoHeight) {
        throw new Error('الكاميرا غير جاهزة بعد، يرجى الانتظار ثانية');
      }

      // 1. Try native BarcodeDetector directly on live video
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const supported = await window.BarcodeDetector.getSupportedFormats().catch(() => []);
          const formatsToCheck = ['code_128', 'code_39', 'qr_code', 'ean_13'].filter(f => supported.includes(f));
          if (formatsToCheck.length > 0) {
            const detector = new window.BarcodeDetector({ formats: formatsToCheck });
            const detected = await detector.detect(video);
            if (detected && detected.length > 0 && detected[0].rawValue) {
              this.handleCameraScanDetected(detected[0].rawValue, mode);
              return;
            }
          }
        } catch (_) {}
      }

      // 2. Capture high-resolution full video frame to canvas
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Check native detector on canvas
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const supported = await window.BarcodeDetector.getSupportedFormats().catch(() => []);
          const formatsToCheck = ['code_128', 'code_39', 'qr_code', 'ean_13'].filter(f => supported.includes(f));
          if (formatsToCheck.length > 0) {
            const detector = new window.BarcodeDetector({ formats: formatsToCheck });
            const detected = await detector.detect(canvas);
            if (detected && detected.length > 0 && detected[0].rawValue) {
              this.handleCameraScanDetected(detected[0].rawValue, mode);
              return;
            }
          }
        } catch (_) {}
      }

      // 3. Fallback to ZXing decodeRobustlyAsync on full high-res canvas (horizontal + rotated)
      if (this._activeHtml5QrCode?.qrcode) {
        try {
          const result = await this._activeHtml5QrCode.qrcode.decodeRobustlyAsync(canvas);
          if (result && result.text) {
            this.handleCameraScanDetected(result.text, mode);
            return;
          }
        } catch (_) {
          // If horizontal pass fails, rotate 90 degrees and retry
          try {
            const rotCanvas = document.createElement('canvas');
            rotCanvas.width = canvas.height;
            rotCanvas.height = canvas.width;
            const rCtx = rotCanvas.getContext('2d');
            rCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
            rCtx.rotate(Math.PI / 2);
            rCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
            const rotResult = await this._activeHtml5QrCode.qrcode.decodeRobustlyAsync(rotCanvas);
            if (rotResult && rotResult.text) {
              this.handleCameraScanDetected(rotResult.text, mode);
              return;
            }
          } catch (_) {}
        }
      }

      // If nothing detected
      this.playScanBeep('warning');
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = '#f59e0b';
        feedback.style.color = '#1e293b';
        feedback.innerHTML = `<span>لم يتم رصد كود واضح. قرّب الكاميرا بمسافة 15-20 سم واضغط "مسح فوري" مرة أخرى.</span>`;
        setTimeout(() => { if (feedback) feedback.style.display = 'none'; }, 2600);
      }
    } catch (err) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = '#ef4444';
        feedback.style.color = '#fff';
        feedback.innerHTML = `<span>خطأ في الالتقاط: ${escapeHtml(err.message || 'تعذر القراءة')}</span>`;
        setTimeout(() => { if (feedback) feedback.style.display = 'none'; }, 2600);
      }
    } finally {
      if (snapBtn) {
        snapBtn.disabled = false;
        snapBtn.innerHTML = originalContent || `${getIcon('camera', 13, '#fff')} <span>مسح فوري</span>`;
      }
    }
  }

  app.handleBarcodeFileScan = async function(file, mode = 'session') {
    if (!file) return;
    const feedback = document.getElementById('cameraScanFeedback');
    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.background = '#3b82f6';
      feedback.style.color = '#fff';
      feedback.innerHTML = `<span>جارٍ تحليل صورة الكارت...</span>`;
    }

    try {
      // 1. Try native BarcodeDetector if available
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const supported = await window.BarcodeDetector.getSupportedFormats().catch(() => []);
          const formatsToCheck = ['code_128', 'code_39', 'qr_code', 'ean_13'].filter(f => supported.includes(f));
          if (formatsToCheck.length > 0) {
            const imgBitmap = await createImageBitmap(file);
            const detector = new window.BarcodeDetector({ formats: formatsToCheck });
            const detected = await detector.detect(imgBitmap);
            if (detected && detected.length > 0 && detected[0].rawValue) {
              this.handleCameraScanDetected(detected[0].rawValue, mode);
              return;
            }
          }
        } catch (_) {}
      }

      // 2. Try scanFileV2 via active or temporary Html5Qrcode instance
      if (this._activeHtml5QrCode) {
        const result = await this._activeHtml5QrCode.scanFileV2(file, false);
        if (result && result.decodedText) {
          this.handleCameraScanDetected(result.decodedText, mode);
          return;
        }
      } else {
        const formatsToSupport = (typeof Html5QrcodeSupportedFormats !== 'undefined') ? [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.QR_CODE,
        ] : [5, 3, 9, 0];
        const tempScanner = new Html5Qrcode('centrlyCameraViewport', {
          formatsToSupport,
          verbose: false,
          experimentalFeatures: { useBarCodeDetectorIfSupported: false },
        });
        const result = await tempScanner.scanFileV2(file, false);
        tempScanner.clear();
        if (result && result.decodedText) {
          this.handleCameraScanDetected(result.decodedText, mode);
          return;
        }
      }

      this.playScanBeep('error');
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = '#ef4444';
        feedback.style.color = '#fff';
        feedback.innerHTML = `<span>تعذر استخراج الباركود من الصورة. يرجى التأكد من وضوح الخطوط وجودة الإضاءة.</span>`;
        setTimeout(() => { if (feedback) feedback.style.display = 'none'; }, 3000);
      }
    } catch (err) {
      this.playScanBeep('error');
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = '#ef4444';
        feedback.style.color = '#fff';
        feedback.innerHTML = `<span>تعذر قراءة الصورة: ${escapeHtml(err.message || 'تأكد من وضوح الباركود')}</span>`;
        setTimeout(() => { if (feedback) feedback.style.display = 'none'; }, 3000);
      }
    }
  }

  app.handleCameraScanDetected = async function(decodedText, mode = 'session') {
    if (!decodedText) return;
    const cleanCode = decodedText.trim();
    const now = Date.now();

    // Debounce to prevent multi-scanning the same student in rapid succession
    if (this._lastCameraCode === cleanCode && now - (this._lastCameraTime || 0) < 1200) {
      return;
    }
    this._lastCameraCode = cleanCode;
    this._lastCameraTime = now;

    const feedback = document.getElementById('cameraScanFeedback');

    if (mode === 'center') {
      try {
        const res = await request('/centers/front-desk/scan', {
          method: 'POST',
          body: { barcode: cleanCode },
        });
        if (res.success) {
          this.playScanBeep('success');
          this._cameraScanCount = (this._cameraScanCount || 0) + 1;
          const countEl = document.getElementById('cameraScanCount');
          if (countEl) countEl.innerText = this._cameraScanCount;
          if (feedback) {
            feedback.style.display = 'block';
            feedback.style.background = '#10b981';
            feedback.style.color = '#fff';
            feedback.innerHTML = `<span>${getIcon('check', 16, '#fff')}</span> <span>${res.message || 'تم رصد الحضور والتوجيه!'}</span>`;
            setTimeout(() => { if (feedback) feedback.style.display = 'none'; }, 2200);
          }
          await this.loadRouteData('center-sessions');
        } else {
          this.playScanBeep('error');
          if (feedback) {
            feedback.style.display = 'block';
            feedback.style.background = '#ef4444';
            feedback.style.color = '#fff';
            feedback.innerHTML = `<span>${getIcon('close', 16, '#fff')}</span> <span>${res.message || 'تعذر التعرف على الطالب'}</span>`;
            setTimeout(() => { if (feedback) feedback.style.display = 'none'; }, 2200);
          }
        }
      } catch (err) {
        this.playScanBeep('error');
        if (feedback) {
          feedback.style.display = 'block';
          feedback.style.background = '#ef4444';
          feedback.style.color = '#fff';
          feedback.innerText = `خطأ في الاتصال: ${err.message || 'تعذر الإرسال'}`;
          setTimeout(() => { if (feedback) feedback.style.display = 'none'; }, 2200);
        }
      }
      return;
    }

    // Default: Session attendance with strict prioritized matching
    let student = this.findStudentByQuery(cleanCode);

    // Live Server Fallback: If not in memory yet, query API
    if (!student) {
      student = await this.fetchStudentByQueryAsync(cleanCode);
    }

    if (student) {
      // Check if already attended
      const existing = this.sessionState.attendanceList.find(
        a => a.student_id === student.id || a.code === (student.code || student.student_code)
      );

      if (existing && existing.attended) {
        this.playScanBeep('warning');
        if (feedback) {
          feedback.style.display = 'block';
          feedback.style.background = '#f59e0b';
          feedback.style.color = '#1e293b';
          feedback.innerHTML = `<strong>تنبيه:</strong> الطالب (${escapeHtml(student.name)}) مسجل حضوره بالفعل مسبقاً!`;
          setTimeout(() => { if (feedback) feedback.style.display = 'none'; }, 2200);
        }
        return;
      }

      this.registerStudentAttendance(student);
      this._cameraScanCount = (this._cameraScanCount || 0) + 1;
      const countEl = document.getElementById('cameraScanCount');
      if (countEl) countEl.innerText = this._cameraScanCount;

      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = '#10b981';
        feedback.style.color = '#fff';
        feedback.innerHTML = `<span>${getIcon('check', 16, '#fff')}</span> <span>تم تسجيل: <strong>${escapeHtml(student.name)}</strong> (${escapeHtml(student.code || student.student_code || cleanCode)})</span>`;
        setTimeout(() => { if (feedback) feedback.style.display = 'none'; }, 2200);
      }
    } else {
      this.playScanBeep('error');
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = '#ef4444';
        feedback.style.color = '#fff';
        feedback.innerHTML = `<span>${getIcon('close', 16, '#fff')}</span> <span>كود غير مسجل بالمنظومة: <strong>${escapeHtml(cleanCode)}</strong></span>`;
        setTimeout(() => { if (feedback) feedback.style.display = 'none'; }, 2500);
      }
    }
  }

  app.openScannerSetupGuide = function() {
    const existing = document.getElementById('scannerSetupModal');
    if (existing) existing.remove();

    const modalHtml = `
      <div id="scannerSetupModal" class="modal-overlay" style="display: flex; position: fixed; inset: 0; background: rgba(15,23,42,0.65); backdrop-filter: blur(4px); align-items: center; justify-content: center; z-index: 9999; padding: 1rem;" dir="rtl">
        <div class="card" style="width: 100%; max-width: 560px; margin: 0; padding: 1.5rem; border-radius: 16px; background: #ffffff; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); font-family: 'Cairo', sans-serif; max-height: 90vh; overflow-y: auto;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--centrly-line); padding-bottom: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="color: var(--centrly-blue-700);">${getIcon('gear', 22, 'var(--centrly-blue-700)')}</span>
              <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--centrly-ink);">
                دليل وضبط أجهزة الباركود سكانر (Hardware Setup)
              </h3>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('scannerSetupModal')?.remove()" style="border: none; cursor: pointer; padding: 0.35rem 0.6rem; display: flex; align-items: center;">${getIcon('close', 16, '#64748b')}</button>
          </div>

          <!-- Step 1: Plug & Play -->
          <div style="margin-bottom: 1.25rem;">
            <div style="font-weight: 800; color: var(--centrly-blue-800); font-size: 0.95rem; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.4rem;">
              <span style="background: #eff6ff; color: #2563eb; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 900;">1</span>
              <span>التوصيل الفوري (Plug & Play - بدون أي تعريفات)</span>
            </div>
            <p style="font-size: 0.85rem; color: #475569; margin: 0 0 0.5rem 0; line-height: 1.6;">
              أي جهاز سكانر تشتريه من السوق (سلكي USB أو لاسلكي Wireless 2.4GHz مع دانجل أو Bluetooth) يعمل فورياً. فقط ضعه في مدخل الـ USB بالكمبيوتر أو اللابتوب وسيتعرف عليه كـ لوحة مفاتيح سريعة مباشرة دون برامج تعريف.
            </p>
          </div>

          <!-- Step 2: Automatic Enter Key (Suffix CR/LF) -->
          <div style="margin-bottom: 1.25rem;">
            <div style="font-weight: 800; color: var(--centrly-blue-800); font-size: 0.95rem; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.4rem;">
              <span style="background: #eff6ff; color: #2563eb; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 900;">2</span>
              <span>إرسال زر Enter تلقائياً بعد المسح</span>
            </div>
            <p style="font-size: 0.85rem; color: #475569; margin: 0 0 0.5rem 0; line-height: 1.6;">
              99% من أجهزة السكانر تأتي مبرمجة تلقائياً لتضغط Enter فور قراءة الكود. إذا كان سكانرك يكتب الكود ولا يضغط Enter، قم بمسح باركود <strong>(Add Enter / Carriage Return)</strong> الموجود في ورقة الكتالوج المصاحبة للسكانر مرة واحدة فقط وسيعمل دائماً.
            </p>
          </div>

          <!-- Step 3: Interactive Live Scanner Tester -->
          <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px; padding: 1.25rem; margin-bottom: 1.25rem;">
            <div style="font-weight: 800; color: #166534; font-size: 0.95rem; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.4rem;">
              ${getIcon('barcode', 18, '#166534')}
              <span>منطقة اختبار السكانر التفاعلية الحية</span>
            </div>
            <p style="font-size: 0.825rem; color: #166534; margin: 0 0 0.75rem 0;">
              وجه سكانرك الآن وامسح أي كارت أو باركود في المربع أدناه لتتأكد من سرعة القراءة وسماع صوت الـ Beep:
            </p>
            
            <input 
              type="text" 
              id="scannerTestLiveInput" 
              class="form-input" 
              placeholder="ضع المؤشر هنا وامسح بالسكانر..." 
              style="background: #fff; border: 1.5px solid #16a34a; font-size: 1rem; font-weight: 800; text-align: center; direction: ltr;"
              onkeydown="if (event.key === 'Enter') { event.preventDefault(); window.centrlyApp.handleLiveScannerTest(this.value); this.value = ''; }"
            >

            <div id="scannerTestLiveResult" style="margin-top: 0.65rem; font-size: 0.85rem; font-weight: 700; text-align: center; color: #047857; min-height: 24px;"></div>
          </div>

          <div style="display: flex; justify-content: flex-end;">
            <button type="button" class="btn btn-primary" onclick="document.getElementById('scannerSetupModal')?.remove()" style="font-weight: 700; padding: 0.5rem 1.5rem;">
              فهمت، والكل جاهز
            </button>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    setTimeout(() => {
      document.getElementById('scannerTestLiveInput')?.focus();
    }, 100);
  }

  app.handleLiveScannerTest = function(code) {
    if (!code) return;
    this.playScanBeep('success');
    const resEl = document.getElementById('scannerTestLiveResult');
    if (resEl) {
      resEl.innerHTML = `
        <span style="color: #15803d;">${getIcon('check', 16, '#15803d')} تم استلام الكود بنجاح: <strong>${escapeHtml(code)}</strong> وبسرعة استجابة فائقة!</span>
      `;
    }
  }


}
