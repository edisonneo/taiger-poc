(function () {
  'use strict';

  angular.module('iconverse').factory('TextToSpeechService', TextToSpeechService);

  TextToSpeechService.$inject = ['UtilityService', '$log'];
  // Sdn Bhd- Sendirian Berhad
  function TextToSpeechService (UtilityService, $log) {
    // private fn that preprocesses text before passing to TTS
    function preprocessText (text) {
      /**
       * Find GL numbers like: L2703563 (L followed by 7 digits)
       * For each of these numbers, replace with an interleaved version (e.g. L-2-0-3-5-6-3)
       */
      text = UtilityService.matchThenReplace(text, /L\d{7}/gi, function (matchedStr) {
        return UtilityService.interleaveText(matchedStr, '-');
      });

      // convert "1:28 AM" to "1 28 AM"
      text = UtilityService.matchThenReplace(text, /\d:\d\d [AP]M/gi, function (matchedStr) {
        return matchedStr.replace(':', ' ');
      });

      // clean any HTML away
      text = text.replace(/(<([^>]+)>)/gi, '');

      return text;
    }

    var VOICE_NAME = {
      en: 'UK English Female',
      zh: 'Chinese Female'
    };

    var _voiceName = VOICE_NAME.en;

    return {
      setVoice: function (langCode) {
        if (langCode) _voiceName = VOICE_NAME[langCode.iso];
      },
      speak: function (text, opts) {
        text = preprocessText(text);

        $log.log('TTS Speaking: ' + text);

        responsiveVoice.speak(text, _voiceName, opts);
      },
      isPlaying: function () {
        return responsiveVoice.isPlaying();
      },
      cancel: function () {
        responsiveVoice.cancel();
      },
      cancelIfPlaying: function () {
        if (this.isPlaying()) {
          this.cancel();
        }
      }
    };
  }
}());
