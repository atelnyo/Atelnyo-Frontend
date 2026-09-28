/**
 * CertificateTemplate.js
 *
 * Generates the full HTML document for the official Atelnyo
 * certificate of completion. Opens in a new window for print/PNG.
 *
 * Security features:
 *   • Verification hash (HMAC) — tamper detection
 *   • QR code → public verification endpoint
 *   • Unique certificate number: ATY-{user_id:08d}-{course_id:08d}
 */

export function openCertificateWindow({
  certNumber,
  learnerName,
  courseTitle,
  issuedDate,
  verifyUrl,
  verifyHash,
  isHt,
}) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="robots" content="noindex, nofollow">
<title>Certificate of Completion — Atelnyo</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"><\/script>
<style>
  @page { size: landscape; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', sans-serif; background: #e8ecf1;
    display: flex; flex-direction: column; align-items: center;
    padding: 40px 20px; gap: 24px; min-height: 100vh;
  }
  .certificate-wrapper { width: 100%; max-width: 1040px; overflow-x: auto; }
  .certificate {
    width: 1000px; min-width: 1000px; height: 700px;
    background: linear-gradient(180deg, #fefefe 0%, #f7f8fa 100%);
    position: relative; padding: 0; text-align: center;
    box-shadow: 0 20px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04);
    border-radius: 4px; overflow: hidden;
    transform-origin: top center;
  }
  /* Triple border */
  .cert-border-outer {
    position: absolute; inset: 0;
    border: 12px solid #0A2540;
    border-radius: 4px;
    pointer-events: none; z-index: 2;
  }
  .cert-border-inner {
    position: absolute; inset: 14px;
    border: 2px solid #b8860b;
    border-radius: 2px;
    pointer-events: none; z-index: 2;
  }
  /* Corner ornaments */
  .corner { position: absolute; width: 60px; height: 60px; z-index: 3; pointer-events: none; }
  .corner svg { width: 100%; height: 100%; }
  .corner-tl { top: 20px; left: 20px; }
  .corner-tr { top: 20px; right: 20px; transform: scaleX(-1); }
  .corner-bl { bottom: 20px; left: 20px; transform: scaleY(-1); }
  .corner-br { bottom: 20px; right: 20px; transform: scale(-1,-1); }
  /* Watermark */
  .certificate::before {
    content: ''; position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%); width: 420px; height: 420px;
    background: url('https://atelnyo.site/logo192.png') center/contain no-repeat;
    opacity: 0.035; filter: blur(1px); z-index: 0; pointer-events: none;
  }
  .certificate::after {
    content: 'OFFICIAL DOCUMENT — ATELNYO'; position: absolute;
    top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg);
    font-family: 'Inter', sans-serif; font-size: 38px; font-weight: 700;
    color: rgba(10,37,64,0.035); white-space: nowrap;
    letter-spacing: 6px; pointer-events: none; z-index: 0;
  }
  .certificate > * { position: relative; z-index: 1; }
  /* Header */
  .cert-header { padding: 30px 60px 0; }
  .logo-row {
    display: flex; align-items: center; justify-content: center; gap: 14px;
    margin-bottom: 4px;
  }
  .logo-row img { width: 60px; height: 60px; object-fit: contain; }
  .brand-name {
    font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 900;
    color: #0A2540; letter-spacing: 2px;
  }
  .brand-divider {
    width: 80px; height: 2px;
    background: linear-gradient(90deg, transparent, #b8860b, transparent);
    margin: 8px auto 0;
  }
  /* Title */
  .cert-title {
    font-family: 'Playfair Display', serif;
    font-size: 14px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 8px; color: #b8860b; margin: 18px 0 6px;
  }
  .cert-subtitle {
    font-family: 'Playfair Display', serif;
    font-size: 42px; font-weight: 900; color: #0A2540;
    letter-spacing: 2px; margin-bottom: 4px;
  }
  /* Body */
  .cert-body { padding: 0 80px; }
  .cert-text {
    font-size: 15px; color: #555; line-height: 1.6;
    margin-bottom: 4px; font-weight: 400;
  }
  .learner-name {
    font-family: 'Playfair Display', serif;
    font-size: 38px; font-weight: 900;
    text-transform: uppercase; letter-spacing: 4px;
    color: #0A2540; margin: 10px 0 6px;
    padding-bottom: 6px;
    border-bottom: 2px solid #0A2540;
    display: inline-block;
  }
  .course-title {
    font-family: 'Playfair Display', serif;
    font-size: 24px; font-weight: 700;
    color: #0A2540; margin: 10px 0 4px;
  }
  .date-line {
    font-size: 14px; color: #777; margin-bottom: 0;
    font-weight: 400;
  }
  /* Official Seal */
  .seal {
    position: absolute; top: 40px; right: 60px;
    width: 90px; height: 90px; z-index: 3;
  }
  .seal svg { width: 100%; height: 100%; }
  /* Footer */
  .cert-footer {
    position: absolute; bottom: 0; left: 0; right: 0;
    height: 80px; padding: 0 60px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .qr-block { display: flex; flex-direction: column; align-items: center; gap: 3px; }
  .qr-code {
    width: 70px; height: 70px; background: #fff;
    padding: 4px; border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  .qr-label {
    font-size: 8px; font-weight: 700; color: #0A2540;
    text-transform: uppercase; letter-spacing: 1px;
  }
  .cert-number-block { text-align: center; }
  .cert-number-label {
    font-size: 9px; font-weight: 600; color: #999;
    text-transform: uppercase; letter-spacing: 2px; margin-bottom: 2px;
  }
  .cert-number {
    font-family: 'Inter', monospace; font-size: 15px;
    font-weight: 700; color: #0A2540; letter-spacing: 2px;
  }
  .verify-block { text-align: right; }
  .verify-text {
    font-size: 9px; font-weight: 600; color: #999;
    text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px;
  }
  .verify-url {
    font-size: 11px; font-weight: 500; color: #0A2540;
    word-break: break-all; max-width: 180px;
  }
  /* Controls */
  .controls {
    display: flex; gap: 12px; flex-wrap: wrap;
    justify-content: center; max-width: 1040px; width: 100%;
  }
  .controls button {
    padding: 12px 22px; font-size: 14px; border: none; border-radius: 8px;
    font-family: 'Inter', sans-serif; font-weight: 600;
    cursor: pointer; transition: all 0.2s;
  }
  .btn-print { background: #0A2540; color: #fff; }
  .btn-print:hover { background: #06172a; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(10,37,64,0.3); }
  .btn-download { background: #16a34a; color: #fff; }
  .btn-download:hover { background: #15803d; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(22,163,74,0.3); }
  .btn-copy { background: #6b7280; color: #fff; }
  .btn-copy:hover { background: #4b5563; transform: translateY(-2px); }
  .share-label { font-size: 13px; color: #6b7280; font-weight: 600; width: 100%; text-align: center; }
  .share-buttons { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .share-buttons button { padding: 10px 16px; font-size: 13px; }
  /* Responsive */
  @media (max-width: 1100px) {
    .certificate-wrapper { transform: scale(0.82); transform-origin: top center; margin-bottom: -80px; }
  }
  @media (max-width: 700px) {
    body { padding: 20px 10px; gap: 16px; }
    .certificate-wrapper { transform: scale(0.52); transform-origin: top center; margin-bottom: -220px; }
    .controls { gap: 8px; }
    .controls button { padding: 10px 14px; font-size: 12px; }
    .share-buttons button { padding: 8px 12px; font-size: 11px; }
  }
  @media (max-width: 480px) {
    body { padding: 14px 8px; gap: 12px; }
    .certificate-wrapper { transform: scale(0.36); transform-origin: top center; margin-bottom: -300px; }
    .controls button { padding: 10px 12px; font-size: 11px; }
    .share-buttons button { padding: 8px 10px; font-size: 10px; }
  }
  /* Print */
  @media print {
    body { background: #fff; padding: 0; gap: 0; }
    .controls, .share-label, .share-buttons { display: none !important; }
    .certificate { box-shadow: none; transform: none !important; }
    .certificate-wrapper { transform: none !important; margin: 0 !important; }
  }
</style></head><body>
<div class="certificate-wrapper">
<div class="certificate" id="certificate">
  <div class="cert-border-outer"></div>
  <div class="cert-border-inner"></div>
  <div class="corner corner-tl"><svg viewBox="0 0 60 60" fill="none"><path d="M5 55 C5 25 25 5 55 5" stroke="#b8860b" stroke-width="1.5" fill="none"/><path d="M10 55 C10 30 30 10 55 10" stroke="#b8860b" stroke-width="0.8" fill="none"/><circle cx="8" cy="52" r="3" fill="#b8860b"/></svg></div>
  <div class="corner corner-tr"><svg viewBox="0 0 60 60" fill="none"><path d="M5 55 C5 25 25 5 55 5" stroke="#b8860b" stroke-width="1.5" fill="none"/><path d="M10 55 C10 30 30 10 55 10" stroke="#b8860b" stroke-width="0.8" fill="none"/><circle cx="8" cy="52" r="3" fill="#b8860b"/></svg></div>
  <div class="corner corner-bl"><svg viewBox="0 0 60 60" fill="none"><path d="M5 55 C5 25 25 5 55 5" stroke="#b8860b" stroke-width="1.5" fill="none"/><path d="M10 55 C10 30 30 10 55 10" stroke="#b8860b" stroke-width="0.8" fill="none"/><circle cx="8" cy="52" r="3" fill="#b8860b"/></svg></div>
  <div class="corner corner-br"><svg viewBox="0 0 60 60" fill="none"><path d="M5 55 C5 25 25 5 55 5" stroke="#b8860b" stroke-width="1.5" fill="none"/><path d="M10 55 C10 30 30 10 55 10" stroke="#b8860b" stroke-width="0.8" fill="none"/><circle cx="8" cy="52" r="3" fill="#b8860b"/></svg></div>
  <div class="seal"><svg viewBox="0 0 90 90" xmlns="http://www.w3.org/2000/svg">
    <circle cx="45" cy="45" r="42" fill="none" stroke="#b8860b" stroke-width="2"/>
    <circle cx="45" cy="45" r="36" fill="none" stroke="#b8860b" stroke-width="0.8"/>
    <circle cx="45" cy="45" r="28" fill="rgba(184,134,11,0.06)" stroke="#b8860b" stroke-width="0.5"/>
    <text x="45" y="38" text-anchor="middle" font-family="Inter,sans-serif" font-size="7" font-weight="700" fill="#b8860b" letter-spacing="1">ATELNYO</text>
    <text x="45" y="50" text-anchor="middle" font-family="Inter,sans-serif" font-size="5.5" font-weight="500" fill="#b8860b" letter-spacing="0.5">VERIFIED</text>
    <text x="45" y="58" text-anchor="middle" font-family="Inter,sans-serif" font-size="4.5" font-weight="400" fill="#b8860b">CERTIFICATE</text>
  </svg></div>
  <div class="cert-header">
    <div class="logo-row">
      <img src="https://atelnyo.site/logo192.png" alt="Atelnyo">
      <div class="brand-name">ATELNYO</div>
    </div>
    <div class="brand-divider"></div>
  </div>
  <div class="cert-title">${isHt ? 'Sètifika Konplete' : 'Certificate of Completion'}</div>
  <div class="cert-subtitle">${isHt ? 'SÈTIFIKA OFISYÈL' : 'OFFICIAL CERTIFICATE'}</div>
  <div class="cert-body">
    <p class="cert-text">${isHt ? 'Avèk anpil fyè, Atelnyo sètifye ke' : 'Atelnyo hereby certifies that'}</p>
    <div class="learner-name">${learnerName}</div>
    <p class="cert-text">${isHt ? 'te konplete avèk siksè kou a' : 'has successfully completed the course'}</p>
    <div class="course-title">${courseTitle}</div>
    <p class="date-line">${issuedDate ? `${isHt ? 'Dat konplete:' : 'Date of Completion:'} ${issuedDate}` : ''}</p>
  </div>
  <div class="cert-footer">
    <div class="qr-block">
      <div class="qr-code" id="qrcode"></div>
      <div class="qr-label">${isHt ? 'Verifie' : 'Scan to Verify'}</div>
    </div>
    <div class="cert-number-block">
      <div class="cert-number-label">${isHt ? 'Nimewo Sètifika' : 'Certificate Number'}</div>
      <div class="cert-number">${certNumber}</div>
    </div>
    <div class="verify-block">
      <div class="verify-text">${isHt ? 'Verifie sou' : 'Verify at'}</div>
      <div class="verify-url">${verifyUrl}</div>
    </div>
  </div>
</div>
</div>
<div class="controls">
  <button class="btn-print" onclick="window.print()">
    ${isHt ? '🖨️ Enprime / PDF' : '🖨️ Print / Save PDF'}
  </button>
  <button class="btn-download" onclick="downloadPNG()">
    ${isHt ? '📥 Telechaje PNG' : '📥 Download PNG'}
  </button>
  <button class="btn-copy" onclick="copyCertText()">
    ${isHt ? '📋 Kope Tèks' : '📋 Copy Text'}
  </button>
</div>
<div class="share-label">${isHt ? 'Pataje Sètifika:' : 'Share Certificate:'}</div>
<div class="share-buttons">
  <button style="background:#1877f2;color:#fff" onclick="window.open('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent('${verifyUrl}')+'&quote='+encodeURIComponent('I completed ${courseTitle} on Atelnyo! 🎓'),'_blank','width=600,height=400')">📘 Facebook</button>
  <button style="background:#000;color:#fff" onclick="window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent('🎓 I completed \\\"${courseTitle}\\\" on @Atelnyo! #Atelnyo #Certificate')+'&url='+encodeURIComponent('${verifyUrl}'),'_blank','width=600,height=400')">🐦 ${isHt ? 'Chirye' : 'X / Twitter'}</button>
  <button style="background:#0a66c2;color:#fff" onclick="window.open('https://www.linkedin.com/sharing/share-offsite/?url='+encodeURIComponent('${verifyUrl}'),'_blank','width=600,height=400')">💼 LinkedIn</button>
  <button style="background:#25d366;color:#fff" onclick="window.open('https://wa.me/?text='+encodeURIComponent('🎓 ${isHt ? 'Mwen fini kou' : 'I completed'} \\\"${courseTitle}\\\" ${isHt ? 'sou' : 'on'} Atelnyo! ${verifyUrl}'),'_blank','width=600,height=400')">💬 WhatsApp</button>
</div>
<script>
  new QRCode(document.getElementById('qrcode'), {
    text: '${verifyUrl}', width: 62, height: 62,
    colorDark: '#0A2540', colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });
  function downloadPNG() {
    html2canvas(document.getElementById('certificate'), {
      scale: 2, backgroundColor: '#f7f8fa', useCORS: true
    }).then(function(canvas) {
      var link = document.createElement('a');
      link.download = 'Atelnyo-Certificate-${certNumber}.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }
  function copyCertText() {
    var t = '═══════════════════════════════════════\\n'
      + '       CERTIFICATE OF COMPLETION\\n'
      + '              ATELNYO\\n'
      + '═══════════════════════════════════════\\n\\n'
      + '${isHt ? 'Sètifye ke' : 'This certifies that'}\\n'
      + '  ${learnerName}\\n\\n'
      + '${isHt ? 'te konplete' : 'has completed'}\\n'
      + '  ${courseTitle}\\n\\n'
      + '${isHt ? 'Nan dat' : 'On'} ${issuedDate}\\n\\n'
      + 'Certificate No: ${certNumber}\\n'
      + 'Verify: ${verifyUrl}\\n'
      + '═══════════════════════════════════════';
    navigator.clipboard.writeText(t).then(function() {
      alert('${isHt ? '✅ Sètifika kope!' : '✅ Certificate copied!'}');
    });
  }
<\/script>
</body></html>`);

  printWindow.document.close();
}
