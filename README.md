# About

https://apexlegendsrecoils.net

Visualization of recoil patterns from [Apex Legends](https://www.ea.com/games/apex-legends).

[How recoils are captured](./docs/capture.md).

# Contributing and support

I would appreciate a kind word and up arrow [on Reddit](https://www.reddit.com/r/apexlegends/comments/mosk0l/i_have_created_an_app_to_practice_recoils/). Or just tell your friends about it.

You can also help this project by suggesting an idea or contributing (I would still recommend to start with the idea). Check [contributing](./docs/contributing.md) and [Code of conduct](./docs/code-of-conduct.md).

# License and disclaimers

Source code licensed under [Apache 2](./LICENSE).

<ins>This project is not affiliated with or sponsored by Google.</ins>

<ins>This project is not affiliated with or sponsored by Electronic Arts Inc. or its licensors.</ins>

## Assets

Images, audio fragments, weapon names and behavior come from Apex Legends game or from websites created and owned by [Electronic Arts Inc.](https://ea.com) or [Respawn Entertainment](https://www.respawn.com/"), who hold the copyright of Apex Legends.

Some images and reference materials come from [Apex Legends Wiki](https://apexlegends.fandom.com/wiki).

Thus multimedia content from [assets](./assets) <ins>is NOT under Apache 2.0 License</ins>. Get in touch with EA if you want to use it.

## Running the app

For development run `npm run dev` and open `http://localhost:3000`. That will watch for file changes and update the
content of `./public`. Running `start` by itself will not rebuild
the bundle.

Deployment is completely static and assembled with `npm run static`.

Copy files from `./static` to the web server dir, for example by running `scp -r -i id_rsa .\static\* root@1.2.3.4:/var/www/html`.
