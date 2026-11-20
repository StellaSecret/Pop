# Pop — arcade de ballons en Rust / WebAssembly

Jeu de tir sur ballons jouable dans le navigateur. Toute la logique métier et la
physique sont implémentées en Rust et compilées en WebAssembly ; TypeScript ne
gère que l'interface, le Canvas 2D, le Web Audio et les API navigateur.

## Architecture

```
Pop/
├── src/                     Moteur Rust (aucune dépendance navigateur)
│   ├── lib.rs               Interface WASM (wasm-bindgen)
│   └── engine/
│       ├── balloon.rs       Données d'un ballon + format du snapshot
│       ├── config.rs        Difficultés, niveaux, palette
│       ├── map.rs           Cartes et dispositions d'obstacles
│       ├── obstacle.rs      Obstacles destructibles + snapshot
│       ├── physics.rs       Intégration, rebonds, collisions (ballons/obstacles)
│       ├── rules.rs         Score et combos
│       ├── rng.rs           Générateur pseudo-aléatoire déterministe
│       └── game.rs          Cycle de vie, apparitions, état de la partie
├── tests/                   Tests d'intégration navigateur (Playwright)
├── web/
│   ├── src/main.ts          Boucle requestAnimationFrame + entrées
│   ├── src/engine.ts        Pont typé vers le moteur WASM
│   ├── src/renderer.ts      Rendu Canvas 2D
│   ├── src/audio.ts         Web Audio (enregistrements réels)
│   ├── src/ui.ts            Contrôles et statistiques
│   └── public/sounds/       Enregistrements CC0 de ballons qui éclatent
├── Cargo.toml
└── Makefile
```

## Lancer le projet

Prérequis : Rust (cible `wasm32-unknown-unknown`), `wasm-pack`, Node.js 18+.

```bash
rustup target add wasm32-unknown-unknown   # si nécessaire
make build                                # compile le WASM puis l'app web
cd web && npm run dev                     # serveur de développement
```

Ouvrez l'URL affichée par Vite (par défaut `http://localhost:5173`).

Pour tester la version de production :

```bash
make build
cd web && npm run preview
```

Les artefacts WASM étant générés dans `web/src/wasm/`, ils sont fournis dans le
dépôt. Pour les régénérer après une modification Rust : `make wasm`.

## Commandes utiles

| Commande | Rôle |
| --- | --- |
| `make build` | WASM + application web de production |
| `make dev` | Rebuild WASM puis serveur Vite |
| `cargo test --lib` | Tests unitaires Rust (physique, règles, cartes, moteur) |
| `cd web && npm run typecheck` | Vérification TypeScript stricte |
| `cd web && npm run test:e2e` | Tests navigateur Playwright (build first) |

> Les tests Playwright nécessitent un Chromium installé via
> `npx playwright install chromium` et un environnement glibc standard
> (ils ne peuvent pas s'exécuter sur Alpine/musl).

## Contrôles

- Cliquez / touchez un ballon pour l'éclater.
- **Carte** : Nuit (aucun obstacle), Clairière (buissons/rochers) ou Salon (canapé/table/caisses). Les obstacles bloquent les ballons ; toutes les armes peuvent les détruire (grenade : 3 dégâts, autres : 1). Changer de carte relance la partie.
- **Arme** : clic simple (éclat instantané au curseur), fusil automatique (maintenez : rafales de 3 projectiles à ~12 t/s, impact de 22 px), lance-flammes (long cône continu) ou grenade (arc + explosion de rayon 70 px). Les projectiles du fusil et de la grenade partent du bas de l'écran vers le curseur.
- Enchaînez les éclats en moins de 2 secondes pour augmenter le combo.
- **Mode** : Arcade (sans fin) ou Défi (nombre de ballons fixe, sans réapparition).
- **Défi** : saisissez votre nom avant de commencer ; le chrono s'arrête au dernier ballon et un message personnalisé s'affiche.
- **Difficulté** : Facile, Normal, Difficile, Extrême (vitesse et apparition).
- **Ballons** : `0` = nombre adapté au niveau ; en Défi, la valeur du curseur fixe le nombre de ballons.
- **Volume / Son** : réglage et désactivation de l'audio.
- **Pause**, **Nouvelle partie**, **Plein écran**.

## Interface WASM

Le moteur expose une classe opaque `PopGame` et deux fonctions statiques. La
documentation complète se trouve dans `src/lib.rs` et dans le fichier
`web/src/wasm/pop_engine.d.ts` généré.

| Membre | Description |
| --- | --- |
| `new PopGame(width, height, difficulty, seed)` | Crée une partie. Difficulté : 0..3. |
| `resize(width, height)` | Redimensionne la zone et replace les ballons. |
| `set_difficulty(id)` | Change la difficulté et redémarre la partie. |
| `set_map(id)` | Change la carte (`0` Nuit, `1` Clairière, `2` Salon) et redémarre la partie. |
| `start_challenge(n)` | Lance un défi de `n` ballons, sans réapparition. |
| `set_arcade_mode()` | Revient au mode arcade infini. |
| `set_target_count(n)` | Force le nombre cible ; `0` = automatique. |
| `update(dt)` | Avance la simulation (dt en secondes, borné à 50 ms). |
| `pop_at(x, y)` | Éclate le ballon sous le point, sinon inflige 1 dégât à l'obstacle ; renvoie `{popped, id, x, y, color_index, points, combo, obstacle_hit, obstacle_destroyed}`. |
| `hit_at(x, y, damage)` | Même chose avec une quantité de dégâts personnalisée. |
| `pause()` / `resume()` / `is_running()` | Cycle de vie. |
| `restart()` | Nouvelle partie. |
| `snapshot_ptr()` / `snapshot_len()` | Pointeur et taille du buffer de rendu. |
| `header_len()` / `view_stride()` / `obstacle_view_stride()` | Constantes de layout (10 / 7 / 5). |
| `header_offsets()` | Offsets nommés de l'en-tête. |
| `info()` | Difficultés, palette, constantes. |
| `wasm_memory()` | `WebAssembly.Memory` contenant le snapshot. |

### Protocole de snapshot

Pour éviter un appel JS ↔ WASM par ballon, une seule lecture par frame suffit :

```
[ en-tête : 10 f32 ][ ballon : 7 f32 ] ... [ obstacle : 5 f32 ] ...
```

En-tête : `score, combo, max_combo, niveau, ballons actifs, enregistrements, temps écoulé, terminé, temps final, obstacles`.

Enregistrement ballon : `id, x, y, rayon, index_couleur, état (0=actif, 1=éclaté), progression d'éclat (0..1)`.

Enregistrement obstacle : `x, y, rayon, ratio de vie (0..1), type (0=buisson, 1=rocher, 2=caisse, 3=canapé, 4=table)`.

```ts
const mem = wasm_memory() as WebAssembly.Memory;
const data = new Float32Array(mem.buffer, game.snapshot_ptr(), game.snapshot_len());
const score = data[0];
const firstBalloonX = data[10 + 1];
```

Le pointeur doit être relu à chaque frame : le buffer peut être déplacé lors
d'un redimensionnement. `engine.ts` met cette vue en cache et ne la recrée que
si le pointeur, la taille ou le `ArrayBuffer` change.

## Physique et performance

- Delta time borné pour une simulation indépendante du framerate.
- Rebonds sur les quatre bords et les obstacles, collisions élastiques entre
  ballons avec correction de pénétration et masses proportionnelles au carré du rayon.
- Grille spatiale uniforme (broad phase) dont les seaux sont réutilisés pour
  éviter les allocations dans la boucle.
- Snapshot unique, une seule vue `Float32Array` partagée, rendu Canvas 2D
  sans création de dégradé par ballon.
- Cible : 200 ballons simultanés (réglage « Ballons » sur 200).

## Audio

Aucun son n'est synthétisé. Deux **vrais enregistrements** de ballons qui
éclatent sont chargés, décodés puis alternés (avec une légère variation de
hauteur) à chaque éclatement :

- `balloon-pop-1.*` — *Balloon Pop* par Gniffelbaf, domaine public (CC0),
  via [OpenGameArt — Balloon Sounds](https://opengameart.org/content/balloon-sounds).
- `balloon-pop-2.*` — *bubbles 'pop'* par farfadet46, CC0,
  via [OpenGameArt — bubbles 'pop'](https://opengameart.org/content/bubbles-pop).

Chaque enregistrement est fourni en `.mp3` (compatibilité navigateur) et en
`.ogg`. Le gestionnaire audio gère les erreurs de chargement/décodage, le
volume, la désactivation, le déverrouillage après geste utilisateur et limite
le nombre de voix simultanées.
