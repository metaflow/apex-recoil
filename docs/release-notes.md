# v0.2 Accurate pattern scale, scoring, performance, and more

[v.01 announce on reddit](https://www.reddit.com/r/apexlegends/comments/mosk0l/i_have_created_an_app_to_practice_recoils) got some attention to the app and users pointed out multiple improvement points.

- Improved the method to collect recoil patterns found that previous patterns were bigger by around 15%. I have also found, by trying to accurately compensate with different scopes and FOV from 70 to 110, that recoil is absolute and does not scale with ADS or FOV. So there is not need to introduce ADS and FOV settings. Confirmed that new patterns are *identical with the game*.

- Reworked scoring [old formula](https://www.desmos.com/calculator/ptb2ipcscr), [new formula](https://www.desmos.com/calculator/j7vjbzvuly). Reasoning:
    1. Small errors should not decrease the score a lot.
    2. Real recorded patterns should score 90+ points.
    3. Increasing the error value should gradually decrease the    score to almost 0 at a distance of 100px (approximate body size from 20m). In-game "score" is a binary value that suddenly drops drops "hit" to "no-hit" but that would not be useful for training.

- Removed attachments level selection. The reason is twofold: 1) It's generally recommended to practice with no attachments. 2) The difference between trails is mostly in vertical scale, not form ([r99 diff](./res/r99_diff.png), [flatline diff](./res/faltline_diff.png)). In-game better attachments decrease randomness; training patterns are averages so randomness is removed. Keeping that in mind, the effort to record and support different types of attachments seems redundant. Typically it takes me around 1h to collect and process ~10 trails for one weapon config. Oh yes, it also means that **new weapon types will be added soon**er than I initially planned!

- Improved performance and added FPS display.

- Removed the "Real trace" option that was used to pick the "raw" pattern. Mean one is much more useful for training.

- Added a custom "red dot" cursor. Disabled right mouse click on the area.

- Added weapon titles.

- Added FAQ page, including controller settings.

# v0.1 Initial version

First version with r99, r301, Flatline, and Volt x 4 possible attachment levels.