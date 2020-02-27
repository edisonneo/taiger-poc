var gulp = require('gulp');
var browserSync = require('browser-sync').create();
var minifyInline = require('gulp-minify-inline');
var extract = require('gulp-html-extract');
var rename = require('gulp-rename');
var chug = require('gulp-chug');
var runSequence = require('gulp-run-sequence');
var argv = require('yargs').argv;
var replace = require('gulp-replace');
var clean = require('gulp-clean');
var htmlmin = require('gulp-htmlmin');
var watch = require('gulp-watch');
var path = require('path');
var opn = require('opn');
var yarn = require('gulp-yarn');
var inject = require('gulp-inject-string');

const config = {
  contextPath: './context',
  contextBrowserSyncPath: './context-browser-sync',
  chatAppPath: './chat/chat-app',
  chatWidgetPath: './chat/widget',
  contextDistPath: './dist',
  templatesDistPath: './dist/templates',
  chatWidgetDistPath: './dist/base/widget',
  chatAppDistPath: './dist/base/chat-app',
  botServerUrl: 'http://localhost:8080/iconverse-bot-server',
};

let botId = '';
let botServerUrl = '';

gulp.task('serve', function() {
  botId = argv.bot;
  botServerUrl = argv.botServerUrl ? argv.botServerUrl : config.botServerUrl;

  if (!botId) {
    console.error(
      'ERROR: please specify bot to serve like `gulp serve --bot=<botId> --botServerUrl=<botServerUrl>`'
    );
    process.exit();
  }

  // ensure it ends with a trailing slash, or it cannot be parsed by chat-app
  if (botServerUrl[botServerUrl.length - 1] !== '/') botServerUrl += '/';

  console.log(`[INFO] === Using bot: ${botId}, botServerUrl: ${botServerUrl} ===`);

  runSequence(
    'chat-app:css:clean',
    'chat-app:scss:compile',
    'chat-app:inject:index',
    'chat-app:scss:watch',
    'browserSync:init'
  );
});

// Static server
gulp.task('browserSync:init', function() {
  // start the browsersync server
  var files = [
    config.contextBrowserSyncPath + '/**',
    config.chatWidgetPath + '/source/**/*',
    config.chatAppPath + '/www/**/*.{js,css,scss,jpg,png,json}',
  ];

  var bs = browserSync.init(
    files,
    {
      // turn off click syncing as it seems to be causing weird 'phantom' clicks, that causes the chat iframe to re-open after closing
      ghostMode: { clicks: false },

      // ensure that served files are structured in a consistent/same way as the server
      serveStatic: [
        { route: '/', dir: config.contextBrowserSyncPath },
        { route: '/chat/chat-app', dir: config.chatAppPath + '/www' },
        { route: '/chat/widget', dir: config.chatWidgetPath + '/source' },
      ],
      port: 3001,
      notify: false,
    },
    function() {
      const url = bs.options.get('urls').get('local');

      // somehow, setting browsersyncs `open` property to 'local' opens the browser
      // at the browsersync control page, instead of the serve URL.
      // hence, we use opn to open the correct page
      opn(url, { app: 'google chrome' });

      // Set the chatBaseUrl to be the same as browserSync local url
      const chatBaseUrl = url;

      // after browsersync starts, setup the context's index.html
      // we use regex to replace the respective variables

      setupContextHtml(
        {
          botId,
          botServerUrl,
          chatBaseUrl,
          sourcePathForIndexHtml: config.contextPath,
          targetPathForIndexHtml: config.contextBrowserSyncPath,
        },
        function() {
          setTimeout(() => {
            browserSync.reload();
            console.log('Set context settings, now reloading Browsersync!');
          }, 1000); // reload after 1s because gulp might still be processing
        }
      );
    }
  );
});

const setupContextHtml = function(
  { sourcePathForIndexHtml, targetPathForIndexHtml, botId, botServerUrl, chatBaseUrl },
  cb
) {
  gulp
    .src([sourcePathForIndexHtml + '/index.html'])
    .pipe(replace(/(var botId).*/i, "$1 = '" + botId + "';"))
    .pipe(replace(/(var serverUrl).*/i, "$1 = '" + botServerUrl + "';"))
    .pipe(replace(/(var chatBaseUrl).*/i, "$1 = '" + chatBaseUrl + "';"))
    .pipe(gulp.dest(targetPathForIndexHtml))
    .on('end', () => {
      if (cb) cb();
    });
};

// Clean the /css foler
gulp.task('chat-app:css:clean', function() {
  return gulp.src(config.chatAppPath + '/gulpfile.js').pipe(
    chug({
      tasks: ['css:clean'],
      args: [],
    })
  );
});

// Compile scss to css
gulp.task('chat-app:scss:compile', function() {
  return gulp.src(config.chatAppPath + '/gulpfile.js').pipe(
    chug({
      tasks: ['scss:compile'],
      args: [],
    })
  );
});

// Watch scss folder
gulp.task('chat-app:scss:watch', function() {
  // Endless stream mode
  watch([config.chatAppPath + '/scss/**/*.scss'], { ignoreInitial: true }, function() {
    gulp.start('chat-app:scss:compile');
  });
});

// Inject .js and .css into index.html
gulp.task('chat-app:inject:index', function() {
  gulp.src(config.chatAppPath + '/gulpfile.js').pipe(
    chug({
      tasks: ['inject:index'],
      args: [],
    })
  );
});

// ------------------------ BUILD CHAT ------------------------ //

/**
 * The main build command for dist-ing the chat-app.
 * You should be using this!
 */
gulp.task('build', function(callback) {
  runSequence(
    'install-chatapp-deps',
    'context:clean',
    'widget:copy:base',
    'build:chat-app',
    'context:minify-script',
    'context:minify-html',
    callback
  );
});

/**
 * Grab node_modules for the app located at `chat/chat-app`
 */
gulp.task('install-chatapp-deps', function() {
  return gulp
    .src([`${config.chatAppPath}/package.json`, `${config.chatAppPath}/yarn.lock`])
    .pipe(gulp.dest(`${config.chatAppPath}`))
    .pipe(yarn());
});

/**
 * Clean the /dist folder
 */
gulp.task('context:clean', function() {
  return gulp.src(config.contextDistPath, { read: false }).pipe(clean({ force: true }));
});

/**
 * Copy widget to /dist folder
 */
gulp.task('widget:copy:base', function() {
  return gulp
    .src(`${config.chatWidgetPath}/source/**/*`)
    .pipe(gulp.dest(config.chatWidgetDistPath));
});

/**
 * Build the chat-app, by calling the gulp task inside the chat-app folder
 * Note: If you want to build the chat-app whilst loading the settings from config files
 * Use the wrapping `gulp build` command
 */
gulp.task('build:chat-app', function() {
  // get the absolute path to the chat dist folder
  const absPath = path.resolve(config.chatAppDistPath);

  return gulp.src(config.chatAppPath + '/gulpfile.js').pipe(
    chug({
      tasks: ['build'],
      args: [`--absoluteDistPath=${absPath}`],
    })
  );
});

// -------------------- HELPER TASK TO MINIFY SCRIPT -------------------- //

// Generate header script to be used by client in the iconverse-bot-server
// minify script in dist'd context/index.html and copy in context dist folder
gulp.task('context:minify-script', function() {
  return gulp
    .src(config.contextPath + '/index.html')
    .pipe(replace(/(var botId).*/i, "$1 = '${botId}';"))
    .pipe(replace(/(var chatBaseUrl).*/i, "$1 = '';"))
    .pipe(replace(/(var serverUrl).*/i, "$1 = '${serverUrl}';"))
    .pipe(
      minifyInline({
        js: {
          mangle: {
            toplevel: true,
          },
        },
      })
    )
    .pipe(
      extract({
        sel: 'script[data-minify]',
      })
    )
    .pipe(inject.wrap('<script async>\n', '\n</script>'))
    .pipe(rename('embed-script.jsp'))
    .pipe(gulp.dest(config.templatesDistPath));
});

// Generate index.html file to be used in the iconverse-bot-server
// minify html inside context/dist folder
gulp.task('context:minify-html', function() {
  return gulp
    .src(`${config.contextPath}/index.html`)
    .pipe(replace(/(var botId).*/i, "$1 = '${botId}';"))
    .pipe(replace(/(var chatBaseUrl).*/i, "$1 = '';"))
    .pipe(replace(/(var serverUrl).*/i, "$1 = '${pageContext.request.contextPath}';"))
    .pipe(
      htmlmin({
        collapseWhitespace: true,
        minifyCSS: true,
        minifyJS: true,
        removeComments: true,
      })
    )
    .pipe(
      minifyInline({
        js: {
          mangle: {
            toplevel: true,
          },
        },
      })
    )
    .pipe(inject.prepend('<%@ taglib uri="http://java.sun.com/jsp/jstl/core" prefix="c" %>\n'))
    .pipe(rename('bot-preview.jsp'))
    .pipe(gulp.dest(config.templatesDistPath));
});
