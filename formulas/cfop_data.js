// CFOP cases adapted from Cube Coach by Luke Jackson:
// https://github.com/lukejacksonn/cube (MIT license)
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
// Loaded only after the user opens the formula library.
window.CFOP_ALGORITHMS = {
  "f2l": [
    {
      "name": "1",
      "group": "Basic Insert",
      "alg": "U (R U' R')",
      "algs": [
        "U (R U' R')"
      ]
    },
    {
      "name": "2",
      "group": "Basic Insert",
      "alg": "y' U' (R' U R)",
      "algs": [
        "y' U' (R' U R)",
        "y U' (L' U L)"
      ]
    },
    {
      "name": "3",
      "group": "Basic Insert",
      "alg": "y' (R' U' R)",
      "algs": [
        "y' (R' U' R)",
        "y (L' U' L)"
      ]
    },
    {
      "name": "4",
      "group": "Basic Insert",
      "alg": "(R U R')",
      "algs": [
        "(R U R')"
      ]
    },
    {
      "name": "5",
      "group": "Different Facing Up",
      "alg": "U' (R U' R' U) y' (R' U' R)",
      "algs": [
        "U' (R U' R' U) y' (R' U' R)",
        "y' U (R' U' R U') (R' U' R)"
      ]
    },
    {
      "name": "6",
      "group": "Different Facing Up",
      "alg": "U' (R U R' U) (R U R')",
      "algs": [
        "U' (R U R' U) (R U R')"
      ]
    },
    {
      "name": "7",
      "group": "Different Facing Up",
      "alg": "U' (R U2' R' U) y' (R' U' R)",
      "algs": [
        "U' (R U2' R' U) y' (R' U' R)",
        "U' (R U2' R') d (R' U' R)"
      ]
    },
    {
      "name": "8",
      "group": "Different Facing Up",
      "alg": "R' U2' R2 U R2' U R",
      "algs": [
        "R' U2' R2 U R2' U R",
        "y' U (R' U2 R) U' y (R U R')",
        "(R U' R' U) (R U' R') U2 (R U' R')"
      ]
    },
    {
      "name": "9",
      "group": "Different Facing Up",
      "alg": "y' U (R' U R U') (R' U' R)",
      "algs": [
        "y' U (R' U R U') (R' U' R)"
      ]
    },
    {
      "name": "10",
      "group": "Different Facing Up",
      "alg": "U' (R U' R' U) (R U R')",
      "algs": [
        "U' (R U' R' U) (R U R')"
      ]
    },
    {
      "name": "11",
      "group": "Same Facing Up",
      "alg": "(U' R U R') U2 (R U' R')",
      "algs": [
        "(U' R U R') U2 (R U' R')"
      ]
    },
    {
      "name": "12",
      "group": "Same Facing Up",
      "alg": "y' (U R' U' R) U2' (R' U R) ",
      "algs": [
        "y' (U R' U' R) U2' (R' U R)",
        "d (R' U' R) U2' (R' U R)"
      ]
    },
    {
      "name": "13",
      "group": "Same Facing Up",
      "alg": "U' (R U2' R') U2 (R U' R')",
      "algs": [
        "U' (R U2' R') U2 (R U' R')"
      ]
    },
    {
      "name": "14",
      "group": "Same Facing Up",
      "alg": "y' U (R' U2 R) U2' (R' U R) ",
      "algs": [
        "y' U (R' U2 R) U2' (R' U R)",
        "d (R' U2 R) U2' (R' U R)"
      ]
    },
    {
      "name": "15",
      "group": "White Facing Up",
      "alg": "U (R U2 R') U (R U' R')",
      "algs": [
        "U (R U2 R') U (R U' R')"
      ]
    },
    {
      "name": "16",
      "group": "White Facing Up",
      "alg": "y' U' (R' U2 R) U' (R' U R)",
      "algs": [
        "y' U' (R' U2 R) U' (R' U R)"
      ]
    },
    {
      "name": "17",
      "group": "White Facing Up",
      "alg": "U2 (R U R' U) (R U' R')",
      "algs": [
        "U2 (R U R' U) (R U' R')",
        "(R U' R') U2 (R U R')"
      ]
    },
    {
      "name": "18",
      "group": "White Facing Up",
      "alg": "y' U2 (R' U' R) U' (R' U R)",
      "algs": [
        "y' U2 (R' U' R) U' (R' U R)"
      ]
    },
    {
      "name": "19",
      "group": "Incorrectly Connected",
      "alg": "y' (R' U R) U2' y (R U R')",
      "algs": [
        "y' (R' U R) U2' y (R U R')",
        "(R U R') U2 (R U' R' U) (R U' R')"
      ]
    },
    {
      "name": "20",
      "group": "Incorrectly Connected",
      "alg": "(R U' R' U2) y' (R' U' R)",
      "algs": [
        "(R U' R' U2) y' (R' U' R)",
        "U F (R U R' U') F' (U R U' R')"
      ]
    },
    {
      "name": "21",
      "group": "Incorrectly Connected",
      "alg": "(R U2 R') U' (R U R')",
      "algs": [
        "(R U2 R') U' (R U R')"
      ]
    },
    {
      "name": "22",
      "group": "Incorrectly Connected",
      "alg": "y' (R' U2 R) U (R' U' R)",
      "algs": [
        "y' (R' U2 R) U (R' U' R)"
      ]
    },
    {
      "name": "23",
      "group": "Incorrectly Connected",
      "alg": "U (R U' R' U') (R U' R' U) (R U' R')",
      "algs": [
        "U (R U' R' U') (R U' R' U) (R U' R')",
        "(R U R' U2') (R U R' U') (R U R')"
      ]
    },
    {
      "name": "24",
      "group": "Incorrectly Connected",
      "alg": "y' U' (R' U R U) (R' U R U') (R' U R)",
      "algs": [
        "y' U' (R' U R U) (R' U R U') (R' U R)",
        "F (U R U' R') F' (R U' R')"
      ]
    },
    {
      "name": "25",
      "group": "Corner In Edge Out",
      "alg": "U' F' (R U R' U') R' F R",
      "algs": [
        "U' F' (R U R' U') R' F R",
        "R' F' R U (R U' R') F"
      ]
    },
    {
      "name": "26",
      "group": "Corner In Edge Out",
      "alg": "U (R U' R') U' (F' U F)",
      "algs": [
        "U (R U' R') U' (F' U F)",
        "U (R U' R') (F R' F' R)"
      ]
    },
    {
      "name": "27",
      "group": "Corner In Edge Out",
      "alg": "(R U' R' U) (R U' R')",
      "algs": [
        "(R U' R' U) (R U' R')"
      ]
    },
    {
      "name": "28",
      "group": "Corner In Edge Out",
      "alg": "y' (R' U R U') (R' U R)",
      "algs": [
        "y' (R' U R U') (R' U R)"
      ]
    },
    {
      "name": "29",
      "group": "Corner In Edge Out",
      "alg": "y' (R' U' R U) (R' U' R)",
      "algs": [
        "y' (R' U' R U) (R' U' R)",
        "(R' F R F') U (R U' R')"
      ]
    },
    {
      "name": "30",
      "group": "Corner In Edge Out",
      "alg": "(R U R' U') (R U R')",
      "algs": [
        "(R U R' U') (R U R')"
      ]
    },
    {
      "name": "31",
      "group": "Edge In Corner Out",
      "alg": "(R U' R' U) y' (R' U R)",
      "algs": [
        "(R U' R' U) y' (R' U R)",
        "U' (R' F R F') (R U' R')"
      ]
    },
    {
      "name": "32",
      "group": "Edge In Corner Out",
      "alg": "(U R U' R') (U R U' R') (U R U' R')",
      "algs": [
        "(U R U' R') (U R U' R') (U R U' R')"
      ]
    },
    {
      "name": "33",
      "group": "Edge In Corner Out",
      "alg": "(U' R U' R') U2 (R U' R')",
      "algs": [
        "(U' R U' R') U2 (R U' R')"
      ]
    },
    {
      "name": "34",
      "group": "Edge In Corner Out",
      "alg": "U (R U R') U2 (R U R')",
      "algs": [
        "U (R U R') U2 (R U R')"
      ]
    },
    {
      "name": "35",
      "group": "Edge In Corner Out",
      "alg": "(U' R U R') U y' (R' U' R)",
      "algs": [
        "(U' R U R') U y' (R' U' R)"
      ]
    },
    {
      "name": "36",
      "group": "Edge In Corner Out",
      "alg": "U (F' U' F) U' (R U R')",
      "algs": [
        "U (F' U' F) U' (R U R')"
      ]
    },
    {
      "name": "37",
      "group": "Both In Slot",
      "alg": "(R U' R') d (R' U2 R) U2' (R' U R) ",
      "algs": [
        "(R U' R') d (R' U2 R) U2' (R' U R)"
      ]
    },
    {
      "name": "38",
      "group": "Both In Slot",
      "alg": "(R U' R' U') R U R' U2 (R U' R')",
      "algs": [
        "(R U' R' U') R U R' U2 (R U' R')",
        "(R U R' U') R U2 R' U' (R U R')"
      ]
    },
    {
      "name": "39",
      "group": "Both In Slot",
      "alg": "(R U' R' U) (R U2' R') U (R U' R')",
      "algs": [
        "(R U' R' U) (R U2' R') U (R U' R')",
        "(R U R') U2' (R U' R' U) (R U R')"
      ]
    },
    {
      "name": "40",
      "group": "Both In Slot",
      "alg": "(F' U F) U2 (R U R' U) (R U' R')",
      "algs": [
        "(F' U F) U2 (R U R' U) (R U' R')",
        "(R U' R') F (R U R' U') F' (R U' R')"
      ]
    },
    {
      "name": "41",
      "group": "Both In Slot",
      "alg": "(R U R' U') (R U' R') U2 y' (R' U' R)",
      "algs": [
        "(R U R' U') (R U' R') U2 y' (R' U' R)"
      ]
    }
  ],
  "oll": [
    {
      "name": "1",
      "group": "Dot",
      "alg": "R U2 R' R' F R F' U2 R' F R F'",
      "algs": [
        "R U2 R' R' F R F' U2 R' F R F'"
      ]
    },
    {
      "name": "2",
      "group": "Dot",
      "alg": "r U r' U2 r U2 R' U2 R U' r'",
      "algs": [
        "r U r' U2 r U2 R' U2 R U' r'",
        "y' F R U R' U' F' f R U R' U' f'",
        "y' F R U R' U' S R U R' U' f'"
      ]
    },
    {
      "name": "3",
      "group": "Dot",
      "alg": "r' R2 U R' U r U2 r' U M'",
      "algs": [
        "r' R2 U R' U r U2 r' U M'",
        "y F U R U' R' F' U F R U R' U' F'",
        "y' f R U R' U' f' U' F R U R' U' F'"
      ]
    },
    {
      "name": "4",
      "group": "Dot",
      "alg": "M U' r U2 r' U' R U' R' M'",
      "algs": [
        "M U' r U2 r' U' R U' R' M'",
        "y F U R U' R' F' U' F R U R' U' F'",
        "y' f R U R' U' f' U F R U R' U' F'"
      ]
    },
    {
      "name": "5",
      "group": "Square Shape",
      "alg": "l' U2 L U L' U l",
      "algs": [
        "l' U2 L U L' U l",
        "y2 r' U2 R U R' U r"
      ]
    },
    {
      "name": "6",
      "group": "Square Shape",
      "alg": "r U2 R' U' R U' r'",
      "algs": [
        "r U2 R' U' R U' r'"
      ]
    },
    {
      "name": "7",
      "group": "Small Lightning Bolt",
      "alg": "r U R' U R U2 r'",
      "algs": [
        "r U R' U R U2 r'"
      ]
    },
    {
      "name": "8",
      "group": "Small Lightning Bolt",
      "alg": "l' U' L U' L' U2 l",
      "algs": [
        "l' U' L U' L' U2 l",
        "R U2 R' U2 R' F R F'",
        "y2 r' U' R U' R' U2 r"
      ]
    },
    {
      "name": "9",
      "group": "Fish Shape",
      "alg": "R U R' U' R' F R2 U R' U' F'",
      "algs": [
        "R U R' U' R' F R2 U R' U' F'"
      ]
    },
    {
      "name": "10",
      "group": "Fish Shape",
      "alg": "R U R' U R' F R F' R U2 R'",
      "algs": [
        "R U R' U R' F R F' R U2 R'",
        "y2 r U R' U R U' R' U' r' R (U R U' R')"
      ]
    },
    {
      "name": "11",
      "group": "Small Lightning Bolt",
      "alg": "r U R' U R' F R F' R U2 r'",
      "algs": [
        "r U R' U R' F R F' R U2 r'",
        "y2 r' R2 U R' U R U2 R' U M'"
      ]
    },
    {
      "name": "12",
      "group": "Small Lightning Bolt",
      "alg": "M' R' U' R U' R' U2 R U' R r'",
      "algs": [
        "M' R' U' R U' R' U2 R U' R r'"
      ]
    },
    {
      "name": "13",
      "group": "Knight Move Shape",
      "alg": "F U R U' R2 F' R U R U' R'",
      "algs": [
        "F U R U' R2 F' R U R U' R'",
        "r U' r' U' r U r' y' R' U R"
      ]
    },
    {
      "name": "14",
      "group": "Knight Move Shape",
      "alg": "R' F R U R' F' R F U' F'",
      "algs": [
        "R' F R U R' F' R F U' F'"
      ]
    },
    {
      "name": "15",
      "group": "Knight Move Shape",
      "alg": "l' U' l L' U' L U l' U l",
      "algs": [
        "l' U' l L' U' L U l' U l",
        "y2 r' U' r R' U' R U r' U r"
      ]
    },
    {
      "name": "16",
      "group": "Knight Move Shape",
      "alg": "r U r' R U R' U' r U' r'",
      "algs": [
        "r U r' R U R' U' r U' r'"
      ]
    },
    {
      "name": "17",
      "group": "Dot",
      "alg": "F R' F' R2 r' U R U' R' U' M'",
      "algs": [
        "F R' F' R2 r' U R U' R' U' M'",
        "y2 R U R' U R' F R F' U2 R' F R F'"
      ]
    },
    {
      "name": "18",
      "group": "Dot",
      "alg": "r U R' U R U2 r' r' U' R U' R' U2 r",
      "algs": [
        "r U R' U R U2 r' r' U' R U' R' U2 r",
        "y R U2 R' R' F R F' U2 M' (U R U' r')"
      ]
    },
    {
      "name": "19",
      "group": "Dot",
      "alg": "r' R U R U R' U' M' R' F R F'",
      "algs": [
        "r' R U R U R' U' M' R' F R F'"
      ]
    },
    {
      "name": "20",
      "group": "Dot",
      "alg": "r U R' U' M2 U R U' R' U' M'",
      "algs": [
        "r U R' U' M2 U R U' R' U' M'",
        "r' R U (R U R' U') M2 U R U' r'"
      ]
    },
    {
      "name": "21",
      "group": "Cross",
      "alg": "R U2 R' U' R U R' U' R U' R'",
      "algs": [
        "R U2 R' U' R U R' U' R U' R'",
        "y R U R' U R U' R' U R U2 R'"
      ]
    },
    {
      "name": "22",
      "group": "Cross",
      "alg": "R U2 (R2 U' R2 U' R2) U2 R",
      "algs": [
        "R U2 (R2 U' R2 U' R2) U2 R"
      ]
    },
    {
      "name": "23",
      "group": "Cross",
      "alg": "R2 D' R U2 R' D R U2 R",
      "algs": [
        "R2 D' R U2 R' D R U2 R",
        "y2 R2 D R' U2 R D' R' U2 R'"
      ]
    },
    {
      "name": "24",
      "group": "Cross",
      "alg": "r U R' U' r' F R F'",
      "algs": [
        "r U R' U' r' F R F'",
        "y R U R D R' U' R D' R2"
      ]
    },
    {
      "name": "25",
      "group": "Cross",
      "alg": "F' r U R' U' r' F R",
      "algs": [
        "F' r U R' U' r' F R",
        "y' R' F R B' R' F' R B"
      ]
    },
    {
      "name": "26",
      "group": "Cross",
      "alg": "(R U2 R') U' R U' R'",
      "algs": [
        "(R U2 R') U' R U' R'",
        "y' R' U' R U' R' U2 R"
      ]
    },
    {
      "name": "27",
      "group": "Cross",
      "alg": "R U R' U R U2 R'",
      "algs": [
        "R U R' U R U2 R'",
        "y' R' U2 (R U R' U) R"
      ]
    },
    {
      "name": "28",
      "group": "Corners Oriented",
      "alg": "r U R' U' r' R U R U' R'",
      "algs": [
        "r U R' U' r' R U R U' R'"
      ]
    },
    {
      "name": "29",
      "group": "Awkward Shape",
      "alg": "R U R' U' R U' R' F' U' F R U R'",
      "algs": [
        "R U R' U' R U' R' F' U' F R U R'"
      ]
    },
    {
      "name": "30",
      "group": "Awkward Shape",
      "alg": "F R' F R2 U' R' U' R U R' F2",
      "algs": [
        "F R' F R2 U' R' U' R U R' F2",
        "F U (R U2 R' U') R U2 R' U' F'"
      ]
    },
    {
      "name": "31",
      "group": "P Shape",
      "alg": "R' U' F U R U' R' F' R",
      "algs": [
        "R' U' F U R U' R' F' R"
      ]
    },
    {
      "name": "32",
      "group": "P Shape",
      "alg": "L U F' U' L' U L F L'",
      "algs": [
        "L U F' U' L' U L F L'"
      ]
    },
    {
      "name": "33",
      "group": "T Shape",
      "alg": "R U R' U' R' F R F'",
      "algs": [
        "R U R' U' R' F R F'"
      ]
    },
    {
      "name": "34",
      "group": "C Shape",
      "alg": "R U R2 U' R' F R U R U' F'",
      "algs": [
        "R U R2 U' R' F R U R U' F'",
        "R U R' U' B' R' F R F' B"
      ]
    },
    {
      "name": "35",
      "group": "Fish Shape",
      "alg": "R U2 R' R' F R F' R U2 R'",
      "algs": [
        "R U2 R' R' F R F' R U2 R'"
      ]
    },
    {
      "name": "36",
      "group": "W Shape",
      "alg": "L' U' L U' L' U L U L F' L' F",
      "algs": [
        "L' U' L U' L' U L U L F' L' F",
        "y2 R' U' R U' R' U R U R B' R' B"
      ]
    },
    {
      "name": "37",
      "group": "Fish Shape",
      "alg": "F R' F' R U R U' R'",
      "algs": [
        "F R' F' R U R U' R'",
        "F R U' R' U' R U R' F'"
      ]
    },
    {
      "name": "38",
      "group": "W Shape",
      "alg": "R U R' U R U' R' U' R' F R F'",
      "algs": [
        "R U R' U R U' R' U' R' F R F'"
      ]
    },
    {
      "name": "39",
      "group": "Big Lightning Bolt",
      "alg": "L F' L' U' L U F U' L'",
      "algs": [
        "L F' L' U' L U F U' L'",
        "y2 R B' R' U' R U B U' R'"
      ]
    },
    {
      "name": "40",
      "group": "Big Lightning Bolt",
      "alg": "R' F R U R' U' F' U R",
      "algs": [
        "R' F R U R' U' F' U R"
      ]
    },
    {
      "name": "41",
      "group": "Awkward Shape",
      "alg": "R U R' U R U2 R' F R U R' U' F'",
      "algs": [
        "R U R' U R U2 R' F R U R' U' F'"
      ]
    },
    {
      "name": "42",
      "group": "Awkward Shape",
      "alg": "R' U' R U' R' U2 R F R U R' U' F'",
      "algs": [
        "R' U' R U' R' U2 R F R U R' U' F'"
      ]
    },
    {
      "name": "43",
      "group": "P Shape",
      "alg": "F' U' L' U L F",
      "algs": [
        "F' U' L' U L F",
        "R' U' F R' F' R U R"
      ]
    },
    {
      "name": "44",
      "group": "P Shape",
      "alg": "F U R U' R' F'",
      "algs": [
        "F U R U' R' F'",
        "y2 f R U R' U' f'"
      ]
    },
    {
      "name": "45",
      "group": "T Shape",
      "alg": "F R U R' U' F'",
      "algs": [
        "F R U R' U' F'"
      ]
    },
    {
      "name": "46",
      "group": "C Shape",
      "alg": "R' U' R' F R F' U R",
      "algs": [
        "R' U' R' F R F' U R"
      ]
    },
    {
      "name": "47",
      "group": "Small L Shape",
      "alg": "R' U' R' F R F' R' F R F' U R",
      "algs": [
        "R' U' R' F R F' R' F R F' U R",
        "F' L' U' L U L' U' L U F",
        "y' F U R U' R' F' R U R' U R U2 R'"
      ]
    },
    {
      "name": "48",
      "group": "Small L Shape",
      "alg": "F R U R' U' R U R' U' F'",
      "algs": [
        "F R U R' U' R U R' U' F'"
      ]
    },
    {
      "name": "49",
      "group": "Small L Shape",
      "alg": "r U' r2 U r2 U r2 U' r",
      "algs": [
        "r U' r2 U r2 U r2 U' r"
      ]
    },
    {
      "name": "50",
      "group": "Small L Shape",
      "alg": "r' U r2 U' r2 U' r2 U r'",
      "algs": [
        "r' U r2 U' r2 U' r2 U r'"
      ]
    },
    {
      "name": "51",
      "group": "I Shape",
      "alg": "F U R U' R' U R U' R' F'",
      "algs": [
        "F U R U' R' U R U' R' F'",
        "y2 f R U R' U' R U R' U' f'"
      ]
    },
    {
      "name": "52",
      "group": "I Shape",
      "alg": "R U R' U R U' B U' B' R'",
      "algs": [
        "R U R' U R U' B U' B' R'",
        "U2 R' F' U' F U' (R U R' U) R",
        "R U R' U R U' y R U' R' F'"
      ]
    },
    {
      "name": "53",
      "group": "Small L Shape",
      "alg": "l' U2 L U L' U' L U L' U l",
      "algs": [
        "l' U2 L U L' U' L U L' U l",
        "y2 r' U2 (R U R' U') R U R' U r",
        "y r' U' R U' R' U R U' R' U2 r"
      ]
    },
    {
      "name": "54",
      "group": "Small L Shape",
      "alg": "(r U2 R' U') R U R' U' R U' r'",
      "algs": [
        "(r U2 R' U') R U R' U' R U' r'",
        "y r U R' U R U' R' U R U2 r'"
      ]
    },
    {
      "name": "55",
      "group": "I Shape",
      "alg": "R' F R U R U' R2 F' R2 U' R' U R U R'",
      "algs": [
        "R' F R U R U' R2 F' R2 U' R' U R U R'",
        "y R U2 R2 U' R U' R' U2 F R F'"
      ]
    },
    {
      "name": "56",
      "group": "I Shape",
      "alg": "(r' U' r) U' R' U R U' R' U R r' U r",
      "algs": [
        "(r' U' r) U' R' U R U' R' U R r' U r",
        "(r U r') U R U' R' U R U' R' (r U' r')",
        "(r U r') U R U' R' U R U' M' U' r'"
      ]
    },
    {
      "name": "57",
      "group": "Corners Oriented",
      "alg": "R U R' U' M' U R U' r'",
      "algs": [
        "R U R' U' M' U R U' r'"
      ]
    }
  ],
  "pll": [
    {
      "name": "H",
      "group": "Edges Only",
      "alg": "M2 U M2 U2 M2 U M2",
      "algs": [
        "M2 U M2 U2 M2 U M2",
        "M2 U' M2 U2 M2 U' M2"
      ]
    },
    {
      "name": "Z",
      "group": "Edges Only",
      "alg": "M' U M2 U M2 U M' U2 M2",
      "algs": [
        "M' U M2 U M2 U M' U2 M2",
        "y M' U' M2 U' M2 U' M' U2 M2",
        "y M2 U M2 U M' U2 M2 U2 M'",
        "M2 U' M2 U' M' U2 M2 U2 M'"
      ]
    },
    {
      "name": "Ua",
      "group": "Edges Only",
      "alg": "M2 U M U2 M' U M2",
      "algs": [
        "M2 U M U2 M' U M2",
        "R U' R U R U R U' R' U' R2",
        "y2 R2 U' R' U' R U R U R U' R"
      ]
    },
    {
      "name": "Ub",
      "group": "Edges Only",
      "alg": "M2 U' M U2 M' U' M2",
      "algs": [
        "M2 U' M U2 M' U' M2",
        "R2 U (R U R' U') R' U' R' U R'",
        "y2 R' U R' U' R' U' (R' U R U) R2"
      ]
    },
    {
      "name": "Aa",
      "group": "Adjacent Corner Swap",
      "alg": "x L2 D2 L' U' L D2 L' U L'",
      "algs": [
        "x L2 D2 L' U' L D2 L' U L'",
        "y' x' L' U L' D2 L U' L' D2 L2",
        "y x R' U R' D2 R U' R' D2 R2",
        "y2 x' R2 D2 R' U' R D2 R' U R'"
      ]
    },
    {
      "name": "Ab",
      "group": "Adjacent Corner Swap",
      "alg": "x' L2 D2 L U L' D2 L U' L",
      "algs": [
        "x' L2 D2 L U L' D2 L U' L",
        "y x L U' L D2 L' U L D2 L2",
        "y2 x R2 D2 R U R' D2 R U' R",
        "y' x' R U' R D2 R' U R D2 R2"
      ]
    },
    {
      "name": "E",
      "group": "Diagonal Corner Swap",
      "alg": "x' L' U L D' L' U' L D L' U' L D' L' U L D",
      "algs": [
        "x' L' U L D' L' U' L D L' U' L D' L' U L D",
        "x' R U' R' D R U R' D' R U R' D R U' R' D'"
      ]
    },
    {
      "name": "F",
      "group": "Adjacent Corner Swap",
      "alg": "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R",
      "algs": [
        "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R"
      ]
    },
    {
      "name": "Ja",
      "group": "Adjacent Corner Swap",
      "alg": "x R2 F R F' R U2 r' U r U2",
      "algs": [
        "x R2 F R F' R U2 r' U r U2",
        "y2 L' U' L F L' U' L U L F' L2 U L",
        "y' R' U L' U2 R U' R' U2 R L"
      ]
    },
    {
      "name": "Jb",
      "group": "Adjacent Corner Swap",
      "alg": "R U R' F' R U R' U' R' F R2 U' R'",
      "algs": [
        "R U R' F' R U R' U' R' F R2 U' R'"
      ]
    },
    {
      "name": "Ra",
      "group": "Adjacent Corner Swap",
      "alg": "R U' R' U' R U R D R' U' R D' R' U2 R'",
      "algs": [
        "R U' R' U' R U R D R' U' R D' R' U2 R'",
        "R U R' F' R U2 R' U2 R' F R U R U2 R'",
        "y' L U2 L' U2 L F' L' U' L U L F L2"
      ]
    },
    {
      "name": "Rb",
      "group": "Adjacent Corner Swap",
      "alg": "R2 F R U R U' R' F' R U2 R' U2 R",
      "algs": [
        "R2 F R U R U' R' F' R U2 R' U2 R",
        "y' R' U2 R U2 R' F R U R' U' R' F' R2",
        "R' U2 R' D' R U' R' D R U R U' R' U' R"
      ]
    },
    {
      "name": "T",
      "group": "Adjacent Corner Swap",
      "alg": "R U R' U' R' F R2 U' R' U' (R U R') F'",
      "algs": [
        "R U R' U' R' F R2 U' R' U' (R U R') F'"
      ]
    },
    {
      "name": "Y",
      "group": "Diagonal Corner Swap",
      "alg": "F R U' R' U' R U R' F' R U R' U' R' F R F'",
      "algs": [
        "F R U' R' U' R U R' F' R U R' U' R' F R F'",
        "F R' F R2 U' R' U' R U R' F' R U R' U' F'"
      ]
    },
    {
      "name": "V",
      "group": "Diagonal Corner Swap",
      "alg": "R' U R' U' y R' F' R2 U' R' U R' F R F",
      "algs": [
        "R' U R' U' y R' F' R2 U' R' U R' F R F",
        "R' U R' U' R D' R' D R' U D' R2 U' R2 D R2",
        "z D' R2 D R2 U R' D' R U' R U R' D R U' z'",
        "R U2 R' D R U' R U' R U R2 D R' U' R D2",
        "x' R' F R F' U R U2 R' U' R U' R' U2 R U R' U'"
      ]
    },
    {
      "name": "Na",
      "group": "Diagonal Corner Swap",
      "alg": "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'",
      "algs": [
        "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'",
        "z U R' D R2 U' R D' U R' D R2 U' R D'"
      ]
    },
    {
      "name": "Nb",
      "group": "Diagonal Corner Swap",
      "alg": "R' (U R U' R') F' U' F R U R' F R' F' R U' R",
      "algs": [
        "R' (U R U' R') F' U' F R U R' F R' F' R U' R",
        "z D' R U' R2 D R' U D' R U' R2 D R' U"
      ]
    },
    {
      "name": "Ga",
      "group": "Adjacent Corner Swap",
      "alg": "R2 U R' U R' U' R U' R2 (U' D) R' U R D'",
      "algs": [
        "R2 U R' U R' U' R U' R2 (U' D) R' U R D'",
        "R2 u R' U R' U' R u' R2 y' R' U R"
      ]
    },
    {
      "name": "Gb",
      "group": "Adjacent Corner Swap",
      "alg": "R' U' R (U D') R2 U R' U R U' R U' R2 D",
      "algs": [
        "R' U' R (U D') R2 U R' U R U' R U' R2 D",
        "y F' U' F R2 u R' U R U' R u' R2"
      ]
    },
    {
      "name": "Gc",
      "group": "Adjacent Corner Swap",
      "alg": "R2 U' R U' R U R' U R2 (U D') R U' R' D",
      "algs": [
        "R2 U' R U' R U R' U R2 (U D') R U' R' D",
        "y2 R2 F2 R U2 R U2 R' F R U R' U' R' F R2",
        "R2 u' R U' R U R' u R2 y R U' R'"
      ]
    },
    {
      "name": "Gd",
      "group": "Adjacent Corner Swap",
      "alg": "R U R' (U' D) R2 U' R U' R' U R' U R2 D'",
      "algs": [
        "R U R' (U' D) R2 U' R U' R' U R' U R2 D'",
        "R U R' y' R2 u' R U' R' U R' u R2"
      ]
    }
  ]
};

// Several Cube Coach PLL variants omit the final cube rotation.
// Include it so their demonstrations end in the requested yellow-up orientation.
for (const entry of window.CFOP_ALGORITHMS.pll) {
  if (['Aa', 'Ab', 'E', 'Ja', 'V'].includes(entry.name)) {
    entry.algs = entry.algs.map(alg => {
      const rotation = alg.match(/(?:^|\s)x(')?(?:\s|$)/);
      if (!rotation) return alg;
      return `${alg} x${rotation[1] ? '' : "'"}`;
    });
  }
  // The z-prefixed alternatives do not produce a yellow top when reversed.
  if (['Na', 'Nb'].includes(entry.name)) entry.algs = entry.algs.filter(alg => !alg.startsWith('z '));
  entry.alg = entry.algs[0];
}

// Keep alternate PLL algorithms in the same AUF as their case diagrams.
const pllAufFixes = {
  Z: { 1: ['', ' U2'], 2: ['', " U'"], 3: ['', " U'"] },
  Ja: { 1: ['', ' U'], 2: ['', " U'"] },
  Ra: { 2: ['', ' U2'] },
  Rb: { 1: ['', ' U2'], 2: ["U' ", " U'"] },
  Ga: { 1: ['', " U'"] },
  Gb: { 1: ['', ' U'] },
  Gc: { 1: ['', ' U'], 2: ['', ' U'] },
  Gd: { 1: ['', " U'"] }
};
for (const entry of window.CFOP_ALGORITHMS.pll) {
  for (const [index, [before, after]] of Object.entries(pllAufFixes[entry.name] || {})) {
    entry.algs[index] = `${before}${entry.algs[index]}${after}`;
  }
}
