// Import required classes
import ImageChoiceRoundsContent from './h5p-image-choice-rounds-content';
import ImageChoiceRoundsPool from './h5p-image-choice-rounds-pool';
import Dictionary from './h5p-image-choice-rounds-dictionary';
import Util from './h5p-image-choice-rounds-util';

/**
 * Class holding the content type.
 */
export default class ImageChoiceRounds extends H5P.Question {
  /**
   * @constructor
   * @param {object} params Parameters passed by the editor.
   * @param {number} contentId Content's id.
   * @param {object} [extras = {}] Saved state, metadata, etc.
   */
  constructor(params, contentId, extras = {}) {
    super('image-choice-rounds'); // CSS class selector for content's iframe

    this.contentId = contentId;
    this.extras = extras;

    /*
     * this.params.behaviour.enableSolutionsButton and this.params.behaviour.enableRetry
     * are used by H5P's question type contract.
     * @see {@link https://h5p.org/documentation/developers/contracts#guides-header-8}
     * @see {@link https://h5p.org/documentation/developers/contracts#guides-header-9}
     */
    this.params = Util.extend({
      roundOptions: {
        numberRounds: 1,
        numberImages: Infinity,
        modeSampling: 'withReplacement',
        negativeIsAllowed: false
      },
      behaviour: {
        modeFeedback: 'totalScore',
        enableRetry: true,
        enableSolutionsButton: true
      },
      l10n: {
        checkAnswer: 'Check',
        submitAnswer: 'Submit',
        tryAgain: 'Retry',
        showSolution: 'Show solution',
        progressAnnouncer: 'Round @current',
        noImages: 'No images were set.'
      },
      a11y: {
        check: 'Check the answers. The responses will be marked as correct, incorrect, or unanswered.',
        showSolution: 'Show the solution. The task will be marked with its correct solution.',
        retry: 'Retry the task. Reset all responses and start the task over again.',
        finish: 'Finish',
        results: 'Results',
        yourResult: 'You got @score out of @total points',
        previousRound: 'Previous round',
        previousRoundDisabled: 'Previous round not available',
        nextRound: 'Next round',
        nextRoundDisabled: 'Next round not available'
      }
    }, params);

    // Fill dictionary
    Dictionary.fill({
      l10n: this.params.l10n,
      a11y: this.params.a11y
    });

    // this.previousState now holds the saved content state of the previous session
    this.previousState = this.extras.previousState || {};

    // View state to track if user is solving the task or watching results or solutions
    this.setViewState(this.previousState.viewState || 'task');

    // Check whether the author didn't add any images
    if (!this.params.instanceParams?.params?.options?.length) {
      console.warn('There are no images set for Image Choice');
      return;
    }

    // Sanitize number of (correct) images to show per round
    const numberImages = Math.min(
      this.params.roundOptions.numberImages,
      this.params.instanceParams.params.options.length
    );
    const numberImagesCorrect = Math.min(
      this.params.roundOptions.numberImagesCorrect || 0, // 0 means random
      this.params.instanceParams.params.options
        .reduce((total, option) => total + (option.correct ? 1 : 0), 0),
      numberImages
    );

    // Generate pool of pages
    this.pool = new ImageChoiceRoundsPool({
      contentId: this.contentId,
      instanceParams: this.params.instanceParams,
      modeSampling: this.params.roundOptions.modeSampling,
      numberRounds: this.params.roundOptions.numberRounds,
      numberImages: numberImages,
      numberImagesCorrect: numberImagesCorrect,
      negativeIsAllowed: this.params.roundOptions.negativeIsAllowed,
      enableSolutionsButton: this.params.roundOptions.enableSolutionsButton,
      confirmCheckDialog: this.params.roundOptions.confirmCheckDialog,
      singlePoint: this.params.roundOptions.singlePoint,
      previousState: this.previousState?.children
    }, this);

    // Reattach H5P.Question buttons and scorebar to endscreen
    H5P.externalDispatcher.on('initialized', () => {
      const feedback = document.querySelector('.h5p-container > .h5p-question-feedback');
      if (feedback) {
        this.content.endscreen.appendToPlaceholder(feedback.parentNode.removeChild(feedback));
      }

      const scorebar = document.querySelector('.h5p-container > .h5p-question-scorebar');
      if (feedback) {
        this.content.endscreen.appendToPlaceholder(scorebar.parentNode.removeChild(scorebar));
      }

      const buttons = document.querySelector('.h5p-container > .h5p-question-buttons');
      if (buttons) {
        this.content.endscreen.appendToPlaceholder(buttons.parentNode.removeChild(buttons));
      }
    });
  }

  /**
   * Register the DOM elements with H5P.Question
   */
  registerDomElements() {
    if (!this.pool) {
      // Display erroe message only
      const content = document.createElement('div');
      content.classList.add('h5p-image-choice-rounds-message');
      content.innerText = Dictionary.get('l10n.noImages');

      this.setContent(content);

      return;
    }

    // Create content
    this.content = new ImageChoiceRoundsContent(
      {
        pages: this.pool.getPages(),
        endscreen: this.params.endscreen,
        currentPage: this.previousState?.currentPage || 0,
        contentId: this.contentId
      },
      {
        progress: () => {
          this.handleProgress();
        },
        resize: () => {
          this.trigger('resize');
        }
      }
    );

    this.updateEndscreen();

    // Re-create the previous view state
    if (this.previousState.viewState === 'results') {
      this.content.showResults();
      this.content.updatePage();
    }
    else if (this.previousState.viewState === 'solutions') {
      const currentPage = this.content.getCurrentPageIndex();
      this.content.showResults();
      this.showSolutions();
      this.content.swipeTo(currentPage);
    }

    // Register content with H5P.Question
    this.setContent(this.content.getDOM());

    // Register Buttons
    this.addButtons();
  }

  /**
   * Add all the buttons that shall be passed to H5P.Question.
   */
  addButtons() {
    const isShowingEndScreen = this.content.getCurrentPageIndex() >= Object.keys(this.pool.getPages()).length;

    // Show solution button
    this.addButton(
      'show-solution',
      Dictionary.get('l10n.showSolution'),
      () => {
        this.showSolutions();
        this.content.swipeTo(0);
      },
      isShowingEndScreen && this.params.behaviour.enableSolutionsButton && this.viewState !== 'solutions',
      { 'aria-label': this.params.a11y.showSolution},
      {}
    );

    // Retry button
    this.addButton(
      'try-again',
      Dictionary.get('l10n.tryAgain'),
      () => {
        this.resetTask();
      },
      isShowingEndScreen && this.params.behaviour.enableRetry,
      {
        'aria-label': this.params.a11y.retry
      },
      {}
    );
  }

  /**
   * Handle progress from page to page.
   */
  handleProgress() {
    const currentIndex = this.content.getCurrentPageIndex();

    // Trigger xAPI `progressed`
    const progressedEvent = this.createXAPIEventTemplate('progressed');
    progressedEvent.data.statement.object.definition.extensions['http://id.tincanapi.com/extension/ending-point'] = currentIndex + 1;
    this.trigger(progressedEvent);

    if (currentIndex < Object.keys(this.pool.getPages()).length) { // Normal page
      this.read(Dictionary.get('l10n.progressAnnouncer').replace('@current', currentIndex + 1));
    }
    else { // Endscreen
      // xAPI completed should only be triggered the first time visiting the results
      if (this.viewState === 'task') {
        this.setViewState('results');
        this.trigger(this.getXAPICompletedEvent());
      }

      this.read(Dictionary.get('a11y.results'));

      // Endscreen is showing already
      this.updateEndscreen();

      this.content.showResults();

      if (this.params.behaviour.enableSolutionsButton && this.viewState !== 'solutions') {
        this.showButton('show-solution');
      }

      if (this.params.behaviour.enableRetry) {
        this.showButton('try-again');
      }

      setTimeout(() => {
        this.focusButton();
      }, 0); // H5P.Question must display button first
    }
  }

  /**
   * Update endscreen.
   */
  updateEndscreen() {
    const score = this.getScore();
    const maxScore = this.getMaxScore();

    const textScore = H5P.Question.determineOverallFeedback(
      this.params.endscreen.overallFeedback,
      score / maxScore
    );

    const ariaScore = this.params.a11y.yourResult
      .replace('@score', ':num')
      .replace('@total', ':total');

    this.setFeedback(textScore, score, maxScore, ariaScore);
  }

  /**
   * Check if result has been submitted or input has been given.
   * @return {boolean} True, if answer was given.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-1}
   */
  getAnswerGiven() {
    if (!this.pool) {
      return false;
    }

    const pages = this.pool.getPages();
    let answerGiven = false;
    for (let i in pages) {
      if (
        typeof pages[i]?.instance.getAnswerGiven === 'function' &&
        pages[i]?.instance.getAnswerGiven()
      ) {
        answerGiven = true;
        break;
      }
    }

    return answerGiven;
  }

  /**
   * Get latest score for total score mode.
   * @return {number} Latest score.
   */
  getScoreTotalScore() {
    let score = 0;
    const pages = this.pool.getPages();

    for (let i in pages) {
      score += (typeof pages[i]?.instance?.getScore === 'function') ?
        pages[i].instance.getScore() :
        0;
    }

    return Math.max(0, score);
  }

  /**
   * Get latest score for one point mode.
   * @return {number} latest score.
   */
  getScoreOnePoint() {
    let score = 1;
    const pages = this.pool.getPages();

    for (let i in pages) {
      if (
        typeof pages[i]?.instance.getScore !== 'function' ||
        typeof pages[i]?.instance.getMaxScore !== 'function'
      ) {
        continue;
      }

      if (pages[i].instance.getScore() !== pages[i].instance.getMaxScore()) {
        score = 0;
        break;
      }
    }

    return score;
  }

  /**
   * Get latest score for one point mode.
   * @return {number} latest score.
   */
  getScoreCustom() {
    let score = 0;

    const rawScore = this.getScoreTotalScore();
    const rawMaxScore = this.getMaxScoreTotalScore();

    // Same algorithm as H5P.Question for determineOverallFeedback function
    const scoreRatio = Math.floor(rawScore / rawMaxScore * 100);

    for (let i in this.params.behaviour.customScoring) {
      const customScore = this.params.behaviour.customScoring[i];

      if (
        typeof customScore?.score === 'number' &&
        customScore.score >= 0 &&
        customScore.from <= scoreRatio &&
        customScore.to >= scoreRatio
      ) {
        score = customScore.score;
        break;
      }
    }

    return score;
  }

  /**
   * Get latest score.
   * @return {number} latest score.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-2}
   */
  getScore() {
    if (!this.pool) {
      return 0;
    }

    let score = 0;

    if (this.params.behaviour.modeFeedback === 'totalScore') {
      score = this.getScoreTotalScore();
    }
    else if (this.params.behaviour.modeFeedback === 'onePoint') {
      score = this.getScoreOnePoint();
    }
    else if (this.params.behaviour.modeFeedback === 'custom') {
      score = this.getScoreCustom();
    }

    return score;
  }

  /**
   * Get maximum possible score for total score mode.
   * @return {number} Score necessary for mastering.
   */
  getMaxScoreTotalScore() {
    let maxScore = 0;

    const pages = this.pool.getPages();
    for (let i in pages) {
      maxScore +=
        typeof pages[i]?.instance.getMaxScore === 'function' ?
          pages[i]?.instance.getMaxScore() :
          0;
    }

    return maxScore;
  }

  /**
   * Get maximum possible score for one point mode.
   * @return {number} Score necessary for mastering.
   */
  getMaxScoreOnePoint() {
    return 1;
  }

  /**
   * Get maximum possible score for custom score mode.
   * @return {number} Score necessary for mastering.
   */
  getMaxScoreCustom() {
    return (this.params.behaviour.customScoring || []).reduce((max, entry) => {
      return Math.max(max, entry.score);
    }, 0);
  }

  /**
   * Get maximum possible score.
   * @return {number} Score necessary for mastering.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-3}
   */
  getMaxScore() {
    if (!this.pool) {
      return 0;
    }

    let maxScore = 0;

    if (this.params.behaviour.modeFeedback === 'totalScore') {
      maxScore = this.getMaxScoreTotalScore();
    }
    else if (this.params.behaviour.modeFeedback === 'onePoint') {
      maxScore = this.getMaxScoreOnePoint();
    }
    else if (this.params.behaviour.modeFeedback === 'custom') {
      maxScore = this.getMaxScoreCustom();
    }

    return maxScore;
  }

  /**
   * Show solutions.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-4}
   */
  showSolutions() {
    if (!this.pool) {
      return;
    }

    this.setViewState('solutions');

    this.content.showSolutions();

    this.hideButton('show-solution');

    this.trigger('resize');
  }

  /**
   * Reset task.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-5}
   */
  resetTask() {
    if (!this.pool) {
      return;
    }

    this.setViewState('task');
    this.content.resetTask();

    this.removeFeedback();
    this.hideButton('show-solution');
    this.hideButton('try-again');

    this.trigger('resize');
  }

  /**
   * Get xAPI data.
   * @return {object} XAPI statement.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-6}
   */
  getXAPIData() {
    const xAPIEvent = this.getXAPICompletedEvent();

    // H5P reporting expects 'answered' and 'compound'
    xAPIEvent.setVerb('answered');
    xAPIEvent.data.statement.object.definition.interactionType = 'compound';

    return {
      statement: xAPIEvent.data.statement,
      children: this.pool ? this.content.getXAPIData() : []
    };
  }

  /**
   * Build xAPI answer event.
   * @return {H5P.XAPIEvent} XAPI answer event.
   */
  getXAPICompletedEvent() {
    const xAPIEvent = this.createXAPIEvent('completed');

    xAPIEvent.setScoredResult(this.getScore(), this.getMaxScore(), this,
      true, this.isPassed());

    return xAPIEvent;
  }

  /**
   * Create an xAPI event for Dictation.
   * @param {string} verb Short id of the verb we want to trigger.
   * @return {H5P.XAPIEvent} Event template.
   */
  createXAPIEvent(verb) {
    const xAPIEvent = this.createXAPIEventTemplate(verb);

    const definition = Util.extend(
      xAPIEvent.getVerifiedStatementValue(['object', 'definition']),
      this.getxAPIDefinition()
    );

    xAPIEvent.data.statement.object.definition = definition;

    return xAPIEvent;
  }

  /**
   * Get the xAPI definition for the xAPI object.
   *
   * @return {object} XAPI definition.
   */
  getxAPIDefinition() {
    const definition = {};
    definition.name = {'en-US': this.getTitle()};
    definition.description = {'en-US': this.getDescription()};
    definition.type = 'http://adlnet.gov/expapi/activities/cmi.interaction';
    definition.interactionType = 'other';

    return definition;
  }

  /**
   * Determine whether the task has been passed by the user.
   * @return {boolean} True if user passed or task is not scored.
   */
  isPassed() {
    return this.getScore() >= this.getMaxScore();
  }

  /**
   * Get tasks title.
   * @return {string} Title.
   */
  getTitle() {
    let raw;
    if (this.extras.metadata) {
      raw = this.extras.metadata.title;
    }
    raw = raw || ImageChoiceRounds.DEFAULT_DESCRIPTION;

    // H5P Core function: createTitle
    return H5P.createTitle(raw);
  }

  /**
   * Get tasks description.
   * @return {string} Description.
   */
  getDescription() {
    return this.params.taskDescription || ImageChoiceRounds.DEFAULT_DESCRIPTION;
  }

  /**
   * Set view state.
   * @param {string} state View state.
   */
  setViewState(state) {
    if (!ImageChoiceRounds.VIEW_STATES.includes(state)) {
      return;
    }

    this.viewState = state;
  }

  /**
   * Get context data.
   * Contract used for confusion report.
   * @return {object} Context data.
   */
  getContext() {
    if (!this.pool) {
      return;
    }

    return {
      type: 'page',
      value: this.content.getCurrentPageIndex() + 1
    };
  }

  /**
   * Answer call to return the current state.
   * @return {object} Current state.
   */
  getCurrentState() {
    if (!this.pool) {
      return;
    }

    return {
      children: this.pool.getCurrentState(),
      currentPage: this.content.getCurrentPageIndex(),
      viewState: this.viewState
    };
  }

  /**
   * Get global view state.
   * @return {string} Global view state ('task'|'results'|'solutions').
   */
  getViewState() {
    return this.viewState;
  }
}

/** @constant {string} */
ImageChoiceRounds.DEFAULT_DESCRIPTION = 'Image Choice Rounds';

/** @constant {string[]} view state names*/
ImageChoiceRounds.VIEW_STATES = ['task', 'results', 'solutions'];
