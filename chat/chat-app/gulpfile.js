var gulp = require('gulp');
var sass = require('gulp-sass');
var inject = require('gulp-inject');
var angularFilesort = require('gulp-angular-filesort');
var useref = require('gulp-useref');
var minifyCss = require('gulp-minify-css');
var gulpif = require('gulp-if');
var clean = require('gulp-clean');
var ngAnnotate = require('gulp-ng-annotate');
var runSequence = require('gulp-run-sequence');
var argv = require('yargs').argv;
var naturalSort = require('gulp-natural-sort');
var stripDebug = require('gulp-strip-debug');
var replace = require('gulp-replace');
var uglify = require('gulp-uglify');
var htmlmin = require('gulp-htmlmin');

var paths = {
  sass: ['./scss/**/*.scss'],
  javascript: [
    './www/**/*.js',
    '!./www/js/app.js',
    '!./www/app.options.js',
    '!./www/env.js',
    '!./www/lib/**'
  ],
  css: ['./www/**/*.css', '!./www/lib/**']
};

// default dist paths
var distRootPath = './dist';
var distPaths = {
  html: distRootPath,
  images: distRootPath + '/img'
};

// helper fn to set dist path if a custom dist path is required
var setDistPaths = function (absDistPath) {
  distRootPath = absDistPath;
  distPaths.html = distRootPath;
  distPaths.images = distRootPath + '/img';
};

/**
 * This is the main build command should be use for building chat app
 */
gulp.task('build', function (callback) {
  // if a custom dist path is passed in, respect it
  var absoluteDistPath = argv.absoluteDistPath;
  if (absoluteDistPath) {
    setDistPaths(absoluteDistPath);
  }

  runSequence(
    'clean:dist',
    'css:clean',
    'scss:compile',
    'inject:index',
    'copy:html',
    'copy:env',
    'copy:images',
    'copy:fonts',
    'copy:ionic:fonts',
    'build:app',
    'drop-debugger-logs',
    callback
  );
});

// Clean the /dist foler
gulp.task('clean:dist', function () {
  return gulp.src(distRootPath, { read: false }).pipe(clean());
});

// Clean the /css foler
gulp.task('css:clean', function () {
  return gulp.src('./www/css/', { read: false }).pipe(clean());
});

// Compile scss to css
gulp.task('scss:compile', function (done) {
  gulp
    .src('./scss/main.scss')
    .pipe(sass())
    .on('error', sass.logError)
    .pipe(gulp.dest('./www/css/'))
    .on('end', done);
});

// Inject .js and .css into index.html
gulp.task('inject:index', function () {
  return (
    gulp
      .src('./www/index.html')
      // pipe files thru natural sort (to ensure inconsistent ordering) before passing to angularFilesort
      .pipe(
        inject(
          gulp
            .src(paths.javascript)
            .pipe(naturalSort())
            .pipe(angularFilesort()),
          { relative: true }
        )
      )
      .pipe(gulp.dest('./www'))
      .pipe(inject(gulp.src(paths.css, { read: false }), { relative: true }))
      .pipe(gulp.dest('./www'))
  );
});

// Copy *.html to /dist folder
gulp.task('copy:html', function () {
  return gulp.src(['./www/**/*.html', '!./www/lib/**'])
    .pipe(htmlmin({
      collapseWhitespace: true,
      minifyCSS: true,
      minifyJS: true,
      removeComments: true
    }))
    .pipe(gulp.dest(distPaths.html));
});

// Copy env.js to /dist
gulp.task('copy:env', function () {
  return gulp.src(['./www/env.js']).pipe(gulp.dest(distPaths.html));
});

// Copy images to /dist
gulp.task('copy:images', function () {
  return gulp.src('./www/img/**/*').pipe(gulp.dest(distPaths.images));
});

// Copy custom fonts to /dist
gulp.task('copy:fonts', function () {
  return gulp.src(['./www/fonts/**'], { base: './www' }).pipe(gulp.dest(distPaths.html));
});

// Copy ionic fonts to /dist
gulp.task('copy:ionic:fonts', function () {
  return gulp.src(['./www/lib/ionic/fonts/**'], { base: './www' }).pipe(gulp.dest(distPaths.html));
});

// build app
gulp.task('build:app', function () {
  return (
    gulp
      .src('./www/index.html')
      .pipe(useref()) // take a stream from index.html comment
      .pipe(gulpif('*.css', minifyCss())) // if .css file, minify
      .pipe(gulpif('*.css', gulp.dest(distPaths.html))) // copy to dist
      .pipe(gulpif('*.js', ngAnnotate({ add: true }))) // ng-annotate if .js
      .pipe(gulpif('*.js', uglify())) // minify .js
      // .pipe(replace('<script src="scripts/app.js"></script>', ''))
      .pipe(replace('<link rel="stylesheet" href="styles/app.css">', ''))
      .pipe(gulpif('*.js', gulp.dest(distPaths.html))) // paste to dist
      .pipe(gulp.dest(distPaths.html))
  );
});

// Drop logging messages
gulp.task('drop-debugger-logs', function () {
  var outputFile = distPaths.html + '/scripts/app.js';
  gulp
    .src(outputFile)
    .pipe(stripDebug())
    .pipe(gulp.dest(distPaths.html + '/scripts'));
});
