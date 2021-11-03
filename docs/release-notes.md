# v19

- C.A.R. recoils;

- updated crosshair to be easily distinguishable from hit markers;

- added scale: it's useful if your sensitivity is too high and pattern is very small. You can also set is proportional to 4:3 (e.g. 1.3 x 1).

# v18

Now shooting is interrupted when you release the mouse button. Score is computed for the bullets already shot and not recorded.

# v17

Simplified Chinese translation. Thank you, @SkywalkerJi!

# v16

Updates to L-STAR mag size after [evolution collection event](https://www.ea.com/en-gb/games/apex-legends/news/evolution-collection-event).

# v15

Recoils and weapons updates for the Season 10.

- Prowler is removed as it only has burst mode.

- Added mag levels for L-Star.

- Added special fixed mag for drop weapons (Spitfire and Alternator).

- Added Rampage and ad toggle for it's "Revved Up" mod.

# v14

- "Invert Y" setting.

# v13

- Russian locale.

- Fix: tooltips not being fully visible.

# v12 small updates

- Fixed a bug when moving target disappeared after switching back to the app from other tab.

- Added a note and AHK script on how to lower window sens if in-game sensitivity is very low.

- Added scrolling to the control panel if windows height is too small.

# v11 Moving target and UI

- Added "moving target" mode, stats are tracked separately for it. Speed is not taken in account as there are many variables to consider beside that.

- Updated UI controls to make mode selection easier.

- Added hints to many controls.

# v10 Firing area and spitfire mag size

- Added a dotted region that shows a good starting position for a spray. If region is too small user will see a warning.

- Updated mag size and audio for Spitfire with a purple mag.

- Now versions are just sequential numbers as I realized that the game is useful already and it's not clear what should be "v1.0".

# v0.9 Reworked simulation

- Added a new "stationary target" option. If unchecked then crosshair will be pinned to the initial position, the target and hit markers will move. That experience should feel closer to the game. Thank you [u/Fartikus](https://www.reddit.com/user/Fartikus) for the suggestion!

- Removed the "show pacer" option as "target" fulfills its purpose naturally. Statistic records with "hints" on and "pacer" off are dropped.

# v0.8 L-STAR patterns

- added L-STAR patterns. That completes the list!

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