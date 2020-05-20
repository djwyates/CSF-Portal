document.addEventListener("DOMContentLoaded", function() {
  const rows = document.querySelectorAll("tr[data-href]");
  rows.forEach(function(row) {
    row.addEventListener("click", function() {
      window.location.href = row.dataset.href;
      console.log("MADE IT");
    });
  });
});

function toggleBurger(burgerContainer) {
  burgerContainer.classList.toggle("activate");
	var navLinks = document.getElementById("nav-links");
  if (navLinks.className === "nav-links")
    navLinks.className += " responsive";
  else
    navLinks.className = "nav-links";
}
