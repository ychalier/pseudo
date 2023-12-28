#!/bin/bash
parent_path=$(dirname "${BASH_SOURCE[0]}")
zip "$parent_path/../www/model.zip" "$parent_path/tokens.tsv" "$parent_path/firstnames.txt" "$parent_path/streets.txt" "$parent_path/elves.txt"