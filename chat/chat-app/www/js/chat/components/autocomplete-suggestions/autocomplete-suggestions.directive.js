(function () {
  'use strict';

  angular.module('iconverse').directive('autocompleteSuggestions', autocompleteSuggestions);

  autocompleteSuggestions.$inject = ['IconverseService'];

  function autocompleteSuggestions (IconverseService) {
    return {
      scope: {
        textInput: '=',
        onSelectSuggestion: '&',
        activeSuggestion: '=',
        queryMinLength: '<',
        api: '=',
        cid: '='
      },
      templateUrl:
        'js/chat/components/autocomplete-suggestions/autocomplete-suggestions.directive.html',
      link: function (scope) {
        scope.suggestions = [];
        scope.isLoading = false;
        scope.suggestionLimit = 0;
        scope.activeIndex = false;
        scope.selectedSuggestion = '';

        scope.keyHandler = function (event) {
          switch (event.keyCode) {
          // UP ARROW
          case 38:
            // If the activeIndex exists, highlight the previous suggestion
            // else highlight the bottom suggestion (happens in initial state)
            if (scope.activeIndex) {
              scope.activeIndex -= 1;
            }
            else {
              scope.activeIndex = scope.suggestionLimit;
            }
            // If it reaches the top, highlight the bottom suggestion
            if (scope.activeIndex < 0) {
              scope.activeIndex = scope.suggestionLimit;
            }
            break;
            // DOWN ARROW
          case 40:
            // If the activeIndex exists, highlight the next suggestion
            // else highlight the bottom suggestion (happens in initial state)
            if (scope.activeIndex || scope.activeIndex === 0) {
              scope.activeIndex += 1;
            }
            else {
              scope.activeIndex = scope.suggestionLimit;
            }
            // If it reaches the bottom, highlight the top suggestion
            if (scope.activeIndex > scope.suggestionLimit) {
              scope.activeIndex = 0;
            }
            break;
            // ENTER KEY
          case 13:
            if (scope.suggestions.length > 0 && scope.activeSuggestion) {
              try {
                event.preventDefault();
              }
              catch (err) {
                // Expect to throw error for cases:
                // 1. Event is created by application with only keyCode
                //    e.g. event = { keyCode: 13 }
              }
              finally {
                scope.selectSuggestion(scope.activeSuggestion);
              }
            }
            break;
          default:
            break;
          }
        };

        scope.selectSuggestion = function (suggestion) {
          // Callback defined in props of directive
          // Suggestion object is passed to the parent
          scope.onSelectSuggestion({ suggestion: suggestion });
          scope.textInput = '';
          scope.isVisible = false;
          scope.suggestions = [];
        };

        scope.highlightSuggestion = function (suggestion) {
          // Find the index of the passed in suggestion
          scope.activeIndex = _.findIndex(scope.suggestions, function (suggestionResult) {
            return suggestionResult === suggestion;
          });
        };

        scope.deHighlightSuggestion = function () {
          scope.activeIndex = false;
          scope.isFocused = false;
        };

        scope.$watch('activeIndex', function () {
          if (scope.suggestions.length) {
            // Change the highlighted suggestion when the index changes
            scope.activeSuggestion = scope.suggestions[scope.activeIndex];
          }
        });

        scope.$watch(
          'textInput',
          _.debounce(function (query) {
            scope.activeSuggestion = '';
            if (query && query.length > scope.queryMinLength) {
              // Get the suggestions from the API\
              getSuggestions(scope.textInput, scope.cid);
            }
            else {
              scope.suggestions = [];
            }
          }, 500)
        );

        function getSuggestions (query, cid) {
          // Show loading spinner
          scope.isLoading = true;
          // Pass in the text query to the api
          IconverseService.getIntentPredictions(query, cid)
            .then(function (response) {
              // Update the suggestions with the response
              var suggestions = response.data.slice(0, 8);
              // Remove any suggestion which is similar to textInput
              suggestions = _.filter(suggestions, function (suggestion) {
                return suggestion.replace(/[^\w]/gi, '').toLowerCase() !== scope.textInput.replace(/[^\w]/gi, '').toLowerCase();
              });

              // Append textInput at the end of suggestions list
              if (suggestions && suggestions.length > 0) {
                suggestions.push(scope.textInput);
                scope.suggestions = suggestions;
                scope.suggestionLimit = suggestions.length - 1;
                scope.highlightSuggestion(scope.textInput);
              }
              else {
                scope.suggestions = [];
                scope.suggestionLimit = 0;
              }
            })
            .finally(function () {
              // Hide loading spinner
              scope.isLoading = false;
            });
        }

        scope.api = {
          keyHandler: scope.keyHandler
        };
      }
    };
  }
}());
