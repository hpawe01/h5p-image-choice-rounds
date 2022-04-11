import './h5p-image-choice-rounds-screen.scss';
import Util from './../h5p-image-choice-rounds-util';

/** Class representing a screen */
export default class ImageChoiceRoundsScreen {
  /**
   * @constructor
   *
   * @param {object} params Parameter from editor.
   * @param {object} [callbacks] Callbacks.
   */
  constructor(params = {}, callbacks = {}, contentId) {
    this.params = Util.extend({}, params);

    // Sanitize callbacks
    this.callbacks = Util.extend({
      resize: () => {}
    }, callbacks);

    this.baseClassName = 'h5p-image-choice-rounds-screen';

    // Screen
    this.screen = document.createElement('div');
    this.screen.classList.add(`${this.baseClassName}`);
    if (this.params.id) {
      this.screen.classList.add(`${this.baseClassName}-${this.params.id}`);
    }

    // image (optional)
    if (this.params.screenImage && this.params.screenImage.params && this.params.screenImage.params.file) {
      const imageWrapper = document.createElement('div');
      imageWrapper.classList.add(`${this.baseClassName}-image-wrapper`);
      if (this.params.screenText) {
        imageWrapper.classList.add('small-margin-bottom');
      }

      H5P.newRunnable(params.screenImage, contentId, H5P.jQuery(imageWrapper), false);
      const image = imageWrapper.querySelector('img');
      image.classList.add(`${this.baseClassName}-image`);
      image.style.height = 'auto';
      image.style.width = 'auto';

      const bar = document.createElement('div');
      bar.classList.add(`${this.baseClassName}-image-bar`);
      imageWrapper.appendChild(bar);

      this.screen.appendChild(imageWrapper);
    }

    if (this.params.screenText) {
      const introduction = document.createElement('div');
      introduction.classList.add(`${this.baseClassName}-text`);
      introduction.innerHTML = this.params.screenText;
      this.screen.appendChild(introduction);
    }

    this.placeholder = document.createElement('div');
    this.placeholder.classList.add(`${this.baseClassName}-placeholder-container`);
    this.placeholder.classList.add(`${this.baseClassName}-display-none`);
    this.screen.appendChild(this.placeholder);

    this.hide();
  }

  /**
   * Return the DOM for this class.
   * @return {HTMLElement} DOM for this class.
   */
  getDOM() {
    return this.screen;
  }

  /**
   * Set placeholder.
   * @param {object} [params={}] Parameters.
   * @param {HTMLElement} [params.dom] DOM to set.
   * @param {string} [params.className] Class names to set.
   */
  setPlaceholder(params = {}) {
    if (params.dom) {
      this.placeholder.innerHTML = '';
      this.placeholder.appendChild(params.dom);
      this.placeholder.classList.remove(`${this.baseClassName}-display-none`);
    }

    if (params.className) {
      this.placeholder.className = '';
      this.placeholder.classList.add(`${this.baseClassName}-placeholder-container`);
      this.placeholder.classList.add(params.className);
    }

    this.callbacks.resize();
  }

  /**
   * Append to placeholder.
   * @param {HTMLElement} dom DOM element to append.
   */
  appendToPlaceholder(dom) {
    if (!dom) {
      return;
    }

    this.placeholder.appendChild(dom);
    this.placeholder.classList.remove(`${this.baseClassName}-display-none`);

    this.callbacks.resize();
  }

  /**
   * Hide placeholder.
   */
  hidePlaceholder() {
    this.placeholder.classList.add(`${this.baseClassName}-display-none`);
  }

  /**
   * Show title screen.
   * @param {boolean} [focusStartButton] If true, start button will get focus.
   */
  show(params = {}) {
    this.screen.classList.remove('h5p-image-choice-rounds-display-none');

    if (params.focusStartButton) {
      this.button.focus();
    }
  }

  /**
   * Hide title screen.
   */
  hide() {
    this.screen.classList.add('h5p-image-choice-rounds-display-none');
  }
}
