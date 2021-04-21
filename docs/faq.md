# Frequently asked questions

## How accurate are the patterns?

I've tested every pattern by replaying it in-game with a few different scopes and game options (like FOV and mouse sensitivity). That was done with a hardware mouse simulator (Arduino board).

It's assumed that your Windows sensitivity is 6/11 and the "Enhance pointer precision" is off so every mouse count equals 1 pixel on the screen.

## Controller support

You can try to use Steam controller support `Settings > Controller > Desktop Configuration`.

According to my experiments, these mouse sensitivity values should be close to in-game:

| Apex Legends     | 1     | 2     | 3     | 4     | 5     | 6    | 7     | 8    |
|------------------|-------|-------|-------|-------|-------|------|-------|------|
| Steam controller | 0.123 | 0.198 | 0.388 | 0.594 | 0.939 | 1.12 | 1.222 | 1.24 |

Pick the response curve, [this post might help](https://www.reddit.com/r/apexlegends/comments/bpkzn4/advanced_look_controls_response_curve_guide/).

Steam does not disable mouse movement for non-steam games, your controls might be funky.

*Disclaimer*: I play on the keyboard and mouse and have not tested with a controller. Sensitivity numbers above were computed with [xbox controller emulator](https://github.com/dmadison/ArduinoXInput) and having a linear response pattern. Trying to emulate the recoil movement of a gamepad seems to be non-trivial.

## How scoring works

Scores are counted separately for different settings (mag, weapon, enabled hints).

[Scoring formula](https://www.desmos.com/calculator/csaihi8x3j) (x = distance to the "ideal" point normalized to the mouse sensitivity).

The reasoning for the shape and constants selection:
1. Small errors should not decrease the score a lot.
2. Real recorded patterns should score 90+ points.
3. Increasing the error value should gradually decrease the score to almost 0 at a distance of 150px (approximate body size from 20m). In-game "score" a binary value that suddenly drops drops "hit" to "no-hit" but that would not be useful for training.

## No registration?

As you probably noticed there is no registration and email confirmation.
Settings and scores are stored locally in your browser. Please don't ask me if you lost them after browser or system update.

## FPS

Normally you should see FPS values around 60: that's the default browser cap on animations. From time to time browser can also decide that 30 FPS is all you need - restarting usually helps.

## I have an issue/idea!

If something is broken or you have an improvement idea, please [create an issue](https://github.com/metaflow/apex-recoil/issues/new).