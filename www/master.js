window.addEventListener("load", () => {

    const MINIMUM_OCCURRENCES = 1;

    class Model {
        constructor(tokens, maxs) {
            this.tokens = tokens;
            this.maxs = maxs;
            console.log("Model contains", Object.keys(this.tokens).length, "tokens");
            console.log(this.maxs);
        }
    }

    var model;

    function loadModelTsv(tsvText) {
        const tokens = {};
        const maxs = {};
        let lines = tsvText.replaceAll("\r", "").split("\n");
        let header = lines[0].split("\t").slice(1);
        lines.slice(1).forEach(line => {
            if (line == "") return;
            let token = line.slice(0, line.indexOf("\t"));
            let length = token.length;
            tokens[token] = {};
            if (!(length in maxs)) {
                maxs[length] = 0;
            }
            let values = line.slice(length + 1).split("\t");
            for (let i = 0; i < header.length; i++) {
                if (values[i] == "") continue;
                let value = parseInt(values[i]);
                tokens[token][header[i]] = value;
                maxs[length] = Math.max(maxs[length], values[i]);
            }
        });
        model = new Model(tokens, maxs);
    }

    function getZipEntry(zipEntries, filename) {
        for (let i = 0; i < zipEntries.length; i++) {
            if (zipEntries[i].filename == filename) {
                return zipEntries[i];
            }
        }
    }
    
    function loadModelBlob(blob) {
        const zipFileReader = new zip.BlobReader(blob);
        const modelTsvWriter = new zip.TextWriter();
        const zipReader = new zip.ZipReader(zipFileReader);
        zipReader.getEntries().then(zipEntries => {
            getZipEntry(zipEntries, "model.tsv").getData(modelTsvWriter).then(tsvText => {
                loadModelTsv(tsvText);
            });
        });
    }

    function loadModel() {
        fetch("model.zip").then(res => res.blob()).then(blob => {
            loadModelBlob(blob);
        });
    }
    
    loadModel();

    function alertAndThrowError(errorMessage) {
        alert("Error: " + errorMessage);
        throw new Error(errorMessage);
    }

    function validateQuery(query) {
        const cleanedQuery = query.toLocaleLowerCase().trim();
        if (!cleanedQuery.match(/^[a-z]+$/)) {
            alertAndThrowError("Query contains illegal characters. Only ASCII letters are allowed.");
        }
        return cleanedQuery;
    }

    function* iterateSuffixes(string) {
        for (let i = 0; i < string.length; i++) {
            yield string.slice(i);
        }
    }

    function copyArrayWithout(array, element) {
        const copy = [...array];
        copy.splice(copy.indexOf(element), 1);
        return copy;
    }

    function setsIntersection(a, b) {
        return new Set([...a].filter(i => b.has(i)));
    }

    function setsDifference(a, b) {
        return new Set([...a].filter(i => !b.has(i)));
    }

    function* iteratePermutationsAux(model, word, letters) {
        if (letters.length == 0) {
            let score = null;
            const suffixes = iterateSuffixes(word);
            while (true) {
                const suffix = suffixes.next();
                if (suffix.done) break;
                const token = suffix.value;
                const length = token.length;
                if (!(token in model.tokens)) continue;
                if (!("$" in model.tokens[token])) continue;
                score = model.tokens[token]["$"] / model.maxs[length] * Math.pow(10, length - 1);
                break;
            }
            const result = {
                word: word,
                score: score == null ? 0 : score,
            };
            yield result;
        } else {
            const seen = new Set();
            const lettersSet = new Set(letters);
            const suffixes = iterateSuffixes(word);
            while (true) {
                const suffix = suffixes.next();
                if (suffix.done) break;
                const token = suffix.value;
                const length = token.length;
                if (!(token in model.tokens)) continue;
                let nextLetterCandidates = new Set(Object.keys(model.tokens[token]));
                nextLetterCandidates = [...setsDifference(setsIntersection(nextLetterCandidates, lettersSet), seen)];
                nextLetterCandidates.sort((a, b) => model.tokens[token][b] - model.tokens[token][a]);
                for (const letter of nextLetterCandidates) {
                    if (model.tokens[token][letter] <= MINIMUM_OCCURRENCES) continue;
                    seen.add(letter);
                    const score = model.tokens[token][letter] / model.maxs[length] * Math.pow(10, length - 1);
                    const continuations = iteratePermutationsAux(model, word + letter, copyArrayWithout(letters, letter));
                    while (true) {
                        const continuation = continuations.next();
                        if (continuation.done) break;
                        if (continuation.value.score == 0) continue;
                        const result = {
                            word: continuation.value.word,
                            score: Math.min(score, continuation.value.score),
                        };
                        yield result;
                    }
                };
            }
        }
    }

    function* iteratePermutations(model, query) {
        const permutations = iteratePermutationsAux(model, "^", query.split(""));
        while (true) {
            const permutation = permutations.next();
            if (permutation.done) break;
            const result = {
                word: permutation.value.word.slice(1),
                score: permutation.value.score,
            }
            yield result;
        }
    }

    function computeTopKPermutations(model, query, k) {
        const iterator = iteratePermutations(model, query);
        const permutations = [];
        while (true) {
            const item = iterator.next();
            if (item.done) break;
            permutations.push(item.value);
        }
        permutations.sort((a, b) => b.score - a.score);
        return permutations.slice(0, k);
    }

    document.getElementById("form-query").addEventListener("submit", (event) => {
        event.preventDefault();
        if (model == null) alertAndThrowError("Model not loaded");
        const formData = new FormData(event.target);
        const query = validateQuery(formData.get("query"));
        const output = document.getElementById("pre-output");
        output.innerHTML = "Computing…";
        setTimeout(() => {
            const permutations = computeTopKPermutations(model, query, 20);
            output.innerHTML = "";
            permutations.forEach(permuation => {
                output.innerHTML += `${permuation.word} (${permuation.score})\n`
            });
        }, 1);
    });
    
});