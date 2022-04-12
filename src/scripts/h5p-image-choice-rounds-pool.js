import Util from './h5p-image-choice-rounds-util';

/** Class representing the content */
export default class ImageChoiceRoundsPool {

  /**
   * @constructor
   * @param {object} params Parameters.
   * @param {object} callbacks Callbacks.
   * @param {function} callbacks.getViewState Get global view state.
   */
  constructor(params = {}, parent) {
    this.params = params;
    this.parent = parent;

    // Override content's default parameters
    const behaviour = this.params.instanceParams.params.behaviour;
    behaviour.enableSolutionsButton = this.params.enableSolutionsButton;
    behaviour.confirmCheckDialog = this.params.confirmCheckDialog;
    behaviour.singlePoint = this.params.singlePoint;
    behaviour.enableRetry = false;
    behaviour.showSolutionsRequiresInput = false;

    // Set up pool of options, may get depleted over time
    this.pool = this.params.instanceParams.params.options || [];

    this.discarded = [];

    // Instantiate instances for rounds
    this.pages = [];
    for (let round = 0; round < this.params.numberRounds; round++) {
      this.pages[round] = this.buildPage(round, {
        total: this.params.numberImages,
        correct: this.params.numberImagesCorrect,
        previousState: this.params.previousState ? this.params.previousState[round] : {}
      }, parent);
    }

    // Filter out incomplete pages
    this.pages = this.pages.filter(page => !!page);
  }

  /**
   * Get random options from pool.
   * @param {boolean} [correct=false] Preferred image correctness, random if not set.
   * @return {object} Random options.
   */
  getRandomOptions(correct) {
    if (!this.pool.length) {
      return null;
    }

    // Try to get images of preferred correctness
    const candidates = (typeof correct === 'boolean') ?
      this.pool.filter(image => image.correct === correct) :
      this.pool;

    if (!candidates.length) {
      return null;
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * Restock pool with discarded piles.
   */
  restock() {
    this.pool = [...this.pool, ...this.discarded];
    this.discarded = [];
  }

  /**
   * Get pages.
   * @return {object} Pages.
   */
  getPages() {
    return this.pages;
  }

  /**
   * Get instance bundle (DOM and instance).
   * @param {number} id Id of bundle to get.
   * @param {object} [options={}] Options.
   * @param {H5P.ContentType} parent Parent element to resize.
   */
  buildPage(id, options = {}, parent = null) {
    if (this.pages[id]) {
      return this.pages[id];
    }

    let overrideOptions = [];
    if (options.total) {
      if (options?.previousState?.overrideOptions) {
        overrideOptions = options.previousState.overrideOptions;
      }
      else {
        for (let i = 0; i < options.total; i++) {
          let randomOptions;

          if (typeof options.correct === 'number') {
            randomOptions = this.getRandomOptions(options.correct > 0);
            if (randomOptions) {
              overrideOptions.push(randomOptions);
            }
            options.correct = Math.max(0, options.correct - 1);
          }
          else {
            randomOptions = this.getRandomOptions();
            if (randomOptions) {
              overrideOptions.push(randomOptions);
            }
          }

          // Remove chosen random options from pool
          const poolIndex = this.pool.findIndex((option) => option === randomOptions);
          this.discarded.push(randomOptions);

          // Array.splice has side-effects
          this.pool = [...this.pool.slice(0, poolIndex), ...this.pool.slice(poolIndex + 1)];
        }

        // Shuffle
        overrideOptions = Util.shuffleArray(overrideOptions);
      }
    }

    // Filter out incomplete rounds
    if (overrideOptions.length < 2) {
      return null;
    }

    // Put cards back into pool if playing with replacement
    if (this.params.modeSampling === 'withReplacement') {
      this.restock();
    }

    // Override options
    let currentParams = {};
    if (overrideOptions.length) {
      currentParams = { ...this.params.instanceParams };
      currentParams.params.options = overrideOptions;
    }
    else {
      currentParams = this.params.instanceParams;
    }

    // Build DOM
    const instanceWrapper = document.createElement('div');
    instanceWrapper.classList.add('h5p-image-choice-rounds-instance');

    /*
     * Passing reported previous state, but it's not recreated by
     * H5P.ImageChoice yet (pull request pending)
     */
    const instance = H5P.newRunnable(
      currentParams,
      this.params.contentId,
      H5P.jQuery(instanceWrapper),
      true,
      {
        previousState: options?.previousState?.instance || {}
      }
    );

    // Add resize listeners
    if (parent) {
      // Resize parent when children resize
      this.bubbleUp(instance, 'resize', parent);

      // Resize children to fit inside parent
      this.bubbleDown(parent, 'resize', [instance]);
    }

    // Override original getScore functions to support negative values
    instance.getScore = () => {
      const negativeIsAllowed = this.params.negativeIsAllowed;
      return this.customGetScore(instance, negativeIsAllowed);
    };
    instance.content.getScore = (negativeIsAllowed = false) => {
      return this.customContentGetScore(instance.content, negativeIsAllowed);
    };

    /*
     * Official MultiMediaChoice doesn't support recreating the view state.
     * Add custom function to recreate 'results'.
     */
    instance.showPreviousResult = () => {
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
    };

    /*
     * Official MultiMediaChoice doesn't support recreating the view state.
     * Not perfect workaround as a polyfill that pulls information from
     * DOM and global view state.
     */
    if (typeof instance.getCurrentViewState !== 'function') {
      instance.getCurrentViewState = () => {
        const container = instance.content.content.parentNode.parentNode;

        if (container.querySelector('.h5p-question-check-answer')) {
          return 'task';
        }
        else if (this.params.enableSolutionsButton) {
          return (
            container.querySelector('.h5p-question-show-solution') ||
            instance.getScore() === instance.getMaxScore()
          ) ?
            'results' :
            'solutions';
        }
        else {
          return (this.parent.getViewState() !== 'solutions') ?
            'results' :
            'solutions';
        }
      };
    }

    /*
     * Official MultiMediaChoice doesn't support getAnswerGiven (yet).
     * Not perfect workaround as a polyfill. Should rather set
     * the state to true once any option is selected and keep it selected
     * until instance is reset.
     */
    if (typeof instance.getAnswerGiven !== 'function') {
      instance.getAnswerGiven = () => {
        if (!instance?.content?.options) {
          return; // Not ready yet
        }

        return instance.content.options.some(option => option.isSelected());
      };
    }

    /*
     * Official MultiMediaChoice doesn't support resume (yet).
     * Workaround to recreate it only if not already done by
     * later version of MultiMediaChoice. Obsolete once MultiMediaChoice
     * supports resume itself.
     */
    if (
      options?.previousState?.instance?.answers &&
      instance.content.options.every(option => !option.isSelected())
    ) {
      options.previousState.instance.answers.forEach(answer => {
        instance.content.toggleSelected(answer);
      });
    }

    if (options?.previousState.viewState === 'results') {
      instance.showPreviousResult();
      if (this.params.enableSolutionsButton) {
        instance.showButton('show-solution');
      }
    }
    else if (options?.previousState.viewState === 'solutions') {
      instance.showPreviousResult();
      instance.showSolutions();
    }

    const progression = options?.previousState.progression || { left: false, right: false };

    return {
      element: instanceWrapper,
      instance: instance,
      overrideOptions: overrideOptions,
      progression: progression
    };
  }

  /**
   * Make it easy to bubble events from child to parent.
   * @param {object} origin Origin of event.
   * @param {string} eventName Name of event.
   * @param {object} target Target to trigger event on.
   */
  bubbleUp(origin, eventName, target) {
    origin.on(eventName, (event) => {
      // Prevent target from sending event back down
      target.bubblingUpwards = true;

      // Trigger event
      target.trigger(eventName, event);

      // Reset
      target.bubblingUpwards = false;
    });
  }

  /**
   * Makes it easy to bubble events from parent to children.
   * @param {object} origin Origin of event.
   * @param {string} eventName Name of event.
   * @param {object[]} targets Targets to trigger event on.
   */
  bubbleDown(origin, eventName, targets) {
    origin.on(eventName, (event) => {
      if (origin.bubblingUpwards) {
        return; // Prevent send event back down.
      }

      targets.forEach((target) => {
        target.trigger(eventName, event);
      });
    });
  }

  /**
   * Custom get score function that allows negative values.
   * @param {object} instance ImageChoice.
   * @param {boolean} [negativeIsAllowed=false] If true, instance can return negative score.
   * @return {number} Score.
   */
  customGetScore(instance, negativeIsAllowed = false) {
    return instance.content.getScore(negativeIsAllowed);
  }

  /**
   * Custom get score function that allows negative values.
   * @param {object} content ImageChoice content.
   * @param {boolean} [negativeIsAllowed=false] If true, instance can return negative score.
   * @return {number} Score.
   */
  customContentGetScore(content, negativeIsAllowed = false) {
    // One point if no correct options and no selected options
    if (content.params.behaviour.singlePoint && content.params.behaviour.passPercentage === 0) {
      return 1;
    }

    if (!content.isAnyAnswerSelected()) {
      return content.isBlankCorrect() ? 1 : 0;
    }

    // Radio buttons, only one answer
    if (content.isSingleAnswer) {
      const isCorrect = content.lastSelectedRadioButtonOption.isCorrect();
      if (isCorrect) {
        return 1;
      }

      return (negativeIsAllowed) ? -1 : 0;
    }

    // Checkbox buttons. 1 point for correct answer, -1 point for incorrect answer
    let score = 0;
    content.options.forEach(option => {
      if (option.isSelected()) {
        option.isCorrect() ? score++ : score--;
      }
    });

    if (!negativeIsAllowed) {
      score = Math.max(0, score); // Negative score not allowed
    }

    /**
     * Checkbox buttons with single point.
     * One point if (score / number of correct options) is above pass percentage
     */
    if (content.params.behaviour.singlePoint) {
      if (score === 0) {
        return 0; // Case with passPercentage = 0 already handled
      }

      if (score > 0) {
        return (score * 100) / content.numberOfCorrectOptions >= content.params.behaviour.passPercentage
          ? 1
          : 0;
      }
      else {
        return -1;
      }
    }

    return score;
  }

  /**
   * Answer call to return the current state.
   * @return {object} Current state.
   */
  getCurrentState() {
    const states = [];

    for (let id in this.pages) {
      const bundle = this.pages[id];

      states.push({
        instance: bundle.instance.getCurrentState(),
        overrideOptions: bundle.overrideOptions,
        progression: bundle.progression,
        viewState: bundle.instance.getCurrentViewState()
      });
    }

    return states;
  }
}
