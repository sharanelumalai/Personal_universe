# Love Universe — Legendary V6

V6 is the final visual-match pass targeted at the approved cinematic preview. It keeps the V5 story/interaction system and adds stronger cinematic bloom, denser fantasy dressing, richer character rim lighting, a more detailed Heart Garden, a denser suspended Memory Lane, improved lanterns, and scene-by-scene composition matching.

## Run
```bash
npm install
npm run dev
```
Open the Vite URL (normally http://localhost:5173).

## Your memory photos
Put your images in `public/memories/` and update `src/config.js`.

## Heart audio
Put `heart-01.mp3` ... `heart-12.mp3` in `public/audio/`. For the Thank You tree use `thanks-01.mp3` ... `thanks-10.mp3`.

## Feedback
Configure the included `google-apps-script/Code.gs` and set the Apps Script URL in `src/config.js`.

## Visual note
This build targets the preview's composition, lighting and fantasy density while remaining real-time WebGL. Exact film-render identity still depends on the final 3D character/environment models; the project is structured so GLB assets can replace procedural objects without changing the story flow.

## V7 Targeted Finishing Pass
This build intentionally uses V7 as the base (not V8) and adds only the requested finishing changes:
- reduced/selective bloom and lower moon/heart brightness
- sparse magical background heart sparkles
- shooting star about every 5 seconds
- scene models raised higher in the viewport
- more human character proportions (smaller head/ears/eyes, longer torso/limbs)
- Catch My Heart button now triggers the girl's catch animation automatically
- compatibility values start at 0% and animate to 110 / 87 / 120 / 98 / 1000 after Start Scan
- question panel scrollbar is hidden and fields smoothly auto-scroll as the user progresses


## Final polish changes
- Mobile camera and UI framing retuned so the 3D character/environment remains visible on portrait phones.
- Moon rotates very slowly in every scene where it appears.
- Only empty decorative islands rotate; islands carrying the boy/girl/robot/tree stay stable.
- Added faint drifting nebula wisps and stardust behind the existing aurora/shooting stars.
- Characters use more human proportions, smaller facial features, longer limbs and articulated fingers.
- Candle/lantern local glow increased slightly without increasing the whole-screen exposure.
- Scene transitions are slower, smoother and use layered magical particles with a softer flash.
- Mild ambient love music remains enabled at a very low volume after the first interaction.
