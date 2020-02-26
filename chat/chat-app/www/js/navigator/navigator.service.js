(function () {
  'use strict';

  angular.module('navigator').factory('NavigatorService', NavigatorService);

  NavigatorService.$inject = ['$q', '$window'];

  function NavigatorService ($q, $window) {
    var _directionsService = new google.maps.DirectionsService();
    var _directionsDisplay = new google.maps.DirectionsRenderer();

    var GEOLOCATION_OPT_IN_SESSION_STORAGE_KEY = 'iconverse-geolocationOptIn';

    return {
      getGoogleDirectionsService: function () {
        return _directionsService;
      },

      getGoogleDirectionsDisplay: function () {
        return _directionsDisplay;
      },

      getCurrentLatLng: function () {
        var deferred = $q.defer();

        var posOptions = { timeout: 10000, enableHighAccuracy: false };

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            function (position) {
              console.log(position.coords);
              deferred.resolve({
                lat: position.coords.latitude,
                lng: position.coords.longitude
              }); // contains props: `latitude` and `longitude`
            },
            function (err) {
              console.error('error getting coordinates', err);
              deferred.reject(err);
            },
            posOptions
          );
        }
        else {
          deferred.reject();
          console.error('browser does not support navigator.geolocation');
        }

        return deferred.promise;
      },

      computeTotalDistance: function (result) {
        var total = 0;
        var myroute = result.routes[0];
        for (var i = 0; i < myroute.legs.length; i++) {
          total += myroute.legs[i].distance.value;
        }
        total /= 1000;
        return total;
      },

      openGoogleMapsInNewWindow: function (originAddress, destinationAddress, travelMode) {
        var url = 'https://www.google.com/maps/dir/?api=1&origin='
          + encodeURI(originAddress)
          + '&destination='
          + encodeURI(destinationAddress)
          + '&travelmode='
          + travelMode;
        window.open(url, '_blank');
      },

      getCurrentAddressByLatLng: function (lat, lng) {
        var deferred = $q.defer();

        var geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat: lat, lng: lng } }, function (results, status) {
          if (status === 'OK' && results.length > 0) {
            deferred.resolve(results[0].formatted_address);
          }
          else {
            deferred.reject('Reverse geocode failed');
          }
        });

        return deferred.promise;
      },

      getGooglePlaceDetailsByPlaceId: function (map, placeId) {
        var deferred = $q.defer();

        var service = new google.maps.places.PlacesService(map);

        var request = {
          placeId: placeId
        };

        // execute the call to google
        service.getDetails(request, function (place, status) {
          if (status == google.maps.places.PlacesServiceStatus.OK) {
            deferred.resolve(place);
          }
          else {
            deferred.reject();
          }
        });

        return deferred.promise;
      },

      saveGeolocationOptInSettings: function (optInValue) {
        // remove any previously saved setting
        $window.sessionStorage.removeItem(GEOLOCATION_OPT_IN_SESSION_STORAGE_KEY);

        // update the value
        $window.sessionStorage.setItem(GEOLOCATION_OPT_IN_SESSION_STORAGE_KEY, optInValue);
        console.log('saved the geolocationOptIn option', this.getGeolocationOptInSettings());
      },

      getGeolocationOptInSettings: function () {
        return $window.sessionStorage.getItem(GEOLOCATION_OPT_IN_SESSION_STORAGE_KEY);
      }
    };
  }
}());
