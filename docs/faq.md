# Frequently asked questions

- **How accurate are the patterns?**

I've tested every pattern by replaying it in-game with a few different scopes and game options (like FOV and mouse sensitivity). That was done with a hardware mouse simulator (Arduino board).

It's assumed that your Windows sensitivity is 6/11 and the "Enhance pointer precision" is off so every mouse count equals 1 pixel on the screen.

- **Is there a controller support**

[You can control the cursor with your controller](https://uk.pcmag.com/controllers-accessories/132034/how-to-turn-your-game-controller-into-a-computer-mouse), e.g. Steam launcher supports it without any additional apps. I have no idea yet how to set it up to match in-game.

- **How scoring works**

Scores are counted separately for different settings (mag, weapon, enabled hints).

[Scoring formula](https://www.desmos.com/calculator/csaihi8x3j) (x = distance to the "ideal" point normalized to the mouse sensitivity).

Reasoning:
1. Small errors should not decrease the score a lot.
2. Real recorded patterns should score 90+ points.
3. Increasing the error value should gradually decrease the score to almost 0 at a distance of 150px (approximate body size from 20m).
   In-game "score" a binary value that suddenly drops drops "hit" to "no-hit" but that would not be useful for training.

- **No registration?**

As you probably noticed there is no registration and email confirmation.
Settings and scores are stored locally in your browser. Please don't ask me if you lost them.