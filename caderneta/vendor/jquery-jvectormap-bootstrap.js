(function (window, $) {
  window.jvm = window.jvm || {};
  window.jvm.Map = window.jvm.Map || {};
  window.jvm.Map.maps = window.jvm.Map.maps || {};

  if ($ && $.fn && !$.fn.vectorMap) {
    $.fn.vectorMap = function (method, mapName, mapData) {
      if (method === 'addMap' && mapName && mapData) {
        window.jvm.Map.maps[mapName] = mapData;
      }

      return this;
    };
  }
})(window, window.jQuery);
