/* Placeholder for analytics integration.
 * Replace with Plausible/GA4 script loader once account is ready.
 */
(function () {
  if (typeof window === "undefined") return;
  window.rexaiAnalytics = window.rexaiAnalytics || {
    track: function (eventName, payload) {
      console.log("[rexai-analytics]", eventName, payload || {});
    },
  };
})();
