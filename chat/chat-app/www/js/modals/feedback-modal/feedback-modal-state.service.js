(function () {
  'use strict';

  angular.module('iconverse').factory('FeedbackModalStateService', FeedbackModalStateService);

  FeedbackModalStateService.$inject = [];

  function initializeState () {
    return {
      hasTalkedToBot: false,
      trigger: null,
      isFeedbackShowing: false
    };
  }

  function FeedbackModalStateService () {
    var state = initializeState();
    var firstTrigger = null;

    function getValidStateKeys () {
      return Object.keys(state);
    }

    function getState () {
      return state;
    }

    function resetState () {
      state = initializeState();
      firstTrigger = null;
    }

    /**
     * @param {object} nextState
     */
    function setState (nextState) {
      var isObject = (
        typeof nextState === 'object'
        && nextState.constructor === Object
      );

      if (!isObject) {
        throw new Error('nextState argument should be an object');
      }

      var validKeys = getValidStateKeys();

      validKeys.forEach(function (key) {
        if (key in state) {
          if (key in nextState) {
            state[key] = nextState[key];
          }
        }
        else {
          // eslint-disable-next-line no-console
          console.warn('Attempt to update state with unknown key', key);
        }
      });
    }

    function shouldPromptFeedback () {
      if (
        state.trigger === 'chat_close_button'
        && state.hasTalkedToBot
        && !state.isFeedbackShowing
      ) {
        return true;
      }

      return false;
    }

    function shouldExitFeedback () {
      if (
        state.trigger === 'chat_close_button'
        && state.hasTalkedToBot
        && state.isFeedbackShowing
      ) {
        return true;
      }

      return false;
    }

    function setFirstTrigger (trigger) {
      if (!firstTrigger) firstTrigger = trigger;
    }

    return {
      set: setState,
      get: getState,
      reset: resetState,
      setFirstTrigger: setFirstTrigger,
      shouldExitFeedback: shouldExitFeedback,
      shouldPromptFeedback: shouldPromptFeedback
    };
  }
}());
