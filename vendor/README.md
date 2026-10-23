Bundled browser dependencies (also copied into the Android APK):

- Website Cube Explorer dependency added in 1.45.8: `min2phase-0.0.4.js`, upstream https://github.com/cs0x7f/min2phase.js, pinned npm 0.0.4 distribution from https://cdn.jsdelivr.net/npm/min2phase.js@0.0.4/min2phase.js . Upstream offers MIT or GPL-3.0; this integration uses the MIT option, whose full copyright/permission notice is retained in `MIN2PHASE_README.md`. `MIN2PHASE_LICENSE.txt` also preserves the original distributed GPL text. Source is unmodified, loaded inside a Worker only when solving. These files have not been copied into a new APK.

- Website chart dependency added 2026-10-23: `chart-4.5.1.umd.min.js`, Chart.js **4.5.1**, official UMD distribution from https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js ; MIT license in `CHARTJS_LICENSE.txt`. This addition has not yet been copied into a new APK.

- `three.min.js`, `Reflector.js`, `OrbitControls.js`, `TransformControls.js`: Three.js **r128**, https://github.com/mrdoob/three.js/tree/r128 ; MIT license in `THREE_LICENSE.txt`.
- `supabase-2.49.8.js`: Supabase JS **2.49.8**, official UMD distribution from https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/dist/umd/supabase.js ; MIT license in `SUPABASE_LICENSE.txt`.

These files are intentionally local so opening Cube Space and the monthly login form does not depend on a script CDN. Account login and cloud competitions still require network access to the configured Supabase project. No service keys are bundled.
