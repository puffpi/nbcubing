// COLL: 40 cases across seven groups. Algorithms transcribed from CubingApp's
// published COLL case tables (https://cubingapp.com/algorithms/COLL).
// The first algorithm is shown in the list; every documented alternative is
// available in the case detail and derives its own diagram and cube setup.
window.COLL_ALGORITHMS = {
    "coll_pi": [
        {
            "name": "1",
            "algs": [
                "R' U2 R2 U R2 U R2 U2 R'",
                "U2 L' U2 L2 U L2 U L2 U2 L'",
                "R U2 R2 U' R2 U' R2 U2 R",
                "R U R' U R U2 R' U' R U R' U R U2 R'"
            ],
            "alg": "R' U2 R2 U R2 U R2 U2 R'"
        },
        {
            "name": "2",
            "algs": [
                "U F U R U' R' U R U' R2 F' R U R U' R'",
                "R' F2 R U2 R U2 R' F2 U' R U' R'",
                "U2 L' U' L U L F' L2 U' L U L' U' L U F",
                "U M F R' F' r U2 R U' R' U R U2 R'"
            ],
            "alg": "U F U R U' R' U R U' R2 F' R U R U' R'"
        },
        {
            "name": "3",
            "algs": [
                "R' U' F' R U R' U' R' F R2 U2 R' U2 R",
                "U F U R U' R' U R U2 R' U' R U R' F'",
                "U F R2 U' R2 U R2 U S R2 f'",
                "U' R U R' U R U2 R2 F' r U R U' r' F"
            ],
            "alg": "R' U' F' R U R' U' R' F R2 U2 R' U2 R"
        },
        {
            "name": "4",
            "algs": [
                "R U R' U' R' F R2 U R' U' R U R' U' F'",
                "R U2 R' U' R U R' U2 r' F R F' M'",
                "U' R' U2 R U R' U R2 U' L' U R' U' L",
                "U2 L F2 L' U2 L' U2 L F2 U L' U L"
            ],
            "alg": "R U R' U' R' F R2 U R' U' R U R' U' F'"
        },
        {
            "name": "5",
            "algs": [
                "U' R U R' U F' R U2 R' U2 R' F R",
                "U' R U2 R' U R' D' R U2 R' D R2 U' R'",
                "R U' L' U R' U L U L' U L",
                "U2 L' U R U' L U' R' U' R U' R'"
            ],
            "alg": "U' R U R' U F' R U2 R' U2 R' F R"
        },
        {
            "name": "6",
            "algs": [
                "U' r U R' U R' F R F' R U' R' U R U2 r'",
                "R' F' U' F U' R U S' R' U R S",
                "R2 D' R U R' D R U R U' R' U R U R' U R",
                "R U2 R2 F R F' R' F R F' R' F R F' R U2 R'"
            ],
            "alg": "U' r U R' U R' F R F' R U' R' U R U2 r'"
        }
    ],
    "coll_h": [
        {
            "name": "1",
            "algs": [
                "R U R' U R U' R' U R U2 R'",
                "U' R U2 R' U' R U R' U' R U' R'",
                "U R U2 R' U' R U R' U' R U' R'",
                "U' R' U2 R U R' U' R U R' U R"
            ],
            "alg": "R U R' U R U' R' U R U2 R'"
        },
        {
            "name": "2",
            "algs": [
                "F R U' R' U R U2 R' U' R U R' U' F'",
                "f R2 S' U' R2 U' R2 U R2 F'",
                "U2 f R U R' U' R F' R U R' U' R' S'",
                "f R U R' U' f' R U R' U' R' F R F'"
            ],
            "alg": "F R U' R' U R U2 R' U' R U R' U' F'"
        },
        {
            "name": "3",
            "algs": [
                "R U R' U R U L' U R' U' L",
                "R' F' R U2 R U2 R' F U' R U' R'",
                "R U R' U R U r' F R' F' r",
                "R U R2 D' R U2 R' D R U' R U2 R'"
            ],
            "alg": "R U R' U R U L' U R' U' L"
        },
        {
            "name": "4",
            "algs": [
                "U F R U R' U' R U R' U' R U R' U' F'",
                "U F U R U' R' U R U' R' U R U' R' F'",
                "U' F U R U' R' U R U' R' U R U' R' F'",
                "U R' F2 R2 U2 R' F2 R U2 R2 F2 R"
            ],
            "alg": "U F R U R' U' R U R' U' R U R' U' F'"
        }
    ],
    "coll_t": [
        {
            "name": "1",
            "algs": [
                "R U2 R' U' R U' R2 U2 R U R' U R",
                "U' R U R' U R U2 R' L' U' L U' L' U2 L",
                "U' R U R2 U' R2 U' R2 U2 R U' R U' R'",
                "R U2 R' r' F2 r U' R U' R' U' r' F r"
            ],
            "alg": "R U2 R' U' R U' R2 U2 R U R' U R"
        },
        {
            "name": "2",
            "algs": [
                "R' U R U2 R' L' U R U' L",
                "R' U2 R U R2 F R U R U' R' F' R",
                "U2 R' F R U R' U' R' F' R2 U' R' U2 R",
                "U2 R U' R' U2 L R U' R' U L'"
            ],
            "alg": "R' U R U2 R' L' U R U' L"
        },
        {
            "name": "3",
            "algs": [
                "U R' F' r U R U' r' F",
                "U l' U' L U R U' r' F",
                "U2 R' U' R' D' R U R' D R2",
                "U2 x' R U R' D R U' R' D' x"
            ],
            "alg": "U R' F' r U R U' r' F"
        },
        {
            "name": "4",
            "algs": [
                "U2 F R U R' U' R U' R' U' R U R' F'",
                "U2 F R' D' R U2 R' D R U2 F'",
                "U R U2 R' F2 R U2 R' U2 R' F2 R",
                "U' L' U2 R U2 R' U2 L U2 R U2 R'"
            ],
            "alg": "U2 F R U R' U' R U' R' U' R U R' F'"
        },
        {
            "name": "5",
            "algs": [
                "U' r U R' U' r' F R F'",
                "R U R D R' U' R D' R2",
                "U' R U R' U' L' U R U' R' L",
                "R' F' R U R' U' R' F R U R"
            ],
            "alg": "U' r U R' U' r' F R F'"
        },
        {
            "name": "6",
            "algs": [
                "R' U R2 D r' U2 r D' R2 U' R",
                "U2 R U' R2 D' r U2 r' D R2 U R'",
                "U R' U' R U R2 D' R U2 R' D R2 U' R' U R",
                "U R U R' U' R2 D R' U2 R D' R2 U R U' R'"
            ],
            "alg": "R' U R2 D r' U2 r D' R2 U' R"
        }
    ],
    "coll_l": [
        {
            "name": "1",
            "algs": [
                "U' R U R' U R U' R' U R U' R' U R U2 R'",
                "U' R U2 R' U' R U R' U' R U R' U' R U' R'",
                "U2 R' U2 R U R' U' R U R' U' R U R' U R",
                "R' U' R U' R' U2 R U' R U R' U R U2 R'"
            ],
            "alg": "U' R U R' U R U' R' U R U' R' U R U2 R'"
        },
        {
            "name": "2",
            "algs": [
                "R' U2 R' D' R U2 R' D R2",
                "U2 L' U2 L' D' L U2 L' D L2",
                "U' R' U2 R U R2 D' R U R' D R2",
                "U' r D r' U r D' r' U y R U2 R'"
            ],
            "alg": "R' U2 R' D' R U2 R' D R2"
        },
        {
            "name": "3",
            "algs": [
                "U R U2 R D R' U2 R D' R2",
                "U2 R U2 R2 D' R U' R' D R2 U' R'",
                "R' F' R U R' U' R' F R2 U' R' U2 R",
                "R' D' r U2 r' D R U2 R U R'"
            ],
            "alg": "U R U2 R D R' U2 R D' R2"
        },
        {
            "name": "4",
            "algs": [
                "U F R' F' r U R U' r'",
                "U2 R2 D R' U R D' R' U' R'",
                "R U R' U' R' F R U R U' R' F'",
                "x' R U' R' D R U R' D' x"
            ],
            "alg": "U F R' F' r U R U' r'"
        },
        {
            "name": "5",
            "algs": [
                "U2 F' r U R' U' r' F R",
                "U x R' U R D' R' U' R D x'",
                "U' R2 D' R U' R' D R U R",
                "U' F R U' R' U' R U2 R' U' F'"
            ],
            "alg": "U2 F' r U R' U' r' F R"
        },
        {
            "name": "6",
            "algs": [
                "U r U2 R2 F R F' R U2 r'",
                "U' R' U' R U R' F' R U R' U' R' F R2",
                "U' R' U' R U' F U' R' U' R U F'",
                "U F R U R2 F R F' R U' R' F'"
            ],
            "alg": "U r U2 R2 F R F' R U2 r'"
        }
    ],
    "coll_u": [
        {
            "name": "1",
            "algs": [
                "R' U' R U' R' U2 R2 U R' U R U2 R'",
                "U2 R U R' U R U2 R2 U' R U' R' U2 R",
                "U' R U R' U' R U' R' U2 R U' R' U2 R U R'",
                "U2 R U R' U R U2 R' U R U2 R' U' R U' R'"
            ],
            "alg": "R' U' R U' R' U2 R2 U R' U R U2 R'"
        },
        {
            "name": "2",
            "algs": [
                "R' F R U' R' U' R U R' F' R U R' U' R' F R F' R",
                "U F U R U2 R' U R U R2 F' r U R U' r'",
                "U' R' U' R F R2 D' R U R' D R2 U' F'",
                "U' r U R' U' r' F R U R' U' R F' R' U R"
            ],
            "alg": "R' F R U' R' U' R U R' F' R U R' U' R' F R F' R"
        },
        {
            "name": "3",
            "algs": [
                "U2 R2 D R' U2 R D' R' U2 R'",
                "R' U R U R' F' R U R' U' R' F R2 U' R' U' R",
                "R U' R' U' R U2 R' U' R' D' R U2 R' D R",
                "R' U' R U' R' U2 R2 U' L' U R' U' L"
            ],
            "alg": "U2 R2 D R' U2 R D' R' U2 R'"
        },
        {
            "name": "4",
            "algs": [
                "F R U' R' U R U R' U R U' R' F'",
                "U2 R' F2 R U2 R U2 R' F2 R U2 R'",
                "U2 R U2 R' U2 L' U2 R U2 R' U2 L",
                "U' F U2 R' D' R U2 R' D R F'"
            ],
            "alg": "F R U' R' U R U R' U R U' R' F'"
        },
        {
            "name": "5",
            "algs": [
                "R2 D' R U2 R' D R U2 R",
                "R2 F' R U R' U' R' F R' U' R2 U2 R2 U R' U R",
                "U2 L2 D' L U2 L' D L U2 L",
                "L U' R U' L' U R' U2 L U' L'"
            ],
            "alg": "R2 D' R U2 R' D R U2 R"
        },
        {
            "name": "6",
            "algs": [
                "R2 D' R U R' D R U R U' R' U' R",
                "R' U2 R F U' R' U' R U F'",
                "R U' R' U' R U R D R' U R D' R2",
                "R' U2 R U2 R' F' R U R' U' R' F R2"
            ],
            "alg": "R2 D' R U R' D R U R U' R' U' R"
        }
    ],
    "coll_sune": [
        {
            "name": "1",
            "algs": [
                "R U R' U R U2 R'",
                "U' R' U2 R U R' U R",
                "U2 L U L' U L U2 L'",
                "U L' U2 L U L' U L"
            ],
            "alg": "R U R' U R U2 R'"
        },
        {
            "name": "2",
            "algs": [
                "U2 R U R' U R2 D R' U2 R D' R2",
                "r' F2 r U2 R U' r' F M'",
                "L' U2 L U2 R U' L' U L R'",
                "L' U2 L U2 l F' L' F M'"
            ],
            "alg": "U2 R U R' U R2 D R' U2 R D' R2"
        },
        {
            "name": "3",
            "algs": [
                "L' R U R' U' L U2 R U2 R'",
                "U2 R2 D' R U2 R' D R2 U R' U R",
                "f R' F' R U2 R U2 R' U2 S'",
                "M F R' F' r U2 R U2 R'"
            ],
            "alg": "L' R U R' U' L U2 R U2 R'"
        },
        {
            "name": "4",
            "algs": [
                "U' R U R' U R U' R D R' U' R D' R2",
                "U' F R' U2 R F' R' F U2 F' R",
                "R U R' U' R' F R F' r U R' U R U2 r'",
                "r U R' U' r' F R F' R U R' U R U2 R'"
            ],
            "alg": "U' R U R' U R U' R D R' U' R D' R2"
        },
        {
            "name": "5",
            "algs": [
                "R U' L' U R' U' L",
                "R U' r' F R' F' r",
                "U2 L U' R' U L' U' R",
                "z D R' U' R D' R' U R z'"
            ],
            "alg": "R U' L' U R' U' L"
        },
        {
            "name": "6",
            "algs": [
                "U2 R U R' F' R U R' U R U2 R' F R U' R'",
                "U2 R U R' U r' F R F' r U2 R'",
                "F R U' R2 U2 R U R' U R2 U R' F'",
                "F' R U2 R' U2 R' F2 R U R U' R' F'"
            ],
            "alg": "U2 R U R' F' R U R' U R U2 R' F R U' R'"
        }
    ],
    "coll_antisune": [
        {
            "name": "1",
            "algs": [
                "R' U' R U' R' U2 R",
                "U R U2 R' U' R U' R'",
                "U2 L' U' L U' L' U2 L",
                "U' L U2 L' U' L U' L'"
            ],
            "alg": "R' U' R U' R' U2 R"
        },
        {
            "name": "2",
            "algs": [
                "U R' U' R U' R' U R' D' R U R' D R2",
                "U2 R2 D R' U R D' R' U R' U' R U' R'",
                "U2 R' F U2 F' R F R' U2 R F'"
            ],
            "alg": "U R' U' R U' R' U R' D' R U R' D R2"
        },
        {
            "name": "3",
            "algs": [
                "U2 R2 D R' U2 R D' R2 U' R U' R'",
                "R' U' F' R U R' U' R' F R2 U' R' U R",
                "U2 f' L F L' U2 L' U2 L U2 S"
            ],
            "alg": "U2 R2 D R' U2 R D' R2 U' R U' R'"
        },
        {
            "name": "4",
            "algs": [
                "U2 R' U' R U' R2 D' R U2 R' D R2",
                "U2 R U2 R' U2 r' F R F' M'",
                "R' U' R U R' F R U R' U' R' F' R2",
                "U2 R U2 R' U2 L' U R U' R' L"
            ],
            "alg": "U2 R' U' R U' R2 D' R U2 R' D R2"
        },
        {
            "name": "5",
            "algs": [
                "U2 r' F R F' r U R'",
                "U2 L' U R U' L U R'",
                "R' U L U' R U L'"
            ],
            "alg": "U2 r' F R F' r U R'"
        },
        {
            "name": "6",
            "algs": [
                "R U R' F' R U2 R' U' R U' R' F R U' R'",
                "R U2 r' F R' F' r U' R U' R'",
                "R U' R' U2 R U' R' U2 R' D' R U R' D R",
                "U2 L U2 R' U L' U' R U' L U' L'"
            ],
            "alg": "R U R' F' R U2 R' U' R U' R' F R U' R'"
        }
    ]
};

