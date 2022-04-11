import './h5p-image-choice-rounds-button-bar.scss';
import ImageChoiceRoundsButton from './h5p-image-choice-rounds-button';
import Dictionary from './../h5p-image-choice-rounds-dictionary';
import Util from './../h5p-image-choice-rounds-util';

/** Class representing the button bar */
export default class ImageChoiceRoundsButtonBar {
  /**
   * @constructor
   */
  constructor(params = {}, callbacks = {}) {
    this.params = Util.extend({}, params);

    this.callbacks = Util.extend({
      onClickButtonLeft: () => {},
      onClickButtonRight: () => {}
    }, callbacks);

    this.buttons = {};

    this.buttonBar = document.createElement('div');
    this.buttonBar.classList.add('h5p-image-choice-rounds-button-bar');

    this.buttons.left = new ImageChoiceRoundsButton(
      {
        a11y: {
          active: Dictionary.get('a11y.previousRound'),
          disabled: Dictionary.get('a11y.previousRoundDisabled'),
        },
        classes: [
          'h5p-image-choice-rounds-button',
          'h5p-image-choice-rounds-button-left'
        ],
        disabled: true,
        type: 'pulse'
      },
      {
        onClick: () => {
          this.callbacks.onClickButtonLeft();
        }
      }
    );

    this.buttons.right = new ImageChoiceRoundsButton(
      {
        a11y: {
          active: Dictionary.get('a11y.nextRound'),
          disabled: Dictionary.get('a11y.nextRoundDisabled'),
        },
        classes: [
          'h5p-image-choice-rounds-button',
          'h5p-image-choice-rounds-button-right'
        ],
        disabled: true,
        type: 'pulse'
      },
      {
        onClick: () => {
          this.callbacks.onClickButtonRight();
        }
      }
    );

    this.roundAnnouncer = document.createElement('div');
    this.roundAnnouncer.classList.add('h5p-image-choice-rounds-round-announcer');

    this.buttonBar.appendChild(this.buttons.left.getDOM());
    this.buttonBar.appendChild(this.roundAnnouncer);
    this.buttonBar.appendChild(this.buttons.right.getDOM());
  }

  /**
   * Return the DOM for this class.
   * @return {HTMLElement} DOM for this class.
   */
  getDOM() {
    return this.buttonBar;
  }

  /**
   * Set round announcer text.
   * @param {string} html Round announcer text.
   */
  setRoundAnnouncerText(html) {
    this.roundAnnouncer.innerHTML = html;
  }

  /**
   * Set button attributes.
   * @param {string} id Button id.
   * @param {object} attributes HTML attributes to set.
   */
  setButtonAttributes(id = '', attributes = {}) {
    if (!this.buttons[id]) {
      return; // Button not available
    }

    for (let attribute in attributes) {
      this.buttons[id].setAttribute(attribute, attributes[attribute]);
    }
  }

  /**
   * Enable button.
   * @param {string} id Button id.
   */
  enableButton(id = '') {
    if (!this.buttons[id]) {
      return; // Button not available
    }

    this.buttons[id].enable();
  }

  /**
   * Disable button.
   * @param {string} id Button id.
   */
  disableButton(id = '') {
    if (!this.buttons[id]) {
      return; // Button not available
    }

    this.buttons[id].disable();
  }

  /**
   * Show button.
   * @param {string} id Button id.
   */
  showButton(id = '') {
    if (!this.buttons[id]) {
      return; // Button not available
    }

    this.buttons[id].show();
  }

  /**
   * Hide button.
   * @param {string} id Button id.
   */
  hideButton(id = '') {
    if (!this.buttons[id]) {
      return; // Button not available
    }

    this.buttons[id].hide();
  }

  /**
   * Uncloak button.
   * @param {string} id Button id.
   */
  uncloakButton(id = '') {
    if (!this.buttons[id]) {
      return; // Button not available
    }

    this.buttons[id].uncloak();
  }

  /**
   Cloak button.
   * @param {string} id Button id.
   */
  cloakButton(id = '') {
    if (!this.buttons[id]) {
      return; // Button not available
    }

    this.buttons[id].cloak();
  }

  /**
   * Focus a button.
   * @param {string} id Button id.
   */
  focus(id = '') {
    if (!this.buttons[id] || this.buttons[id].isCloaked()) {
      return; // Button not available
    }

    this.buttons[id].focus();
  }
}
