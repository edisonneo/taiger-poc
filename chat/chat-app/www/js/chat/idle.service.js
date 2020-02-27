(function () {
  'use strict';

  angular.module('iconverse').factory('IdleService', IdleService);

  IdleService.$inject = ['$window', 'AppOptions', '$rootScope'];

  function IdleService ($window, AppOptions, $rootScope) {
    var IDLE_DELAY_TIME_MINS = AppOptions.idleDelayTimeMins || 3;
    var timer;

    var IdleService = {
      startTracking: function () {
        document.addEventListener('mousemove', _.throttle(IdleService.resetTimer, 2000));
        document.addEventListener('keypress', _.throttle(IdleService.resetTimer, 2000));

        this.resetTimer(); // initial start

        // console.log('idle tracking started');
      },

      resetTimer: function () {
        clearTimeout(timer);
        timer = setTimeout(IdleService.onTimeout, 60 * 1000 * IDLE_DELAY_TIME_MINS);
        // console.log('timer reset');
      },

      stopTracking: function () {
        clearTimeout(timer);
        document.removeEventListener('onmousemove', IdleService.resetTimer);
        document.removeEventListener('onkeypress', IdleService.resetTimer);
        // console.log('idle tracking stopped');
      },

      onTimeout: function () {
        IdleService.stopTracking();
        $rootScope.$emit('chatService:idleTimeoutEvent');
      }
    };

    return IdleService;
  }
}());
