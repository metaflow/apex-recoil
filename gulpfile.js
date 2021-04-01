/**
 * Copyright 2021 Google LLC
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
    sass = require('gulp-sass'),
    maps = require('gulp-sourcemaps'),
    jsonSass = require('json-sass'),
    fs = require('fs'),
    concat = require('gulp-concat'),
    uglify = require('gulp-uglify'),
    minify = require('gulp-minify-css'),
    buffer = require('vinyl-buffer');

sass.compiler = require('node-sass');

function compile_sass() {
    gutil.log(gutil.colors.green('Compiling styles...'));
    return gulp.src('./*.scss')
        .pipe(maps.init())
        .pipe(sass().on('error', sass.logError))
        .pipe(maps.write())
        .pipe(gulp.dest('./public/gen'))
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
            .pipe(gulp.dest('./public/gen'))
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
gulp.task('default', function () { scripts(false); });
gulp.task('watch', function () {
    compile_sass();
    theme_sass().on('end', function() {
        gutil.log('theme sass completed');        
    });
    scripts(true);
    livereload();
    livereload.listen();
    gulp.watch(['theme.json'], theme_sass);
    gulp.watch(['*.scss'], compile_sass);
});
gulp.task('js', function(){
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
    .pipe(source('optimized.js'))
    .pipe(buffer())
    .pipe(uglify())
    .pipe(maps.init({
        loadMaps: true,
        sourceRoot: './public/gen',
    }))
    .pipe(maps.write('./'))
    .pipe(gulp.dest('./public/gen'));
 });

var jade = require('gulp-jade');
gulp.task('templates', function() {
  return gulp.src('./views/*.jade')
    .pipe(jade())
    .pipe(gulp.dest('./public/'))
});