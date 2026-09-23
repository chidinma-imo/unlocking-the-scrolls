const enterButton = document.getElementById("enterButton");
const archive = document.getElementById("archive");

enterButton.addEventListener("click", () => {

    archive.scrollIntoView({
        behavior: "smooth"
    });

});
