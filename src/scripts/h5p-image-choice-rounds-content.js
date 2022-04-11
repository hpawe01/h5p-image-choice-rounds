import ImageChoiceRoundsButtonBar from './components/h5p-image-choice-rounds-button-bar';
import ImageChoiceRoundsScreenEnd from './components/h5p-image-choice-rounds-screen-end';
import Util from './h5p-image-choice-rounds-util';

/** Class representing the content */
export default class ImageChoiceRoundsContent {
  /**
   * @constructor
   */
  constructor(params = {}, callbacks = {}) {
    this.params = Util.extend({
      bundles: [],
      endscreen: {},
      currentPage: 0,
      l10n: {
        round: 'Round'
      }
    }, params);

    this.callbacks = Util.extend({
      progress: () => {},
      resize: () => {}
    }, callbacks);

    this.handleUpdatePagePositionsEnded = this.handleUpdatePagePositionsEnded.bind(this);

    this.pages = [];
    this.currentPageIndex = this.params.currentPage;

    this.endscreen = new ImageChoiceRoundsScreenEnd(
      {
        id: 'end',
        screenImage: this.params.endscreen.endScreenImage,
        screenText: this.params.endscreen.endScreenOutro,
        l10n: {} // TODO: l10n
      },
      {}, // TODO: callbacks
      this.params.contentId
    );
    this.params.bundles.push({
      element: this.endscreen.getDOM()
    });

    // Build content
    this.content = document.createElement('div');
    this.content.classList.add('h5p-image-choice-rounds-pages-container');

    const pages = document.createElement('div');
    pages.classList.add('h5p-image-choice-rounds-pages');

    for (let i in this.params.bundles) {
      // Initialize possible progression TODO: previous State
      this.params.bundles[i].progression = { left: false, right: false };

      if (this.params.bundles[i].instance) {
        this.params.bundles[i].instance.on('xAPI', (event) => {
          if (event.getVerb() === 'answered') {
            this.params.bundles[i].progression.right = true;
            if (i < this.params.bundles.length - 1) {
              this.params.bundles[parseInt(i) + 1].progression.left = true;
            }
            this.updateNavigationButtons();
          }
        });
      }

      const page = document.createElement('div');
      page.classList.add('h5p-image-choice-rounds-page');
      page.appendChild(this.params.bundles[i].element);

      this.pages.push(page);
    }

    this.buttonBar = new ImageChoiceRoundsButtonBar(
      {
        a11y: {
          previousRound: 'Previous round',
          previousRoundDisabled: 'Previous round not available',
          nextRound: 'Next round',
          nextRoundDisabled: 'Next round not available'
        }
      },
      {
        onClickButtonLeft: () => {
          this.swipeLeft();
        },
        onClickButtonRight: () => {
          this.swipeRight();
        }
      }
    );

    this.pages.forEach(page => {
      pages.appendChild(page);
    });
    this.content.appendChild(pages);

    this.updatePage();
    // No transition on first display
    this.handleUpdatePagePositionsEnded();

    this.content.appendChild(this.buttonBar.getDOM());
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
    let visiblePages = [this.currentPageIndex];
    if (typeof params.from === 'number' && typeof params.to === 'number') {
      if (params.from > params.to) {
        const tmp = params.from;
        params.from = params.to;
        params.to = tmp;
      }

      visiblePages = [...Array(params.to - params.from + 1).keys()].map(x => x + params.from);
    }

    this.pages.forEach((page, index) => {
      page.classList.toggle('display-none', visiblePages.indexOf(index) === -1);
    });

    this.callbacks.resize();

    // Timeout to let browser display pages in off before transitioning
    setTimeout(() => {
      this.pages.forEach((page, index) => {
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
    if (this.params.bundles[this.currentPageIndex].instance) {
      text = `${this.params.l10n.round} ${this.currentPageIndex + 1}`;
    } // Otherwise end screen
    this.buttonBar.setRoundAnnouncerText(text);
  }

  /**
   * Update progression.
   */
  updateNavigationButtons() {
    // Always allow to go back
    if (this.currentPageIndex > 0) {
      this.params.bundles[this.currentPageIndex].progression.left = true;
    }

    if (this.currentPageIndex === 0) {
      this.buttonBar.cloakButton('left');
    }
    else {
      this.buttonBar.uncloakButton('left');
    }

    if (this.params.bundles[this.currentPageIndex].progression.left) {
      this.buttonBar.enableButton('left');
    }
    else {
      this.buttonBar.disableButton('left');
    }

    if (this.currentPageIndex === this.pages.length - 1) {
      this.buttonBar.cloakButton('right');
    }
    else {
      this.buttonBar.uncloakButton('right');
    }

    if (this.params.bundles[this.currentPageIndex].progression.right) {
      this.buttonBar.enableButton('right');
    }
    else {
      this.buttonBar.disableButton('right');
    }
  }


  /**
   * Swipe to page.
   * @param {number} page Page number to swipe to.
   */
  swipeTo(page = -1) {
    if (this.isSwiping || page < 0 || page > this.pages.length - 1) {
      return; // Swiping or out of bounds
    }

    this.isSwiping = true;

    const from = this.currentPageIndex;
    this.currentPageIndex = page;

    this.updatePage({ from: from, to: page});

    this.callbacks.progress(this.currentPageIndex);
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
    if (this.isSwiping || this.currentPageIndex === this.pages.length - 1) {
      return; // Swiping or already at outer right
    }

    this.swipeTo(this.currentPageIndex + 1);
  }

  /**
   * Handle updating page positions ended.
   */
  handleUpdatePagePositionsEnded() {
    this.pages[this.currentPageIndex].removeEventListener('transitionend', this.handleUpdatePagePositionsEnded);
    this.pages.forEach((page, index) => {
      if (index !== this.currentPageIndex) {
        page.classList.add('display-none');
      }
    });

    const currentInstance = this.params.bundles[this.currentPageIndex].instance;
    if (
      typeof currentInstance?.setActivityStarted === 'function' &&
      !currentInstance.activityStartTime
    ) {
      currentInstance.setActivityStarted();
    }

    this.isSwiping = false;

    this.callbacks.resize();
  }

  /**
   * Show results of MultiMediaChoice instance.
   * @param {H5P.MultiMediaChoice} instance MultiMediaChoice instance.
   */
  showResults() {
    for (let i in this.params.bundles) {
      if (this.params.bundles[i].instance) {
        const instance = this.params.bundles[i].instance;

        instance.content.disableSelectables();
        const score = instance.getScore();
        const maxScore = instance.getMaxScore();
        const textScore = H5P.Question.determineOverallFeedback(
          instance.params.overallFeedback,
          score / maxScore
        );
        instance.setFeedback(textScore, score, maxScore, instance.params.l10n.result);
        instance.hideButton('check-answer');
        instance.content.showSelectedSolutions();
      }

      this.params.bundles[i].progression = { left: true, right: true };
    }
  }

  /**
   * Show solutions.
   */
  showSolutions() {
    for (let i in this.params.bundles) {
      if (this.params.bundles[i].instance) {
        this.params.bundles[i].instance.showSolutions();
      }

      this.params.bundles[i].progression = { left: true, right: true };
    }

    this.swipeTo(0);
  }

  /**
   * Reset task.
   */
  resetTask() {
    for (let i in this.params.bundles) {
      if (this.params.bundles[i].instance) {
        delete this.params.bundles[i].instance.activityStartTime;
        this.params.bundles[i]?.instance.resetTask();
      }

      this.params.bundles[i].progression = { left: false, right: false };
    }

    this.swipeTo(0);
  }

  /**
   * Get xAPI Data for reporting.
   * @return {object[]} xAPIData.
   */
  getXAPIData() {
    return this.params.bundles
      .map(bundle => {
        if (typeof bundle?.instance?.getXAPIData !== 'function') {
          return;
        }
        return bundle.instance.getXAPIData();
      })
      .filter(data => !!data);
  }
}
