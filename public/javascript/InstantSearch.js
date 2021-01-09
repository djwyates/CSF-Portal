/**
 * @typedef {Object} InstantSearchOptions
 * @property {URL} searchUrl The URL which the search bar will query to retrieve results
 * @property {string} queryParam The name of the query parameter to be used in each request
 * @property {Function} responseParser Takes the response from the instant search and returns an array of results
 * @property {Function} templateFunction Takes an instant search result and produces the HTML for it
 */

class InstantSearch {
  /**
   * Initializes the instant search bar. Retrieves and creates elements.
   *
   * @param {HTMLElement} instantSearch The container element for the instant search
   * @param {InstantSearchOptions} options A list of options for configuration
   */
  constructor(instantSearch, options) {
    this.options = options;
    this.elements = {
      main: instantSearch,
      input: instantSearch.querySelector(".search__input"),
      resultsContainer: document.createElement("div")
    };
    this.elements.resultsContainer.classList.add("search__results-container");
    this.elements.main.prepend(this.elements.resultsContainer);
    this.addListeners();
  }

  /**
    * Adds event listeners for elements of the instant search.
    */
  addListeners() {
    var delay;
    this.elements.input.addEventListener("input", () => {
      clearTimeout(delay);
      const query = this.elements.input.value;
      delay = setTimeout(() => {
        if (query.trim().length <= 0) {
          this.populateResults([]);
          return;
        }
        this.performSearch(query).then((results) => {
          this.populateResults(results);
        });
      }, 500);
    });
    this.elements.input.addEventListener("focus", () => {
      this.elements.resultsContainer.classList.add("search__results-container--visible");
    });
    this.elements.input.addEventListener("blur", () => {
      this.elements.resultsContainer.classList.remove("search__results-container--visible");
    });
  }

  /**
   * Updates the HTML to display each result under the search bar.
   *
   * @param {Object[]} results
   */
  populateResults(results) {
    // Clear all existing results
    while (this.elements.resultsContainer.firstChild)
      this.elements.resultsContainer.removeChild(this.elements.resultsContainer.firstChild);
    // Update list of results under the search bar
    for (const result of results)
      this.elements.resultsContainer.appendChild(this.createResultElement(result));
  }

  /**
   * Creates the HTML to represents a single result in the list of results.
   *
   * @param {Object} result An instant search result
   * @returns {HTMLAnchorElement}
   */
  createResultElement(result) {
    const anchorElement = document.createElement("a");
    anchorElement.classList.add("search__result");
    anchorElement.insertAdjacentHTML("afterbegin", this.options.templateFunction(result));
    // If provided, add a link for the result
    if ("href" in result)
      anchorElement.setAttribute("href", result.href);
    return anchorElement;
  }

  /**
   * Makes a request at the search URL and retrieves results.
   *
   * @param {string} query Search query
   * @returns {Promise<Object[]>}
   */
  performSearch(query) {
    const url = new URL(this.options.searchUrl.toString());
    url.searchParams.set(this.options.queryParam, query);
    this.setLoading(true);
    return fetch(url, {
      method: "get",
      credentials: "same-origin"
    }).then((response) => {
      if (response.status != 200)
        throw new Error("An unexpected error occured with the search.");
      return response.json();
    }).then((responseData) => {
      return this.options.responseParser(responseData);
    }).catch((error) => {
      console.error(error);
      return [];
    }).finally((results) => {
      this.setLoading(false);
      return results;
    });
  }

  /**
   * Shows or hides the loading indicator for the search bar.
   *
   * @param {boolean} b True will show the loading indicator, false will not
   */
  setLoading(boolean) {
    this.elements.main.classList.toggle("search--loading", boolean);
  }
}

export default InstantSearch;
