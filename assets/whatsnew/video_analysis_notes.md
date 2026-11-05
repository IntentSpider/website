# IntentSpider video analysis + demo assets

## Source run
- Source screen recording: 434.85 seconds.
- 8,768 video frames were present in the source stream.
- Automated visual state detection found 398 distinct stable suggestion-state changes in the keyboard region.
- The developer-tools pane is excluded from all showcase clips.
- Showcase clips are rendered at 1280x720 and slowed to 0.5x so the typed context and suggestion row are readable.

## Conservative verified immediate-next-token hits
The audit intentionally separates **strict immediate-next-token evidence** from broader semantic/memory-cue examples. Four exact immediate-next-token hits were verified from the detected state sequence and frame review:
- 91.414 s: rank 1 `the` -> next typed token `the`.
- 179.205 s: rank 1 `redapplo` -> next typed token `RedApplo`.
- 325.632 s: rank 3 `the` -> next typed token `the`.
- 348.267 s: rank 1 `of` -> next typed token `of`.

This is **not presented as an overall accuracy percentage** because the recording was not designed as a fixed-target benchmark and many states do not provide an objectively defined next-word target. The RedApplo frame is the strongest personalized prediction evidence in this run.

## RedApplo presentation moments
- ~34.7 s: `redapplo` appears at rank 2 while the user has partially typed `RedAp…` (completion cue).
- 179.205 s: `redapplo` appears at rank 1 before the next typed token becomes `RedApplo` (strict next-token hit).
- ~316.3-316.7 s: `redapplo` appears at ranks 3 then 2 as a personal-memory cue; this is not an immediate-next-token hit.
- 368.729 s: `redapplo` appears at rank 3; a few seconds later a new sentence explicitly mentions lunch at RedApplo. This is a contextual memory-cue example, not strict next-token accuracy.

## Generated concept clips
- `IntentSpider_voice_search_memory_cue.mp4`: uses the supplied clean Google-search-bar image. The recognized text types naturally, then `RedApplo` appears in lower opacity during a hesitation and becomes solid when accepted.
- `IntentSpider_stylus_memory_cue.mp4`: photorealistic tablet + stylus concept. Handwritten text is followed by a lower-opacity `RedApplo` continuation.

## Recommended Huawei/demo framing
Use the RedApplo-focused reel as the primary evidence clip. A defensible line is: **“In this first recorded run, IntentSpider surfaces the personal name RedApplo at rank 1 before it is typed. We can rerun the same interaction live in front of the lab.”**

Do not call the broader semantic/memory-cue cases “target accuracy.” They are useful product-behavior examples, but they are a different claim.