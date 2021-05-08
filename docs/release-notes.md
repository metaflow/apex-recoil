# v0.7 scores graph

- Graph of best / median scores by day.

- Minor layout fixes.

# v0.6 updated spitfire and havoc patterns

- Updated spitfire and havoc patterns after the season 9 patch has landed. Difference in mean recoils is quite small. See https://www.reddit.com/r/apexlegends/comments/n50ps9/oc_changes_in_spitfire_and_havoc_recoils_in/.

# v0.5 all weapons

- All weapons are here! Havoc and Devotion have a Turbocharger. It does not affect their recoils, only makes them brrr faster.

- Rearranged weapons to match in-game order (AR, SMG, LMG, Pistols).

- Small style and performance improvements.

# v0.4 stats updates

- Fixed few issues with statistics storage.

- Added counter of "today tries" to the interface.

- Added Alternator (not verified in-game yet but should be very close).

# v0.3 slow-mode

- Added a "slow-mode": o. Statistics are not recorded for "slow-mode".

- Minor visual improvements and simple page for devices with width less than 900px.

# v0.2 Accurate pattern scale, scoring, performance, and more

[v.01 announce on reddit](https://www.reddit.com/r/apexlegends/comments/mosk0l/i_have_created_an_app_to_practice_recoils) got some attention to the app and users pointed out multiple improvement points.

- Improved the method to collect recoil patterns found that previous patterns were bigger by around 15%. I have also found, by trying to accurately compensate with different scopes and FOV from 70 to 110, that recoil is absolute and does not scale with ADS or FOV. So there is not need to introduce ADS and FOV settings. Confirmed that new patterns are *identical with the game*.

- Reworked scoring [old formula](https://www.desmos.com/calculator/ptb2ipcscr), [new formula](https://www.desmos.com/calculator/j7vjbzvuly). Now they are more forgiving for small errors.

- Removed attachments level selection. The reason is twofold: 1) It's generally recommended to practice with no attachments. 2) The difference between trails is mostly in vertical scale, not form ([r99 diff](./res/r99_diff.png), [flatline diff](./res/faltline_diff.png)). In-game better attachments decrease randomness; training patterns are averages so randomness is removed. Keeping that in mind, the effort to record and support different types of attachments seems redundant. Typically it takes me around 1h to collect and process ~10 trails for one weapon config. Oh yes, it also means that **new weapon types will be added soon**er than I initially planned!

- Improved performance and added FPS display.

- Removed the "Real trace" option that was used to pick the "raw" pattern. Mean one is much more useful for training.

- Added a custom "red dot" cursor. Disabled right mouse click on the area.

- Added weapon titles.

- Added FAQ page, including controller settings.

# v0.1 Initial version

First version with r99, r301, Flatline, and Volt x 4 possible attachment levels.