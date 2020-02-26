(function () {
  'use strict';

  angular.module('navigator').controller('NavigatorController', NavigatorController);

  NavigatorController.$inject = [
    '$stateParams',
    '$state',
    'NavigatorService',
    '$timeout',
    'NgMap',
    '$scope',
    '$ionicModal',
    '$ionicPopup',
    '$q'
  ];

  function NavigatorController (
    $stateParams,
    $state,
    NavigatorService,
    $timeout,
    NgMap,
    $scope,
    $ionicModal,
    $ionicPopup,
    $q
  ) {
    var vm = this;

    // init modal and set it on vm.locationModal
    $ionicModal
      .fromTemplateUrl('js/navigator/location-choices.modal.html', {
        scope: $scope, // let it share scope with this controller
        animation: 'slide-in-up'
      })
      .then(function (modal) {
        vm.locationModal = modal;

        // intialize only after location modal is created
        activate();
      });

    vm.isModifyingDestination = null; // transient variable to record if destination or start is being modified

    // when opening the location modal, must indicate if destination or starting
    // location is being modified
    vm.openLocationChoicesModal = function (isModifyingDestination) {
      vm.isModifyingDestination = isModifyingDestination;

      // locationModal may not have been initialized here, so wrap #show in timeout
      $timeout(function () {
        vm.locationModal.show();
      });
    };

    // when modal is closed, reset
    vm.closeLocationChoicesModal = function () {
      // reset variables
      vm.isModifyingDestination = null;
      vm.googlePlaceComponentApi.reset();
      vm.locationModal.hide();
    };

    // fn ran for when a location a google place is chosen from the list
    vm.onLocationChosen = function (locationString, placeId) {
      // change the appropriate field
      if (vm.isModifyingDestination === false) {
        // if its a null value, ignore
        // modifying current location

        // current location needs to be passed to the map in latLng object,
        // so we must get it from google using the placeId
        $scope.app.showLoader();

        NgMap.getMap()
          .then(function (map) {
            return NavigatorService.getGooglePlaceDetailsByPlaceId(map, placeId);
          })
          .then(function (gPlace) {
            // console.log(gPlace);
            changeCurrentPosition(
              {
                lat: gPlace.geometry.location.lat(),
                lng: gPlace.geometry.location.lng()
              },
              locationString
            );

            $scope.app.hideLoader();
          });
      }
      else {
        changeDestination(locationString);
      }

      vm.closeLocationChoicesModal(); // close the modal and reset
    };

    vm.onFailedToGetStartLocation = function (reasonDetailsText) {
      // set a fallback currPosition as ion-google-place requires it in order to display and load properly
      // it needs an origin from which to show places - from closest to furthest to this origin
      vm.currentPosition = { lat: 1.2990231, lng: 103.7868208 };

      vm.openLocationChoicesModal(false);
    };

    vm.onManualSelectToGetCurrentLocation = function () {
      NavigatorService.saveGeolocationOptInSettings('TRUE');
      vm.getDeviceLocationAndSetCurrentPosition();
    };

    vm.getDeviceLocationAndSetCurrentPosition = function () {
      // initial load
      $scope.app.showLoader(null, 'Getting your location...');

      NavigatorService.getCurrentLatLng()
        .then(function (position) {
          // draw directions on the map
          drawDirections(position, vm.destination);

          vm.currentPosition = position;

          // reverse geocode for the current address for displaying
          return NavigatorService.getCurrentAddressByLatLng(position.lat, position.lng);
        })
        .then(function (address) {
          vm.currentAddress = address;

          $scope.app.hideLoader();
        })
        .catch(function (err) {
          // if there is an error getting the user's current location
          // allow the user to enter a manual address
          $scope.app.hideLoader();
          $scope.app.showBasicAlert(
            'Manual Address Entry',
            'There was a problem getting your current location. Please enter your starting address.'
          );
          vm.onFailedToGetStartLocation();
        });
    };

    // intialization
    var activate = function () {
      // First check if there are any previous geolocation opt in settings
      if (!NavigatorService.getGeolocationOptInSettings()) {
        // if not previous settings were saved
        // show a popup asking user if user wants
        // to use their current location or a custom location
        vm.locationSettingsPopup = $ionicPopup.confirm({
          title: 'Detect Your Current Location?',
          template:
            '<div class="text-center">Would you like us to use your current location as the starting point?</div>',
          okText: 'Yes',
          cancelText: 'No'
        });

        vm.locationSettingsPopup.then(function (isConfirm) {
          if (isConfirm) {
            // save the opt in settings
            NavigatorService.saveGeolocationOptInSettings('TRUE');
            vm.getDeviceLocationAndSetCurrentPosition();
          }
          else {
            // save the opt out settings
            NavigatorService.saveGeolocationOptInSettings('FALSE');
            console.log('user opted out of geolocation');
            $scope.app.showBasicAlert(
              'Manual Address Entry',
              'For directions, please enter your starting location.'
            );
            vm.onFailedToGetStartLocation();
          }
        });
      }
      else if (NavigatorService.getGeolocationOptInSettings() === 'TRUE') {
        vm.getDeviceLocationAndSetCurrentPosition();
      }
      else {
        // user previously opted out
        vm.onFailedToGetStartLocation();
      }
    };

    vm.destination = $stateParams.destination;

    vm.transitType = 'DRIVING'; // default - other option is "TRANSIT" which is public transport

    var directionsService = NavigatorService.getGoogleDirectionsService();
    var directionsDisplay = NavigatorService.getGoogleDirectionsDisplay();

    $scope.$watch('vm.transitType', function () {
      drawDirections(vm.currentPosition, vm.destination, vm.transitType);
    });

    var drawDirections = function (origin, destination, transitType) {
      // $scope.app.showLoader();

      NgMap.getMap().then(function (map) {
        directionsDisplay.setMap(map);
        console.log('origin', origin);
        console.log('dest', destination);
        directionsService.route(
          {
            origin: origin, // a shortland latlng object like {lat: xxx, lng: xxx}
            destination: destination, // an address string
            travelMode: transitType || 'DRIVING',
            region: 'sg'
          },
          function (response, status) {
            $scope.app.hideLoader();

            if (status === 'OK') {
              directionsDisplay.setDirections(response);
              console.log(response);
            }
            else {
              console.log(status);
              $scope.app.showBasicAlert(
                'Error',
                'Could not find a valid route to your destination'
              );
            }
          }
        );
      });
    };

    directionsDisplay.addListener('directions_changed', function () {
      vm.totalDistanceKm = NavigatorService.computeTotalDistance(directionsDisplay.getDirections());
    });

    vm.openGoogleMaps = function () {
      NavigatorService.openGoogleMapsInNewWindow(
        vm.currentAddress,
        vm.destination,
        vm.transitType.toLowerCase()
      );
    };

    var changeCurrentPosition = function (positionLatLng, addressString) {
      vm.currentAddress = addressString;
      vm.currentPosition = positionLatLng;
      drawDirections(vm.currentPosition, vm.destination);
    };

    var changeDestination = function (addressString) {
      vm.destination = addressString;
      drawDirections(vm.currentPosition, vm.destination);
    };

    // handle click on Start Navigation Button
    vm.startNavigation = function () {
      if (angular.isUndefined(window.cordova)) {
        $scope.app.showBasicAlert(
          'Note',
          'Turn-by-turn navigation is not available when previewing on a web browser'
        );
      }
      else {
        console.log('opening navigator');
        launchnavigator.isAppAvailable(launchnavigator.APP.GOOGLE_MAPS, function (isAvailable) {
          var app;
          if (isAvailable) {
            app = launchnavigator.APP.GOOGLE_MAPS;
          }
          else {
            console.warn('Google Maps not available - falling back to user selection');
            app = launchnavigator.APP.USER_SELECT;
          }

          launchnavigator.navigate(
            vm.destination, // destination
            function () {
              // success
            },
            function () {
              // fail
            },
            {
              app: app // options
            }
          );
        });
      }
    };
  }
}());
