# Impact Lab — cinematic fluid overhaul

Branch: `cinematic-fluid-overhaul`. The existing production deployment and the `/` camera lab are preserved. Changes are confined to the impact scene, its visual fixtures/tests and documentation. No new dependency, game mode, score or menu system.

## Scene

- The old spiral emoji geometry is removed. An original connected metaball volume is meshed once, with merged smooth normals, irregular silhouette, procedural micro-roughness, physical wet material, environment reflections and key/rim lighting. Its small motion deformation runs in the vertex shader.
- A 1.25-second perspective approach locks the aim at launch. The current face ellipse determines hit/near/miss at the impact plane; missing tracking yields `untracked`.
- Contact compresses the same mesh before it dissolves. A short-lived curved liquid sheet and thin connecting streams hand over to 96 heterogeneous parent droplets; 24 parents split into 48 smaller children. Instanced tapered geometry, analytic drag/gravity, velocity-aligned stretch and gradual shrink/fade provide bounded cost. This is a designed deterministic liquid effect, not a Navier–Stokes solver.
- Every hit creates a seeded asymmetric height field with unequal overlapping lobes, sparse satellites and five moving rivulets. UVs attach it to the 468-vertex MediaPipe face mesh. Up to four hits accumulate, then the oldest layer is retired to bound overdraw. Mesh depth masks folded/back surfaces. Tracking loss hides deposits; reacquisition restores them on the tracked face. There is no person identity recognition or hand/hair segmentation.
- The actual camera image is sampled through independent cheek bulges, lateral nose shift, mouth stretch and directional bend. Compression peaks quickly, overshoots and returns by 460 ms. The deposit mesh uses the same warp function with a short inverse solve so the marks also follow that deformation.
- Original Web Audio Foley combines a rising whoosh, two low body impulses, contact slap, thick filtered liquid, elastic squelch, twenty spatial secondary droplets and a viscous tail. Replay stretches these envelopes and adds a low stereo wash. No external sound recording/license, microphone or paid audio service.

## Actual replay

A 36-frame GPU ring stores **raw camera pixels plus timestamped face geometry**, at at most 15 capture attempts/s. The replay selects the recorded camera sample by timestamp and re-renders the seeded model, breakup, particles, warp and deposits at 0.35× event time. It covers approximately 0.28 s before and 0.84 s after impact. With approach and live aftermath, a complete automatic event is approximately five seconds.

Camera footage can look less smooth than the continuously re-rendered effects. The recorded sample rate is exposed as `replayCameraFps`; it is not a sensor FPS measurement and duplicate source images can occur when the source is slower. No invented in-between camera frames. Live camera capture and the tracking worker continue during replay. There is no video export or microphone recording.

## Performance boundaries

The camera/tracker implementation is retained: high-resolution video, 640-pixel detection input, dedicated CPU-WASM worker, one in-flight inference and the existing cadence gate. Source counters, presented frames, callback rate, submitted/completed inference rate and model/bitmap time remain separate. The previously observed physical-camera 16 FPS root cause is still unverified.

Only the 3D effects render target adapts under sustained >22 ms draw cost (down to 45% dimensions). Camera shading stays at display resolution, up to 1920 pixels wide. The effects target uses up to four MSAA samples. Expensive warp math and empty effect passes are skipped when inactive. Impact materials are compiled before the first throw, avoiding shader compilation on the contact frame. No CPU image readback for replay.

At 16:9, the raw replay color buffers occupy 45.56 MiB on desktop or 17.80 MiB on narrow screens. That excludes the multisampled FX target, depth, driver allocations, model/textures and the browser's own video memory. Timers report CPU submission separately from asynchronous GPU query results. GPU queries may be unsupported or delayed. 60 FPS is a target, not a measured device guarantee.

## Verification

The fixed fictional portrait (`public/qa/face.png`) permits reproducible camera-free inspection; it is clearly labeled in the UI. The developer-only `?qa=1` endpoint freezes event time/seed for screenshots. It is never substituted into a live camera session. Browser tests cover approach/contact/dispersal/stains/drips, alternate seeds, isolated camera-pixel warp, real replay time progression, repeat playback, moving simulated landmarks, clearing, the real tracking worker, capture/tracking A/B, stereo audio waveform and mobile layout.

Windows sandbox unit tests hit a temporary-file access limitation, then passed outside that sandbox. This machine's headless browser could not initialize WebGL. GPU browser verification therefore runs on Linux GitHub Actions with Chromium/SwiftShader. Those measurements and static images **do not prove physical-device FPS, fast head movement accuracy, end-to-end A/V latency, Safari/Firefox compatibility or subjective quality for every face**.

The first visual pass exposed faceted normals and an oversized flower-like central sheet; these were corrected. The next pass exposed overly needle-like droplets; taper/stretch and antialiasing were revised. Final evidence and measured values are recorded in `OVERHAUL-VALIDATION.md`.

## Asset provenance

`public/qa/face.png` is an original fictional adult portrait generated with the built-in ImageGen tool, used only as a test fixture. No external image or audio asset was taken from another project. `src/impact/face-triangles.json` is the triangle index sequence from the installed official `@mediapipe/tasks-vision` `FaceLandmarker.FACE_LANDMARKS_TESSELATION` (Apache-2.0). The portrait-generation prompt is recorded in `public/qa/PROVENANCE.md`.
