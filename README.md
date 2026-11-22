# Solmarina: Streets of Gold

An original open-world crime game for the make.fun **gta6-01** bounty — a
complete, playable rendition of the genre in the spirit of GTA 6, built from
scratch in vanilla JavaScript and Canvas. No libraries, no network requests,
no copied assets: every line, sound and pixel is original.

## The game

Dana Reyes, a courier scraping by in Solmarina — a sun-soaked coastal city of
avenues, a park, a beach and a harbour — gets pulled into the turf war between
the Marlins and the Dockside Kings. Seven story missions, then free roam.

**Systems**

- **Open city** — drive and walk a 3840×2880 grid city with traffic, pedestrians, a beach, a park, a harbour and a marina, plus a lighthouse and a smuggler's pier on the south-east shore.
- **Driving** — arcade car physics with drift, damage and smoke; six car models plus a motorcycle (Corsaro 900) — the fastest ride in town, with a wobble at top speed and a rider who feels every crash. Steal any parked or traffic vehicle (E) — the police notice.
- **Weather** — clear, rain and fog roll in on their own (R or the pause menu changes it). Rain makes the roads slick; fog cuts visibility and police sight. Rain patter and wet-road sheen are drawn and heard.
- **Wanted level** — 0–5 stars. Police cars coordinate: one chases while another cuts ahead to block your escape route. Officers on foot take cover from an armed player instead of charging in. Wanted stars only decay when no police can actually see you — line of sight matters, and fog is your friend. Hide, outrun them, or pay the garage to cool off.
- **Combat** — fists, pistol, SMG, shotgun and a long-range rifle with real recoil; armour vests soak 70% of incoming damage; gang shootouts during missions; health, ammo and cash pickups.
- **Missions & story** — seven missions: deliveries, a car theft, a dock shootout, a police getaway, a chased exchange, a final boss fight against Rico, and a timed harbour smuggling run against a 75-second clock.
- **Economy** — earn cash from missions and pickups; spend it on repairs, repaints, weapons, ammo and food.
- **HUD & minimap** — health, armour, cash, wanted stars, weapon/ammo, objective banner, weather readout, live minimap with mission marker and police blips (N zooms it in on your streets), and a photo mode (P) that hides the HUD for a clean shot.
- **Save** — progress autosaves (localStorage): cash, missions, weapons, weather, position. Two slots: the pause menu can write a backup to slot 2.
- **Sound** — fully synthesized WebAudio: engine hum (higher and buzzier on the bike), sirens that escalate from a wail to a yelp at 4–5 stars, rain patter, gunshots, jingles and a procedural music loop. No audio files.
- **Day & night** — a full day cycle with dusk lighting, street glow and headlights.
- **People** — pedestrians stroll, joggers loop the beach and park, and phone zombies notice danger a beat late.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk, or drive when in a car |
| Shift | Sprint on foot |
| E | Enter / exit the nearest car |
| Space | Punch (on foot) / brake (driving) |
| Mouse + click | Aim and shoot |
| 1 / 2 / 3 / 4 / 5 | Switch weapon (fists, pistol, SMG, shotgun, rifle) |
| G / H / F | Context actions at shops (repair, buy ammo, eat) |
| Esc | Pause • M mute • Tab hide HUD |
| P | Photo mode (hides the HUD) |
| N | Minimap zoom |
| R | Change the weather (clear, rain, fog) |

## Run it

```sh
node serve.ts          # serves game/ on http://localhost:8080
```

Or serve `game/` with any static server and open `index.html`. The game needs
no network: everything it loads is a file under `game/`.

## Screenshots

`screenshots/` holds four real renders of the game's own code, staged with
`?shot=` queries (`shots.json`): the title screen, riding the Corsaro 900
motorcycle down the avenue, a three-star police chase in the rain with a
blocker cutting the escape route, and the new seventh mission — Harbour Run
in the fog.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the kit's vendored `vendor/makefun-game.ts`.

## License

MIT — see `LICENSE`.
