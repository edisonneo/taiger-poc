(function () {
  'use strict';

  angular.module('iconverse').directive('voiceVisualization', voiceVisualization);

  voiceVisualization.$inject = [
    '$timeout',
    'ChatService',
    'AudioStreamingService',
    'VoiceRecognitionService',
    'TextToSpeechService',
    '$interval'
  ];

  function voiceVisualization (
    $timeout,
    ChatService,
    AudioStreamingService,
    VoiceRecognitionService,
    TextToSpeechService,
    $interval
  ) {
    return {
      scope: {
        isVoiceDetected: '<'
      },
      templateUrl: 'js/chat/components/voice-visualization/voice-visualization.directive.html',
      link: function (scope) {
        var vm = scope;
        vm.isTimeToShowWarning = false;
        initVisualization();

        // set count down to show warning message after 4s for the first time
        $timeout(function () {
          vm.isTimeToShowWarning = true;
        }, 4000);

        function initVisualization () {
          var audioContext = window.AudioContext || window.webkitAudioContext;
          var audioAPI = new audioContext();
          var analyserNode;
          vm.frequencyData = new Uint8Array(128);
          var bufferLength;
          var dataArray;
          var barWidth;
          var barHeight;
          var x = 0;

          var canvas = document.querySelector('#voiceVisualizationCanvas');
          canvas.height = 50;
          var ctx = canvas.getContext('2d');

          function createAnalyserNode (audioSource) {
            analyserNode = audioAPI.createAnalyser();
            analyserNode.fftSize = 32;
            audioSource.connect(analyserNode);
            bufferLength = analyserNode.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
            // barWidth = canvas.width / bufferLength;
          }

          function setupStream (stream) {
            // Create an audio input from the stream.
            var audioSource = audioAPI.createMediaStreamSource(stream);
            createAnalyserNode(audioSource);
            animate();
          }

          function animate () {
            requestAnimationFrame(animate);
            drawWaves();
          }
          var on = 'rgba(150, 150, 255, 0.1)';
          var waves = [on, on, on, on, on, on, on, on, on, on];
          var waveIterationCount = 0;
          setupStream(AudioStreamingService.getMediaStream());

          function drawWaves () {
            var offset;
            var left;
            var right;
            var leftConstraint;
            var rightConstraint;
            var j = waves.length - 1;
            canvas.width = canvas.width;

            var avgVolume = _.reduce(
              dataArray,
              function (sum, value) {
                return sum + value;
              },
              0
            ) / dataArray.length;
            analyserNode.getByteFrequencyData(dataArray);

            var opacityBasedOnVolume = avgVolume / 255;
            // console.log(avgVolume);
            for (j; j >= 0; j--) {
              ctx.fillStyle = 'rgba(' + avgVolume * 2 + ', 150, 255, ' + (opacityBasedOnVolume + 0.05) + ')';

              offset = waveIterationCount + j * Math.PI * 120;
              left = (Math.sin(offset / 100) / 3) * 200;
              right = (Math.sin(offset / 100) / 3) * 200;
              leftConstraint = ((Math.sin(offset / 14 + 2) + 1) / 2) * 100;
              rightConstraint = ((Math.sin(offset / 14 + 1) + 1) / 2) * 100;

              ctx.beginPath();
              ctx.moveTo(0, left + 100);
              ctx.bezierCurveTo(
                canvas.width / 3,
                leftConstraint,
                (canvas.width / 3) * 2,
                rightConstraint,
                canvas.width,
                right + 100
              );
              ctx.lineTo(canvas.width, canvas.height * 2);
              ctx.lineTo(0, canvas.height * 2);
              ctx.lineTo(0, left + 100);
              ctx.closePath();
              ctx.fill();
            }

            waveIterationCount += 1 + opacityBasedOnVolume * 4;
            if (waveIterationCount > 1880) {
              waveIterationCount = 0;
            }
          }
        }
      }
    };
  }
}());
