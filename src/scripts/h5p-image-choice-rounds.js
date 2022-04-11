// Import required classes
import ImageChoiceRoundsContent from './h5p-image-choice-rounds-content';
import ImageChoiceRoundsPool from './h5p-image-choice-rounds-pool';
import Util from './h5p-image-choice-rounds-util';

/**
 * Class holding the content type.
 */
export default class ImageChoiceRounds extends H5P.Question {
  /**
   * @constructor
   *
   * @param {object} params Parameters passed by the editor.
   * @param {number} contentId Content's id.
   * @param {object} [extras] Saved state, metadata, etc.
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
        progressAnnouncer: 'Round @current'
      },
      a11y: {
        check: 'Check the answers. The responses will be marked as correct, incorrect, or unanswered.',
        showSolution: 'Show the solution. The task will be marked with its correct solution.',
        retry: 'Retry the task. Reset all responses and start the task over again.',
        finish: 'Finish',
        results: 'Results',
        yourResult: 'You got @score out of @total points'
      }
    }, params);

    // this.previousState now holds the saved content state of the previous session
    this.previousState = this.extras.previousState || {};

    this.viewState = this.previousState.viewState || 'task';

    if (!this.params.instanceParams?.params?.options?.length) {
      console.warn('TODO');
    }

    const numberImages = Math.min(
      this.params.roundOptions.numberImages,
      this.params.instanceParams.params.options.length
    );

    let numberImagesCorrect = Math.min(
      this.params.roundOptions.numberImagesCorrect || 0,
      this.params.instanceParams.params.options
        .reduce((total, option) => total + (option.correct ? 1 : 0), 0)
    );
    numberImagesCorrect = Math.min(numberImagesCorrect, numberImages);

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

    // Reattach H5P.Question buttons to endscreen
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
    this.content = new ImageChoiceRoundsContent(
      {
        bundles: this.pool.getInstanceBundles(),
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
    const isShowingEndScreen = this.content.getCurrentPageIndex() >= Object.keys(this.pool.instanceBundles).length;

    // Show solution button
    this.addButton('show-solution', this.params.l10n.showSolution, () => {
      this.showSolutions();
    }, isShowingEndScreen && this.params.behaviour.enableSolutionsButton && this.viewState !== 'solutions', {
      'aria-label': this.params.a11y.showSolution
    }, {});

    // Retry button
    this.addButton('try-again', this.params.l10n.tryAgain, () => {
      this.hideButton('show-solution');
      this.hideButton('try-again');

      this.resetTask();

      this.trigger('resize');
    }, isShowingEndScreen && this.params.behaviour.enableRetry, {
      'aria-label': this.params.a11y.retry
    }, {});
  }

  /**
   * Handle progress.
   */
  handleProgress() {
    const currentIndex = this.content.getCurrentPageIndex();

    const progressedEvent = this.createXAPIEventTemplate('progressed');
    progressedEvent.data.statement.object.definition.extensions['http://id.tincanapi.com/extension/ending-point'] = currentIndex + 1;
    this.trigger(progressedEvent);

    if (currentIndex >= Object.keys(this.pool.instanceBundles).length) {

      if (this.viewState === 'task') {
        this.setViewState('results');
        this.trigger(this.getXAPICompletedEvent());
      }

      this.read(this.params.a11y.results);

      // Endscreen is showing
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
    else {
      this.read(this.params.l10n.progressAnnouncer.replace('@current', currentIndex + 1));
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
    const bundles = this.pool.getInstanceBundles();
    let answerGiven = false;
    for (let i in bundles) {
      if (bundles[i]?.instance.getAnswerGiven()) {
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
    const bundles = this.pool.getInstanceBundles();

    for (let i in bundles) {
      score += bundles[i].instance.getScore();
    }

    return Math.max(0, score);
  }

  /**
   * Get latest score for one point mode.
   * @return {number} latest score.
   */
  getScoreOnePoint() {
    let score = 1;
    const bundles = this.pool.getInstanceBundles();

    for (let i in bundles) {
      if (bundles[i].instance.getScore() !== bundles[i].instance.getMaxScore()) {
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
   *
   * @return {number} latest score.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-2}
   */
  getScore() {
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

    const bundles = this.pool.getInstanceBundles();
    for (let i in bundles) {
      maxScore += bundles[i]?.instance.getMaxScore();
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
      children: this.content.getXAPIData()
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

    // TODO: Set IRI as required for your verb, cmp. http://xapi.vocab.pub/verbs/#
    definition.type = 'http://adlnet.gov/expapi/activities/cmi.interaction';

    // TODO: Set as required, cmp. https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md#interaction-types
    definition.interactionType = 'other';

    /*
     * TODO: Add other object properties as required, e.g. definition.correctResponsesPattern
     * cmp. https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md#244-object
     */

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
    return {
      children: this.pool.getCurrentState(),
      currentPage: this.content.getCurrentPageIndex(),
      viewState: this.viewState
    };
  }
}

/** @constant {string} */
ImageChoiceRounds.DEFAULT_DESCRIPTION = 'Image Choice Rounds';

/** @constant {string[]} view state names*/
ImageChoiceRounds.VIEW_STATES = ['task', 'results', 'solutions'];
