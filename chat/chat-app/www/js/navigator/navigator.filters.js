'use-strict';

angular
  .module('navigator')

  .filter('strReplace', function () {
    return function (input, from, to) {
      input = input || '';
      from = from || '';
      to = to || '';
      return input.replace(new RegExp(from, 'g'), to);
    };
  });
