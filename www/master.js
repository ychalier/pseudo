window.addEventListener("load", () => {

    const worker = new Worker("worker.js");

    function capitalize(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    worker.onmessage = (event) => {
        if (event.data.status == "finished") {
            if (event.data.success) {
                const output = document.getElementById("pre-output");
                output.innerHTML = "";
                event.data.result.forEach(nickname => {
                    output.innerHTML += `${capitalize(nickname.firstname)} ${capitalize(nickname.lastname)} (${nickname.score.toFixed(3)})\n`;
                });
            } else {
                alert(event.data.error);
            }
        }
    }

    document.getElementById("form-query").addEventListener("submit", (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        worker.postMessage([formData.get("query")]);
        document.getElementById("pre-output").innerHTML = "Computing…";
    });
    
});