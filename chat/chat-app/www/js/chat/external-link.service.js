(function () {
  'use strict';

  angular.module('iconverse').factory('ExternalLinkService', ExternalLinkService);

  function ExternalLinkService () {
    /**
     * @typedef CompletedSurvey
     * @property {string} messageId message.id
     * @property {string} url
     */

    /** @var CompletedSurvey[] */
    var completedSurveys = [];
    return {
      add: function (messageId, url, status) {
        completedSurveys.push({ messageId: messageId, url: url, status: status });
      },
      getStatus: function (messageId, url) {
        var surveyLink = _.find(completedSurveys, function (item) {
          return (
            item.messageId === messageId
            && item.url === url
          );
        });

        if (!surveyLink) return null;

        return surveyLink.status;
      },
      isCompleted: function (messageId, url) {
        return Boolean(_.find(completedSurveys, function (item) {
          return (
            item.messageId === messageId
            && item.url === url
            && item.status === 'taken'
          );
        }));
      }
    };
  }
}());
