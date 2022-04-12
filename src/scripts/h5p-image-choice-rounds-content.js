import ImageChoiceRoundsButtonBar from './components/h5p-image-choice-rounds-button-bar';
import ImageChoiceRoundsScreenEnd from './components/h5p-image-choice-rounds-screen-end';
import Dictionary from './h5p-image-choice-rounds-dictionary';
import Util from './h5p-image-choice-rounds-util';

/** Class representing the content */
export default class ImageChoiceRoundsContent {
  /**
   * @constructor
   * @param {object} params Paremeters.
   * @param {object} callbacks Callbacks.
   * @param {function} callbacks.progress Signal progression to different page.
   * @param {function} callbacks.resize Signal need to resize.
   */
  constructor(params = {}, callbacks = {}) {
    this.params = Util.extend({
      pages: [],
      endscreen: {},
      currentPage: 0
    }, params);

    this.callbacks = Util.extend({
      progress: () => {},
      resize: () => {}
    }, callbacks);

    this.handleUpdatePagePositionsEnded = this.handleUpdatePagePositionsEnded.bind(this);

    this.pageDOMs = [];
    this.currentPageIndex = this.params.currentPage;

    this.endscreen = new ImageChoiceRoundsScreenEnd(
      {
        id: 'end',
        screenImage: this.params.endscreen.endScreenImage,
        screenText: this.params.endscreen.endScreenOutro,
      },
      {},
      this.params.contentId
    );
    this.params.pages.push({
      element: this.endscreen.getDOM(),
      progression: { left: false, right: false }
    });

    // Build content
    this.content = document.createElement('div');
    this.content.classList.add('h5p-image-choice-rounds-pages-container');

    const pages = document.createElement('div');
    pages.classList.add('h5p-image-choice-rounds-pages');

    // Build DOMs of pages
    for (let i in this.params.pages) {
      if (this.params.pages[i].instance) {
        this.params.pages[i].instance.on('xAPI', (event) => {
          if (event.getVerb() === 'answered') {
            this.params.pages[i].progression.right = true;
            if (parseInt(i) < this.params.pages.length - 1) {
              this.params.pages[parseInt(i) + 1].progression.left = true;
            }
            this.updateNavigationButtons();
            this.buttonBar.focus('right');
          }
        });
      }

      const page = document.createElement('div');
      page.classList.add('h5p-image-choice-rounds-page');
      page.appendChild(this.params.pages[i].element);

      this.pageDOMs.push(page);
    }

    // Build button bar for navigation
    this.buttonBar = new ImageChoiceRoundsButtonBar(
      {},
      {
        onClickButtonLeft: () => {
          this.swipeLeft();
        },
        onClickButtonRight: () => {
          this.swipeRight();
        }
      }
    );

    this.pageDOMs.forEach(page => {
      pages.appendChild(page);
    });
    this.content.appendChild(pages);

    this.updatePage();
    // No transition on first display, so trigger here
    this.handleUpdatePagePositionsEnded();

    this.content.appendChild(this.buttonBar.getDOM());

    this.isConstructed = true;
  }

  /**
   * Return the DOM for this class.
   * @return {HTMLElement} DOM for this class.
   */
  getDOM() {
    return this.content;
  }

  /**
   * Get current page index.
   * @return {number} Current page index.
   */
  getCurrentPageIndex() {
    return this.currentPageIndex;
  }

  /**
   * Update page.
   */
  updatePage(params = {}) {
    this.updatePagePositions({ from: params.from, to: params.to });
    this.updateRoundAnnouncer();
    this.updateNavigationButtons();
  }

  /**
   * Update page positions.
   */
  updatePagePositions(params = {}) {
    // Determine pageDOMs visible when sliding for having proper height
    let visiblePages = [this.currentPageIndex];
    if (typeof params.from === 'number' && typeof params.to === 'number') {
      if (params.from > params.to) {
        const tmp = params.from;
        params.from = params.to;
        params.to = tmp;
      }

      visiblePages = [...Array(params.to - params.from + 1).keys()]
        .map(x => x + params.from);
    }

    this.pageDOMs.forEach((page, index) => {
      page.classList.toggle('display-none', !visiblePages.includes(index));
    });

    this.callbacks.resize();

    // Timeout to let browser display pages in off before transitioning
    setTimeout(() => {
      this.pageDOMs.forEach((page, index) => {
        page.classList.remove('past');
        page.classList.remove('present');
        page.classList.remove('future');

        if (index < this.currentPageIndex) {
          page.classList.add('past');
        }
        else if (index > this.currentPageIndex) {
          page.classList.add('future');
          if (typeof params.from !== 'number' || typeof params.to !== 'number' || params.from !== params.to) {
            page.addEventListener('transitionend', this.handleUpdatePagePositionsEnded);
          }
        }
        else {
          page.classList.add('present');
        }
      });

      if (typeof params.from === 'number' && typeof params.to === 'number' && params.from === params.to) {
        this.handleUpdatePagePositionsEnded();
      }
    }, 0);
  }

  /**
   * Update round announcer.
   */
  updateRoundAnnouncer() {
    let text = '';
    if (this.params.pages[this.currentPageIndex].instance) {
      text = Dictionary.get('l10n.progressAnnouncer').replace('@current', this.currentPageIndex + 1);
    } // Otherwise end screen
    this.buttonBar.setRoundAnnouncerText(text);
  }

  /**
   * Update progression.
   */
  updateNavigationButtons() {
    // Always allow to go back
    if (this.currentPageIndex > 0) {
      this.params.pages[this.currentPageIndex].progression.left = true;
    }

    // First page
    if (this.currentPageIndex === 0) {
      this.buttonBar.cloakButton('left');
    }
    else {
      this.buttonBar.decloakButton('left');
    }

    // Last page
    if (this.currentPageIndex === this.pageDOMs.length - 1) {
      this.buttonBar.cloakButton('right');
    }
    else {
      this.buttonBar.decloakButton('right');
    }

    // Progression state
    if (this.params.pages[this.currentPageIndex].progression.left) {
      this.buttonBar.enableButton('left');
    }
    else {
      this.buttonBar.disableButton('left');
    }

    if (this.params.pages[this.currentPageIndex].progression.right) {
      this.buttonBar.enableButton('right');
    }
    else {
      this.buttonBar.disableButton('right');
    }

    if (
      this.currentPageIndex === this.pageDOMs.length - 2 && // Last exercise
      this.params.pages[this.currentPageIndex].progression.right
    ) {
      this.buttonBar.setButtonAttributes('right', {
        'aria-label': Dictionary.get('a11y.finish'),
        'title': Dictionary.get('a11y.finish')
      });
    }
  }

  /**
   * Swipe to page.
   * @param {number} page Page number to swipe to.
   */
  swipeTo(page = -1) {
    if (this.isSwiping || page < 0 || page > this.pageDOMs.length - 1) {
      return; // Swiping or out of bounds
    }

    this.isSwiping = true;

    const from = this.currentPageIndex;
    this.currentPageIndex = page;
    this.updatePage({ from: from, to: page });

    this.callbacks.progress();
  }

  /**
   * Swipe content left.
   */
  swipeLeft() {
    if (this.isSwiping || this.currentPageIndex <= 0) {
      return; // Swiping or already at outer left
    }

    this.swipeTo(this.currentPageIndex - 1);
  }

  /**
   * Swipe content right.
   */
  swipeRight() {
    if (this.isSwiping || this.currentPageIndex === this.pageDOMs.length - 1) {
      return; // Swiping or already at outer right
    }

    this.swipeTo(this.currentPageIndex + 1);
  }

  /**
   * Handle updating page positions ended.
   */
  handleUpdatePagePositionsEnded() {
    this.pageDOMs[this.currentPageIndex]
      .removeEventListener('transitionend', this.handleUpdatePagePositionsEnded);

    // Hid all but current pages
    this.pageDOMs.forEach((page, index) => {
      if (index !== this.currentPageIndex) {
        page.classList.add('display-none');
      }
    });

    // Set round start time when it gets visible
    const currentInstance = this.params.pages[this.currentPageIndex].instance;
    if (
      typeof currentInstance?.setActivityStarted === 'function' &&
      !currentInstance.activityStartTime
    ) {
      currentInstance.setActivityStarted();
    }

    this.isSwiping = false;

    // Focus on first item
    if (this.isConstructed) {
      const focusElement = this.pageDOMs[this.currentPageIndex]
        .querySelector('.h5p-question-content .h5p-multi-media-choice-list-item');

      if (focusElement) {
        focusElement.focus();
      }
    }

    this.callbacks.resize();
  }

  /**
   * Show results of MultiMediaChoice instance.
   */
  showResults() {
    for (let i in this.params.pages) {
      const page = this.params.pages[i];

      if (page.instance) {
        page.instance.showPreviousResult();
      }

      page.progression = { left: true, right: true };
    }
  }

  /**
   * Show solutions.
   */
  showSolutions() {
    for (let i in this.params.pages) {
      const page = this.params.pages[i];

      if (page.instance) {
        page.instance.showSolutions();
      }

      page.progression = { left: true, right: true };
    }
  }

  /**
   * Reset task.
   */
  resetTask() {
    for (let i in this.params.pages) {
      const page = this.params.pages[i];

      if (page.instance) {
        delete page.instance.activityStartTime;
        page.instance.resetTask();
      }

      page.progression = { left: false, right: false };
    }

    this.swipeTo(0);
  }

  /**
   * Get xAPI Data for reporting.
   * @return {object[]} xAPIData.
   */
  getXAPIData() {
    return this.params.pages
      .map(bundle => {
        if (typeof bundle?.instance?.getXAPIData !== 'function') {
          return;
        }
        return bundle.instance.getXAPIData();
      })
      .filter(data => !!data);
  }
}
