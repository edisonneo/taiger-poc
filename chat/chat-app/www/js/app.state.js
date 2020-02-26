angular
  .module('starter')

  .config(function ($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app', {
      abstract: true,
      templateUrl: 'templates/menu.html',
      controller: 'AppCtrl',
      controllerAs: 'app'
    });

    // if none of the above states are matched, use this as the fallback
    $urlRouterProvider.otherwise('/chat');
  });
