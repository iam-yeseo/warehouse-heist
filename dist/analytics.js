(() => {
  "use strict";
  const config = window.HEIST_ANALYTICS || {};
  window.dataLayer = window.dataLayer || [];
  const ga4 = /^G-[A-Z0-9]+$/.test(config.measurementId || "");
  const gtm = /^GTM-[A-Z0-9]+$/.test(config.containerId || "");
  const enqueue = function () { window.dataLayer.push(arguments); };
  if (gtm || ga4) {
    const script = document.createElement("script");
    script.async = true;
    if (gtm) {
      window.dataLayer.push({"gtm.start": Date.now(), event: "gtm.js"});
      script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(config.containerId)}`;
    } else {
      enqueue("js", new Date());
      enqueue("config", config.measurementId);
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.measurementId)}`;
    }
    document.head.append(script);
  }
  window.heistTrack = (event, parameters = {}) => {
    if (ga4 && !gtm) enqueue("event", event, parameters);
    else window.dataLayer.push({event, ...parameters});
  };
})();
