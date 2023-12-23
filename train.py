import argparse
import glob
import io
import os
import re
import unicodedata


class Trainer:

    ALLOWED_CHARS = "abcdefghijklmnopqrstuvwxyz"
    IGNORED_CHARS = re.compile("[^a-z ]")

    @staticmethod
    def clean_string(s: str) -> str:
        s = s.lower()
        s = "".join(
            c for c in unicodedata.normalize("NFKD", s)
            if unicodedata.category(c) != "Mn")
        s = re.sub("æ", "ae", s)
        s = re.sub("œ", "oe", s)
        s = Trainer.IGNORED_CHARS.sub(" ", s)
        s = re.sub(r" +", " ", s)
        return s

    def __init__(self, max_token_length:int=4) -> None:
        self.max_token_length: int = max_token_length
        self.tokens: dict[str, dict[str, int]] = {}

    def feed_word(self, word: str) -> None:
        word = f"^{word}$"
        for i in range(len(word) - 1):
            for j in range(self.max_token_length):
                if i + j + 1>= len(word):
                    continue
                token = word[i:i+j+1]
                char = word[i + j + 1]
                self.tokens.setdefault(token, {})
                self.tokens[token].setdefault(char, 0)
                self.tokens[token][char] += 1

    def feed(self, fs:io.TextIOWrapper, buffer_size:int=4096) -> None:        
        prefix = ""
        while True:
            buffer = fs.read(buffer_size)
            if not buffer:
                break
            split = (prefix + self.clean_string(buffer)).split(" ")
            prefix = split[-1]
            for word in filter(lambda s: s, split[:-1]):
                self.feed_word(word)

    def train(self, *paths:str) -> None:
        for path in paths:
            print("Feeding text at", path)
            with open(path, "r", encoding="utf8") as file:
                self.feed(file)
        print("Model contains", len(self.tokens), "tokens")
    
    def to_tsv(self, path:str="tokens.tsv") -> None:
        print("Saving to", path)
        with open(path, "w") as file:
            file.write("\t" + "\t".join(list(Trainer.ALLOWED_CHARS + "$")) + "\n")
            for token in self.tokens:
                file.write(f"{token}")
                for c in Trainer.ALLOWED_CHARS + "$":
                    file.write(f"\t{self.tokens[token].get(c, '')}")
                file.write("\n")


def expand_input_paths(*paths):
    output = []
    for path in paths:
        if os.path.isfile(path):
            output.append(path)
        elif os.path.isdir(path):
            for filename in next(os.walk(path))[2]:
                output.append(os.path.join(path, filename))
        else:
            for fpath in glob.glob(path):
                if os.path.isfile(fpath):
                    output.append(fpath)
    return output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="+", type=str)
    parser.add_argument("-o", "--output-path", type=str, default="data/tokens.tsv", help="path to output TSV")
    parser.add_argument("-m", "--max-token-length", type=int, default=4, help="maximum token length")
    args = parser.parse_args()
    trainer = Trainer(args.max_token_length)
    input_paths = expand_input_paths(*args.paths)
    trainer.train(*input_paths)
    trainer.to_tsv(args.output_path)


if __name__ == "__main__":
    main()
