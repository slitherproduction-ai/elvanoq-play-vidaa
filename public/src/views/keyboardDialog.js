/* Equivalente ao StandardKeyboardDialog / KeyboardDialog do Roku.
 * O campo de texto abre o teclado virtual nativo da TV (VIDAA) ao receber foco.
 * Foco: campo -> (baixo) botões; ←/→ entre botões; OK confirma; Voltar cancela.
 */
(function (EP) {
  'use strict';

  function KeyboardDialog(stage, opts) {
    var self = this;
    this.opts = opts;
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'kb-backdrop';
    var card = document.createElement('div');
    card.className = 'kb-card';
    card.innerHTML = '<div class="kb-title"></div><div class="kb-message"></div><input class="kb-input" autocomplete="off" spellcheck="false"><div class="kb-buttons"></div>';
    card.querySelector('.kb-title').textContent = opts.title || '';
    card.querySelector('.kb-message').textContent = opts.message || '';
    this.input = card.querySelector('.kb-input');
    this.input.type = opts.secure ? 'password' : 'text';
    this.input.value = opts.text || '';
    if (opts.placeholder) this.input.placeholder = opts.placeholder;
    this.buttons = [];
    var row = card.querySelector('.kb-buttons');
    for (var i = 0; i < opts.buttons.length; i++) {
      var b = document.createElement('div');
      b.className = 'kb-button';
      b.textContent = opts.buttons[i];
      (function (index) { b.addEventListener('click', function () { self.choose(index); }); }(i));
      row.appendChild(b);
      this.buttons.push(b);
    }
    this.input.addEventListener('click', function () { self.focus(-1); });
    this.backdrop.appendChild(card);
    stage.appendChild(this.backdrop);
    this.focusIndex = -1;
    this.focus(-1);
  }

  KeyboardDialog.prototype.focus = function (index) {
    this.focusIndex = index;
    this.input.className = 'kb-input' + (index === -1 ? ' focused' : '');
    for (var i = 0; i < this.buttons.length; i++) this.buttons[i].className = 'kb-button' + (i === index ? ' focused' : '');
    var input = this.input;
    if (index === -1) setTimeout(function () { try { input.focus(); } catch (_) {} }, 0);
    else { try { input.blur(); } catch (_) {} }
  };

  KeyboardDialog.prototype.choose = function (index) {
    var value = this.input.value;
    this.close();
    if (this.opts.onButton) this.opts.onButton(index, value);
  };

  KeyboardDialog.prototype.close = function () {
    try { this.input.blur(); } catch (_) {}
    if (this.backdrop.parentNode) this.backdrop.parentNode.removeChild(this.backdrop);
    this.closed = true;
  };

  /* Retorna true quando consumiu a tecla. */
  KeyboardDialog.prototype.handleKey = function (key, event) {
    var cancelIndex = this.buttons.length - 1;
    if (key === 'back') {
      // Backspace dentro do campo apaga texto; só Voltar do controle (461) fecha.
      if (this.focusIndex === -1 && event && event.keyCode === 8) return false;
      this.choose(cancelIndex);
      return true;
    }
    if (this.focusIndex === -1) {
      if (key === 'OK') { this.choose(0); return true; }
      if (key === 'down') { this.focus(0); return true; }
      return false; // deixa o campo receber letras, setas internas etc.
    }
    if (key === 'up') { this.focus(-1); return true; }
    if (key === 'left' && this.focusIndex > 0) { this.focus(this.focusIndex - 1); return true; }
    if (key === 'right' && this.focusIndex < this.buttons.length - 1) { this.focus(this.focusIndex + 1); return true; }
    if (key === 'OK') { this.choose(this.focusIndex); return true; }
    return true;
  };

  EP.KeyboardDialog = KeyboardDialog;
}(window.EP));
