/**
* Copyright 2021 Mikhail Goncharov
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*      http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

var gulp = require('gulp'),
    browserify = require('browserify'),
    source = require('vinyl-source-stream'),
    tsify = require('tsify'),
    fancy_log = require('fancy-log'),
    watchify = require("watchify"),
    gutil = require("gulp-util"),
    wait = require("gulp-wait"),
    livereload = require('gulp-livereload'),
    sass = require('gulp-sass')(require('sass')),
    maps = require('gulp-sourcemaps'),
    jsonSass = require('json-sass'),
    fs = require('fs'),
    concat = require('gulp-concat'),
    uglify = require('gulp-uglify'),
    cleanCSS = require('gulp-clean-css'),
    buffer = require('vinyl-buffer'),
    clean = require('gulp-clean');

sass.compiler = require('sass');

function compile_sass() {
    gutil.log(gutil.colors.green('Compiling styles...'));
    return gulp.src('./*.scss')
        .pipe(maps.init())
        .pipe(sass().on('error', sass.logError))
        .pipe(maps.write())
        .pipe(gulp.dest('./public'))
        .pipe(livereload());
}

function theme_sass() {
    gutil.log(gutil.colors.green('Compiling theme JSON to SASS...'));
    return fs.createReadStream('theme.json')
        .pipe(jsonSass({
            prefix: '$theme: ',
        }))
        .pipe(fs.createWriteStream('theme.scss'));
}

function scripts(watch) {
    var b = browserify({
        basedir: '.',
        debug: true, // Setting to false removes the source mapping data.
        entries: [
            // TS files to transpile and bundle.
            'client/main.ts',
        ],
        cache: {},
        packageCache: {}
    }).plugin(tsify);

    var rebundle = function () {
        gutil.log(gutil.colors.green('Bundling scripts...'));
        return b.bundle()
            .on('error', fancy_log)
            .pipe(source('bundle.js'))
            .pipe(gulp.dest('./public'))
            .pipe(wait(1000))
            .pipe(livereload());
    };

    if (watch) {
        b = watchify(b);
        b.on('update', rebundle);
    }
    return rebundle();
}

gulp.task('sass', compile_sass);
gulp.task('scripts', function (done) {
    scripts(false).on('end', done);
});

gulp.task('watch-scripts', function (done) {
    scripts(true).on('end', done);
});

gulp.task('watch', gulp.series(
    function () {
        return gulp
            .src('public/*', { read: false, allowEmpty: true })
            .pipe(clean());
    },
    copy_assets,
    theme_sass,
    compile_sass,
    'watch-scripts',
    function () {
        livereload();
        livereload.listen();
        gulp.watch(['etc/**/*.*'], copy_assets);
        gulp.watch(['theme.json'], theme_sass);
        gulp.watch(['*.scss'], compile_sass);
    }
));

gulp.task('public', gulp.series(
    function () {
        return gulp
            .src('public/*', { read: false, allowEmpty: true })
            .pipe(clean());
    },
    copy_assets,
    theme_sass,
    compile_sass,
    function (done) { scripts(false).on('end', done); }
));

gulp.task('js', function () {
    return browserify({
        basedir: '.',
        debug: false,
        entries: [
            'client/main.ts',
        ],
        cache: {},
        packageCache: {}
    }).plugin(tsify)
        .bundle()
        .pipe(source('bundle.js'))
        .pipe(buffer())
        .pipe(uglify())
        .pipe(gulp.dest('./static'));
});

var pug = require('gulp-pug');
gulp.task('templates', function () {
    return gulp.src('./views/*.pug')
        .pipe(pug({
            locals: {
                'title': 'Apex Legends Recoils'
            }
        }))
        .pipe(gulp.dest('./static/'))
});

function copy_assets() {
    return gulp
        .src(['./assets/**/*.*', './etc/**/*.*'])
        .pipe(gulp.dest('public'));
}

gulp.task('assets-static', function () {
    return gulp
        .src(['./assets/**/*.*'], { base: './assets' })
        .pipe(gulp.dest('static'));
});

gulp.task('etc-static', function () {
    return gulp
        .src(['./etc/**/*.*'])
        .pipe(gulp.dest('static'));
});

gulp.task('clean-static', function () {
    return gulp.src('static', { read: false, allowEmpty: true })
        .pipe(clean());
});

gulp.task('css-static', function () {
    return gulp.src('./style.scss')
        .pipe(sass().on('error', sass.logError))
        .pipe(cleanCSS())
        .pipe(gulp.dest('static'));
});

gulp.task('static', gulp.series('clean-static', 'css-static', 'js', 'templates', 'assets-static', 'etc-static'));