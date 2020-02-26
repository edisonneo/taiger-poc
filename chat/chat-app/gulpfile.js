var gulp = require('gulp');
var gutil = require('gulp-util');
var bower = require('bower');
var sass = require('gulp-sass');
var rename = require('gulp-rename');
var sh = require('shelljs');
var inject = require('gulp-inject');
var angularFilesort = require('gulp-angular-filesort');
var useref = require('gulp-useref');
var minifyCss = require('gulp-minify-css');
var gulpif = require('gulp-if');
var clean = require('gulp-clean');
var browserSync = require('browser-sync').create();
var ngAnnotate = require('gulp-ng-annotate');
var runSequence = require('gulp-run-sequence');
var argv = require('yargs').argv;
var naturalSort = require('gulp-natural-sort');
var stripDebug = require('gulp-strip-debug');

var paths = {
  sass: ['./scss/**/*.scss'],
  javascript: [
    './www/**/*.js',
    '!./www/js/app.js',
    '!./www/app.options.js',
    '!./www/env.js',
    '!./www/lib/**'
  ],
  css: ['./www/**/!(autogen-client-styles)*.css', '!./www/lib/**', './www/css/autogen-client-styles.css']
};

/**
 * BUILD /dist TASKS
 */
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

gulp.task('clean:dist', function () {
  console.log('cleaning', distRootPath);
  return gulp.src(distRootPath, { read: false }).pipe(clean());
});

gulp.task('copy:html', function () {
  return gulp.src(['./www/**/*.html', '!./www/lib/**']).pipe(gulp.dest(distPaths.html)); // copy to dist
});

gulp.task('copy:options', function () {
  return gulp.src(['./www/app.options.js']).pipe(gulp.dest(distPaths.html)); // copy to dist
});

gulp.task('copy:images', function () {
  return gulp.src('./www/img/**/*').pipe(gulp.dest(distPaths.images)); // copy to dist
});

gulp.task('copy:ionic:fonts', function () {
  return gulp.src(['./www/lib/ionic/fonts/**'], { base: './www' }).pipe(gulp.dest(distPaths.html)); // copy to dist
});

gulp.task('copy:fonts', function () {
  return gulp.src(['./www/fonts/**'], { base: './www' }).pipe(gulp.dest(distPaths.html)); // copy to dist
});

gulp.task('build:app', function () {
  return (
    gulp
      .src('./www/index.html')
      .pipe(useref()) // take a stream from index.html comment
      .pipe(gulpif('*.css', minifyCss())) // if .css file, minify
      .pipe(gulpif('*.css', gulp.dest(distPaths.html))) // copy to dist
      .pipe(gulpif('*.js', ngAnnotate({ add: true }))) // ng-annotate if .js
      // .pipe(gulpif('*.js', uglify())) // uglify if .js
      .pipe(gulpif('*.js', gulp.dest(distPaths.html))) // paste to dist
      .pipe(gulp.dest(distPaths.html))
  );
});

gulp.task('drop-debugger-logs', function () {
  var outputFile = distPaths.html + '/scripts/app.js';
  gulp
    .src(outputFile)
    .pipe(stripDebug())
    .pipe(gulp.dest(distPaths.html + '/scripts'));
});

gulp.task('build', function (callback) {
  // if a custom dist path is passed in, respect it
  var absoluteDistPath = argv.absoluteDistPath;
  if (absoluteDistPath) {
    setDistPaths(absoluteDistPath);
  }

  runSequence(
    'clean:dist',
    'index', // make sure all js files are properly injected
    'copy:options',
    'copy:html',
    'copy:images',
    'copy:fonts',
    'copy:ionic:fonts',
    'build:app',
    'drop-debugger-logs',
    callback
  );
});

// use serve:dist to test the minified build in /dist
gulp.task('serve:dist', function () {
  var files = [distRootPath + '/**'];

  browserSync.init(files, {
    serveStatic: ['./'],
    port: 3001
  });
});
/* END BUILD TASKS */

gulp.task('default', ['sass', 'index']);

gulp.task('serve:before', ['default', 'watch']);

gulp.task('index', function () {
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

// TODO: Make this task detect when files are added/deleted.
gulp.task('watch', function () {
  gulp.watch(paths.sass, ['sass']);
  gulp.watch([paths.javascript, paths.css], ['index']);
});

gulp.task('sass', function (done) {
  gulp
    .src('./scss/main.scss')
    .pipe(sass())
    .on('error', sass.logError)
    .pipe(
      minifyCss({
        keepSpecialComments: 0
      })
    )
    .pipe(rename({ extname: '.min.css' }))
    .pipe(gulp.dest('./www/css/'))
    .on('end', done);
});

gulp.task('install', ['git-check'], function () {
  return bower.commands.install().on('log', function (data) {
    gutil.log('bower', gutil.colors.cyan(data.id), data.message);
  });
});

gulp.task('git-check', function (done) {
  if (!sh.which('git')) {
    console.log(
      '  ' + gutil.colors.red('Git is not installed.'),
      '\n  Git, the version control system, is required to download Ionic.',
      '\n  Download git here:',
      gutil.colors.cyan('http://git-scm.com/downloads') + '.',
      "\n  Once git is installed, run '" + gutil.colors.cyan('gulp install') + "' again."
    );
    process.exit(1);
  }
  done();
});
