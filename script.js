const openButton = document.getElementById("openScroll");

openButton.addEventListener("click", function () {

    document.getElementById("archive").scrollIntoView({
        behavior: "smooth"
    });

});
