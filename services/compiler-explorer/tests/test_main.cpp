// Compiles Catch2's main() exactly once. All other test_*.cpp files
// include catch.hpp without CATCH_CONFIG_MAIN.
#define CATCH_CONFIG_MAIN
#include "catch.hpp"
