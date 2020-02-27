(function () {
  'use strict';

  angular.module('iconverse').directive('voiceRecognition', voiceRecognition);

  voiceRecognition.$inject = [
    '$timeout',
    'ChatService',
    'AudioStreamingService',
    'VoiceRecognitionService',
    'TextToSpeechService',
    '$interval'
  ];

  function voiceRecognition (
    $timeout,
    ChatService,
    AudioStreamingService,
    VoiceRecognitionService,
    TextToSpeechService
  ) {
    return {
      scope: {
        isVoiceRecognitionAvailable: '<',
        textInput: '=',
        onVoiceRecognitionStopped: '&',
        onTextInputChanged: '&',
        api: '='
      },
      templateUrl: 'js/chat/components/voice-recognition/voice-recognition.directive.html',
      link: function (scope) {
        scope.noAudioDetectedCount = 0;
        var MAX_NO_AUDIO_COUNT = 4; // 8 - 10s between each audio detection

        var ttsLastEndedTime;
        var MIN_WAIT_AFTER_TTS_BEFORE_SENDING_NO_RESPONSE = 3000;

        ChatService.bindConversation(scope, 'conversation');

        var processFinalResults = function (result) {
          if (!result.transcript) return; // TODO: check why null is sometimes passed in

          cancelInterrimResultTimer();
          console.log('processing results: ' + result.transcript);
          scope.handleVoiceRecognitionResults(result);

          scope.latestInterrimTranscript = null; // clear buffer
        };

        var interrimResultTimer;
        var takeInterrimResultsAfter = function (ms) {
          console.log('Using interrim transcript in buffer after ' + ms + ' ms');
          interrimResultTimer = $timeout(function () {
            // AudioStreamingService.resetWebsocket();
            processFinalResults({ transcript: scope.latestInterrimTranscript });
          }, ms);
        };

        var cancelInterrimResultTimer = function () {
          if (interrimResultTimer) {
            $timeout.cancel(interrimResultTimer);
            console.log('interrim result timer cancelled');
            interrimResultTimer = null;
          }
        };

        // Initialize Audio Streaming Service
        var onWebsocketData = function (jsonText) {
          console.log(jsonText);
          var result = JSON.parse(jsonText);

          // IMPT: once END_OF_UTTERANCE is arrived, google will not process
          // any new audio until gRPC session is refreshed (websocket is reset)
          // NOTE: END_OF_UTTERANCE will not be reached when currently in longUtterance mode (in other words, when scope.isExpectingMembershipNumber = true)
          if (result.endpointerType === 'END_OF_SINGLE_UTTERANCE') {
            console.log(
              'No audio detected. Waiting '
                + (MAX_NO_AUDIO_COUNT - scope.noAudioDetectedCount)
                + ' checks before shutdown.'
            );

            // if there is intterrim transcript,
            if (scope.latestInterrimTranscript) {
              // if the interrim text contains 'Yes' or 'No', process immediately
              if (/\b(yes|no|okay)\b/i.test(scope.latestInterrimTranscript)) {
                takeInterrimResultsAfter(0);
              }
              else {
                // else, take it as final it after x ms
                takeInterrimResultsAfter(3000);
              }
            }
            // kill if no audio count has exceeded limit and nothing is queued
            // in the interrim
            else if (++scope.noAudioDetectedCount > MAX_NO_AUDIO_COUNT && !interrimResultTimer) {
              scope.stop(); // stop the call
            }
            else {
              // send no response to the server
              // unless TTS is is still playing (user may still be listening to TTS talk)
              var ttsEndedAge = new Date().getTime() - ttsLastEndedTime;
              var ttsCheck = !ttsLastEndedTime || ttsEndedAge > MIN_WAIT_AFTER_TTS_BEFORE_SENDING_NO_RESPONSE;
              if (!TextToSpeechService.isPlaying() && ttsCheck) {
                // Send a message if there is no response from user
                // sendNoResponseMsg();
                scope.stop();
              }
              else {
                console.log(
                  'Not sending no response msg since TTS is speaking or tts had ended less than '
                    + MIN_WAIT_AFTER_TTS_BEFORE_SENDING_NO_RESPONSE
                    + ' ms ago'
                );
              }

              // reset the websocket to refresh the google speech session
              // AudioStreamingService.resetWebsocket();
            }
          }

          if (result.transcript) {
            scope.noAudioDetectedCount = 0; // reset the count

            if (result.final) {
              console.log('final transcript: ' + result.transcript);
              scope.textInput = result.transcript;
              scope.onTextInputChanged();

              processFinalResults(result);

              // AudioStreamingService.resetWebsocket();
            }
            else {
              console.log('interrim transcript: ' + result.transcript);
              scope.textInput = result.transcript;
              scope.onTextInputChanged();

              scope.latestInterrimTranscript = result.transcript;
            }
          }
        };

        var beforeWebsocketReset = function () {
          // before resetting, process the interrim data, if any
          if (scope.latestInterrimTranscript) {
            console.log(
              'websocket is closing! taking transcript in buffer: ' + scope.latestInterrimTranscript
            );
            processFinalResults({ transcript: scope.latestInterrimTranscript });
          }
        };

        scope.initAudioStreamingService = function () {
          AudioStreamingService.init(55 * 1000, onWebsocketData, beforeWebsocketReset);
        };

        // Only start voice recognition service if it is available
        if (scope.isVoiceRecognitionAvailable) {
          scope.initAudioStreamingService();
        }

        scope.startStreaming = function () {
          AudioStreamingService.start().then(function () {
            console.log('Audio streaming started');
          });
        };

        scope.stop = function () {
          AudioStreamingService.stop();
          TextToSpeechService.cancelIfPlaying();
          scope.noAudioDetectedCount = 0; // reset the count
          scope.onVoiceRecognitionStopped();
          console.log('Audio streaming stopped');
        };

        /**
         * CHAT FUNCTIONS
         */

        scope.initialStart = function () {
          console.log('sending start message to initialize...');

          scope.startStreaming();

          // Send a message to trigger hello intent
          // sendFirstWelcomeMessage();
        };

        var sendFirstWelcomeMessage = function () {
          ChatService.processUserMessage(
            'hello',
            null,
            null,
            null,
            true,
            null,
            null,
            null,
            null,
            'speech'
          ).then(function (replyMsg) {
            console.log('chat session initialized');
            handleChatResponse(replyMsg);
          });
        };

        var sendNoResponseMsg = function () {
          console.log('sending no response message...');
          ChatService.processUserMessage(
            'NoInput',
            'NoInput',
            null,
            null,
            true,
            null,
            null,
            null,
            null,
            'speech'
          ).then(function (replyMsg) {
            handleChatResponse(replyMsg);
          });
        };

        var handleChatResponse = function (msg) {
          var text = msg.text;

          // AudioStreamingService.resetWebsocket(false);

          TextToSpeechService.speak(text, {
            onstart: function () {
              console.log('TTS started');
            },
            onend: function () {
              console.log('TTS ended');

              ttsLastEndedTime = new Date().getTime();
            },
            onerror: function () {
              scope.errorType = 'TTS_ERROR';
              console.log('TTS error');
              scope.isErrored = true;
              scope.stop();
            }
          });
        };

        scope.handleVoiceRecognitionResults = function (result) {
          console.log('handle voice recognition results');
          scope.stop();
          // if the voice is speaking, stop speaking
          TextToSpeechService.cancelIfPlaying();

          var text = result.transcript;
          var input = VoiceRecognitionService.processDictatedText(text);

          scope.textInput = ''; // clear visual aid
          scope.onTextInputChanged();

          console.log('Sending to iconverse server: ' + input);

          ChatService.processUserMessage(
            input,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            'speech'
          ).then(function (replyMsg) {
            handleChatResponse(replyMsg);
          });
        };

        // Text Web Socket Connection for testing
        // $timeout(function () {
        //   var checkMsg = 'Websocket is working!';
        //   var tws = new WebSocket(VoiceRecognitionService.getWebsocketPath() + '/text');
        //   tws.onopen = function () {
        //     console.log('Text WS opened. Performing self-check...');
        //     tws.send(checkMsg);
        //   };
        //   tws.onclose = function () {
        //     console.log('Text WS closed');
        //   };
        //   tws.onerror = function (e) {
        //     console.log('Text WS failed with error', e);
        //   };
        //   tws.onmessage = function (e) {
        //     console.log('TWS: ' + e.data);
        //     var resp = JSON.parse(e.data);
        //     if (resp.success && checkMsg === resp.msg) {
        //       tws.close();
        //       console.log('Websocket test success...');
        //     }
        //   };
        // });

        scope.api = {
          start: scope.initialStart,
          stop: scope.stop
        };
      }
    };
  }
}());
