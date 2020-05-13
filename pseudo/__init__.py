"""
French anagram pseudonym generator based on Markov chains.
"""

__version__ = "1.0.0"
__author__ = "Yohan Chalier"
__email__ = "yohan@chalier.fr"

import re
import os
import glob
import math
import codecs
import pickle
import tqdm  # pylint: disable=E0401
import slugify  # pylint: disable=E0401

WORD_SPLIT_PATTERN = re.compile(r"[\d \.,;_\*\(\):'\"!«/»°\+º-]")
NGRAM_SIZES = [1, 2, 3]
MODEL_FILENAME = "resources/ngrams_markov_chain.pickle"
VOWELS = "aeiouy"


class LetterBag:

    """
    Represent a bag of letters (with repetitions).
    """

    def __init__(self, text=""):
        self.surface = text
        self.chars = dict()
        for char in text:
            self.chars.setdefault(char, 0)
            self.chars[char] += 1

    def __str__(self):
        return self.string()

    def __eq__(self, other):
        return self.string() == other.string()

    def __hash__(self):
        return hash(self.string())

    def __len__(self):
        return sum(self.chars.values())

    def __iter__(self):
        return iter(self.string())

    def string(self):
        """String format of the bag"""
        text = ""
        for char, qty in self.chars.items():
            text += char * qty
        return "".join(sorted(text))

    def copy(self):
        """Return a new bag with the same surface string"""
        return LetterBag(self.string())

    def includes(self, other):
        """Check if all letters from another bag can fit in our bag"""
        for char, qty in other.chars.items():
            if self.chars.get(char, 0) < qty:
                return False
        return True

    def sub(self, other):
        """Create a new bag by popping out some letters"""
        result = self.copy()
        for char, qty in other.chars.items():
            result.chars[char] -= qty
        result.surface = ""
        return result

    def pop(self, char):
        """Pop a single character"""
        assert self.chars[char] > 0
        self.chars[char] -= 1

    def empty(self):
        """Check if the bag is empty"""
        return len(self) == 0


def iterate_continutations(model, radix, whitelist, topk):
    """
    Given a string radix (containing only a-z letters), this string iterates
    over the possible ngrams continuations, in most probable rank.
    Only yields up to topk possible continuations.
    """
    for size in sorted(model.keys(), reverse=True):
        probas = dict()
        left = ("^" + radix)[-size:]
        count = 0
        for right in model[size].get(left, dict()):
            if whitelist.includes(LetterBag(right)):
                probas.setdefault(right, 0)
                probas[right] += math.exp(model[size][left][right])
                count += 1
        if count > 0:
            k = 0
            for selection, proba in sorted(probas.items(), key=lambda x: -x[1]):
                k += 1
                if k > topk:
                    break
                yield selection, math.log(proba / count)
            break
    yield None, 0


def generate_word(model, whitelist, topk, radix=""):
    """
    Generate a full word given a LetterBag of letters to use.
    """
    if whitelist.empty():
        yield "", 0
    else:
        for prefix, prefix_proba in iterate_continutations(model, radix, whitelist, topk):
            if prefix is None:
                continue
            for suffix, suffix_proba in generate_word(
                    model,
                    whitelist.sub(LetterBag(prefix)),
                    topk,
                    radix + prefix):
                if suffix is None:
                    continue
                yield prefix + suffix, prefix_proba + suffix_proba
        yield None, 0


def word_iterator(folder):
    """
    Iterates over the Markov model training dataset and yields each word after
    it has been normalized.
    """
    for filename in glob.glob(os.path.join(folder, "*.txt")):
        with codecs.open(filename, "r", "utf8") as file:
            for line in file.readlines():
                for word in WORD_SPLIT_PATTERN.split(line.strip()):
                    if word == "":
                        continue
                    yield slugify.slugify(word.lower())


def ngrams(word, size):
    """
    Split a word into ngrams of given size. Additionnal markers are added to
    spot the beginning of the word and the end of the word.
    """
    expanded = "^" + word + "$"
    for start in range(len(expanded) - size + 1):
        yield expanded[start:start + size]


def train():
    """
    Build the Markov chain model by reading a dataset, and export it using
    Pickle. Note that probabilities are expressed with their logarithm to
    avoid numerical issues.
    """
    counts = {size: dict() for size in NGRAM_SIZES}
    for word in tqdm.tqdm(word_iterator("resources/datasets")):
        if word == "":
            continue
        for size in NGRAM_SIZES:
            for token in ngrams(word, 2 * size):
                left, right = token[:size], token[size:]
                counts[size].setdefault(left, dict())
                counts[size][left].setdefault(right, 0)
                counts[size][left][right] += 1
    model = {size: dict() for size in NGRAM_SIZES}
    for size in NGRAM_SIZES:
        for left in counts[size]:
            total = sum(counts[size][left].values())
            model[size][left] = dict()
            for right in counts[size][left]:
                model[size][left][right] = math.log(
                    counts[size][left][right] / total)
    with open(MODEL_FILENAME, "wb") as file:
        pickle.dump(model, file)


def load_model():
    """
    Read the Markov model previously exported via Pickle.
    """
    with open(MODEL_FILENAME, "rb") as file:
        model = pickle.load(file)
    return model


def load_resource(filename):
    """
    Load a text file with one letter bag per row.
    """
    data = set()
    with codecs.open(filename, "r", "utf8") as file:
        for line in file.readlines():
            row = slugify.slugify(line.strip())
            if row != "":
                data.add(LetterBag(row))
    return data


def load_firstnames(gender):
    """
    Load a set of firstnames.
    """
    return load_resource("resources/%s.txt" % gender)


def find_pseudonyms(original_name, gender, topk):
    """
    Find possible annagram pseudonyms given an original name and a gender.
    """
    firstnames = load_firstnames(gender)
    model = load_model()
    whitelist = LetterBag(slugify.slugify(
        WORD_SPLIT_PATTERN.sub("", original_name)))
    for firstname in firstnames:
        if not whitelist.includes(firstname):
            continue
        for lastname, proba in generate_word(model, whitelist.sub(firstname), topk):
            yield firstname.surface, lastname, proba


class BestList(list):

    """
    List with a fixed maximum size, containing only the first items regarding
    a given sorting key.
    """

    def __init__(self, max_size, sorting_key):
        self.max_size = max_size
        self.sorting_key = sorting_key
        super(BestList, self).__init__()

    def append(self, element):
        super(BestList, self).append(element)
        if len(self) > self.max_size:
            self.sort(key=self.sorting_key)
            self.pop()


def basic_check(word):
    """
    Hacky manual check of a word pronounceability.
    """
    if word[-1] == "b" or word[-1] == "g":
        return False
    consonant_counter = 0
    for char in word:
        if char in VOWELS:
            consonant_counter = 0
        else:
            consonant_counter += 1
        if consonant_counter >= 3:
            return False
    return True


def find_best_pseudonyms(original_name, gender, topk, topl):
    """
    Find best annagram pseudonyms given an original name and a gender.
    Return the topl best lastnames for each firstname found.
    """
    bests = dict()
    def sorting_key(tuple_):
        return -tuple_[2]
    for firstname, lastname, proba in find_pseudonyms(original_name, gender, topk):
        if lastname is None or not basic_check(lastname):
            continue
        bests.setdefault(firstname, BestList(topl, sorting_key))
        bests[firstname].append((firstname, lastname, proba))
    return sorted(sum(bests.values(), []), key=sorting_key)
