/* header scripts */
function toggleBurger(burgerContainer) {
  burgerContainer.classList.toggle("burger--active");
  document.querySelector(".nav__section").classList.toggle("nav__section--opened");
}

document.addEventListener("DOMContentLoaded", function() {
  /* table scripts */
  const rows = document.querySelectorAll(".table__body-row[data-href]");
  rows.forEach(function(row) {
    row.addEventListener("click", function() {
      window.location.href = row.dataset.href;
    });
  });
  /* form scripts */
  const realFileButton = document.getElementById("newMembers");
  const customButton = document.getElementById("newMembersButton");
  const customText = document.getElementById("newMembersText");
  if (customButton) {
    customButton.addEventListener("click", function() {
      realFileButton.click();
    });
  } if (realFileButton) {
    realFileButton.addEventListener("change", function() {
      customText.innerHTML = realFileButton.value ? realFileButton.value.match(/[\/\\]([\w\d\s\.\-\(\)]+)$/)[1] : "No file chosen";
    });
  }
});

/* table filter scripts */
const filterTable = document.querySelector("#filterTable");
if (filterTable) {
  filterTable.addEventListener("keyup", function(query) {
    const queryRegExp = new RegExp(query.target.value.toLowerCase().trim(), "i");
    const rows = document.querySelectorAll(".table__body-row");
    rows:
    for (var row of rows) {
      for (var cell of row.cells) {
        if (!cell.classList.contains("table__cell--attendance") && queryRegExp.test(cell.innerText.toLowerCase())) {
          row.style.display = "table-row";
          continue rows;
        } else {
          row.style.display = "none";
        }
      }
    }
  });
}

/* accordion scripts */
const accordionHeaders = document.querySelectorAll(".accordion__header");
if (accordionHeaders) {
  accordionHeaders.forEach(function(accordionHeader) {
    accordionHeader.addEventListener("click", function() {
      const accordionBody = accordionHeader.nextElementSibling;
      accordionHeader.classList.toggle("accordion__header--active");
      if (accordionHeader.classList.contains("accordion__header--active"))
        accordionBody.style.maxHeight = accordionBody.scrollHeight + "px";
      else
        accordionBody.style.maxHeight = 0;
    });
  });
}
