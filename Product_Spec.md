# First‑Person 3D Garden — Web MVP Spec (Fast Defaults)

**Mode:** Single‑player, cozy sandbox.
**Camera:** First‑person with Pointer Lock.
**World:** 60×60 m walled garden; authored paths + light procedural scatter.
**Clock:** 10‑minute day/night cycle.
**Plants:** 8 stylized species with simple stats (sunlight, water, fertility).
**Stack:** Three.js (rendering), cannon‑es (collisions), Vite (build/dev), Zustand (state), plain DOM/CSS UI.
**Perf target:** 60 FPS on mid‑range laptop iGPU; ≤100k tris visible; ≤120 draw calls peak; textures ≤2k.

---

## 1) Product goals (MVP)

* Deliver a tranquil, tactile planting loop that feels good on trackpad + mouse.
* Teach player the loop in <3 minutes via diegetic prompts.
* Run smoothly in desktop Chrome/Edge/Firefox/Safari without installs.
* Persist garden state locally and reload in <3 seconds on a cold start.

**Non‑goals (MVP):** multiplayer, crafting economy, complex weather/seasons, pests, narrative.

---

## 2) Core loop

1. **Collect** seeds (given at start; more gained by harvesting).
2. **Plant** seed in valid soil patch.
3. **Tend** with water; optional fertilizer boosts.
4. **Grow** through stages based on time + sunlight + hydration.
5. **Harvest** yields (seeds + décor points).
6. **Place décor** earned via harvest milestones.

**Pillars:** gentle tactility • legible systems • low‑poly calm • short session wins.

---

## 3) Player controls & input

* **Move:** WASD; **Look:** mouse (Pointer Lock).
* **Interact/Use:** `E` (context sensitive: plant/water/harvest/pick up).
* **Tool cycle:** `1` Shovel, `2` Watering Can, `3` Shears/Hand.
* **Sprint:** `Shift`, **Jump:** `Space`, **Crouch:** `Ctrl` (optional).
* **Inventory:** `Tab` open/close (grid UI).
* **Photo mode:** `P` (hides UI, adds slow orbit toggle).
* **Pause/Options:** `Esc` (key remap, volumes, mouse sensitivity, motion/bob toggle).

Accessibility defaults: colorblind‑safe palette; no rapid flashes; remappable keys; hold vs toggle interactions configurable.

---

## 4) World & level design

* **Bounds:** Square 60×60 m; 2 m high stone wall with single gate (locked for MVP).
* **Surfaces:** Walkable garden paths (nav mesh), soil beds (plantable), grass (non‑plantable).
* **Authoring:** Hand‑placed paths/beds/props (benches, lanterns).
* **Procedural:** Scatter grass clumps, small rocks, wildflowers via seeded RNG on load for variation.

**Colliders:** heightfield or tiled planes for ground; convex colliders for props; invisible blockers to prevent exploits.

---

## 5) Time & simulation

* **Game day length:** 10 minutes real time.
* **Sun:** Directional light rotates once per game day; intensity curve drives sunlight scoring.
* **Ticks:** Simulation step at 5 Hz; growth updates every 1 s.
* **Pause:** Pauses simulation; photo mode does not pause.

---

## 6) Plants (systems)

### 6.1 Species (8 at MVP)

* Daisy, Tulip, Lavender, Sunflower, Fern, Succulent, Tomato, Maple Sapling.

**Stats per species:**

* `requirements`: sunlight \[0..1], water \[0..1], fertility \[0..1].
* `growthRate`: base growth points/sec under ideal conditions.
* `tolerances`: water deficit/overwater thresholds; shade tolerance.
* `stages`: array of {name, meshId, minGP} culminating in harvestable or mature.
* `yield`: seeds count, décor points.

### 6.2 Growth model

* Each instance accumulates **Growth Points (GP)** per second:
  `GP += growthRate × condMultiplier` where `condMultiplier` is product of clamped factors for sunlight, hydration, fertility (0..1 each, with soft caps).
* Hydration decays over time; watering increases up to species cap; overwatering stalls growth briefly.
* Reaching `minGP` of next stage triggers stage switch (swap mesh/LOD and collider if needed).
* Harvest sets plant to post‑harvest stage (with cooldown) or despawns and spawns seed items.

### 6.3 Planting rules

* Only on **soil bed tiles**, min clearance radius per species.
* Raycast from crosshair; if valid, show ghost preview (green/red).
* Plant consumes one seed item; creates plant instance entity.

---

## 7) Tools & interactions

* **Shovel:** toggles plantable soil (prepare/restore), removes seedlings, rotates décor.
* **Watering can:** holds finite water (UI bar); refills at pond or faucet; emits short particle arc; applies hydration to plants in a small cone.
* **Shears/Hand:** harvest when stage == harvestable; pick up loose items.

**Interaction feedback:** crosshair highlight → tooltip (verb + noun) → short SFX + UI tick.

---

## 8) Inventory & items

* **Model:** grid (5×6) with stackable items (seeds, fertilizer, décor tokens).
* **Weight:** none in MVP.
* **Pickup radius:** 1.2 m with magnet snap.

**Item types:** `seed`, `consumable`, `tool`, `decor`, `quest` (unused in MVP).

---

## 9) Rendering & performance

* **Renderer:** Three.js WebGL2; shadow map `PCFSoftShadowMap`.
* **Lighting:** 1 Directional Sun + low Ambient; lanterns (no real shadows) as emissive props.
* **Materials:** StandardMaterial variants; shared materials for plant instances; gamma‑corrected with sRGB textures.
* **Instancing:** InstancedMesh for grass/wildflowers; merged BufferGeometry for bed borders.
* **LOD:** 2–3 levels on higher‑poly plants/props; culled by distance + frustum.
* **Post:** FXAA only; optional vignette (off by default).
* **Budgets:** ≤100k on‑screen tris; ≤120 draw calls peak; textures ≤2048; atlas where feasible.

---

## 10) Audio

* Web Audio API via Three.js positional audio.
* **Ambient loop:** birds, wind, distant water.
* **SFX:** plant, water splash, harvest, inventory, UI.
* **Mix:** master, sfx, ambient sliders.
* **Subtitles:** not required; short textual cues for key events (e.g., “Plant needs water”).

---

## 11) Data schemas (JSON‑like)

**PlantSpecies**

```json
{
  "id": "sunflower",
  "displayName": "Sunflower",
  "modelId": "plant_sunflower_stage",
  "requirements": {"sunlight": 0.8, "water": 0.6, "fertility": 0.5},
  "tolerances": {"overwater": 0.9, "underwater": 0.2, "shade": 0.3},
  "growthRate": 1.0,
  "stages": [
    {"name": "seed", "minGP": 0, "mesh": "sunflower_0"},
    {"name": "sprout", "minGP": 20, "mesh": "sunflower_1"},
    {"name": "juvenile", "minGP": 60, "mesh": "sunflower_2"},
    {"name": "harvestable", "minGP": 120, "mesh": "sunflower_3"}
  ],
  "yield": {"seeds": 2, "decorPoints": 1},
  "seedItemId": "seed_sunflower",
  "tags": ["tall", "bright"]
}
```

**PlantInstance**

```json
{
  "id": "pi_001",
  "speciesId": "sunflower",
  "position": [12.3, 0.0, -4.2],
  "stageIndex": 1,
  "growthPoints": 37.2,
  "hydration": 0.54,
  "fertility": 0.6,
  "sunlightAccum": 0.72,
  "lastUpdated": 12345678,
  "soilTileId": "tile_23",
  "flags": {"harvestable": false, "stressed": false}
}
```

**InventoryItem**

```json
{"id":"seed_sunflower","type":"seed","displayName":"Sunflower Seed","stack": 8}
```

**SaveGame (IndexedDB)**

```json
{
  "version": 1,
  "player": {"pos":[0,1.6,0], "rot":[0,0,0], "inventory":[...]},
  "world": {"seed": 84715, "decor":[...], "soilTiles":[...]},
  "plants": [ ... PlantInstance ... ],
  "time": {"day": 3, "clock": 0.45}
}
```

---

## 12) Architecture

**Approach:** Scene‑graph + managers; lightweight state with Zustand; event bus for decoupling.

**Core modules:**

* `App`: bootstrap, renderer + main loop, resize.
* `SceneManager`: loads level, registers colliders, lighting.
* `PlayerController`: input, movement (capsule), interaction raycast.
* `Physics`: cannon‑es world, step, character collider, contacts.
* `PlantManager`: species registry, instances, growth ticks, planting/harvest API.
* `Inventory`: data + UI binding; item pickup/consume.
* `UI`: HUD, prompts, inventory grid, photo mode, options.
* `SaveLoad`: IndexedDB persistence, schema versioning, migrations.
* `AudioManager`: ambient + SFX, spatial attach/detach.
* `ProceduralScatter`: seeded placement of grass/rocks/wildflowers (InstancedMesh).
* `Options`: settings store (keybinds, sensitivity, volumes, motion reduction).

**State (Zustand slices):**

* `player`, `time`, `plants`, `inventory`, `world`, `ui`, `options`.

**Event bus topics:** `INTERACT`, `PLANTED`, `WATERED`, `STAGE_CHANGED`, `HARVESTED`, `SAVE_REQUEST`, `ERROR`.

---

## 13) File structure

```
/3dgarden
  /public
    index.html
  /src
    main.js
    app/App.js
    core/events.js
    core/input.js
    core/options.js
    render/sceneManager.js
    render/lighting.js
    render/materials.js
    physics/physics.js
    player/playerController.js
    plants/plantManager.js
    plants/species/*.json
    ui/hud.css
    ui/hud.js
    ui/inventory.js
    audio/audioManager.js
    world/proceduralScatter.js
    world/level.json
    data/saveLoad.js
  /assets
    /models (glTF)
    /textures (PNG/JPG, sRGB)
    /audio (ogg/mp3)
  vite.config.js
  package.json
  README.md
```

---

## 14) Dev environment

* **Node 20+**, **Vite** for instant reload.
* **Packages:** `three`, `cannon-es`, `zustand`, `mitt` (event bus), `idb-keyval` (IndexedDB helper), `@types/*` if TS is adopted later.

**Scripts**

```json
{
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
}
```

**Index.html** includes canvas and minimal HUD root; CSS resets; `pointer-events: none` on HUD elements except inventory.

---

## 15) Rendering setup (concrete)

* Camera: Perspective 75°, near 0.1, far 200.
* Sun: directional, cascaded shadow not required; shadow map 2048; bias tuned to avoid acne.
* Gamma: renderer.outputEncoding = sRGBEncoding; physicallyCorrectLights = true.
* Frustum culling: default + manual on dense instancing sectors.
* Mobile: blocked for MVP (warn banner).

---

## 16) Physics details

* World step: fixed 60 Hz with accumulator; substep clamp to 5.
* Player: capsule (radius 0.35, height 1.2), ground friction/air control tuned for park‑walk feel.
* Collisions: ground (static plane/mesh), props (static bodies), plants as triggers (AABB) for interact prompts only.

---

## 17) UI flow (wireframe text)

* **HUD:** crosshair + context tooltip; bottom‑right tool icon & water gauge; top‑right clock + day; bottom‑left inventory hotbar (1‑3 tools).
* **Inventory (`Tab`):** grid, drag/drop, item tooltip, split stacks via `Shift`.
* **Options:** key remap, sensitivity, volumes, motion toggle, graphics (shadows on/off, foliage density).
* **Photo mode:** hides HUD; optional focal length slider; save to image via `toDataURL`.

---

## 18) Save/load & migration

* **Store:** IndexedDB `3dgarden_db`, object store `saves:v1` with key `slot_0`.
* **Atomicity:** write to temp key then swap.
* **Versioning:** integer `version`; migration table for future schema changes.
* **Autosave:** every 60 s and on quit.

---

## 19) Acceptance criteria (MVP)

1. Player can enter pointer lock, move, jump, and collide with world without clipping.
2. Crosshair highlights valid interactions; tooltip names action and target.
3. Planting a seed spawns a visible seedling at crosshair point on soil beds only.
4. Watering increases hydration; visual particle plays; hydration decays over time.
5. Plants advance through at least 4 stages on a 10‑minute day; sunlight affects growth (faster midday).
6. Harvesting produces seed items; inventory updates; seeds can be replanted.
7. Save/quit/reload restores player position, time of day, plants, hydration, inventory.
8. Frame time budget met on reference device (Intel Iris Xe/Apple M1) at 1080p (60 FPS ±10%).
9. Options allow remapping keys and toggling motion/bob; settings persist.
10. Tutorial prompts appear contextually and can be dismissed.

---

## 20) QA checklist

* Spawn at 10 random points: no stuck states; FPS >55.
* 100 simultaneous plants: growth correctness within 1% of expected GP.
* Pointer lock loss/regain does not break input.
* Save during watering: no corrupted hydration; reload stable.
* No more than 1 draw call per plant LOD material set; instanced foliage under 10 draw calls.
* Memory after 30 min session < 400 MB; no steady leak >1 MB/min.

---

## 21) Milestones (4‑week plan)

**Week 1 — Foundations**

* Vite project, rendering bootstrap, sun/sky, ground, wall.
* Player controller + physics capsule; interaction raycast; HUD skeleton.
* IndexedDB save stub; options menu skeleton; audio manager + ambient.

**Week 2 — Gardening loop**

* PlantManager (species registry, instances); hydration + growth ticks; watering can particles.
* Inventory grid; seed items; planting/harvest rules; tool cycle.
* Instanced foliage + basic LOD; performance pass #1.

**Week 3 — Content & UX**

* Author level pass; scatter rocks/wildflowers; add 8 plant meshes/LODs.
* Tutorial prompts; photo mode; SFX polish; options remap; autosave.
* Performance pass #2; shader/material atlas; shadow tuning.

**Week 4 — Hardening**

* Acceptance criteria sweep; cross‑browser tests; save migration v1.
* Accessibility checks; docs/README; packaging & simple deploy (Netlify/GitHub Pages).
* Stretch prep hooks (weather/seasons toggles off by default).

---

## 22) Stretch goals (post‑MVP)

* **Seasons & weather:** seasonal palettes; rain event hydrates beds; temperature affects growthRate.
* **Pollinators:** butterflies/bee swarms with simple flocking, boosting yields.
* **Crafting:** compost → fertilizer; décor recipes; placeable planters.
* **Photo quests:** daily shot list (“capture a sunflower at dawn”).

---

## 23) Content pipeline & guidelines

* **Models:** glTF 2.0; apply scale/rotation; origin at base; LOD0 ≤2.5k tris, LOD1 ≤800, LOD2 ≤200.
* **Textures:** sRGB PNG/JPG; albedo only for plants (no normal maps in MVP); atlas plants by family.
* **Naming:** `plant_<species>_<lod>.gltf`; `mat_plant_leaf_generic`.
* **Export:** Blender: Shade Smooth; UV islands ≥6 px at 2k atlas; pack with margin.

---

## 24) Risk register & mitigations

* **Perf cliffs from foliage.** → Instancing, density scaler, early culling, cheap shaders.
* **Pointer lock UX.** → Clear prompt, escape fallback, click‑to‑resume overlay.
* **Save corruption.** → Double‑write + CRC; autosave throttle; try/catch with UI notice.
* **Cross‑browser quirks.** → Test often; feature‑detect; conservative WebGL features.
* **Art bottleneck.** → Use placeholder primitives; swap meshes late without code changes.

---

## 25) Example code skeletons (abridged)

**/src/main.js**

```js
import { App } from './app/App.js';
new App(document.getElementById('app')).start();
```

**/src/app/App.js**

```js
import * as THREE from 'three';
import createStore from 'zustand/vanilla';
import { PlayerController } from '../player/playerController.js';
import { SceneManager } from '../render/sceneManager.js';
import { Physics } from '../physics/physics.js';

export class App {
  constructor(root) {
    this.root = root;
    this.clock = new THREE.Clock();
  }
  start() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.root.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 1.6, 5);

    this.physics = new Physics();
    this.sceneManager = new SceneManager(this.scene, this.renderer);
    this.player = new PlayerController(this.camera, this.renderer.domElement, this.physics);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.loop();
  }
  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.033);
    this.physics.step(dt);
    this.player.update(dt);
    this.sceneManager.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
```

**Plant growth tick (concept)**

```js
function tickPlant(p, species, env) {
  const sun = env.sunlightAt(p.position);  // 0..1
  const water = clamp01(p.hydration / species.requirements.water);
  const fert = clamp01(p.fertility / species.requirements.fertility);
  const mult = Math.min(1, sun / species.requirements.sunlight) * water * fert;
  p.growthPoints += species.growthRate * mult * env.dt;
  p.hydration = Math.max(0, p.hydration - env.dryRate * env.dt);
  if (p.growthPoints >= species.stages[p.stageIndex + 1]?.minGP) advanceStage(p);
}
```

---

## 26) Deployment

* Static hosting (Netlify/GitHub Pages).
* Cache busting via Vite manifest.
* IndexedDB domain‑bound saves; note that clearing site data deletes saves.

---

## 27) Legal & licenses

* Third‑party libs under MIT or compatible.
* Any external art/audio must be CC0/CC‑BY with attribution file in `/assets/ATTRIBUTIONS.md`.

---

## 28) Future hooks (pre‑wired)

* Weather toggle and seasonal palette slot in lighting manager.
* Pollinator spawners reading from plant bloom tags.
* Crafting service stub reading recipes JSON.

---

**End of spec.**
