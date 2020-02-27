var gulp = require('gulp');
var sass = require('gulp-sass');
var browserSync = require('browser-sync').create();
var minifyInline = require('gulp-minify-inline');
var extract = require('gulp-html-extract');
var rename = require('gulp-rename');
var chug = require('gulp-chug');
var injectString = require('gulp-inject-string');
var runSequence = require('gulp-run-sequence');
var argv = require('yargs').argv;
var replace = require('gulp-replace');
var fs = require('fs');
var clean = require('gulp-clean');
var htmlmin = require('gulp-htmlmin');
var concat = require('gulp-concat');
var tap = require('gulp-tap');
var watch = require('gulp-watch');
var path = require('path');
var jsBeautify = require('js-beautify').js_beautify;
var opn = require('opn');
var yarn = require('gulp-yarn');

var config = require('./app.config.json');
var env = config.env;

// Static server
gulp.task(
  'serve',
  [
    'build:widget',
    'widget:watch',
    'chat-app:css:watch',
    'chat-app:scss:watch',
    'inject:options', // insert app options
    'chat-app:set-custom-css', // insert custom css, if any
    'chat-app:copy-avatar',
  ],
  function() {
    // insert custom env settings
    // note: if converseUrl is not supplied in arg, then clear any previous env insertion with an empty obj
    const chatEndpoint = argv.converseUrl;
    let env = chatEndpoint ? { chatEndpoint } : {};

    setChatAppEnv({
      payload: env,
      htmlFilePath: `${config.paths.chatApp}/www`,
    });

    if (chatEndpoint) console.log('=== Using Chat Endpoint:', chatEndpoint);

    // start the browsersync server
    var files = [
      config.paths.context + '/**',
      config.paths.chatWidget + '/source/**/*',
      config.paths.chatApp + '/www/**/*.{js,css,scss,jpg,png,json}',
    ];

    var bs = browserSync.init(
      files,
      {
        // turn off click syncing as it seems to be causing weird 'phantom' clicks, that causes the chat iframe to re-open after closing
        ghostMode: {
          clicks: false,
        },
        // ensure that served files are structured in a consistent/same way as the server
        serveStatic: [
          { route: '/', dir: config.paths.context },
          { route: '/chat/chat-app', dir: config.paths.chatApp + '/www' },

          // for widget, a dist folder, which takes into account client-specific overrides, will be created
          // the dist folder should be regenerated everything changes are detected inside the chatWidget/source folder
          { route: '/chat/widget', dir: config.paths.chatWidgetDist },
        ],
        port: 4200,
      },
      function() {
        var url = bs.options.get('urls').get('local');

        // somehow, setting browsersyncs `open` property to 'local' opens the browser
        // at the browsersync control page, instead of the serve URL.
        // hence, we use opn to open the correct page
        opn(url, { app: 'google chrome' });

        // after browsersync starts, setup the context's index.html
        // we use regex to replace the respective variables
        setupContextHtml(
          {
            pathToIndexHtml: config.paths.context,
            chatBaseUrl: url,
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
  }
);

let setupContextHtml = function({ pathToIndexHtml, newDest, chatBaseUrl }, cb) {
  let dest = newDest || pathToIndexHtml;

  // rest of setting up is configured from config file
  var btnColor = config.context.chatButtonColor || '#444';
  var backgroundImg = config.context.backgroundImageFile;
  var backgroundFallbackColor = config.context.backgroundFallbackColor || '#EEE';
  var background = backgroundImg ? `url("${backgroundImg}")` : backgroundFallbackColor;

  return (
    gulp
      .src([pathToIndexHtml + '/index.html'])
      // set chat base url to the browsersync url
      .pipe(replace(/(var chatBaseUrl).*/i, "$1 = '" + chatBaseUrl + "/';"))
      // set button color, as specified in config file
      .pipe(replace(/(window\.__env\.btnColor).*/i, "$1 = '" + btnColor + "';"))
      // set background as specified in config file
      .pipe(replace(/(background\s*:\s*).*/i, `$1${background};`))
      .pipe(gulp.dest(dest))
      .on('end', () => {
        if (cb) cb();
      })
  );
};

const writeExtConfigFile = function({ payload, windowKey, outputFileName, outputPath }) {
  if (payload) {
    let str = `(function(window){window.${windowKey} = ${JSON.stringify(payload)} }(this));`;
    fs.writeFile(
      `${outputPath}/${outputFileName}`,
      jsBeautify(str, { indent_size: 2 }),
      function() {
        console.log(`wrote to ${outputPath}/${outputFileName}!`);
      }
    );
  } else {
    console.log(`warning: no payload to write into ${outputFileName}`);
  }
};

gulp.task('inject:options', function() {
  // read from config file and write to /chat-app/app.options.js
  let windowKey = '__appOptions';
  let payload = config.appOptions;

  let html = `${config.appOverrides.customLandingPageHtml}`;
  if (html) {
    let fileContent = fs.readFileSync(html, 'utf-8');
    config.appOptions.customLandingPageHtml = fileContent;
  }

  if (payload) {
    writeExtConfigFile({
      payload,
      windowKey,
      outputFileName: 'app.options.js',
      outputPath: `${config.paths.chatApp}/www`,
    });
  } else {
    console.log('no appOptions in config to write into app.options.js');
  }
});

/**
 * BUILD CONTEXT TASKS - build into the specified contextDist folder
 */
let contextDist = config.paths.contextDist;

// configure and copy index.html to context/dist folder
gulp.task('context:configure-dev', function() {
  return setupContextHtml({
    pathToIndexHtml: config.paths.context,
    newDest: contextDist,
    chatBaseUrl: env.chatBaseUrl,
  });
});
gulp.task('context:configure-prod', function() {
  return setupContextHtml({
    pathToIndexHtml: config.paths.context,
    newDest: contextDist,
    chatBaseUrl: env.prod.chatBaseUrl,
  });
});

gulp.task('context:copy:images', function() {
  return gulp.src(`${config.paths.context}/**`).pipe(gulp.dest(contextDist)); // copy to dist
});

gulp.task('context:clean', function() {
  return gulp.src(contextDist, { read: false }).pipe(clean({ force: true }));
});

// minify script in dist'd context/index.html and copy in context dist folder
gulp.task('context:minify-script', function() {
  return gulp
    .src(contextDist + '/index.html')
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
    .pipe(rename('chat_script.js'))
    .pipe(gulp.dest(contextDist));
});

// minify html inside context/dist folder
gulp.task('context:minify-html', function() {
  return gulp
    .src(`${contextDist}/index.html`)
    .pipe(
      htmlmin({
        collapseWhitespace: true,
        minifyCSS: true,
        minifyJS: true,
        removeComments: true,
      })
    )
    .pipe(gulp.dest(contextDist));
});

let buildContext = function(isProduction) {
  var copyHtml = isProduction ? 'context:configure-prod' : 'context:configure-dev';
  console.log('task "build:context" isProduction: ' + isProduction || false);
  return runSequence(
    'context:clean',
    'context:copy:images',
    copyHtml,
    //'context:minify-script', disable for now, since the chatBaseUrl is not being written into the html
    'context:minify-html'
  );
};

gulp.task('build:context', function() {
  var isProd = argv.prod || argv.production || argv.p;
  return buildContext(isProd);
});
gulp.task('build:context-prod', function() {
  return buildContext(true);
});
gulp.task('build:context-dev', function() {
  return buildContext(false);
});

// serve & test the minified context build in /dist
gulp.task('serve:dist:context', function() {
  var files = [contextDist + '/**'];

  browserSync.init(files, {
    serveStatic: [contextDist],
    port: 3002,
  });
});

/**
 * APP RELATED INJECTIONS
 */
const customAppCssFilePath = config.paths.chatApp + '/www/css';
const customAppCssFileName = 'autogen-client-styles.css';
const customAppLandingPageCssFileName = 'autogen-client-landing-page-styles.css';
gulp.task('chat-app:clean-custom-css', function() {
  console.log(`cleaning from ${customAppCssFilePath}/${customAppCssFileName}`);
  return gulp
    .src(`${customAppCssFilePath}/${customAppCssFileName}`)
    .pipe(clean({ force: true, read: false }));
});

gulp.task('chat-app:set-custom-css', ['chat-app:clean-custom-css'], function() {
  let css = `${config.appOverrides.customCss}`;
  let landingPageScss = `${config.appOverrides.customLandingPageScss}`;
  if (css) {
    gulp
      .src(css)
      .pipe(rename(customAppCssFileName))
      .pipe(gulp.dest(customAppCssFilePath));

    console.log(`Copied ${css} to ${customAppCssFilePath} and renamed as ${customAppCssFileName}`);
  } else {
    console.log(`Info: No appOverride.customCss was set. Writing an empty file`);
    let str = `/* --- No custom styles specified --- */`;
    fs.writeFile(`${customAppCssFilePath}/${customAppCssFileName}`, str, function() {
      console.log(`wrote to ${customAppCssFilePath}/${customAppCssFileName}`);
    });
  }

  if (landingPageScss) {
    gulp
      .src(landingPageScss)
      .pipe(sass())
      .on('error', sass.logError)
      .pipe(rename(customAppLandingPageCssFileName))
      .pipe(gulp.dest(customAppCssFilePath));

    console.log(
      `Copied ${landingPageScss} to ${customAppCssFilePath} and renamed as ${customAppLandingPageCssFileName}`
    );
  }
});

// copy the avatar
const avatarOutputFilePath = config.paths.chatApp + '/www/img';
const avatarOutputFileName = 'avatar.png';
const customAvatarFile = config.appOverrides.avatarPngImg;
const defaultAvatarPath = './chat/chat-app/www/img/avatar-default.png';
gulp.task('chat-app:copy-avatar', function() {
  let avatarFile;
  if (customAvatarFile) {
    avatarFile = config.appOverrides.avatarPngImg;
    console.log(`copy-avatar: Copying the avatarImg specified in the config file: ${avatarFile}`);
  } else {
    avatarFile = defaultAvatarPath;
    console.log(`copy-avatar: Using the default avatarFile`, avatarFile);
  }

  gulp
    .src(avatarFile)
    .pipe(rename(avatarOutputFileName))
    .pipe(gulp.dest(avatarOutputFilePath));
  console.log(
    `Copied ${avatarFile} to ${avatarOutputFilePath} and renamed as ${avatarOutputFileName}`
  );
});

/**
 * WIDGET RELATED FUNCTIONS
 */
let widgetDist = config.paths.chatWidgetDist;

// pick up widget overrides and set into the widget,
// concatenating behind the 'base' widget css
let concatWidgetCss = function({ cssFiles, dest }) {
  return gulp
    .src(cssFiles)
    .pipe(
      tap(function(file, t) {
        let parts = file.path.split('/');
        let fileName = parts[parts.length - 1];
        if (fileName === config.widgetOverrides.customCss) {
          var fixImageLinks = function(cssString) {
            // use regex to fix url("image.png") --> url("../img/image.png")
            return cssString.replace(/url\("*(\S+\.(png|jpg|jpeg))"*\)/gi, 'url(../img/$1)');
          };
          file.contents = Buffer.from(fixImageLinks(file.contents.toString()));
        }
      })
    )
    .pipe(concat('chat-widget.css'))
    .pipe(gulp.dest(dest));
};

gulp.task('widget:concat-css', function() {
  let cssFiles = [`${config.paths.chatWidget}/source/css/chat-widget.css`];
  if (config.widgetOverrides.customCss) {
    cssFiles.push(`${config.paths.chatWidgetOverrides}/${config.widgetOverrides.customCss}`);
  }

  concatWidgetCss({
    cssFiles,
    dest: `${widgetDist}/css`,
  });
});

gulp.task('widget:copy:base', function() {
  return gulp.src(`${config.paths.chatWidget}/source/**/*`).pipe(gulp.dest(widgetDist)); // copy to dist
});

gulp.task('widget:copy:chat-btn-icon', function() {
  return gulp
    .src(`${config.paths.chatWidgetOverrides}/${config.widgetOverrides.chatButtonImage}`)
    .pipe(gulp.dest(`${widgetDist}/img`)); // copy to dist
});

gulp.task('widget:clean', function() {
  return gulp.src(widgetDist, { read: false }).pipe(clean({ force: true }));
});

gulp.task('build:widget', function(callback) {
  runSequence(
    'widget:clean',
    'widget:copy:base',
    'widget:concat-css',
    'widget:copy:chat-btn-icon',
    callback
  );
});

gulp.task('widget:watch', function() {
  // Endless stream mode
  watch(
    [`${config.paths.chatWidget}/source/**/*`, `${config.paths.chatWidgetOverrides}/**/*`],
    {
      ignoreInitial: false,
    },
    function() {
      gulp.start('build:widget');
    }
  );
});

gulp.task('chat-app:css:watch', function() {
  if (!config.appOverrides.customCss) {
    return;
  }
  // Endless stream mode
  watch(
    [`${config.appOverrides.customCss}`],
    {
      ignoreInitial: true,
    },
    function() {
      gulp.start('chat-app:set-custom-css');
    }
  );
});

gulp.task('chat-app:scss:watch', function() {
  // Endless stream mode
  watch(
    [config.paths.chatApp + '/scss/**/**.scss'],
    {
      ignoreInitial: true,
    },
    function() {
      return gulp.src(config.paths.chatApp + '/gulpfile.js').pipe(
        chug({
          tasks: ['sass'],
          args: [],
        })
      );
    }
  );
});

/**
 * Grab node_modules for the app located at `chat/chat-app`
 */
gulp.task('install-chatapp-deps', function() {
  return gulp
    .src([`${config.paths.chatApp}/package.json`, `${config.paths.chatApp}/yarn.lock`])
    .pipe(gulp.dest(`${config.paths.chatApp}`))
    .pipe(yarn());
});

/**
 * BUILD CHAT
 */

var distPath = config.paths.chatAppDist;

/**
 * The main build command for dist-ing the chat-app.
 * You should be using this!
 */
gulp.task('build', ['install-chatapp-deps'], function(callback) {
  var isProd = argv.prod || argv.production || argv.p;
  var envTask = isProd ? 'inject:env-prod' : 'inject:env-dev';
  var ctxTask = isProd ? 'build:context-prod' : 'build:context-dev';

  console.log('task "build", isProduction: ' + isProd || false);

  if (isProd) {
    console.error('=== PROD PROFILE DISABLED. PROCESS WILL EXIT ===');
    process.exit(1);
  }

  runSequence(
    ctxTask,
    'inject:options',
    'chat-app:set-custom-css',
    'chat-app:copy-avatar',
    'build:chat-app',
    envTask,
    'build:widget',
    callback
  );
});

/**
 * Build the chat-app, by calling the gulp task inside the chat-app folder
 * Note: If you want to build the chat-app whilst loading the settings from config files
 * Use the wrapping `gulp build -{prod|dev}` command
 */
gulp.task('build:chat-app', function() {
  var isProd = argv.prod || argv.production || argv.p;
  var arg = isProd ? 'prod' : 'dev';

  // get the absolute path to the chat dist folder
  var absPath = path.resolve(config.paths.chatAppDist);

  console.log('Writing chat-app dist to', absPath);

  return gulp.src(config.paths.chatApp + '/gulpfile.js').pipe(
    chug({
      tasks: ['build'],
      args: [`--${arg}`, `--absoluteDistPath=${absPath}`],
    })
  );
});

// serve & test the minified context build in /dist
gulp.task('serve:dist:chat', function() {
  return gulp.src(config.paths.chatApp + '/gulpfile.js').pipe(
    chug({
      tasks: ['serve:dist'],
    })
  );
});

const insertScriptTagToHtml = function({ scriptId, htmlPath, htmlFileName, scriptSrc }) {
  let str = `<script id='${scriptId}' src='${scriptSrc}'></script>`;

  // regex to match any existing occurrences of the script to be inserted
  let regex = new RegExp(`<script id='${scriptId}'.*\\n`, 'ig');

  return gulp
    .src(`${htmlPath}/${htmlFileName}`)
    .pipe(replace(regex, '')) // replace the previous env script, if any
    .pipe(injectString.before('<script', str + '\n')) // note the new-line after the closing script tag. the regex replacement in the preceding line expects the \n character to work properly
    .pipe(gulp.dest(htmlPath));
};

// 1. read from config file and write to /chat-app/env.js
// 2. insert the script tag into the specified html file (defaults to index.html)
const setChatAppEnv = function({ payload = {}, htmlFilePath, htmlFileName = 'index.html' }) {
  let windowKey = '__envConfig';
  let fileName = 'env.js';

  // write the file into the file system
  writeExtConfigFile({
    payload,
    windowKey,
    outputFileName: fileName,
    outputPath: htmlFilePath,
  });

  // insert the script tag into the sibling index.html
  return insertScriptTagToHtml({
    scriptId: 'env',
    htmlPath: htmlFilePath,
    htmlFileName: htmlFileName,
    scriptSrc: fileName,
  });
};

gulp.task('inject:env-dev', function() {
  let chatAppEnvConfig = env;
  return setChatAppEnv({
    payload: chatAppEnvConfig,
    htmlFilePath: distPath,
  });
});

gulp.task('inject:env-prod', function() {
  let chatAppEnvConfig = env.prod;
  return setChatAppEnv({
    payload: chatAppEnvConfig,
    htmlFilePath: distPath,
  });
});
