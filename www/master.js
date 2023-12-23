window.addEventListener("load", () => {

    const MINIMUM_TOKEN_OCCURRENCES = 10;

    class Model {

        constructor(tokens, maleFirstnames, femaleFirstnames) {
            this.tokens = tokens;
            this.tokenOccurrences = null;
            this.maximumPairOccurrences = null;
            this.maleFirstnames = maleFirstnames;
            this.femaleFirstnames = femaleFirstnames;
            this.preprocess();
            console.log(
                "Loaded model with",
                Object.keys(this.tokens).length,
                "tokens and",
                this.maleFirstnames.size + this.femaleFirstnames.size,
                "firstnames");
        }

        preprocess() {
            this.tokenOccurrences = {};
            this.maximumPairOccurrences = {};
            for (const token in this.tokens) {
                const length = token.length;
                if (!(length in this.maximumPairOccurrences)) {
                    this.maximumPairOccurrences[length] = 0;
                }
                this.tokenOccurrences[token] = 0;
                for (const letter in this.tokens[token]) {
                    this.tokenOccurrences[token] += this.tokens[token][letter];
                    this.maximumPairOccurrences[length] = Math.max(
                        this.maximumPairOccurrences[length],
                        this.tokens[token][letter]);
                }
            }
        }

    }

    var model;

    function loadModelTsv(tsvText) {
        const tokens = {};
        let lines = tsvText.replaceAll("\r", "").split("\n");
        let header = lines[0].split("\t").slice(1);
        lines.slice(1).forEach(line => {
            if (line == "") return;
            let token = line.slice(0, line.indexOf("\t"));
            let length = token.length;
            tokens[token] = {};
            let values = line.slice(length + 1).split("\t");
            for (let i = 0; i < header.length; i++) {
                if (values[i] == "") continue;
                let value = parseInt(values[i]);
                tokens[token][header[i]] = value;
            }
        });
        return tokens;
    }

    function loadFirstnamesText(firstnamesText) {
        const firstnames = new Set();
        firstnamesText.trim().replaceAll("\r", "").split("\n").forEach(line => {
            if (line == "") return;
            firstnames.add(line);
        });
        return firstnames;
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
        const tokenTsvWriter = new zip.TextWriter();
        const maleFirstnamesTextWriter = new zip.TextWriter();
        const femaleFirstnamesTextWriter = new zip.TextWriter();
        const zipReader = new zip.ZipReader(zipFileReader);
        zipReader.getEntries().then(zipEntries => {
            getZipEntry(zipEntries, "tokens.tsv").getData(tokenTsvWriter).then(tsvText => {
                const tokens = loadModelTsv(tsvText);
                getZipEntry(zipEntries, "male.txt").getData(maleFirstnamesTextWriter).then(maleFirstnamesText => {
                    const maleFirstnames = loadFirstnamesText(maleFirstnamesText);
                    getZipEntry(zipEntries, "female.txt").getData(femaleFirstnamesTextWriter).then(femaleFirstnamesText => {
                        const femaleFirstnames = loadFirstnamesText(femaleFirstnamesText);
                        model = new Model(tokens, maleFirstnames, femaleFirstnames);
                    });
                });
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

    function preprocessQuery(query) {
        return query.toLocaleLowerCase().trim().replace(/[^a-z]/, "");
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
                score = model.tokens[token]["$"] / model.maximumPairOccurrences[length] * Math.pow(10, length - 1);
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
                if (model.tokenOccurrences[token] < MINIMUM_TOKEN_OCCURRENCES) continue;
                let nextLetterCandidates = new Set(Object.keys(model.tokens[token]));
                nextLetterCandidates = [...setsDifference(setsIntersection(nextLetterCandidates, lettersSet), seen)];
                nextLetterCandidates.sort((a, b) => model.tokens[token][b] - model.tokens[token][a]);
                for (const letter of nextLetterCandidates) {
                    seen.add(letter);
                    const score = model.tokens[token][letter] / model.maximumPairOccurrences[length] * Math.pow(10, length - 1);
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

    function computeTopPermutations(model, query, k=10, timeoutSeconds=5) {
        const iterator = iteratePermutations(model, query);
        const permutations = [];
        const timeStart = new Date();
        let timeout = false;
        while (true) {
            const elapsedMillis = (new Date() - timeStart);
            if (elapsedMillis > timeoutSeconds * 1000) {
                timeout = true;
                break;
            }
            const item = iterator.next();
            if (item.done) break;
            permutations.push(item.value);
        }
        permutations.sort((a, b) => b.score - a.score);
        return {
            permutations: permutations.slice(0, k),
            timeout: timeout,
        }
    }

    function* iterateFirstnames(model, query, male=true, female=true) {
        let firstnameCandidates = null;
        if (male && female) {
            firstnameCandidates = new Set([...model.maleFirstnames, ...model.femaleFirstnames]);
        } else if (male) {
            firstnameCandidates = new Set([...model.maleFirstnames]);
        } else if (female) {
            firstnameCandidates = new Set([...model.femaleFirstnames]);
        } else {
            firstnameCandidates = new Set();
        }
        for (const firstname of firstnameCandidates) {
            if (query.startsWith(firstname)) continue;
            const pool = [...query];
            let feasible = true;
            for (const letter of firstname) {
                const letterIndex = pool.indexOf(letter);
                if (letterIndex == -1) {
                    feasible = false;
                    break;
                }
                pool.splice(letterIndex, 1);
            }
            if (!feasible) continue;
            const result = {
                firstname: firstname,
                pool: pool,
            }
            yield result;
        }
    }

    function findNicknames(model, query, options) {
        const iterator = iterateFirstnames(model, query, options.male, options.female);
        const results = [];
        while (true) {
            const item = iterator.next();
            if (item.done) break;
            const topPermutationsResult = computeTopPermutations(model, item.value.pool.join(""), options.k, options.timeout);
            for (const permutation of topPermutationsResult.permutations) {
                results.push({
                    firstname: item.value.firstname,
                    lastname: permutation.word,
                    score: permutation.score,
                });
            }
        }
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, options.q);
    }

    function capitalize(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    document.getElementById("form-query").addEventListener("submit", (event) => {
        event.preventDefault();
        if (model == null) alertAndThrowError("Model not loaded");
        const formData = new FormData(event.target);
        const query = preprocessQuery(formData.get("query"));
        const output = document.getElementById("pre-output");
        output.innerHTML = "Computing…";
        setTimeout(() => {
            const nicknames = findNicknames(model, query, {
                male: true,
                female: true,
                k: 3,
                q: 10,
                timeout: 1
            });
            output.innerHTML = "";
            nicknames.forEach(nickname => {
                output.innerHTML += `${capitalize(nickname.firstname)} ${capitalize(nickname.lastname)} (${nickname.score.toFixed(3)})\n`;
            });
            // if (result.timeout) {
            //     output.innerHTML += "Computation timed out. Results might be bad.\n";
            // }
            // result.permutations.forEach(permuation => {
            //     output.innerHTML += `${permuation.word} (${permuation.score})\n`
            // });
        }, 1);
    });
    
});