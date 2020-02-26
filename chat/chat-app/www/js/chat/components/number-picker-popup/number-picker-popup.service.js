(function () {
  'use strict';

  angular.module('iconverse').factory('NumberPickerPopup', NumberPickerPopup);

  NumberPickerPopup.$inject = ['$rootScope', '$ionicPopup'];

  function NumberPickerPopup ($rootScope, $ionicPopup) {
    var $scope = $rootScope.$new();
    $scope.vm = {};
    var vm = $scope.vm;

    // Determine if user is accessing on IE.
    // For IE Users, use <a></a> instead of <button></button>
    // in template to bypass nasty bug where clicks are registered twice for button elements
    // https://github.com/ionic-team/ionic/issues/2885
    vm.isIE = ionic.Platform.ua.toLowerCase().indexOf('trident') > -1;

    var defaults = {
      title: 'Select a Number',
      start: 1,
      min: 0,
      max: 9007199254740991,
      step: 1
    };

    vm.opts = defaults;

    vm.increment = function () {
      vm.selectedNumber += vm.opts.step;
      // Fix inaccuracy in decimal floating numbers which causes trailing decimals e.g. 0.1300001
      if (vm.opts.step < 1) {
        vm.selectedNumber = Number(vm.selectedNumber.toFixed(2));
      }
    };

    vm.decrement = function () {
      vm.selectedNumber -= vm.opts.step;
      // Fix inaccuracy in decimal floating numbers which causes trailing decimals e.g. 0.1300001
      if (vm.opts.step < 1) {
        vm.selectedNumber = Number(vm.selectedNumber.toFixed(2));
      }
    };

    return {
      open: function (config) {
        vm.opts = angular.extend({}, vm.opts, config);
        console.log('opts', vm.opts);
        vm.selectedNumber = vm.opts.start;

        if (!angular.isFunction(vm.opts.callback)) {
          console.error(
            'NumberPickerPopup: callback must be provided!. Number picker will not function correctly!'
          );
        }

        vm.popup = $ionicPopup.show({
          templateUrl: 'js/chat/components/number-picker-popup/number-picker-popup.html',
          scope: $scope,
          cssClass: 'ionic_datepicker_popup',
          buttons: [
            {
              text: 'Set',
              type: 'button_set',
              onTap: function (e) {
                vm.opts.callback(vm.selectedNumber);
              }
            },
            {
              text: 'Close',
              type: 'button_close'
            }
          ]
        });
      }
    };
  }
}());
