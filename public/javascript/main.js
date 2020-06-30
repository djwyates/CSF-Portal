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
  customButton.addEventListener("click", function() {
    realFileButton.click();
  });
  realFileButton.addEventListener("change", function() {
    customText.innerHTML = realFileButton.value ? realFileButton.value.match(/[\/\\]([\w\d\s\.\-\(\)]+)$/)[1] : "No file chosen";
  });
});

/* table filter scripts */
const filterTable = document.querySelector("#filterTable");
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
