/* Equivalente ao source/main.brs: cria a cena e encaminha o controle remoto. */
(function (EP) {
  'use strict';
  function exitApp() { EP.exitApp(); }

  var BOOT_START = new Date().getTime(), SPLASH_MIN = 1500; // splash_min_time do Roku

  function hideSplash() {
    var splash = document.getElementById('boot-splash');
    if (!splash) return;
    var wait = Math.max(0, SPLASH_MIN - (new Date().getTime() - BOOT_START));
    setTimeout(function () {
      splash.className = 'hidden';
      setTimeout(function () { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 360);
    }, wait);
  }

  function splashVisible() { return !!document.getElementById('boot-splash'); }

  function boot() {
    EP.registerTvKeys();
    var stage = document.getElementById('stage');
    EP.Stage.fit(stage);
    var scene = EP.scene = new EP.MainScene(stage);

    document.addEventListener('keydown', function (event) {
      var key = EP.keyName(event);
      if (!key) return;
      if (splashVisible() && key !== 'back') { event.preventDefault(); return; } // ignora teclas durante o splash
      var typing = document.activeElement && document.activeElement.tagName === 'INPUT';
      var consumed = scene.handleKey(key, event);
      if (consumed) { event.preventDefault(); return; }
      if (key === 'back' && !typing) { event.preventDefault(); exitApp(); }
    }, true);

    // Ao sair para a Home da TV , pausa a reprodução e descarrega a prévia.
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) return;
      try { scene.shell.views[1].stopPreview(); } catch (_) {}
      try { if (scene.shell.playerView.isVisible()) scene.shell.playerView.video.pause(); } catch (_) {}
      try { scene.shell.releaseMemory(); } catch (_) {}
    });

    var initialLink = EP.launchDeepLink();
    if (initialLink) scene.setDeepLink(initialLink);

    scene.start();
    hideSplash();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
}(window.EP));
