/* redirect after clicking a table row with data-href attribute */
const rows = document.querySelectorAll(".table__body-row[data-href]");
rows.forEach(function(row) {
  row.addEventListener("click", function() {
    window.location.href = row.dataset.href;
  });
});

/* prevent tables from extending beyond maxRows, adds table pages if so */
var maxRows = 30, currentPos = 1;
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
        " <span class='table__footnote-link'>50</span> <span class='table__footnote-link'>All</span></div></span> of " + (table.rows.length-1);
      fn.appendChild(fnLeft);
      var fnRight = document.createElement("div");
      fnRight.classList.add("table__footnote-section--right");
      fnRight.innerHTML = "<span class='table__icon table__icon--left-arrow no-select material-icons'>forward</span>" +
        "<span class='table__footnote--current-pos'></span> of " + (table.rows.length-1) +
        "<span class='table__icon table__icon--right-arrow no-select material-icons'>forward</span>";
      fn.appendChild(fnRight);
      tableWrapper.appendChild(fn);
      loadTable(table, currentPos);
    }
  });
}

/* when the left arrow is clicked */
const fnLeftArrows = document.querySelectorAll(".table__icon--left-arrow");
if (fnLeftArrows) {
  fnLeftArrows.forEach(function(fnLeftArrow) {
    fnLeftArrow.addEventListener("click", function() {
      var table = fnLeftArrow.closest(".table__wrapper").firstElementChild;
      if (table && currentPos != 1) {
        currentPos -= maxRows;
        if (currentPos < 1) currentPos = 1;
        loadTable(table, currentPos, true);
      }
    });
  });
}

/* when the right arrow is clicked */
const fnRightArrows = document.querySelectorAll(".table__icon--right-arrow");
if (fnRightArrows) {
  fnRightArrows.forEach(function(fnRightArrow) {
    fnRightArrow.addEventListener("click", function() {
      var table = fnRightArrow.closest(".table__wrapper").firstElementChild;
      if (table && currentPos + maxRows <= table.rows.length) {
        currentPos += maxRows;
        loadTable(table, currentPos, true);
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
        loadTable(table, currentPos, true);
      }
    });
  });
}

/* filter table according to what is typed into #filterTable */
const tableFilters = document.querySelectorAll(".table__filter");
if (tableFilters) {
  tableFilters.forEach(function(tableFilter) {
    tableFilter.addEventListener("keyup", function(query) {
      var queryRegExp = new RegExp(query.target.value.toLowerCase().trim(), "i");
      var table = tableFilter.closest(".above-table").nextElementSibling.firstElementChild;
      if (table && table.matches(".table")) {
        rows:
        for (var i = 0; i < table.rows.length; i++) {
          console.log(table.rows[i]);
          for (var j = 0; j < table.rows[i].cells.length; i++) {
            if (table.rows[i].classList.contains("table__head-row") || (!table.rows[i].cells[j].classList.contains("table__cell--attendance")
            && queryRegExp.test(table.rows[i].cells[j].innerText.toLowerCase()))) {
              continue rows;
            } else if (j == table.rows[i].cells.length-1) {
              table.deleteRow(i);
              i--;
            }
          }
        }
      }
    });
  });
}

function loadTable(table, pos, resetScroll) {
  if (pos <= 0) pos = 1;
  else if (pos > table.rows.length-1) pos = table.rows.length-1;
  /* display rows */
  for (var i = 1; i < table.rows.length; i++)
    table.rows[i].style.display = "none";
  for (var i = pos; i < pos+maxRows; i++) {
    if (table.rows[i])
      table.rows[i].style.display = "table-row";
  }
  /* change footnotes */
  var fnLeftArrow = table.nextElementSibling.childNodes[1].childNodes[0];
  if (fnLeftArrow && fnLeftArrow.matches(".table__icon--left-arrow") && pos == 1)
    fnLeftArrow.style.visibility = "hidden";
  else
    fnLeftArrow.style.visibility = "visible";
  var fnRightArrow = table.nextElementSibling.childNodes[1].childNodes[3];
  if (fnRightArrow && fnRightArrow.matches(".table__icon--right-arrow") && pos+maxRows > table.rows.length)
    fnRightArrow.style.visibility = "hidden";
  else
    fnRightArrow.style.visibility = "visible";
  var fnPos = table.nextElementSibling.childNodes[1].childNodes[1];
  if (fnPos && fnPos.matches(".table__footnote--current-pos"))
    fnPos.innerText = pos + "-" + ((pos+maxRows-1) > table.rows.length-1 ? table.rows.length-1 : (pos+maxRows-1));
  /* sets scroll position to top if instructed */
  resetScroll = resetScroll || false;
  if (resetScroll) window.scroll(0, 0);
}
