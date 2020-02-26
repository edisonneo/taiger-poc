(function () {
  'use strict';

  // Directive for compiling inserted html to enable angular events on the dom elements
  angular.module('iconverse').directive('compile', compile);

  compile.$inject = ['$compile', 'IconverseService', '$rootScope'];

  function compile ($compile, ChatService, IconverseService, $rootScope) {
    return function (scope, element, attrs) {
      scope.$watch(
        function (scope) {
          return scope.$eval(attrs.compile);
        },
        function (value) {
          element.html(value);
          $compile(element.contents())(scope);
        }
      );
    };
  }
}());
