(function () {
  'use strict';

  angular.module('iconverse').factory('UtilityService', UtilityService);

  UtilityService.$inject = [];

  function UtilityService () {
    return {
      isIE: function () {
        var agent = navigator.userAgent;
        var isIE10 = agent.indexOf('MSIE 10') > -1;

        var isIE11 = !isIE10 && agent.indexOf('.NET4.0E') > -1 && agent.indexOf('.NET4.0C') > -1;

        return isIE10 || isIE11 || false;
      },

      replaceAll: function (str, search, replacement) {
        return str.replace(new RegExp('\\b' + search + '\\b', 'g'), replacement);
      },

      // L2703563 --> L-2-0-3-5-6-3
      interleaveText: function (str, separator) {
        if (!separator) separator = '';
        str = str.replace(/(.{1})/g, '$1' + separator);
        str = str.substring(0, str.length - separator.length); // remove extra separator at the end
        return str;
      },

      // Note: replaceFn must return a string to replace the passed in matchStr
      matchThenReplace: function (str, regex, replaceFn) {
        if (!str) return;
        var matches = str.match(regex);
        angular.forEach(matches, function (matchStr) {
          str = str.replace(matchStr, replaceFn(matchStr));
        });
        return str;
      }
    };
  }
}());
