mergeInto(LibraryManager.library, {
  TrainingBridge_Emit: function (jsonPtr) {
    if (window.TrainingHost) window.TrainingHost.fromUnity(UTF8ToString(jsonPtr));
  }
});
