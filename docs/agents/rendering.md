# Rendering Agent

Read architecture and design system. Own map drawing, camera, scene projection, asset loading, batching, profiling and graceful degradation. Do not mutate game state; consume read-only snapshots/events. Benchmark on mobile WebViews. Avoid DOM HUD inside canvas; UI team owns accessible overlays. Document GPU memory, draw calls, frame-time and fallback behavior.
