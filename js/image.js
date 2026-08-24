// 图片处理：尺寸计算、命名、压缩、base64。

function computeTargetSize(w, h, maxSide) {
  maxSide = maxSide || 1600;
  if (Math.max(w, h) <= maxSide) return { w: w, h: h };
  const scale = maxSide / Math.max(w, h);
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

function generateImageName(ext) {
  ext = ext || 'jpg';
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let hex = '';
  bytes.forEach(function (b) { hex += b.toString(16).padStart(2, '0'); });
  return hex + '.' + ext;
}

function compressImage(file, maxSide, quality) {
  maxSide = maxSide || 1600;
  quality = typeof quality === 'number' ? quality : 0.8;
  return new Promise(function (resolve, reject) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function () {
      const t = computeTargetSize(img.naturalWidth, img.naturalHeight, maxSide);
      const canvas = document.createElement('canvas');
      canvas.width = t.w; canvas.height = t.h;
      canvas.getContext('2d').drawImage(img, 0, 0, t.w, t.h);
      URL.revokeObjectURL(url);
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob); else reject(new Error('compress failed'));
      }, 'image/jpeg', quality);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function blobToBase64(blob) {
  return new Promise(function (resolve, reject) {
    const fr = new FileReader();
    fr.onload = function () { resolve(fr.result.split(',')[1]); };
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    computeTargetSize: computeTargetSize,
    generateImageName: generateImageName,
    compressImage: compressImage,
    blobToBase64: blobToBase64
  };
}
