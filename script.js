const openButton = document.getElementById("openScroll");
const introScreen = document.getElementById("introScreen");
const scroll = document.getElementById("scroll");
const introContent = document.querySelector(".intro-content");

openButton.addEventListener("click", () => {

    scroll.classList.add("opening");

    introContent.classList.add("fade-away");

    setTimeout(() => {

        document.getElementById("archive").scrollIntoView({
            behavior: "smooth"
        });

    }, 1800);

});
