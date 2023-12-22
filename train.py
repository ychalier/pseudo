import io
import re
import unicodedata
from typing import T, Iterator


def listrm(l: list[T], x: T) -> list[T]:
    ll = l[:]
    ll.remove(x)
    return ll


class Model(dict):

    ALLOWED_CHARS = "abcdefghijklmnopqrstuvwxyz"
    IGNORED_CHARS = re.compile(r"[\n\(\):,;\.'\?!\-\*_«»\"\d°/\ufeff\+]")

    @staticmethod
    def clean_string(s: str) -> str:
        s = s.lower()
        s = "".join(
            c for c in unicodedata.normalize("NFKD", s)
            if unicodedata.category(c) != "Mn")
        s = re.sub("æ", "ae", s)
        s = re.sub("œ", "oe", s)
        s = Model.IGNORED_CHARS.sub(" ", s)
        s = re.sub(r" +", " ", s)
        fc = set(s).difference(Model.ALLOWED_CHARS + " ")
        if fc:
            raise ValueError("Forbidden characters: " + " ".join(fc))
        return s

    def to_tsv(self, path:str) -> None:
        with open(path, "w") as file:
            file.write("\t" + "\t".join(list(Model.ALLOWED_CHARS + "$")) + "\n")
            for token in self:
                file.write(f"{token}")
                for c in Model.ALLOWED_CHARS + "$":
                    file.write(f"\t{self[token].get(c, '')}")
                file.write("\n")

    @classmethod
    def from_tsv(cls, path:str):
        print("Loading model at", path)
        model = cls()
        with open(path, "r") as file:
            header = file.readline().strip().split("\t")
            while True:
                line = file.readline().strip()
                if not line:
                    break
                token, *vals = line.split("\t")
                model[token] = {}
                for char, val in zip(header, vals):
                    if val == "":
                        continue
                    model[token][char] = float(val)
        return model
    
    @staticmethod
    def iterate_suffixes(string: str) -> Iterator[str]:
        for i in range(len(string)):
            yield string[i:]
    
    def _iterate_permutations(self, word: str, letters: list[str]) -> Iterator[tuple[str, int]]:
        if letters:
            seen = set()
            for suffix in self.iterate_suffixes(word):
                if suffix not in self:
                    continue
                continuations = sorted(
                    set(letters).intersection(self[suffix]).difference(seen),
                    key=lambda l: -self[suffix][l]
                )
                for letter in continuations:
                    seen.add(letter)
                    score = self[suffix][letter] * (10 ** (len(suffix) - 1))
                    for end_word, end_score in self._iterate_permutations(word + letter, listrm(letters, letter)):
                        if end_score == 0:
                            continue
                        yield end_word, min(score, end_score)
        else:
            score = None
            for suffix in self.iterate_suffixes(word):
                if suffix not in self:
                    continue
                if "$" not in self[suffix]:
                    continue
                score = self[suffix]["$"] * (10 ** (len(suffix) - 1))
                break
            if score is None:
                yield word, 0
            else:
                yield word, score
    
    def iterate_permutations(self, base_word: str) -> Iterator[tuple[str, int]]:
        for word, score in self._iterate_permutations("^", list(base_word)):
            yield word[1:], score


class Trainer:

    def __init__(self, max_token_length:int=4, min_token_occs:int=0) -> None:
        self.max_token_length: int = max_token_length
        self.min_token_occs: int = min_token_occs
        self.model: Model = Model()

    def feed_word(self, word: str) -> None:
        word = f"^{word}$"
        for i in range(len(word) - 1):
            for j in range(self.max_token_length):
                if i + j + 1>= len(word):
                    continue
                token = word[i:i+j+1]
                char = word[i + j + 1]
                self.model.setdefault(token, {})
                self.model[token].setdefault(char, 0)
                self.model[token][char] += 1

    def feed(self, fs:io.TextIOWrapper, buffer_size:int=4096) -> None:        
        prefix = ""
        while True:
            buffer = fs.read(buffer_size)
            if not buffer:
                break
            split = (prefix + Model.clean_string(buffer)).split(" ")
            prefix = split[-1]
            for word in filter(lambda s: s, split[:-1]):
                self.feed_word(word)

    def prune(self) -> None:
        blacklist = []
        for token in self.model:
            if sum(self.model[token].values()) < self.min_token_occs:
                blacklist.append(token)
        for token in blacklist:
            del self.model[token]

    def train(self, *paths:str) -> Model:
        for path in paths:
            print("Feeding text at", path)
            with open(path, "r", encoding="utf8") as file:
                self.feed(file)
        print("Model contains", len(self.model), "tokens")
        self.prune()
        print("After pruning, model contains", len(self.model), "tokens")
        return self.model


paths = [
    "resources/datasets/les-miserables-tome-1-fantine.txt",
    "resources/datasets/les-miserables-tome-2-cosette.txt",
    "resources/datasets/les-miserables-tome-3-marius.txt",
    "resources/datasets/les-miserables-tome-4.txt",
    "resources/datasets/les-miserables-tome-5-jean-valjean.txt",
]
Trainer().train(*paths).to_tsv("model.tsv")

model = Model.from_tsv("model.tsv")
permutations = list(model.iterate_permutations("chalier"))
permutations.sort(key=lambda x: -x[1])
print(permutations[:10])
