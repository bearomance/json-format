// Listen for plugin icon click event
chrome.action.onClicked.addListener((tab) => {
  // Open new tab
  chrome.tabs.create({
    url: 'index.html'
  });
});
