angular
  .module('navigator')

  .config(function ($stateProvider, $urlRouterProvider) {
    $stateProvider.state('app.navigator', {
      url: '/navigator/:destination',
      views: {
        menuContent: {
          templateUrl: 'js/navigator/navigator.html',
          controller: 'NavigatorController',
          controllerAs: 'vm'
        }
      }
    });
  });
