(function () {
  'use strict';

  angular.module('iconverse').factory('VoiceRecognitionService', VoiceRecognitionService);

  VoiceRecognitionService.$inject = ['$http', 'UtilityService'];

  function VoiceRecognitionService ($http, UtilityService) {
    // speechserver path
    var serverPath;
    var websocketPath;

    var API = {
      sendAudio: serverPath
    };

    var numberMap = {
      zero: '0',
      one: '1',
      two: '2',
      three: '3',
      four: '4',
      five: '5',
      six: '6',
      seven: '7',
      eight: '8',
      nine: '9',
      ten: '10'
    };

    // note: only replaces words
    //  any one  --> any 1
    //  anyone --> anyone
    var replaceAll = UtilityService.replaceAll;

    return {
      setupServerPath: function (voiceRecognitionEndpoint) {
        serverPath = voiceRecognitionEndpoint;
      },

      setupWebsocketPath: function (voiceRecognitionWebSocket) {
        websocketPath = voiceRecognitionWebSocket;
      },

      getWebsocketPath: function () {
        return websocketPath;
      },

      getTextFromAudioFile: function (file) {
        var fd = new FormData();
        fd.append('file', file);

        return $http.post(API.sendAudio, fd, {
          headers: {
            'Content-Type': undefined
          },
          transformRequest: angular.identity,
          params: fd
        });
      },

      // processGoogleSpeechPayload: function(jsonText, processFinalResultsFn, onTakeInterrimResultsFn){

      // },

      processDictatedText: function (text, isExtractMembershipNum) {
        var input = text.trim().toLowerCase();

        if (angular.isDefined(numberMap[input])) {
          return numberMap[input];
        }
        var clean = replaceAll(input, 'reflex', 'refax');
        clean = replaceAll(clean, 'refex', 'refax');
        clean = replaceAll(clean, 'respect', 'refax');

        /**
         * Convert colloquial way of saying numbers into digits. Possible cases
         * - one, two, three ... nine
         * - ten, twenty, thirty, fourty, fifty, sixty, seventy, eighty, ninety, one hundred
         * - double [digit or ouh], triple [digit or ouh]
         * - OUHs ("o" or "O") as zero, but only if it is adjacent to a number
         */
        clean = replaceAll(clean, 'zero', '0');
        clean = replaceAll(clean, 'one', '1');
        clean = replaceAll(clean, 'two', '2');
        clean = replaceAll(clean, 'three', '3');
        clean = replaceAll(clean, 'four', '4');
        clean = replaceAll(clean, 'five', '5');
        clean = replaceAll(clean, 'six', '6');
        clean = replaceAll(clean, 'seven', '7');
        clean = replaceAll(clean, 'eight', '8');
        clean = replaceAll(clean, 'nine', '9');

        clean = replaceAll(clean, 'ten', '10');
        clean = replaceAll(clean, 'twenty', '20');
        clean = replaceAll(clean, 'thirty', '30');
        clean = replaceAll(clean, 'fourty', '40');
        clean = replaceAll(clean, 'fifty', '50');
        clean = replaceAll(clean, 'sixty', '60');
        clean = replaceAll(clean, 'seventy', '70');
        clean = replaceAll(clean, 'eighty', '80');
        clean = replaceAll(clean, 'ninety', '90');
        clean = replaceAll(clean, 'one hundred', '100');
        clean = replaceAll(clean, 'hundred', '100');

        console.log('passed digit filter', clean);

        // handle double and triple
        clean = UtilityService.matchThenReplace(clean, /\b(double|triple)\s+(\d|oh|o)/gi, function (
          matchedStr
        ) {
          // get the digit
          var temp = matchedStr;
          temp = temp.replace('double', '');
          temp = temp.replace('triple', '');
          temp = temp.trim();

          var digit = temp.match(/^\d|oh|o/i)[0];

          if (digit.toLowerCase() === 'o' || digit.toLowerCase() === 'oh') {
            digit = '0';
          }

          // binary outcome, since either double or triple must exist in the string
          var times = matchedStr.match(/double/i) ? 2 : 3;

          return digit.repeat(times);
        });

        clean = replaceAll(clean, 'doubletree', '33');
        clean = replaceAll(clean, 'double tree', '33');
        clean = replaceAll(clean, 'double for', '44');

        /**
         * Handle 'oh' that are adjacent to numbers
         * NOTE: this will make 'pharaoh 12' --> 'phara0 12'
         * But words that end/start with 'oh' are very rare and even rarer in business context
         */

        // '123 oh' --> 123 0
        clean = UtilityService.matchThenReplace(clean, /\d+\s+(oh)/gi, function (matchedStr) {
          matchedStr = matchedStr.replace('oh', '0');
          return matchedStr;
        });

        // `oh 123` --> 0 123
        clean = UtilityService.matchThenReplace(clean, /(oh)\s+\d+/gi, function (matchedStr) {
          matchedStr = matchedStr.replace('oh', '0');
          return matchedStr;
        });

        /**
         * For long strings of numbers, google likes to think they are phone numbers
         * and format them like +65-1234-2323.
         * Clean away any '+' and '-' from matching patterns
         */
        clean = UtilityService.matchThenReplace(clean, /(\d|\+|-)+/g, function (matchedStr) {
          matchedStr = replaceAll(matchedStr, '-', '');
          matchedStr = matchedStr.replace('+', '');
          return matchedStr;
        });

        /**
         * Find digits seperated by white space, and concat them
         */
        clean = UtilityService.matchThenReplace(clean, /\d\s+\d/g, function (matchedStr) {
          matchedStr = replaceAll(matchedStr, ' ', '');
          return matchedStr;
        });

        /** ** DIGITS SHOULD NOT BE IN NUMERALS AND NOT WORDS AT THIS POINT *** */

        /**
         * If any string only contains only numbers / whitespace / "-"
         * clean whitespace and "-" away
         */
        if (/^(\d|\s|-)*$/.test(clean)) {
          console.log('String only contains only numbers / whitespace / "-"');
          clean = clean.replace(/\s/g, '');
          clean = clean.replace(/-/g, '');
        }

        /**
         * Extract the membership number only if requested
         * 'uhm wait ok it is 2999923423 ahem 123123' --> '2999923423'
         * -- if two numbers are found, take the longer one
         * -- whitespaces in between will be cleaned in next step
         */
        if (isExtractMembershipNum) {
          var matches = clean.match(/\b\d(\d|\s|-|\+)*\b/g);

          if (angular.isArray(matches) && matches.length) {
            // pattern may take one whitespace at the end of the string. trim away first
            matches.map(function (str) {
              str = str.replace(/s/g, ''); // replace the white spaces
              return str.trim();
            });
            // find the longest matching consecutive string
            var longestNumber = _.maxBy(matches, _.size);
            clean = longestNumber;
          }
          else {
            return '';
          }
        }

        // -- CLEANING FNS BELOW HAVE HIGHER CHANCE TO CAUSE FALSE NEGATIVES -- //

        // Assume that if 'to' appears in between 2 digits, user was likely saying '2'
        // cannot check for left/right adjacent like we did for 'oh' since too many words start/end with to
        // 1 to 3 ---> 123
        clean = UtilityService.matchThenReplace(clean, /\d\sto\s\d/g, function (matchedStr) {
          matchedStr = matchedStr.replace('to', '2');
          matchedStr = replaceAll(matchedStr, ' ', '');
          return matchedStr;
        });

        return clean;
      }
    };
  }
}());
