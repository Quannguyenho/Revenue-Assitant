function enableSidePanelOnClick() {
  if (!chrome.sidePanel || !chrome.sidePanel.setPanelBehavior) return;
  Promise.resolve(chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }))
    .catch((err) => {
      console.warn("Could not enable side panel action click", err && err.message ? err.message : err);
    });
}

chrome.runtime.onInstalled.addListener(enableSidePanelOnClick);
chrome.runtime.onStartup.addListener(enableSidePanelOnClick);
enableSidePanelOnClick();
