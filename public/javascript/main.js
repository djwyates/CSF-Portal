function toggleBurger(burgerContainer) {
  burgerContainer.classList.toggle("activate");
	let topnav = document.getElementById("nav-links");
  if (topnav.className === "nav-links")
    topnav.className += " responsive";
  else
    topnav.className = "nav-links";
}
