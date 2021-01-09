/* redirect after clicking a table row with data-href attribute */
const rows = document.querySelectorAll(".table__body-row[data-href]");
rows.forEach(function(row) {
  row.addEventListener("click", function() {
    window.location.href = row.dataset.href;
  });
});

/* prevent tables from extending beyond maxRows, adds table pages if so */
var maxRows = 30, currentPos = 1, rowsToDisplay = [];
const initialTables = document.querySelectorAll(".table");
if (initialTables) {
  initialTables.forEach(function(table) {
    var tableWrapper = table.closest(".table__wrapper");
    if (tableWrapper && table.rows.length-1 > maxRows) {
      /* initialize table - add footnotes & load from the first row */
      table.classList.add("table--large");
      var fn = document.createElement("div");
      fn.classList.add("table__footnote");
      var fnLeft = document.createElement("div");
      fnLeft.classList.add("table__footnote-section--left");
      fnLeft.innerHTML = "Showing <span class='table__footnote-selector'><span class='table__footnote-rows'>" + maxRows + "</span>" +
        "<span class='table__footnote-triangle'></span><div class='table__footnote-dropdown'>" +
        "<span class='table__footnote-link table__footnote-link'>20</span> <span class='table__footnote-link table__footnote-link--inactive'>30</span>" +
        " <span class='table__footnote-link'>50</span> <span class='table__footnote-link'>All</span></div></span> of " +
        "<span class='table__footnote--total-rows'>" + (table.rows.length-1) + "</span><span class='table__footnote-filter invisible'>" +
        "Filter: \"<span class='table__footnote-filter--text'></span>\"<span class='table__footnote-close no-select material-icons'>close</span></span>";
      fn.appendChild(fnLeft);
      var fnRight = document.createElement("div");
      fnRight.classList.add("table__footnote-section--right");
      fnRight.innerHTML = "<span class='table__footnote-arrow table__footnote-arrow--left no-select material-icons'>forward</span>" +
        "<span class='table__footnote--current-pos'></span> of <span class='table__footnote--total-rows'>" + (table.rows.length-1) +
        "</span><span class='table__footnote-arrow table__footnote-arrow--right no-select material-icons'>forward</span>";
      fn.appendChild(fnRight);
      tableWrapper.appendChild(fn);
      loadTable(table, currentPos, maxRows);
    }
  });
}

/* when the left arrow is clicked */
const fnLeftArrows = document.querySelectorAll(".table__footnote-arrow--left");
if (fnLeftArrows) {
  fnLeftArrows.forEach(function(fnLeftArrow) {
    fnLeftArrow.addEventListener("click", function() {
      var table = fnLeftArrow.closest(".table__wrapper").firstElementChild;
      if (table && currentPos != 1) {
        currentPos -= maxRows;
        if (currentPos < 1) currentPos = 1;
        loadTable(table, currentPos, maxRows, {resetScroll: true, rowsToDisplay: rowsToDisplay});
      }
    });
  });
}

/* when the right arrow is clicked */
const fnRightArrows = document.querySelectorAll(".table__footnote-arrow--right");
if (fnRightArrows) {
  fnRightArrows.forEach(function(fnRightArrow) {
    fnRightArrow.addEventListener("click", function() {
      var table = fnRightArrow.closest(".table__wrapper").firstElementChild;
      if (table && currentPos+maxRows < table.rows.length) {
        currentPos += maxRows;
        loadTable(table, currentPos, maxRows, {resetScroll: true, rowsToDisplay: rowsToDisplay});
      }
    });
  });
}

/* when the selector for maxRows is clicked, toggle the dropdown */
const fnSelectors = document.querySelectorAll(".table__footnote-selector");
if (fnSelectors) {
  fnSelectors.forEach(function(fnSelector) {
    fnSelector.addEventListener("click", function() {
      var fnDropdown = fnSelector.childNodes[2];
      if (fnDropdown.matches(".table__footnote-dropdown")) {
        fnDropdown.classList.toggle("table__footnote-dropdown--active");
        fnSelector.classList.toggle("table__footnote-selector--active");
      }
    });
  });
}

/* when a new maxRows value is chosen from the selector dropdown */
const fnLinks = document.querySelectorAll(".table__footnote-link");
if (fnLinks) {
  fnLinks.forEach(function(fnLink) {
    fnLink.addEventListener("click", function() {
      var newMaxRows = fnLink.innerText;
      fnLink.closest(".table__footnote-selector").childNodes[0].innerText = newMaxRows;
      var links = fnLink.parentNode.childNodes;
      links.forEach(function(link) {
        if (link.matches && link.matches(".table__footnote-link")) {
          link.classList.remove("table__footnote-link--inactive");
          if (link.innerText == newMaxRows) link.classList.add("table__footnote-link--inactive");
        }
      });
      var table = fnLink.closest(".table__wrapper").firstElementChild;
      if (table && table.matches(".table")) {
        if (newMaxRows == "All") maxRows = table.rows.length;
        else maxRows = parseInt(newMaxRows);
        currentPos = 1;
        loadTable(table, currentPos, maxRows, {rowsToDisplay: rowsToDisplay});
      }
    });
  });
}

/* when the filter is deleted from the footnotes */
const tableFilterCloses = document.querySelectorAll(".table__footnote-close");
if (tableFilterCloses) {
  tableFilterCloses.forEach(function(tableFilterClose) {
    tableFilterClose.addEventListener("click", function() {
      var table = tableFilterClose.closest(".table__wrapper").firstElementChild;
      var tableFilterInput = tableFilterClose.closest(".table__wrapper").previousElementSibling.childNodes[1].childNodes[1];
      if (table && table.matches(".table") && tableFilterInput && tableFilterInput.matches(".search__input")) {
        tableFilterInput.value = "";
        rowsToDisplay = [];
        currentPos = 1;
        loadTable(table, currentPos, maxRows, {rowsToDisplay: rowsToDisplay});
      }
    });
  });
}

/* filter table according to what is typed into #filterTable */
const tableFilters = document.querySelectorAll(".table__filter");
if (tableFilters) {
  tableFilters.forEach(function(tableFilter) {
    tableFilter.addEventListener("keyup", function(query) {
      var table = tableFilter.closest(".above-table").nextElementSibling.firstElementChild;
      var queryRegExp = new RegExp(query.target.value.toLowerCase().trim(), "i");
      rowsToDisplay = [0];
      if (table && table.matches(".table")) {
        rows:
        for (var i = 1; i < table.rows.length; i++) {
          for (var j = 0; j < table.rows[i].cells.length; j++) {
            if (!table.rows[i].cells[j].classList.contains("table__cell--attendance")
            && queryRegExp.test(table.rows[i].cells[j].innerText.toLowerCase())) {
              rowsToDisplay.push(i);
              continue rows;
            }
          }
        }
        if (table.matches(".table--large")) {
          currentPos = 1;
          loadTable(table, currentPos, maxRows, {rowsToDisplay: rowsToDisplay});
        } else {
          for (var i = 1; i < table.rows.length; i++)
            table.rows[i].classList.add("invisible");
          for (var i = 1; i < rowsToDisplay.length; i++)
            table.rows[rowsToDisplay[i]].classList.remove("invisible");
        }
      }
    });
  });
}

function loadTable(table, pos, maxRows, options) {
  if (!pos || pos <= 0) pos = 1;
  else if (pos > table.rows.length-1) pos = table.rows.length-1;
  maxRows = maxRows || table.rows.length;
  options = options || {};
  for (var i = 1; i < table.rows.length; i++)
    table.rows[i].classList.add("invisible");
  var totalRows = table.rows.length;
  /* loads table from a select set of rows */
  if (options.rowsToDisplay && Array.isArray(options.rowsToDisplay)
  && options.rowsToDisplay.length > 0 && options.rowsToDisplay.length < table.rows.length) {
    totalRows = options.rowsToDisplay.length;
    for (var i = pos; i < pos+maxRows; i++) {
      if (options.rowsToDisplay[i])
        table.rows[options.rowsToDisplay[i]].classList.remove("invisible");
    }
    var fnFilter = table.nextElementSibling.childNodes[0].childNodes[4];
    if (fnFilter && fnFilter.matches(".table__footnote-filter")) {
      fnFilter.classList.remove("invisible");
      var fnFilterText = fnFilter.childNodes[1];
      if (fnFilterText && fnFilterText.matches(".table__footnote-filter--text")) {
        var tableFilterInput = fnFilterText.closest(".table__wrapper").previousElementSibling.childNodes[1].childNodes[1];
        if (tableFilterInput && tableFilterInput.matches(".search__input"))
          fnFilterText.innerText = tableFilterInput.value.trim();
      }
    }
  /* loads table from all rows */
  } else {
    for (var i = pos; i < pos+maxRows; i++) {
      if (table.rows[i])
        table.rows[i].classList.remove("invisible");
    }
    var fnFilter = table.nextElementSibling.childNodes[0].childNodes[4];
    if (fnFilter && fnFilter.matches(".table__footnote-filter"))
      fnFilter.classList.add("invisible");
  }
  /* changes footnotes */
  var fnLeftArrow = table.nextElementSibling.childNodes[1].childNodes[0];
  var fnRightArrow = table.nextElementSibling.childNodes[1].childNodes[4];
  var fnPos = table.nextElementSibling.childNodes[1].childNodes[1];
  var fnRowsLeft = table.nextElementSibling.childNodes[0].childNodes[3];
  var fnRowsRight = table.nextElementSibling.childNodes[1].childNodes[3];
  if (fnLeftArrow && fnLeftArrow.matches(".table__footnote-arrow--left"))
    fnLeftArrow.style.visibility = (pos == 1) ? "hidden" : "visible";
  if (fnRightArrow && fnRightArrow.matches(".table__footnote-arrow--right"))
    fnRightArrow.style.visibility = (pos+maxRows >= totalRows) ? "hidden" : "visible";
  if (fnPos && fnPos.matches(".table__footnote--current-pos"))
    fnPos.innerText = (totalRows-1 == 0 ? 0 : pos) + "-" + ((pos+maxRows) >= totalRows ? totalRows-1 : pos+maxRows-1);
  if (fnRowsLeft && fnRowsLeft.matches(".table__footnote--total-rows"))
    fnRowsLeft.innerText = totalRows-1;
  if (fnRowsRight && fnRowsRight.matches(".table__footnote--total-rows"))
    fnRowsRight.innerText = totalRows-1;
  /* sets scroll position to top if instructed */
  if (options.resetScroll) window.scroll(0, 0);
}
