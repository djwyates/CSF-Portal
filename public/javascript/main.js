/* header scripts */
const burger = document.querySelector(".burger");
if (burger) {
  burger.addEventListener("click", function() {
    burger.classList.toggle("burger--active");
    document.querySelector(".nav__section").classList.toggle("nav__section--opened");
  });
}

/* upload file form scripts */
const realFileButton = document.querySelector(".form__input--file");
const customButton = document.querySelector(".form__input--filebutton");
const customText = document.querySelector(".form__input--filetext");
if (realFileButton && customButton && customText) {
  customButton.addEventListener("click", function() {
    realFileButton.click();
  });
  realFileButton.addEventListener("change", function() {
    customText.innerHTML = realFileButton.value ? realFileButton.value.match(/[\/\\]([\w\d\s\.\-\(\)]+)$/)[1] : "No file chosen";
  });
}

/* attendance changer form scripts */
const formIconLinks = document.querySelectorAll(".form__icon--link");
if (formIconLinks) {
  formIconLinks.forEach(function(formIconLink) {
    formIconLink.addEventListener("click", function() {
      var attendance = formIconLink.closest(".form__item--row").querySelector(".form__input").value;
      if (attendance.includes("Not attended")) {
        formIconLink.closest(".form__item--row").querySelector(".form__input").value = attendance.substring(0, attendance.length-12) + "Attended";
        formIconLink.closest(".form__item--row").querySelector(".form__input").classList.add("green");
        formIconLink.closest(".form__item--row").querySelector(".form__input").classList.remove("red");
        formIconLink.innerText = "remove_circle";
      } else if (attendance.includes("Attended")) {
        formIconLink.closest(".form__item--row").querySelector(".form__input").value = attendance.substring(0, attendance.length-8) + "Not attended";
        formIconLink.closest(".form__item--row").querySelector(".form__input").classList.remove("green");
        formIconLink.closest(".form__item--row").querySelector(".form__input").classList.add("red");
        formIconLink.innerText = "add_circle";
      }
    });
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

/* card scripts */
const cardIconLinks = document.querySelectorAll(".card__icon-link"), cardDropdowns = document.querySelectorAll(".card__dropdown");
if (cardIconLinks && cardDropdowns) {
  cardIconLinks.forEach(function(cardIconLink) {
    cardIconLink.addEventListener("click", function() {
      cardDropdowns.forEach(function(cardDropdown) {
        if (cardDropdown != cardIconLink.closest(".card").querySelector(".card__dropdown"))
          cardDropdown.classList.remove("card__dropdown--visible");
      });
      cardIconLink.closest(".card").querySelector(".card__dropdown").classList.toggle("card__dropdown--visible");
    });
  });
}
const cardModalButtons = document.querySelectorAll(".card__dropdown-button--viewinfo"), cardModals = document.querySelectorAll(".card__modal");
if (cardModalButtons) {
  cardModalButtons.forEach(function(cardModalButton) {
    cardModalButton.addEventListener("click", function() {
      cardModalButton.closest(".card").querySelector(".card__modal").classList.add("card__modal--visible");
    });
  });
}
const cardModalCloses = document.querySelectorAll(".card__modal-close");
if (cardModalCloses) {
  cardModalCloses.forEach(function(cardModalClose) {
    cardModalClose.addEventListener("click", function() {
      cardModalClose.closest(".card__modal").classList.remove("card__modal--visible");
    });
  });
}

/* modal scripts - maximum of one modal per page */
const modalActivateButtons = document.querySelectorAll(".modal__button-activate"), modal = document.querySelector(".modal");
if (modalActivateButtons) {
  modalActivateButtons.forEach(function(modalActivateButton) {
    modalActivateButton.addEventListener("click", function() {
      modal.classList.add("modal--active");
    });
  });
}
const modalDropdownArrows = document.querySelectorAll(".modal__dropdown-arrow");
if (modalDropdownArrows) {
  modalDropdownArrows.forEach(function(modalDropdownArrow) {
    modalDropdownArrow.addEventListener("click", function() {
      modalDropdownArrow.classList.toggle("modal__dropdown-arrow--active");
      const modalDropdown = modalDropdownArrow.nextElementSibling;
      modalDropdown.classList.toggle("modal__dropdown--active");
      if (modalDropdown.classList.contains("modal__dropdown--active"))
        modalDropdown.style.maxHeight = modalDropdown.scrollHeight + "px";
      else
        modalDropdown.style.maxHeight = 0;
    });
  });
}
const modalCloses = document.querySelectorAll(".modal__close");
if (modalCloses) {
  modalCloses.forEach(function(modalClose) {
    modalClose.addEventListener("click", function() {
      modal.classList.remove("modal--active");
    });
  });
}
/* for tutee pairing modal */
const modalButtons = document.querySelectorAll(".modal__button"), modalForms = document.querySelectorAll(".modal__form");
modalButtons.forEach(function(modalButton) {
  modalButton.addEventListener("click", function() {
    modalForms[0].classList.toggle("modal__form--active");
    modalForms[1].classList.toggle("modal__form--active");
  });
});

/* popup scripts */
const popupActivateButtons = document.querySelectorAll(".popup__button-activate");
if (popupActivateButtons) {
  popupActivateButtons.forEach(function(popupActivateButton) {
    popupActivateButton.addEventListener("click", function() {
      if (popupActivateButton.nextElementSibling.matches(".popup"))
        popupActivateButton.nextElementSibling.classList.toggle("popup--active");
    });
  });
}

/* directory scripts */
const folders = document.querySelectorAll(".directory__folder-link");
if (folders) {
  folders.forEach(function(folder) {
    folder.addEventListener("click", function() {
      folder.parentNode.childNodes[1].classList.toggle("directory__folder-contents--active");
    });
  });
}

/* window.onclick function, used for various purposes */
window.onclick = function(event) {
  /* card scripts */
  if (cardIconLinks && cardDropdowns) {
    if (!event.target.matches(".card__icon-link")) {
      cardDropdowns.forEach(function(cardDropdown) {
        cardDropdown.classList.remove("card__dropdown--visible");
      });
    } if (event.target.matches(".card__modal")) {
      cardModals.forEach(function(cardModal) {
        cardModal.classList.remove("card__modal--visible");
      });
    }
    /* modal scripts */
    if (modal && modalActivateButtons && event.target.matches(".modal"))
      modal.classList.remove("modal--active");
    /* popup scripts */
    const popups = document.querySelectorAll(".popup");
    if (popupActivateButtons && popups && !event.target.closest(".popup")) {
      popups.forEach(function(popup) {
        if (event.target != popup.previousElementSibling)
          popup.classList.remove("popup--active");
      });
    }
    /* table scripts */
    var fnDropdowns = document.querySelectorAll(".table__footnote-dropdown--active");
    if (fnDropdowns) {
      fnDropdowns.forEach(function(fnDropdown) {
        if (!event.target.matches(".table__footnote-rows") && !event.target.matches(".table__footnote-triangle")
        && !event.target.matches(".table__footnote-link")) {
          fnDropdown.classList.remove("table__footnote-dropdown--active");
          var fnSelectors = document.querySelectorAll(".table__footnote-selector--active");
          if (fnSelectors) {
            fnSelectors.forEach(function(fnSelector) {
              fnSelector.classList.remove("table__footnote-selector--active");
            });
          }
        }
      });
    }
  }
}
