Bundled browser dependencies (also copied into the Android APK):

- `three.min.js`, `Reflector.js`, `OrbitControls.js`, `TransformControls.js`: Three.js **r128**, https://github.com/mrdoob/three.js/tree/r128 ; MIT license in `THREE_LICENSE.txt`.
- `supabase-2.49.8.js`: Supabase JS **2.49.8**, official UMD distribution from https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/dist/umd/supabase.js ; MIT license in `SUPABASE_LICENSE.txt`.

These files are intentionally local so opening Cube Space and the monthly login form does not depend on a script CDN. Account login and cloud competitions still require network access to the configured Supabase project. No service keys are bundled.
