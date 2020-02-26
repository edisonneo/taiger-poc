(function () {
  'use strict';

  angular.module('iconverse').factory('AudioStreamingService', AudioStreamingService);

  AudioStreamingService.$inject = [
    '$log',
    'VoiceRecognitionService',
    '$q',
    '$timeout'
  ];

  function AudioStreamingService ($log, VoiceRecognitionService, $q, $timeout) {
    var self = this;

    var LANGUAGE_OPTIONS = {
      en: 'en-SG',
      zh: 'zh'
    };

    // private vars
    var _mediaStream;
    var _mediaRecorder;
    var _websocket;
    var _langCode = LANGUAGE_OPTIONS.en;

    var _wsResetTimer; // managing reset websocket at intervals

    // setup websocket vars
    var _wsPath;
    var _wsSingleUtterancePath;
    var _wsLongUtterancePath;

    // config vars - to be initialized by external context
    var _resetWebsocketInterval;
    var _onWebsocketDataReceivedFn;
    var _onWebsocketFinalDataReceivedFn;
    var _beforeWebsocketResetFn;

    /**
     * Configure and initialize the MediaStreamRecorder(MSR) library
     * Additionally, note that we start the MSR recording and place it in a paused state
     * for faster audio recording start via the #resume method (#resume is faster than $start)
     */
    var mediaConstraints = { audio: true };
    var frameSize = 100; // 100ms is recommended "a good tradeoff between latency and efficiency."
    var _isMsrInitialized; // true if we placed the MSR in paused state.

    function onMediaSuccess (stream) {
      _mediaStream = stream;
      _mediaRecorder = new MediaStreamRecorder(stream);
      _mediaRecorder.recorderType = StereoAudioRecorder;
      _mediaRecorder.audioChannels = 1;
      _mediaRecorder.sampleRate = 44100; // tested lower rates... this is the only sample rate that works
      _mediaRecorder.mimeType = 'audio/wav'; // check this line for audio/wav

      // when audio data is received, pipe to the websocket
      // assumes that the ws is open
      _mediaRecorder.ondataavailable = function (blob) {
        if (_isMsrInitialized) {
          console.log(_websocket);
          _websocket.send(blob);
        }
        else {
          // if false, then this execution is an initial start and audio data should be discarded
          // place the msr in paused state for faster audio recording start
          _mediaRecorder.pause();
          _isMsrInitialized = true; // flip the flag
          $log.log('MSR init complete');
        }
      };

      // initialize the msr
      _mediaRecorder.start(frameSize);
      $log.log('init MSR...');
    }

    function onMediaError (e) {
      $log.error(e);
    }

    /**
     * Private method that opens the websocket connection
     */
    function _openWebsocket (isLongUtterance) {
      var deferred = $q.defer();

      var path = isLongUtterance ? _wsLongUtterancePath : _wsSingleUtterancePath + '/' + _langCode;

      _websocket = new WebSocket(path);
      _websocket.binaryData = 'blob';

      _websocket.onopen = function () {
        $log.log(
          'websocket connection open! '
            + (isLongUtterance ? '(LongUtterance)' : '(SingleUtterance)')
        );
        deferred.resolve();
      };

      _websocket.onerror = function (event) {
        $log.error('unexpected websocket error or was forcefully closed', event);
        deferred.reject(event);
      };

      _websocket.onclose = function (event) {
        $log.error('on close unexpected websocket error or was forcefully closed', event);
        deferred.reject(event);
      };

      var _this = this;

      _websocket.onmessage = function (e) {
        var blob = e.data;
        var reader = new FileReader();
        reader.onload = function () {
          var text = reader.result;
          _onWebsocketDataReceivedFn(text);
        };
        reader.readAsText(blob);
      };

      return deferred.promise;
    }

    // public methods
    return {
      // init the mediaRecorder
      // note: audio is only recorded after we call #start/#resume on mediaRecorder
      getUserMediaAccess: function () {
        var deferred = $q.defer();

        navigator.getUserMedia = navigator.getUserMedia
          || navigator.webkitGetUserMedia
          || navigator.mozGetUserMedia
          || navigator.msGetUserMedia;

        try {
          if (typeof navigator.mediaDevices.getUserMedia === 'undefined') {
            navigator.getUserMedia(
              mediaConstraints,
              function (stream) {
                onMediaSuccess(stream);
                deferred.resolve();
              },
              function (e) {
                deferred.reject();
                onMediaError(e);
              }
            );
          }
          else {
            navigator.mediaDevices
              .getUserMedia(mediaConstraints)
              .then(function (stream) {
                onMediaSuccess(stream);
                deferred.resolve();
              })
              .catch(function (e) {
                deferred.reject();
                onMediaError(e);
              });
          }
        }
        catch (e) {
          deferred.reject();
          onMediaError(e);
        }

        return deferred.promise;
      },

      isWebsocketOpen: function () {
        return _websocket && _websocket.readyState === _websocket.OPEN;
        // note: it can be one of the following values : CONNECTING, OPEN, CLOSING or CLOSED
      },

      init: function (resetIntervalMs, onDataReceivedFn, beforeResetFn) {
        _resetWebsocketInterval = resetIntervalMs;
        _onWebsocketDataReceivedFn = onDataReceivedFn;
        _beforeWebsocketResetFn = beforeResetFn;
        $log.log('AudioStreamingService init!');
      },

      setLangCode: function (langCode) {
        if (langCode) _langCode = LANGUAGE_OPTIONS[langCode.iso];
      },

      // if isLongUtterance is true, it will reopen the websocket the first time
      // but subsequent times will default back to single utterance
      resetWebsocket: function (isLongUtterance) {
        this.stop();

        if (angular.isFunction(_beforeWebsocketResetFn)) {
          _beforeWebsocketResetFn();
        }

        var self = this;

        // open it and resume the stream
        return _openWebsocket(isLongUtterance).then(function () {
          // after the websocket has opened, resume audio capture
          _mediaRecorder.resume();

          // reset the websocket connection after an interval
          $log.log('resetting WS in ' + _resetWebsocketInterval + ' ms');

          _wsResetTimer = $timeout(function () {
            $log.log('resetting WS!');
            self.resetWebsocket();
          }, _resetWebsocketInterval);
        });
      },
      /**
       * Starts the audio stream to the server, handling the Websocket and MediaStreamRecorder internally.
       * If the Websocket is not open, open it
       * else, close and reopen it
       */
      start: function (isLongUtterance) {
        return this.resetWebsocket(isLongUtterance);
      },

      stop: function () {
        // if the websocket is open, close it and pause audio capture
        if (this.isWebsocketOpen()) {
          _websocket.close();
          _mediaRecorder.pause();
          $log.log('closing WS & pausing mediaRecorder');

          // cancel any queued up websocket reset instruction
          var task = $timeout.cancel(_wsResetTimer);

          console.log('did stop next run: ' + task);
        }
      },

      getMediaStream: function () {
        return _mediaStream;
      },

      setupWebsocketPath: function () {
        _wsPath = VoiceRecognitionService.getWebsocketPath();
        _wsSingleUtterancePath = _wsPath + '/binary';
        _wsLongUtterancePath = _wsPath + '/speechLongUtterance';
      }
    };
  }
}());
