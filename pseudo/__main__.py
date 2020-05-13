"""
French anagram pseudonym generator based on Markov chains.
"""

import argparse
from pseudo import find_best_pseudonyms


def capitalize(name):
    """
    Makes the first letter of a word uppercase.
    """
    return name[0].upper() + name[1:]


def main():
    """
    Main function.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("-k", "--topk", type=int, default=3)
    parser.add_argument("-l", "--topl", type=int, default=2)
    parser.add_argument("gender", choices=["male", "female"])
    parser.add_argument("original", type=str)
    args = parser.parse_args()
    for firstname, lastname, _ in find_best_pseudonyms(
            args.original,
            args.gender,
            args.topk,
            args.topl
    ):
        print(capitalize(firstname), capitalize(lastname))


main()
