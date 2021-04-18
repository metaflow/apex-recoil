# v0.2 Accurate pattern scale, first feedback

[Reddit post](https://www.reddit.com/r/apexlegends/comments/mosk0l/i_have_created_an_app_to_practice_recoils) got some attention to the app and users pointed out to multiple improvement points.

- I have looked more closely on the scale of the patterns. They've turned up to be bigger by around 15%.

    As it's possible to see player orientation in game with `cl_showpos 1`, "mouse pixel distance" is now calculated from the angle between two points (instead of relying on what WinAPI returns for mouse movement). After that angle is converted to pixels<sup>[source](http://vergeofapathy.com/mouse-sensitivity-apex/)</sup>. 

    I have also found, by trying to accurately compensate with different scopes and FOV from 70 to 110, that **recoil is absolute and does not scale with ADS or FOV**.

    Double checked that new patterns match 1:1 with the game.

- Removed "Real trace" option that was used to pick originally taken trace pattern. Mean one is much more useful for training.

- Removed attachments level selection. The reason is twofold: 1) It's generally recommended to practice with no attachments. 2) The difference between trails is mostly in minor vertical scale ([r99 diff](./res/r99_diff.png), [flatline diff](./res/faltline_diff.png)). It does not seem to be worth time it takes to record all trails: typically it takes me around 30m to encode 10 trails for one weapon config. On the bright side it means that **new weapon types will be added soon**!

- Disabled right mouse click on the area.

- Improved performance and added FPS display.

# v0.1 Initial version

First version with r99, r301, Flatline, and Volt x 4 possible attachment levels.