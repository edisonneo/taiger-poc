window.placeTools = angular.module('ion-place-tools', []);
placeTools.directive('ionGooglePlace', [
  '$ionicTemplateLoader',
  '$ionicPlatform',
  '$q',
  '$timeout',
  '$rootScope',
  '$document',
  function ($ionicTemplateLoader, $ionicPlatform, $q, $timeout, $rootScope, $document) {
    return {
      require: '?ngModel',
      restrict: 'E',
      templateUrl: 'src/ionGooglePlaceTemplate.html',
      replace: true,
      scope: {
        searchQuery: '=ngModel',
        currentPosition: '=', // expects an object containing `lat` and  `lng`
        locationChanged: '&',
        api: '=',
        radius: '=?' // in metres. optional
      },
      link: function (scope, element, attrs, ngModel) {
        scope.dropDownActive = false;
        var service = new google.maps.places.AutocompleteService();
        var searchEventTimeout = undefined;
        var latLng = null;

        if (scope.currentPosition) {
          latLng = new google.maps.LatLng(scope.currentPosition.lat, scope.currentPosition.lng);
        }
        else {
          console.error(
            'ion-place-autocomplete directive expects currentPosition attr to be passed in to initialize properly!'
          );
        }

        var searchInputElement = angular.element(element.find('input'));

        scope.selectLocation = function (location) {
          scope.dropDownActive = false;
          scope.searchQuery = location.description;
          // console.log(location);
          if (scope.locationChanged) {
            scope.locationChanged()(location.description, location.place_id);
          }
        };
        if (!scope.radius) {
          scope.radius = 50000; // metres
        }

        // API to control this component from external scope
        scope.api = {
          reset: function () {
            console.log('resetting ionplace');
            scope.searchQuery = '';
            scope.locations = [];
            scope.noResults = false;
            scope.showLoading = false;
          }
        };

        scope.locations = [];

        scope.$watch('searchQuery', function (query) {
          if (!query) {
            query = '';
          }
          scope.dropDownActive = query.length >= 3 && scope.locations.length;
          if (searchEventTimeout) $timeout.cancel(searchEventTimeout);
          searchEventTimeout = $timeout(function () {
            if (!query) return;
            if (query.length < 3) {
              scope.locations = [];
              return;
            }

            var req = {
              componentRestrictions: { country: 'sg' },
              input: query
            };

            if (latLng) {
              req.location = latLng;
              req.radius = scope.radius;
            }

            scope.showLoading = true;
            scope.noResults = false;
            service.getPlacePredictions(req, function (predictions, status) {
              scope.showLoading = false;

              if (status == google.maps.places.PlacesServiceStatus.OK) {
                scope.locations = predictions;
                console.log(scope.locations);
                scope.$apply();
              }
              else {
                scope.noResults = true;
              }
            });
          }, 350); // we're throttling the input by 350ms to be nice to google's API
        });

        var onClick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          scope.dropDownActive = true;
          scope.$digest();
          searchInputElement[0].focus();
          setTimeout(function () {
            searchInputElement[0].focus();
          }, 0);
        };

        var onCancel = function (e) {
          setTimeout(function () {
            scope.dropDownActive = false;
            scope.$digest();
          }, 200);
        };

        element.find('input').bind('click', onClick);
        element.find('input').bind('blur', onCancel);
        element.find('input').bind('touchend', onClick);

        if (attrs.placeholder) {
          element.find('input').attr('placeholder', attrs.placeholder);
        }
      }
    };
  }
]);

// Add flexibility to template directive
var template = '<div class="ion-place-tools-autocomplete">'
  + '<ion-list>'
  + '<label class="item item-input">'
  + '<i class="icon ion-search placeholder-icon"></i>'
  + '<input type="text" autocomplete="off" ng-model="searchQuery">'
  + '<ion-spinner ng-if="showLoading" style="top: 2px;position: relative;right: 8px;" icon="ios-small"></ion-spinner>'
  + '</label>'
  + '<ion-item ng-repeat="location in locations" ng-click="selectLocation(location)">'
  + '{{location.description}}'
  + '</ion-item>'
  + '<ion-item ng-if="noResults && !locations.length" class="text-center">No Results Found</ion-item>'
  + '</ion-list>'
  + '</div>';
placeTools.run([
  '$templateCache',
  function ($templateCache) {
    $templateCache.put('src/ionGooglePlaceTemplate.html', template);
  }
]);
