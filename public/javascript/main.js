function toggleBurger(burgerContainer) {
  burgerContainer.classList.toggle("activate");
	var navLinks = document.getElementById("nav-links");
  if (navLinks.className === "nav-links")
    navLinks.className += " responsive";
  else
    navLinks.className = "nav-links";
}
