import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
let detector: FaceLandmarker | undefined;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      const probe = new OffscreenCanvas(1, 1);
      const gl = probe.getContext('webgl2') || probe.getContext('webgl');
      if (!gl) throw new Error('Bu cihazda worker WebGL kullanılamıyor. Tarayıcı donanım hızlandırma ayarını kontrol et.');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      const files = await FilesetResolver.forVisionTasks(data.wasm);
      // CPU WASM in a dedicated worker avoids competing with video compositing for GPU.
      detector = await FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: data.model, delegate: 'CPU' },
        runningMode: 'VIDEO', numFaces: 1,
        minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
        outputFaceBlendshapes: false, outputFacialTransformationMatrixes: false,
      });
      self.postMessage({ type: 'ready' });
    } else if (data.type === 'frame') {
      const start = performance.now();
      try {
        if (!detector) throw new Error('Tracker is not initialized');
        const result = detector.detectForVideo(data.bitmap, data.timestamp);
        const points = result.faceLandmarks[0];
        let pose = null;
        if (points) {
          const left = points[33], right = points[263], nose = points[1];
          const dx = (right.x - left.x) * data.width, dy = (right.y - left.y) * data.height;
          pose = { x: nose.x, y: nose.y, size: Math.hypot(dx, dy) / data.width, roll: Math.atan2(dy, dx) };
        }
        self.postMessage({ type: 'result', pose, timestamp: data.timestamp, duration: performance.now() - start });
      } finally { data.bitmap.close(); }
    }
  } catch (error) { self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) }); }
};
