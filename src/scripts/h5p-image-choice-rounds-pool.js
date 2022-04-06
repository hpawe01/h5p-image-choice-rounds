import Util from './h5p-image-choice-rounds-util';

/** Class representing the content */
export default class ImageChoiceRoundsPool {

  /**
   * @constructor
   */
  constructor(params = {}, parent) {
    this.params = params;

    // Override content's default parameters
    this.params.instanceParams.params.behaviour.enableRetry = false;
    this.params.instanceParams.params.behaviour.showSolutionsRequiresInput = false;

    // Set up pool of options, may get depleted over time
    this.pool = this.params.instanceParams.params.options || [];

    this.discarded = [];

    // Instantiate instances for rounds
    this.instanceBundles = {};
    for (let round = 0; round < this.params.numberRounds; round++) {
      this.instanceBundles[round] = this.buildInstanceBundle(round, {
        total: this.params.numberImages,
        correct: this.params.numberImagesCorrect,
        previousState: this.params.previousState ? this.params.previousState[round] : {}
      }, parent);
    }
  }

  /**
   * Get random options from pool.
   * @param {boolean} [correct=false] Preferred image correctness.
   * @return {object} Random options.
   */
  getRandomOptions(correct = false) {
    if (!this.pool.length) {
      return null;
    }

    // Try to get images of preferred correctness
    const candidates = this.pool.some(image => image.correct === correct) ?
      this.pool.filter(image => image.correct === correct) :
      this.pool.filter(image => image.correct !== correct);

    const randomOptions = candidates[Math.floor(Math.random() * candidates.length)];

    // Remove chosen random options from pool
    // if (this.params.modeSampling === 'withoutReplacement') {
    const poolIndex = this.pool.findIndex((option) => option === randomOptions);
    this.discarded.push(randomOptions);

    // Array.splice has side-effects
    this.pool = [...this.pool.slice(0, poolIndex), ...this.pool.slice(poolIndex + 1)];
    // }

    return randomOptions;
  }

  /**
   * Restock pool with discarded piles.
   */
  restock() {
    this.pool = [...this.pool, ...this.discarded];
    this.discarded = [];
  }

  /**
   * Get instance bundles.
   * @return {object} Instance bundles.
   */
  getInstanceBundles() {
    return this.instanceBundles;
  }

  /**
   * Get instance bundle (DOM and instance).
   * @param {number} id Id of bundle to get.
   * @param {object} [options={}] Options.
   * @param {H5P.ContentType} parent Parent element to resize.
   */
  buildInstanceBundle(id, options = {}, parent = null) {
    if (this.instanceBundles[id]) {
      return this.instanceBundles[id];
    }

    let overrideOptions = [];
    if (options.total) {
      if (options?.previousState?.overrideOptions) {
        overrideOptions = options.previousState.overrideOptions;
      }
      else {
        for (let i = 0; i < options.total; i++) {
          if (typeof options.correct === 'number') {
            const randomOptions = this.getRandomOptions(options.correct > 0);
            if (randomOptions) {
              overrideOptions.push(randomOptions);
            }
            options.correct = Math.max(0, options.correct - 1);
          }
          else {
            const randomOptions = this.getRandomOptions(Math.random() > 0.5);
            if (randomOptions) {
              overrideOptions.push(randomOptions);
            }
          }
        }

        // Shuffle
        overrideOptions = Util.shuffleArray(overrideOptions);
      }
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

    // Add resize listeners
    if (parent) {
      // Resize parent when children resize
      this.bubbleUp(instance, 'resize', parent);

      // Resize children to fit inside parent
      this.bubbleDown(parent, 'resize', [instance]);
    }

    // TODO: Investigate why 'resize' does not fire on 'check'

    return {
      element: instanceWrapper,
      instance: instance,
      overrideOptions: overrideOptions
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
   * Answer call to return the current state.
   * @return {object} Current state.
   */
  getCurrentState() {
    const states = [];
    for (let bundle in this.instanceBundles) {
      states.push({
        instance: this.instanceBundles[bundle].instance.getCurrentState(),
        overrideOptions: this.instanceBundles[bundle].overrideOptions
      });
    }

    return states;
  }
}
