# v0.2 Accurate pattern scale, first feedback

[Reddit post](https://www.reddit.com/r/apexlegends/comments/mosk0l/i_have_created_an_app_to_practice_recoils) got some attention to the app and users pointed out to multiple improvement points.

I have looked more closely on the scale of the patterns. They've turned up to be bigger around 15%.

Now I have changed how patterns are collected. It's possible to get the precise angle between two points of the trail in game with `+cl_showpos 1`. After that angle is converted to pixels<sup>[source](http://vergeofapathy.com/mouse-sensitivity-apex/)</sup>. 

I have also found, by trying to compensate with different scopes and FOV from 70 to 110, that recoil is absolute and does not scale with ADS or FOV.

Double checked that new patterns match 1:1 with the game.

Removed "Real trace" option that was used to pick originally taken trace pattern. Mean one is much more useful for training.

# v0.1 Initial version

First version with r99, r301, Flatline, and Volt x 4 possible attachment levels.